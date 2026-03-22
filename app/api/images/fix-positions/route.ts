// app/api/images/fix-positions/route.ts
// Временный эндпоинт: добавляет color_positions к картинкам, у которых их нет
// GET /api/images/fix-positions

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function h2r(hex: string) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

async function findPositions(buffer: Buffer, colors: string[]) {
    const { data: pd, info } = await sharp(buffer)
        .resize(200, 200, { fit: "inside" }).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });

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
        else {
            // Fallback: nearest pixel
            let bestDist = Infinity, bestX = 0.5, bestY = 0.5;
            const t = trgb[c];
            if (t) {
                for (let y = 0; y < info.height; y += 2) for (let x = 0; x < info.width; x += 2) {
                    const idx = (y * info.width + x) * info.channels;
                    const dist = Math.sqrt((pd[idx] - t.r) ** 2 + (pd[idx + 1] - t.g) ** 2 + (pd[idx + 2] - t.b) ** 2);
                    if (dist < bestDist) { bestDist = dist; bestX = x / info.width; bestY = y / info.height; }
                }
            }
            pos.push({ hex: colors[c], x: bestX, y: bestY });
        }
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

    return pos;
}

export async function GET() {
    try {
        // Find images without color_positions
        const { data: images, error } = await supa.from("images_meta")
            .select("id, path, colors, color_positions")
            .not("colors", "is", null)
            .is("color_positions", null)
            .limit(50);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!images?.length) return NextResponse.json({ message: "All images already have positions", count: 0 });

        const results: { id: string; positions: number; error?: string }[] = [];

        for (const img of images) {
            try {
                const colors = img.colors as string[];
                if (!colors?.length) continue;

                // Download image from storage
                const { data: blob, error: dlErr } = await supa.storage.from("images").download(img.path);
                if (dlErr || !blob) {
                    results.push({ id: img.id, positions: 0, error: dlErr?.message ?? "download failed" });
                    continue;
                }
                const buffer = Buffer.from(await blob.arrayBuffer());

                // Find positions
                const positions = await findPositions(buffer, colors);

                // Update
                const { error: upErr } = await supa.from("images_meta")
                    .update({ color_positions: positions })
                    .eq("id", img.id);

                if (upErr) {
                    results.push({ id: img.id, positions: 0, error: upErr.message });
                } else {
                    results.push({ id: img.id, positions: positions.length });
                }
            } catch (e: any) {
                results.push({ id: img.id, positions: 0, error: e.message });
            }
        }

        return NextResponse.json({
            message: `Processed ${results.length} images`,
            results,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
