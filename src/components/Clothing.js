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

const HORIZONTAL_GAP_PX = 40;
const VERTICAL_GAP_RATIO = 0.5; // gap between rows, as a fraction of item height

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

// Click-to-open viewer
const OPEN_TRANSITION_MS = 720;
const OPEN_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const OPEN_MARGIN_PX = 28;
const VIEWER_ROW_CLEARANCE_PX = 16;
const VIEWER_BORDER_MIN_PX = 12;
const VIEWER_BORDER_MAX_PX = 48;
const CLOSE_BUTTON_GAP_PX = 10;

// ---------------------------------------------------------------------------
// Item library — photos previously shown on this page.
// Optional srcFull is used in the large viewer when present; falls back to src.
// ---------------------------------------------------------------------------
const STREAM_LIBRARY = [
    { id: 'hockey-1', src: '/Photos/hockey-1.JPG' },
    { id: 'ica', src: '/Photos/ICA.jpg' },
    { id: 'redbull', src: '/Photos/redbullEvent-copy.jpg' },
    { id: 'blackfires', src: '/Photos/blackfires.jpg' },
    { id: 'boston', src: '/Photos/boston.jpg' },
    { id: 'mfa', src: '/Photos/MFA.JPG' },
    { id: 'nydia', src: '/Photos/Nydia.jpg' },
    { id: 'hockey-2', src: '/Photos/hockey2.JPG' },
    { id: 'chinese-new-year', src: '/Photos/Chinese New Year-47.jpg' },
    { id: 'isgm', src: '/Photos/ISGM.jpg' },
];

function loadLibraryItem(item) {
    return new Promise((resolve) => {
        if (!item.src) {
            resolve({ ...item, aspectRatio: item.aspectRatio || 1 });
            return;
        }
        const image = new Image();
        image.onload = () => {
            const ratio =
                image.naturalWidth && image.naturalHeight
                    ? image.naturalWidth / image.naturalHeight
                    : 1;
            resolve({ ...item, aspectRatio: ratio });
        };
        image.onerror = () => resolve({ ...item, aspectRatio: 1 });
        image.src = encodeURI(item.src);
    });
}

function clampItemHeight(viewportWidth) {
    const preferred = (ITEM_HEIGHT_VW / 100) * viewportWidth;
    return Math.min(ITEM_HEIGHT_MAX_PX, Math.max(ITEM_HEIGHT_MIN_PX, preferred));
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
        let library = STREAM_LIBRARY;
        let libraryCursor = 0;
        let rafId = 0;
        let running = false;
        let inView = true;
        let lastTime = 0;
        let viewportWidth = 0;
        let itemHeight = 0;
        let baseSpeed = 0;
        let openSlot = null;
        let closing = false;

        const overlay = document.createElement('div');
        overlay.className = 'stream-overlay';
        overlay.hidden = true;

        const flyer = document.createElement('div');
        flyer.className = 'stream-flyer';
        flyer.setAttribute('role', 'img');
        flyer.hidden = true;

        const flyerImg = document.createElement('img');
        flyerImg.alt = '';
        flyerImg.draggable = false;
        flyer.appendChild(flyerImg);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'stream-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.hidden = true;

        section.append(overlay, flyer, closeBtn);

        const nextLibraryItem = () => {
            const item = library[libraryCursor % library.length];
            libraryCursor += 1;
            return item;
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
            applyVisuals(slot, nextLibraryItem());
            const neighbor = leftmostInRow(slot.row, slot);
            slot.x = neighbor
                ? neighbor.x - slot.width - HORIZONTAL_GAP_PX
                : -slot.width;
            paint(slot);
        };

        const isFramingRow = (rowIndex) => rowIndex === 0 || rowIndex === ROW_COUNT - 1;

        const setRowParting = (parted) => {
            const mid = (ROW_COUNT - 1) / 2;
            rows.forEach((rowEl, index) => {
                rowEl.classList.toggle('is-framing', parted && isFramingRow(index));
                rowEl.classList.toggle('is-parting-up', parted && !isFramingRow(index) && index < mid);
                rowEl.classList.toggle('is-parting-down', parted && !isFramingRow(index) && index >= mid);
            });
            section.classList.toggle('is-open', parted);
        };

        const applyFlyerFace = (spec) => {
            const src = spec.srcFull || spec.src;
            if (src) {
                const url = encodeURI(src);
                const hiRes = new Image();
                hiRes.src = url;
                flyerImg.src = url;
                flyerImg.hidden = false;
                flyer.style.backgroundColor = '#FFFFFF';
            } else {
                flyerImg.removeAttribute('src');
                flyerImg.hidden = true;
                flyer.style.backgroundColor = spec.color || '#FFFFFF';
            }
        };

        const layoutViewer = (slot) => {
            const sectionBox = section.getBoundingClientRect();
            const topRowBox = rows[0].getBoundingClientRect();
            const bottomRowBox = rows[ROW_COUNT - 1].getBoundingClientRect();
            const border = viewerBorderPx();

            const openTop =
                topRowBox.bottom - sectionBox.top + VIEWER_ROW_CLEARANCE_PX;
            const openBottom =
                bottomRowBox.top - sectionBox.top - VIEWER_ROW_CLEARANCE_PX;
            const openLeft = OPEN_MARGIN_PX;
            const openWidth = Math.max(120, sectionBox.width - OPEN_MARGIN_PX * 2);
            const openHeight = Math.max(120, openBottom - openTop);

            const inner = fitInBox(
                slot.aspectRatio || 1,
                Math.max(80, openWidth - border * 2),
                Math.max(80, openHeight - border * 2)
            );
            const totalW = inner.width + border * 2;
            const totalH = inner.height + border * 2;
            const endLeft = openLeft + (openWidth - totalW) / 2;
            const endTop = openTop + (openHeight - totalH) / 2;

            const origin = slot.openOrigin;
            const startScale = origin.width / Math.max(1, inner.width);
            const startLeft = origin.left - border * startScale;
            const startTop = origin.top - border * startScale;

            let closeLeft = endLeft + totalW + CLOSE_BUTTON_GAP_PX;
            let closeTop = endTop;
            if (closeLeft + 40 > sectionBox.width - 8) {
                closeLeft = endLeft + totalW - 40;
                closeTop = Math.max(openTop, endTop - 44);
            }

            return {
                border,
                inner,
                totalW,
                totalH,
                endLeft,
                endTop,
                startLeft,
                startTop,
                startScale,
                closeLeft,
                closeTop,
            };
        };

        const placeFlyer = (left, top, scale) => {
            flyer.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`;
        };

        const placeClose = (layout) => {
            closeBtn.style.left = `${layout.closeLeft}px`;
            closeBtn.style.top = `${layout.closeTop}px`;
        };

        const openViewer = (slot) => {
            if (openSlot || closing || !slot?.spec) return;

            openSlot = slot;
            slot.frozen = true;
            slot.el.classList.add('is-hidden');

            const sectionBox = section.getBoundingClientRect();
            const startBox = slot.el.getBoundingClientRect();
            slot.openOrigin = {
                left: startBox.left - sectionBox.left,
                top: startBox.top - sectionBox.top,
                width: startBox.width,
                height: startBox.height,
            };

            const layout = layoutViewer(slot);
            slot.openLayout = layout;

            applyFlyerFace(slot.spec);
            flyer.style.width = `${layout.totalW}px`;
            flyer.style.height = `${layout.totalH}px`;
            flyer.style.padding = `${layout.border}px`;
            flyer.style.transformOrigin = 'top left';
            flyer.style.transition = 'none';
            placeFlyer(layout.startLeft, layout.startTop, layout.startScale);
            placeClose(layout);
            flyer.hidden = false;
            overlay.hidden = false;
            closeBtn.hidden = false;
            overlay.classList.add('is-visible');
            closeBtn.classList.add('is-visible');

            setRowParting(true);

            requestAnimationFrame(() => {
                flyer.style.transition = `transform ${transitionMs}ms ${OPEN_EASING}`;
                placeFlyer(layout.endLeft, layout.endTop, 1);
            });

            closeBtn.focus();
        };

        const closeViewer = () => {
            if (!openSlot || closing) return;
            closing = true;

            const slot = openSlot;
            const layout = slot.openLayout || layoutViewer(slot);

            flyer.style.transition = 'none';
            placeFlyer(layout.endLeft, layout.endTop, 1);

            overlay.classList.remove('is-visible');
            closeBtn.classList.remove('is-visible');
            setRowParting(false);

            requestAnimationFrame(() => {
                flyer.style.transition = `transform ${transitionMs}ms ${OPEN_EASING}`;
                placeFlyer(layout.startLeft, layout.startTop, layout.startScale);
            });

            window.setTimeout(() => {
                flyer.hidden = true;
                overlay.hidden = true;
                closeBtn.hidden = true;
                flyer.style.transition = 'none';
                slot.el.classList.remove('is-hidden');
                slot.frozen = false;
                openSlot = null;
                closing = false;
            }, transitionMs + 40);
        };

        const bindItem = (slot) => {
            const el = slot.el;
            el.className = 'stream-item';
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', 'Open image');
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                openViewer(slot);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openViewer(slot);
                }
            });
        };

        const build = () => {
            if (openSlot) closeViewer();
            pool.forEach((slot) => slot.el.remove());
            pool.length = 0;
            libraryCursor = 0;

            viewportWidth = section.clientWidth;
            itemHeight = clampItemHeight(window.innerWidth);
            baseSpeed = (viewportWidth + itemHeight) / CROSSING_TIME_SECONDS;

            section.style.setProperty('--stream-item-height', `${itemHeight}px`);
            section.style.setProperty(
                '--stream-row-gap',
                `${itemHeight * VERTICAL_GAP_RATIO}px`
            );

            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
            const buffer = isMobile ? MOBILE_POOL_BUFFER : DESKTOP_POOL_BUFFER;
            const avgAspect =
                library.reduce((sum, item) => sum + (item.aspectRatio || 1), 0) /
                Math.max(1, library.length);
            const typicalStride = itemHeight * avgAspect + HORIZONTAL_GAP_PX;
            const perRow = Math.max(
                3,
                Math.ceil((viewportWidth + itemHeight * 2) / typicalStride) + buffer
            );

            rows.forEach((rowEl, rowIndex) => {
                rowEl.replaceChildren();
                const stagger = -((rowIndex * 0.41 * typicalStride) % typicalStride);

                let cursorX = stagger - typicalStride;
                for (let i = 0; i < perRow; i += 1) {
                    const spec = nextLibraryItem();
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
                    slot.x = cursorX;
                    cursorX += slot.width + HORIZONTAL_GAP_PX;
                    paint(slot);
                    pool.push(slot);
                }
            });
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
                    if (openSlot && !isFramingRow(slot.row)) continue;
                    slot.x += slot.speed * motionScale * dt;
                    if (SWAY_SPEED) slot.swayPhase += SWAY_SPEED * dt;
                    if (slot.x > viewportWidth) recycle(slot);
                    else paint(slot);
                }
            }

            rafId = requestAnimationFrame(tick);
        };

        const play = () => {
            if (running || (reducedMotion && REDUCED_MOTION_SPEED_SCALE === 0)) return;
            if (!inView || document.hidden) return;
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
            if (inView && !document.hidden && !(reducedMotion && REDUCED_MOTION_SPEED_SCALE === 0)) {
                play();
            } else {
                pause();
            }
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

        let cancelled = false;

        Promise.all(STREAM_LIBRARY.map(loadLibraryItem)).then((resolved) => {
            if (cancelled) return;
            library = resolved;
            build();
            syncPlayback();
        });

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
                if (openSlot) {
                    flyer.hidden = true;
                    overlay.hidden = true;
                    closeBtn.hidden = true;
                    overlay.classList.remove('is-visible');
                    closeBtn.classList.remove('is-visible');
                    setRowParting(false);
                    if (openSlot.el) openSlot.el.classList.remove('is-hidden');
                    openSlot.frozen = false;
                    openSlot = null;
                    closing = false;
                }
                pause();
                build();
                if (wasRunning) syncPlayback();
            }, 150);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelled = true;
            pause();
            intersection.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            window.clearTimeout(resizeTimer);
            overlay.remove();
            flyer.remove();
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
