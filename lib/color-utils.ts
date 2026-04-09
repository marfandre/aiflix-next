/**
 * Maps a hex color to a color family name using CIEDE2000 perceptual distance.
 * Finds the closest reference color from 15 families.
 */

type Lab = { L: number; a: number; b: number };

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    let h = hex.trim().toLowerCase();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    const num = Number.parseInt(h, 16);
    if (Number.isNaN(num)) return null;
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

function rgbToLab(r: number, g: number, b: number): Lab {
    let rn = r / 255, gn = g / 255, bn = b / 255;
    const f = (v: number) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
    rn = f(rn) * 100;
    gn = f(gn) * 100;
    bn = f(bn) * 100;

    const x = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
    const y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750;
    const z = rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041;

    const xn = x / 95.047, yn = y / 100.0, zn = z / 108.883;
    const fxyz = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = fxyz(xn), fy = fxyz(yn), fz = fxyz(zn);

    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function ciede2000(lab1: Lab, lab2: Lab): number {
    const kL = 1, kC = 1, kH = 1;
    const dL = lab2.L - lab1.L;
    const avgL = (lab1.L + lab2.L) / 2;

    const C1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
    const C2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
    const avgC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
    const a1p = lab1.a * (1 + G);
    const a2p = lab2.a * (1 + G);

    const C1p = Math.sqrt(a1p ** 2 + lab1.b ** 2);
    const C2p = Math.sqrt(a2p ** 2 + lab2.b ** 2);
    const dCp = C2p - C1p;
    const avgCp = (C1p + C2p) / 2;

    let h1p = Math.atan2(lab1.b, a1p) * (180 / Math.PI);
    if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(lab2.b, a2p) * (180 / Math.PI);
    if (h2p < 0) h2p += 360;

    let dHp = h2p - h1p;
    if (Math.abs(dHp) > 180) dHp = dHp > 0 ? dHp - 360 : dHp + 360;
    const dHpPrime = 2 * Math.sqrt(C1p * C2p) * Math.sin((dHp / 2) * (Math.PI / 180));

    let avgHp = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) avgHp = avgHp < 180 ? avgHp + 180 : avgHp - 180;

    const T = 1 - 0.17 * Math.cos((avgHp - 30) * (Math.PI / 180))
        + 0.24 * Math.cos(2 * avgHp * (Math.PI / 180))
        + 0.32 * Math.cos((3 * avgHp + 6) * (Math.PI / 180))
        - 0.2 * Math.cos((4 * avgHp - 63) * (Math.PI / 180));

    const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
    const SC = 1 + 0.045 * avgCp;
    const SH = 1 + 0.015 * avgCp * T;

    const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
    const RT = -RC * Math.sin(2 * dTheta * (Math.PI / 180));

    return Math.sqrt(
        (dL / (kL * SL)) ** 2 +
        (dCp / (kC * SC)) ** 2 +
        (dHpPrime / (kH * SH)) ** 2 +
        RT * (dCp / (kC * SC)) * (dHpPrime / (kH * SH))
    );
}

// Reference colors for each family — chosen to be "typical" representatives
const FAMILY_REFERENCES: { family: string; hex: string; lab: Lab }[] = [
    { family: 'red',    hex: '#CC2222' },
    { family: 'red',    hex: '#A01010' },
    { family: 'orange', hex: '#E88A2A' },
    { family: 'orange', hex: '#D06820' },
    { family: 'yellow', hex: '#E8D44D' },
    { family: 'green',  hex: '#3AA655' },
    { family: 'green',  hex: '#2D7A3E' },
    { family: 'teal',   hex: '#2A9D8F' },
    { family: 'cyan',   hex: '#45B7D1' },
    { family: 'blue',   hex: '#2E6BC6' },
    { family: 'blue',   hex: '#1E3A7A' },
    { family: 'indigo', hex: '#5B3F8C' },
    { family: 'indigo', hex: '#4B0082' },
    { family: 'indigo', hex: '#2E1065' }, // deep indigo
    { family: 'indigo', hex: '#312E81' }, // dark blue-indigo
    { family: 'purple', hex: '#8844AA' },
    { family: 'purple', hex: '#9333EA' },
    { family: 'purple', hex: '#A855F7' },
    { family: 'purple', hex: '#C084FC' },
    { family: 'pink',   hex: '#E875A0' },
    { family: 'pink',   hex: '#D63384' },
    { family: 'pink',   hex: '#FF69B4' },
    { family: 'pink',   hex: '#FFB6C1' }, // light pink (pastel)
    { family: 'pink',   hex: '#F8C0D7' }, // baby pink (pastel)
    // Mauve / dusty rose — desaturated purplish-pink (wisteria, dusty rose, lilac)
    { family: 'mauve',  hex: '#B784A7' },
    { family: 'mauve',  hex: '#C8A2C8' },
    { family: 'mauve',  hex: '#9B7B9E' },
    { family: 'mauve',  hex: '#D4919B' },
    // Peach / coral / salmon — warm pinkish-orange
    { family: 'peach',  hex: '#FFB07C' },
    { family: 'peach',  hex: '#FA8072' },
    { family: 'peach',  hex: '#E8A598' },
    { family: 'peach',  hex: '#FFCBA4' },
    { family: 'brown',  hex: '#8B5E3C' },
    { family: 'brown',  hex: '#6B4226' },
    { family: 'brown',  hex: '#888888' },
    { family: 'black',  hex: '#1A1A1A' },
    { family: 'black',  hex: '#333333' },
    { family: 'black',  hex: '#3B4852' }, // steel dark gray (blue-tinted)
    { family: 'black',  hex: '#4A5568' }, // slate gray
    { family: 'white',  hex: '#F0F0F0' },
    { family: 'white',  hex: '#C8C8C8' },
].map(ref => {
    const rgb = hexToRgb(ref.hex)!;
    return { ...ref, lab: rgbToLab(rgb.r, rgb.g, rgb.b) };
});

export function hexToFamily(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'black';

    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);

    let bestFamily = 'black';
    let bestDist = Infinity;

    for (const ref of FAMILY_REFERENCES) {
        const dist = ciede2000(lab, ref.lab);
        if (dist < bestDist) {
            bestDist = dist;
            bestFamily = ref.family;
        }
    }

    return bestFamily;
}

/**
 * Probabilistic color family classification.
 *
 * Returns top-N families with their probabilities (summing to ~1.0 across the
 * returned subset). Uses softmax over CIEDE2000 distances to per-family
 * minimum distances.
 *
 * Higher T = softer (more spread). Lower T = sharper (winner takes most).
 */
export type FamilyWeights = Record<string, number>;

export function hexToFamilyWeights(
    hex: string,
    options?: { topN?: number; minProb?: number; temperature?: number }
): FamilyWeights {
    const topN = options?.topN ?? 4;
    const minProb = options?.minProb ?? 0.05;
    const T = options?.temperature ?? 10;

    const rgb = hexToRgb(hex);
    if (!rgb) return { black: 1 };

    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);

    // Per-family minimum distance across all references for that family
    const minDistByFamily: Record<string, number> = {};
    for (const ref of FAMILY_REFERENCES) {
        const dist = ciede2000(lab, ref.lab);
        if (minDistByFamily[ref.family] === undefined || dist < minDistByFamily[ref.family]) {
            minDistByFamily[ref.family] = dist;
        }
    }

    // Softmax: score = exp(-d / T)
    const families = Object.keys(minDistByFamily);
    const scores = families.map(f => Math.exp(-minDistByFamily[f] / T));
    const totalScore = scores.reduce((a, b) => a + b, 0) || 1;
    const probs = families.map((f, i) => ({ family: f, prob: scores[i] / totalScore }));

    // Sort desc, take top-N, drop below minProb, renormalize
    probs.sort((a, b) => b.prob - a.prob);
    const top = probs.slice(0, topN).filter(p => p.prob >= minProb);
    const sum = top.reduce((a, b) => a + b.prob, 0) || 1;

    const result: FamilyWeights = {};
    for (const { family, prob } of top) {
        result[family] = Math.round((prob / sum) * 10000) / 10000;
    }
    return result;
}