/**
 * LEGACY: Previous color family detection methods, kept for reference.
 *
 * Evolution:
 *   1. color-namer (npm) — `result.basic[0].name` from the `color-namer` library.
 *   2. Inline hexToFamily with HSL thresholds — hand-rolled, duplicated in 9 files.
 *   3. CIEDE2000 in lib/color-utils.ts — current approach (perceptual distance).
 *
 * This file is NOT imported anywhere — it exists only as a fallback snapshot
 * in case we want to restore an older method or compare results.
 */

// =============================================================================
// METHOD 1: color-namer library (the very first approach)
// =============================================================================
//
// Used in app/api/mux/webhook/route.ts before "color families" commit (e31083b).
// Required: npm i color-namer
//
// Usage:
//   const namer = (await import('color-namer')).default;
//   const result = namer(hex);
//   const family = result.basic[0]?.name?.toLowerCase() ?? '';
//
// Pros: zero-maintenance, library handles all edge cases.
// Cons: `basic` palette only has ~17 colors, not perfectly aligned with our 13 families.

export async function hexToFamilyLegacyColorNamer(hex: string): Promise<string> {
    try {
        // @ts-ignore - color-namer has no types in some versions
        const namer = (await import('color-namer')).default;
        const result = namer(hex);
        return result.basic[0]?.name?.toLowerCase() ?? 'black';
    } catch {
        return 'black';
    }
}


// =============================================================================
// METHOD 2: Inline HSL-threshold hexToFamily (the second approach)
// =============================================================================
//
// This was duplicated in ~9 files before being consolidated. It uses HSL
// hue/saturation/lightness thresholds to bucket colors into families.
//
// Pros: synchronous, zero dependencies.
// Cons: many edge cases at hue boundaries (red/pink, pink/purple, etc.),
//       required constant tweaking when users found misclassified images.

function hexToHslLegacy(hex: string): { h: number; s: number; l: number } | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
}

export function hexToFamilyLegacyHsl(hex: string): string {
    const hsl = hexToHslLegacy(hex);
    if (!hsl) return 'black';
    const { h, s, l } = hsl;

    if (l < 12) return 'black';
    if (l > 88 && s < 15) return 'white';

    if (s < 30) {
        if (l < 35) return 'black';
        if (l >= 50 && (h < 15 || h >= 330)) return 'pink';
        if (l < 55) return 'brown';
        return 'white';
    }

    if (h < 15) return 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 165) return 'green';
    if (h < 190) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 250) return 'blue';
    if (h < 275) return 'indigo';
    if (h < 310) return 'purple';
    if (h < 346) return 'pink';
    return l > 50 && s < 60 ? 'pink' : 'red';
}


// =============================================================================
// METHOD 3 (CURRENT): CIEDE2000 perceptual distance
// =============================================================================
//
// Lives in lib/color-utils.ts. Uses CIE Lab color space and CIEDE2000
// perceptual distance to a set of reference colors per family.
//
// Pros: mathematically rigorous, no manual hue thresholds, handles
//       gradients naturally. Boundary issues fixed by adding more reference
//       colors rather than tweaking if/else chains.
// Cons: more compute (still microseconds per color).
