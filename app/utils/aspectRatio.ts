export function getAspectRatioString(width: number, height: number): string {
    if (!width || !height) return '';

    const ratio = width / height;
    const standards = [
        { name: '1:1', value: 1.0 },
        { name: '16:9', value: 16 / 9 },
        { name: '9:16', value: 9 / 16 },
        { name: '4:3', value: 4 / 3 },
        { name: '3:4', value: 3 / 4 },
        { name: '21:9', value: 21 / 9 },
        { name: '9:21', value: 9 / 21 },
        { name: '3:2', value: 3 / 2 },
        { name: '2:3', value: 2 / 3 },
        { name: '5:4', value: 5 / 4 },
        { name: '4:5', value: 4 / 5 },
        { name: '2.35:1', value: 2.35 },
    ];

    // Find the closest standard ratio
    let closest = standards[0];
    let minDiff = Math.abs(ratio - standards[0].value);

    for (let i = 1; i < standards.length; i++) {
        const diff = Math.abs(ratio - standards[i].value);
        if (diff < minDiff) {
            minDiff = diff;
            closest = standards[i];
        }
    }

    // If it's within a 5% error margin, use the standard name
    // AI tools often generate slightly off dimensions (e.g., Midjourney 1456x816 instead of perfect 16:9)
    if (minDiff / closest.value <= 0.05) {
        return closest.name;
    }

    // Fallback: simple GCD (might look weird for Midjourney like 91:51)
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
}
