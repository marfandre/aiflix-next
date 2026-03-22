import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const log = (msg: string) => { console.log(msg); writeFileSync('scripts/_log.txt', msg + '\n', { flag: 'a' }); };
writeFileSync('scripts/_log.txt', ''); // clear

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function h2r(hex: string) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

async function main() {
    // List recent images
    const { data: recent, error: listErr } = await supa.from('images_meta')
        .select('id, path, source, colors, color_positions, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (listErr) { log('List error: ' + JSON.stringify(listErr)); return; }

    log('Recent images:');
    for (const r of recent ?? []) {
        log(`  ${r.id} | source=${r.source} | colors=${r.colors?.length ?? 0} | positions=${r.color_positions ? 'yes' : 'no'}`);
    }

    // Find the fal import or any image without positions
    const target = recent?.find(r => r.source === 'fal') ?? recent?.find(r => !r.color_positions && r.colors?.length);
    if (!target) { log('No target image found'); return; }

    log('\nTarget: ' + target.id);
    const colors = target.colors as string[];
    if (!colors?.length) { log('No colors'); return; }

    // Download from storage
    const { data: blob, error: dlErr } = await supa.storage.from('images').download(target.path);
    if (dlErr || !blob) { log('Download err: ' + JSON.stringify(dlErr)); return; }
    const buffer = Buffer.from(await blob.arrayBuffer());
    log('Downloaded: ' + (buffer.length / 1024).toFixed(0) + ' KB');

    // Process
    const { data: pd, info } = await sharp(buffer)
        .resize(200, 200, { fit: 'inside' }).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    log('Resized: ' + info.width + 'x' + info.height);

    const trgb = colors.map(h => h2r(h));
    const G = 10, gW = Math.ceil(info.width / G), gH = Math.ceil(info.height / G);
    const grids = trgb.map(() => Array.from({ length: gH }, () => new Float64Array(gW)));

    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        const r = pd[i], g = pd[i + 1], b = pd[i + 2];
        let bi = -1, bd = Infinity;
        for (let c = 0; c < trgb.length; c++) {
            const t = trgb[c]; if (!t) continue;
            const d = Math.sqrt((r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2);
            if (d < bd) { bd = d; bi = c; }
        }
        if (bi >= 0 && bd < 60) {
            const gx = Math.min(Math.floor(x / G), gW - 1), gy = Math.min(Math.floor(y / G), gH - 1);
            grids[bi][gy][gx] += 1 / (1 + bd);
        }
    }

    const pos: { hex: string; x: number; y: number }[] = [];
    for (let c = 0; c < colors.length; c++) {
        let md = 0, px = 0, py = 0;
        for (let gy = 0; gy < gH; gy++) for (let gx = 0; gx < gW; gx++)
            if (grids[c][gy][gx] > md) { md = grids[c][gy][gx]; px = gx; py = gy; }
        if (md > 0) pos.push({ hex: colors[c], x: +((px + .5) * G / info.width).toFixed(3), y: +((py + .5) * G / info.height).toFixed(3) });
        else pos.push({ hex: colors[c], x: .2 + c * .15, y: .3 + c * .1 });
    }

    // Separate close markers
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < .08 && d > 0) {
            const s = (.08 - d) / 2 / d;
            pos[i].x = Math.max(.02, Math.min(.98, pos[i].x - dx * s)); pos[i].y = Math.max(.02, Math.min(.98, pos[i].y - dy * s));
            pos[j].x = Math.max(.02, Math.min(.98, pos[j].x + dx * s)); pos[j].y = Math.max(.02, Math.min(.98, pos[j].y + dy * s));
        }
    }

    log('Positions: ' + JSON.stringify(pos));

    const { error: upErr } = await supa.from('images_meta').update({ color_positions: pos }).eq('id', target.id);
    if (upErr) log('Update error: ' + JSON.stringify(upErr));
    else log('SUCCESS! Updated color_positions for ' + target.id);
}

main().catch(e => log('FATAL: ' + e.message));
