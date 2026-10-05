import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Clothing.css';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
const CROSSING_TIME_SECONDS = 14;
const ROW_BUFFER = 1;

// clamp(ITEM_HEIGHT_MIN_PX, ITEM_HEIGHT_VW * 1vw, ITEM_HEIGHT_MAX_PX)
const ITEM_HEIGHT_MIN_PX = 70;
const ITEM_HEIGHT_VW = 10;
const ITEM_HEIGHT_MAX_PX = 120;

const ITEM_GAP_PX = 40;
const VERTICAL_GAP_RATIO = 0.5; // gap between rows, as a fraction of item height

// First row (the middle one on screen) starts after this delay.
const INTRO_FIRST_DELAY_SECONDS = 1.0;
// Random wait between row starts. Never shorter than the minimum.
const INTRO_MIN_GAP_SECONDS = 0.3;
const INTRO_MAX_GAP_SECONDS = 2.0;
// The last on-screen row aims to start at this time.
const INTRO_TARGET_SECONDS = 7.0;
const INTRO_PLAY_ONCE_PER_VISIT = true;
const INTRO_STORAGE_KEY = 'clothing-intro-played';

// Used only if sessionStorage is unavailable.
let introPlayedThisVisit = false;

const MAX_FRAME_SECONDS = 1 / 30;

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
const MOBILE_OPEN_SPEED = 0.45;
const DECODE_CONCURRENCY = 3;

// Click-to-open viewer
const OPEN_TRANSITION_MS = 700;
const OPEN_EASE_POINTS = [0.22, 1, 0.36, 1];
const OPEN_EASING = `cubic-bezier(${OPEN_EASE_POINTS.join(', ')})`;
const VIEWER_GAP_PX = 32;
const VIEWER_BORDER_MIN_PX = 12;
const VIEWER_BORDER_MAX_PX = 48;
const CLOSE_BUTTON_GAP_PX = 10;
const CLOSE_BUTTON_PX = 44;
// ---------------------------------------------------------------------------
// Item library — web-sized photos. src = rows, srcFull = enlarged view.
// Raise PHOTO_COUNT when a new batch is added. Files are photo-1 through photo-N.
// ---------------------------------------------------------------------------
const PHOTO_COUNT = 166;
const PHOTO_DIR = '/photos/Website digital/Photography';
// 47 and 50 are held out on purpose.
// 114–121 have a small export in the Large folder.
const EXCLUDED_PHOTOS = [47, 50, 114, 115, 116, 117, 118, 119, 120, 121];

const STREAM_LIBRARY = Array.from({ length: PHOTO_COUNT }, (_, index) => index + 1)
    .filter((number) => !EXCLUDED_PHOTOS.includes(number))
    .map((number) => ({
        number,
        id: `photo-${number}`,
        src: `${PHOTO_DIR}/small/small-photo-${number}.jpg`,
        srcFull: `${PHOTO_DIR}/Large/Large-photo-${number}.jpg`,
    }));

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
    const middle = rowIndexes[Math.floor((count - 1) / 2)];
    const rest = shuffle(rowIndexes.filter((index) => index !== middle));
    const order = [middle, ...rest];
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

function easeOpen(amount) {
    const [x1, y1, x2, y2] = OPEN_EASE_POINTS;
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

function lerpPose(from, to, amount) {
    return {
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount,
        scale: from.scale + (to.scale - from.scale) * amount,
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

function decodeElements(root) {
    const images = [...root.querySelectorAll('img')];
    return Promise.all(
        images.map((img) =>
            typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()
        )
    );
}

function decodeSmallImage(item) {
    if (!item.src) {
        return Promise.resolve({ ...item, aspectRatio: item.aspectRatio || 1 });
    }

    return new Promise((resolve) => {
        const image = new Image();
        const finish = (ratio) => {
            resolve({ ...item, aspectRatio: ratio || 1 });
        };

        image.onload = () => {
            const ratio =
                image.naturalWidth && image.naturalHeight
                    ? image.naturalWidth / image.naturalHeight
                    : 1;
            if (typeof image.decode === 'function') {
                image
                    .decode()
                    .then(() => finish(ratio))
                    .catch(() => finish(ratio));
            } else {
                finish(ratio);
            }
        };
        image.onerror = () => finish(1);
        image.src = encodeURI(item.src);
    });
}

async function mapWithConcurrency(items, concurrency, fn) {
    let cursor = 0;
    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            await fn(items[index]);
        }
    };
    const workers = [];
    const count = Math.max(1, Math.min(concurrency, items.length));
    for (let i = 0; i < count; i += 1) workers.push(worker());
    await Promise.all(workers);
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
        const transitionMs = reducedMotion ? 1 : OPEN_TRANSITION_MS;
        section.style.setProperty('--stream-open-ms', `${transitionMs}ms`);
        section.style.setProperty('--stream-open-ease', OPEN_EASING);

        const pool = [];
        const decodePromises = new Map();
        const decodedSpecs = new Map();
        const introTimers = [];
        const startedRows = new Set();
        let deck = shuffle(STREAM_LIBRARY);
        let deckCursor = 0;
        const reserved = new Set();
        let rafId = 0;
        let running = false;
        let inView = true;
        let lastTime = 0;
        let viewportWidth = 0;
        let itemHeight = 0;
        let baseSpeed = 0;
        let cancelled = false;

        const overlay = document.createElement('div');
        overlay.className = 'stream-overlay';
        overlay.hidden = true;

        const makeFlyer = () => {
            const root = document.createElement('div');
            root.className = 'stream-flyer';
            root.setAttribute('role', 'img');
            root.hidden = true;

            const small = document.createElement('img');
            small.alt = '';
            small.draggable = false;
            small.className = 'stream-flyer-small';

            const large = document.createElement('img');
            large.alt = '';
            large.draggable = false;
            large.className = 'stream-flyer-large';
            root.append(small, large);
            document.body.append(root);
            return { root, small, large };
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

        document.body.append(overlay, closeBtn);

        const menuEl = section.parentElement
            ? section.parentElement.querySelector('.header-nav')
            : null;
        const rowPose = [];
        const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        let pointerX = 0;
        let pointerY = 0;
        let pointerInside = false;
        let hoverSlot = null;
        const largePromises = new Map();
        let viewer = null;

        const opacityForSlot = (slot) => {
            if (!viewer) return null;
            if (slot === viewer.slot) return viewer.thumbOpacity;
            const departing = viewer.departures.find((item) => item.slot === slot);
            return departing ? departing.thumbOpacity : null;
        };

        let scrollLockY = null;
        const pageStartedAt = performance.now();

        let streamOriginX = 0;
        let streamOriginY = 0;
        const cacheStreamOrigin = () => {
            const rect = section.getBoundingClientRect();
            streamOriginY = rect.top + pageScroll();
            streamOriginX = rect.left + (window.scrollX || window.pageXOffset || 0);
        };
        const applyLayoutMetrics = () => {
            viewportWidth = section.clientWidth || window.innerWidth;
            itemHeight = clampItemHeight(window.innerWidth);
            baseSpeed = (viewportWidth + itemHeight) / CROSSING_TIME_SECONDS;
            section.style.setProperty('--stream-item-height', `${itemHeight}px`);
            section.style.setProperty(
                '--stream-row-gap',
                `${itemHeight * VERTICAL_GAP_RATIO}px`
            );
            cacheStreamOrigin();
        };

        const stridePx = () => itemHeight * (1 + VERTICAL_GAP_RATIO);
        const pageScroll = () =>
            scrollLockY == null ? window.scrollY || window.pageYOffset || 0 : scrollLockY;
        const viewHeight = () => {
            const viewport = window.visualViewport;
            if (viewport && viewport.height) return viewport.height;
            return window.innerHeight;
        };

        const visibleBounds = () => {
            const origin = section.offsetTop;
            const viewTop = pageScroll();
            const viewBottom = viewTop + viewHeight();
            const stride = stridePx();
            if (!(stride > 0)) return { first: 0, last: 0 };
            let first = null;
            let last = null;
            const start = Math.max(0, Math.floor((viewTop - origin) / stride) - 1);
            for (let index = start; index < start + 60; index += 1) {
                const rowTop = origin + index * stride;
                if (rowTop >= viewBottom) break;
                if (rowTop + itemHeight > viewTop) {
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
            scrollLockY = window.scrollY || window.pageYOffset || 0;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollLockY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.documentElement.style.overflow = 'hidden';
            document.addEventListener('touchmove', blockTouchScroll, { passive: false });
        };

        const unlockScroll = () => {
            document.removeEventListener('touchmove', blockTouchScroll);
            if (scrollLockY == null) return;
            const y = scrollLockY;
            scrollLockY = null;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
            window.scrollTo(0, y);
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

        const decodeSmall = (item) => {
            const key = item.src || item.id;
            if (decodedSpecs.has(key)) return Promise.resolve(decodedSpecs.get(key));
            if (!decodePromises.has(key)) {
                decodePromises.set(
                    key,
                    decodeSmallImage(item).then((resolved) => {
                        decodedSpecs.set(key, resolved);
                        return resolved;
                    })
                );
            }
            return decodePromises.get(key);
        };

        const photoKey = (item) => (item && (item.src || item.id)) || '';

        const photosPerRow = () => {
            const { first, last } = visibleBounds();
            const capacity = Math.max(1, last - first + 1 + ROW_BUFFER * 2);
            const wanted = computePerRow();
            const maxEven = Math.max(1, Math.floor(STREAM_LIBRARY.length / capacity));
            return Math.min(wanted, maxEven);
        };

        const occupiedKeys = (exceptSlot) => {
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
            reserved.forEach((key) => keys.add(key));
            return keys;
        };

        const refillDeck = () => {
            deck = shuffle(STREAM_LIBRARY);
            deckCursor = 0;
        };

        const nextRawItem = (exceptSlot) => {
            const occupied = occupiedKeys(exceptSlot);
            if (exceptSlot?.spec) occupied.add(photoKey(exceptSlot.spec));
            for (let pass = 0; pass < 2; pass += 1) {
                while (deckCursor < deck.length) {
                    const item = deck[deckCursor];
                    deckCursor += 1;
                    const key = photoKey(item);
                    if (!key || occupied.has(key)) continue;
                    reserved.add(key);
                    return item;
                }
                if (pass === 0) refillDeck();
            }
            return null;
        };

        const peekUpcoming = (count) => {
            const occupied = occupiedKeys(null);
            const upcoming = [];
            let index = deckCursor;
            while (index < deck.length && upcoming.length < count) {
                const item = deck[index];
                index += 1;
                const key = photoKey(item);
                if (!key || occupied.has(key)) continue;
                occupied.add(key);
                upcoming.push(item);
            }
            return upcoming;
        };

        const releaseReserved = (spec) => {
            const key = photoKey(spec);
            if (key) reserved.delete(key);
        };

        const applyVisuals = (slot, spec) => {
            slot.spec = spec;
            slot.aspectRatio = spec.aspectRatio || 1;
            slot.width = itemHeight * slot.aspectRatio;
            slot.el.style.width = `${slot.width}px`;
            slot.el.style.height = `${itemHeight}px`;
            slot.el.style.backgroundImage = 'none';

            let photo = slot.el.querySelector('img');
            if (spec.src) {
                if (!photo) {
                    photo = document.createElement('img');
                    photo.alt = '';
                    photo.draggable = false;
                    slot.el.appendChild(photo);
                }
                photo.src = encodeURI(spec.src);
                slot.el.style.backgroundColor = 'transparent';
            } else {
                if (photo) photo.remove();
                slot.el.style.backgroundColor = spec.color;
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

        const leftmostInRow = (rowIndex, except) => {
            let leftmost = null;
            for (let i = 0; i < pool.length; i += 1) {
                const slot = pool[i];
                if (slot.row !== rowIndex || slot === except) continue;
                if (!leftmost || slot.x < leftmost.x) leftmost = slot;
            }
            return leftmost;
        };

        const slotIsHeld = (slot) =>
            !!viewer &&
            (viewer.slot === slot || viewer.departures.some((departure) => departure.slot === slot));

        const displayedSpec = (slot) => {
            const image = slot.el && slot.el.querySelector('img');
            const shown = image && (image.currentSrc || image.src);
            if (slot.spec && (!shown || urlsMatch(shown, slot.spec.src))) return slot.spec;
            const libraryItem = STREAM_LIBRARY.find((item) => urlsMatch(shown, item.src));
            if (!libraryItem) return slot.spec;
            return decodedSpecs.get(libraryItem.src || libraryItem.id) || { ...libraryItem };
        };

        const recycle = (slot) => {
            if (slot.frozen || slotIsHeld(slot)) return;
            const raw = nextRawItem(slot);
            if (!raw) {
                const index = pool.indexOf(slot);
                if (index >= 0) pool.splice(index, 1);
                if (slot === hoverSlot) hoverSlot = null;
                slot.el.remove();
                return;
            }
            const place = (spec) => {
                if (cancelled || !slot.el.isConnected) return;
                if (slot === hoverSlot) {
                    slot.el.classList.remove('is-hovered');
                    hoverSlot = null;
                }
                if (slotIsHeld(slot)) {
                    releaseReserved(spec);
                    slot.frozen = false;
                    return;
                }
                const neighbor = leftmostInRow(slot.row, slot);
                applyVisuals(slot, spec);
                releaseReserved(spec);
                slot.frozen = false;
                slot.x = neighbor
                    ? neighbor.x - slot.width - ITEM_GAP_PX
                    : -slot.width;
                paint(slot);
            };
            const cached = decodedSpecs.get(raw.src || raw.id);
            if (cached) {
                place(cached);
            } else {
                slot.frozen = true;
                decodeSmall(raw).then(place);
            }
        };

        const warmLarge = (spec) => {
            if (!spec?.srcFull) return Promise.resolve(null);
            const key = spec.srcFull;
            if (!largePromises.has(key)) {
                largePromises.set(
                    key,
                    new Promise((resolve) => {
                        const image = new Image();
                        image.onload = () => {
                            const done = () => resolve(image);
                            if (typeof image.decode === 'function') {
                                image.decode().then(done).catch(done);
                            } else {
                                done();
                            }
                        };
                        image.onerror = () => resolve(null);
                        image.src = encodeURI(spec.srcFull);
                    })
                );
            }
            return largePromises.get(key);
        };

        let backgroundLarges = 0;
        const ensureUpcomingSmalls = () => {
            const pending = peekUpcoming(photosPerRow()).filter((item) => {
                const key = item.src || item.id;
                return key && !decodedSpecs.has(key) && !decodePromises.has(key);
            });
            return mapWithConcurrency(pending, DECODE_CONCURRENCY, decodeSmall);
        };

        const prefetchUpcomingLarge = () => {
            const room = 6 - backgroundLarges;
            if (room <= 0) return Promise.resolve();
            const pending = peekUpcoming(room).filter((item) => item.srcFull && !largePromises.has(item.srcFull));
            backgroundLarges += pending.length;
            return mapWithConcurrency(pending, DECODE_CONCURRENCY, warmLarge);
        };

        let upcomingTask = null;
        let prefetchedAhead = false;
        const scheduleUpcoming = () => {
            if (prefetchedAhead || upcomingTask) return;
            prefetchedAhead = true;
            upcomingTask = Promise.all([ensureUpcomingSmalls(), prefetchUpcomingLarge()]).finally(
                () => {
                    upcomingTask = null;
                }
            );
        };

        const applyRows = (amount) => {
            const frameTop = viewer ? viewer.frameTop : -1;
            const frameBottom = viewer ? viewer.frameBottom : -1;
            rows.forEach((row, index) => {
                if (!row) return;
                const framing = index === frameTop || index === frameBottom;
                const between = index > frameTop && index < frameBottom;
                const targetOpacity = viewer && between ? 0 : 1;
                const ty = 0;
                const scale = 1;
                const opacity = 1 + (targetOpacity - 1) * amount;
                const idle =
                    amount === 0 ||
                    (Math.abs(ty) < 0.01 && Math.abs(scale - 1) < 0.001);
                row.style.transformOrigin = 'top center';
                if (idle) {
                    row.style.transform = '';
                } else {
                    let transform = `translate3d(0, ${ty}px, 0)`;
                    if (Math.abs(scale - 1) > 0.001) transform += ` scale(${scale})`;
                    row.style.transform = transform;
                }
                row.style.opacity = String(opacity);
                const blocked = opacity < 0.2;
                if (row.dataset.blocked !== (blocked ? '1' : '0')) {
                    row.dataset.blocked = blocked ? '1' : '0';
                    row.querySelectorAll('.stream-item').forEach((item) => {
                        item.style.pointerEvents = blocked ? 'none' : '';
                    });
                }
                if (amount > 0.02 && framing) {
                    row.style.zIndex = '45';
                    row.style.pointerEvents = 'none';
                } else if (blocked) {
                    row.style.zIndex = '';
                    row.style.pointerEvents = 'none';
                } else {
                    row.style.zIndex = '';
                    row.style.pointerEvents = '';
                }
                rowPose[index] = { ty, scale };
            });
            section.classList.toggle('is-viewer-open', amount > 0.02);
            if (menuEl) {
                menuEl.style.opacity = String(1 - amount);
                menuEl.style.pointerEvents = amount > 0.85 ? 'none' : '';
            }
        };

        const measureRows = () => {
            const bases = [];
            rows.forEach((row, index) => {
                if (!row) return;
                const rect = row.getBoundingClientRect();
                bases[index] = {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                };
            });
            return bases;
        };

        const layoutViewer = (spec, bases) => {
            const topIndex = viewer ? viewer.frameTop : visibleBounds().first;
            const bottomIndex = viewer ? viewer.frameBottom : visibleBounds().last;
            const topRow = bases[topIndex] || bases.find(Boolean);
            const bottomRow = bases[bottomIndex] || [...bases].reverse().find(Boolean);
            if (!topRow || !bottomRow) {
                const border = viewerBorderPx();
                const maxTotalH = Math.max(80, viewHeight() - VIEWER_GAP_PX * 2);
                const maxTotalW = Math.max(80, window.innerWidth - VIEWER_GAP_PX * 2);
                const inner = fitInBox(
                    (spec && spec.aspectRatio) || 1,
                    Math.max(40, maxTotalW - border * 2),
                    Math.max(40, maxTotalH - border * 2)
                );
                const totalW = inner.width + border * 2;
                const totalH = inner.height + border * 2;
                return {
                    border,
                    inner,
                    totalW,
                    totalH,
                    endLeft: (window.innerWidth - totalW) / 2,
                    endTop: (viewHeight() - totalH) / 2,
                };
            }
            const border = viewerBorderPx();
            const gapTop = topRow.top + topRow.height + VIEWER_GAP_PX;
            const gapBottom = bottomRow.top - VIEWER_GAP_PX;
            const visibleTop = Math.max(gapTop, VIEWER_GAP_PX);
            const visibleBottom = Math.min(gapBottom, viewHeight() - VIEWER_GAP_PX);
            const betweenRows = visibleBottom - visibleTop;
            const room = viewHeight() - VIEWER_GAP_PX * 2;
            const maxTotalH = Math.max(80, Math.min(room, betweenRows > 40 ? betweenRows : room));
            const maxTotalW = Math.max(80, window.innerWidth - VIEWER_GAP_PX * 2);
            const inner = fitInBox(
                (spec && spec.aspectRatio) || 1,
                Math.max(40, maxTotalW - border * 2),
                Math.max(40, maxTotalH - border * 2)
            );
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const endLeft = (window.innerWidth - totalW) / 2;
            let endTop = visibleTop + Math.max(0, maxTotalH - totalH) / 2;
            endTop = Math.max(
                VIEWER_GAP_PX,
                Math.min(endTop, viewHeight() - totalH - VIEWER_GAP_PX)
            );

            return {
                border,
                inner,
                totalW,
                totalH,
                endLeft,
                endTop,
            };
        };

        const poseFromThumb = (thumb, layout) => {
            const scale = thumb.width / Math.max(1, layout.inner.width);
            return {
                x: thumb.left - layout.border * scale,
                y: thumb.top - layout.border * scale,
                scale,
            };
        };

        const liveThumb = (slot) => {
            const base = viewer.rowBases[slot.row];
            const pose = rowPose[slot.row];
            if (!base || !pose) {
                const rect = slot.el.getBoundingClientRect();
                return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            }
            const scale = pose.scale || 1;
            const originX = base.left + base.width / 2;
            return {
                left: originX + (slot.x - base.width / 2) * scale,
                top: base.top + pose.ty,
                width: slot.width * scale,
                height: itemHeight * scale,
            };
        };

        const placeNode = (node, pose) => {
            node.root.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`;
        };

        const releaseFlyer = (node) => {
            if (!node) return;
            node.root.style.willChange = 'auto';
            node.small.removeAttribute('src');
            node.large.removeAttribute('src');
            node.small.style.visibility = '';
            node.large.style.opacity = '0';
            if (node === homeFlyer) {
                node.root.hidden = true;
                return;
            }
            node.root.remove();
        };

        const sizeFlyer = (node, layout) => {
            const previousWidth = parseFloat(node.root.style.width) || 0;
            const previousHeight = parseFloat(node.root.style.height) || 0;
            const resized =
                previousWidth > 0 &&
                (Math.abs(previousWidth - layout.totalW) > 1 || Math.abs(previousHeight - layout.totalH) > 1);
            node.root.style.transition = resized
                ? `width ${OPEN_TRANSITION_MS}ms ${OPEN_EASING}, height ${OPEN_TRANSITION_MS}ms ${OPEN_EASING}, padding ${OPEN_TRANSITION_MS}ms ${OPEN_EASING}`
                : 'none';
            node.root.style.width = `${layout.totalW}px`;
            node.root.style.height = `${layout.totalH}px`;
            node.root.style.padding = `${layout.border}px`;
            node.large.style.top = `${layout.border}px`;
            node.large.style.left = `${layout.border}px`;
            node.large.style.width = `${layout.inner.width}px`;
            node.large.style.height = `${layout.inner.height}px`;
        };

        const configureFlyer = (node, layout, spec) => {
            const { root, small, large } = node;
            sizeFlyer(node, layout);
            root.style.transformOrigin = '0 0';
            root.style.willChange = 'transform';
            root.hidden = false;
            small.style.visibility = 'visible';
            large.style.opacity = '0';
            large.removeAttribute('src');
            small.src = spec && spec.src ? encodeURI(spec.src) : '';
        };

        const showLarge = (node) => {
            node.small.style.visibility = 'hidden';
            node.large.style.opacity = '1';
        };

        const armLarge = (node, spec) => {
            const reveal = (image) => {
                if (!image || activeFlyer !== node) return;
                if (!viewer || viewer.spec !== spec || viewer.largeShown) return;
                node.large.src = image.src;
                showLarge(node);
                viewer.largeReady = true;
                viewer.largeOpacity = 1;
                viewer.largeShown = true;
            };
            const ready = warmLarge(spec).then((image) => {
                if (!image) return null;
                if (typeof image.decode !== 'function') return image;
                return image.decode().then(() => image).catch(() => image);
            });
            const waitForOpen = window.innerWidth <= MOBILE_BREAKPOINT_PX
                && viewer
                && (viewer.phase === 'opening' || viewer.phase === 'switching');
            if (!waitForOpen) {
                ready.then(reveal);
                return;
            }
            const elapsed = performance.now() - viewer.t0;
            window.setTimeout(() => {
                ready.then(reveal);
            }, Math.max(0, viewer.duration - elapsed));
        };

        const placeOverlay = (pose, layout) => {
            viewer.pose = pose;
            placeNode(activeFlyer, pose);
            const right = pose.x + layout.totalW * pose.scale;
            const top = pose.y;
            let closeX = right + CLOSE_BUTTON_GAP_PX;
            let closeY = top;
            if (closeX + CLOSE_BUTTON_PX > window.innerWidth - 8) {
                closeX = Math.max(8, right - CLOSE_BUTTON_PX);
                closeY = Math.max(8, top - CLOSE_BUTTON_PX - 4);
            }
            closeBtn.style.transform = `translate3d(${closeX}px, ${closeY}px, 0)`;
        };

        const finishViewer = () => {
            if (!viewer) return;
            const slot = viewer.slot;
            const departures = viewer.departures;
            const flyer = activeFlyer;
            viewer = null;
            slot.el.style.opacity = '1';
            departures.forEach((dep) => {
                dep.slot.el.style.opacity = '1';
                releaseFlyer(dep.flyer);
            });
            applyRows(0);
            releaseFlyer(flyer);
            activeFlyer = homeFlyer;
            unlockScroll();
            overlay.hidden = true;
            closeBtn.hidden = true;
            closeBtn.style.willChange = 'auto';
            if (menuEl) {
                menuEl.style.opacity = '';
                menuEl.style.pointerEvents = '';
            }
            section.classList.remove('is-viewer-open');
            syncPlayback();
        };

        const advanceDepartures = (now) => {
            if (!viewer) return;
            const duration = Math.max(1, viewer.duration);
            viewer.departures = viewer.departures.filter((dep) => {
                const amount = easeOpen(Math.min(1, (now - dep.t0) / duration));
                const live = poseFromThumb(liveThumb(dep.slot), dep.layout);
                const pose = lerpPose(dep.from, live, amount);
                dep.pose = pose;
                dep.thumbOpacity = amount;
                dep.slot.el.style.opacity = String(amount);
                placeNode(dep.flyer, pose);
                if (amount >= 1) {
                    dep.slot.el.style.opacity = '1';
                    releaseFlyer(dep.flyer);
                    return false;
                }
                return true;
            });
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
                    placeOverlay(viewer.to, viewer.layout);
                    viewer.settled = true;
                }
                if (viewer.largeReady && !viewer.largeShown) showLarge(activeFlyer);
                return;
            }
            viewer.settled = false;
            const duration = Math.max(1, viewer.duration);

            if (viewer.rowMotion === 'in') {
                viewer.rowAmount = easeOpen(Math.min(1, (now - viewer.rowT0) / duration));
                if (viewer.rowAmount >= 1) viewer.rowMotion = 'hold';
            } else if (viewer.rowMotion === 'out') {
                viewer.rowAmount = 1 - easeOpen(Math.min(1, (now - viewer.rowT0) / duration));
        } else {
                viewer.rowAmount = 1;
            }
            applyRows(viewer.rowAmount);

            if (viewer.phase === 'opening' || viewer.phase === 'switching') {
                const amount = easeOpen(Math.min(1, (now - viewer.t0) / duration));
                viewer.thumbOpacity = 0;
                placeOverlay(lerpPose(viewer.from, viewer.to, amount), viewer.layout);
                if (amount >= 1) {
                    viewer.phase = 'open';
                    activeFlyer.root.style.willChange = 'auto';
                    closeBtn.style.willChange = 'auto';
                }
            } else if (viewer.phase === 'open') {
                viewer.thumbOpacity = 0;
                placeOverlay(viewer.to, viewer.layout);
            } else if (viewer.phase === 'closing') {
                const amount = easeOpen(Math.min(1, (now - viewer.closeT0) / duration));
                viewer.thumbOpacity = amount;
                viewer.closeDone = amount >= 1;
                const live = poseFromThumb(liveThumb(viewer.slot), viewer.layout);
                placeOverlay(lerpPose(viewer.closeFrom, live, amount), viewer.layout);
            }

            advanceDepartures(now);

            if (!viewer) return;
            if (viewer.largeReady) {
                viewer.largeOpacity = 1;
                showLarge(activeFlyer);
            }
            closeBtn.style.opacity = String(viewer.rowAmount);
            closeBtn.style.pointerEvents = viewer.rowAmount > 0.08 && !viewer.closeDone ? 'auto' : 'none';

            if (viewer.phase === 'closing' && viewer.closeDone) {
                activeFlyer.root.hidden = true;
                viewer.slot.el.style.opacity = '1';
                viewer.thumbOpacity = 1;
                if (viewer.departures.length === 0) finishViewer();
            }
        };

        const openViewer = (slot) => {
            const spec = slot && displayedSpec(slot);
            if (viewer || !spec) return;

            const now = performance.now();
            lockScroll();
            const frames = visibleBounds();
            const bases = measureRows();
            const layout = layoutViewer(spec, bases);
            const thumb = slot.el.getBoundingClientRect();
            const from = poseFromThumb(
                {
                    left: thumb.left,
                    top: thumb.top,
                    width: thumb.width,
                    height: thumb.height,
                },
                layout
            );
            const to = { x: layout.endLeft, y: layout.endTop, scale: 1 };

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
                pose: from,
                layout,
                rowBases: bases,
                frameTop: frames.first,
                frameBottom: frames.last,
                rowMotion: 'in',
                rowT0: now,
                rowAmount: 0,
                thumbOpacity: 0,
                closeFrom: null,
                closeT0: 0,
                closeDone: false,
                departures: [],
                largeReady: false,
                largeOpacity: 0,
                largeFadeStart: 0,
                settled: false,
                largeShown: false,
            };

            configureFlyer(activeFlyer, layout, spec);
            placeOverlay(from, layout);
            overlay.hidden = false;
            closeBtn.hidden = false;
            closeBtn.style.opacity = '0';
            closeBtn.style.willChange = 'transform, opacity';
            paint(slot);
            applyRows(0);
            play();
            armLarge(activeFlyer, spec);
            closeBtn.focus({ preventScroll: true });
        };

        const isFramingRow = (rowIndex) =>
            !!viewer && (rowIndex === viewer.frameTop || rowIndex === viewer.frameBottom);

        const switchTo = (slot) => {
            if (!viewer || viewer.phase === 'closing' || slot === viewer.slot) return;
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
                layout = layoutViewer(spec, viewer.rowBases);
                node = trackFlyer(makeFlyer());
                const thumb = slot.el.getBoundingClientRect();
                from = poseFromThumb(
                    {
                        left: thumb.left,
                        top: thumb.top,
                        width: thumb.width,
                        height: thumb.height,
                    },
                    layout
                );
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
            });
            activeFlyer = node;
            node.root.style.willChange = 'transform';
            document.body.append(node.root);

            viewer.slot = slot;
            viewer.spec = spec;
            viewer.shownKey = photoKey(spec);
            viewer.phase = 'switching';
            viewer.t0 = now;
            viewer.from = from;
            viewer.to = { x: layout.endLeft, y: layout.endTop, scale: 1 };
            viewer.pose = from;
            viewer.layout = layout;
            viewer.thumbOpacity = 0;
            viewer.settled = false;
            viewer.largeShown = false;
            viewer.largeOpacity = Number(node.large.style.opacity) || 0;
            viewer.largeReady = viewer.largeOpacity >= 1 && !!node.large.getAttribute('src');
            placeOverlay(from, layout);
            node.root.hidden = false;
            sizeFlyer(node, layout);
            if (!viewer.largeReady) armLarge(node, spec);
            paint(slot);
            play();
        };

        const closeViewer = () => {
            if (!viewer || viewer.phase === 'closing') return;
            const now = performance.now();
            viewer.phase = 'closing';
            viewer.rowMotion = 'out';
            viewer.rowT0 = now;
            viewer.closeFrom = viewer.pose;
            viewer.closeT0 = now;
            viewer.closeDone = false;
            activeFlyer.root.style.willChange = 'transform';
            closeBtn.style.willChange = 'transform, opacity';
            play();
        };

        const activateSlot = (slot) => {
            if (!slot?.spec) return;
            if (!viewer) {
                openViewer(slot);
                return;
            }
            if (viewer.phase === 'closing' || !isFramingRow(slot.row)) return;
            if (slot === viewer.slot) return;
            switchTo(slot);
        };

        const bindItem = (slot) => {
            const el = slot.el;
            el.className = 'stream-item';
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', 'Open image');
            const primeLarge = () => warmLarge(slot.spec);
            el.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'touch') {
                    slot.tapX = event.clientX;
                    slot.tapY = event.clientY;
                    return;
                }
                primeLarge();
            });
            el.addEventListener('pointerup', (event) => {
                if (event.pointerType !== 'touch') return;
                const dx = Math.abs(event.clientX - slot.tapX);
                const dy = Math.abs(event.clientY - slot.tapY);
                if (dx > 12 || dy > 12) return;
                slot.openedFromTap = true;
                activateSlot(slot);
            });
            el.addEventListener('mouseenter', primeLarge);
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

        const populateRow = (rowIndex, specs, mode) => {
            const rowEl = rows[rowIndex];
            if (!rowEl) return;
            rowEl.replaceChildren();

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
                    frozen: false,
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
                releaseReserved(slot.spec);
            });
        };

        let bootPromises = null;
        let holdMotion = false;
        const startRow = (rowIndex, mode) => {
            if (cancelled || startedRows.has(rowIndex) || !rows[rowIndex]) return Promise.resolve();
            startedRows.add(rowIndex);
            const raws = [];
            const count = photosPerRow();
            for (let i = 0; i < count; i += 1) {
                const raw = nextRawItem();
                if (!raw) break;
                raws.push(raw);
            }
            const job = (async () => {
                const specs = [];
                for (const raw of raws) {
                    if (cancelled || !rows[rowIndex] || !rows[rowIndex].isConnected) {
                        raws.forEach(releaseReserved);
                        startedRows.delete(rowIndex);
                        return;
                    }
                    specs.push(await decodeSmall(raw));
                }
                const rowEl = rows[rowIndex];
                if (cancelled || !rowEl || !rowEl.isConnected || !specs.length) {
                    raws.forEach(releaseReserved);
                    startedRows.delete(rowIndex);
                    return;
                }
                if (mode !== 'enter-left') rowEl.style.visibility = 'hidden';
                populateRow(rowIndex, specs, mode);
                const mine = pool.filter((slot) => slot.row === rowIndex);
                mine.forEach((slot) => {
                    slot.frozen = true;
                });
                await decodeElements(rowEl);
                if (cancelled || !rowEl.isConnected) return;
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
            if (bootPromises) bootPromises.push(job);
            return job;
        };

        const introPlan = new Set();
        let introRunning = false;
        let introNextAt = INTRO_FIRST_DELAY_SECONDS;

        const rowOffstage = new Set();
        const rowObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const index = Number(entry.target.dataset.rowIndex);
                if (!Number.isFinite(index)) return;
                if (entry.isIntersecting) {
                    rowOffstage.delete(index);
                    return;
                }
                rowOffstage.add(index);
                if (window.innerWidth > MOBILE_BREAKPOINT_PX) return;
                pool.forEach((slot) => {
                    if (slot.row === index) slot.el.style.willChange = '';
                });
            });
        }, { root: null, rootMargin: '160px 0px', threshold: 0 });

        const placeRow = (index) => {
            const rowEl = rows[index];
            if (!rowEl) return;
            rowEl.style.top = `${index * stridePx()}px`;
            rowEl.style.height = `${itemHeight}px`;
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
            rowEl.remove();
            rowObserver.unobserve(rowEl);
            rowOffstage.delete(index);
            rows[index] = null;
            startedRows.delete(index);
            introPlan.delete(index);
        };

        const ensureRow = (index, mode) => {
            if (!rows[index]) {
                const rowEl = document.createElement('div');
                rowEl.className = 'floating-streams-row';
                rowEl.dataset.rowIndex = String(index);
                section.appendChild(rowEl);
                rowObserver.observe(rowEl);
                rows[index] = rowEl;
                rowPose[index] = { ty: 0, scale: 1 };
            }
            placeRow(index);
            if (startedRows.has(index) || introPlan.has(index)) return;
            if (mode === 'intro') {
                const at = Math.max(
                    introNextAt,
                    (performance.now() - pageStartedAt) / 1000 + INTRO_MIN_GAP_SECONDS
                );
                scheduleIntroRow(index, at);
                return;
            }
            startRow(index, 'filled');
        };

        const growSection = (throughIndex) => {
            const needed = (throughIndex + 1) * stridePx() + viewHeight();
            const current = parseFloat(section.style.height) || 0;
            if (needed > current || pageScroll() + viewHeight() + stridePx() < needed) {
                section.style.height = `${needed}px`;
            }
        };

        let mountedKey = '';
        const mountRange = () => {
            const { first, last } = visibleBounds();
            const buffer = window.innerWidth <= MOBILE_BREAKPOINT_PX ? MOBILE_ROW_BUFFER : ROW_BUFFER;
            const from = Math.max(0, first - buffer);
            const to = last + buffer;
            mountedKey = `${first}:${last}`;
            growSection(to);
            for (let index = from; index <= to; index += 1) {
                const onScreen = index >= first && index <= last;
                if (introRunning && onScreen && !startedRows.has(index)) ensureRow(index, 'intro');
                else ensureRow(index, 'filled');
            }
            for (let index = 0; index < rows.length; index += 1) {
                if (!rows[index]) continue;
                if (index < from || index > to) removeRow(index);
            }
            for (let index = from; index <= to; index += 1) placeRow(index);
        };

        const scheduleIntroRow = (index, at) => {
            if (introPlan.has(index) || startedRows.has(index)) return;
            introPlan.add(index);
            introNextAt = Math.max(introNextAt, at + INTRO_MIN_GAP_SECONDS);
            const delay = Math.max(0, at * 1000 - (performance.now() - pageStartedAt));
            const timer = window.setTimeout(() => {
                if (cancelled || !rows[index]) return;
                if (at === INTRO_FIRST_DELAY_SECONDS) markIntroPlayed();
                startRow(index, 'enter-left');
            }, delay);
            introTimers.push(timer);
        };

        const outlineFor = (slot) => {
            if (!slot?.spec || !(slot.width > 0)) return 0;
            const border = viewerBorderPx();
            const bases = [];
            const top = streamOriginY - pageScroll();
            const stride = stridePx();
            for (let index = 0; index < rows.length; index += 1) {
                if (!rows[index]) continue;
                bases[index] = {
                    top: top + index * stride,
                    left: streamOriginX,
                    width: viewportWidth,
                    height: itemHeight,
                };
            }
            const innerWidth = layoutViewer(slot.spec, bases).inner.width;
            if (!(innerWidth > 0)) return 0;
            return Math.max(1, Math.round((border / innerWidth) * slot.width));
        };

        const slotUnderPointer = () => {
            const originY = streamOriginY - pageScroll();
            const originX = streamOriginX - (window.scrollX || window.pageXOffset || 0);
            const stride = stridePx();
            for (let i = pool.length - 1; i >= 0; i -= 1) {
                const slot = pool[i];
                if (!slot.spec || slot.frozen) continue;
                if (slot.el.style.pointerEvents === 'none') continue;
                if (slot.el.style.opacity === '0') continue;
                if (viewer && (!isFramingRow(slot.row) || slot === viewer.slot)) continue;
                const scale = slot.scale || 1;
                const width = slot.width * scale;
                const height = itemHeight * scale;
                const left = originX + slot.x + (slot.width - width) / 2;
                const top = originY + slot.row * stride + (itemHeight - height) / 2;
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

        const syncHover = () => {
            if (!fineHover || (!pointerInside && !hoverSlot)) return;
            const slot = pointerInside ? slotUnderPointer() : null;
            if (slot === hoverSlot) return;
            if (hoverSlot) hoverSlot.el.classList.remove('is-hovered');
            hoverSlot = slot;
            if (!slot) return;
            slot.el.style.setProperty('--stream-outline', `${outlineFor(slot)}px`);
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

        const tick = (now) => {
            if (!running) return;
            const dt = lastTime ? Math.min(MAX_FRAME_SECONDS, (now - lastTime) / 1000) : 0;
            lastTime = now;

            const motionScale = reducedMotion ? REDUCED_MOTION_SPEED_SCALE : 1;
            const mobileMotion = window.innerWidth <= MOBILE_BREAKPOINT_PX;
            if (motionScale > 0 && dt > 0) {
                for (let i = 0; i < pool.length; i += 1) {
                    const slot = pool[i];
                    if (slot.frozen) continue;
                    const onStage = !rowOffstage.has(slot.row);
                    if (!onStage && !(viewer && slot === viewer.slot)) continue;
                    let speedScale = motionScale;
                    if (mobileMotion && viewer) {
                        if (!isFramingRow(slot.row) && slot !== viewer.slot) continue;
                        speedScale *= MOBILE_OPEN_SPEED;
                    }
                    slot.x += slot.speed * speedScale * dt;
                    if (SWAY_SPEED) slot.swayPhase += SWAY_SPEED * dt;
                    if (mobileMotion && slot.el.style.willChange !== 'transform') {
                        slot.el.style.willChange = 'transform';
                    }
                    if (slot.x > viewportWidth) recycle(slot);
                    else paint(slot);
                }
            } else if (viewer) {
                paint(viewer.slot);
            }

            advanceViewer(now, dt);
            if (fineHover) syncHover();

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

        const preloadFirstRowSmalls = () => {
            peekUpcoming(photosPerRow()).forEach(decodeSmall);
        };

        overlay.addEventListener('click', closeViewer);
        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
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
            introRunning = true;
            preloadFirstRowSmalls();
            const schedule = introStartTimes(onScreenIndexes());
            schedule.forEach((item) => scheduleIntroRow(item.index, item.at));
            introNextAt = (schedule[schedule.length - 1]?.at || INTRO_FIRST_DELAY_SECONDS) + INTRO_MIN_GAP_SECONDS;
            mountRange();
            const finishIntro = window.setTimeout(() => {
                introRunning = false;
            }, Math.max(0, introNextAt * 1000));
            introTimers.push(finishIntro);
        } else {
            section.style.visibility = 'hidden';
            holdMotion = true;
            bootPromises = [];
            mountRange();
            const pending = bootPromises;
            bootPromises = null;
            Promise.all(pending).then(() => {
                if (cancelled) return;
                holdMotion = false;
                pool.forEach((slot) => {
                    slot.frozen = false;
                    paint(slot);
                });
                section.style.visibility = '';
                syncPlayback();
            });
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
            if (scrollLockY != null || pageIsZoomed()) return;
            if (scrollFrame) return;
            scrollFrame = requestAnimationFrame(() => {
                scrollFrame = 0;
                if (cancelled || scrollLockY != null) return;
                const { first, last } = visibleBounds();
                if (`${first}:${last}` === mountedKey) return;
                mountRange();
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        let resizeFrame = 0;
        const onResize = () => {
            if (pageIsZoomed()) return;
            if (resizeFrame) return;
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                if (cancelled || pageIsZoomed()) return;
                if (viewer) {
                    viewer.rowBases = measureRows();
                    viewer.layout = layoutViewer(viewer.spec, viewer.rowBases);
                    viewer.to = { x: viewer.layout.endLeft, y: viewer.layout.endTop, scale: 1 };
                    if (activeFlyer) sizeFlyer(activeFlyer, viewer.layout);
                    cacheStreamOrigin();
                    if (fineHover && hoverSlot) {
                        hoverSlot.el.style.setProperty('--stream-outline', `${outlineFor(hoverSlot)}px`);
                    }
                    return;
                }
                const previousHeight = itemHeight;
                applyLayoutMetrics();
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
                mountRange();
                if (fineHover && hoverSlot) {
                    hoverSlot.el.style.setProperty('--stream-outline', `${outlineFor(hoverSlot)}px`);
                }
                syncPlayback();
            });
        };
        window.addEventListener('resize', onResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onResize);
            window.visualViewport.addEventListener('scroll', onScroll);
        }

        return () => {
            cancelled = true;
            clearIntroTimers();
            pause();
            intersection.disconnect();
            rowObserver.disconnect();
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
            unlockScroll();
            section.replaceChildren();
            if (menuEl) {
                menuEl.style.opacity = '';
                menuEl.style.pointerEvents = '';
            }
            overlay.remove();
            flyers.forEach((node) => node.root.remove());
            closeBtn.remove();
            pool.forEach((slot) => slot.el.remove());
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
