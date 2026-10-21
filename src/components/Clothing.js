import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Clothing.css';
import photoManifest from '../data/photo-manifest.json';
import photoInfo from '../data/photo-info.json';
import { createTextReveal } from '../utils/textReveal';

const ASPECT_BY_NUMBER = new Map(
    photoManifest.map((entry) => [entry.number, entry.aspect])
);

// ---------------------------------------------------------------------------
// Gallery-wall experiment. true = enlarged photo sits to the right of a text
// panel. false = the previous version, a small title label under the photo.
// ---------------------------------------------------------------------------
const GALLERY_PANEL_ENABLED = true;
const GALLERY_PANEL_MIN_PX = 280;
const GALLERY_PANEL_MAX_PX = 360;
const GALLERY_PANEL_GAP_PX = 40;
// Narrower than this and there is no room for a panel beside the photo.
const GALLERY_SIDE_MIN_PX = 820;
// Below the photo the panel gets a block of its own and scrolls inside it.
const GALLERY_BELOW_GAP_PX = 12;
const GALLERY_BELOW_PX = 140;
// Opening is in two steps: grow to the centre, then slide across to the panel
// layout. The text sweeps in left to right once the slide lands.
const GALLERY_SLIDE_MS = 350;
const GALLERY_SWEEP_MS = 620;
const GALLERY_CHAR_MIN_MS = 160;
const GALLERY_CHAR_EXTRA_MS = 140;
const GALLERY_TEXT_OUT_MS = 150;
const GALLERY_DETAILS_PLACEHOLDER = 'Lorem ipsum · Dolor sit';
const GALLERY_TEXT_PLACEHOLDER =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod '
    + 'tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim '
    + 'veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea '
    + 'commodo. Duis aute irure dolor in reprehenderit in voluptate velit esse.';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
// Desktop at 1440px used (1440 + 120) / 14 px/s at a 120px row height.
const ROW_SPEED_HEIGHTS_PER_SECOND = (1440 + 120) / 14 / 120;
const ROW_BUFFER = 1;

// clamp(ITEM_HEIGHT_MIN_PX, ITEM_HEIGHT_VW * 1vw, ITEM_HEIGHT_MAX_PX)
const ITEM_HEIGHT_MIN_PX = 70;
const ITEM_HEIGHT_VW = 10;
const ITEM_HEIGHT_MAX_PX = 120;

const ITEM_GAP_PX = 40;

// First intro row starts as soon as its images are ready.
const INTRO_FIRST_DELAY_SECONDS = 0.0;
// Random wait between later row starts. Irregular, never two at once.
const INTRO_MIN_GAP_SECONDS = 0.8;
const INTRO_MAX_GAP_SECONDS = 2.5;
// The last intro row aims to start at this time.
const INTRO_TARGET_SECONDS = 10.0;
const INTRO_PLAY_ONCE_PER_VISIT = true;
const INTRO_STORAGE_KEY = 'clothing-intro-played';

// Used only if sessionStorage is unavailable.
let introPlayedThisVisit = false;

// One slow frame (close cleanup, decode, etc.) must not leap the rows.
const MAX_FRAME_SECONDS = 1 / 32;

// Future: each item's speed = baseSpeed * (1 ± this). 0.25 => about ±25%.
const SPEED_VARIATION = 0;

// Future: vertical sine-wave float. Amplitude in px, speed in radians/sec.
const SWAY_AMOUNT_PX = 0;
const SWAY_SPEED = 0;

// Future: slower items render smaller, more faded, and behind faster ones.
const DEPTH_EFFECT_ENABLED = false;

const REDUCED_MOTION_SPEED_SCALE = 0; // 0 = freeze; try 0.15 for a crawl
const MOBILE_BREAKPOINT_PX = 768;

// Extra copies of the library kept in the live pool so the row never has a hole.
const DESKTOP_POOL_BUFFER = 2;
const MOBILE_POOL_BUFFER = 0;
const MOBILE_ROW_BUFFER = 2;
const DECODE_CONCURRENCY = 4;
const LOOKAHEAD_SCREENS = 2;
const FAST_SCROLL_SCREENS = 4;
const FAST_SCROLL_PX_PER_SEC = 1400;
const DECODED_CACHE_LIMIT = 400;
const READY_POOL_MIN_DESKTOP = 72;
const READY_POOL_MIN_MOBILE = 32;
const HEIGHT_CHUNK_ROWS = 20;
const LARGE_HOVER_DELAY_MS = 100;
const LARGE_CROSSFADE_MS = 200;
const LARGE_CACHE_LIMIT = 8;

// Click-to-open viewer
const OPEN_TRANSITION_MS = 450;
const OPEN_EASE_POINTS = [0.22, 1, 0.36, 1];
const OPEN_EASING = `cubic-bezier(${OPEN_EASE_POINTS.join(', ')})`;
const CLOSE_EASE_POINTS = [0.22, 1, 0.36, 1];
const CLOSE_EASING = `cubic-bezier(${CLOSE_EASE_POINTS.join(', ')})`;
const REDUCED_MOTION_VIEWER_MS = 180;
const VIEWER_GAP_PX = 32;
const VIEWER_BORDER_MIN_PX = 12;
const VIEWER_BORDER_MAX_PX = 48;
const CLOSE_BUTTON_GAP_PX = 10;
const CLOSE_BUTTON_PX = 44;
// Wall label under the enlarged photo: gap below the frame, plus the room the
// layout keeps free for one line of it at its largest size.
const CAPTION_GAP_PX = 10;
const CAPTION_MIN_FONT_PX = 13;
const CAPTION_MAX_FONT_PX = 16;
const CAPTION_RESERVE_PX = CAPTION_GAP_PX + Math.ceil(CAPTION_MAX_FONT_PX * 1.3);
// ---------------------------------------------------------------------------
// Item library — web-sized photos. src = rows, srcFull = enlarged view.
// Raise PHOTO_COUNT when a new batch is added. Files are photo-1 through photo-N.
// ---------------------------------------------------------------------------
const PHOTO_COUNT = 194;
const PHOTO_DIR = '/photos/Website digital/Photography';
// 4, 47, 50 and 78 are held out on purpose.
// 116's Large long edge is 1746px, not ~2000.
const EXCLUDED_PHOTOS = [4, 47, 50, 78, 116];
// Skip numbers that are missing from small or Large (177 has neither file).
const MISSING_PHOTOS = [177];

const STREAM_LIBRARY = Array.from({ length: PHOTO_COUNT }, (_, index) => index + 1)
    .filter((number) => !EXCLUDED_PHOTOS.includes(number) && !MISSING_PHOTOS.includes(number))
    .map((number) => ({
        number,
        id: `photo-${number}`,
        src: `${PHOTO_DIR}/small/small-photo-${number}.jpg`,
        srcFull: `${PHOTO_DIR}/Large/Large-photo-${number}.jpg`,
    }));

// Wall label text, keyed by photo number. Returns null when there is no title.
const LABEL_EDGE_PAD_PX = 8;
const LABEL_GAP_PX = 6;
const LABEL_BREATH_PX = 4;
const HEADER_TO_ROW_GAP_PX = 18;

function photoLabelFor(spec) {
    const info = spec && spec.number != null ? photoInfo[spec.number] : null;
    return info && info.title ? info : null;
}

function photoNumberInPath(src) {
    const match = String(src || '').match(/photo-(\d+)\.jpg$/i);
    return match ? Number(match[1]) : null;
}

if (process.env.NODE_ENV !== 'production') {
    STREAM_LIBRARY.forEach((item) => {
        const smallNumber = photoNumberInPath(item.src);
        const largeNumber = photoNumberInPath(item.srcFull);
        if (item.number == null || smallNumber !== item.number || largeNumber !== item.number) {
            console.error(
                `Photo pairing error: number ${item.number}, small ${item.src}, large ${item.srcFull}`
            );
        }
    });
}

function clampItemHeight(viewportWidth) {
    if (viewportWidth <= MOBILE_BREAKPOINT_PX) {
        const preferred = viewportWidth * 0.26;
        return Math.min(ITEM_HEIGHT_MAX_PX, Math.max(96, preferred));
    }
    const preferred = (ITEM_HEIGHT_VW / 100) * viewportWidth;
    return Math.min(ITEM_HEIGHT_MAX_PX, Math.max(ITEM_HEIGHT_MIN_PX, preferred));
}

function introGaps(count, sum) {
    if (count <= 0) return [];
    const min = INTRO_MIN_GAP_SECONDS;
    const max = INTRO_MAX_GAP_SECONDS;
    const minSum = min * count;
    const maxSum = max * count;
    const target = Math.max(minSum, sum);
    const ceiling = target > maxSum ? Math.max(max, (target / count) * 1.75) : max;
    const weights = Array.from({ length: count }, () => 0.2 + Math.random());
    const weightSum = weights.reduce((total, weight) => total + weight, 0);
    let gaps = weights.map((weight) => min + (target - minSum) * (weight / weightSum));

    for (let pass = 0; pass < 8; pass += 1) {
        let overflow = 0;
        gaps = gaps.map((gap) => {
            if (gap > ceiling) {
                overflow += gap - ceiling;
                return ceiling;
            }
            if (gap < min) {
                overflow -= min - gap;
                return min;
            }
            return gap;
        });
        if (Math.abs(overflow) < 0.001) break;
        const room = gaps.reduce((total, gap) => {
            return total + (overflow > 0 ? ceiling - gap : gap - min);
        }, 0);
        if (room <= 0.001) break;
        gaps = gaps.map((gap) => {
            const space = overflow > 0 ? ceiling - gap : gap - min;
            return gap + overflow * (space / room);
        });
    }

    for (let index = 1; index < gaps.length; index += 1) {
        if (Math.abs(gaps[index] - gaps[index - 1]) >= 0.02) continue;
        const nudge = 0.02 + Math.random() * 0.08;
        if (gaps[index] + nudge <= ceiling) gaps[index] += nudge;
        else if (gaps[index] - nudge >= min) gaps[index] -= nudge;
    }
    return gaps;
}

function introStartTimes(rowIndexes) {
    const count = rowIndexes.length;
    if (!count) return [];
    const order = shuffle(rowIndexes);
    const span = Math.max(0, INTRO_TARGET_SECONDS - INTRO_FIRST_DELAY_SECONDS);
    const gaps = introGaps(count - 1, span);
    let time = INTRO_FIRST_DELAY_SECONDS;
    return order.map((index, orderIndex) => {
        const at = time;
        if (orderIndex < gaps.length) time += gaps[orderIndex];
        return { index, at };
    });
}

function hash01(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function viewerBorderPx() {
    return Math.round(
        Math.min(
            VIEWER_BORDER_MAX_PX,
            Math.max(VIEWER_BORDER_MIN_PX, window.innerWidth * 0.025)
        )
    );
}

function hoverOutlineEstimatePx() {
    return Math.max(6, Math.round(viewerBorderPx() * 0.3));
}

function labelClearancePx(height) {
    const fontPx = Math.max(11, Math.min(13, height * 0.12));
    const labelH = Math.ceil(fontPx * 1.2);
    return labelH + LABEL_GAP_PX + hoverOutlineEstimatePx() + LABEL_BREATH_PX;
}

function easeBezier(points, amount) {
    const [x1, y1, x2, y2] = points;
    const x = Math.max(0, Math.min(1, amount));
    if (x === 0 || x === 1) return x;
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
        const dx = sampleX(t) - x;
        const slope = sampleDX(t);
        if (Math.abs(dx) < 1e-5) break;
        if (Math.abs(slope) < 1e-6) break;
        t -= dx / slope;
    }
    return sampleY(Math.max(0, Math.min(1, t)));
}

function easeOpen(amount) {
    return easeBezier(OPEN_EASE_POINTS, amount);
}

function easeClose(amount) {
    return easeBezier(CLOSE_EASE_POINTS, amount);
}

function frameOpacityFor(phase, amount) {
    if (phase === 'opening' || phase === 'switching') return amount;
    if (phase === 'open') return 1;
    if (phase === 'closing') {
        if (amount < 0.55) return 1;
        return Math.max(0, 1 - (amount - 0.55) / 0.45);
    }
    return 0;
}

function easeInOut(amount) {
    const x = Math.max(0, Math.min(1, amount));
    return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

function lerpPose(from, to, amount) {
    return {
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount,
        scale: from.scale + (to.scale - from.scale) * amount,
    };
}

// Invert lerpPose so a mid-flight retarget (tile recycled → exit right)
// keeps the current pose at this amount and still lands on `to` at 1.
function startPoseFor(current, to, amount) {
    if (amount <= 0) return { ...current };
    if (amount >= 1) return { ...to };
    const inv = 1 - amount;
    return {
        x: (current.x - to.x * amount) / inv,
        y: (current.y - to.y * amount) / inv,
        scale: (current.scale - to.scale * amount) / inv,
    };
}

function urlsMatch(shown, src) {
    if (!shown || !src) return false;
    let shownPath = shown;
    let specPath = src;
    try {
        shownPath = decodeURI(shown).split('?')[0];
        specPath = decodeURI(src).split('?')[0];
    } catch (err) {
        shownPath = String(shown).split('?')[0];
        specPath = String(src).split('?')[0];
    }
    return shownPath === specPath || shownPath.endsWith(specPath);
}

function fitInBox(aspectRatio, maxWidth, maxHeight) {
    const ratio = aspectRatio || 1;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
    }
    return { width, height };
}

function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const swap = copy[i];
        copy[i] = copy[j];
        copy[j] = swap;
    }
    return copy;
}

function hasPlayedIntro() {
    if (!INTRO_PLAY_ONCE_PER_VISIT) return false;
    try {
        return sessionStorage.getItem(INTRO_STORAGE_KEY) === '1';
    } catch (err) {
        return introPlayedThisVisit;
    }
}

function markIntroPlayed() {
    introPlayedThisVisit = true;
    if (!INTRO_PLAY_ONCE_PER_VISIT) return;
    try {
        sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    } catch (err) {
        // Private browsing can block sessionStorage. The memory flag still covers this tab.
    }
}

function readJpegMeta(buffer) {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
        return { width: 0, height: 0, orientation: 1 };
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let i = 2;
    let width = 0;
    let height = 0;
    let orientation = 1;
    while (i < data.length - 8) {
        if (data[i] !== 0xff) {
            i += 1;
            continue;
        }
        const marker = data[i + 1];
        if (marker === 0xda) break;
        if (marker === 0xd8 || marker === 0xd9) {
            i += 2;
            continue;
        }
        const seglen = view.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3 && seglen >= 7) {
            height = view.getUint16(i + 5);
            width = view.getUint16(i + 7);
        }
        if (marker === 0xe1 && seglen > 14) {
            const isExif =
                data[i + 4] === 0x45 &&
                data[i + 5] === 0x78 &&
                data[i + 6] === 0x69 &&
                data[i + 7] === 0x66;
            if (isExif) {
                const tiffStart = i + 10;
                const little = data[tiffStart] === 0x49;
                const ru16 = (offset) => view.getUint16(offset, little);
                const ru32 = (offset) => view.getUint32(offset, little);
                const if0 = tiffStart + ru32(tiffStart + 4);
                if (if0 + 2 < data.length) {
                    const count = ru16(if0);
                    for (let k = 0; k < count; k += 1) {
                        const off = if0 + 2 + k * 12;
                        if (off + 12 > data.length) break;
                        if (ru16(off) === 0x0112) orientation = ru16(off + 8);
                    }
                }
            }
        }
        i += 2 + seglen;
    }
    return { width, height, orientation };
}

function orientedJpegSize(meta) {
    const swap = meta.orientation >= 5 && meta.orientation <= 8;
    return swap
        ? { width: meta.height, height: meta.width }
        : { width: meta.width, height: meta.height };
}

function throwIfAborted(signal) {
    if (!signal?.aborted) return;
    throw new DOMException('Aborted', 'AbortError');
}

function imgFromBlob(blob, options = {}) {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    if (options.fetchPriority) img.fetchPriority = options.fetchPriority;
    const objectUrl = URL.createObjectURL(blob);
    img.src = objectUrl;
    const decoded =
        typeof img.decode === 'function'
            ? img.decode().catch(() => {})
            : new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
              });
    return decoded.then(() => ({ img, objectUrl }));
}

async function bakeOrientedBlob(blob, meta) {
    if (!meta || meta.orientation <= 1 || typeof createImageBitmap !== 'function') {
        return blob;
    }
    try {
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        const storedMatches =
            bitmap.width === meta.width && bitmap.height === meta.height;
        if (storedMatches) {
            bitmap.close();
            return blob;
        }
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        bitmap.close();
        const baked = await new Promise((resolve) => {
            canvas.toBlob((next) => resolve(next || blob), 'image/jpeg', 0.95);
        });
        return baked;
    } catch (err) {
        return blob;
    }
}

async function loadDecodedImage(src, options = {}) {
    if (!src) {
        return { img: null, objectUrl: '', aspectRatio: 1, src };
    }
    const { priority, signal } = options;
    throwIfAborted(signal);
    const fetchOptions = {};
    if (priority) fetchOptions.priority = priority;
    if (signal) fetchOptions.signal = signal;
    const response = await fetch(encodeURI(src), fetchOptions);
    throwIfAborted(signal);
    const buffer = await response.arrayBuffer();
    throwIfAborted(signal);
    const meta = readJpegMeta(buffer);
    const oriented = orientedJpegSize(meta);
    const original = new Blob([buffer], { type: 'image/jpeg' });
    const blob = await bakeOrientedBlob(original, meta);
    throwIfAborted(signal);
    const loaded = await imgFromBlob(blob, { fetchPriority: priority });
    if (signal?.aborted) {
        if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        throwIfAborted(signal);
    }
    const width = loaded.img.naturalWidth || oriented.width || 1;
    const height = loaded.img.naturalHeight || oriented.height || 1;
    let aspectRatio = width / height;
    if (
        blob === original &&
        meta.orientation >= 5 &&
        meta.orientation <= 8 &&
        oriented.width &&
        oriented.height
    ) {
        aspectRatio = oriented.width / oriented.height;
        loaded.img.style.imageOrientation = 'from-image';
    }
    return { ...loaded, aspectRatio, src };
}

async function mapWithConcurrency(items, concurrency, fn) {
    let cursor = 0;
    const results = new Array(items.length);
    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await fn(items[index]);
        }
    };
    const workers = [];
    const count = Math.max(1, Math.min(concurrency, items.length));
    for (let i = 0; i < count; i += 1) workers.push(worker());
    await Promise.all(workers);
    return results;
}

function Clothing() {
    const navigate = useNavigate();
    const sectionRef = useRef(null);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return undefined;
        section.replaceChildren();
        const rows = [];

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const transitionMs = reducedMotion ? REDUCED_MOTION_VIEWER_MS : OPEN_TRANSITION_MS;
        section.style.setProperty('--stream-open-ms', `${transitionMs}ms`);
        section.style.setProperty('--stream-open-ease', OPEN_EASING);
        section.style.setProperty('--stream-close-ease', CLOSE_EASING);

        const pool = [];
        const decodePromises = new Map();
        const decodedSpecs = new Map();
        const decodedOrder = [];
        const introTimers = [];
        const introEntering = new Set();
        const startedRows = new Set();
        const rowPending = new Set();
        const rowEpoch = [];
        const rowAssignments = new Map();
        const libraryByKey = new Map(
            STREAM_LIBRARY.map((item) => [item.src || item.id, item])
        );
        let bag = [];
        const shownKeys = [];
        const reserved = new Set();
        const photoStats =
            process.env.NODE_ENV !== 'production'
                ? { unique: 0, fallback: 0, seen: new Set(), firstRepeatAt: null, duplicates: 0 }
                : null;

        const noteDeal = (key, fallback) => {
            if (!photoStats || !key) return;
            if (fallback) photoStats.fallback += 1;
            else photoStats.unique += 1;
            const total = photoStats.unique + photoStats.fallback;
            if (total === 1 || total % 25 === 0) {
                console.info(
                    '[photos] deals unique:',
                    photoStats.unique,
                    'fallback:',
                    photoStats.fallback,
                    'ready:',
                    readyPoolCount(),
                    'bag:',
                    bag.length
                );
            }
        };

        const noteShown = (spec) => {
            if (!photoStats) return;
            const key = photoKey(spec);
            if (!key || photoStats.firstRepeatAt != null) return;
            if (photoStats.seen.has(key)) {
                photoStats.firstRepeatAt = photoStats.seen.size;
                console.info('[photos] unique before first repeat:', photoStats.firstRepeatAt);
            } else {
                photoStats.seen.add(key);
            }
        };
        if (photoStats) window.__photoStats = photoStats;
        const spareRows = [];
        let allocatedRows = 0;
        let smallsInFlight = 0;
        let lastScrollY = 0;
        let lastScrollT = 0;
        let scrollSpeed = 0;
        let rafId = 0;
        let running = false;
        let inView = true;
        let lastTime = 0;
        let viewportWidth = 0;
        let itemHeight = 0;
        let rowGapPx = 0;
        let pageRowCount = 0;
        let restFirstTop = 0;
        let baseSpeed = 0;
        let cancelled = false;

        const overlay = document.createElement('div');
        overlay.className = 'stream-overlay';
        overlay.hidden = true;

        const headerEl = () =>
            section.parentElement
                ? section.parentElement.querySelector('.header-container')
                : null;

        const clipOverlayToHeader = () => {
            const header = headerEl();
            const top = header ? Math.ceil(header.getBoundingClientRect().bottom) : 0;
            overlay.style.top = `${Math.max(0, top)}px`;
        };

        const resetOverlayClip = () => {
            overlay.style.top = '';
        };

        const makeFlyer = () => {
            const root = document.createElement('div');
            root.className = 'stream-flyer';
            root.setAttribute('role', 'img');
            root.hidden = true;

            const body = document.createElement('div');
            body.className = 'stream-flyer-body';

            const frame = document.createElement('div');
            frame.className = 'stream-flyer-frame';

            const small = document.createElement('img');
            small.alt = '';
            small.draggable = false;
            small.className = 'stream-flyer-small';

            const large = document.createElement('img');
            large.alt = '';
            large.draggable = false;
            large.className = 'stream-flyer-large';
            body.append(frame, small, large);
            root.append(body);
            document.body.append(root);
            return { root, body, frame, small, large };
        };

        const flyers = [];
        const trackFlyer = (node) => {
            flyers.push(node);
            return node;
        };
        const homeFlyer = trackFlyer(makeFlyer());
        let activeFlyer = homeFlyer;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'stream-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.hidden = true;

        // Sits outside the flyer so it does not scale with the opening photo.
        // pointer-events stay off, so taps on it reach the overlay underneath.
        const caption = document.createElement('div');
        caption.className = 'stream-caption';
        caption.hidden = true;
        caption.style.opacity = '0';
        const captionTitle = document.createElement('i');
        captionTitle.className = 'stream-caption-title';
        const captionYear = document.createElement('span');
        captionYear.className = 'stream-caption-year';
        caption.append(captionTitle, captionYear);

        // Gallery-wall text panel. Unlike the caption it takes pointer events,
        // so text in it can be selected.
        const panel = document.createElement('div');
        panel.className = 'stream-panel';
        panel.hidden = true;
        panel.style.opacity = '0';
        panel.style.setProperty('--panel-out-ms', `${GALLERY_TEXT_OUT_MS}ms`);
        const panelInner = document.createElement('div');
        panelInner.className = 'stream-panel-inner';
        const panelTitle = document.createElement('i');
        panelTitle.className = 'stream-panel-title';
        const panelYear = document.createElement('div');
        panelYear.className = 'stream-panel-year';
        const panelDetails = document.createElement('div');
        panelDetails.className = 'stream-panel-details';
        const panelRule = document.createElement('div');
        panelRule.className = 'stream-panel-rule';
        const panelText = document.createElement('p');
        panelText.className = 'stream-panel-text';
        panelInner.append(panelTitle, panelYear, panelDetails, panelRule, panelText);
        panel.append(panelInner);

        document.body.append(overlay, closeBtn, caption);
        if (GALLERY_PANEL_ENABLED) document.body.append(panel);

        const menuEl = section.parentElement
            ? section.parentElement.querySelector('.header-nav')
            : null;
        const rowPose = [];
        const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        let pointerX = 0;
        let pointerY = 0;
        let pointerInside = false;
        let hoverSlot = null;
        const largeDecoded = new Map();
        const largeDecodedOrder = [];
        const largeInflight = new Map();
        let viewer = null;

        const opacityForSlot = (slot) => {
            if (!viewer) return null;
            if (slot === viewer.slot && !viewer.tileGone) return viewer.thumbOpacity;
            const departing = viewer.departures.find((item) => item.slot === slot);
            return departing && !departing.tileGone ? departing.thumbOpacity : null;
        };

        let scrollLockY = null;
        let scrollLockPad = '';
        let suppressScroll = false;
        let postCloseFrame = 0;
        let quietRows = new Set();
        let quietRowsUntil = 0;
        let layoutHeld = false;
        let layoutHeldUntil = 0;
        let positionWriter = 'tick';
        let rowSyncUntil = 0;
        let rowSyncLast = new Map();
        const ROW_SYNC_PROBE = process.env.NODE_ENV !== 'production';
        const layoutWritesQuiet = () => layoutHeld || performance.now() < layoutHeldUntil;
        const holdLayoutWrites = () => {
            layoutHeld = true;
        };
        const releaseLayoutWrites = (holdMs = 1600) => {
            layoutHeld = false;
            layoutHeldUntil = performance.now() + holdMs;
        };
        const runAsWriter = (name, fn) => {
            const prev = positionWriter;
            positionWriter = name;
            try {
                return fn();
            } finally {
                positionWriter = prev;
            }
        };
        let deferredFlyers = [];
        let closeProbe = null;
        const CLOSE_PROBE = process.env.NODE_ENV !== 'production';
        const rowLayoutQuiet = (rowIndex) => {
            if (rowIndex == null || rowIndex < 0) return false;
            if (viewer) {
                if (viewer.homeRow === rowIndex) return true;
                if (viewer.departures?.some((dep) => dep.homeRow === rowIndex)) return true;
            }
            return quietRows.has(rowIndex) && performance.now() < quietRowsUntil;
        };
        const pageStartedAt = performance.now();

        let streamOriginX = 0;
        let streamOriginY = 0;
        let viewOriginX = 0;
        let viewOriginY = 0;
        const cacheStreamOrigin = () => {
            const rect = section.getBoundingClientRect();
            viewOriginX = rect.left;
            viewOriginY = rect.top;
            streamOriginX = rect.left + (window.scrollX || window.pageXOffset || 0);
            streamOriginY = rect.top + pageScroll();
        };
        const applyHeaderRowGap = () => {
            const header = headerEl();
            if (!header) {
                section.style.marginTop = '';
                return;
            }
            const headerBox = header.getBoundingClientRect();
            let chromeBottom = headerBox.top;
            const logo = header.querySelector('.header-logo');
            if (logo) {
                chromeBottom = Math.max(chromeBottom, logo.getBoundingClientRect().bottom);
            }
            if (menuEl) {
                chromeBottom = Math.max(chromeBottom, menuEl.getBoundingClientRect().bottom);
            }
            const margin = Math.round(chromeBottom + HEADER_TO_ROW_GAP_PX - headerBox.bottom);
            section.style.marginTop = margin ? `${margin}px` : '';
        };

        const fitRowsToViewport = (firstTop) => {
            const minGap = labelClearancePx(itemHeight);
            const available = viewHeight() - firstTop - minGap;
            if (!(itemHeight > 0) || available < itemHeight) {
                return { gap: minGap, count: 1 };
            }
            const n = Math.max(
                1,
                Math.floor((available + minGap) / (itemHeight + minGap))
            );
            if (n <= 1) return { gap: minGap, count: 1 };
            let gap = Math.round((available - n * itemHeight) / (n - 1));
            gap = Math.max(minGap, gap);
            const used = n * itemHeight + (n - 1) * gap;
            if (used > available && gap > minGap) gap -= 1;
            return { gap, count: n };
        };

        const applyLayoutMetrics = () => {
            viewportWidth = section.clientWidth || window.innerWidth;
            itemHeight = clampItemHeight(window.innerWidth);
            applyHeaderRowGap();
            cacheStreamOrigin();
            restFirstTop = Math.max(0, Math.round(streamOriginY));
            const fitted = fitRowsToViewport(restFirstTop);
            rowGapPx = fitted.gap;
            pageRowCount = fitted.count;
            baseSpeed = itemHeight * ROW_SPEED_HEIGHTS_PER_SECOND;
            section.style.setProperty('--stream-item-height', `${itemHeight}px`);
            section.style.setProperty('--stream-row-gap', `${rowGapPx}px`);
        };

        const stridePx = () => itemHeight + rowGapPx;
        const pageScroll = () =>
            scrollLockY == null ? window.scrollY || window.pageYOffset || 0 : scrollLockY;
        const viewHeight = () => {
            const viewport = window.visualViewport;
            if (viewport && viewport.height) return viewport.height;
            return window.innerHeight;
        };

        const visibleBounds = () => {
            // Viewport coordinates of row 0 — not document Y + scroll. Mixing
            // those after body scroll-lock was mounting the top-of-page rows
            // while the user was looking further down.
            cacheStreamOrigin();
            const origin = viewOriginY;
            const viewTop = 0;
            const viewBottom = viewHeight();
            const stride = stridePx();
            if (!(stride > 0)) return { first: 0, last: 0 };
            const extent = itemHeight + labelClearancePx(itemHeight);
            let first = null;
            let last = null;
            const start = Math.max(0, Math.floor((viewTop - origin) / stride) - 1);
            for (let index = start; index < start + 60; index += 1) {
                const rowTop = origin + index * stride;
                if (rowTop >= viewBottom) break;
                if (rowTop + extent > viewTop) {
                    if (first == null) first = index;
                    last = index;
                }
            }
            if (first == null) {
                const index = Math.max(0, Math.floor((viewTop - origin) / stride));
                return { first: index, last: index };
            }
            return { first, last };
        };

        const pageIsZoomed = () => {
            const viewport = window.visualViewport;
            return !!(viewport && Math.abs(viewport.scale - 1) > 0.01);
        };

        const blockTouchScroll = (event) => {
            event.preventDefault();
        };

        const lockScroll = () => {
            if (scrollLockY != null) return;
            // Measure before hiding overflow: once the scrollbar is gone the
            // layout viewport gets wider and a centered header would jump.
            const gutter = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
            scrollLockY = window.scrollY || window.pageYOffset || 0;
            scrollLockPad = document.body.style.paddingRight;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollLockY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.body.style.paddingRight = `${gutter}px`;
            document.documentElement.style.overflow = 'hidden';
            document.addEventListener('touchmove', blockTouchScroll, { passive: false });
            cacheStreamOrigin();
            holdLayoutWrites();
        };

        const unlockScroll = () => {
            document.removeEventListener('touchmove', blockTouchScroll);
            if (scrollLockY == null) return;
            const y = scrollLockY;
            suppressScroll = true;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            document.body.style.paddingRight = scrollLockPad;
            scrollLockPad = '';
            document.documentElement.style.overflow = '';
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
            window.scrollTo(0, y);
            scrollLockY = null;
            cacheStreamOrigin();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        suppressScroll = false;
                    });
                });
            });
        };

        const avgAspect = () => {
            let sum = 0;
            let count = 0;
            decodedSpecs.forEach((spec) => {
                if (spec && spec.aspectRatio) {
                    sum += spec.aspectRatio;
                    count += 1;
                }
            });
            return count ? sum / count : 1.4;
        };

        const computePerRow = () => {
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
            const buffer = isMobile ? MOBILE_POOL_BUFFER : DESKTOP_POOL_BUFFER;
            const typicalStride = itemHeight * avgAspect() + ITEM_GAP_PX;
            return Math.max(
                3,
                Math.ceil((viewportWidth + itemHeight * 2) / typicalStride) + buffer
            );
        };

        const photoKey = (item) => (item && (item.src || item.id)) || '';

        const touchDecoded = (key) => {
            const index = decodedOrder.indexOf(key);
            if (index >= 0) decodedOrder.splice(index, 1);
            decodedOrder.push(key);
        };

        const readyPoolMin = () =>
            window.innerWidth <= MOBILE_BREAKPOINT_PX ? READY_POOL_MIN_MOBILE : READY_POOL_MIN_DESKTOP;

        const trimDecodedCache = () => {
            const live = occupiedKeys();
            const floor = live.size + readyPoolMin();
            const limit = Math.max(DECODED_CACHE_LIMIT, floor);
            while (decodedSpecs.size > limit) {
                const victim = decodedOrder.find((key) => {
                    if (live.has(key)) return false;
                    const spec = decodedSpecs.get(key);
                    if (spec?.img && spec.img.parentNode) return false;
                    return true;
                });
                if (!victim) break;
                const spec = decodedSpecs.get(victim);
                if (spec?.objectUrl) URL.revokeObjectURL(spec.objectUrl);
                decodedSpecs.delete(victim);
                const orderIndex = decodedOrder.indexOf(victim);
                if (orderIndex >= 0) decodedOrder.splice(orderIndex, 1);
            }
        };

        const decodeSmall = (item) => {
            if (!item) return Promise.resolve(null);
            const key = photoKey(item);
            if (!key) return Promise.resolve(null);
            if (decodedSpecs.has(key)) {
                touchDecoded(key);
                return Promise.resolve(decodedSpecs.get(key));
            }
            if (!decodePromises.has(key)) {
                smallsInFlight += 1;
                decodePromises.set(
                    key,
                    loadDecodedImage(item.src, { priority: 'high' })
                        .then((loaded) => {
                            const spec = {
                                ...item,
                                aspectRatio: loaded.aspectRatio || 1,
                                img: loaded.img,
                                objectUrl: loaded.objectUrl,
                            };
                            decodedSpecs.set(key, spec);
                            touchDecoded(key);
                            trimDecodedCache();
                            return spec;
                        })
                        .catch(() => {
                            const spec = { ...item, aspectRatio: item.aspectRatio || 1, img: null };
                            decodedSpecs.set(key, spec);
                            return spec;
                        })
                        .finally(() => {
                            smallsInFlight = Math.max(0, smallsInFlight - 1);
                        })
                );
            }
            return decodePromises.get(key);
        };

        const photosPerRow = () => computePerRow();

        const tileKeys = (exceptSlot) => {
            const keys = new Set();
            pool.forEach((slot) => {
                if (slot === exceptSlot || !slot.spec) return;
                keys.add(photoKey(slot.spec));
            });
            if (viewer?.shownKey) keys.add(viewer.shownKey);
            if (viewer?.departures) {
                viewer.departures.forEach((dep) => {
                    if (dep.shownKey) keys.add(dep.shownKey);
                });
            }
            return keys;
        };

        const occupiedKeys = (exceptSlot) => {
            const keys = tileKeys(exceptSlot);
            reserved.forEach((key) => keys.add(key));
            return keys;
        };

        const refillBag = () => {
            const occupied = occupiedKeys();
            const recent = [];
            const seen = new Set();
            for (let i = shownKeys.length - 1; i >= 0 && recent.length < STREAM_LIBRARY.length; i -= 1) {
                const key = shownKeys[i];
                if (!key || seen.has(key) || occupied.has(key)) continue;
                seen.add(key);
                recent.push(key);
            }
            recent.reverse();
            const recentSet = new Set(recent);
            const rest = STREAM_LIBRARY.filter((item) => {
                const key = photoKey(item);
                return key && !occupied.has(key) && !recentSet.has(key);
            });
            const lateCount = Math.min(
                recent.length,
                Math.max(8, Math.ceil(STREAM_LIBRARY.length * 0.25))
            );
            const late = recent.slice(-lateCount).map((key) => libraryByKey.get(key)).filter(Boolean);
            const earlier = recent.slice(0, recent.length - lateCount).map((key) => libraryByKey.get(key)).filter(Boolean);
            bag = [...shuffle([...rest, ...earlier]), ...late];
        };

        const dealRaw = (exceptSlot) => {
            const occupied = occupiedKeys(exceptSlot);
            if (exceptSlot?.spec) occupied.add(photoKey(exceptSlot.spec));
            for (let pass = 0; pass < 2; pass += 1) {
                if (!bag.length) refillBag();
                while (bag.length) {
                    const item = bag.shift();
                    const key = photoKey(item);
                    if (!key || occupied.has(key)) continue;
                    reserved.add(key);
                    return item;
                }
            }
            return null;
        };

        const imgOwnedByOtherSlot = (img, exceptSlot) => {
            if (!img || !img.parentNode) return false;
            for (let i = 0; i < pool.length; i += 1) {
                const other = pool[i];
                if (other === exceptSlot) continue;
                if (other.el === img.parentNode) return true;
            }
            return false;
        };

        const specIsReady = (spec, exceptSlot) =>
            !!(spec?.img && spec.img.naturalWidth && !imgOwnedByOtherSlot(spec.img, exceptSlot));

        const slotHasLoadedPhoto = (slot) => {
            if (!slot?.spec?.img || !slot.spec.img.naturalWidth) return false;
            return slot.spec.img.parentNode === slot.el;
        };

        const aspectFor = (item) => {
            const key = photoKey(item);
            const decoded = key ? decodedSpecs.get(key) : null;
            if (decoded?.aspectRatio) return decoded.aspectRatio;
            if (item?.number != null && ASPECT_BY_NUMBER.has(item.number)) {
                return ASPECT_BY_NUMBER.get(item.number);
            }
            return avgAspect();
        };

        const specForAssign = (item, exceptSlot) => {
            const key = photoKey(item);
            if (!key) return null;
            if (tileKeys(exceptSlot).has(key)) return null;
            const decoded = decodedSpecs.get(key);
            if (decoded?.img && imgOwnedByOtherSlot(decoded.img, exceptSlot)) return null;
            if (decoded?.img) return decoded;
            return {
                ...item,
                aspectRatio: decoded?.aspectRatio || aspectFor(item),
                img: null,
            };
        };

        const dealUniqueSpec = (exceptSlot) => {
            for (let n = 0; n < STREAM_LIBRARY.length; n += 1) {
                const raw = dealRaw(exceptSlot);
                if (!raw) return null;
                const spec = specForAssign(raw, exceptSlot);
                if (spec) return spec;
                releaseReserved(raw);
            }
            return null;
        };

        const attachDecoded = (slot, loaded) => {
            if (!slot || cancelled || !loaded) return;
            if (photoKey(slot.spec) !== photoKey(loaded)) return;
            if (!loaded.img || imgOwnedByOtherSlot(loaded.img, slot)) return;
            const prevWidth = slot.width;
            applyVisuals(slot, loaded);
            if (
                Math.abs(slot.width - prevWidth) > 0.5
                && !rowLayoutQuiet(slot.row)
            ) {
                packRow(slot.row);
            }
            paint(slot);
        };

        const decodeOntoSlot = (slot, item) => {
            if (!slot || !item) return;
            decodeSmall(item).then((loaded) => attachDecoded(slot, loaded));
        };

        const takeReadySpec = (exceptSlot) => {
            const occupied = occupiedKeys(exceptSlot);
            if (exceptSlot?.spec) occupied.add(photoKey(exceptSlot.spec));
            if (!bag.length) refillBag();
            for (let i = 0; i < bag.length; i += 1) {
                const item = bag[i];
                const key = photoKey(item);
                if (!key || occupied.has(key)) continue;
                const spec = decodedSpecs.get(key);
                if (!specIsReady(spec, exceptSlot)) continue;
                bag.splice(i, 1);
                reserved.add(key);
                touchDecoded(key);
                return spec;
            }
            return null;
        };

        const readyPoolCount = () => {
            const occupied = occupiedKeys();
            let count = 0;
            decodedSpecs.forEach((spec, key) => {
                if (occupied.has(key)) return;
                if (specIsReady(spec, null)) count += 1;
            });
            return count;
        };

        const peekUpcoming = (count) => {
            const occupied = occupiedKeys(null);
            const upcoming = [];
            for (let i = 0; i < bag.length && upcoming.length < count; i += 1) {
                const item = bag[i];
                const key = photoKey(item);
                if (!key || occupied.has(key)) continue;
                occupied.add(key);
                upcoming.push(item);
            }
            return upcoming;
        };

        const markShown = (spec) => {
            const key = photoKey(spec);
            if (!key) return;
            shownKeys.push(key);
            if (shownKeys.length > STREAM_LIBRARY.length * 3) {
                shownKeys.splice(0, shownKeys.length - STREAM_LIBRARY.length);
            }
        };

        const releaseReserved = (spec) => {
            const key = photoKey(spec);
            if (key) reserved.delete(key);
        };

        const applyVisuals = (slot, spec) => {
            const prev = photoKey(slot.spec);
            const next = photoKey(spec);
            if (next && next !== prev) {
                markShown(spec);
                noteShown(spec);
            }
            slot.spec = spec;
            slot.aspectRatio = spec.aspectRatio || 1;
            slot.width = itemHeight * slot.aspectRatio;
            slot.el.style.width = `${slot.width}px`;
            slot.el.style.height = `${itemHeight}px`;
            slot.el.style.backgroundImage = 'none';
            slot.el.style.backgroundColor = spec.src ? 'transparent' : spec.color;
            if (spec.img && !imgOwnedByOtherSlot(spec.img, slot)) {
                if (spec.img.parentNode !== slot.el) slot.el.replaceChildren(spec.img);
            } else if (!slot.el.querySelector('img')) {
                slot.el.replaceChildren();
            }
            if (slot.labelEl && slot.labelEl.parentNode !== slot.el) {
                slot.el.appendChild(slot.labelEl);
            }
        };

        const speedFor = (slotId) => {
            if (!SPEED_VARIATION) return baseSpeed;
            const jitter = (hash01(slotId + 17) - 0.5) * 2 * SPEED_VARIATION;
            return baseSpeed * (1 + jitter);
        };

        const applyDepth = (slot) => {
            if (!DEPTH_EFFECT_ENABLED || !SPEED_VARIATION) {
                slot.el.style.opacity = '1';
                slot.el.style.zIndex = '1';
                slot.scale = 1;
                return;
            }
            const t = Math.max(0, Math.min(1, slot.speed / (baseSpeed * (1 + SPEED_VARIATION))));
            slot.scale = 0.82 + 0.18 * t;
            slot.el.style.opacity = String(0.55 + 0.45 * t);
            slot.el.style.zIndex = String(Math.round(1 + t * 10));
        };

        const paint = (slot) => {
            const sway =
                SWAY_AMOUNT_PX === 0
                    ? 0
                    : Math.sin(slot.swayPhase) * SWAY_AMOUNT_PX;
            const scale = slot.scale || 1;
            const transform = `translate3d(${slot.x}px, ${sway}px, 0) scale(${scale})`;
            slot.paintedX = slot.x;
            slot.paintedWriter = positionWriter;
            if (slot.paintedTransform !== transform) {
                slot.paintedTransform = transform;
                slot.el.style.transform = transform;
            }
            const heldOpacity = opacityForSlot(slot);
            if (heldOpacity === null && DEPTH_EFFECT_ENABLED && SPEED_VARIATION) return;
            const opacity = heldOpacity === null ? 1 : heldOpacity;
            if (slot.paintedOpacity === opacity) return;
            slot.paintedOpacity = opacity;
            slot.el.style.opacity = String(opacity);
        };

        const revealSlot = (slot) => {
            if (!slot) return;
            slot.paintedOpacity = 1;
            slot.el.style.opacity = '1';
            if (slotHasLoadedPhoto(slot)) slot._emptyWarned = false;
            if (slot.el.classList.contains('is-hovered') && !slotHasLoadedPhoto(slot)) {
                slot.el.classList.remove('is-hovered');
                if (hoverSlot === slot) hoverSlot = null;
            }
            paint(slot);
        };

        const leftmostInRow = (rowIndex, except) => {
            let leftmost = null;
            for (let i = 0; i < pool.length; i += 1) {
                const slot = pool[i];
                if (slot.row !== rowIndex || slot === except) continue;
                if (slot.el && rows[slot.row] && slot.el.parentNode !== rows[slot.row]) continue;
                if (!leftmost || slot.x < leftmost.x) leftmost = slot;
            }
            return leftmost;
        };

        const slotIsHeld = (slot) => {
            if (!viewer) return false;
            if (viewer.slot === slot && !viewer.tileGone) return true;
            return viewer.departures.some((departure) => departure.slot === slot && !departure.tileGone);
        };

        const displayedSpec = (slot) => {
            const image = slot.el && slot.el.querySelector('img');
            const shown = image && (image.currentSrc || image.src);
            if (slot.spec && (!shown || urlsMatch(shown, slot.spec.src))) return slot.spec;
            const libraryItem = STREAM_LIBRARY.find((item) => urlsMatch(shown, item.src));
            if (!libraryItem) return slot.spec;
            return decodedSpecs.get(libraryItem.src || libraryItem.id) || { ...libraryItem };
        };

        const wrapSlot = (slot, spec) => {
            if (slot === hoverSlot) {
                slot.el.classList.remove('is-hovered');
                hoverSlot = null;
            }
            if (spec && spec !== slot.spec) {
                markShown(slot.spec);
                releaseReserved(slot.spec);
                applyVisuals(slot, spec);
                releaseReserved(spec);
            }
            const neighbor = leftmostInRow(slot.row, slot);
            slot.x = neighbor ? neighbor.x - slot.width - ITEM_GAP_PX : -slot.width;
            paint(slot);
        };

        const recycle = (slot) => {
            if (slot.frozen) return;
            const wasOwned = !!(viewer && slotIsHeld(slot));
            if (viewer) {
                if (viewer.slot === slot) viewer.tileGone = true;
                const departing = viewer.departures.find((item) => item.slot === slot);
                if (departing) departing.tileGone = true;
            }
            const spec = dealUniqueSpec(slot);
            if (spec) {
                noteDeal(photoKey(spec), false);
                wrapSlot(slot, spec);
                if (!slotHasLoadedPhoto(slot)) {
                    decodeOntoSlot(slot, libraryByKey.get(photoKey(spec)) || spec);
                }
            } else {
                wrapSlot(slot, slot.spec);
            }
            if (wasOwned) {
                slot.paintedOpacity = 1;
                slot.el.style.opacity = '1';
                paint(slot);
            }
            if (!(viewer && viewer.phase === 'closing')) pumpSmalls();
        };

        const ensureReadyBeforeVisible = (slot) => {
            if (slotHasLoadedPhoto(slot) || slot.frozen) return;
            const right = slot.x + slot.width;
            if (right > 0 || right < -180) return;
            const ready = takeReadySpec(slot);
            if (!ready) return;
            const prevWidth = slot.width;
            releaseReserved(slot.spec);
            applyVisuals(slot, ready);
            releaseReserved(ready);
            if (
                Math.abs(slot.width - prevWidth) > 0.5
                && !rowLayoutQuiet(slot.row)
            ) {
                packRow(slot.row);
            }
            paint(slot);
        };

        const warnOnScreenDuplicates = () => {
            if (!photoStats) return;
            const counts = new Map();
            pool.forEach((slot) => {
                if (!slot.spec || slot.x >= viewportWidth) return;
                const key = photoKey(slot.spec);
                if (!key) return;
                counts.set(key, (counts.get(key) || 0) + 1);
            });
            let extras = 0;
            counts.forEach((count, key) => {
                if (count < 2) {
                    if (photoStats.dupWarned) photoStats.dupWarned.delete(key);
                    return;
                }
                extras += count - 1;
                if (!photoStats.dupWarned) photoStats.dupWarned = new Set();
                if (photoStats.dupWarned.has(key)) return;
                photoStats.dupWarned.add(key);
                console.warn('[photos] duplicate on screen:', photoNumberInPath(key), 'x' + count);
            });
            photoStats.duplicates = extras;
        };

        const getCachedLarge = (spec) => {
            const key = spec?.srcFull;
            if (!key || !largeDecoded.has(key)) return null;
            const index = largeDecodedOrder.indexOf(key);
            if (index >= 0) {
                largeDecodedOrder.splice(index, 1);
                largeDecodedOrder.push(key);
            }
            return largeDecoded.get(key).img;
        };

        const largeKeyInUse = (key) => {
            if (!key) return false;
            if (viewer?.spec?.srcFull === key) return true;
            if (viewer?.departures?.some((dep) => dep.spec?.srcFull === key)) return true;
            const loaded = largeDecoded.get(key);
            const src = loaded?.img?.src;
            if (!src) return false;
            return flyers.some((node) => node.large && node.large.src === src);
        };

        const trimLargeCache = () => {
            while (largeDecodedOrder.length > LARGE_CACHE_LIMIT) {
                const victim = largeDecodedOrder.find((key) => !largeKeyInUse(key));
                if (!victim) break;
                const index = largeDecodedOrder.indexOf(victim);
                if (index >= 0) largeDecodedOrder.splice(index, 1);
                const loaded = largeDecoded.get(victim);
                largeDecoded.delete(victim);
                if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
            }
        };

        const rememberLarge = (key, loaded) => {
            if (!key || !loaded?.img) return;
            if (largeDecoded.has(key)) {
                const index = largeDecodedOrder.indexOf(key);
                if (index >= 0) largeDecodedOrder.splice(index, 1);
            }
            largeDecoded.set(key, loaded);
            largeDecodedOrder.push(key);
            trimLargeCache();
        };

        const abortOtherLarges = (keepKey) => {
            largeInflight.forEach((load, key) => {
                if (key === keepKey) return;
                if (load.reason === 'open' && viewer?.spec?.srcFull === key) return;
                load.controller.abort();
                largeInflight.delete(key);
            });
        };

        const loadLarge = (spec, { priority = 'low', reason = 'preload' } = {}) => {
            const key = spec?.srcFull;
            if (!key) return Promise.resolve(null);
            const cached = getCachedLarge(spec);
            if (cached) return Promise.resolve(cached);
            const existing = largeInflight.get(key);
            if (existing) {
                if (priority === 'high' && existing.priority !== 'high') existing.priority = 'high';
                return existing.promise;
            }
            const controller = new AbortController();
            const promise = loadDecodedImage(key, { priority, signal: controller.signal })
                .then((loaded) => {
                    if (largeInflight.get(key)?.controller !== controller) return null;
                    largeInflight.delete(key);
                    rememberLarge(key, loaded);
                    return loaded?.img || null;
                })
                .catch((err) => {
                    if (largeInflight.get(key)?.controller === controller) {
                        largeInflight.delete(key);
                    }
                    if (err?.name === 'AbortError') return null;
                    return null;
                });
            largeInflight.set(key, { promise, controller, priority, reason });
            return promise;
        };

        const scheduleLarge = (spec, reason) => {
            if (!spec?.srcFull || cancelled) return;
            if (reason === 'hover' && (smallsInFlight > 0 || collectDecodeQueue().length)) return;
            abortOtherLarges(spec.srcFull);
            loadLarge(spec, {
                priority: reason === 'open' ? 'high' : 'low',
                reason,
            });
        };

        const lookaheadRows = () => {
            const screens =
                scrollSpeed > FAST_SCROLL_PX_PER_SEC ? FAST_SCROLL_SCREENS : LOOKAHEAD_SCREENS;
            return Math.max(1, Math.ceil(viewHeight() / Math.max(1, stridePx()))) * screens;
        };

        const collectDecodeQueue = () => {
            const pending = [];
            const seen = new Set();
            const add = (item) => {
                const key = photoKey(item);
                if (!key || seen.has(key) || decodedSpecs.has(key) || decodePromises.has(key)) {
                    return;
                }
                seen.add(key);
                pending.push(item);
            };
            const { first, last } = visibleBounds();
            const ahead = last + lookaheadRows();
            for (let index = first; index <= ahead; index += 1) {
                (rowAssignments.get(index) || []).forEach(add);
            }
            peekUpcoming(photosPerRow() * lookaheadRows() + readyPoolMin()).forEach(add);
            return pending;
        };

        let smallPump = null;
        const pumpSmalls = () => {
            const pending = collectDecodeQueue();
            const needReady = readyPoolCount() < readyPoolMin();
            if ((!pending.length && !needReady) || smallPump) {
                if (!pending.length && smallsInFlight === 0 && !needReady) prefetchUpcomingLarge();
                return;
            }
            if (needReady && !bag.length) refillBag();
            const extras = needReady && !pending.length
                ? peekUpcoming(readyPoolMin()).filter((item) => {
                    const key = photoKey(item);
                    return key && !decodedSpecs.has(key) && !decodePromises.has(key);
                })
                : pending;
            if (!extras.length) {
                if (smallsInFlight === 0 && readyPoolCount() >= readyPoolMin()) prefetchUpcomingLarge();
                return;
            }
            smallPump = mapWithConcurrency(extras, DECODE_CONCURRENCY, decodeSmall).finally(() => {
                smallPump = null;
                if (collectDecodeQueue().length || readyPoolCount() < readyPoolMin()) pumpSmalls();
                else if (smallsInFlight === 0) prefetchUpcomingLarge();
            });
        };

        const prefetchUpcomingLarge = () => {
            if (viewer) return Promise.resolve();
            if (smallsInFlight > 0 || collectDecodeQueue().length || readyPoolCount() < readyPoolMin()) {
                return Promise.resolve();
            }
            if (largeInflight.size > 0 || largeDecoded.size >= LARGE_CACHE_LIMIT) {
                return Promise.resolve();
            }
            const next = peekUpcoming(1).find(
                (item) => item.srcFull && !largeDecoded.has(item.srcFull) && !largeInflight.has(item.srcFull)
            );
            if (!next) return Promise.resolve();
            return loadLarge(next, { priority: 'low', reason: 'prefetch' });
        };

        const scheduleUpcoming = () => {
            pumpSmalls();
        };

        const rectsOverlap = (a, b) =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

        const closeButtonBox = (layout) => {
            const border = layout.border || 0;
            const right = layout.endLeft + layout.inner.width + border;
            const top = layout.endTop - border;
            let closeX = right + CLOSE_BUTTON_GAP_PX;
            let closeY = top;
            if (closeX + CLOSE_BUTTON_PX > window.innerWidth - 8) {
                closeX = Math.max(8, right - CLOSE_BUTTON_PX);
                closeY = Math.max(8, top - CLOSE_BUTTON_PX - 4);
            }
            return {
                left: closeX,
                top: closeY,
                right: closeX + CLOSE_BUTTON_PX,
                bottom: closeY + CLOSE_BUTTON_PX,
            };
        };

        const obstructionBoxes = (layout) => {
            const border = layout.border || 0;
            const boxes = [
                {
                    left: layout.endLeft - border,
                    top: layout.endTop - border,
                    right: layout.endLeft + layout.inner.width + border,
                    bottom: layout.endTop + layout.inner.height + border,
                },
                closeButtonBox(layout),
            ];
            if (layout.panel) {
                boxes.push({
                    left: layout.panel.left,
                    top: layout.panel.top,
                    right: layout.panel.left + layout.panel.width,
                    bottom: layout.panel.top + layout.panel.height,
                });
            }
            return boxes;
        };

        const rowFadeBox = (index) => {
            const top = viewOriginY + index * stridePx();
            const outline = hoverOutlineEstimatePx();
            const clearance = labelClearancePx(itemHeight);
            const width = viewportWidth || window.innerWidth;
            return {
                left: viewOriginX,
                top: top - outline,
                right: viewOriginX + width,
                bottom: top + itemHeight + clearance,
            };
        };

        const hiddenRowsFor = (layout) => {
            const hidden = new Set();
            if (!layout) return hidden;
            cacheStreamOrigin();
            const boxes = obstructionBoxes(layout);
            const viewH = viewHeight();
            rows.forEach((row, index) => {
                if (!row) return;
                const box = rowFadeBox(index);
                if (box.bottom <= 0 || box.top >= viewH) return;
                if (boxes.some((other) => rectsOverlap(box, other))) hidden.add(index);
            });
            return hidden;
        };

        const rowStaysVisible = (rowIndex) =>
            !!viewer && !(viewer.hiddenRows && viewer.hiddenRows.has(rowIndex));

        const applyRows = (amount) => {
            const hidden = viewer && viewer.hiddenRows ? viewer.hiddenRows : null;
            rows.forEach((row, index) => {
                if (!row) return;
                const stay = !hidden || !hidden.has(index);
                const targetOpacity = viewer && !stay ? 0 : 1;
                const opacity = 1 + (targetOpacity - 1) * amount;
                const opacityStr = String(opacity);
                if (row.dataset.opacity !== opacityStr) {
                    row.dataset.opacity = opacityStr;
                    row.style.opacity = opacityStr;
                }
                const blocked = opacity < 0.2;
                const blockedFlag = blocked ? '1' : '0';
                if (row.dataset.blocked !== blockedFlag) {
                    row.dataset.blocked = blockedFlag;
                }
                const z = viewer && stay ? '2' : '';
                if (row.style.zIndex !== z) row.style.zIndex = z;
                const pointerEvents = blocked ? 'none' : '';
                if (row.style.pointerEvents !== pointerEvents) {
                    row.style.pointerEvents = pointerEvents;
                }
            });
            section.classList.toggle(
                'is-viewer-open',
                amount > 0.02 || !!(viewer && viewer.phase === 'closing')
            );
        };

        const viewerAspect = (spec, slot) => {
            if (spec?.aspectRatio) return spec.aspectRatio;
            if (spec?.number != null && ASPECT_BY_NUMBER.has(spec.number)) {
                return ASPECT_BY_NUMBER.get(spec.number);
            }
            if (slot?.width && itemHeight) return slot.width / itemHeight;
            return 1;
        };

        // The panel sits beside the photo on wide screens and below it on
        // narrow ones; either way its room comes out of the viewer's box.
        const panelBeside = () =>
            GALLERY_PANEL_ENABLED && window.innerWidth >= GALLERY_SIDE_MIN_PX;

        const panelWidthPx = () =>
            Math.max(
                GALLERY_PANEL_MIN_PX,
                Math.min(GALLERY_PANEL_MAX_PX, Math.round(window.innerWidth * 0.24))
            );

        const bottomReservePx = () => {
            if (!GALLERY_PANEL_ENABLED) return CAPTION_RESERVE_PX;
            return panelBeside() ? 0 : GALLERY_BELOW_GAP_PX + GALLERY_BELOW_PX;
        };

        const panelGeometry = (box) => {
            if (!GALLERY_PANEL_ENABLED) return null;
            const { beside, groupLeft, border, inner, endLeft, endTop, bandBottom } = box;
            if (beside) {
                // Spans the photo's height; the text inside sits at the bottom.
                return {
                    beside: true,
                    left: groupLeft,
                    top: endTop - border,
                    width: panelWidthPx(),
                    height: inner.height + border * 2,
                };
            }
            const left = Math.max(8, endLeft - border);
            const top = endTop + inner.height + border + GALLERY_BELOW_GAP_PX;
            return {
                beside: false,
                left,
                top,
                width: Math.min(
                    window.innerWidth - left - 8,
                    Math.max(240, inner.width + border * 2)
                ),
                height: Math.max(80, bandBottom - top),
            };
        };

        const layoutViewer = (spec, slot) => {
            const aspect = viewerAspect(spec, slot);
            const reserve = bottomReservePx();
            const beside = panelBeside();
            const sideCost = beside ? panelWidthPx() + GALLERY_PANEL_GAP_PX : 0;
            const border = viewerBorderPx();
            const firstTop = restFirstTop;
            const count = Math.max(1, pageRowCount);
            const lastTop = firstTop + (count - 1) * stridePx();
            const topGap = Math.max(VIEWER_GAP_PX, labelClearancePx(itemHeight));
            const bottomGap = VIEWER_GAP_PX;
            const gapTop = firstTop + itemHeight + topGap;
            const gapBottom = lastTop - bottomGap;
            const visibleTop = Math.max(gapTop, topGap);
            const visibleBottom = Math.min(gapBottom, viewHeight() - bottomGap);
            const betweenRows = visibleBottom - visibleTop;
            const room = viewHeight() - VIEWER_GAP_PX * 2;
            const maxTotalH = Math.max(
                80,
                Math.min(room, betweenRows > 40 ? betweenRows : room) - reserve
            );
            const maxTotalW = Math.max(
                80,
                window.innerWidth - VIEWER_GAP_PX * 2 - sideCost
            );
            const inner = fitInBox(
                aspect,
                Math.max(40, maxTotalW - border * 2),
                Math.max(40, maxTotalH - border * 2)
            );
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const groupLeft = Math.max(
                VIEWER_GAP_PX,
                (window.innerWidth - (totalW + sideCost)) / 2
            );
            const centerLeft = (window.innerWidth - inner.width) / 2;
            const endLeft = beside ? groupLeft + sideCost + border : centerLeft;
            let standardEndTop = visibleTop + Math.max(0, maxTotalH - totalH) / 2 + border;
            const minEndTop = Math.ceil(
                Math.max(VIEWER_GAP_PX, headerEl()?.getBoundingClientRect().bottom || 0)
                + border
            );
            const maxEndTop = Math.floor(
                viewHeight() - inner.height - VIEWER_GAP_PX - border - reserve
            );
            standardEndTop = Math.max(minEndTop, Math.min(standardEndTop, maxEndTop));

            const buildLayout = (endTop) => ({
                border,
                inner,
                totalW,
                totalH,
                endLeft,
                endTop,
                centerLeft,
                standardEndTop,
                panel: panelGeometry({
                    beside,
                    groupLeft,
                    border,
                    inner,
                    endLeft,
                    endTop,
                    bandBottom: viewHeight() - VIEWER_GAP_PX,
                }),
            });

            cacheStreamOrigin();
            const viewH = viewHeight();
            const headerBottom = Math.ceil(headerEl()?.getBoundingClientRect().bottom || 0);
            const minBoxTop = Math.max(VIEWER_GAP_PX, headerBottom);
            const stride = stridePx();
            const firstIndex = Math.max(0, Math.floor((0 - viewOriginY) / Math.max(1, stride)) - 2);
            const fadeIndexes = [];
            for (let index = firstIndex; index < firstIndex + 24; index += 1) {
                fadeIndexes.push(index);
            }

            const layoutFits = (layout) =>
                obstructionBoxes(layout).every(
                    (box) =>
                        box.top >= minBoxTop - 0.5
                        && box.bottom <= viewH + 0.5
                        && box.left >= -0.5
                        && box.right <= window.innerWidth + 0.5
                );

            const countFades = (layout) => {
                const boxes = obstructionBoxes(layout);
                let n = 0;
                for (let i = 0; i < fadeIndexes.length; i += 1) {
                    const box = rowFadeBox(fadeIndexes[i]);
                    if (box.bottom <= 0 || box.top >= viewH) continue;
                    if (boxes.some((other) => rectsOverlap(box, other))) n += 1;
                }
                return n;
            };

            const gapAboveRowBelow = (layout) => {
                const frameBottom = layout.endTop + layout.inner.height + layout.border;
                const boxes = obstructionBoxes(layout);
                let nearest = Infinity;
                for (let i = 0; i < fadeIndexes.length; i += 1) {
                    const index = fadeIndexes[i];
                    const top = viewOriginY + index * stride;
                    if (top + itemHeight <= 0 || top >= viewH) continue;
                    const box = rowFadeBox(index);
                    if (boxes.some((other) => rectsOverlap(box, other))) continue;
                    if (top >= frameBottom - 0.5 && top < nearest) nearest = top;
                }
                return nearest - frameBottom;
            };

            // Same size as the top-of-page photo; only the vertical position
            // may move, so it sits in the row gaps and fades as few rows as
            // possible. Prefer a normal gap above the row below, then the
            // standard (top-of-page) position.
            let bestY = standardEndTop;
            let bestFades = Infinity;
            let bestComfort = -1;
            let bestDist = Infinity;
            const consider = (y) => {
                if (y < minEndTop || y > maxEndTop) return;
                const layout = buildLayout(y);
                if (!layoutFits(layout)) return;
                const fades = countFades(layout);
                const comfort = gapAboveRowBelow(layout) >= VIEWER_GAP_PX - 0.5 ? 1 : 0;
                const dist = Math.abs(y - standardEndTop);
                if (
                    fades < bestFades
                    || (fades === bestFades && comfort > bestComfort)
                    || (fades === bestFades && comfort === bestComfort && dist < bestDist)
                ) {
                    bestY = y;
                    bestFades = fades;
                    bestComfort = comfort;
                    bestDist = dist;
                }
            };
            consider(standardEndTop);
            for (let y = minEndTop; y <= maxEndTop; y += 1) consider(y);

            return buildLayout(bestY);
        };

        // Step A grows the photo to the centre; the slide across to the panel
        // layout is a second step, so the two never blend into one move.
        const openTargetFor = (layout) => {
            const slide =
                GALLERY_PANEL_ENABLED
                && !reducedMotion
                && Math.abs(layout.endLeft - layout.centerLeft) > 0.5;
            return {
                slide,
                pose: {
                    x: slide ? layout.centerLeft : layout.endLeft,
                    y: layout.endTop,
                    scale: 1,
                },
            };
        };

        const poseFromThumb = (thumb, layout) => {
            const scale = thumb.width / Math.max(1, layout.inner.width);
            return {
                x: thumb.left,
                y: thumb.top,
                scale,
            };
        };

        const liveThumb = (slot) => {
            const scale = slot.scale || 1;
            const width = slot.width * scale;
            const height = itemHeight * scale;
            return {
                left: viewOriginX + slot.x + (slot.width - width) / 2,
                top: viewOriginY + slot.row * stridePx() + (itemHeight - height) / 2,
                width,
                height,
            };
        };

        const liveClosePose = (slot, layout) => poseFromThumb(liveThumb(slot), layout);

        const prepareHomeTile = (slot) => {
            if (!slot?.el) return;
            const img = slot.spec && slot.spec.img;
            if (img && img.parentNode !== slot.el && !imgOwnedByOtherSlot(img, slot)) {
                slot.el.appendChild(img);
                if (slot.labelEl && slot.labelEl.parentNode !== slot.el) {
                    slot.el.appendChild(slot.labelEl);
                }
            }
            if (img && typeof img.decode === 'function') {
                img.decode().catch(() => undefined);
            }
            slot.el.style.willChange = 'transform';
            slot.el.style.backgroundColor = 'transparent';
            paint(slot);
        };

        const thumbOnScreen = (thumb) =>
            !!thumb && thumb.left < window.innerWidth && thumb.left + thumb.width > 0;

        const homeTileStillThere = (slot, key, tileGone) => {
            if (tileGone || !slot || !key) return false;
            if (!slot.el || !rows[slot.row] || slot.el.parentNode !== rows[slot.row]) return false;
            if (photoKey(slot.spec) !== key) return false;
            return thumbOnScreen(liveThumb(slot));
        };

        const exitRightPose = (layout, thumb, rowIndex) => {
            const width = thumb?.width || itemHeight;
            const height = thumb?.height || itemHeight;
            const scale = width / Math.max(1, layout.inner.width);
            const top = viewOriginY + rowIndex * stridePx()
                + (itemHeight - height) / 2;
            return {
                x: window.innerWidth,
                y: top,
                scale,
            };
        };

        const closeTargetFor = (slot, layout, tileGone, homeWidth, homeKey, homeRow) => {
            if (homeTileStillThere(slot, homeKey, tileGone)) {
                return { exitRight: false, pose: liveClosePose(slot, layout) };
            }
            return {
                exitRight: true,
                pose: exitRightPose(
                    layout,
                    {
                        width: homeWidth || itemHeight,
                        height: itemHeight,
                    },
                    homeRow != null ? homeRow : (slot ? slot.row : 0)
                ),
            };
        };

        const placeNode = (node, pose) => {
            node.root.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`;
        };

        const releaseFlyer = (node) => {
            if (!node) return;
            node.root.style.willChange = 'auto';
            node.root.style.opacity = '1';
            node.small.removeAttribute('src');
            node.large.removeAttribute('src');
            node.small.style.visibility = '';
            node.large.style.opacity = '0';
            if (node.frame) node.frame.style.opacity = '0';
            if (node === homeFlyer) {
                node.root.hidden = true;
                return;
            }
            node.root.remove();
        };

        const sizeFlyer = (node, layout) => {
            node.root.style.transition = 'none';
            node.root.style.width = `${layout.inner.width}px`;
            node.root.style.height = `${layout.inner.height}px`;
            node.root.style.padding = '0';
            node.root.style.setProperty('--flyer-border', `${layout.border}px`);
        };

        const setFlyerFrame = (node, opacity) => {
            if (!node?.frame) return;
            const value = String(Math.max(0, Math.min(1, opacity)));
            if (node.frame.style.opacity !== value) node.frame.style.opacity = value;
        };

        const attachLargeToFlyer = (node, image) => {
            if (!node?.large || !image) return;
            node.large.fetchPriority = 'high';
            node.large.setAttribute('fetchpriority', 'high');
            node.large.decoding = 'async';
            if (node.large.src !== image.src) node.large.src = image.src;
        };

        const configureFlyer = (node, layout, spec) => {
            const { root, small, large } = node;
            sizeFlyer(node, layout);
            root.style.transformOrigin = '0 0';
            root.style.willChange = 'transform, opacity';
            root.style.opacity = '1';
            root.hidden = false;
            small.src = spec?.objectUrl || (spec?.src ? encodeURI(spec.src) : '');
            const cached = getCachedLarge(spec);
            if (cached) {
                small.style.visibility = 'hidden';
                attachLargeToFlyer(node, cached);
                large.style.opacity = '1';
            } else {
                small.style.visibility = 'visible';
                large.removeAttribute('src');
                large.style.opacity = '0';
            }
            setFlyerFrame(node, 0);
        };

        const armLarge = (node, spec) => {
            abortOtherLarges(spec?.srcFull);
            loadLarge(spec, { priority: 'high', reason: 'open' }).then((image) => {
                if (!image || cancelled || !viewer || viewer.spec !== spec) return;
                if (viewer.phase === 'closing') return;
                if (activeFlyer !== node) return;
                attachLargeToFlyer(node, image);
                viewer.largeReady = true;
                if (viewer.largeFromStart || viewer.largeOpacity >= 1) {
                    viewer.largeOpacity = 1;
                    viewer.largeShown = true;
                    node.large.style.opacity = '1';
                    node.small.style.visibility = 'hidden';
                    return;
                }
                if (!viewer.largeFadeStart) viewer.largeFadeStart = performance.now();
                play();
            });
        };

        const syncLargeFade = (now) => {
            if (!viewer || !activeFlyer) return;
            if (viewer.phase !== 'closing' && viewer.largeReady) {
                if (viewer.largeFromStart) {
                    viewer.largeOpacity = 1;
                    viewer.largeShown = true;
                } else {
                    if (!viewer.largeFadeStart) viewer.largeFadeStart = now;
                    const t = Math.min(1, (now - viewer.largeFadeStart) / Math.max(1, LARGE_CROSSFADE_MS));
                    viewer.largeOpacity = t;
                    if (t >= 1) viewer.largeShown = true;
                }
            }
            const opacity = viewer.largeOpacity || 0;
            const opacityText = String(opacity);
            if (activeFlyer.large.style.opacity !== opacityText) {
                activeFlyer.large.style.opacity = opacityText;
            }
            const vis = opacity >= 1 ? 'hidden' : 'visible';
            if (activeFlyer.small.style.visibility !== vis) {
                activeFlyer.small.style.visibility = vis;
            }
        };

        const placeOverlay = (pose, layout) => {
            viewer.pose = pose;
            placeNode(activeFlyer, pose);
            setFlyerFrame(activeFlyer, viewer.frameOpacity);
            if (viewer.phase === 'closing' || viewer.closeDone) return;
            const extra = (layout.border || 0) * pose.scale * (viewer.frameOpacity || 0);
            const right = pose.x + layout.inner.width * pose.scale + extra;
            const top = pose.y - extra;
            let closeX = right + CLOSE_BUTTON_GAP_PX;
            let closeY = top;
            if (closeX + CLOSE_BUTTON_PX > window.innerWidth - 8) {
                closeX = Math.max(8, right - CLOSE_BUTTON_PX);
                closeY = Math.max(8, top - CLOSE_BUTTON_PX - 4);
            }
            closeBtn.style.transform = `translate3d(${closeX}px, ${closeY}px, 0)`;
        };

        // Text is rewritten on every open and every switch, so the caption can
        // never be left showing the photo before it.
        const setCaptionText = (spec) => {
            if (GALLERY_PANEL_ENABLED) {
                caption.hidden = true;
                return;
            }
            const info = photoLabelFor(spec);
            captionTitle.textContent = info ? info.title : '';
            captionYear.textContent = info && info.year ? `, ${info.year}` : '';
            caption.hidden = !info;
        };

        // Parked at the flyer's resting place, not its animated pose.
        const placeCaption = (layout) => {
            if (caption.hidden || !layout) return;
            const border = layout.border || 0;
            const left = Math.max(8, layout.endLeft - border);
            const top = layout.endTop + layout.inner.height + border + CAPTION_GAP_PX;
            const size = Math.max(
                CAPTION_MIN_FONT_PX,
                Math.min(CAPTION_MAX_FONT_PX, Math.round(layout.inner.width * 0.014))
            );
            caption.style.fontSize = `${size}px`;
            caption.style.maxWidth = `${Math.max(120, window.innerWidth - left - 8)}px`;
            caption.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        };

        const syncCaption = () => {
            if (GALLERY_PANEL_ENABLED) return;
            const show = !!viewer && viewer.phase === 'open' && !viewer.closeDone;
            const value = show ? '1' : '0';
            if (caption.style.opacity !== value) caption.style.opacity = value;
        };

        // Panel text reveal. Shared engine with Design Work: real text stays in
        // flow so wrapping is locked; scramble sits on top and matches baseline.
        let panelShown = false;
        const panelReveal = createTextReveal({
            sweepMs: GALLERY_SWEEP_MS,
            charMinMs: GALLERY_CHAR_MIN_MS,
            charExtraMs: GALLERY_CHAR_EXTRA_MS,
        });

        const panelTextEls = () => [panelTitle, panelYear, panelDetails, panelText];

        const panelRevealArgs = () => ({
            container: panel,
            textEls: panelTextEls(),
            ruleEl: panelRule,
            innerEl: panelInner,
        });

        const stopPanelRevealLoop = () => {
            panelReveal.stop();
        };

        const clearPanelReveal = () => {
            panelReveal.clear(panelRevealArgs());
        };

        const startPanelReveal = () => {
            if (!GALLERY_PANEL_ENABLED || panel.hidden) return;
            panelReveal.start({
                ...panelRevealArgs(),
                reducedMotion,
                debug: process.env.NODE_ENV !== 'production',
            });
        };

        // On open and on switch the panel drops out without a fade, so the new
        // text never fades out before it fades in.
        const hidePanelInstantly = () => {
            if (!GALLERY_PANEL_ENABLED) return;
            panelShown = false;
            clearPanelReveal();
            panel.classList.remove('is-leaving');
            panel.style.transition = 'none';
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            void panel.offsetWidth;
            panel.style.transition = '';
        };

        const setPanelText = (spec) => {
            if (!GALLERY_PANEL_ENABLED) return;
            const info = photoLabelFor(spec);
            panelTitle.textContent = info ? info.title : '';
            panelYear.textContent = info && info.year ? info.year : '';
            panelDetails.textContent = (info && info.details) || GALLERY_DETAILS_PLACEHOLDER;
            panelText.textContent = (info && info.description) || GALLERY_TEXT_PLACEHOLDER;
            panel.hidden = !info;
            panel.scrollTop = 0;
        };

        // Parked at the flyer's resting place, like the caption.
        const placePanel = (layout) => {
            if (!GALLERY_PANEL_ENABLED || panel.hidden || !layout?.panel) return;
            const box = layout.panel;
            panel.classList.toggle('is-below', !box.beside);
            panel.style.width = `${Math.round(box.width)}px`;
            panel.style.height = `${Math.round(box.height)}px`;
            panel.style.transform =
                `translate3d(${Math.round(box.left)}px, ${Math.round(box.top)}px, 0)`;
        };

        // Edge triggered: the sweep starts the moment the slide lands.
        const syncPanel = () => {
            if (!GALLERY_PANEL_ENABLED) return;
            const show = !!viewer && viewer.phase === 'open' && !viewer.closeDone;
            if (show === panelShown) return;
            panelShown = show;
            if (!show) {
                stopPanelRevealLoop();
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                return;
            }
            panel.classList.remove('is-leaving');
            panel.style.transition = 'none';
            panel.style.opacity = '1';
            panel.style.pointerEvents = 'auto';
            void panel.offsetWidth;
            panel.style.transition = '';
            startPanelReveal();
        };

        const beginRowSyncProbe = () => {
            if (!ROW_SYNC_PROBE) return;
            rowSyncUntil = Number.POSITIVE_INFINITY;
            rowSyncLast = new Map();
        };

        const endRowSyncProbe = () => {
            if (!ROW_SYNC_PROBE) return;
            rowSyncUntil = performance.now() + 1500;
        };

        const sampleRowSyncProbe = (now) => {
            if (!ROW_SYNC_PROBE || !rowSyncUntil || now > rowSyncUntil) return;
            const { first, last } = visibleBounds();
            const deltas = [];
            for (let row = first; row <= last; row += 1) {
                let tile = null;
                for (let i = 0; i < pool.length; i += 1) {
                    const slot = pool[i];
                    if (slot.row !== row || slot.frozen || !slotIsLive(slot)) continue;
                    if (slot.x + slot.width <= 0 || slot.x >= viewportWidth) continue;
                    if (!tile || slot.x < tile.x) tile = slot;
                }
                if (!tile || tile.paintedX == null) continue;
                const prev = rowSyncLast.get(row);
                rowSyncLast.set(row, {
                    x: tile.paintedX,
                    writer: tile.paintedWriter || positionWriter,
                });
                if (!prev) continue;
                deltas.push({
                    row,
                    dx: tile.paintedX - prev.x,
                    writer: tile.paintedWriter || positionWriter,
                    x: tile.paintedX,
                });
            }
            if (deltas.length < 2) return;
            let min = deltas[0].dx;
            let max = deltas[0].dx;
            for (let i = 1; i < deltas.length; i += 1) {
                if (deltas[i].dx < min) min = deltas[i].dx;
                if (deltas[i].dx > max) max = deltas[i].dx;
            }
            if (max - min > 0.5) {
                console.warn('[row-sync] rows moved apart', {
                    spread: Math.round((max - min) * 100) / 100,
                    rows: deltas.map((item) => ({
                        row: item.row,
                        dx: Math.round(item.dx * 100) / 100,
                        writer: item.writer,
                    })),
                    writers: [...new Set(deltas.map((item) => item.writer))],
                });
            }
            if (now >= rowSyncUntil && rowSyncUntil !== Number.POSITIVE_INFINITY) {
                rowSyncUntil = 0;
                rowSyncLast = new Map();
            }
        };

        const startCloseProbe = (slot) => {
            if (!CLOSE_PROBE || !slot) return;
            const neighbor = pool.find((item) => (
                item !== slot
                && item.row === slot.row
                && !item.frozen
            ));
            closeProbe = {
                slot,
                neighbor: neighbor || null,
                lastHomeX: slot.x,
                lastNeighborX: neighbor ? neighbor.x : slot.x,
                lastNow: performance.now(),
                handedOff: false,
                until: 0,
                maxStepDiff: 0,
                longFrames: [],
                mismatches: 0,
            };
        };

        const sampleCloseProbe = (now) => {
            if (!closeProbe) return;
            const dtMs = now - closeProbe.lastNow;
            if (dtMs > 20) {
                const ms = Math.round(dtMs * 10) / 10;
                closeProbe.longFrames.push(ms);
                console.warn('[close-probe] long frame', ms);
            }
            const homeX = closeProbe.slot.x;
            const neighborX = closeProbe.neighbor ? closeProbe.neighbor.x : homeX;
            const homeStep = homeX - closeProbe.lastHomeX;
            const neighborStep = neighborX - closeProbe.lastNeighborX;
            const diff = Math.abs(homeStep - neighborStep);
            if (diff > 0.5) {
                closeProbe.mismatches += 1;
                console.warn('[close-probe] x-step mismatch', {
                    homeStep,
                    neighborStep,
                    diff,
                });
            }
            closeProbe.maxStepDiff = Math.max(closeProbe.maxStepDiff, diff);
            closeProbe.lastHomeX = homeX;
            closeProbe.lastNeighborX = neighborX;
            closeProbe.lastNow = now;
            if (closeProbe.handedOff && closeProbe.until && now >= closeProbe.until) {
                console.info('[close-probe] done', {
                    maxStepDiff: closeProbe.maxStepDiff,
                    mismatches: closeProbe.mismatches,
                    longFrames: closeProbe.longFrames,
                });
                closeProbe = null;
            }
        };

        const markCloseProbeHandoff = (now) => {
            if (!closeProbe || closeProbe.handedOff) return;
            closeProbe.handedOff = true;
            closeProbe.until = now + 1000;
        };

        const handoffHomeTile = () => {
            if (!viewer || viewer.handedOff || viewer.closeExitRight) return;
            const slot = viewer.slot;
            if (!homeTileStillThere(slot, viewer.shownKey, viewer.tileGone)) return;
            const live = liveClosePose(slot, viewer.layout);
            if (activeFlyer) placeNode(activeFlyer, live);
            viewer.pose = live;
            viewer.thumbOpacity = 1;
            if (CLOSE_PROBE) {
                const tile = liveThumb(slot);
                const miss = Math.hypot(live.x - tile.left, live.y - tile.top);
                if (miss > 0.5) {
                    console.warn('[close-probe] flyer/tile miss at handoff', { miss, live, tile });
                }
            }
            revealSlot(slot);
            overlay.style.pointerEvents = 'none';
            if (activeFlyer?.root) {
                activeFlyer.root.hidden = true;
                activeFlyer.root.style.willChange = 'auto';
            }
            viewer.handedOff = true;
            markCloseProbeHandoff(performance.now());
            if (fineHover) syncHover(true);
        };

        const finishViewer = () => {
            if (!viewer) return;
            const slot = viewer.slot;
            const revealHome = !viewer.handedOff
                && homeTileStillThere(slot, viewer.shownKey, viewer.tileGone);
            const departures = viewer.departures;
            const flyer = activeFlyer;
            quietRows = new Set();
            if (slot) quietRows.add(slot.row);
            departures.forEach((dep) => {
                if (dep.slot) quietRows.add(dep.slot.row);
            });
            quietRowsUntil = performance.now() + 1200;
            viewer = null;
            if (revealHome) revealSlot(slot);
            const leftoverFlyers = [];
            departures.forEach((dep) => {
                if (homeTileStillThere(dep.slot, dep.shownKey, dep.tileGone)) {
                    revealSlot(dep.slot);
                }
                if (dep.flyer?.root) dep.flyer.root.hidden = true;
                leftoverFlyers.push(dep.flyer);
            });
            if (flyer?.root) flyer.root.hidden = true;
            activeFlyer = homeFlyer;
            closeBtn.hidden = true;
            caption.style.opacity = '0';
            caption.hidden = true;
            panelShown = false;
            panel.classList.remove('is-leaving');
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            closeBtn.style.willChange = 'auto';
            if (menuEl) {
                menuEl.style.opacity = '';
                menuEl.style.pointerEvents = '';
            }
            if (hoverSlot && !slotHasLoadedPhoto(hoverSlot)) {
                hoverSlot.el.classList.remove('is-hovered');
                hoverSlot = null;
            }
            if (slot?.el) {
                window.setTimeout(() => {
                    if (slot.el) slot.el.style.willChange = 'auto';
                }, 1000);
            }
            overlay.style.pointerEvents = 'none';
            const settle = () => {
                if (cancelled) return;
                leftoverFlyers.concat(deferredFlyers).forEach((node) => {
                    if (node && node !== homeFlyer && node !== activeFlyer) releaseFlyer(node);
                });
                deferredFlyers = [];
                if (viewer) {
                    if (flyer && flyer !== homeFlyer && flyer !== activeFlyer) releaseFlyer(flyer);
                    return;
                }
                if (flyer === homeFlyer) releaseFlyer(homeFlyer);
                else if (flyer && flyer !== activeFlyer) releaseFlyer(flyer);
                clearPanelReveal();
                resetOverlayClip();
                panel.style.transition = '';
                panel.hidden = true;
                overlay.hidden = true;
                overlay.style.pointerEvents = '';
                section.classList.remove('is-viewer-open');
                applyRows(0);
                unlockScroll();
                syncPlayback();
                releaseLayoutWrites(1600);
                endRowSyncProbe();
            };
            const later = typeof requestIdleCallback === 'function'
                ? (fn) => requestIdleCallback(fn, { timeout: 280 })
                : (fn) => window.setTimeout(fn, 80);
            postCloseFrame = requestAnimationFrame(() => {
                postCloseFrame = requestAnimationFrame(() => {
                    later(settle);
                });
            });
        };

        const advanceDepartures = (now) => {
            if (!viewer) return;
            const duration = Math.max(1, viewer.duration);
            viewer.departures = viewer.departures.filter((dep) => {
                const raw = Math.min(1, (now - dep.t0) / duration);
                const amount = easeClose(raw);
                let next;
                if (dep.closeExitRight) {
                    next = { exitRight: true, pose: dep.closeTo };
                } else {
                    next = closeTargetFor(
                        dep.slot,
                        dep.layout,
                        dep.tileGone,
                        dep.homeThumbWidth,
                        dep.shownKey,
                        dep.homeRow
                    );
                    if (next.exitRight) {
                        dep.from = startPoseFor(dep.pose, next.pose, amount);
                        dep.closeExitRight = true;
                        dep.closeTo = next.pose;
                    }
                }
                const pose = reducedMotion
                    ? dep.from
                    : lerpPose(dep.from, next.pose, amount);
                dep.pose = pose;
                dep.thumbOpacity = 0;
                dep.frameOpacity = frameOpacityFor('closing', amount);
                if (!dep.tileGone) dep.slot.el.style.opacity = '0';
                placeNode(dep.flyer, pose);
                setFlyerFrame(dep.flyer, dep.frameOpacity);
                if (reducedMotion) dep.flyer.root.style.opacity = String(1 - amount);
                if (raw >= 1) {
                    if (homeTileStillThere(dep.slot, dep.shownKey, dep.tileGone)) {
                        revealSlot(dep.slot);
                    }
                    if (dep.flyer?.root) dep.flyer.root.hidden = true;
                    if (viewer && viewer.phase === 'closing') deferredFlyers.push(dep.flyer);
                    else releaseFlyer(dep.flyer);
                    return false;
                }
                return true;
            });
        };

        const syncCloseButton = () => {
            const show = viewer && viewer.phase === 'open' && !viewer.closeDone;
            closeBtn.style.opacity = show ? '1' : '0';
            closeBtn.style.pointerEvents = show ? 'auto' : 'none';
        };

        const advanceViewer = (now, dt) => {
            if (!viewer) return;
            if (
                viewer.phase === 'open'
                && viewer.rowMotion === 'hold'
                && viewer.departures.length === 0
            ) {
                if (!viewer.settled) {
                    applyRows(1);
                    viewer.frameOpacity = 1;
                    viewer.thumbOpacity = 0;
                    placeOverlay(viewer.to, viewer.layout);
                    viewer.settled = true;
                    syncCloseButton();
                    syncCaption();
                    syncPanel();
                }
                syncLargeFade(now);
                return;
            }
            viewer.settled = false;
            const duration = Math.max(1, viewer.duration);
            const closeDuration = Math.max(1, viewer.closeDuration || duration);

            if (viewer.rowMotion === 'in') {
                viewer.rowAmount = easeOpen(Math.min(1, (now - viewer.rowT0) / duration));
                if (viewer.rowAmount >= 1) viewer.rowMotion = 'hold';
            } else if (viewer.rowMotion === 'out') {
                viewer.rowAmount = 1 - easeClose(Math.min(1, (now - viewer.rowT0) / closeDuration));
            } else {
                viewer.rowAmount = 1;
            }
            if (!(viewer.phase === 'closing' && viewer.closeDone)) {
                applyRows(viewer.rowAmount);
            }

            if (viewer.phase === 'opening' || viewer.phase === 'switching') {
                const raw = Math.min(1, (now - viewer.t0) / duration);
                const amount = easeOpen(raw);
                viewer.progress = raw;
                viewer.thumbOpacity = 0;
                viewer.frameOpacity = reducedMotion ? amount : frameOpacityFor(viewer.phase, amount);
                const pose = reducedMotion
                    ? viewer.openTo
                    : lerpPose(viewer.from, viewer.openTo, amount);
                if (reducedMotion) activeFlyer.root.style.opacity = String(amount);
                placeOverlay(pose, viewer.layout);
                syncLargeFade(now);
                if (raw >= 1) {
                    viewer.frameOpacity = 1;
                    activeFlyer.root.style.opacity = '1';
                    if (viewer.needsSlide) {
                        viewer.phase = 'sliding';
                        viewer.slideT0 = now;
                    } else {
                        viewer.phase = 'open';
                        closeBtn.style.willChange = 'auto';
                    }
                }
            } else if (viewer.phase === 'sliding') {
                const raw = Math.min(1, (now - viewer.slideT0) / GALLERY_SLIDE_MS);
                const amount = easeInOut(raw);
                viewer.progress = 1;
                viewer.thumbOpacity = 0;
                viewer.frameOpacity = 1;
                const x = viewer.openTo.x + (viewer.to.x - viewer.openTo.x) * amount;
                placeOverlay({ x, y: viewer.to.y, scale: 1 }, viewer.layout);
                syncLargeFade(now);
                if (raw >= 1) {
                    viewer.phase = 'open';
                    closeBtn.style.willChange = 'auto';
                }
            } else if (viewer.phase === 'open') {
                viewer.thumbOpacity = 0;
                viewer.frameOpacity = 1;
                placeOverlay(viewer.to, viewer.layout);
                syncLargeFade(now);
            } else if (viewer.phase === 'closing') {
                const raw = Math.min(1, (now - viewer.closeT0) / closeDuration);
                const amount = easeClose(raw);
                viewer.progress = 1 - raw;
                viewer.thumbOpacity = viewer.closeExitRight ? 0 : 0.001;
                viewer.frameOpacity = reducedMotion ? 1 - amount : frameOpacityFor('closing', amount);
                viewer.closeDone = raw >= 1;
                if (GALLERY_PANEL_ENABLED && !panel.hidden) {
                    const fade = Math.min(1, (now - viewer.closeT0) / Math.max(1, GALLERY_TEXT_OUT_MS));
                    panel.style.opacity = String(1 - fade);
                }
                if (!viewer.closeExitRight) {
                    const next = closeTargetFor(
                        viewer.slot,
                        viewer.layout,
                        viewer.tileGone,
                        viewer.homeThumbWidth,
                        viewer.shownKey,
                        viewer.homeRow
                    );
                    if (next.exitRight) {
                        viewer.closeFrom = startPoseFor(viewer.pose, next.pose, amount);
                        viewer.closeExitRight = true;
                    }
                    viewer.closeTo = next.pose;
                }
                const live = viewer.closeTo;
                const pose = viewer.closeDone
                    ? live
                    : (reducedMotion ? viewer.closeFrom : lerpPose(viewer.closeFrom, live, amount));
                if (reducedMotion) activeFlyer.root.style.opacity = String(1 - amount);
                if (!viewer.handedOff) placeOverlay(pose, viewer.layout);
            }

            advanceDepartures(now);

            if (!viewer) return;
            if (viewer.phase !== 'closing') {
                syncCloseButton();
                syncCaption();
                syncPanel();
            }

            if (viewer.phase === 'closing' && viewer.closeDone) {
                if (!viewer.handedOff) {
                    if (!viewer.closeExitRight) {
                        handoffHomeTile();
                    } else {
                        if (activeFlyer?.root) {
                            activeFlyer.root.hidden = true;
                            activeFlyer.root.style.willChange = 'auto';
                        }
                        viewer.handedOff = true;
                        markCloseProbeHandoff(now);
                    }
                }
                if (viewer.departures.length === 0 && !viewer.finishScheduled) {
                    viewer.finishScheduled = true;
                    postCloseFrame = requestAnimationFrame(() => {
                        postCloseFrame = 0;
                        finishViewer();
                    });
                }
            }
        };

        const openViewer = (slot) => {
            const spec = slot && displayedSpec(slot);
            if (viewer || !spec) return;

            const now = performance.now();
            beginRowSyncProbe();
            lockScroll();
            cacheStreamOrigin();
            const layout = layoutViewer(spec, slot);
            const from = poseFromThumb(liveThumb(slot), layout);
            const to = { x: layout.endLeft, y: layout.endTop, scale: 1 };
            const opening = openTargetFor(layout);

            activeFlyer = homeFlyer;
            viewer = {
                slot,
                spec,
                shownKey: photoKey(spec),
                phase: 'opening',
                t0: now,
                duration: transitionMs,
                from,
                to,
                openTo: opening.pose,
                needsSlide: opening.slide,
                slideT0: 0,
                pose: from,
                layout,
                hiddenRows: hiddenRowsFor(layout),
                tileGone: false,
                closeExitRight: false,
                homeThumbWidth: slot.width,
                homeRow: slot.row,
                rowMotion: 'in',
                rowT0: now,
                rowAmount: 0,
                thumbOpacity: 0,
                frameOpacity: 0,
                progress: 0,
                closeFrom: null,
                closeT0: 0,
                closeDuration: transitionMs,
                closeDone: false,
                departures: [],
                largeReady: false,
                largeOpacity: 0,
                largeFadeStart: 0,
                largeFromStart: false,
                settled: false,
                largeShown: false,
            };

            abortOtherLarges(spec.srcFull);
            const cachedLarge = getCachedLarge(spec);
            viewer.largeReady = !!cachedLarge;
            viewer.largeFromStart = !!cachedLarge;
            viewer.largeOpacity = cachedLarge ? 1 : 0;
            viewer.largeShown = !!cachedLarge;
            configureFlyer(activeFlyer, layout, spec);
            if (reducedMotion) activeFlyer.root.style.opacity = '0';
            placeOverlay(reducedMotion ? to : from, layout);
            caption.style.opacity = '0';
            setCaptionText(spec);
            placeCaption(layout);
            hidePanelInstantly();
            setPanelText(spec);
            placePanel(layout);
            clipOverlayToHeader();
            overlay.hidden = false;
            overlay.style.pointerEvents = '';
            closeBtn.hidden = false;
            closeBtn.style.opacity = '0';
            closeBtn.style.willChange = 'transform, opacity';
            if (hoverSlot) {
                hoverSlot.el.classList.remove('is-hovered');
                hoverSlot = null;
            }
            paint(slot);
            applyRows(0);
            play();
            if (cachedLarge) {
                loadLarge(spec, { priority: 'high', reason: 'open' });
            } else {
                armLarge(activeFlyer, spec);
            }
            closeBtn.focus({ preventScroll: true });
        };

        const isFramingRow = (rowIndex) => rowStaysVisible(rowIndex);

        const switchTo = (slot) => {
            if (!viewer || viewer.phase === 'closing') return;
            if (slot === viewer.slot && !viewer.tileGone) return;
            if (!isFramingRow(slot.row)) return;

            const now = performance.now();
            const existing = viewer.departures.findIndex((item) => item.slot === slot);
            let node;
            let from;
            let layout;
            let spec;

            if (existing >= 0) {
                const dep = viewer.departures.splice(existing, 1)[0];
                node = dep.flyer;
                from = dep.pose;
                layout = dep.layout;
                spec = dep.spec;
            } else {
                spec = displayedSpec(slot);
                if (!spec) return;
                layout = layoutViewer(spec, slot);
                node = trackFlyer(makeFlyer());
                from = poseFromThumb(liveThumb(slot), layout);
                configureFlyer(node, layout, spec);
            }

            activeFlyer.root.style.willChange = 'transform';
            viewer.departures.push({
                slot: viewer.slot,
                spec: viewer.spec,
                shownKey: viewer.shownKey,
                flyer: activeFlyer,
                layout: viewer.layout,
                from: viewer.pose,
                pose: viewer.pose,
                t0: now,
                thumbOpacity: 0,
                frameOpacity: viewer.frameOpacity || 1,
                tileGone: !!viewer.tileGone,
                closeExitRight: false,
                homeThumbWidth: viewer.homeThumbWidth,
                homeRow: viewer.homeRow,
            });
            activeFlyer = node;
            node.root.style.willChange = 'transform';
            document.body.append(node.root);

            viewer.slot = slot;
            viewer.spec = spec;
            viewer.shownKey = photoKey(spec);
            viewer.tileGone = false;
            viewer.closeExitRight = false;
            viewer.homeThumbWidth = slot.width;
            viewer.homeRow = slot.row;
            viewer.phase = 'switching';
            viewer.t0 = now;
            viewer.from = from;
            viewer.to = { x: layout.endLeft, y: layout.endTop, scale: 1 };
            const switchOpening = openTargetFor(layout);
            viewer.openTo = switchOpening.pose;
            viewer.needsSlide = switchOpening.slide;
            viewer.slideT0 = 0;
            viewer.pose = from;
            viewer.layout = layout;
            viewer.hiddenRows = hiddenRowsFor(layout);
            applyRows(viewer.rowAmount || 1);
            viewer.thumbOpacity = 0;
            viewer.frameOpacity = 0;
            viewer.progress = 0;
            viewer.settled = false;
            const switchedLarge = getCachedLarge(spec) || (node.large.getAttribute('src') ? { src: node.large.src } : null);
            const switchedOpacity = Number(node.large.style.opacity) || 0;
            viewer.largeReady = !!switchedLarge;
            viewer.largeFromStart = !!switchedLarge && switchedOpacity >= 1;
            viewer.largeOpacity = switchedLarge ? switchedOpacity : 0;
            viewer.largeFadeStart = viewer.largeFromStart
                ? 0
                : switchedLarge && switchedOpacity > 0
                  ? now - switchedOpacity * LARGE_CROSSFADE_MS
                  : 0;
            viewer.largeShown = viewer.largeFromStart;
            if (switchedLarge) attachLargeToFlyer(node, switchedLarge);
            placeOverlay(from, layout);
            caption.style.opacity = '0';
            setCaptionText(spec);
            placeCaption(layout);
            hidePanelInstantly();
            setPanelText(spec);
            placePanel(layout);
            node.root.hidden = false;
            sizeFlyer(node, layout);
            if (!viewer.largeReady) armLarge(node, spec);
            else loadLarge(spec, { priority: 'high', reason: 'open' });
            paint(slot);
            play();
        };

        const closeViewer = () => {
            if (!viewer || viewer.phase === 'closing') return;
            const now = performance.now();
            const duration = Math.max(1, viewer.duration);
            viewer.phase = 'closing';
            viewer.settled = false;
            viewer.rowMotion = 'out';
            viewer.rowT0 = now;
            viewer.closeFrom = viewer.pose;
            viewer.closeT0 = now;
            viewer.closeDuration = duration;
            const closingTo = closeTargetFor(
                viewer.slot,
                viewer.layout,
                viewer.tileGone,
                viewer.homeThumbWidth,
                viewer.shownKey,
                viewer.homeRow
            );
            viewer.closeExitRight = closingTo.exitRight;
            viewer.closeTo = closingTo.pose;
            viewer.closeDone = false;
            viewer.handedOff = false;
            viewer.thumbOpacity = closingTo.exitRight ? 0 : 0.001;
            if (!closingTo.exitRight) prepareHomeTile(viewer.slot);
            startCloseProbe(viewer.slot);
            caption.style.opacity = '0';
            // Freeze the sweep where it is; opacity is driven on the same rAF
            // as the shrink so the CSS panel transition cannot fight it.
            stopPanelRevealLoop();
            panelShown = false;
            panel.classList.add('is-leaving');
            panel.style.transition = 'none';
            panel.style.pointerEvents = 'none';
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
            activeFlyer.root.style.willChange = 'transform, opacity';
            closeBtn.style.willChange = 'opacity';
            play();
        };

        const activateSlot = (slot) => {
            if (!slot?.spec) return;
            if (!viewer) {
                openViewer(slot);
                return;
            }
            if (viewer.phase === 'closing' || !isFramingRow(slot.row)) return;
            if (slot === viewer.slot && !viewer.tileGone) return;
            switchTo(slot);
        };

        const bindItem = (slot) => {
            const el = slot.el;
            el.className = 'stream-item';
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', 'Open image');
            el.addEventListener('pointerdown', (event) => {
                scheduleLarge(slot.spec, 'pointerdown');
                if (event.pointerType === 'touch') {
                    slot.tapX = event.clientX;
                    slot.tapY = event.clientY;
                }
            });
            el.addEventListener('touchstart', () => {
                scheduleLarge(slot.spec, 'pointerdown');
            }, { passive: true });
            el.addEventListener('pointerup', (event) => {
                if (event.pointerType !== 'touch') return;
                const dx = Math.abs(event.clientX - slot.tapX);
                const dy = Math.abs(event.clientY - slot.tapY);
                if (dx > 12 || dy > 12) return;
                slot.openedFromTap = true;
                activateSlot(slot);
            });
            if (fineHover) {
                el.addEventListener('mouseenter', () => {
                    slot.hoverTimer = window.setTimeout(() => {
                        scheduleLarge(slot.spec, 'hover');
                    }, LARGE_HOVER_DELAY_MS);
                });
                el.addEventListener('mouseleave', () => {
                    if (slot.hoverTimer) {
                        window.clearTimeout(slot.hoverTimer);
                        slot.hoverTimer = 0;
                    }
                });
            }
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                if (slot.openedFromTap) {
                    slot.openedFromTap = false;
                    return;
                }
                activateSlot(slot);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateSlot(slot);
                }
            });
        };

        const slotIsLive = (slot) =>
            !!(
                slot
                && slot.el
                && rows[slot.row]
                && slot.el.parentNode === rows[slot.row]
            );

        const purgeDeadSlots = (rowIndex) => {
            for (let i = pool.length - 1; i >= 0; i -= 1) {
                const slot = pool[i];
                if (rowIndex != null && slot.row !== rowIndex) continue;
                if (slotIsLive(slot)) continue;
                releaseReserved(slot.spec);
                pool.splice(i, 1);
            }
        };

        const populateRow = (rowIndex, specs, mode) => {
            const rowEl = rows[rowIndex];
            if (!rowEl) return;
            return runAsWriter('populateRow', () => {
            purgeDeadSlots(rowIndex);
            rowEl.replaceChildren();
            purgeDeadSlots(rowIndex);

            const slots = specs.map((spec, i) => {
                const el = document.createElement('div');
                rowEl.appendChild(el);
                const slot = {
                    id: rowIndex * 1000 + i,
                    el,
                    row: rowIndex,
                    x: 0,
                    width: itemHeight,
                    aspectRatio: 1,
                    speed: 0,
                    scale: 1,
                    frozen: holdMotion,
                    swayPhase: hash01(rowIndex * 50 + i) * Math.PI * 2,
                };
                bindItem(slot);
                applyVisuals(slot, spec);
                slot.speed = speedFor(slot.id);
                applyDepth(slot);
                return slot;
            });

            if (mode === 'enter-left') {
                let edge = 0;
                slots.forEach((slot) => {
                    slot.x = edge - slot.width;
                    edge = slot.x - ITEM_GAP_PX;
                    paint(slot);
                    pool.push(slot);
                    markShown(slot.spec);
                    releaseReserved(slot.spec);
                });
                return;
            }

            const typicalStride = itemHeight * avgAspect() + ITEM_GAP_PX;
            const stagger = -((rowIndex * 0.41 * typicalStride) % typicalStride);
            const elapsed = (performance.now() - pageStartedAt) / 1000;
            const phase = typicalStride > 0 ? (baseSpeed * elapsed) % typicalStride : 0;
            let cursorX = stagger - typicalStride + phase;
            slots.forEach((slot) => {
                slot.x = cursorX;
                cursorX += slot.width + ITEM_GAP_PX;
                paint(slot);
                pool.push(slot);
                markShown(slot.spec);
                releaseReserved(slot.spec);
            });
            });
        };

        const packRow = (rowIndex, fromRight) => {
            if (layoutWritesQuiet() || rowLayoutQuiet(rowIndex)) return;
            runAsWriter('packRow', () => {
                const mine = pool
                    .filter((slot) => slot.row === rowIndex && slotIsLive(slot))
                    .sort((a, b) => a.x - b.x);
                const packFromRight = fromRight === undefined ? introEntering.has(rowIndex) : fromRight;
                if (packFromRight) {
                    for (let i = mine.length - 2; i >= 0; i -= 1) {
                        mine[i].x = mine[i + 1].x - mine[i].width - ITEM_GAP_PX;
                        paint(mine[i]);
                    }
                    return;
                }
                for (let i = 1; i < mine.length; i += 1) {
                    mine[i].x = mine[i - 1].x + mine[i - 1].width + ITEM_GAP_PX;
                    paint(mine[i]);
                }
            });
        };

        const rowNeedsCoverage = (rowIndex, mode) => {
            const mine = pool
                .filter((slot) => slot.row === rowIndex && slotIsLive(slot))
                .sort((a, b) => a.x - b.x);
            if (!mine.length) return true;
            let left = mine[0];
            let right = mine[mine.length - 1];
            const needed = viewportWidth + left.width + right.width;
            const span = right.x + right.width - left.x;
            if (span < needed) return true;
            if (mode === 'enter-left') return false;
            return left.x > -left.width || right.x + right.width < viewportWidth + right.width;
        };

        const isRealGap = (gap, widthA, widthB) => {
            const tile = Math.min(
                widthA > 0 ? widthA : itemHeight,
                widthB > 0 ? widthB : itemHeight
            );
            return gap > ITEM_GAP_PX + tile * 0.5;
        };

        const appendSlotToRow = (rowIndex, spec, side) => {
            const rowEl = rows[rowIndex];
            if (!rowEl || !spec) return null;
            const index = pool.filter((slot) => slot.row === rowIndex).length;
            const el = document.createElement('div');
            rowEl.appendChild(el);
            const slot = {
                id: rowIndex * 1000 + index,
                el,
                row: rowIndex,
                x: 0,
                width: itemHeight,
                aspectRatio: 1,
                speed: 0,
                scale: 1,
                frozen: holdMotion,
                swayPhase: hash01(rowIndex * 50 + index) * Math.PI * 2,
            };
            bindItem(slot);
            applyVisuals(slot, spec);
            slot.speed = speedFor(slot.id);
            applyDepth(slot);
            const mine = pool.filter((entry) => entry.row === rowIndex && slotIsLive(entry));
            if (side === 'left') {
                const left = mine.reduce((best, entry) => (!best || entry.x < best.x ? entry : best), null);
                slot.x = left ? left.x - slot.width - ITEM_GAP_PX : -slot.width;
            } else {
                const right = mine.reduce(
                    (best, entry) =>
                        !best || entry.x + entry.width > best.x + best.width ? entry : best,
                    null
                );
                slot.x = right ? right.x + right.width + ITEM_GAP_PX : 0;
            }
            paint(slot);
            pool.push(slot);
            releaseReserved(slot.spec);
            return slot;
        };

        const insertSlotAt = (rowIndex, spec, x) => {
            const slot = appendSlotToRow(rowIndex, spec, 'right');
            if (!slot) return null;
            slot.x = x;
            paint(slot);
            return slot;
        };

        const shiftSlotsFrom = (rowIndex, minX, delta) => {
            if (!delta || layoutWritesQuiet() || rowLayoutQuiet(rowIndex)) return;
            runAsWriter('shiftSlotsFrom', () => {
                pool.forEach((slot) => {
                    if (slot.row !== rowIndex || !slotIsLive(slot)) return;
                    if (slot.x < minX - 0.5) return;
                    slot.x += delta;
                    paint(slot);
                });
            });
        };

        const fillRealGap = (rowIndex, leftX, rightX, leftWidth, rightWidth, grow) => {
            if (layoutWritesQuiet() || rowLayoutQuiet(rowIndex)) return 0;
            let added = 0;
            let left = leftX;
            let right = rightX;
            for (let n = 0; n < 80; n += 1) {
                if (!isRealGap(right - left, leftWidth, rightWidth)) return added;
                const spec = dealUniqueSpec();
                const width = spec
                    ? itemHeight * (spec.aspectRatio || aspectFor(spec) || 1)
                    : 0;
                const x = grow === 'left'
                    ? right - ITEM_GAP_PX - width
                    : left + ITEM_GAP_PX;
                const fits = spec && (
                    grow === 'left'
                        ? x >= left + ITEM_GAP_PX - 0.5
                        : x + width + ITEM_GAP_PX <= right + 0.5
                );
                if (!fits) {
                    if (spec) releaseReserved(spec);
                    if (grow !== 'left') {
                        const close = right - left - ITEM_GAP_PX;
                        if (close > 0.5) shiftSlotsFrom(rowIndex, right, -close);
                    }
                    return added;
                }
                const slot = insertSlotAt(rowIndex, spec, x);
                if (!slot) return added;
                if (!slotHasLoadedPhoto(slot)) {
                    decodeOntoSlot(slot, libraryByKey.get(photoKey(spec)) || spec);
                }
                if (grow === 'left') {
                    right = slot.x;
                    rightWidth = slot.width;
                } else {
                    left = slot.x + slot.width;
                    leftWidth = slot.width;
                }
                added += 1;
            }
            return added;
        };

        const fillRowToCover = async (rowIndex, mode) => {
            if (rowLayoutQuiet(rowIndex)) return;
            purgeDeadSlots(rowIndex);
            for (let n = 0; n < 80 && rowNeedsCoverage(rowIndex, mode); n += 1) {
                const spec = dealUniqueSpec();
                if (!spec) break;
                const mine = pool.filter((slot) => slot.row === rowIndex);
                const maxX = mine.length ? Math.max(...mine.map((slot) => slot.x + slot.width)) : 0;
                const minX = mine.length ? Math.min(...mine.map((slot) => slot.x)) : 0;
                const side =
                    mode === 'enter-left' || (maxX >= viewportWidth + itemHeight && minX > -itemHeight)
                        ? 'left'
                        : 'right';
                const slot = appendSlotToRow(rowIndex, spec, side);
                if (slot && !slotHasLoadedPhoto(slot)) {
                    decodeOntoSlot(slot, libraryByKey.get(photoKey(spec)) || spec);
                }
            }
        };

        const assignRowPhotos = (rowIndex) => {
            if (rowAssignments.has(rowIndex)) return rowAssignments.get(rowIndex);
            const raws = [];
            const count = photosPerRow();
            const used = new Set();
            for (let i = 0; i < count; i += 1) {
                const raw = dealRaw();
                const key = photoKey(raw);
                if (!raw || !key || used.has(key)) continue;
                used.add(key);
                raws.push(raw);
            }
            rowAssignments.set(rowIndex, raws);
            return raws;
        };

        let bootPromises = null;
        let holdMotion = false;
        const startRow = (rowIndex, mode) => {
            const rowEl = rows[rowIndex];
            if (cancelled || !rowEl) return Promise.resolve();
            if (layoutWritesQuiet()) {
                window.setTimeout(() => {
                    if (cancelled) return;
                    if (startedRows.has(rowIndex) && pool.some((slot) => slot.row === rowIndex && slotIsLive(slot))) {
                        return;
                    }
                    startRow(rowIndex, mode);
                }, layoutHeld ? 500 : 200);
                return Promise.resolve();
            }
            rowEpoch[rowIndex] = (rowEpoch[rowIndex] || 0) + 1;
            const epoch = rowEpoch[rowIndex];
            startedRows.add(rowIndex);
            rowPending.add(rowIndex);
            introPlan.delete(rowIndex);
            const raws = assignRowPhotos(rowIndex);
            const stillHere = () =>
                !cancelled
                && rowEpoch[rowIndex] === epoch
                && rows[rowIndex] === rowEl
                && rowEl.isConnected;
            const abortStart = () => {
                raws.forEach(releaseReserved);
                if (rowEpoch[rowIndex] !== epoch) return;
                startedRows.delete(rowIndex);
                rowPending.delete(rowIndex);
                introEntering.delete(rowIndex);
            };
            const job = (async () => {
                const decoded = await mapWithConcurrency(raws, DECODE_CONCURRENCY, decodeSmall);
                if (!stillHere()) {
                    abortStart();
                    return;
                }
                const specs = [];
                const used = new Set();
                (decoded || []).forEach((spec) => {
                    const key = photoKey(spec);
                    if (!key || used.has(key)) return;
                    used.add(key);
                    specs.push(spec);
                });
                while (specs.length < raws.length) {
                    const extra = dealUniqueSpec();
                    if (!extra) break;
                    specs.push(extra);
                }
                if (!stillHere()) {
                    abortStart();
                    return;
                }
                if (mode === 'enter-left') {
                    introEntering.add(rowIndex);
                    markIntroPlayed();
                }
                if (mode !== 'enter-left') rowEl.style.visibility = 'hidden';
                populateRow(rowIndex, specs, mode);
                await fillRowToCover(rowIndex, mode);
                packRow(rowIndex, mode === 'enter-left');
                if (!stillHere()) {
                    abortStart();
                    return;
                }
                pool.forEach((slot) => {
                    if (slot.row !== rowIndex || slotHasLoadedPhoto(slot)) return;
                    decodeOntoSlot(slot, libraryByKey.get(photoKey(slot.spec)) || slot.spec);
                });
                const mine = pool.filter((slot) => slot.row === rowIndex);
                if (holdMotion) {
                    mine.forEach((slot) => {
                        slot.frozen = true;
                    });
                }
                if (!stillHere()) {
                    abortStart();
                    return;
                }
                if (!holdMotion) {
                    mine.forEach((slot) => {
                        slot.frozen = false;
                        paint(slot);
                    });
                }
                rowEl.style.visibility = '';
                scheduleUpcoming();
                syncPlayback();
            })();
            job.finally(() => {
                if (rowEpoch[rowIndex] === epoch) rowPending.delete(rowIndex);
            });
            if (bootPromises) bootPromises.push({ index: rowIndex, job });
            return job;
        };

        const introPlan = new Set();
        let introNextAt = INTRO_FIRST_DELAY_SECONDS;

        const rowIsEnteringFromLeft = (rowIndex) => {
            if (!introEntering.has(rowIndex)) return false;
            const mine = pool.filter((slot) => slot.row === rowIndex);
            if (!mine.length) return true;
            const maxX = Math.max(...mine.map((slot) => slot.x + slot.width));
            if (maxX >= viewportWidth) {
                introEntering.delete(rowIndex);
                return false;
            }
            return true;
        };

        const placeRow = (index) => {
            const rowEl = rows[index];
            if (!rowEl) return;
            rowEl.style.top = `${index * stridePx()}px`;
            rowEl.style.height = `${itemHeight}px`;
        };

        const acquireRow = () => {
            const rowEl = spareRows.pop() || document.createElement('div');
            rowEl.className = 'floating-streams-row';
            return rowEl;
        };

        const releaseRow = (rowEl) => {
            rowEl.replaceChildren();
            rowEl.remove();
            rowEl.removeAttribute('style');
            rowEl.removeAttribute('data-row-index');
            rowEl.removeAttribute('data-blocked');
            rowEl.removeAttribute('data-opacity');
            rowEl.className = 'floating-streams-row';
            spareRows.push(rowEl);
        };

        const removeRow = (index) => {
            const rowEl = rows[index];
            if (!rowEl) return;
            if (viewer && viewer.slot && viewer.slot.row === index) return;
            for (let i = pool.length - 1; i >= 0; i -= 1) {
                if (pool[i].row !== index) continue;
                if (pool[i] === hoverSlot) hoverSlot = null;
                releaseReserved(pool[i].spec);
                pool.splice(i, 1);
            }
            releaseRow(rowEl);
            rows[index] = null;
            rowEpoch[index] = (rowEpoch[index] || 0) + 1;
            startedRows.delete(index);
            rowPending.delete(index);
            introPlan.delete(index);
            introEntering.delete(index);
            const assigned = rowAssignments.get(index);
            if (assigned) assigned.forEach(releaseReserved);
            rowAssignments.delete(index);
        };

        const ensureRow = (index) => {
            assignRowPhotos(index);
            if (!rows[index]) {
                const rowEl = acquireRow();
                rowEl.dataset.rowIndex = String(index);
                section.appendChild(rowEl);
                rows[index] = rowEl;
                rowPose[index] = { ty: 0, scale: 1 };
            }
            placeRow(index);
            const live = pool.some((slot) => slot.row === index && slotIsLive(slot));
            if (startedRows.has(index) && live) return;
            if (rowPending.has(index)) return;
            if (introPlan.has(index) && pageScroll() < 8) return;
            if (introPlan.has(index)) introPlan.delete(index);
            startRow(index, 'filled');
        };

        const growSection = (throughIndex) => {
            const needed = throughIndex + 1;
            if (needed <= allocatedRows) return;
            allocatedRows = Math.ceil(needed / HEIGHT_CHUNK_ROWS) * HEIGHT_CHUNK_ROWS;
            section.style.height = `${allocatedRows * stridePx()}px`;
        };

        let mountedKey = '';
        const mountRange = () => {
            if (layoutWritesQuiet()) return;
            const { first, last } = visibleBounds();
            const buffer = window.innerWidth <= MOBILE_BREAKPOINT_PX ? MOBILE_ROW_BUFFER : ROW_BUFFER;
            const from = Math.max(0, first - buffer);
            const to = last + buffer;
            mountedKey = `${first}:${last}`;
            growSection(to + lookaheadRows());
            for (let index = from; index <= to; index += 1) assignRowPhotos(index);
            pumpSmalls();
            for (let index = from; index <= to; index += 1) {
                ensureRow(index);
            }
            for (let index = 0; index < rows.length; index += 1) {
                if (!rows[index]) continue;
                if (index < from || index > to) removeRow(index);
            }
            const keep = new Set();
            pool.forEach((slot) => {
                const key = photoKey(slot.spec);
                if (key) keep.add(key);
            });
            rowAssignments.forEach((raws) => {
                raws.forEach((item) => {
                    const key = photoKey(item);
                    if (key) keep.add(key);
                });
            });
            [...reserved].forEach((key) => {
                if (!keep.has(key)) reserved.delete(key);
            });
            repairVisibleRows(from, to);
        };

        const introProtect = (index) => introPlan.has(index) && pageScroll() < 8;

        const rowLooksInvisible = (rowEl) => {
            if (!rowEl) return true;
            return (
                rowEl.style.visibility === 'hidden'
                || rowEl.style.opacity === '0'
                || rowEl.dataset.opacity === '0'
            );
        };

        const warnRowRepair = (index, issue, extra) => {
            if (process.env.NODE_ENV === 'production') return;
            console.warn('[clothing] repaired row', {
                row: index,
                issue,
                introWaiting: introPlan.has(index),
                entering: introEntering.has(index),
                started: startedRows.has(index),
                scroll: Math.round(pageScroll()),
                ...extra,
            });
        };

        const repairVisibleRows = (from, to) => {
            if (cancelled || layoutWritesQuiet()) return;
            return runAsWriter('repairVisibleRows', () => {
            if (from == null || to == null) {
                const bounds = visibleBounds();
                const buffer =
                    window.innerWidth <= MOBILE_BREAKPOINT_PX ? MOBILE_ROW_BUFFER : ROW_BUFFER;
                from = Math.max(0, bounds.first - buffer);
                to = bounds.last + buffer;
            }
            purgeDeadSlots();
            if (!holdMotion) {
                pool.forEach((slot) => {
                    if (slot.frozen) slot.frozen = false;
                });
            }
            for (let index = from; index <= to; index += 1) {
                if (rowLayoutQuiet(index)) continue;
                if (introProtect(index)) continue;
                if (!rows[index]) {
                    warnRowRepair(index, 'missing');
                    ensureRow(index);
                    continue;
                }
                const rowEl = rows[index];
                if (!viewer && !rowPending.has(index) && rowLooksInvisible(rowEl)) {
                    warnRowRepair(index, 'invisible', {
                        opacity: rowEl.style.opacity || rowEl.dataset.opacity || '',
                        visibility: rowEl.style.visibility || '',
                    });
                    rowEl.style.opacity = '';
                    rowEl.style.visibility = '';
                    rowEl.removeAttribute('data-opacity');
                    rowEl.removeAttribute('data-blocked');
                    rowEl.style.pointerEvents = '';
                }
                if (introEntering.has(index) && !rowIsEnteringFromLeft(index)) {
                    introEntering.delete(index);
                }
                if (introEntering.has(index)) continue;
                const live = pool
                    .filter((slot) => slot.row === index && slotIsLive(slot))
                    .sort((a, b) => a.x - b.x);
                if (!live.length) {
                    if (rowPending.has(index)) continue;
                    warnRowRepair(index, 'empty', {
                        detached: pool.filter((slot) => slot.row === index).length,
                    });
                    startRow(index, 'filled');
                    continue;
                }
                const first = live[0];
                const last = live[live.length - 1];
                let added = fillRealGap(index, 0, first.x, first.width, first.width, 'left');
                for (let i = 1; i < live.length; i += 1) {
                    const prev = live[i - 1];
                    const next = live[i];
                    added += fillRealGap(
                        index,
                        prev.x + prev.width,
                        next.x,
                        prev.width,
                        next.width,
                        'right'
                    );
                }
                added += fillRealGap(
                    index,
                    last.x + last.width,
                    viewportWidth,
                    last.width,
                    last.width,
                    'right'
                );
                if (added) warnRowRepair(index, 'gap', { added });
            }
            });
        };

        const scheduleIntroRow = (index, at) => {
            if (introPlan.has(index) || startedRows.has(index)) return;
            introPlan.add(index);
            introNextAt = Math.max(introNextAt, at + INTRO_MIN_GAP_SECONDS);
            const delay = Math.max(0, at * 1000 - (performance.now() - pageStartedAt));
            const timer = window.setTimeout(() => {
                if (cancelled || !introPlan.has(index)) return;
                if (!rows[index]) {
                    introPlan.delete(index);
                    return;
                }
                startRow(index, 'enter-left');
            }, delay);
            introTimers.push(timer);
        };

        const outlineFor = (slot) => {
            if (!slot?.spec || !(slot.width > 0)) return 0;
            const border = viewerBorderPx();
            const innerWidth = layoutViewer(slot.spec, slot).inner.width;
            if (!(innerWidth > 0)) return 0;
            return Math.max(1, Math.round((border / innerWidth) * slot.width));
        };

        const slotUnderPointer = () => {
            const stride = stridePx();
            for (let i = pool.length - 1; i >= 0; i -= 1) {
                const slot = pool[i];
                if (!slot.spec || slot.frozen) continue;
                if (!slotHasLoadedPhoto(slot)) continue;
                if (slot.el.style.pointerEvents === 'none') continue;
                if (slot.el.style.opacity === '0' || slot.paintedOpacity === 0) continue;
                if (
                    viewer
                    && !viewer.handedOff
                    && (!rowStaysVisible(slot.row) || (slot === viewer.slot && !viewer.tileGone))
                ) continue;
                const scale = slot.scale || 1;
                const width = slot.width * scale;
                const height = itemHeight * scale;
                const left = viewOriginX + slot.x + (slot.width - width) / 2;
                const top = viewOriginY
                    + slot.row * stride + (itemHeight - height) / 2;
                if (
                    pointerX >= left
                    && pointerX < left + width
                    && pointerY >= top
                    && pointerY < top + height
                ) {
                    return slot;
                }
            }
            return null;
        };

        // The label is a child of the tile, so it rides the tile's transform
        // instead of needing its own work on every frame.
        const ensureLabel = (slot) => {
            if (!slot.labelEl) {
                const label = document.createElement('span');
                label.className = 'stream-label';
                label.setAttribute('aria-hidden', 'true');
                const title = document.createElement('i');
                title.className = 'stream-label-title';
                const year = document.createElement('span');
                year.className = 'stream-label-year';
                label.append(title, year);
                slot.labelEl = label;
                slot.labelTitleEl = title;
                slot.labelYearEl = year;
            }
            if (slot.labelEl.parentNode !== slot.el) slot.el.appendChild(slot.labelEl);
            return slot.labelEl;
        };

        const alignLabel = (slot) => {
            const label = slot.labelEl;
            if (!label || !(slot.labelWidth > 0)) return;
            const pastEdge = slot.x + slot.labelWidth > viewportWidth - LABEL_EDGE_PAD_PX;
            if (slot.labelPastEdge !== pastEdge) {
                slot.labelPastEdge = pastEdge;
                label.classList.toggle('is-label-right', pastEdge);
            }
            // Keep the start of the text on screen for a tile still entering.
            const shift = !pastEdge && slot.x < LABEL_EDGE_PAD_PX
                ? Math.round(LABEL_EDGE_PAD_PX - slot.x)
                : 0;
            if (slot.labelShift === shift) return;
            slot.labelShift = shift;
            label.style.left = shift ? `${shift}px` : '';
            if (slot.labelAbove) {
                slot.labelAbove = false;
                label.classList.remove('is-label-above');
            }
        };

        // Written when the hover starts, so a recycled tile can never show the
        // title of the photo it used to hold.
        const syncLabel = (slot) => {
            const info = photoLabelFor(slot.spec);
            if (!info && !slot.labelEl) return;
            const label = ensureLabel(slot);
            slot.labelTitleEl.textContent = info ? info.title : '';
            slot.labelYearEl.textContent = info && info.year ? `, ${info.year}` : '';
            slot.labelWidth = info ? label.offsetWidth : 0;
            slot.labelHeight = info ? label.offsetHeight : 0;
            slot.labelPastEdge = null;
            slot.labelShift = null;
            slot.labelAbove = null;
            alignLabel(slot);
        };

        const syncHover = (force = false) => {
            if (!fineHover) return;
            if (viewer && viewer.phase !== 'open' && !viewer.handedOff) {
                if (hoverSlot) {
                    hoverSlot.el.classList.remove('is-hovered');
                    hoverSlot = null;
                }
                return;
            }
            if (!force && !pointerInside && !hoverSlot) return;
            const slot = (force || pointerInside) ? slotUnderPointer() : null;
            if (slot === hoverSlot) {
                if (hoverSlot) alignLabel(hoverSlot);
                return;
            }
            if (hoverSlot) hoverSlot.el.classList.remove('is-hovered');
            hoverSlot = slot;
            if (!slot) return;
            slot.el.style.setProperty('--stream-outline', `${outlineFor(slot)}px`);
            syncLabel(slot);
            slot.el.classList.add('is-hovered');
        };

        const onHoverPointerMove = (event) => {
            if (event.pointerType === 'touch') {
                pointerInside = false;
                return;
            }
            pointerX = event.clientX;
            pointerY = event.clientY;
            pointerInside = true;
        };

        const onHoverPointerOut = (event) => {
            if (event.relatedTarget) return;
            pointerInside = false;
        };

        if (fineHover) {
            window.addEventListener('pointermove', onHoverPointerMove, { passive: true });
            window.addEventListener('pointerout', onHoverPointerOut);
        }

        const warnEmptyVisibleTiles = () => {
            const originY = viewOriginY;
            const stride = stridePx();
            const viewTop = 0;
            const viewBottom = viewHeight();
            pool.forEach((slot) => {
                if (slot.frozen || slotIsHeld(slot)) return;
                const top = originY + slot.row * stride;
                const onScreen =
                    slot.x + slot.width > 0 &&
                    slot.x < viewportWidth &&
                    top + itemHeight > viewTop &&
                    top < viewBottom;
                if (!onScreen) return;
                if (slotHasLoadedPhoto(slot) && slot.paintedOpacity !== 0) return;
                if (slot._emptyWarned) return;
                slot._emptyWarned = true;
                console.warn('Visible tile has no loaded photo', {
                    row: slot.row,
                    x: Math.round(slot.x),
                    src: slot.spec && slot.spec.src,
                    hasImg: !!(slot.spec && slot.spec.img),
                    attached: !!(slot.spec && slot.spec.img && slot.spec.img.parentNode === slot.el),
                    opacity: slot.el.style.opacity,
                });
            });
        };

        const tick = (now) => {
            if (!running) return;
            positionWriter = 'tick';
            const dt = lastTime ? Math.min(MAX_FRAME_SECONDS, (now - lastTime) / 1000) : 0;
            lastTime = now;
            const closing = viewer && viewer.phase === 'closing';
            if (!closing) purgeDeadSlots();

            const motionScale = reducedMotion ? REDUCED_MOTION_SPEED_SCALE : 1;
            if (motionScale > 0 && dt > 0) {
                for (let i = 0; i < pool.length; i += 1) {
                    const slot = pool[i];
                    if (slot.frozen) continue;
                    slot.x += slot.speed * motionScale * dt;
                    if (SWAY_SPEED) slot.swayPhase += SWAY_SPEED * dt;
                    if (slot.x > viewportWidth) {
                        if (
                            viewer
                            && viewer.phase === 'closing'
                            && slotIsHeld(slot)
                            && !viewer.closeExitRight
                        ) {
                            paint(slot);
                            continue;
                        }
                        recycle(slot);
                        continue;
                    }
                    if (!closing) ensureReadyBeforeVisible(slot);
                    paint(slot);
                }
            } else if (viewer) {
                paint(viewer.slot);
            }

            advanceViewer(now, dt);
            sampleCloseProbe(now);
            sampleRowSyncProbe(now);
            if (fineHover && (!closing || viewer.handedOff)) syncHover();
            if (!closing && process.env.NODE_ENV !== 'production') {
                warnEmptyVisibleTiles();
                warnOnScreenDuplicates();
            }
            if (!closing && readyPoolCount() < readyPoolMin()) pumpSmalls();

            if (running) rafId = requestAnimationFrame(tick);
        };

        const play = () => {
            if (running) return;
            if (!inView || document.hidden) return;
            if (!pool.length && !viewer) return;
            if (reducedMotion && REDUCED_MOTION_SPEED_SCALE === 0 && !viewer) return;
            running = true;
            lastTime = 0;
            rafId = requestAnimationFrame(tick);
        };

        const pause = () => {
            running = false;
            lastTime = 0;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        };

        const syncPlayback = () => {
            const motionFrozen = reducedMotion && REDUCED_MOTION_SPEED_SCALE === 0;
            if (inView && !document.hidden && (viewer || (pool.length && !motionFrozen))) {
                play();
            } else {
                pause();
            }
        };

        const clearIntroTimers = () => {
            introTimers.forEach((id) => window.clearTimeout(id));
            introTimers.length = 0;
        };

        overlay.addEventListener('click', (event) => {
            if (!viewer) return;
            pointerX = event.clientX;
            pointerY = event.clientY;
            if (viewer.phase === 'open') {
                const slot = slotUnderPointer();
                if (slot && isFramingRow(slot.row) && (slot !== viewer.slot || viewer.tileGone)) {
                    switchTo(slot);
                    return;
                }
            }
            closeViewer();
        });
        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            closeViewer();
        });
        // Acts like the overlay, except while text in it is selected.
        panel.addEventListener('click', () => {
            if (!viewer) return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) return;
            closeViewer();
        });
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeViewer();
        };
        document.addEventListener('keydown', onKeyDown);

        applyLayoutMetrics();

        const playIntro = !reducedMotion && !hasPlayedIntro();
        const onScreenIndexes = () => {
            const { first, last } = visibleBounds();
            const indexes = [];
            for (let index = first; index <= last; index += 1) indexes.push(index);
            return indexes;
        };

        if (playIntro) {
            const introIndexes = onScreenIndexes();
            const schedule = introStartTimes(introIndexes);
            schedule.forEach(({ index }) => assignRowPhotos(index));
            const decodeOrder = schedule.flatMap(({ index }) => rowAssignments.get(index) || []);
            mapWithConcurrency(decodeOrder, DECODE_CONCURRENCY, decodeSmall);
            schedule.forEach((item) => scheduleIntroRow(item.index, item.at));
            introNextAt =
                (schedule[schedule.length - 1]?.at || INTRO_FIRST_DELAY_SECONDS) +
                INTRO_MIN_GAP_SECONDS;
            mountRange();
        } else {
            section.style.visibility = 'hidden';
            holdMotion = true;
            bootPromises = [];
            mountRange();
            const pending = bootPromises || [];
            bootPromises = null;
            const visible = new Set(onScreenIndexes());
            const visibleJobs = pending
                .filter((entry) => visible.has(entry.index))
                .map((entry) => entry.job);
            Promise.all(visibleJobs.length ? visibleJobs : pending.map((entry) => entry.job)).then(
                () => {
                    if (cancelled) return;
                    holdMotion = false;
                    pool.forEach((slot) => {
                        slot.frozen = false;
                        paint(slot);
                    });
                    section.style.visibility = '';
                    syncPlayback();
                }
            );
        }

        const intersection = new IntersectionObserver(
            ([entry]) => {
                inView = entry.isIntersecting;
                syncPlayback();
            },
            { threshold: 0 }
        );
        intersection.observe(section);

        const onVisibility = () => syncPlayback();
        document.addEventListener('visibilitychange', onVisibility);

        let scrollFrame = 0;
        const onScroll = () => {
            if (suppressScroll || scrollLockY != null || pageIsZoomed()) return;
            if (layoutWritesQuiet()) return;
            if (viewer && viewer.phase === 'closing') return;
            const y = pageScroll();
            const t = performance.now();
            if (lastScrollT) {
                scrollSpeed = (Math.abs(y - lastScrollY) / Math.max(1, t - lastScrollT)) * 1000;
            }
            lastScrollY = y;
            lastScrollT = t;
            if (scrollFrame) return;
            scrollFrame = requestAnimationFrame(() => {
                scrollFrame = 0;
                if (cancelled || suppressScroll || scrollLockY != null) return;
                if (layoutWritesQuiet()) return;
                if (viewer && viewer.phase === 'closing') return;
                pumpSmalls();
                const { first, last } = visibleBounds();
                if (`${first}:${last}` !== mountedKey) mountRange();
                else repairVisibleRows();
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        let resizeFrame = 0;
        const onResize = () => {
            if (pageIsZoomed()) return;
            if (layoutWritesQuiet()) return;
            if (resizeFrame) return;
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                if (cancelled || pageIsZoomed() || layoutWritesQuiet()) return;
                if (viewer && viewer.phase === 'closing') return;
                runAsWriter('resize', () => {
                const previousHeight = itemHeight;
                applyLayoutMetrics();
                allocatedRows = 0;
                const scale = previousHeight > 0 ? itemHeight / previousHeight : 1;
                if (Math.abs(scale - 1) > 0.001) {
                    pool.forEach((slot) => {
                        slot.x *= scale;
                        slot.width *= scale;
                        slot.speed = speedFor(slot.id);
                        slot.el.style.width = `${slot.width}px`;
                        slot.el.style.height = `${itemHeight}px`;
                        paint(slot);
                    });
                } else {
                    pool.forEach((slot) => {
                        slot.speed = speedFor(slot.id);
                    });
                }
                const rowIndexes = [...new Set(pool.map((slot) => slot.row))];
                const entering = new Set(
                    rowIndexes.filter((index) => rowIsEnteringFromLeft(index))
                );
                rowIndexes.forEach((index) => packRow(index, entering.has(index)));
                rowIndexes.forEach((index) =>
                    fillRowToCover(index, entering.has(index) ? 'enter-left' : 'filled')
                );
                mountRange();
                if (viewer) {
                    clipOverlayToHeader();
                    viewer.layout = layoutViewer(viewer.spec, viewer.slot);
                    viewer.hiddenRows = hiddenRowsFor(viewer.layout);
                    viewer.to = { x: viewer.layout.endLeft, y: viewer.layout.endTop, scale: 1 };
                    const resized = openTargetFor(viewer.layout);
                    viewer.openTo = resized.pose;
                    if (viewer.phase !== 'sliding') viewer.needsSlide = resized.slide;
                    if (activeFlyer) sizeFlyer(activeFlyer, viewer.layout);
                    placeCaption(viewer.layout);
                    placePanel(viewer.layout);
                    applyRows(viewer.rowMotion === 'hold' ? 1 : (viewer.rowAmount || 0));
                    viewer.settled = false;
                }
                if (fineHover && hoverSlot) {
                    hoverSlot.el.style.setProperty('--stream-outline', `${outlineFor(hoverSlot)}px`);
                    syncLabel(hoverSlot);
                }
                syncPlayback();
                });
            });
        };
        window.addEventListener('resize', onResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onResize);
            window.visualViewport.addEventListener('scroll', onScroll);
        }

        const repairTimer = window.setInterval(() => {
            if (cancelled || suppressScroll || scrollLockY != null) return;
            if (viewer || layoutWritesQuiet()) return;
            repairVisibleRows();
        }, 500);

        return () => {
            cancelled = true;
            window.clearInterval(repairTimer);
            clearIntroTimers();
            pause();
            intersection.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', onResize);
                window.visualViewport.removeEventListener('scroll', onScroll);
            }
            if (fineHover) {
                window.removeEventListener('pointermove', onHoverPointerMove);
                window.removeEventListener('pointerout', onHoverPointerOut);
            }
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            if (scrollFrame) cancelAnimationFrame(scrollFrame);
            if (postCloseFrame) cancelAnimationFrame(postCloseFrame);
            unlockScroll();
            section.replaceChildren();
            if (menuEl) {
                menuEl.style.opacity = '';
                menuEl.style.pointerEvents = '';
            }
            overlay.remove();
            flyers.forEach((node) => node.root.remove());
            closeBtn.remove();
            caption.remove();
            clearPanelReveal();
            panel.remove();
            pool.forEach((slot) => slot.el.remove());
            decodedSpecs.forEach((spec) => {
                if (spec?.objectUrl) URL.revokeObjectURL(spec.objectUrl);
            });
            decodedSpecs.clear();
            largeInflight.forEach((load) => load.controller.abort());
            largeInflight.clear();
            largeDecoded.forEach((loaded) => {
                if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
            });
            largeDecoded.clear();
            largeDecodedOrder.length = 0;
        };
    }, []);

    return (
        <div className="clothing-container bg-level-3">
            <div className="header-container">
                <div className="header-nav">
                    <button className="header-button" onClick={() => navigate('/store')}>
                        Store
                    </button>
                    <button className="header-button" onClick={() => navigate('/portfolio')}>
                        Portfolio
                    </button>
                </div>
                <span className="header-logo" onClick={() => navigate('/')}>
                    Return Home
                </span>
            </div>

            <section
                ref={sectionRef}
                className="floating-streams"
                aria-label="Floating image streams"
            />
        </div>
    );
}

export default Clothing; 
