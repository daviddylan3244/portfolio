const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const textPath = path.join(root, 'design-text-final.txt');
const jsonPath = path.join(root, 'src', 'data', 'design-stacks.json');
const imageRoot = path.join(root, 'public', 'Product-design');
const SETTING_KEYS = ['cardShape', 'cardAspect', 'fit', 'frame'];

const jpegSof = new Set([
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
]);

function jpegSize(buf) {
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG');
    let offset = 2;
    while (offset + 3 < buf.length) {
        if (buf[offset] !== 0xFF) {
            offset += 1;
            continue;
        }
        const marker = buf[offset + 1];
        if (marker === 0xD8 || marker === 0xD9 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            offset += 2;
            continue;
        }
        const length = buf.readUInt16BE(offset + 2);
        if (jpegSof.has(marker)) {
            return {
                height: buf.readUInt16BE(offset + 5),
                width: buf.readUInt16BE(offset + 7),
            };
        }
        offset += 2 + length;
    }
    throw new Error('JPEG size not found');
}

function pngSize(buf) {
    const sig = '89504e470d0a1a0a';
    if (buf.slice(0, 8).toString('hex') !== sig) throw new Error('not a PNG');
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
    };
}

function imageSize(filePath) {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return pngSize(buf);
    if (ext === '.jpg' || ext === '.jpeg') return jpegSize(buf);
    throw new Error(`unsupported image type ${ext}`);
}

function parseText(raw) {
    const stacks = [];
    let current = null;
    raw.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Format:') || trimmed.startsWith('- ')) return;
        if (/^DESIGN WORK/i.test(trimmed) || /^daviddylan/i.test(trimmed)) return;
        if (trimmed.startsWith('STACK |')) {
            const title = trimmed.slice('STACK |'.length).trim();
            if (!title) throw new Error(`line ${index + 1}: stack title is empty`);
            current = { title, items: [] };
            stacks.push(current);
            return;
        }
        if (!current) return;
        if (!/^\d+\s*\|/.test(trimmed)) return;
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length < 5) {
            throw new Error(`line ${index + 1}: expected number | title | date | image | description`);
        }
        const files = parts[3]
            .split(/\s*\+\s*/)
            .map((file) => file.replace(/\\/g, '/').trim())
            .filter(Boolean);
        if (!files.length || files.some((file) => !file || file.includes('..'))) {
            throw new Error(`line ${index + 1}: bad image path ${parts[3]}`);
        }
        const description = parts.slice(4).join(' | ').replace(/\\n\\n/g, '\n\n');
        current.items.push({
            title: parts[1],
            date: parts[2],
            files,
            description,
        });
    });
    if (!stacks.length) throw new Error('no stacks found');
    return stacks;
}

function loadSettings() {
    const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const byTitle = new Map();
    existing.forEach((stack) => {
        const settings = {};
        SETTING_KEYS.forEach((key) => {
            if (stack[key] != null && stack[key] !== '') settings[key] = stack[key];
        });
        byTitle.set(stack.title, settings);
    });
    return byTitle;
}

function itemLine(item) {
    const fields = ['type', 'src', 'title', 'date', 'description', 'width', 'height'];
    if (item.images) fields.push('images');
    const body = fields
        .map((key) => `${JSON.stringify(key)}: ${JSON.stringify(item[key])}`)
        .join(', ');
    return `      { ${body} }`;
}

function stackBlock(stack) {
    const lines = ['  {'];
    lines.push(`    "title": ${JSON.stringify(stack.title)},`);
    SETTING_KEYS.forEach((key) => {
        if (stack[key] == null || stack[key] === '') return;
        lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(stack[key])},`);
    });
    lines.push('    "items": [');
    stack.items.forEach((item, index) => {
        const comma = index === stack.items.length - 1 ? '' : ',';
        lines.push(`${itemLine(item)}${comma}`);
    });
    lines.push('    ]');
    lines.push('  }');
    return lines.join('\n');
}

function main() {
    const parsed = parseText(fs.readFileSync(textPath, 'utf8'));
    const settings = loadSettings();
    const stacks = parsed.map((stack) => {
        const kept = settings.get(stack.title) || {};
        const items = stack.items.map((item) => {
            const measured = item.files.map((file) => {
                const filePath = path.join(imageRoot, ...file.split('/'));
                if (!fs.existsSync(filePath)) throw new Error(`missing image ${file}`);
                const size = imageSize(filePath);
                return {
                    src: `/Product-design/${file}`,
                    width: size.width,
                    height: size.height,
                };
            });
            const first = measured[0];
            const next = {
                type: 'image',
                src: first.src,
                title: item.title,
                date: item.date,
                description: item.description,
                width: first.width,
                height: first.height,
            };
            if (measured.length > 1) next.images = measured;
            return next;
        });
        return { title: stack.title, ...kept, items };
    });
    const output = `[\n${stacks.map(stackBlock).join(',\n')}\n]\n`;
    fs.writeFileSync(jsonPath, output);
    console.log(`Wrote ${stacks.length} stacks, ${stacks.reduce((sum, stack) => sum + stack.items.length, 0)} items`);
}

main();
