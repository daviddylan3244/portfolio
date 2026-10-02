import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Clothing.css';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
const ROW_COUNT = 5;
const CROSSING_TIME_SECONDS = 14;

// clamp(ITEM_HEIGHT_MIN_PX, ITEM_HEIGHT_VW * 1vw, ITEM_HEIGHT_MAX_PX)
const ITEM_HEIGHT_MIN_PX = 70;
const ITEM_HEIGHT_VW = 10;
const ITEM_HEIGHT_MAX_PX = 120;

const ITEM_GAP_PX = 40;
const VERTICAL_GAP_RATIO = 0.5; // gap between rows, as a fraction of item height

// 1-based. Row 3 is the middle of 5 rows.
const INTRO_FIRST_ROW = 3;
const INTRO_ROW_DELAYS_SECONDS = [2, 7, 11, 14, 16];

// Survives in-app navigation, but resets on a full page refresh.
let introPlayedThisVisit = false;

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
const MOBILE_POOL_BUFFER = 1;
const DECODE_CONCURRENCY = 3;

// Click-to-open viewer
const OPEN_TRANSITION_MS = 700;
const OPEN_EASE_POINTS = [0.22, 1, 0.36, 1];
const OPEN_EASING = `cubic-bezier(${OPEN_EASE_POINTS.join(', ')})`;
const ROW_SCALE_WHEN_OPEN = 1;
const VIEWER_GAP_PX = 32;
const VIEWER_BORDER_MIN_PX = 12;
const VIEWER_BORDER_MAX_PX = 48;
const CLOSE_BUTTON_GAP_PX = 10;
const CLOSE_BUTTON_PX = 44;
const LARGE_FADE_SECONDS = 0.18;

// ---------------------------------------------------------------------------
// Item library — web-sized photos. src = rows, srcFull = enlarged view.
// ---------------------------------------------------------------------------
const STREAM_LIBRARY = [
    { id: 'photo-1', src: '/photos/Website digital/Photography/small/small-photo-1.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-1.jpg' },
    { id: 'photo-2', src: '/photos/Website digital/Photography/small/small-photo-2.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-2.jpg' },
    { id: 'photo-3', src: '/photos/Website digital/Photography/small/small-photo-3.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-3.jpg' },
    { id: 'photo-4', src: '/photos/Website digital/Photography/small/small-photo-4.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-4.jpg' },
    { id: 'photo-5', src: '/photos/Website digital/Photography/small/small-photo-5.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-5.jpg' },
    { id: 'photo-6', src: '/photos/Website digital/Photography/small/small-photo-6.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-6.jpg' },
    { id: 'photo-7', src: '/photos/Website digital/Photography/small/small-photo-7.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-7.jpg' },
    { id: 'photo-8', src: '/photos/Website digital/Photography/small/small-photo-8.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-8.jpg' },
    { id: 'photo-9', src: '/photos/Website digital/Photography/small/small-photo-9.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-9.jpg' },
    { id: 'photo-10', src: '/photos/Website digital/Photography/small/small-photo-10.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-10.jpg' },
    { id: 'photo-11', src: '/photos/Website digital/Photography/small/small-photo-11.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-11.jpg' },
    { id: 'photo-12', src: '/photos/Website digital/Photography/small/small-photo-12.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-12.jpg' },
    { id: 'photo-13', src: '/photos/Website digital/Photography/small/small-photo-13.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-13.jpg' },
    { id: 'photo-14', src: '/photos/Website digital/Photography/small/small-photo-14.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-14.jpg' },
    { id: 'photo-15', src: '/photos/Website digital/Photography/small/small-photo-15.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-15.jpg' },
    { id: 'photo-16', src: '/photos/Website digital/Photography/small/small-photo-16.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-16.jpg' },
    { id: 'photo-17', src: '/photos/Website digital/Photography/small/small-photo-17.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-17.jpg' },
    { id: 'photo-18', src: '/photos/Website digital/Photography/small/small-photo-18.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-18.jpg' },
    { id: 'photo-19', src: '/photos/Website digital/Photography/small/small-photo-19.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-19.jpg' },
    { id: 'photo-20', src: '/photos/Website digital/Photography/small/small-photo-20.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-20.jpg' },
    { id: 'photo-21', src: '/photos/Website digital/Photography/small/small-photo-21.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-21.jpg' },
    { id: 'photo-22', src: '/photos/Website digital/Photography/small/small-photo-22.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-22.jpg' },
    { id: 'photo-23', src: '/photos/Website digital/Photography/small/small-photo-23.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-23.jpg' },
    { id: 'photo-24', src: '/photos/Website digital/Photography/small/small-photo-24.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-24.jpg' },
    { id: 'photo-25', src: '/photos/Website digital/Photography/small/small-photo-25.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-25.jpg' },
    { id: 'photo-26', src: '/photos/Website digital/Photography/small/small-photo-26.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-26.jpg' },
    { id: 'photo-27', src: '/photos/Website digital/Photography/small/small-photo-27.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-27.jpg' },
    { id: 'photo-28', src: '/photos/Website digital/Photography/small/small-photo-28.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-28.jpg' },
    { id: 'photo-29', src: '/photos/Website digital/Photography/small/small-photo-29.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-29.jpg' },
    { id: 'photo-30', src: '/photos/Website digital/Photography/small/small-photo-30.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-30.jpg' },
    { id: 'photo-31', src: '/photos/Website digital/Photography/small/small-photo-31.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-31.jpg' },
    { id: 'photo-32', src: '/photos/Website digital/Photography/small/small-photo-32.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-32.jpg' },
    { id: 'photo-33', src: '/photos/Website digital/Photography/small/small-photo-33.jpg', srcFull: '/photos/Website digital/Photography/Large/Large-photo-33.jpg' },
];

function clampItemHeight(viewportWidth, availableHeight) {
    const preferred = (ITEM_HEIGHT_VW / 100) * viewportWidth;
    let height = Math.min(ITEM_HEIGHT_MAX_PX, Math.max(ITEM_HEIGHT_MIN_PX, preferred));
    if (window.innerHeight < 700 && availableHeight > 0) {
        const stride = ROW_COUNT + (ROW_COUNT - 1) * VERTICAL_GAP_RATIO;
        const fit = Math.floor(availableHeight / stride);
        if (fit > 0 && fit < height) height = fit;
    }
    return height;
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
    const rowRefs = useRef([]);

    useEffect(() => {
        const section = sectionRef.current;
        const rows = rowRefs.current.filter(Boolean);
        if (!section || rows.length !== ROW_COUNT) return undefined;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const transitionMs = reducedMotion ? 1 : OPEN_TRANSITION_MS;
        section.style.setProperty('--stream-open-ms', `${transitionMs}ms`);
        section.style.setProperty('--stream-open-ease', OPEN_EASING);

        const pool = [];
        const decodePromises = new Map();
        const decodedSpecs = new Map();
        const introTimers = [];
        const startedRows = new Set();
        let libraryCursor = 0;
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
        const rowPose = rows.map(() => ({ ty: 0, scale: 1 }));
        const largePromises = new Map();
        let viewer = null;

        const opacityForSlot = (slot) => {
            if (!viewer) return null;
            if (slot === viewer.slot) return viewer.thumbOpacity;
            const departing = viewer.departures.find((item) => item.slot === slot);
            return departing ? departing.thumbOpacity : null;
        };

        const previousHtmlOverflow = document.documentElement.style.overflow;
        const previousBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        const applyLayoutMetrics = () => {
            viewportWidth = section.clientWidth;
            const sectionStyle = getComputedStyle(section);
            const sectionPad =
                parseFloat(sectionStyle.paddingTop) + parseFloat(sectionStyle.paddingBottom);
            itemHeight = clampItemHeight(
                window.innerWidth,
                section.clientHeight - sectionPad
            );
            baseSpeed = (viewportWidth + itemHeight) / CROSSING_TIME_SECONDS;
            section.style.setProperty('--stream-item-height', `${itemHeight}px`);
            section.style.setProperty(
                '--stream-row-gap',
                `${itemHeight * VERTICAL_GAP_RATIO}px`
            );
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

        const nextRawItem = () => {
            const item = STREAM_LIBRARY[libraryCursor % STREAM_LIBRARY.length];
            libraryCursor += 1;
            return item;
        };

        const takeDecodedSpecs = async (count) => {
            const specs = [];
            for (let i = 0; i < count; i += 1) {
                if (cancelled) return specs;
                specs.push(await decodeSmall(nextRawItem()));
            }
            return specs;
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
            slot.el.style.transform = `translate3d(${slot.x}px, ${sway}px, 0) scale(${scale})`;
            const heldOpacity = opacityForSlot(slot);
            if (heldOpacity !== null) {
                slot.el.style.opacity = String(heldOpacity);
            } else if (!DEPTH_EFFECT_ENABLED || !SPEED_VARIATION) {
                slot.el.style.opacity = '1';
            }
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

        const recycle = (slot) => {
            const neighbor = leftmostInRow(slot.row, slot);
            const raw = nextRawItem();
            const spec = decodedSpecs.get(raw.src || raw.id) || {
                ...raw,
                aspectRatio: avgAspect(),
            };
            applyVisuals(slot, spec);
            slot.x = neighbor
                ? neighbor.x - slot.width - ITEM_GAP_PX
                : -slot.width;
            paint(slot);
            decodeSmall(raw);
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

        const prefetchLargeVersions = () => {
            STREAM_LIBRARY.forEach((item) => warmLarge(item));
        };

        const applyRows = (amount) => {
            const targets = viewer ? viewer.rowTargets : null;
            rows.forEach((row, index) => {
                const target = targets
                    ? targets[index]
                    : { ty: 0, scale: 1, opacity: 1 };
                const ty = target.ty * amount;
                const scale = 1 + (target.scale - 1) * amount;
                const opacity = 1 + (target.opacity - 1) * amount;
                const framing = index === 0 || index === ROW_COUNT - 1;
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

        const measureRows = () =>
            rows.map((row) => {
                const rect = row.getBoundingClientRect();
                return {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                };
            });

        const layoutViewer = (slot, bases) => {
            const topRow = bases[0];
            const bottomRow = bases[bases.length - 1];
            const border = viewerBorderPx();
            const gapTop = topRow.top + topRow.height + VIEWER_GAP_PX;
            const gapBottom = bottomRow.top - VIEWER_GAP_PX;
            const visibleTop = Math.max(gapTop, VIEWER_GAP_PX);
            const visibleBottom = Math.min(gapBottom, window.innerHeight - VIEWER_GAP_PX);
            const betweenRows = visibleBottom - visibleTop;
            const room = window.innerHeight - VIEWER_GAP_PX * 2;
            const maxTotalH = Math.max(80, Math.min(room, betweenRows > 40 ? betweenRows : room));
            const maxTotalW = Math.max(80, window.innerWidth - VIEWER_GAP_PX * 2);
            const inner = fitInBox(
                slot.aspectRatio || 1,
                Math.max(40, maxTotalW - border * 2),
                Math.max(40, maxTotalH - border * 2)
            );
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const endLeft = (window.innerWidth - totalW) / 2;
            let endTop = visibleTop + Math.max(0, maxTotalH - totalH) / 2;
            endTop = Math.max(
                VIEWER_GAP_PX,
                Math.min(endTop, window.innerHeight - totalH - VIEWER_GAP_PX)
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

        const rowTargetsFor = (bases) =>
            bases.map((_, index) => {
                const framing = index === 0 || index === ROW_COUNT - 1;
                return {
                    ty: 0,
                    scale: framing ? ROW_SCALE_WHEN_OPEN : 1,
                    opacity: framing ? 1 : 0,
                };
            });

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
            node.large.style.opacity = '0';
            if (node === homeFlyer) {
                node.root.hidden = true;
                return;
            }
            node.root.remove();
        };

        const configureFlyer = (node, layout, slot) => {
            const { root, small, large } = node;
            root.style.width = `${layout.totalW}px`;
            root.style.height = `${layout.totalH}px`;
            root.style.padding = `${layout.border}px`;
            root.style.transformOrigin = '0 0';
            root.style.willChange = 'transform';
            root.hidden = false;
            small.src = slot.spec.src ? encodeURI(slot.spec.src) : '';
            large.style.opacity = '0';
            large.style.top = `${layout.border}px`;
            large.style.left = `${layout.border}px`;
            large.style.width = `${layout.inner.width}px`;
            large.style.height = `${layout.inner.height}px`;
            if (slot.spec.srcFull) large.src = encodeURI(slot.spec.srcFull);
        };

        const armLarge = (node, slot) => {
            warmLarge(slot.spec).then((image) => {
                if (!image || activeFlyer !== node) return;
                if (!viewer || viewer.slot !== slot) return;
                node.large.src = image.src;
                viewer.largeReady = true;
            });
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
                viewer.largeOpacity = Math.min(1, viewer.largeOpacity + dt / LARGE_FADE_SECONDS);
                activeFlyer.large.style.opacity = String(viewer.largeOpacity);
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
            if (viewer || !slot?.spec) return;

            const now = performance.now();
            const bases = measureRows();
            const layout = layoutViewer(slot, bases);
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
                phase: 'opening',
                t0: now,
                duration: transitionMs,
                from,
                to,
                pose: from,
                layout,
                rowBases: bases,
                rowTargets: rowTargetsFor(bases),
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
            };

            configureFlyer(activeFlyer, layout, slot);
            placeOverlay(from, layout);
            overlay.hidden = false;
            closeBtn.hidden = false;
            closeBtn.style.opacity = '0';
            closeBtn.style.willChange = 'transform, opacity';
            paint(slot);
            applyRows(0);
            play();
            armLarge(activeFlyer, slot);
            closeBtn.focus({ preventScroll: true });
        };

        const isFramingRow = (rowIndex) => rowIndex === 0 || rowIndex === ROW_COUNT - 1;

        const switchTo = (slot) => {
            if (!viewer || viewer.phase === 'closing' || slot === viewer.slot) return;
            if (!isFramingRow(slot.row)) return;

            const now = performance.now();
            const existing = viewer.departures.findIndex((item) => item.slot === slot);
            let node;
            let from;
            let layout;

            if (existing >= 0) {
                const dep = viewer.departures.splice(existing, 1)[0];
                node = dep.flyer;
                from = dep.pose;
                layout = dep.layout;
            } else {
                layout = layoutViewer(slot, viewer.rowBases);
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
                configureFlyer(node, layout, slot);
            }

            activeFlyer.root.style.willChange = 'transform';
            viewer.departures.push({
                slot: viewer.slot,
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
            viewer.phase = 'switching';
            viewer.t0 = now;
            viewer.from = from;
            viewer.to = { x: layout.endLeft, y: layout.endTop, scale: 1 };
            viewer.pose = from;
            viewer.layout = layout;
            viewer.thumbOpacity = 0;
            viewer.largeOpacity = Number(node.large.style.opacity) || 0;
            viewer.largeReady = node.large.naturalWidth > 0 || viewer.largeOpacity > 0;
            placeOverlay(from, layout);
            node.root.hidden = false;
            if (!viewer.largeReady) armLarge(node, slot);
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
            el.addEventListener('pointerdown', primeLarge);
            el.addEventListener('mouseenter', primeLarge);
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                activateSlot(slot);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateSlot(slot);
                }
            });
        };

        const clearRows = () => {
            if (viewer) finishViewer();
            pool.forEach((slot) => slot.el.remove());
            pool.length = 0;
            startedRows.clear();
            libraryCursor = 0;
            rows.forEach((rowEl) => rowEl.replaceChildren());
        };

        const populateRow = (rowIndex, specs, mode) => {
            const rowEl = rows[rowIndex];
            if (!rowEl) return;
            rowEl.replaceChildren();

            const slots = specs.map((spec, i) => {
                const el = document.createElement('div');
                rowEl.appendChild(el);
                const slot = {
                    id: rowIndex * 100 + i,
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
                });
                return;
            }

            const typicalStride = itemHeight * avgAspect() + ITEM_GAP_PX;
            const stagger = -((rowIndex * 0.41 * typicalStride) % typicalStride);
            let cursorX = stagger - typicalStride;
            slots.forEach((slot) => {
                slot.x = cursorX;
                cursorX += slot.width + ITEM_GAP_PX;
                paint(slot);
                pool.push(slot);
            });
        };

        const startRow = async (rowIndex, mode) => {
            if (cancelled || startedRows.has(rowIndex)) return;
            const specs = await takeDecodedSpecs(computePerRow());
            if (cancelled || startedRows.has(rowIndex) || !specs.length) return;
            startedRows.add(rowIndex);
            populateRow(rowIndex, specs, mode);
            syncPlayback();
        };

        const fillAllRows = async (mode) => {
            clearRows();
            applyLayoutMetrics();
            const perRow = computePerRow();
            for (let rowIndex = 0; rowIndex < ROW_COUNT; rowIndex += 1) {
                if (cancelled) return;
                const specs = await takeDecodedSpecs(perRow);
                if (cancelled) return;
                startedRows.add(rowIndex);
                populateRow(rowIndex, specs, mode);
            }
            syncPlayback();
        };

        const tick = (now) => {
            if (!running) return;
            const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
            lastTime = now;

            const motionScale = reducedMotion ? REDUCED_MOTION_SPEED_SCALE : 1;
            if (motionScale > 0 && dt > 0) {
                for (let i = 0; i < pool.length; i += 1) {
                    const slot = pool[i];
                    if (slot.frozen) continue;
                    slot.x += slot.speed * motionScale * dt;
                    if (SWAY_SPEED) slot.swayPhase += SWAY_SPEED * dt;
                    if (slot.x > viewportWidth) recycle(slot);
                    else paint(slot);
                }
            } else if (viewer) {
                paint(viewer.slot);
            }

            advanceViewer(now, dt);

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
            const count = computePerRow();
            const needed = [];
            for (let i = 0; i < count; i += 1) {
                needed.push(STREAM_LIBRARY[i % STREAM_LIBRARY.length]);
            }
            needed.forEach(decodeSmall);
        };

        const preloadRemainingSmalls = () => {
            mapWithConcurrency(STREAM_LIBRARY, DECODE_CONCURRENCY, decodeSmall);
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

        const playIntro = !reducedMotion && !introPlayedThisVisit;

        if (playIntro) {
            preloadFirstRowSmalls();
            const firstIndex = Math.max(0, Math.min(ROW_COUNT, INTRO_FIRST_ROW) - 1);
            const rest = shuffle(
                Array.from({ length: ROW_COUNT }, (_, index) => index).filter(
                    (index) => index !== firstIndex
                )
            );
            const order = [firstIndex, ...rest];

            INTRO_ROW_DELAYS_SECONDS.forEach((seconds, index) => {
                const rowIndex = order[index];
                if (rowIndex === undefined) return;
                const timer = window.setTimeout(() => {
                    if (cancelled) return;
                    if (index === 0) {
                        introPlayedThisVisit = true;
                        preloadRemainingSmalls();
                        prefetchLargeVersions();
                    }
                    startRow(rowIndex, 'enter-left');
                }, seconds * 1000);
                introTimers.push(timer);
            });
        } else {
            mapWithConcurrency(STREAM_LIBRARY, DECODE_CONCURRENCY, decodeSmall).then(
                async () => {
                    if (cancelled) return;
                    await fillAllRows('filled');
                    if (!cancelled) prefetchLargeVersions();
                }
            );
        }

        const intersection = new IntersectionObserver(
            ([entry]) => {
                inView = entry.isIntersecting;
                syncPlayback();
            },
            { threshold: 0.05 }
        );
        intersection.observe(section);

        const onVisibility = () => syncPlayback();
        document.addEventListener('visibilitychange', onVisibility);

        let resizeTimer = 0;
        const onResize = () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                const wasRunning = running;
                clearIntroTimers();
                pause();
                fillAllRows('filled').then(() => {
                    if (cancelled) return;
                    prefetchLargeVersions();
                    if (wasRunning) syncPlayback();
                });
            }, 150);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelled = true;
            clearIntroTimers();
            pause();
            intersection.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            window.clearTimeout(resizeTimer);
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overflow = previousBodyOverflow;
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
        <div className="clothing-container">
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
            >
                {Array.from({ length: ROW_COUNT }, (_, index) => (
                    <div
                        key={index}
                        className="floating-streams-row"
                        ref={(node) => {
                            rowRefs.current[index] = node;
                        }}
                    />
                ))}
            </section>
        </div>
    );
}

export default Clothing; 
