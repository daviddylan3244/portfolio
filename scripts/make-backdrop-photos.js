const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Output size and the baked-in distance look. Sigma is a fraction of HEIGHT.
const HEIGHT = 128;
const BLUR_RATIO = 0.02;
const SATURATION = 0.7;
const JPEG_QUALITY = 70;
// Empty gutter so a scaled tile can sample past its rect without hitting a neighbor.
const GAP = 4;
const PAD = GAP / 2;
const MAX_EDGE = 4096;

// Keep in sync with EXCLUDED_PHOTOS in Clothing.js.
const EXCLUDED_PHOTOS = [4, 47, 50, 78, 110, 126, 208];
// 177 has neither small nor Large file.
const MISSING_PHOTOS = [177];

const root = path.join(__dirname, '..');
const smallDir = path.join(root, 'public', 'photos', 'Website digital', 'Photography', 'small');
const legacyDir = path.join(root, 'public', 'photos', 'Website digital', 'Photography', 'backdrop');
const spritePath = path.join(root, 'src', 'assets', 'backdrop-sprite.jpg');
const manifestPath = path.join(root, 'src', 'data', 'photo-manifest.json');
const jsonPath = path.join(root, 'src', 'data', 'backdrop-photos.json');

const skip = new Set([...EXCLUDED_PHOTOS, ...MISSING_PHOTOS]);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const aspectByNumber = new Map(manifest.map((entry) => [entry.number, entry.aspect]));

function photoNumber(name) {
  const match = name.match(/^small-photo-(\d+)\.jpg$/i);
  return match ? Number(match[1]) : null;
}

function savedSettings() {
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!saved || Array.isArray(saved)) return null;
    return saved;
  } catch (err) {
    return null;
  }
}

function settingsMatch(saved) {
  return Boolean(
    saved
    && saved.height === HEIGHT
    && saved.blurRatio === BLUR_RATIO
    && saved.saturation === SATURATION
    && saved.jpegQuality === JPEG_QUALITY
    && saved.gap === GAP
    && saved.maxEdge === MAX_EDGE
  );
}

function listNumbers() {
  return fs.readdirSync(smallDir)
    .map(photoNumber)
    .filter((number) => number != null && !skip.has(number))
    .sort((a, b) => a - b);
}

function isFresh(saved, numbers) {
  if (!settingsMatch(saved) || !fs.existsSync(spritePath)) return false;
  if (!saved.spriteWidth || !saved.spriteHeight || !Array.isArray(saved.photos)) return false;
  if (saved.photos.length !== numbers.length) return false;
  for (let i = 0; i < numbers.length; i += 1) {
    const photo = saved.photos[i];
    if (photo.number !== numbers[i] || !(photo.width > 0) || !(photo.height > 0)) return false;
  }
  const spriteTime = fs.statSync(spritePath).mtimeMs;
  return numbers.every((number) => {
    const smallPath = path.join(smallDir, `small-photo-${number}.jpg`);
    return fs.statSync(smallPath).mtimeMs <= spriteTime;
  });
}

function pack(photos) {
  const rows = [];
  let row = [];
  let rowWidth = 0;
  photos.forEach((photo) => {
    if (photo.width + PAD * 2 > MAX_EDGE) {
      throw new Error(`Photo ${photo.number} is wider than ${MAX_EDGE}px`);
    }
    const nextWidth = row.length === 0 ? photo.width : rowWidth + GAP + photo.width;
    if (row.length && nextWidth + PAD * 2 > MAX_EDGE) {
      rows.push(row);
      row = [photo];
      rowWidth = photo.width;
    } else {
      row.push(photo);
      rowWidth = nextWidth;
    }
  });
  if (row.length) rows.push(row);

  const sheetWidth = Math.max(...rows.map((items) => {
    const content = items.reduce((sum, photo, index) => {
      return sum + photo.width + (index ? GAP : 0);
    }, 0);
    return content + PAD * 2;
  }));
  const sheetHeight = rows.length * HEIGHT + Math.max(0, rows.length - 1) * GAP + PAD * 2;
  if (sheetWidth > MAX_EDGE || sheetHeight > MAX_EDGE) {
    throw new Error(`Sprite ${sheetWidth}x${sheetHeight} exceeds ${MAX_EDGE}px`);
  }

  const placed = [];
  rows.forEach((items, rowIndex) => {
    let x = PAD;
    const y = PAD + rowIndex * (HEIGHT + GAP);
    items.forEach((photo) => {
      placed.push({ ...photo, x, y });
      x += photo.width + GAP;
    });
  });
  return { placed, sheetWidth, sheetHeight };
}

function removeLegacyDir() {
  fs.rmSync(legacyDir, { recursive: true, force: true });
}

async function buildSprite(numbers) {
  const sigma = HEIGHT * BLUR_RATIO;
  const processed = [];
  for (const number of numbers) {
    const aspect = aspectByNumber.get(number);
    if (!(aspect > 0)) {
      throw new Error(`No aspect in photo-manifest.json for photo ${number}`);
    }
    const smallPath = path.join(smallDir, `small-photo-${number}.jpg`);
    const buffer = await sharp(smallPath)
      .rotate()
      .resize({ height: HEIGHT })
      .modulate({ saturation: SATURATION })
      .blur(sigma)
      .png()
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    const padded = await sharp(buffer)
      .extend({
        top: PAD,
        bottom: PAD,
        left: PAD,
        right: PAD,
        extendWith: 'copy',
      })
      .png()
      .toBuffer();
    processed.push({
      number,
      aspect,
      width: meta.width,
      height: meta.height,
      padded,
    });
  }

  const { placed, sheetWidth, sheetHeight } = pack(processed);
  fs.mkdirSync(path.dirname(spritePath), { recursive: true });
  const tempPath = `${spritePath}.tmp`;
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(placed.map((photo) => ({
      input: photo.padded,
      left: photo.x - PAD,
      top: photo.y - PAD,
    })))
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(tempPath);
  fs.renameSync(tempPath, spritePath);

  const photos = placed.map((photo) => ({
    number: photo.number,
    aspect: photo.aspect,
    x: photo.x,
    y: photo.y,
    width: photo.width,
    height: photo.height,
  }));
  fs.writeFileSync(jsonPath, `${JSON.stringify({
    height: HEIGHT,
    blurRatio: BLUR_RATIO,
    saturation: SATURATION,
    jpegQuality: JPEG_QUALITY,
    gap: GAP,
    maxEdge: MAX_EDGE,
    spriteWidth: sheetWidth,
    spriteHeight: sheetHeight,
    photos,
  }, null, 2)}\n`);
  return { count: photos.length, sheetWidth, sheetHeight };
}

async function main() {
  const numbers = listNumbers();
  const saved = savedSettings();
  let result;
  if (isFresh(saved, numbers)) {
    result = {
      count: saved.photos.length,
      sheetWidth: saved.spriteWidth,
      sheetHeight: saved.spriteHeight,
      reused: true,
    };
  } else {
    result = await buildSprite(numbers);
    result.reused = false;
  }
  removeLegacyDir();
  const bytes = fs.statSync(spritePath).size;
  console.log(
    `backdrop sprite: ${result.reused ? 'reused' : 'written'}, ${result.count} photos, `
    + `${result.sheetWidth}x${result.sheetHeight}, ${(bytes / 1024).toFixed(1)} KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
