const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// The paper grain used to be a live SVG turbulence filter on every folder
// surface. Baked once here, it tiles as a plain PNG and stays still while the
// cover swings. The color matrix matches the old --file-grain filters.
const grain = (frequency, octaves, matrix) => `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" stitchTiles="stitch"/>
    <feColorMatrix values="${matrix}"/>
  </filter>
  <rect width="200" height="200" filter="url(#g)"/>
</svg>`;

const DARK = '0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 0.6 -0.2';
const LIGHT = '0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.35 -0.13';

async function main() {
  const out = path.join(__dirname, '..', 'src', 'assets');
  fs.mkdirSync(out, { recursive: true });
  const dark = path.join(out, 'file-grain.png');
  const light = path.join(out, 'file-grain-light.png');
  await sharp(Buffer.from(grain(0.8, 3, DARK))).png().toFile(dark);
  await sharp(Buffer.from(grain(0.9, 2, LIGHT))).png().toFile(light);
  const darkBytes = fs.statSync(dark).size;
  const lightBytes = fs.statSync(light).size;
  console.log(
    `file grain: ${darkBytes} B dark, ${lightBytes} B light`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
