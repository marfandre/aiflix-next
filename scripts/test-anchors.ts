import { hexToFamilyWeights, hexToFamily } from '../lib/color-utils';

const testHexes: [string, string][] = [
  ['#42535e', 'steel gray (was indigo)'],
  ['#4A5568', 'slate gray'],
  ['#2C3859', 'lighthouse dark blue'],
  ['#5B3F8C', 'true indigo'],
  ['#4B0082', 'classic indigo'],
  ['#2E1065', 'deep indigo'],
  ['#312E81', 'dark blue-indigo'],
  ['#242a2e', 'near-black'],
  ['#C29192', 'lighthouse mauve'],
  ['#8F6C7B', 'lighthouse mauve2'],
  ['#b73186', 'owl magenta (was pink)'],
  ['#c95ab5', 'monet magenta (was pink)'],
  ['#E875A0', 'true pink'],
  ['#FF69B4', 'hot pink'],
];

for (const [hex, name] of testHexes) {
  const top1 = hexToFamily(hex);
  const weights = hexToFamilyWeights(hex);
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`${hex} ${name} → top1=${top1}  ${sorted.map(([k, v]) => k + '=' + Math.round(v * 100) + '%').join(', ')}`);
}
