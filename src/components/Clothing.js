import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Clothing.css';
import photoManifest from '../data/photo-manifest.json';
import photoInfo from '../data/photo-info.json';
import { createTextReveal, setMarkedText } from '../utils/textReveal';
import { buildPhotoSearchIndex, searchPhotos } from '../utils/photoSearch';
import searchGlass from '../assets/searchglass.png';

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
// Italic glyphs draw past the layout width. This keeps that ink inside the
// panel, in the gap before the frame, without changing the text box.
const PANEL_INK_PAD_PX = 8;
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
const DECODE_CONCURRENCY = 6;
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
const SEARCH_WIPE_MS = 720;
const SEARCH_FADE_MS = 250;

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
// 4, 47, 50, 78, 110 and 126 are held out on purpose.
const EXCLUDED_PHOTOS = [4, 47, 50, 78, 110, 126];
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

function photoHasDescription(spec) {
    const info = photoLabelFor(spec);
    return !!(info && String(info.description || '').trim());
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

// Phone search frames use the opened viewer's border / photo width at
// 1440×900. Header min-height is 70px and the menu ends a little lower;
// the first gallery row then starts HEADER_TO_ROW_GAP_PX under that.
const DESKTOP_VIEWER_W = 1440;
const DESKTOP_VIEWER_H = 900;
const DESKTOP_VIEWER_FIRST_TOP = 92;

function desktopViewerPhotoSize(aspect, hasDesc) {
    const ratio = aspect > 0 ? aspect : 1;
    const border = Math.round(Math.min(
        VIEWER_BORDER_MAX_PX,
        Math.max(VIEWER_BORDER_MIN_PX, DESKTOP_VIEWER_W * 0.025)
    ));
    const itemH = Math.min(
        ITEM_HEIGHT_MAX_PX,
        Math.max(ITEM_HEIGHT_MIN_PX, DESKTOP_VIEWER_W * (ITEM_HEIGHT_VW / 100))
    );
    const fontPx = Math.max(11, Math.min(13, itemH * 0.12));
    const clearance = Math.ceil(fontPx * 1.2) + LABEL_GAP_PX
        + Math.max(6, Math.round(border * 0.3)) + LABEL_BREATH_PX;
    const available = DESKTOP_VIEWER_H - DESKTOP_VIEWER_FIRST_TOP - clearance;
    const n = Math.max(1, Math.floor((available + clearance) / (itemH + clearance)));
    const gap = n <= 1
        ? clearance
        : Math.max(clearance, Math.round((available - n * itemH) / (n - 1)));
    const lastTop = DESKTOP_VIEWER_FIRST_TOP + (n - 1) * (itemH + gap);
    const topGap = Math.max(VIEWER_GAP_PX, clearance);
    const between = (lastTop - VIEWER_GAP_PX) - (DESKTOP_VIEWER_FIRST_TOP + itemH + topGap);
    const room = DESKTOP_VIEWER_H - VIEWER_GAP_PX * 2;
    const maxTotalH = Math.max(80, Math.min(room, between > 40 ? between : room));
    const panelW = Math.max(
        GALLERY_PANEL_MIN_PX,
        Math.min(GALLERY_PANEL_MAX_PX, Math.round(DESKTOP_VIEWER_W * 0.24))
    );
    const sideCost = hasDesc ? panelW + GALLERY_PANEL_GAP_PX : 0;
    const maxTotalW = Math.max(80, DESKTOP_VIEWER_W - VIEWER_GAP_PX * 2 - sideCost);
    const inner = fitInBox(
        ratio,
        Math.max(40, maxTotalW - border * 2),
        Math.max(40, maxTotalH - border * 2)
    );
    return { border, width: inner.width };
}

function frameBorderForWidth(photoWidth, aspect, hasDesc) {
    const desk = desktopViewerPhotoSize(aspect, hasDesc);
    if (!(desk.width > 0) || !(photoWidth > 0)) return 0;
    return Math.max(1, Math.round((desk.border / desk.width) * photoWidth));
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

// Size the frame the way the browser paints the file. naturalWidth already
// includes EXIF orientation in current browsers. A tagged file that is still
// reported at its stored size is swapped, because orientations 5–8 are painted
// on their side.
function displayedJpegSize(meta, naturalWidth, naturalHeight) {
    const oriented = orientedJpegSize(meta);
    const swap = meta.orientation >= 5 && meta.orientation <= 8;
    const reportsStored = swap
        && naturalWidth === meta.width
        && naturalHeight === meta.height
        && (oriented.width !== meta.width || oriented.height !== meta.height);
    if (!reportsStored && naturalWidth > 0 && naturalHeight > 0) {
        return { width: naturalWidth, height: naturalHeight };
    }
    if (oriented.width > 0 && oriented.height > 0) return oriented;
    return { width: naturalWidth || 1, height: naturalHeight || 1 };
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
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    throwIfAborted(signal);
    const loaded = await imgFromBlob(blob, { fetchPriority: priority });
    if (signal?.aborted) {
        if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        throwIfAborted(signal);
    }
    const displayed = displayedJpegSize(
        meta,
        loaded.img.naturalWidth || 0,
        loaded.img.naturalHeight || 0
    );
    if (
        meta.orientation >= 5 &&
        meta.orientation <= 8 &&
        loaded.img.naturalWidth === meta.width &&
        loaded.img.naturalHeight === meta.height
    ) {
        loaded.img.style.imageOrientation = 'from-image';
    }
    const aspectRatio = displayed.width / displayed.height;
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
    const searchBoardRef = useRef(null);

    useEffect(() => {
        const section = sectionRef.current;
        const searchBoard = searchBoardRef.current;
        if (!section || !searchBoard) return undefined;
        section.replaceChildren();
        searchBoard.replaceChildren();
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
        const introSchedule = [];
        let introElapsed = 0;
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
        const spareGallerySlots = [];
        let allocatedRows = 0;
        let smallsInFlight = 0;
        let lastScrollY = 0;
        let lastScrollT = 0;
        let scrollSpeed = 0;
        let scrollDir = 1;
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
        const galleryBands = [];
        const closingBands = [];
        let bandSyncAt = 0;
        const rowShift = (index) => galleryBands.reduce(
            (sum, band) => (band.row < index ? sum + band.height + rowGapPx : sum),
            0
        );

        const overlay = document.createElement('div');
        overlay.className = 'stream-overlay';
        overlay.hidden = true;

        const headerEl = () =>
            section.parentElement
                ? section.parentElement.querySelector('.header-container')
                : null;
        const searchForm = section.parentElement
            ? section.parentElement.querySelector('.stream-search')
            : null;
        const searchInput = searchForm
            ? searchForm.querySelector('.stream-search-input')
            : null;
        const searchClear = searchForm
            ? searchForm.querySelector('.stream-search-clear')
            : null;
        const searchStatus = searchForm
            ? searchForm.querySelector('.stream-search-status')
            : null;
        const searchIndex = buildPhotoSearchIndex(STREAM_LIBRARY, photoInfo, EXCLUDED_PHOTOS);
        let searchActive = false;
        let searchBusy = false;
        let searchGen = 0;
        let searchQuery = '';
        let searchReturnFadeAt = 0;
        let gallerySearchFrozen = false;
        let gallerySearchFading = false;
        let leftFillPaused = false;
        let searchFadeOutStartedAt = 0;
        let searchReturnQueued = false;
        let searchGapWatchUntil = 0;
        let searchGapLastSample = 0;
        let searchBagBefore = null;
        const searchPool = [];
        const searchRows = [];
        let storedSectionHeight = '';

        const layoutRoot = () => (searchActive ? searchBoard : section);
        const activeRows = () => (searchActive ? searchRows : rows);
        const activePool = () => (searchActive ? searchPool : pool);

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
        const panelCopy = document.createElement('div');
        panelCopy.className = 'stream-panel-copy';
        const panelTitle = document.createElement('i');
        panelTitle.className = 'stream-panel-title';
        const panelYear = document.createElement('div');
        panelYear.className = 'stream-panel-year';
        const panelDetails = document.createElement('div');
        panelDetails.className = 'stream-panel-details';
        panelCopy.append(panelTitle, panelYear, panelDetails);
        const panelRule = document.createElement('div');
        panelRule.className = 'stream-panel-rule';
        const panelText = document.createElement('p');
        panelText.className = 'stream-panel-text';
        const panelLinks = document.createElement('div');
        panelLinks.className = 'stream-panel-links';
        panelLinks.hidden = true;
        panelInner.append(panelCopy, panelRule, panelText, panelLinks);
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
            const rect = layoutRoot().getBoundingClientRect();
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
            if (searchForm) {
                chromeBottom = Math.max(chromeBottom, searchForm.getBoundingClientRect().bottom);
            }
            if (searchStatus && !searchStatus.hidden) {
                chromeBottom = Math.max(chromeBottom, searchStatus.getBoundingClientRect().bottom);
            }
            // Gallery keeps the 24px header gap. Search results sit one
            // mobile photo-gap below the status line. The mobile header is
            // fixed, so it is out of flow and the margin is the full offset
            // from the top of the page.
            let belowChrome = HEADER_TO_ROW_GAP_PX;
            const headerPinned = window.innerWidth < MOBILE_BREAKPOINT_PX;
            if (headerPinned) {
                const statusShown = searchActive && searchStatus && !searchStatus.hidden;
                belowChrome = statusShown ? mobilePhotoGapPx() : 24;
            }
            const margin = headerPinned
                ? Math.round(chromeBottom + belowChrome)
                : Math.round(chromeBottom + belowChrome - headerBox.bottom);
            const marginStr = margin ? `${margin}px` : '';
            if (searchActive) {
                section.style.marginTop = '0px';
                searchBoard.style.marginTop = marginStr;
            } else {
                section.style.marginTop = marginStr;
                searchBoard.style.marginTop = '0px';
            }
        };

        const fitRowsToViewport = (firstTop) => {
            const minGap = labelClearancePx(itemHeight);
            if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
                const room = Math.max(itemHeight, viewHeight() - firstTop);
                const stride = itemHeight + minGap;
                return {
                    gap: minGap,
                    count: Math.max(1, Math.ceil((room + minGap) / stride)),
                };
            }
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
            searchBoard.style.setProperty('--stream-item-height', `${itemHeight}px`);
            searchBoard.style.setProperty('--stream-row-gap', `${rowGapPx}px`);
        };

        const stridePx = () => itemHeight + rowGapPx;
        // Section Y of row i, including every open band (and its gap) above it.
        const rowTopPx = (index) => index * stridePx() + rowShift(index);
        // Viewport Y of that same row. Bands are empty on desktop, so this
        // matches the old index * stride there.
        const rowTopInView = (index) => viewOriginY + rowTopPx(index);
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
            // while the user was looking further down. Open bands push later
            // rows down, so the index is found from rowTopInView, not stride alone.
            cacheStreamOrigin();
            // On mobile the header is pinned, so rows fully behind it are
            // above the content area. Desktop still starts at the viewport top.
            const viewTop = window.innerWidth < MOBILE_BREAKPOINT_PX ? chromeBottomPx() : 0;
            const viewBottom = viewHeight();
            const stride = stridePx();
            if (!(stride > 0)) return { first: 0, last: 0 };
            const extent = itemHeight + labelClearancePx(itemHeight);
            let hi = Math.max(8, allocatedRows + 2);
            while (rowTopInView(hi) < viewBottom && hi < 4000) hi += 40;
            let lo = 0;
            let bound = hi;
            while (lo < bound) {
                const mid = (lo + bound) >> 1;
                if (rowTopInView(mid) + extent <= viewTop) lo = mid + 1;
                else bound = mid;
            }
            let first = lo;
            if (first > 0 && rowTopInView(first) >= viewBottom) first -= 1;
            let last = first;
            while (last < hi && rowTopInView(last + 1) < viewBottom) last += 1;
            return { first: Math.max(0, first), last: Math.max(0, last) };
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
                            decodePromises.delete(key);
                            return null;
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
                if (slot === exceptSlot || slot.search || !slot.spec) return;
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

        const bagAvailableCount = () => {
            const occupied = occupiedKeys();
            let count = 0;
            STREAM_LIBRARY.forEach((item) => {
                const key = photoKey(item);
                if (key && !occupied.has(key)) count += 1;
            });
            return count;
        };

        const logSearchBag = (when) => {
            if (process.env.NODE_ENV === 'production') return;
            const available = bagAvailableCount();
            console.info('[search-bag]', {
                when,
                available,
                reserved: reserved.size,
                bag: bag.length,
                pool: pool.length,
            });
            return available;
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
            if (slot?.search) {
                const img = slot.spec?.img || slot.el?.querySelector('img');
                return !!(img && img.naturalWidth);
            }
            const shown = slot.el?.querySelector('img');
            if (shown && shown.naturalWidth) return true;
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

        // Only a decoded photo that is not already on screen. Walking the
        // library in file order handed rows 13, 14, 15… and duplicated
        // photos that were still reserved for another row.
        const dealCoverSpec = (exceptSlot) => takeReadySpec(exceptSlot);

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
                fillRowLeft(slot.row);
                if (!introEntering.has(slot.row)) fillRowRight(slot.row);
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
            } else if (spec.img) {
                const src = spec.img.currentSrc || spec.img.src;
                let img = slot.el.querySelector('img');
                if (!img || (img.currentSrc || img.src) !== src) {
                    img = new Image();
                    img.alt = '';
                    img.draggable = false;
                    img.decoding = 'sync';
                    img.src = src;
                    slot.el.replaceChildren(img);
                }
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

        // The enlarged mobile photo is a separate copy. Its source slot stays
        // in the row at opacity 0 until the copy lands, or until the slot
        // recycles onto a different photo.
        const sourceBandHidden = (slot) => {
            if (!slot || slot.search || !slot.spec) return false;
            const key = photoKey(slot.spec);
            if (!key) return false;
            const match = (band) => band.slot === slot && band.key === key;
            return galleryBands.some(match) || closingBands.some(match);
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
            // Only a live search fade owns opacity. The intro and normal drift
            // keep the usual paint.
            if (gallerySearchFading && searchFadeOutStartedAt) return;
            // An open mobile band hides its source tile. The slot keeps
            // drifting; paint must not turn it visible again. A recycled
            // slot (new photo key) is a normal tile and shows.
            if (!slot.search && !slotHasLoadedPhoto(slot)) {
                if (slot.paintedOpacity !== 0) {
                    slot.paintedOpacity = 0;
                    slot.el.style.opacity = '0';
                }
                return;
            }
            if (sourceBandHidden(slot)) {
                if (slot.paintedOpacity !== 0) {
                    slot.paintedOpacity = 0;
                    slot.el.style.opacity = '0';
                }
                return;
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

        const retireSlot = (slot) => {
            if (!slot || slot.frozen || slot.search) return;
            if (slotIsHeld(slot)) return;
            if (slot === hoverSlot) {
                slot.el.classList.remove('is-hovered');
                hoverSlot = null;
            }
            if (slot.spec) {
                markShown(slot.spec);
                releaseReserved(slot.spec);
            }
            if (slot.labelEl && slot.labelEl.parentNode) slot.labelEl.remove();
            if (slot.el && slot.el.parentNode) slot.el.remove();
            const index = pool.indexOf(slot);
            if (index >= 0) pool.splice(index, 1);
            slot.spec = null;
            slot.frozen = false;
            slot.paintedTransform = '';
            spareGallerySlots.push(slot);
        };

        const spawnLeftTile = (rowIndex, spec) => {
            const rowEl = rows[rowIndex];
            if (!rowEl || !spec) return null;
            const left = leftmostInRow(rowIndex);
            let slot = spareGallerySlots.pop();
            if (slot) {
                slot.row = rowIndex;
                slot.search = false;
                slot.frozen = holdMotion;
                slot.fadeOutBorn = gallerySearchFading || leftFillPaused;
                rowEl.appendChild(slot.el);
                applyVisuals(slot, spec);
                slot.speed = speedFor(slot.id);
                applyDepth(slot);
                slot.width = itemHeight * (slot.aspectRatio || 1);
                slot.x = left
                    ? left.x - ITEM_GAP_PX - slot.width
                    : -ITEM_GAP_PX - slot.width;
                paint(slot);
                pool.push(slot);
                releaseReserved(slot.spec);
            } else {
                slot = appendSlotToRow(rowIndex, spec, 'left');
            }
            if (!slot) return null;
            if (gallerySearchFading || leftFillPaused) {
                slot.fadeOutBorn = true;
                slot.el.style.transition = 'none';
                slot.el.style.opacity = '0';
                slot.paintedOpacity = 0;
            }
            if (!slotHasLoadedPhoto(slot)) {
                decodeOntoSlot(slot, libraryByKey.get(photoKey(spec)) || spec);
            }
            return slot;
        };

        // A tile fully off the right can move to the left only when some other
        // tile still reaches the screen's right edge. Otherwise it stays put
        // so the row does not open a hole there.
        const rowCoversRightWithout = (slot) => {
            for (let i = 0; i < pool.length; i += 1) {
                const other = pool[i];
                if (other === slot || other.row !== slot.row) continue;
                if (other.el && rows[other.row] && other.el.parentNode !== rows[other.row]) continue;
                if (other.x + other.width >= viewportWidth - 0.5) return true;
            }
            return false;
        };

        const furthestExitedTile = (rowIndex) => {
            let found = null;
            for (let i = 0; i < pool.length; i += 1) {
                const slot = pool[i];
                if (slot.row !== rowIndex || slot.frozen || slot.search || slotIsHeld(slot)) continue;
                if (slot.x < viewportWidth) continue;
                if (slot.el && rows[slot.row] && slot.el.parentNode !== rows[slot.row]) continue;
                if (!rowCoversRightWithout(slot)) continue;
                if (!found || slot.x > found.x) found = slot;
            }
            return found;
        };

        const moveSlotToLeft = (slot, spec) => {
            if (gallerySearchFading || leftFillPaused) slot.fadeOutBorn = true;
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
            slot.width = itemHeight * (slot.aspectRatio || 1);
            slot.x = neighbor ? neighbor.x - ITEM_GAP_PX - slot.width : -ITEM_GAP_PX - slot.width;
            paint(slot);
            if (slot.fadeOutBorn) {
                slot.el.style.transition = 'none';
                slot.el.style.opacity = '0';
                slot.paintedOpacity = 0;
            }
            if (!slotHasLoadedPhoto(slot)) {
                decodeOntoSlot(slot, libraryByKey.get(photoKey(slot.spec)) || slot.spec);
            }
            return slot;
        };

        // Waiting, loading, or still sliding in. Edge-fill here would drop
        // photos onto the screen before the intro moves them in.
        const introBlocksFill = (rowIndex) =>
            introPlan.has(rowIndex)
            || introEntering.has(rowIndex)
            || rowPending.has(rowIndex);

        const fillRowLeft = (rowIndex) => {
            if (leftFillPaused || gallerySearchFading) return;
            if (rowIndex == null || !rows[rowIndex] || introBlocksFill(rowIndex)) return;
            for (let n = 0; n < 40; n += 1) {
                const left = leftmostInRow(rowIndex);
                if (left && left.x <= -ITEM_GAP_PX) return;
                const reuse = furthestExitedTile(rowIndex);
                if (reuse) {
                    const spec = dealCoverSpec(reuse) || reuse.spec;
                    if (!moveSlotToLeft(reuse, spec)) return;
                    continue;
                }
                const spec = dealCoverSpec();
                if (!spec) return;
                if (!spawnLeftTile(rowIndex, spec)) {
                    releaseReserved(spec);
                    return;
                }
            }
        };

        const fillRowRight = (rowIndex) => {
            if (leftFillPaused || gallerySearchFading) return;
            if (rowIndex == null || !rows[rowIndex] || introBlocksFill(rowIndex)) return;
            for (let n = 0; n < 40; n += 1) {
                let right = null;
                pool.forEach((slot) => {
                    if (slot.row !== rowIndex || !slotIsLive(slot)) return;
                    if (!right || slot.x + slot.width > right.x + right.width) right = slot;
                });
                if (!right || right.x + right.width >= viewportWidth) return;
                const spec = dealCoverSpec();
                if (!spec) return;
                const slot = appendSlotToRow(rowIndex, spec, 'right');
                if (!slot) {
                    releaseReserved(spec);
                    return;
                }
                if (gallerySearchFading || leftFillPaused) {
                    slot.fadeOutBorn = true;
                    slot.el.style.transition = 'none';
                    slot.el.style.opacity = '0';
                    slot.paintedOpacity = 0;
                }
                if (!slotHasLoadedPhoto(slot)) {
                    decodeOntoSlot(slot, libraryByKey.get(photoKey(spec)) || spec);
                }
            }
        };

        const retireExitedTiles = () => {
            for (let i = pool.length - 1; i >= 0; i -= 1) {
                const slot = pool[i];
                if (!slot || slot.frozen || slot.search || slotIsHeld(slot)) continue;
                if (slot.x < viewportWidth) continue;
                if (!rowCoversRightWithout(slot)) continue;
                retireSlot(slot);
            }
        };

        const coverLiveRows = () => {
            const { first, last } = visibleBounds();
            const from = Math.max(0, first - 1);
            const to = last + 1;
            for (let index = from; index <= to; index += 1) {
                if (!rows[index]) continue;
                fillRowLeft(index);
                if (!introEntering.has(index)) fillRowRight(index);
                revealIfCovered(index);
            }
        };

        const revealIfCovered = (index) => {
            const rowEl = rows[index];
            if (!rowEl || rowPending.has(index) || introEntering.has(index)) return;
            if (rowEl.style.visibility !== 'hidden') return;
            if (rowNeedsCoverage(index, 'filled')) return;
            const mine = pool.filter((slot) => slot.row === index && slotIsLive(slot));
            if (!mine.length || mine.some((slot) => !slotHasLoadedPhoto(slot))) return;
            rowEl.style.visibility = '';
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
                fillRowLeft(slot.row);
                if (!introEntering.has(slot.row)) fillRowRight(slot.row);
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
            if (galleryBands.some((band) => band.largeOn && band.spec?.srcFull === key)) return true;
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
                if (galleryBands.some((band) => (
                    band.spec?.srcFull === key && (band.largeOn || band.largeLoading)
                ))) return;
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
            const span = lookaheadRows();
            const rowOrder = [];
            for (let index = first; index <= last; index += 1) rowOrder.push(index);
            if (scrollDir >= 0) {
                for (let step = 1; step <= span; step += 1) rowOrder.push(last + step);
                for (let step = 1; step <= 2; step += 1) {
                    if (first - step >= 0) rowOrder.push(first - step);
                }
            } else {
                for (let step = 1; step <= span; step += 1) {
                    if (first - step >= 0) rowOrder.push(first - step);
                }
                for (let step = 1; step <= 2; step += 1) rowOrder.push(last + step);
            }
            rowOrder.forEach((index) => {
                (rowAssignments.get(index) || []).forEach(add);
                pool.forEach((slot) => {
                    if (slot.row !== index || slot.search || !slot.spec) return;
                    if (slotHasLoadedPhoto(slot)) return;
                    add(slot.spec);
                });
            });
            peekUpcoming(photosPerRow() * span + readyPoolMin()).forEach(add);
            if (window.innerWidth > MOBILE_BREAKPOINT_PX) {
                STREAM_LIBRARY.forEach(add);
            }
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
                if (!cancelled && !searchActive) {
                    const { first, last } = visibleBounds();
                    for (let index = Math.max(0, first - 1); index <= last + 1; index += 1) {
                        if (!rows[index] || rowPending.has(index) || introPlan.has(index)) continue;
                        const loaded = pool.some((slot) => (
                            slot.row === index && slotIsLive(slot) && slotHasLoadedPhoto(slot)
                        ));
                        if (!loaded) ensureRow(index);
                        else {
                            fillRowLeft(index);
                            if (!introEntering.has(index)) fillRowRight(index);
                        }
                    }
                }
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
            const top = rowTopInView(index);
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
            activeRows().forEach((row, index) => {
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
            activeRows().forEach((row, index) => {
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
            const open = amount > 0.02 || !!(viewer && viewer.phase === 'closing');
            section.classList.toggle('is-viewer-open', open && !searchActive);
            searchBoard.classList.toggle('is-viewer-open', open && searchActive);
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
            GALLERY_PANEL_ENABLED
            && window.innerWidth >= GALLERY_SIDE_MIN_PX
            && viewHeight() >= 500;

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
            const { beside, hasDesc, groupLeft, border, inner, endLeft, endTop, bandBottom } = box;
            if (beside) {
                if (!hasDesc) {
                    const frameLeft = endLeft - border;
                    const maxWidth = Math.max(80, frameLeft - GALLERY_PANEL_GAP_PX - 8);
                    return {
                        beside: true,
                        compact: true,
                        frameLeft,
                        maxWidth,
                        left: Math.max(8, frameLeft - GALLERY_PANEL_GAP_PX - maxWidth),
                        top: endTop - border,
                        width: maxWidth,
                        height: inner.height + border * 2,
                    };
                }
                // Spans the photo's height; the text inside sits at the bottom.
                return {
                    beside: true,
                    left: groupLeft,
                    top: endTop - border,
                    width: panelWidthPx(),
                    height: inner.height + border * 2,
                };
            }
            const side = 16;
            const top = endTop + inner.height + border + GALLERY_BELOW_GAP_PX;
            return {
                beside: false,
                left: side,
                top,
                width: Math.max(80, window.innerWidth - side * 2 - PANEL_INK_PAD_PX),
                height: Math.max(80, (bandBottom || viewHeight()) - top),
            };
        };

        const chromeBottomPx = () => {
            const header = headerEl();
            if (!header) return 0;
            let bottom = header.getBoundingClientRect().bottom;
            const logo = header.querySelector('.header-logo');
            if (logo) bottom = Math.max(bottom, logo.getBoundingClientRect().bottom);
            if (menuEl) {
                const box = menuEl.getBoundingClientRect();
                if (box.height > 1) bottom = Math.max(bottom, box.bottom);
            }
            if (searchForm) bottom = Math.max(bottom, searchForm.getBoundingClientRect().bottom);
            if (searchStatus && !searchStatus.hidden) {
                bottom = Math.max(bottom, searchStatus.getBoundingClientRect().bottom);
            }
            return Math.ceil(bottom);
        };

        const layoutViewerStacked = (spec, slot) => {
            const aspect = viewerAspect(spec, slot);
            const hasDesc = photoHasDescription(spec);
            const border = viewerBorderPx();
            const side = 16;
            const headerBottom = chromeBottomPx();
            const minPanel = 120;
            const roomBelow = viewHeight() - headerBottom - 8 - GALLERY_BELOW_GAP_PX - minPanel;
            const maxFrameW = Math.max(80, window.innerWidth - side * 2);
            const maxFrameH = Math.max(80, Math.min(viewHeight() * 0.6, roomBelow));
            const inner = fitInBox(
                aspect,
                Math.max(40, maxFrameW - border * 2),
                Math.max(40, maxFrameH - border * 2)
            );
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const frameLeft = (window.innerWidth - totalW) / 2;
            const endLeft = frameLeft + border;
            const endTop = Math.ceil(Math.max(side, headerBottom + 8) + border);
            return {
                border,
                inner,
                totalW,
                totalH,
                endLeft,
                endTop,
                centerLeft: endLeft,
                standardEndTop: endTop,
                hasDesc,
                panel: panelGeometry({
                    beside: false,
                    hasDesc,
                    groupLeft: frameLeft,
                    border,
                    inner,
                    endLeft,
                    endTop,
                    bandBottom: viewHeight(),
                }),
            };
        };

        const layoutViewer = (spec, slot) => {
            if (GALLERY_PANEL_ENABLED && !panelBeside()) return layoutViewerStacked(spec, slot);
            const aspect = viewerAspect(spec, slot);
            const reserve = bottomReservePx();
            const beside = panelBeside();
            const hasDesc = photoHasDescription(spec);
            const sidePanel = beside && hasDesc;
            const sideCost = sidePanel ? panelWidthPx() + GALLERY_PANEL_GAP_PX : 0;
            const seedBorder = viewerBorderPx();
            let border = seedBorder;
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
            let inner = fitInBox(
                aspect,
                Math.max(40, maxTotalW - border * 2),
                Math.max(40, maxTotalH - border * 2)
            );
            const ratioBorder = frameBorderForWidth(inner.width, aspect, hasDesc);
            if (ratioBorder && Math.abs(ratioBorder - seedBorder) > 1) {
                border = ratioBorder;
                inner = fitInBox(
                    aspect,
                    Math.max(40, maxTotalW - border * 2),
                    Math.max(40, maxTotalH - border * 2)
                );
            }
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const groupLeft = Math.max(
                VIEWER_GAP_PX,
                (window.innerWidth - (totalW + sideCost)) / 2
            );
            const centerLeft = (window.innerWidth - inner.width) / 2;
            const endLeft = sidePanel ? groupLeft + sideCost + border : centerLeft;
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
                hasDesc,
                panel: panelGeometry({
                    beside,
                    hasDesc,
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
                    const top = rowTopInView(index);
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
                top: rowTopInView(slot.row) + (itemHeight - height) / 2,
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
            const homeRows = slot.search ? searchRows : rows;
            if (!slot.el || !homeRows[slot.row] || slot.el.parentNode !== homeRows[slot.row]) return false;
            if (photoKey(slot.spec) !== key) return false;
            return thumbOnScreen(liveThumb(slot));
        };

        const exitRightPose = (layout, thumb, rowIndex) => {
            const width = thumb?.width || itemHeight;
            const height = thumb?.height || itemHeight;
            const scale = width / Math.max(1, layout.inner.width);
            const top = rowTopInView(rowIndex) + (itemHeight - height) / 2;
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

        const panelLinkEls = () => [...panelLinks.querySelectorAll('a')];

        const panelFieldEls = () => [
            panelTitle,
            panelYear,
            panelDetails,
            panelText,
            ...panelLinkEls(),
        ].filter(Boolean);

        const panelTextEls = () => panelFieldEls().filter((el) => (
            el && !el.hidden && el.textContent
        ));

        const resetPanelFieldChrome = () => {
            panelFieldEls().forEach((el) => {
                el.style.visibility = '';
                el.removeAttribute('aria-hidden');
                el.classList.remove('is-spacer', 'is-ready');
            });
            panelRule.style.visibility = '';
            panelRule.style.opacity = '';
            panelRule.style.clipPath = '';
            panelRule.classList.remove('is-spacer');
            panelRule.removeAttribute('aria-hidden');
        };

        const markPanelLinksReady = () => {
            panelLinkEls().forEach((el) => {
                el.style.visibility = '';
                el.classList.add('is-ready');
                el.dataset.revealReady = '1';
                el.removeAttribute('tabindex');
            });
        };

        const panelRevealArgs = () => ({
            container: panel,
            textEls: panelTextEls(),
            ruleEl: panelRule.hidden ? null : panelRule,
            innerEl: panelInner,
        });

        const panelClearArgs = () => ({
            container: panel,
            textEls: panelFieldEls(),
            ruleEl: panelRule,
            innerEl: panelInner,
        });

        const stopPanelRevealLoop = () => {
            panelReveal.stop();
        };

        const clearPanelReveal = () => {
            panelReveal.clear(panelClearArgs());
            resetPanelFieldChrome();
        };

        const startPanelReveal = () => {
            if (!GALLERY_PANEL_ENABLED || panel.hidden) return;
            resetPanelFieldChrome();
            const started = panelReveal.start({
                ...panelRevealArgs(),
                reducedMotion,
                debug: process.env.NODE_ENV !== 'production',
                debugLabel: photoHasDescription(viewer && viewer.spec) ? 'described' : 'compact',
                sweepWidth: panelWidthPx(),
            });
            if (!started || reducedMotion) markPanelLinksReady();
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
            const details = info && String(info.details || '').trim();
            const description = info && String(info.description || '').trim();
            const links = info && Array.isArray(info.links) ? info.links : [];
            resetPanelFieldChrome();
            setMarkedText(panelTitle, info ? info.title : '');
            panelYear.textContent = info && info.year ? info.year : '';
            panelYear.hidden = !(info && info.year);
            setMarkedText(panelDetails, details);
            panelDetails.hidden = !details;
            setMarkedText(panelText, description);
            panelText.hidden = !description;
            panelRule.hidden = !description;
            panelLinks.replaceChildren();
            links.forEach((link) => {
                if (!link || !link.url || !link.text) return;
                const anchor = document.createElement('a');
                anchor.className = 'stream-panel-link';
                anchor.href = link.url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.textContent = link.text;
                anchor.tabIndex = -1;
                anchor.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                panelLinks.append(anchor);
            });
            panelLinks.hidden = !panelLinks.childNodes.length;
            panel.classList.remove('is-copy-shift', 'is-copy-only');
            panel.hidden = !info;
            panel.scrollTop = 0;
        };

        // Parked at the flyer's resting place, like the caption.
        const placePanel = (layout) => {
            if (!GALLERY_PANEL_ENABLED || panel.hidden || !layout?.panel) return;
            let box = layout.panel;
            panel.classList.toggle('is-below', !box.beside);
            panel.classList.toggle('is-compact', !!box.compact);
            panel.style.height = `${Math.round(box.height)}px`;
            if (box.compact) {
                // Measure the text box with no ink pad, so wrapping stays put.
                panel.style.paddingRight = '0px';
                panel.style.width = `${Math.round(box.maxWidth)}px`;
                panel.style.transform =
                    `translate3d(${Math.round(box.left)}px, ${Math.round(box.top)}px, 0)`;
                void panel.offsetWidth;
                const copyW = Math.ceil(Math.max(
                    panelCopy.getBoundingClientRect().width,
                    panelTitle.getBoundingClientRect().width,
                    panelYear.hidden ? 0 : panelYear.getBoundingClientRect().width,
                    panelDetails.hidden ? 0 : panelDetails.getBoundingClientRect().width
                ));
                const width = Math.min(box.maxWidth, Math.max(copyW, 1));
                const left = Math.max(8, Math.round(box.frameLeft - GALLERY_PANEL_GAP_PX - width));
                box = { ...box, width, left };
                layout.panel = box;
            }
            panel.style.paddingRight = `${PANEL_INK_PAD_PX}px`;
            panel.style.width = `${Math.round(box.width) + PANEL_INK_PAD_PX}px`;
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
                searchBoard.classList.remove('is-viewer-open');
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
            viewer.hiddenRows = hiddenRowsFor(layout);
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
            viewer.hiddenRows = hiddenRowsFor(layout);
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
            if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
                if (slot.search) toggleMobileSearchCopy(slot);
                else toggleGalleryBand(slot);
                return;
            }
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
            if (rowLayoutQuiet(rowIndex)) return;
            const introPack = fromRight === true || introEntering.has(rowIndex);
            if (layoutWritesQuiet() && !introPack) return;
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
            // The intro chain slides in from the left on its own. Don't lengthen
            // it ahead of time; that skips the entrance.
            if (mode === 'enter-left') return false;
            return left.x > -ITEM_GAP_PX || right.x + right.width < viewportWidth;
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
                const spec = takeReadySpec();
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
                if (!slot) {
                    releaseReserved(spec);
                    return added;
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
                const spec = takeReadySpec();
                if (!spec) break;
                const mine = pool.filter((slot) => slot.row === rowIndex);
                const minX = mine.length ? Math.min(...mine.map((slot) => slot.x)) : 0;
                const side =
                    mode === 'enter-left' || minX > -ITEM_GAP_PX
                        ? 'left'
                        : 'right';
                const slot = appendSlotToRow(rowIndex, spec, side);
                if (!slot) releaseReserved(spec);
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
            const introStart = mode === 'enter-left';
            if (!introStart && layoutWritesQuiet()) {
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
            const raws = introStart ? assignRowPhotos(rowIndex) : [];
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
                const specs = [];
                if (introStart) {
                    const decoded = await mapWithConcurrency(raws, DECODE_CONCURRENCY, decodeSmall);
                    if (!stillHere()) {
                        abortStart();
                        return;
                    }
                    const used = new Set();
                    (decoded || []).forEach((spec) => {
                        if (!spec?.img) return;
                        const key = photoKey(spec);
                        if (!key || used.has(key)) return;
                        used.add(key);
                        specs.push(spec);
                    });
                    while (specs.length < raws.length) {
                        const extra = takeReadySpec();
                        if (!extra) break;
                        specs.push(extra);
                    }
                } else {
                    const want = photosPerRow();
                    for (let n = 0; n < want; n += 1) {
                        const spec = takeReadySpec();
                        if (!spec) break;
                        specs.push(spec);
                    }
                    if (!stillHere()) {
                        specs.forEach(releaseReserved);
                        return;
                    }
                    if (specs.length < Math.min(want, 3)) {
                        specs.forEach(releaseReserved);
                        startedRows.delete(rowIndex);
                        pumpSmalls();
                        return;
                    }
                }
                if (!stillHere()) {
                    specs.forEach(releaseReserved);
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
                if (mode === 'enter-left' || !rowNeedsCoverage(rowIndex, mode)) {
                    rowEl.style.visibility = '';
                }
                if (viewer) applyRows(viewer.rowAmount || 0);
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
            rowEl.style.top = `${rowTopPx(index)}px`;
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
            if (galleryBands.some((band) => band.row === index)) return;
            if (closingBands.some((band) => band.row === index)) return;
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
            section.style.height = `${rowTopPx(allocatedRows)}px`;
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
                    const loaded = pool.filter((slot) => (
                        slot.row === index && slotIsLive(slot) && slotHasLoadedPhoto(slot)
                    ));
                    if (loaded.length && !rowNeedsCoverage(index, 'filled')) {
                        rowEl.style.opacity = '';
                        rowEl.style.visibility = '';
                        rowEl.removeAttribute('data-opacity');
                        rowEl.removeAttribute('data-blocked');
                        rowEl.style.pointerEvents = '';
                    }
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
                fillRowLeft(index);
                if (!introEntering.has(index)) fillRowRight(index);
            }
            });
        };

        const scheduleIntroRow = (index, at) => {
            if (introPlan.has(index) || startedRows.has(index)) return;
            introPlan.add(index);
            introNextAt = Math.max(introNextAt, at + INTRO_MIN_GAP_SECONDS);
            introSchedule.push({ index, at });
        };

        const pumpIntro = (dt) => {
            if (!introSchedule.length || !(dt > 0)) return;
            introElapsed += dt;
            while (introSchedule.length && introSchedule[0].at <= introElapsed) {
                const item = introSchedule[0];
                const { index } = item;
                if (cancelled || !introPlan.has(index) || startedRows.has(index)) {
                    introSchedule.shift();
                    introPlan.delete(index);
                    continue;
                }
                if (!rows[index]) break;
                introSchedule.shift();
                startRow(index, 'enter-left');
            }
        };

        const outlineFor = (slot) => {
            if (!slot?.spec || !(slot.width > 0)) return 0;
            const aspect = slot.aspectRatio || viewerAspect(slot.spec, slot);
            return frameBorderForWidth(slot.width, aspect, photoHasDescription(slot.spec));
        };

        const slotUnderPointer = () => {
            if (searchActive) cacheStreamOrigin();
            const hoverPool = activePool();
            for (let i = hoverPool.length - 1; i >= 0; i -= 1) {
                const slot = hoverPool[i];
                if (!slot.spec) continue;
                if (slot.frozen && !slot.search) continue;
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
                const top = rowTopInView(slot.row) + (itemHeight - height) / 2;
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
            if (searchActive && window.innerWidth < MOBILE_BREAKPOINT_PX) {
                if (hoverSlot) {
                    hoverSlot.el.classList.remove('is-hovered');
                    hoverSlot = null;
                }
                return;
            }
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
            const viewTop = 0;
            const viewBottom = viewHeight();
            pool.forEach((slot) => {
                if (slot.frozen || slotIsHeld(slot)) return;
                const top = rowTopInView(slot.row);
                const onScreen =
                    slot.x + slot.width > 0 &&
                    slot.x < viewportWidth &&
                    top + itemHeight > viewTop &&
                    top < viewBottom;
                if (!onScreen) return;
                if (sourceBandHidden(slot)) return;
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
            const holdGalleryDrift = gallerySearchFrozen;
            const closing = viewer && viewer.phase === 'closing';
            try {
                advanceBandCloses(now);
                if (galleryBands.length && (!bandSyncAt || now - bandSyncAt > 500)) {
                    bandSyncAt = now;
                    syncBandLarges();
                }
                if (!holdGalleryDrift && !gallerySearchFading) pumpIntro(dt);
                if (!closing && !holdGalleryDrift) purgeDeadSlots();

                const motionScale = reducedMotion ? REDUCED_MOTION_SPEED_SCALE : 1;
                if (motionScale > 0 && dt > 0 && !holdGalleryDrift) {
                    if (
                        searchReturnFadeAt
                        && process.env.NODE_ENV !== 'production'
                    ) {
                        console.info('[search-return]', {
                            driftAfterMs: Math.round((now - searchReturnFadeAt) * 10) / 10,
                        });
                        searchReturnFadeAt = 0;
                    }
                    for (let i = 0; i < pool.length; i += 1) {
                        const slot = pool[i];
                        if (slot.frozen) continue;
                        slot.x += slot.speed * motionScale * dt;
                        if (SWAY_SPEED) slot.swayPhase += SWAY_SPEED * dt;
                        if (
                            slot.x > viewportWidth
                            && viewer
                            && viewer.phase === 'closing'
                            && slotIsHeld(slot)
                            && !viewer.closeExitRight
                        ) {
                            paint(slot);
                            continue;
                        }
                        if (!closing && !gallerySearchFading && !leftFillPaused) {
                            ensureReadyBeforeVisible(slot);
                        }
                        paint(slot);
                    }
                    retireExitedTiles();
                    coverLiveRows();
                    pinSearchFadeSweep(now);
                } else if (viewer) {
                    paint(viewer.slot);
                }

                advanceViewer(now, dt);
                sampleCloseProbe(now);
                if (!holdGalleryDrift && !gallerySearchFading) sampleRowSyncProbe(now);
                if (fineHover && (!closing || viewer.handedOff)) syncHover();
                if (!closing && !holdGalleryDrift && !gallerySearchFading && process.env.NODE_ENV !== 'production') {
                    warnEmptyVisibleTiles();
                    warnOnScreenDuplicates();
                    sampleSearchGapWatch(now);
                }
                if (!closing && readyPoolCount() < readyPoolMin()) pumpSmalls();
            } catch (err) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[stream-tick]', err);
                }
            }

            if (running) rafId = requestAnimationFrame(tick);
        };

        const play = () => {
            if (!inView) return;
            if (!pool.length && !viewer && !introSchedule.length) return;
            if (reducedMotion && REDUCED_MOTION_SPEED_SCALE === 0 && !viewer) return;
            if (running && rafId) return;
            running = true;
            if (!rafId) lastTime = 0;
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
            const introPending = introSchedule.length > 0;
            if (inView && (viewer || introPending || searchActive || (pool.length && !motionFrozen))) {
                play();
            } else {
                pause();
            }
        };

        const clearIntroSchedule = () => {
            introSchedule.length = 0;
        };

        const waitMs = (ms) => new Promise((resolve) => {
            window.setTimeout(resolve, ms);
        });

        const wipeDelayForX = (x) => {
            const travel = Math.max(0, SEARCH_WIPE_MS - SEARCH_FADE_MS);
            const span = Math.max(1, viewportWidth || window.innerWidth);
            return Math.round(Math.max(0, Math.min(1, x / span)) * travel);
        };

        // The fade-out is a line moving left to right. Opacity follows where the
        // tile is now, not where it was when Enter was pressed. Anything the
        // line has passed, and anything created after Enter, is fully transparent.
        const pinSearchFadeSweep = (now) => {
            if (!gallerySearchFading || !searchFadeOutStartedAt) return;
            const elapsed = now - searchFadeOutStartedAt;
            pool.forEach((slot) => {
                if (!slot?.el || slot.search) return;
                const screenX = slot.el.getBoundingClientRect().left;
                const delay = wipeDelayForX(screenX);
                let opacity = 1;
                if (slot.fadeOutBorn || elapsed >= delay + SEARCH_FADE_MS) opacity = 0;
                else if (elapsed > delay) opacity = 1 - (elapsed - delay) / SEARCH_FADE_MS;
                const text = opacity <= 0 ? '0' : opacity >= 1 ? '1' : String(opacity);
                if (slot.el.style.transition !== 'none') slot.el.style.transition = 'none';
                if (slot.el.style.opacity !== text) slot.el.style.opacity = text;
                slot.paintedOpacity = opacity;
            });
        };

        const wipeElements = (els, toVisible) => {
            const nodes = (els || []).filter(Boolean);
            if (!nodes.length) return Promise.resolve();
            if (reducedMotion) {
                nodes.forEach((el) => {
                    el.style.transition = 'none';
                    el.style.opacity = toVisible ? '1' : '0';
                });
                return Promise.resolve();
            }
            nodes.forEach((el) => {
                const from = toVisible ? '0' : (el.style.opacity === '' ? '1' : el.style.opacity);
                el.style.transition = 'none';
                el.style.opacity = from;
            });
            void nodes[0].offsetWidth;
            nodes.forEach((el) => {
                const delay = wipeDelayForX(el.getBoundingClientRect().left);
                el.style.transition = `opacity ${SEARCH_FADE_MS}ms linear ${delay}ms`;
                el.style.opacity = toVisible ? '1' : '0';
            });
            return waitMs(SEARCH_WIPE_MS);
        };

        const visibleGalleryEls = (includeHidden = false) => {
            const out = [];
            pool.forEach((slot) => {
                if (!slot?.el || !slotIsLive(slot)) return;
                if (
                    !includeHidden
                    && (slot.el.style.opacity === '0' || slot.paintedOpacity === 0)
                ) return;
                const box = slot.el.getBoundingClientRect();
                if (box.right < 0 || box.left > window.innerWidth) return;
                if (box.bottom < 0 || box.top > viewHeight()) return;
                out.push(slot.el);
            });
            return out;
        };

        const setSearchStatus = (query, count) => {
            if (!searchStatus) return;
            const trimmed = String(query || '').trim();
            if (!trimmed) {
                searchStatus.hidden = true;
                searchStatus.textContent = '';
                return;
            }
            const noun = count === 1 ? 'photo' : 'photos';
            searchStatus.hidden = false;
            searchStatus.textContent = `${count} ${noun} for '${trimmed}'`;
        };

        const syncSearchClear = () => {
            if (!searchClear) return;
            const show = !!(searchInput && searchInput.value) || searchActive;
            searchClear.hidden = !show;
        };

        const destroySearchBoard = () => {
            if (hoverSlot && hoverSlot.search) {
                hoverSlot.el.classList.remove('is-hovered');
                hoverSlot = null;
            }
            searchPool.forEach((slot) => {
                if (slot.reveal) {
                    slot.reveal.clear({
                        container: slot.copyEl,
                        textEls: slot.copyFields || [],
                        ruleEl: slot.copyRule,
                        innerEl: slot.copyInner,
                    });
                    slot.reveal = null;
                }
                slot.copyEl = null;
                slot.searchOpen = false;
            });
            searchPool.length = 0;
            searchRows.length = 0;
            searchBoard.replaceChildren();
            searchBoard.hidden = true;
            searchBoard.setAttribute('aria-hidden', 'true');
            searchBoard.classList.remove('is-viewer-open', 'is-empty', 'is-stacked', 'is-sliding');
            searchBoard.style.height = '';
            searchBoard.style.visibility = '';
            searchBoard.style.pointerEvents = '';
        };

        const hideGalleryForSearch = () => {
            if (!searchActive) storedSectionHeight = section.style.height;
            gallerySearchFading = false;
            pool.forEach((slot) => {
                slot.fadeOutBorn = false;
            });
            gallerySearchFrozen = true;
            searchActive = true;
            inView = true;
            section.classList.add('is-search-hidden');
            section.style.visibility = 'hidden';
            section.style.pointerEvents = 'none';
            section.setAttribute('aria-hidden', 'true');
            section.style.height = '0px';
        };

        const restoreGalleryAfterSearch = () => {
            searchActive = false;
            inView = true;
            section.classList.remove('is-search-hidden');
            section.style.height = storedSectionHeight || '';
            section.style.visibility = '';
            section.style.pointerEvents = '';
            section.removeAttribute('aria-hidden');
            applyHeaderRowGap();
            applyLayoutMetrics();
            cacheStreamOrigin();
        };

        const beginSearchGapWatch = () => {
            if (process.env.NODE_ENV === 'production') return;
            searchGapWatchUntil = performance.now() + 20000;
            searchGapLastSample = 0;
        };

        const coverageReport = () => {
            const { first, last } = visibleBounds();
            const limit = ITEM_GAP_PX + 2;
            const report = {
                fail: false,
                worstGap: 0,
                viewportWidth,
                running,
                hidden: document.hidden,
                holdMotion,
                gallerySearchFrozen,
                frozenSlots: pool.filter((slot) => slot.frozen).length,
                rows: [],
            };
            for (let index = first; index <= last; index += 1) {
                const live = pool
                    .filter((slot) => slot.row === index && slotIsLive(slot))
                    .sort((a, b) => a.x - b.x);
                if (!live.length) {
                    report.fail = true;
                    report.worstGap = Math.max(report.worstGap, viewportWidth);
                    report.rows.push({ row: index, empty: true, gap: viewportWidth });
                    continue;
                }
                const leftEdge = live[0].x;
                const rightEdge = live[live.length - 1].x + live[live.length - 1].width;
                let gap = 0;
                for (let i = 1; i < live.length; i += 1) {
                    gap = Math.max(
                        gap,
                        live[i].x - (live[i - 1].x + live[i - 1].width)
                    );
                }
                const leftHole = Math.max(0, leftEdge);
                const rightHole = Math.max(0, viewportWidth - rightEdge);
                const worst = Math.max(gap, leftHole, rightHole);
                const fail = leftEdge > 0 || rightEdge < viewportWidth || gap > limit;
                report.worstGap = Math.max(report.worstGap, worst);
                if (fail) report.fail = true;
                report.rows.push({
                    row: index,
                    leftEdge: Math.round(leftEdge * 10) / 10,
                    rightEdge: Math.round(rightEdge * 10) / 10,
                    gap: Math.round(gap * 10) / 10,
                    fail,
                });
            }
            return report;
        };
        if (process.env.NODE_ENV !== 'production') {
            window.__galleryCoverage = coverageReport;
        }

        const sampleSearchGapWatch = (now) => {
            if (process.env.NODE_ENV === 'production') return;
            if (!searchGapWatchUntil) return;
            if (now > searchGapWatchUntil) {
                searchGapWatchUntil = 0;
                return;
            }
            if (searchGapLastSample && now - searchGapLastSample < 500) return;
            searchGapLastSample = now;
            const report = coverageReport();
            if (!report.fail) return;
            console.warn('[search-gap]', {
                worstGap: Math.round(report.worstGap),
                available: bagAvailableCount(),
                rows: report.rows.filter((row) => row.fail),
            });
        };

        const searchInsetPx = () => ITEM_GAP_PX;
        const MOBILE_SEARCH_COPY_GAP_PX = 12;
        const MOBILE_SEARCH_SLIDE_MS = 300;

        const queryFromInput = () => String(searchInput?.value || '').trim();

        const mobileSearchLayout = () => window.innerWidth < MOBILE_BREAKPOINT_PX;

        const searchOutgoingSelector = '.stream-item, .stream-search-empty, .stream-search-copy';

        const ensureSearchRow = (index) => {
            if (searchRows[index]) return searchRows[index];
            const rowEl = document.createElement('div');
            rowEl.className = 'floating-streams-row';
            rowEl.dataset.rowIndex = String(index);
            rowEl.style.top = `${index * stridePx()}px`;
            rowEl.style.height = `${itemHeight}px`;
            searchBoard.append(rowEl);
            searchRows[index] = rowEl;
            return rowEl;
        };

        const syncSearchBoardHeight = (rowCount, empty) => {
            if (empty) {
                searchBoard.style.height = `${Math.max(160, viewHeight() - Math.round(viewOriginY))}px`;
                return;
            }
            const count = Math.max(1, rowCount);
            const boardHeight = (count - 1) * stridePx() + itemHeight + labelClearancePx(itemHeight);
            searchBoard.style.height = `${Math.max(boardHeight, itemHeight)}px`;
        };

        const measureSearchHits = (hits) => {
            const gap = searchInsetPx();
            const rowWidth = Math.max(
                1,
                searchBoard.clientWidth || viewportWidth || window.innerWidth
            );
            const maxContent = Math.max(1, rowWidth - gap * 2);
            const packed = [];
            let current = [];
            let rowContent = 0;
            (hits || []).forEach((hit) => {
                const aspect = aspectFor(hit.item);
                const width = itemHeight * (aspect || 1);
                const extra = current.length ? gap + width : width;
                if (current.length && rowContent + extra > maxContent) {
                    packed.push(current);
                    current = [];
                    rowContent = 0;
                }
                current.push({ hit, width, aspect });
                rowContent += current.length === 1 ? width : gap + width;
            });
            if (current.length) packed.push(current);
            const positions = [];
            packed.forEach((items, rowIndex) => {
                const contentWidth = items.reduce(
                    (sum, item, index) => sum + item.width + (index ? gap : 0),
                    0
                );
                let x = Math.round((rowWidth - contentWidth) / 2);
                x = Math.max(gap, Math.min(x, rowWidth - gap - contentWidth));
                items.forEach((item) => {
                    positions.push({
                        hit: item.hit,
                        row: rowIndex,
                        x,
                        width: item.width,
                        aspect: item.aspect,
                    });
                    x += item.width + gap;
                });
            });
            return positions;
        };

        const searchBoardWidth = () => Math.max(
            1,
            searchBoard.clientWidth || viewportWidth || window.innerWidth
        );

        // Vertical space between mobile search results, and the minimum
        // distance an auto-scrolled white frame may sit from the top.
        const mobilePhotoGapPx = () => Math.round(searchBoardWidth() * 0.2);

        const MOBILE_TITLE_RESERVE_PX = 40;

        // Outer frame, border included, stays inside 4% side margins and is
        // centered. A portrait frame shrinks, keeping the border ratio, so
        // the photo and its title line fit under the pinned header.
        const mobileTitleReserve = (spec, width) => {
            const info = photoLabelFor(spec);
            const title = info && String(info.title || '').trim();
            if (!title || !(width > 0)) return MOBILE_TITLE_RESERVE_PX;
            const host = document.createElement('div');
            host.className = 'stream-search-copy';
            host.style.visibility = 'hidden';
            host.style.pointerEvents = 'none';
            host.style.left = '0';
            host.style.top = '0';
            host.style.width = `${Math.round(width)}px`;
            host.style.height = 'auto';
            const probe = document.createElement('i');
            probe.className = 'stream-panel-title';
            host.append(probe);
            section.append(host);
            setMarkedText(probe, title);
            const height = Math.ceil(probe.getBoundingClientRect().height);
            host.remove();
            return Math.max(MOBILE_TITLE_RESERVE_PX, height + MOBILE_SEARCH_COPY_GAP_PX);
        };

        const fitMobileFrame = (boardW, aspect, hasDesc, gapAbove, reservePx) => {
            const safeAspect = aspect > 0 ? aspect : 1;
            const desk = desktopViewerPhotoSize(safeAspect, hasDesc);
            const ratio = desk.width > 0 ? desk.border / desk.width : 0;
            const maxOuterW = Math.max(1, boardW * 0.92);
            const reserve = reservePx > 0 ? reservePx : MOBILE_TITLE_RESERVE_PX;
            const maxOuterH = Math.max(
                80,
                viewHeight() - chromeBottomPx() - Math.max(0, gapAbove) - reserve
            );
            let photoW = maxOuterW / (1 + 2 * ratio);
            const outerH = photoW * (1 / safeAspect + 2 * ratio);
            if (outerH > maxOuterH) photoW = maxOuterH / (1 / safeAspect + 2 * ratio);
            let border = Math.max(1, Math.round(ratio * photoW));
            photoW = Math.max(1, Math.round(photoW));
            let photoH = Math.max(1, Math.round(photoW / safeAspect));
            if (photoH + border * 2 > maxOuterH) {
                photoH = Math.max(1, Math.floor(maxOuterH - border * 2));
                photoW = Math.max(1, Math.round(photoH * safeAspect));
                border = Math.max(1, Math.round(ratio * photoW));
                if (photoH + border * 2 > maxOuterH) {
                    photoH = Math.max(1, Math.floor(maxOuterH - border * 2));
                }
            }
            let outerW = photoW + border * 2;
            if ((boardW - outerW) % 2 !== 0) {
                photoW = Math.max(1, photoW - 1);
                photoH = Math.max(1, Math.min(photoH, Math.round(photoW / safeAspect)));
                if (photoH + border * 2 > maxOuterH) {
                    photoH = Math.max(1, Math.floor(maxOuterH - border * 2));
                }
                outerW = photoW + border * 2;
            }
            const frameLeft = Math.floor((boardW - outerW) / 2);
            return { frameW: outerW, frameLeft, border, photoW, photoH };
        };

        const fitMobileFrameFor = (boardW, spec, aspect, gapAbove) => {
            const hasDesc = photoHasDescription(spec);
            let frame = fitMobileFrame(boardW, aspect, hasDesc, gapAbove, MOBILE_TITLE_RESERVE_PX);
            let reserve = mobileTitleReserve(spec, frame.frameW);
            if (reserve !== MOBILE_TITLE_RESERVE_PX) {
                frame = fitMobileFrame(boardW, aspect, hasDesc, gapAbove, reserve);
                const again = mobileTitleReserve(spec, frame.frameW);
                if (again !== reserve) frame = fitMobileFrame(boardW, aspect, hasDesc, gapAbove, again);
            }
            return frame;
        };

        // One photo per row. The white frame's outer edge is at most 92% of
        // the board (4% each side) and centered. The gap under a frame, or
        // under open text, is 20% of that width.
        const measureMobileSearchHits = (hits) => {
            const rowWidth = searchBoardWidth();
            const gapAbove = mobilePhotoGapPx();
            return (hits || []).map((hit, row) => {
                const aspect = aspectFor(hit.item) || 1;
                const frame = fitMobileFrameFor(rowWidth, hit.item, aspect, gapAbove);
                return {
                    hit,
                    row,
                    aspect,
                    width: frame.photoW,
                    photoH: frame.photoH,
                    border: frame.border,
                    x: frame.frameLeft + frame.border,
                };
            });
        };

        const layoutMobileSearch = () => {
            const ordered = searchPool.slice().sort((a, b) => a.row - b.row);
            const gap = mobilePhotoGapPx();
            let y = 0;
            ordered.forEach((slot, index) => {
                const border = slot.searchBorder || 0;
                const photoH = slot.photoH || itemHeight;
                const copyH = slot.searchOpen ? (slot.copyHeight || 0) : 0;
                const copyGap = copyH > 0 ? MOBILE_SEARCH_COPY_GAP_PX : 0;
                const rowH = border * 2 + photoH + copyGap + copyH;
                const rowEl = searchRows[slot.row];
                if (rowEl) {
                    rowEl.style.top = `${Math.round(y)}px`;
                    rowEl.style.height = `${Math.round(rowH)}px`;
                }
                if (slot.copyEl) {
                    slot.copyEl.style.top = `${Math.round(border * 2 + photoH + (copyH > 0 ? MOBILE_SEARCH_COPY_GAP_PX : 0))}px`;
                    slot.copyEl.style.left = `${Math.round(slot.x - border)}px`;
                    slot.copyEl.style.width = `${Math.round(slot.width + border * 2)}px`;
                }
                y += rowH;
                if (index < ordered.length - 1) y += gap;
            });
            searchBoard.style.height = `${Math.max(1, Math.round(y + 24))}px`;
        };

        const MOBILE_OPEN_SCROLL_MS = 400;
        const MOBILE_SCROLL_EASE = [0.25, 0.1, 0.25, 1];
        let mobileOpenScroll = null;

        const cancelMobileOpenScroll = () => {
            if (!mobileOpenScroll) return;
            if (mobileOpenScroll.raf) cancelAnimationFrame(mobileOpenScroll.raf);
            mobileOpenScroll = null;
        };

        // Park the white frame one gap under the pinned header. That gap is
        // the space above the frame (the row gap, or the search-result gap),
        // so the row or result above ends exactly at the header and is hidden.
        const scrollOpenedBandIntoView = (frameTop, gapAbove) => {
            if (window.innerWidth >= MOBILE_BREAKPOINT_PX) return;
            cancelMobileOpenScroll();
            const targetTop = chromeBottomPx() + Math.max(0, gapAbove || 0);
            const delta = frameTop - targetTop;
            if (Math.abs(delta) <= 1) return;
            const startY = window.scrollY || window.pageYOffset || 0;
            const maxY = Math.max(
                0,
                (document.scrollingElement || document.documentElement).scrollHeight - viewHeight()
            );
            const targetY = Math.max(0, Math.min(maxY, startY + delta));
            if (Math.abs(targetY - startY) <= 1) return;
            if (reducedMotion) {
                mobileOpenScroll = { expected: targetY, raf: 0 };
                window.scrollTo(0, targetY);
                mobileOpenScroll = null;
                return;
            }
            const state = { expected: startY, raf: 0 };
            const t0 = performance.now();
            const step = (now) => {
                if (mobileOpenScroll !== state) return;
                const raw = Math.min(1, (now - t0) / MOBILE_OPEN_SCROLL_MS);
                const y = startY + (targetY - startY) * easeBezier(MOBILE_SCROLL_EASE, raw);
                state.expected = y;
                window.scrollTo(0, y);
                if (raw < 1) state.raf = requestAnimationFrame(step);
                else mobileOpenScroll = null;
            };
            mobileOpenScroll = state;
            state.raf = requestAnimationFrame(step);
        };

        const searchCopyFields = (slot) => [
            slot.copyTitle,
            slot.copyYear,
            slot.copyDetails,
            slot.copyText,
            ...(slot.copyLinks ? [...slot.copyLinks.querySelectorAll('a')] : []),
        ].filter(Boolean);

        const clearSearchCopyReveal = (slot) => {
            if (!slot?.reveal) return;
            slot.reveal.clear({
                container: slot.copyEl,
                textEls: slot.copyFields || searchCopyFields(slot),
                ruleEl: slot.copyRule,
                innerEl: slot.copyInner,
            });
            slot.reveal = null;
        };

        const fillSearchCopy = (slot, copy) => {
            const info = photoLabelFor(slot.spec);
            const details = info && String(info.details || '').trim();
            const description = info && String(info.description || '').trim();
            const links = info && Array.isArray(info.links) ? info.links : [];
            const inner = document.createElement('div');
            inner.className = 'stream-search-copy-inner';
            const title = document.createElement('i');
            title.className = 'stream-panel-title';
            const year = document.createElement('div');
            year.className = 'stream-panel-year';
            const detailEl = document.createElement('div');
            detailEl.className = 'stream-panel-details';
            const rule = document.createElement('div');
            rule.className = 'stream-panel-rule';
            const text = document.createElement('p');
            text.className = 'stream-panel-text';
            const linkWrap = document.createElement('div');
            linkWrap.className = 'stream-panel-links';
            inner.append(title, year, detailEl);
            copy.append(inner, rule, text, linkWrap);
            setMarkedText(title, info ? info.title : '');
            year.textContent = info && info.year ? info.year : '';
            year.hidden = !(info && info.year);
            setMarkedText(detailEl, details);
            detailEl.hidden = !details;
            setMarkedText(text, description);
            text.hidden = !description;
            rule.hidden = !description;
            links.forEach((link) => {
                if (!link || !link.url || !link.text) return;
                const anchor = document.createElement('a');
                anchor.className = 'stream-panel-link is-ready';
                anchor.href = link.url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.textContent = link.text;
                anchor.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                linkWrap.append(anchor);
            });
            linkWrap.hidden = !linkWrap.childNodes.length;
            slot.copyInner = inner;
            slot.copyTitle = title;
            slot.copyYear = year;
            slot.copyDetails = detailEl;
            slot.copyRule = rule;
            slot.copyText = text;
            slot.copyLinks = linkWrap;
            slot.copyFields = searchCopyFields(slot);
        };

        const startSearchCopyReveal = (slot) => {
            clearSearchCopyReveal(slot);
            const reveal = createTextReveal({
                sweepMs: GALLERY_SWEEP_MS,
                charMinMs: GALLERY_CHAR_MIN_MS,
                charExtraMs: GALLERY_CHAR_EXTRA_MS,
            });
            slot.reveal = reveal;
            const textEls = (slot.copyFields || []).filter((el) => el && !el.hidden && el.textContent);
            const started = reveal.start({
                container: slot.copyEl,
                textEls,
                ruleEl: null,
                innerEl: slot.copyInner,
                reducedMotion,
                sweepWidth: slot.width,
                lineStaggerMs: reducedMotion ? 0 : 180,
            });
            if (slot.copyRule && !slot.copyRule.hidden) {
                const linesBefore = [slot.copyTitle, slot.copyYear, slot.copyDetails]
                    .filter((el) => el && !el.hidden && el.textContent).length;
                slot.copyRule.style.opacity = '0';
                window.setTimeout(() => {
                    if (!slot.copyRule) return;
                    slot.copyRule.style.transition = 'opacity 180ms ease';
                    slot.copyRule.style.opacity = '1';
                }, reducedMotion ? 0 : linesBefore * 180);
            }
            if (!started || reducedMotion) {
                slot.copyFields.forEach((el) => {
                    if (el && el.tagName === 'A') el.classList.add('is-ready');
                });
            }
        };

        const measureSearchCopy = (slot) => {
            const rowEl = searchRows[slot.row];
            if (!rowEl) return 0;
            const copy = document.createElement('div');
            copy.className = 'stream-search-copy';
            fillSearchCopy(slot, copy);
            const border = slot.searchBorder || 0;
            copy.style.left = `${Math.round(slot.x - border)}px`;
            copy.style.width = `${Math.round(slot.width + border * 2)}px`;
            copy.style.height = 'auto';
            copy.style.visibility = 'hidden';
            copy.style.pointerEvents = 'none';
            rowEl.append(copy);
            const height = Math.ceil(copy.getBoundingClientRect().height);
            copy.style.visibility = '';
            copy.style.height = 'auto';
            copy.style.overflow = 'visible';
            copy.style.pointerEvents = 'auto';
            slot.copyEl = copy;
            slot.copyHeight = height;
            return height;
        };

        const toggleMobileSearchCopy = (slot) => {
            if (!searchActive || !slot?.el || !mobileSearchLayout()) return;
            if (slot.searchOpen) {
                cancelMobileOpenScroll();
                slot.el.setAttribute('aria-expanded', 'false');
                const copy = slot.copyEl;
                if (copy && !reducedMotion) {
                    copy.style.transition = 'opacity 180ms ease';
                    copy.style.opacity = '0';
                }
                const token = (slot.copyToken || 0) + 1;
                slot.copyToken = token;
                window.setTimeout(() => {
                    if (slot.copyToken !== token || !slot.searchOpen) return;
                    slot.searchOpen = false;
                    clearSearchCopyReveal(slot);
                    layoutMobileSearch();
                    window.setTimeout(() => {
                        if (slot.copyToken !== token || slot.searchOpen) return;
                        if (slot.copyEl) slot.copyEl.remove();
                        slot.copyEl = null;
                        slot.copyHeight = 0;
                    }, reducedMotion ? 0 : MOBILE_SEARCH_SLIDE_MS + 40);
                }, copy && !reducedMotion ? 180 : 0);
                return;
            }
            if (!slot.copyEl) measureSearchCopy(slot);
            slot.searchOpen = true;
            slot.el.setAttribute('aria-expanded', 'true');
            if (slot.copyEl) {
                slot.copyEl.style.opacity = '1';
                slot.copyEl.style.height = 'auto';
                slot.copyEl.style.overflow = 'visible';
            }
            if (slot.copyEl) slot.copyEl.style.opacity = '0';
            layoutMobileSearch();
            const rowEl = searchRows[slot.row];
            if (rowEl) {
                const frameTop = searchBoard.getBoundingClientRect().top + (parseFloat(rowEl.style.top) || 0);
                scrollOpenedBandIntoView(frameTop, mobilePhotoGapPx());
            }
            window.setTimeout(() => {
                if (!slot.searchOpen || !slot.copyEl) return;
                slot.copyEl.style.transition = 'none';
                slot.copyEl.style.opacity = '1';
                startSearchCopyReveal(slot);
            }, reducedMotion ? 0 : MOBILE_SEARCH_SLIDE_MS);
        };

        const placeGalleryBands = () => {
            const grouped = new Map();
            galleryBands.forEach((band) => {
                const list = grouped.get(band.row) || [];
                list.push(band);
                grouped.set(band.row, list);
            });
            grouped.forEach((list, row) => {
                let top = (row + 1) * stridePx() + rowShift(row);
                list.forEach((band) => {
                    band.el.style.top = `${Math.round(top)}px`;
                    top += band.height + rowGapPx;
                });
            });
        };

        const placeAllGalleryRows = (slideMs, slideEase) => {
            if (slideMs != null) {
                section.style.setProperty('--band-slide-ms', `${slideMs}ms`);
                section.style.setProperty('--band-slide-ease', slideEase || 'ease');
            }
            rows.forEach((row, index) => {
                if (row) placeRow(index);
            });
            placeGalleryBands();
            if (allocatedRows > 0) {
                section.style.height = `${rowTopPx(allocatedRows)}px`;
            }
        };

        const dropBandNodes = (band) => {
            if (!band) return;
            clearSearchCopyReveal(band.slot);
            if (band.photoEl) band.photoEl.remove();
            if (band.el && band.el.parentNode) band.el.remove();
            if (band.slot) {
                band.slot.copyEl = null;
                band.slot.copyHeight = 0;
                band.slot.bandOpen = false;
                if (band.slot.el) {
                    band.slot.el.setAttribute('aria-expanded', 'false');
                    if (photoKey(band.slot.spec) === band.key) {
                        band.slot.paintedOpacity = 1;
                        band.slot.el.style.opacity = '1';
                    }
                }
            }
        };

        const dismissGalleryBands = () => {
            if (!galleryBands.length && !closingBands.length) return;
            cancelMobileOpenScroll();
            closingBands.splice(0).forEach(dropBandNodes);
            galleryBands.splice(0).forEach(dropBandNodes);
            section.classList.remove('is-band-slide');
            placeAllGalleryRows();
        };

        const mobileCloseTarget = (band) => {
            const layout = { inner: { width: band.photoW, height: band.photoH } };
            const slot = band.slot;
            const box = slot?.el ? slot.el.getBoundingClientRect() : null;
            const samePhoto = !!(
                slot
                && box
                && band.key
                && photoKey(slot.spec) === band.key
                && slot.el.parentNode
                && box.left < window.innerWidth
                && box.right > 0
                && box.top < window.innerHeight
                && box.bottom > 0
            );
            if (samePhoto) {
                return {
                    exitRight: false,
                    pose: {
                        x: box.left,
                        y: box.top,
                        scale: box.width / Math.max(1, band.photoW),
                    },
                };
            }
            const next = closeTargetFor(
                slot,
                layout,
                true,
                band.homeWidth,
                band.key,
                band.row
            );
            return {
                exitRight: true,
                pose: {
                    x: next.pose.x,
                    y: band.exitY,
                    scale: next.pose.scale,
                },
            };
        };

        const placeFlyingPhoto = (band, pose) => {
            if (!band.photoEl) return;
            band.photoEl.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`;
        };

        const applyExitClip = (band) => {
            const photo = band.photoEl;
            if (!photo) return;
            const box = photo.getBoundingClientRect();
            const rowBottom = rowTopInView(band.row) + itemHeight;
            const nextRow = rows[band.row + 1];
            const nextTop = nextRow
                ? nextRow.getBoundingClientRect().top
                : window.innerHeight;
            const topInset = Math.max(0, rowBottom - box.top);
            const bottomInset = Math.max(0, box.bottom - nextTop);
            photo.style.clipPath = `inset(${topInset}px 0px ${bottomInset}px 0px)`;
        };

        const advanceBandCloses = (now) => {
            if (!closingBands.length) return;
            cacheStreamOrigin();
            for (let i = closingBands.length - 1; i >= 0; i -= 1) {
                const band = closingBands[i];
                const raw = Math.min(1, (now - band.t0) / Math.max(1, band.duration));
                const amount = easeClose(raw);
                if (!band.exitRight) {
                    const next = mobileCloseTarget(band);
                    if (next.exitRight) {
                        band.from = startPoseFor(band.pose, next.pose, amount);
                        band.exitRight = true;
                    }
                    band.to = next.pose;
                }
                const pose = raw >= 1
                    ? band.to
                    : lerpPose(band.from, band.to, amount);
                band.pose = pose;
                placeFlyingPhoto(band, pose);
                const frame = frameOpacityFor('closing', amount);
                if (band.photoEl) {
                    band.photoEl.style.boxShadow = `0 0 0 ${band.border}px rgba(255,255,255,${frame})`;
                    if (band.exitRight) applyExitClip(band);
                    else band.photoEl.style.clipPath = '';
                }
                if (raw >= 1) {
                    closingBands.splice(i, 1);
                    dropBandNodes(band);
                }
            }
            if (!galleryBands.length && !closingBands.length) {
                section.classList.remove('is-band-slide');
            }
        };

        const beginBandFlight = (band) => {
            const photo = band.photoEl;
            if (!photo || !galleryBands.includes(band)) {
                const index = galleryBands.indexOf(band);
                if (index >= 0) galleryBands.splice(index, 1);
                dropBandNodes(band);
                placeAllGalleryRows();
                return;
            }
            cacheStreamOrigin();
            const rect = photo.getBoundingClientRect();
            band.exitY = rect.top;
            band.from = { x: rect.left, y: rect.top, scale: 1 };
            band.pose = band.from;
            band.duration = transitionMs;
            band.t0 = performance.now();
            const target = mobileCloseTarget(band);
            band.exitRight = target.exitRight;
            band.to = target.pose;
            photo.classList.add('is-flying');
            photo.style.position = 'fixed';
            photo.style.left = '0';
            photo.style.top = '0';
            photo.style.margin = '0';
            photo.style.width = `${band.photoW}px`;
            photo.style.height = `${band.photoH}px`;
            photo.style.transformOrigin = '0 0';
            photo.style.transition = 'none';
            photo.style.pointerEvents = 'none';
            photo.style.zIndex = '6';
            document.body.append(photo);
            placeFlyingPhoto(band, band.from);
            galleryBands.splice(galleryBands.indexOf(band), 1);
            closingBands.push(band);
            if (band.el) {
                band.el.style.pointerEvents = 'none';
                band.el.style.height = '0px';
                band.el.style.overflow = 'hidden';
            }
            section.classList.add('is-band-slide');
            placeAllGalleryRows(transitionMs, CLOSE_EASING);
            play();
        };

        const syncBandLarges = () => {
            if (!galleryBands.length) return;
            const margin = viewHeight();
            galleryBands.forEach((band) => {
                if (band.closing || !band.el || !band.largeEl || !band.spec) return;
                const rect = band.el.getBoundingClientRect();
                const near = rect.bottom > -margin && rect.top < margin * 2;
                if (near && !band.largeOn && !band.largeLoading) {
                    band.largeLoading = true;
                    loadLarge(band.spec, { priority: 'low', reason: 'open' }).then((image) => {
                        band.largeLoading = false;
                        if (!image || !galleryBands.includes(band) || band.closing) return;
                        const box = band.el.getBoundingClientRect();
                        const stillNear = box.bottom > -viewHeight() && box.top < viewHeight() * 2;
                        if (!stillNear) return;
                        if (band.largeEl.getAttribute('src') !== image.src) {
                            band.largeEl.src = image.src;
                        }
                        band.largeEl.style.opacity = '1';
                        band.largeOn = true;
                    });
                    return;
                }
                if (!near && band.largeOn && band.largeEl) {
                    band.largeEl.removeAttribute('src');
                    band.largeEl.style.opacity = '0';
                    band.largeOn = false;
                }
            });
        };

        const frameForMobileBand = (spec, aspect) => {
            const boardW = Math.max(1, section.clientWidth || viewportWidth || window.innerWidth);
            return fitMobileFrameFor(boardW, spec, aspect, rowGapPx);
        };

        const closeGalleryBand = (existing) => {
            if (!existing || existing.closing || !galleryBands.includes(existing)) return;
            cancelMobileOpenScroll();
            existing.closing = true;
            if (existing.slot?.el) existing.slot.el.setAttribute('aria-expanded', 'false');
            const copy = existing.slot && existing.slot.copyEl;
            if (copy && !reducedMotion) {
                copy.style.transition = `opacity ${GALLERY_TEXT_OUT_MS}ms ease`;
                copy.style.opacity = '0';
                copy.style.pointerEvents = 'none';
            }
            const token = (existing.token || 0) + 1;
            existing.token = token;
            window.setTimeout(() => {
                if (existing.token !== token || !galleryBands.includes(existing)) return;
                if (reducedMotion) {
                    galleryBands.splice(galleryBands.indexOf(existing), 1);
                    dropBandNodes(existing);
                    placeAllGalleryRows();
                    return;
                }
                beginBandFlight(existing);
            }, copy && !reducedMotion ? GALLERY_TEXT_OUT_MS : 0);
        };

        const toggleGalleryBand = (slot) => {
            if (!slot?.el || slot.search || window.innerWidth >= MOBILE_BREAKPOINT_PX) return;
            const key = photoKey(slot.spec);
            if (closingBands.some((band) => band.slot === slot && band.key === key)) return;
            const existing = galleryBands.find((band) => band.slot === slot && band.key === key);
            if (existing) {
                closeGalleryBand(existing);
                return;
            }
            const aspect = slot.aspectRatio || viewerAspect(slot.spec, slot);
            const frame = frameForMobileBand(slot.spec, aspect);
            const bandEl = document.createElement('div');
            bandEl.className = 'stream-mobile-band';
            const photoEl = document.createElement('div');
            photoEl.className = 'stream-mobile-photo';
            const small = document.createElement('img');
            small.alt = '';
            small.draggable = false;
            const shown = slot.spec && slot.spec.img;
            small.src = (shown && (shown.currentSrc || shown.src)) || slot.spec.src || '';
            const large = document.createElement('img');
            large.className = 'stream-mobile-large';
            large.alt = '';
            large.draggable = false;
            photoEl.append(small, large);
            photoEl.style.left = `${frame.frameLeft + frame.border}px`;
            photoEl.style.top = `${frame.border}px`;
            photoEl.style.width = `${frame.photoW}px`;
            photoEl.style.height = `${frame.photoH}px`;
            photoEl.style.boxShadow = `0 0 0 ${frame.border}px rgba(255,255,255,0)`;
            bandEl.append(photoEl);
            const rowTop = rowTopPx(slot.row);
            const bandTop = (slot.row + 1) * stridePx() + rowShift(slot.row);
            const scale = frame.photoW > 0 ? slot.width / frame.photoW : 1;
            const fromTransform = `translate(${Math.round(slot.x - (frame.frameLeft + frame.border))}px, ${Math.round(rowTop - (bandTop + frame.border))}px) scale(${scale})`;
            photoEl.style.transformOrigin = '0 0';
            photoEl.style.transform = reducedMotion ? 'none' : fromTransform;
            section.append(bandEl);
            const copy = document.createElement('div');
            copy.className = 'stream-search-copy';
            fillSearchCopy(slot, copy);
            copy.style.left = `${Math.round(frame.frameLeft)}px`;
            copy.style.width = `${Math.round(frame.frameW)}px`;
            copy.style.top = `${frame.border * 2 + frame.photoH + MOBILE_SEARCH_COPY_GAP_PX}px`;
            copy.style.height = 'auto';
            copy.style.visibility = 'hidden';
            bandEl.append(copy);
            const copyH = Math.ceil(copy.getBoundingClientRect().height);
            copy.style.visibility = '';
            slot.copyEl = copy;
            slot.copyHeight = copyH;
            const height = frame.border * 2 + frame.photoH + MOBILE_SEARCH_COPY_GAP_PX + copyH;
            bandEl.style.height = `${height}px`;
            const band = {
                slot,
                row: slot.row,
                el: bandEl,
                photoEl,
                largeEl: large,
                spec: slot.spec,
                key,
                homeWidth: slot.width,
                photoW: frame.photoW,
                photoH: frame.photoH,
                border: frame.border,
                height,
                token: 1,
                closing: false,
                largeOn: false,
                largeLoading: false,
            };
            galleryBands.push(band);
            slot.bandOpen = true;
            slot.paintedOpacity = 0;
            slot.el.style.opacity = '0';
            slot.el.setAttribute('aria-expanded', 'true');
            photoEl.addEventListener('click', (event) => {
                event.stopPropagation();
                closeGalleryBand(band);
            });
            copy.style.opacity = '0';
            section.classList.add('is-band-slide');
            placeAllGalleryRows(MOBILE_SEARCH_SLIDE_MS, 'ease');
            const bandBox = bandEl.getBoundingClientRect();
            scrollOpenedBandIntoView(bandBox.top, rowGapPx);
            syncBandLarges();
            window.setTimeout(() => {
                if (!galleryBands.includes(band) || band.closing) return;
                copy.style.opacity = '1';
                startSearchCopyReveal(slot);
            }, reducedMotion ? 0 : MOBILE_SEARCH_SLIDE_MS);
            if (!reducedMotion) {
                window.setTimeout(() => {
                    if (!galleryBands.includes(band) || band.closing) return;
                    photoEl.style.transition = 'transform 300ms ease, box-shadow 300ms ease';
                    photoEl.style.boxShadow = `0 0 0 ${frame.border}px #fff`;
                    photoEl.style.transform = 'none';
                }, 20);
            } else {
                photoEl.style.boxShadow = `0 0 0 ${frame.border}px #fff`;
            }
        };

        const createSearchSlot = (pos, index) => {
            const rowEl = ensureSearchRow(pos.row);
            const el = document.createElement('div');
            const img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            img.loading = index < 16 ? 'eager' : 'lazy';
            img.decoding = 'async';
            img.src = pos.hit.item.src;
            el.append(img);
            rowEl.append(el);
            const spec = {
                ...pos.hit.item,
                aspectRatio: pos.aspect,
                img,
            };
            const slot = {
                id: 90000 + index,
                el,
                row: pos.row,
                x: pos.x,
                width: pos.width,
                aspectRatio: pos.aspect,
                speed: 0,
                scale: 1,
                frozen: false,
                search: true,
                spec,
            };
            bindItem(slot);
            slot.photoH = pos.photoH || itemHeight;
            slot.searchBorder = pos.border || 0;
            el.style.width = `${pos.width}px`;
            el.style.height = `${slot.photoH}px`;
            if (slot.searchBorder) {
                el.style.top = `${slot.searchBorder}px`;
                el.style.boxShadow = `0 0 0 ${slot.searchBorder}px #fff`;
                el.setAttribute('aria-label', 'Show details');
                el.setAttribute('aria-expanded', 'false');
                if (slot.spec && slot.spec.number != null) {
                    el.dataset.photo = String(slot.spec.number);
                }
            }
            paint(slot);
            return slot;
        };

        const showSearchEmpty = () => {
            searchBoard.classList.add('is-empty');
            const emptyEl = document.createElement('p');
            emptyEl.className = 'stream-search-empty';
            emptyEl.textContent = 'No photos found';
            emptyEl.style.opacity = '0';
            searchBoard.append(emptyEl);
            return emptyEl;
        };

        const revealSearchBoard = () => {
            searchBoard.hidden = false;
            searchBoard.removeAttribute('aria-hidden');
            searchBoard.style.visibility = '';
            searchBoard.style.pointerEvents = '';
        };

        const buildSearchLayout = (hits) => {
            destroySearchBoard();
            revealSearchBoard();
            applyLayoutMetrics();
            cacheStreamOrigin();
            if (!hits.length) {
                const emptyEl = showSearchEmpty();
                syncSearchBoardHeight(0, true);
                return [emptyEl];
            }
            searchBoard.classList.remove('is-empty');
            const stacked = mobileSearchLayout();
            searchBoard.classList.toggle('is-stacked', stacked);
            const positions = stacked ? measureMobileSearchHits(hits) : measureSearchHits(hits);
            positions.forEach((pos, index) => {
                const slot = createSearchSlot(pos, index);
                slot.el.style.opacity = '0';
                searchPool.push(slot);
            });
            if (stacked) {
                layoutMobileSearch();
                if (!reducedMotion) searchBoard.classList.add('is-sliding');
            } else {
                const usedRows = searchPool.reduce((max, slot) => Math.max(max, slot.row + 1), 0);
                syncSearchBoardHeight(usedRows, false);
            }
            return searchPool.map((slot) => slot.el);
        };

        const coverRowForSearchReturn = (rowIndex) => {
            introEntering.delete(rowIndex);
            introPlan.delete(rowIndex);
            if (!holdMotion) {
                pool.forEach((slot) => {
                    if (slot.row === rowIndex && slot.frozen) slot.frozen = false;
                });
            }
            if (!rows[rowIndex]) ensureRow(rowIndex);
            const live = pool.filter((slot) => slot.row === rowIndex && slotIsLive(slot));
            if (!live.length) {
                if (!rowPending.has(rowIndex) && !startedRows.has(rowIndex)) {
                    startRow(rowIndex, 'filled');
                }
                return;
            }
            fillRowLeft(rowIndex);
            fillRowRight(rowIndex);
        };

        const prepareGalleryReturn = () => {
            if (!holdMotion) {
                pool.forEach((slot) => {
                    if (slot.frozen) slot.frozen = false;
                });
            }
            layoutHeld = false;
            layoutHeldUntil = 0;
            gallerySearchFading = false;
            leftFillPaused = false;
            searchFadeOutStartedAt = 0;
            pool.forEach((slot) => {
                slot.fadeOutBorn = false;
            });
            const { first, last } = visibleBounds();
            if (`${first}:${last}` !== mountedKey) mountRange();
            else repairVisibleRows();
            for (let index = first; index <= last; index += 1) {
                coverRowForSearchReturn(index);
            }
            inView = true;
            if (!running) play();
        };

        const resumeGalleryDrift = () => {
            gallerySearchFading = false;
            gallerySearchFrozen = false;
            const fadeAt = performance.now();
            const motionScale = reducedMotion ? REDUCED_MOTION_SPEED_SCALE : 1;
            const dt = lastTime
                ? Math.min(MAX_FRAME_SECONDS, (fadeAt - lastTime) / 1000)
                : Math.min(MAX_FRAME_SECONDS, 1 / 60);
            lastTime = fadeAt;
            positionWriter = 'tick';
            if (motionScale > 0 && dt > 0) {
                pool.forEach((slot) => {
                    if (slot.frozen) return;
                    slot.x += slot.speed * motionScale * dt;
                    paint(slot);
                });
                if (process.env.NODE_ENV !== 'production') {
                    console.info('[search-return]', { driftAfterMs: 0 });
                }
                searchReturnFadeAt = 0;
            } else {
                pool.forEach((slot) => {
                    if (slot.frozen) return;
                    paint(slot);
                });
                searchReturnFadeAt = fadeAt;
            }
            retireExitedTiles();
            coverLiveRows();
            const incoming = visibleGalleryEls(true);
            const incomingSet = new Set(incoming);
            pool.forEach((slot) => {
                if (!slot?.el || !slotIsLive(slot)) return;
                if (incomingSet.has(slot.el)) {
                    slot.el.style.opacity = '0';
                    slot.paintedOpacity = 1;
                    return;
                }
                slot.el.style.opacity = '1';
                slot.paintedOpacity = 1;
            });
            beginSearchGapWatch();
            logSearchBag('after-return');
            return incoming;
        };

        const runSearch = async (rawQuery) => {
            if (!searchInput || viewer || searchBusy) return;
            if (galleryBands.length || closingBands.length) dismissGalleryBands();
            const query = String(rawQuery ?? queryFromInput()).trim();
            if (!query) {
                if (searchActive) await exitSearch();
                return;
            }
            const hits = searchPhotos(searchIndex, query);
            setSearchStatus(query, hits.length);
            syncSearchClear();
            searchBusy = true;
            searchReturnQueued = false;
            const gen = searchGen + 1;
            searchGen = gen;
            searchQuery = query;
            const replacing = searchActive;
            if (!replacing) {
                if (searchBagBefore == null) searchBagBefore = logSearchBag('before-first-search');
                gallerySearchFading = true;
                gallerySearchFrozen = false;
                leftFillPaused = true;
                searchFadeOutStartedAt = performance.now();
            }
            const outgoing = replacing
                ? [...searchBoard.querySelectorAll(searchOutgoingSelector)]
                : visibleGalleryEls();
            await wipeElements(outgoing, false);
            if (cancelled || searchGen !== gen) {
                searchBusy = false;
                if (!searchActive) {
                    gallerySearchFading = false;
                    gallerySearchFrozen = false;
                    leftFillPaused = false;
                    searchFadeOutStartedAt = 0;
                }
                if (searchReturnQueued && searchActive) exitSearch();
                return;
            }
            if (!replacing) {
                hideGalleryForSearch();
                window.scrollTo(0, 0);
            }
            const incoming = buildSearchLayout(hits);
            await wipeElements(incoming, true);
            if (cancelled || searchGen !== gen) {
                searchBusy = false;
                if (searchReturnQueued && searchActive) exitSearch();
                return;
            }
            incoming.forEach((el) => {
                el.style.transition = '';
            });
            searchPool.forEach((slot) => {
                slot.paintedOpacity = 1;
            });
            cacheStreamOrigin();
            searchBusy = false;
            if (searchReturnQueued || (searchActive && !queryFromInput())) {
                searchReturnQueued = false;
                exitSearch();
            }
        };

        const exitSearch = async () => {
            if (viewer) return;
            if (searchBusy) {
                searchReturnQueued = true;
                return;
            }
            if (!searchActive) {
                if (searchInput) searchInput.value = '';
                setSearchStatus('', 0);
                syncSearchClear();
                gallerySearchFading = false;
                gallerySearchFrozen = false;
                leftFillPaused = false;
                searchFadeOutStartedAt = 0;
                return;
            }
            searchBusy = true;
            searchReturnQueued = false;
            const gen = searchGen + 1;
            searchGen = gen;
            searchQuery = '';
            if (searchInput) searchInput.value = '';
            setSearchStatus('', 0);
            syncSearchClear();
            const outgoing = [...searchBoard.querySelectorAll(searchOutgoingSelector)];
            await wipeElements(outgoing, false);
            if (cancelled || searchGen !== gen) {
                searchBusy = false;
                return;
            }
            destroySearchBoard();
            pool.forEach((slot) => {
                if (!slot?.el) return;
                slot.el.style.opacity = '0';
                slot.paintedOpacity = 0;
            });
            restoreGalleryAfterSearch();
            prepareGalleryReturn();
            const incoming = resumeGalleryDrift();
            await wipeElements(incoming, true);
            if (cancelled || searchGen !== gen) {
                searchBusy = false;
                return;
            }
            incoming.forEach((el) => {
                el.style.transition = '';
            });
            pool.forEach((slot) => {
                if (!incoming.includes(slot.el)) return;
                slot.paintedOpacity = 1;
            });
            searchBusy = false;
            syncPlayback();
        };

        const onSearchSubmit = (event) => {
            event.preventDefault();
            runSearch(queryFromInput());
        };

        const onSearchInput = () => {
            syncSearchClear();
            const query = queryFromInput();
            const deletedLetter = searchActive && query.length < String(searchQuery || '').length;
            if (query && !deletedLetter) {
                searchReturnQueued = false;
                return;
            }
            if (!searchActive && !searchBusy) return;
            if (searchBusy) {
                searchReturnQueued = true;
                return;
            }
            exitSearch();
        };

        const onSearchClear = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (searchActive) {
                exitSearch();
                return;
            }
            if (searchInput) searchInput.value = '';
            setSearchStatus('', 0);
            syncSearchClear();
            searchInput?.focus();
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
        let panelTouchY = 0;
        let panelTouchMoved = false;
        panel.addEventListener('touchstart', (event) => {
            panelTouchMoved = false;
            panelTouchY = event.touches[0] ? event.touches[0].clientY : 0;
        }, { passive: true });
        panel.addEventListener('touchmove', (event) => {
            const y = event.touches[0] ? event.touches[0].clientY : panelTouchY;
            if (Math.abs(y - panelTouchY) > 8) panelTouchMoved = true;
        }, { passive: true });
        panel.addEventListener('click', (event) => {
            if (!viewer) return;
            if (panelTouchMoved) {
                panelTouchMoved = false;
                return;
            }
            if (event.target.closest('a')) return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) return;
            closeViewer();
        });
        const onKeyDown = (event) => {
            if (
                mobileOpenScroll
                && (event.key === 'ArrowDown'
                    || event.key === 'ArrowUp'
                    || event.key === 'PageDown'
                    || event.key === 'PageUp'
                    || event.key === 'Home'
                    || event.key === 'End'
                    || event.key === ' ')
            ) {
                cancelMobileOpenScroll();
            }
            if (event.key === 'Escape') {
                if (viewer) {
                    closeViewer();
                    return;
                }
                if (searchActive || (searchInput && searchInput.value)) {
                    event.preventDefault();
                    exitSearch();
                }
                return;
            }
            if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                const target = event.target;
                const typing = target && (
                    target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.isContentEditable
                );
                if (typing || !searchInput || viewer) return;
                event.preventDefault();
                searchInput.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        if (searchForm) {
            searchForm.addEventListener('submit', onSearchSubmit);
        }
        if (searchInput) {
            searchInput.addEventListener('input', onSearchInput);
        }
        if (searchClear) {
            searchClear.addEventListener('click', onSearchClear);
        }
        syncSearchClear();

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
            introSchedule.sort((a, b) => a.at - b.at);
            introNextAt =
                (schedule[schedule.length - 1]?.at || INTRO_FIRST_DELAY_SECONDS) +
                INTRO_MIN_GAP_SECONDS;
            mountRange();
            syncPlayback();
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
                    inView = true;
                    coverLiveRows();
                    syncPlayback();
                }
            );
        }

        const intersection = new IntersectionObserver(
            ([entry]) => {
                if (searchActive || viewer || holdMotion) {
                    inView = true;
                    syncPlayback();
                    return;
                }
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
            if (
                mobileOpenScroll
                && Math.abs((window.scrollY || window.pageYOffset || 0) - mobileOpenScroll.expected) > 1.5
            ) {
                cancelMobileOpenScroll();
            }
            if (searchActive) {
                cacheStreamOrigin();
                if (fineHover) syncHover();
                return;
            }
            if (suppressScroll || scrollLockY != null || pageIsZoomed()) return;
            if (layoutWritesQuiet()) return;
            if (viewer && viewer.phase === 'closing') return;
            const y = pageScroll();
            const t = performance.now();
            if (y > lastScrollY + 1) scrollDir = 1;
            else if (y < lastScrollY - 1) scrollDir = -1;
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
                syncBandLarges();
                const { first, last } = visibleBounds();
                if (`${first}:${last}` !== mountedKey) mountRange();
                else repairVisibleRows();
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        const interruptMobileOpenScroll = () => {
            if (mobileOpenScroll) cancelMobileOpenScroll();
        };
        window.addEventListener('wheel', interruptMobileOpenScroll, { passive: true });
        window.addEventListener('touchstart', interruptMobileOpenScroll, { passive: true });

        let resizeFrame = 0;
        const onResize = () => {
            if (pageIsZoomed()) return;
            if (!searchActive && layoutWritesQuiet() && !galleryBands.length && !closingBands.length) return;
            if (resizeFrame) return;
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                if (cancelled || pageIsZoomed()) return;
                if (galleryBands.length || closingBands.length) dismissGalleryBands();
                if (!searchActive && layoutWritesQuiet()) return;
                if (viewer && viewer.phase === 'closing') return;
                if (searchActive) {
                    applyLayoutMetrics();
                    cacheStreamOrigin();
                    if (!viewer && searchQuery) {
                        const incoming = buildSearchLayout(searchPhotos(searchIndex, searchQuery));
                        incoming.forEach((el) => {
                            el.style.transition = 'none';
                            el.style.opacity = '1';
                        });
                    } else if (viewer) {
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
                    return;
                }
                if (layoutWritesQuiet()) return;
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
                coverLiveRows();
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
            if (searchActive || viewer || layoutWritesQuiet()) return;
            repairVisibleRows();
        }, 500);

        return () => {
            cancelled = true;
            window.clearInterval(repairTimer);
            clearIntroSchedule();
            pause();
            intersection.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('keydown', onKeyDown);
            if (searchForm) searchForm.removeEventListener('submit', onSearchSubmit);
            if (searchInput) searchInput.removeEventListener('input', onSearchInput);
            if (searchClear) searchClear.removeEventListener('click', onSearchClear);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('wheel', interruptMobileOpenScroll);
            window.removeEventListener('touchstart', interruptMobileOpenScroll);
            cancelMobileOpenScroll();
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
            destroySearchBoard();
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
                <form
                    className="stream-search"
                    role="search"
                    action="#"
                    autoComplete="off"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <div className="stream-search-field">
                        <img
                            className="stream-search-glass"
                            src={searchGlass}
                            alt=""
                            aria-hidden="true"
                        />
                        <input
                            className="stream-search-input"
                            type="search"
                            name="q"
                            placeholder="Search"
                            aria-label="Search photos"
                            autoComplete="off"
                            spellCheck="false"
                            enterKeyHint="search"
                        />
                        <button
                            type="button"
                            className="stream-search-clear"
                            aria-label="Clear search"
                            hidden
                        >
                            ×
                        </button>
                    </div>
                    <p className="stream-search-status" role="status" hidden />
                </form>
            </div>

            <section
                ref={sectionRef}
                className="floating-streams"
                aria-label="Floating image streams"
            />
            <section
                ref={searchBoardRef}
                className="floating-streams stream-search-board"
                aria-label="Search results"
                hidden
            />
        </div>
    );
}

export default Clothing; 
