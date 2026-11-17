const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Output size and the baked-in distance look. Sigma is a fraction of HEIGHT.
const HEIGHT = 128;
const BLUR_RATIO = 0.04;
const SATURATION = 0.7;
const JPEG_QUALITY = 70;

// Keep in sync with EXCLUDED_PHOTOS in Clothing.js.
const EXCLUDED_PHOTOS = [4, 47, 50, 78, 110, 126, 208];
// 177 has neither small nor Large file.
const MISSING_PHOTOS = [177];

const root = path.join(__dirname, '..');
const smallDir = path.join(root, 'public', 'photos', 'Website digital', 'Photography', 'small');
const outDir = path.join(root, 'public', 'photos', 'Website digital', 'Photography', 'backdrop');
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
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const names = fs.readdirSync(smallDir).filter((name) => photoNumber(name) != null);
  const numbers = names
    .map(photoNumber)
    .filter((number) => !skip.has(number))
    .sort((a, b) => a - b);

  const settingsCurrent = settingsMatch(savedSettings());
  let wrote = 0;
  let reused = 0;
  const listed = [];

  for (const number of numbers) {
    const smallPath = path.join(smallDir, `small-photo-${number}.jpg`);
    const outPath = path.join(outDir, `backdrop-photo-${number}.jpg`);
    const smallTime = fs.statSync(smallPath).mtimeMs;
    const fresh = settingsCurrent
      && fs.existsSync(outPath)
      && fs.statSync(outPath).mtimeMs >= smallTime;
    if (!fresh) {
      const sigma = HEIGHT * BLUR_RATIO;
      await sharp(smallPath)
        .rotate()
        .resize({ height: HEIGHT })
        .modulate({ saturation: SATURATION })
        .blur(sigma)
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(outPath);
      wrote += 1;
    } else {
      reused += 1;
    }
    const aspect = aspectByNumber.get(number);
    if (!(aspect > 0)) {
      throw new Error(`No aspect in photo-manifest.json for photo ${number}`);
    }
    listed.push({ number, aspect });
  }

  fs.writeFileSync(jsonPath, `${JSON.stringify({
    height: HEIGHT,
    blurRatio: BLUR_RATIO,
    saturation: SATURATION,
    jpegQuality: JPEG_QUALITY,
    photos: listed,
  }, null, 2)}\n`);
  const bytes = listed.reduce((sum, entry) => {
    return sum + fs.statSync(path.join(outDir, `backdrop-photo-${entry.number}.jpg`)).size;
  }, 0);
  console.log(
    `backdrop photos: ${wrote} written, ${reused} reused, ${listed.length} listed, ${(bytes / 1024).toFixed(1)} KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
