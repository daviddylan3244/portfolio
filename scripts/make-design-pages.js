const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LONG_EDGE = 900;
const JPEG_QUALITY = 82;

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const stacksPath = path.join(root, 'src', 'data', 'design-stacks.json');

// Keep in sync with pageSrc in GraffitiGallery.js.
const pageSrc = (src) => src
  .replace(/^\/Product-design\//, '/Product-design/pages/')
  .replace(/\.[^./]+$/, '.jpg');

const toDisk = (src) => path.join(publicDir, ...src.split('/').filter(Boolean));

function listSources() {
  const stacks = JSON.parse(fs.readFileSync(stacksPath, 'utf8'));
  const sources = new Set();
  stacks.forEach((stack) => {
    stack.items.forEach((item) => {
      const listed = Array.isArray(item.images) && item.images.length
        ? item.images.map((image) => image.src)
        : [item.src];
      listed.forEach((src) => {
        if (item.type !== 'image' || !src) return;
        if (!src.startsWith('/Product-design/')) {
          throw new Error(`Design image outside /Product-design/: ${src}`);
        }
        sources.add(src);
      });
    });
  });
  return [...sources];
}

function isFresh(input, output) {
  return fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(input).mtimeMs;
}

async function main() {
  const sources = listSources();
  let written = 0;
  let bytes = 0;
  for (const src of sources) {
    const input = toDisk(src);
    const output = toDisk(pageSrc(src));
    if (!isFresh(input, output)) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      await sharp(input)
        .rotate()
        .resize({
          width: LONG_EDGE,
          height: LONG_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(output);
      written += 1;
    }
    bytes += fs.statSync(output).size;
  }
  console.log(
    `design pages: ${written} written, ${sources.length - written} reused, `
    + `${(bytes / 1024).toFixed(1)} KB total`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
