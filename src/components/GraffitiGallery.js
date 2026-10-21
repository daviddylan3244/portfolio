import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';
import designStacks from '../data/design-stacks.json';
import { createTextReveal } from '../utils/textReveal';

const CAROUSEL_INTERVAL_MS = 1000;
const SWAP_MS = 450;
const FAN_MS = 300;
const CLOSE_MS = 450;
const CHROME_FADE_MS = 180;
const OPEN_STAGGER_MS = 40;
const TWIST_STEP_DEG = 3.5;
const TWIST_MAX_DEG = 25;
const DETAIL_MS = 450;
const DETAIL_BUSY_MARGIN_MS = 120;
const DETAIL_EASE = [0.22, 1, 0.36, 1];
const DETAIL_NARROW_PX = 819;
const DETAIL_LOREM =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const poseFor = (depth, fanned) => {
    if (!fanned) return { x: 0, y: 0, r: 0 };
    return {
        x: 0,
        y: 0,
        r: Math.min(TWIST_MAX_DEG, depth * TWIST_STEP_DEG),
    };
};

const identityOrder = (stack) => stack.items.map((_, index) => index);

const advanceOrder = (order) => [...order.slice(1), order[0]];

const aspectOf = (item) => {
    const width = Number(item?.width);
    const height = Number(item?.height);
    if (width > 0 && height > 0) return width / height;
    return 1;
};

const pileFit = (item, stack) => {
    if (stack.cardShape === 'square') return { w: 1, h: 1 };
    const aspect = stack.cardAspect > 0 ? stack.cardAspect : aspectOf(item);
    if (aspect >= 1) return { w: 1, h: 1 / aspect };
    return { w: aspect, h: 1 };
};

const cardClassNames = (stack, extra = []) => {
    const names = [
        stack.cardShape === 'square' ? 'is-square' : '',
        stack.cardShape === 'fixed' ? 'is-fixed' : '',
        stack.cardShape === 'natural' ? 'is-natural' : '',
        stack.fit === 'cover' ? 'is-cover' : '',
        stack.frame === 'thin-white' ? 'is-framed' : '',
        ...extra,
    ];
    return names.filter(Boolean).join(' ');
};

const itemCopy = (item) => ({
    title: item?.title ? item.title : 'Untitled',
    date: item?.date ? item.date : '',
    description: item?.description ? item.description : DETAIL_LOREM,
});

const itemGridAspect = (stack, item) => {
    if (stack.cardShape === 'square') return 1;
    if (stack.cardAspect > 0) return stack.cardAspect;
    return aspectOf(item);
};

const thumbWidthFor = (vw) => Math.round(Math.min(220, Math.max(165, vw * 0.1146)));
const textWidthFor = (vw) => Math.round(Math.min(380, Math.max(300, vw * 0.21)));

const fitRect = (aspect, maxW, maxH) => {
    const safe = Math.max(0.2, aspect || 1);
    let width = Math.max(1, maxW);
    let height = width / safe;
    if (height > maxH) {
        height = Math.max(1, maxH);
        width = height * safe;
    }
    return { w: width, h: height };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const easeBezier = ([p1x, p1y, p2x, p2y], amount) => {
    const x = Math.max(0, Math.min(1, amount));
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
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
};

const lerp = (from, to, amount) => from + (to - from) * amount;

const lerpPose = (from, to, amount) => {
    const start = from || to || { x: 0, y: 0, w: 1, h: 1, o: 1 };
    const end = to || from || start;
    return {
        x: lerp(start.x ?? 0, end.x ?? 0, amount),
        y: lerp(start.y ?? 0, end.y ?? 0, amount),
        w: lerp(start.w ?? 1, end.w ?? 1, amount),
        h: lerp(start.h ?? 1, end.h ?? 1, amount),
        o: lerp(start.o ?? 1, end.o ?? 1, amount),
        z: end.z ?? start.z,
        role: end.role || start.role,
    };
};

const poseOr = (pose, fallback) => pose || fallback || { x: 0, y: 0, w: 1, h: 1, o: 1, role: 'grid' };

const gridMetrics = (width) => {
    if (width <= 640) return { cols: 2, gap: 18 };
    if (width <= 900) return { cols: 3, gap: 18 };
    return { cols: 4, gap: 18 };
};

const computeGridLayout = (stack, stage) => {
    const { left, top, width } = stage;
    const { cols, gap } = gridMetrics(width);
    const colW = (width - gap * (cols - 1)) / cols;
    const rows = [];
    stack.items.forEach((item, index) => {
        const row = Math.floor(index / cols);
        const aspect = itemGridAspect(stack, item);
        const height = colW / aspect;
        if (!rows[row] || height > rows[row]) rows[row] = height;
    });
    let y = top;
    const rowTop = rows.map((height) => {
        const topY = y;
        y += height + gap;
        return topY;
    });
    return stack.items.map((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const aspect = itemGridAspect(stack, item);
        const w = colW;
        const h = w / aspect;
        return {
            x: left + col * (colW + gap),
            y: rowTop[row] + (rows[row] - h) / 2,
            w,
            h,
            o: 1,
            role: 'grid',
        };
    });
};

const computeDetailLayout = (stack, heroIndex, view) => {
    const { vw, vh, margin, titleBottom, menuBottom } = view;
    const narrow = vw <= DETAIL_NARROW_PX;
    const gap = narrow ? 16 : 32;
    const thumbW = narrow
        ? Math.round(Math.min(120, Math.max(88, vw * 0.18)))
        : thumbWidthFor(vw);
    const textW = narrow
        ? Math.min(380, vw - margin * 2)
        : textWidthFor(vw);
    const titleGap = 12;
    const heroAspect = aspectOf(stack.items[heroIndex]);

    if (narrow) {
        const bandTop = titleBottom + 8;
        const bandBottom = vh - margin;
        const bandH = Math.max(160, bandBottom - bandTop);
        const maxHeroW = vw - margin * 2;
        const maxHeroH = Math.min(bandH * 0.52, vh * 0.42);
        const hero = fitRect(heroAspect, maxHeroW, maxHeroH);
        const heroX = (vw - hero.w) / 2;
        const heroY = bandTop;
        const textY = heroY + hero.h + 14;
        const textH = 140;
        const thumbY = Math.min(bandBottom - thumbW / Math.min(heroAspect, 1.2) - 8, textY + textH + 12);
        const thumbs = [];
        let x = margin;
        stack.items.forEach((item, index) => {
            if (index === heroIndex) {
                thumbs[index] = null;
                return;
            }
            const aspect = itemGridAspect(stack, item);
            const w = thumbW;
            const h = w / aspect;
            thumbs[index] = { x, y: thumbY, w, h, o: 1, role: 'thumb' };
            x += w + 12;
        });
        return {
            narrow: true,
            poses: stack.items.map((item, index) => (
                index === heroIndex
                    ? { x: heroX, y: heroY, w: hero.w, h: hero.h, o: 1, role: 'hero' }
                    : thumbs[index]
            )),
            copy: { x: margin, y: textY, w: textW, h: textH, stacked: true },
            thumbW,
            textW,
            rail: {
                x: margin,
                y: thumbY,
                w: vw - margin * 2,
                h: thumbW + 48,
                pad: 16,
                gap: 12,
                contentH: x - margin,
                axis: 'x',
            },
        };
    }

    const thumbGap = Math.round(thumbW * 0.07);
    const hoverPad = Math.round(thumbW * 0.08);
    const railTop = menuBottom;
    const railBottom = vh - 16;
    const railH = Math.max(160, railBottom - railTop);
    const leftReserve = margin + thumbW + gap;
    const rightReserve = gap + textW + margin;
    const maxHeroW = Math.max(160, vw - 2 * Math.max(leftReserve, rightReserve));
    const maxHeroH = Math.max(
        160,
        Math.min(vh - margin * 2, vh - (titleBottom + titleGap) - margin)
    );
    let hero = fitRect(heroAspect, maxHeroW, maxHeroH);
    const heroX = (vw - hero.w) / 2;
    let heroY = (vh - hero.h) / 2;
    if (heroY < titleBottom + titleGap) heroY = titleBottom + titleGap;
    if (heroY + hero.h > vh - margin) {
        hero = fitRect(heroAspect, maxHeroW, Math.max(160, vh - margin - heroY));
    }
    const thumbX = heroX - gap - thumbW;
    const thumbSizes = stack.items.map((item, index) => {
        if (index === heroIndex) return null;
        const aspect = itemGridAspect(stack, item);
        return { w: thumbW, h: thumbW / aspect };
    });
    const contentH = thumbSizes.reduce((sum, size) => (
        size ? sum + size.h + thumbGap : sum
    ), -thumbGap);
    let thumbY = railTop;
    const poses = stack.items.map((item, index) => {
        if (index === heroIndex) {
            return { x: heroX, y: heroY, w: hero.w, h: hero.h, o: 1, role: 'hero' };
        }
        const size = thumbSizes[index];
        const pose = { x: thumbX, y: thumbY, w: size.w, h: size.h, o: 1, role: 'thumb' };
        thumbY += size.h + thumbGap;
        return pose;
    });
    return {
        narrow: false,
        poses,
        copy: { x: heroX + hero.w + gap, y: heroY, w: textW, h: hero.h, stacked: false },
        thumbW,
        textW,
        rail: {
            x: thumbX - hoverPad,
            y: railTop,
            w: thumbW + hoverPad * 2,
            h: railH,
            pad: hoverPad,
            gap: thumbGap,
            contentH: Math.max(0, contentH),
            axis: 'y',
        },
    };
};

function DockableCard({ docked, host, children }) {
    if (docked && host) return createPortal(children, host);
    return children;
}

const emptyRailCue = {
    canScroll: false,
    fadeStart: false,
    fadeEnd: false,
    thumbPx: 0,
    thumbPos: 0,
    ratio: 0,
};

function isKeyboardFocus(target) {
    try {
        return target.matches(':focus-visible');
    } catch (err) {
        return true;
    }
}

function decodeImage(node) {
    if (!node) return Promise.resolve();
    if (typeof node.decode === 'function') {
        return node.decode().catch(() => undefined);
    }
    return Promise.resolve();
}

function DecodedImage({ src, alt, loading, fetchPriority }) {
    const [ready, setReady] = useState(false);
    const nodeRef = useRef(null);

    const reveal = useCallback((node) => {
        decodeImage(node).then(() => setReady(true));
    }, []);

    useEffect(() => {
        setReady(false);
        const node = nodeRef.current;
        if (node && node.complete && node.naturalWidth > 0) {
            reveal(node);
        }
    }, [src, reveal]);

    return (
        <img
            ref={nodeRef}
            className={`stack-card-image${ready ? ' is-ready' : ''}`}
            src={src}
            alt={alt}
            draggable={false}
            loading={loading}
            decoding="async"
            fetchPriority={fetchPriority}
            onLoad={(event) => reveal(event.currentTarget)}
            onError={() => setReady(true)}
        />
    );
}

function StackCardFace({ item, index, title, loading = 'lazy', fetchPriority = 'low' }) {
    if (item.type === 'image' && item.src) {
        return (
            <DecodedImage
                src={item.src}
                alt={item.title || `${title} ${index + 1}`}
                loading={loading}
                fetchPriority={fetchPriority}
            />
        );
    }
    return (
        <div
            className="stack-card-color"
            style={{ backgroundColor: item.color || '#FFFFFF' }}
        />
    );
}

const GraffitiGallery = () => {
    const navigate = useNavigate();
    const stacks = designStacks;

    const [orders, setOrders] = useState(() => stacks.map(identityOrder));
    const [fannedStack, setFannedStack] = useState(null);
    const [cyclingStack, setCyclingStack] = useState(null);
    const [cardMs, setCardMs] = useState(FAN_MS);
    const [openStack, setOpenStack] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const [detailIndex, setDetailIndex] = useState(null);
    const [copyVisible, setCopyVisible] = useState(false);
    const [copyBox, setCopyBox] = useState(null);
    const [railBox, setRailBox] = useState(null);
    const [thumbsDocked, setThumbsDocked] = useState(false);
    const [railCue, setRailCue] = useState(emptyRailCue);
    const [motionGen, setMotionGen] = useState(0);
    const [chromeOn, setChromeOn] = useState(false);

    const buttonsRef = useRef([]);
    const overlayRef = useRef(null);
    const closeRef = useRef(null);
    const headRef = useRef(null);
    const navRef = useRef(null);
    const stageRef = useRef(null);
    const railElRef = useRef(null);
    const railInnerRef = useRef(null);
    const railBarRef = useRef(null);
    const veilRef = useRef(null);
    const pileRef = useRef([]);
    const leaveTimerRef = useRef(0);
    const lastSwapRef = useRef(0);
    const cyclingRef = useRef(null);
    const cardRefs = useRef([]);
    const copyRef = useRef(null);
    const titleRef = useRef(null);
    const dateRef = useRef(null);
    const textRef = useRef(null);
    const revealRef = useRef(null);
    const posesRef = useRef([]);
    const destRef = useRef([]);
    const animRef = useRef(0);
    const busyRef = useRef(false);
    const busyTokenRef = useRef(0);
    const busyTimerRef = useRef(0);
    const railRef = useRef(null);
    const openedRef = useRef(false);
    const pendingJobRef = useRef(null);
    const pendingPinRef = useRef(null);
    const pendingCloseRef = useRef(null);
    const thumbsDockedRef = useRef(false);
    if (!revealRef.current) revealRef.current = createTextReveal();
    cyclingRef.current = cyclingStack;
    thumbsDockedRef.current = thumbsDocked;

    const motion = useMemo(
        () => ({
            fineHover:
                typeof window !== 'undefined'
                && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
            reduced:
                typeof window !== 'undefined'
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        }),
        []
    );

    const isOpen = Number.isInteger(openStack);
    const inDetail = detailIndex != null;
    const openDetail = isOpen ? stacks[openStack] : null;
    const activeItem = openDetail && inDetail ? openDetail.items[detailIndex] : null;
    const copy = activeItem ? itemCopy(activeItem) : null;

    const viewBox = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const head = headRef.current?.getBoundingClientRect();
        const nav = navRef.current?.getBoundingClientRect();
        return {
            vw,
            vh,
            margin: vw <= DETAIL_NARROW_PX ? 16 : 28,
            titleBottom: head ? head.bottom : 128,
            menuBottom: (nav ? nav.bottom : 94) + 10,
        };
    };

    const stageBox = () => {
        const view = viewBox();
        const width = Math.min(980, view.vw - view.margin * 2);
        return {
            left: (view.vw - width) / 2,
            top: view.titleBottom + 8,
            width,
        };
    };

    const applyVisual = (el, visual, dest) => {
        if (!el || !visual || !dest) return;
        el.style.position = 'absolute';
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.width = `${dest.w}px`;
        el.style.height = `${dest.h}px`;
        el.style.opacity = String(visual.o ?? 1);
        el.style.transformOrigin = 'top left';
        el.style.transform =
            `translate3d(${visual.x}px, ${visual.y}px, 0) scale(${visual.w / dest.w}, ${visual.h / dest.h})`;
        if (dest.z != null || visual.z != null) {
            el.style.zIndex = String(dest.z ?? visual.z);
        }
        const rail = railRef.current;
        if (rail && visual.role === 'thumb') {
            const sy = visual.h / Math.max(1, dest.h);
            const pad = rail.pad || Math.round(dest.w * 0.08);
            const clipTop = Math.max(0, (rail.y - visual.y) / sy);
            const clipBottom = Math.max(0, (visual.y + visual.h - (rail.y + rail.h)) / sy);
            el.style.clipPath = `inset(${clipTop}px ${-pad}px ${clipBottom}px ${-pad}px)`;
        } else {
            el.style.clipPath = '';
        }
    };

    const applyAll = (visuals, dests) => {
        visuals.forEach((visual, index) => {
            applyVisual(cardRefs.current[index], visual, dests[index] || visual);
        });
    };

    const measurePilePoses = (stackIndex) => {
        const stack = stacks[stackIndex];
        if (!stack) return [];
        const button = buttonsRef.current[stackIndex];
        const order = orders[stackIndex] || identityOrder(stack);
        const depths = new Map(order.map((item, depth) => [item, depth]));
        const nodes = button?.querySelectorAll('.stack-card');
        const box = button?.querySelector('.design-stack-cards')?.getBoundingClientRect();
        return stack.items.map((item, itemIndex) => {
            const depth = depths.get(itemIndex) ?? 0;
            const z = stack.items.length - depth;
            const node = nodes?.[itemIndex];
            const rect = node?.getBoundingClientRect();
            if (rect && rect.width > 1 && rect.height > 1) {
                return {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                    o: 1,
                    z,
                    role: 'pile',
                };
            }
            const size = box?.width || 200;
            const fit = pileFit(item, stack);
            const w = size * fit.w;
            const h = size * fit.h;
            return {
                x: (box?.left ?? 0) + ((box?.width ?? size) - w) / 2,
                y: (box?.top ?? 0) + ((box?.height ?? size) - h) / 2,
                w,
                h,
                o: 1,
                z,
                role: 'pile',
            };
        });
    };

    const measureOnScreen = () => {
        const fallback = posesRef.current.length ? posesRef.current : destRef.current;
        if (!openDetail) return fallback;
        return openDetail.items.map((_, index) => {
            const el = cardRefs.current[index];
            const prev = fallback[index];
            if (!el) return poseOr(prev, destRef.current[index]);
            const rect = el.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
                o: 1,
                role: destRef.current[index]?.role || prev?.role || 'grid',
            };
        });
    };

    const applyDockedLayout = () => {
        destRef.current.forEach((pose, index) => {
            const el = cardRefs.current[index];
            if (!el || pose.role !== 'thumb') return;
            el.style.position = 'relative';
            el.style.left = 'auto';
            el.style.top = 'auto';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.width = `${pose.w}px`;
            el.style.height = `${pose.h}px`;
            el.style.opacity = '1';
            el.style.transform = 'none';
            el.style.clipPath = '';
            el.style.flex = '0 0 auto';
        });
    };

    const updateRailCue = () => {
        const node = railElRef.current;
        const rail = railRef.current;
        if (!node || !rail) {
            setRailCue(emptyRailCue);
            return;
        }
        const vertical = rail.axis !== 'x';
        const client = vertical ? node.clientHeight : node.clientWidth;
        const scrollSize = vertical ? node.scrollHeight : node.scrollWidth;
        const scroll = vertical ? node.scrollTop : node.scrollLeft;
        const max = Math.max(0, scrollSize - client);
        const canScroll = max > 1;
        const track = Math.max(0, client - 8);
        const thumbPx = canScroll ? Math.max(24, (client / Math.max(1, scrollSize)) * track) : 0;
        const travel = Math.max(0, track - thumbPx);
        const ratio = max ? scroll / max : 0;
        const next = {
            canScroll,
            fadeStart: canScroll && scroll > 1,
            fadeEnd: canScroll && scroll < max - 1,
            thumbPx,
            thumbPos: ratio * travel,
            ratio,
        };
        setRailCue((prev) => (
            prev.canScroll === next.canScroll
            && prev.fadeStart === next.fadeStart
            && prev.fadeEnd === next.fadeEnd
            && Math.abs(prev.thumbPx - next.thumbPx) < 0.5
            && Math.abs(prev.thumbPos - next.thumbPos) < 0.5
                ? prev
                : next
        ));
    };

    const stopMotion = () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        animRef.current = 0;
    };

    const clearBusyTimer = () => {
        if (busyTimerRef.current) {
            window.clearTimeout(busyTimerRef.current);
            busyTimerRef.current = 0;
        }
    };

    const releaseBusy = (token) => {
        if (token != null && token !== busyTokenRef.current) return false;
        clearBusyTimer();
        busyRef.current = false;
        return true;
    };

    const armBusy = () => {
        const token = busyTokenRef.current + 1;
        busyTokenRef.current = token;
        busyRef.current = true;
        clearBusyTimer();
        busyTimerRef.current = window.setTimeout(() => {
            if (busyTokenRef.current === token) {
                busyRef.current = false;
                busyTimerRef.current = 0;
            }
        }, DETAIL_MS + DETAIL_BUSY_MARGIN_MS);
        return token;
    };

    const runMotion = (from, to, onDone, extras = {}) => {
        stopMotion();
        destRef.current = to;
        const duration = extras.duration ?? DETAIL_MS;
        const veilFrom = extras.veilFrom;
        const veilTo = extras.veilTo;
        const setVeil = (amount) => {
            if (!veilRef.current || veilFrom == null || veilTo == null) return;
            veilRef.current.style.opacity = String(lerp(veilFrom, veilTo, amount));
        };
        const safeFrom = to.map((pose, index) => poseOr(from[index], pose));
        const finish = () => {
            setVeil(1);
            applyAll(to, to);
            posesRef.current = to;
            onDone?.();
        };
        if (motion.reduced) {
            finish();
            return;
        }
        setVeil(0);
        applyAll(safeFrom, to);
        posesRef.current = safeFrom;
        const t0 = performance.now();
        const tick = (now) => {
            try {
                const raw = Math.min(1, (now - t0) / duration);
                const amount = easeBezier(DETAIL_EASE, raw);
                const next = safeFrom.map((pose, index) => lerpPose(pose, to[index], amount));
                posesRef.current = next;
                applyAll(next, to);
                setVeil(amount);
                if (raw < 1) {
                    animRef.current = requestAnimationFrame(tick);
                    return;
                }
                animRef.current = 0;
                finish();
            } catch (err) {
                animRef.current = 0;
                finish();
            }
        };
        animRef.current = requestAnimationFrame(tick);
    };

    const layoutFor = useCallback((heroIndex) => {
        if (!openDetail) return null;
        if (heroIndex == null) {
            return {
                poses: computeGridLayout(openDetail, stageBox()),
                copy: null,
                rail: null,
            };
        }
        return computeDetailLayout(openDetail, heroIndex, viewBox());
    }, [openDetail]);

    const beginHover = (stackIndex) => {
        if (motion.reduced || isOpen) return;
        window.clearTimeout(leaveTimerRef.current);
        setCardMs(FAN_MS);
        setFannedStack(stackIndex);
        if (motion.fineHover) setCyclingStack(stackIndex);
    };

    const settleStack = useCallback((stackIndex) => {
        setCardMs(FAN_MS);
        setFannedStack((current) => (current === stackIndex ? null : current));
        setCyclingStack((current) => (current === stackIndex ? null : current));
    }, []);

    const endHover = (stackIndex) => {
        if (motion.reduced || isOpen) return;
        setCyclingStack((current) => (current === stackIndex ? null : current));
        const remaining = Math.max(0, lastSwapRef.current + SWAP_MS - performance.now());
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = window.setTimeout(() => settleStack(stackIndex), remaining);
    };

    useEffect(() => {
        if (cyclingStack === null || isOpen || motion.reduced) return undefined;
        const id = window.setInterval(() => {
            if (cyclingRef.current !== cyclingStack) return;
            setCardMs(SWAP_MS);
            lastSwapRef.current = performance.now();
            setOrders((previous) =>
                previous.map((order, index) =>
                    index === cyclingStack ? advanceOrder(order) : order
                )
            );
        }, CAROUSEL_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [cyclingStack, isOpen, motion.reduced]);

    const hideCopy = () => {
        revealRef.current.clear({
            container: copyRef.current,
            textEls: [titleRef.current, dateRef.current, textRef.current],
        });
        setCopyVisible(false);
    };

    const finishClose = useCallback(() => {
        const trigger = Number.isInteger(openStack) ? buttonsRef.current[openStack] : null;
        stopMotion();
        hideCopy();
        setIsLeaving(false);
        setOpenStack(null);
        setDetailIndex(null);
        setCopyBox(null);
        setRailBox(null);
        setThumbsDocked(false);
        setRailCue(emptyRailCue);
        setChromeOn(false);
        posesRef.current = [];
        destRef.current = [];
        pileRef.current = [];
        openedRef.current = false;
        busyTokenRef.current += 1;
        releaseBusy();
        railRef.current = null;
        pendingJobRef.current = null;
        pendingPinRef.current = null;
        pendingCloseRef.current = null;
        if (trigger) trigger.focus();
    }, [openStack]);

    const moveDetail = useCallback((nextIndex) => {
        if (!openDetail) return;
        if (nextIndex === detailIndex && !busyRef.current) return;
        hideCopy();
        const layout = layoutFor(nextIndex);
        if (!layout) {
            releaseBusy();
            return;
        }
        const measured = measureOnScreen();
        const from = (measured.length ? measured : layout.poses)
            .map((pose, index) => poseOr(pose, layout.poses[index]));
        stopMotion();
        const token = armBusy();
        pendingJobRef.current = { from, layout, nextIndex, token };
        pendingPinRef.current = from;
        pendingCloseRef.current = null;
        setDetailIndex(nextIndex);
        setCopyBox(layout.copy);
        setRailBox(layout.rail);
        railRef.current = layout.rail;
        setThumbsDocked(false);
        setMotionGen((value) => value + 1);
    }, [openDetail, detailIndex, layoutFor]);

    const closeStack = useCallback(() => {
        if (!isOpen || isLeaving) return;
        if (detailIndex != null || thumbsDockedRef.current) {
            moveDetail(null);
            return;
        }
        hideCopy();
        const from = measureOnScreen();
        const pile = measurePilePoses(openStack);
        pileRef.current = pile;
        const runLeave = (start) => {
            if (motion.reduced || !start.length) {
                setIsLeaving(true);
                setChromeOn(false);
                if (!start.length) {
                    window.clearTimeout(leaveTimerRef.current);
                    leaveTimerRef.current = window.setTimeout(finishClose, CLOSE_MS);
                    return;
                }
                finishClose();
                return;
            }
            const to = pile.length === start.length
                ? pile
                : start.map((pose, index) => poseOr(pile[index], {
                    x: pose.x,
                    y: pose.y,
                    w: pose.w,
                    h: pose.h,
                    o: 1,
                    role: 'pile',
                }));
            const token = armBusy();
            setIsLeaving(true);
            setChromeOn(false);
            runMotion(start, to, () => {
                releaseBusy(token);
                finishClose();
            }, { duration: CLOSE_MS, veilFrom: 1, veilTo: 0 });
        };
        pendingJobRef.current = null;
        if (thumbsDockedRef.current) {
            pendingPinRef.current = from;
            pendingCloseRef.current = () => runLeave(from);
            setThumbsDocked(false);
            setMotionGen((value) => value + 1);
            return;
        }
        runLeave(from);
    }, [isOpen, isLeaving, motion.reduced, finishClose, origin, openDetail, detailIndex, moveDetail, openStack, orders]);

    const closeDetail = useCallback(() => {
        if (detailIndex == null && !thumbsDockedRef.current && !busyRef.current) return;
        moveDetail(null);
    }, [detailIndex, moveDetail]);

    const onCloseStep = (event) => {
        event.stopPropagation();
        if (detailIndex != null) closeDetail();
        else closeStack();
    };

    useLayoutEffect(() => {
        if (!openDetail || openedRef.current || isLeaving) return;
        openedRef.current = true;
        const grid = computeGridLayout(openDetail, stageBox());
        destRef.current = grid;
        const pile = pileRef.current.length ? pileRef.current : measurePilePoses(openStack);
        const start = pile.length === grid.length
            ? pile
            : grid.map((pose) => ({
                x: window.innerWidth / 2 + origin.x - pose.w * 0.36,
                y: window.innerHeight / 2 + origin.y - pose.h * 0.36,
                w: pose.w * 0.72,
                h: pose.h * 0.72,
                o: 1,
                role: 'pile',
            }));
        posesRef.current = start;
        if (motion.reduced) {
            applyAll(grid, grid);
            posesRef.current = grid;
            if (veilRef.current) veilRef.current.style.opacity = '1';
            releaseBusy();
            return;
        }
        const token = armBusy();
        runMotion(start, grid, () => {
            releaseBusy(token);
        }, { duration: CLOSE_MS, veilFrom: 0, veilTo: 1 });
    }, [openDetail, origin, motion.reduced, isLeaving, openStack]);

    useLayoutEffect(() => {
        if (!isOpen || isLeaving) {
            setChromeOn(false);
            return undefined;
        }
        const id = window.requestAnimationFrame(() => setChromeOn(true));
        return () => window.cancelAnimationFrame(id);
    }, [isOpen, isLeaving]);

    useLayoutEffect(() => {
        if (pendingPinRef.current) {
            const pin = pendingPinRef.current;
            pendingPinRef.current = null;
            applyAll(pin, destRef.current.length ? destRef.current : pin);
            posesRef.current = pin;
        }
        if (pendingCloseRef.current) {
            const leave = pendingCloseRef.current;
            pendingCloseRef.current = null;
            leave();
            return;
        }
        const job = pendingJobRef.current;
        if (job) {
            pendingJobRef.current = null;
            destRef.current = job.layout.poses;
            applyAll(job.from, job.layout.poses);
            runMotion(job.from, job.layout.poses, () => {
                if (!releaseBusy(job.token)) return;
                if (job.nextIndex != null) {
                    setThumbsDocked(true);
                    setCopyVisible(true);
                    return;
                }
                setThumbsDocked(false);
                setRailBox(null);
                setRailCue(emptyRailCue);
                railRef.current = null;
                destRef.current = job.layout.poses;
                posesRef.current = job.layout.poses;
                applyAll(job.layout.poses, job.layout.poses);
            });
            return;
        }
        if (thumbsDocked) {
            if (railElRef.current) {
                railElRef.current.scrollTop = 0;
                railElRef.current.scrollLeft = 0;
            }
            applyDockedLayout();
            updateRailCue();
        }
    }, [thumbsDocked, motionGen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onResize = () => {
            if (busyRef.current) return;
            const layout = layoutFor(detailIndex);
            if (!layout) return;
            destRef.current = layout.poses;
            posesRef.current = layout.poses;
            setCopyBox(layout.copy);
            setRailBox(layout.rail);
            railRef.current = layout.rail;
            if (railElRef.current) {
                railElRef.current.scrollTop = 0;
                railElRef.current.scrollLeft = 0;
            }
            if (detailIndex != null && thumbsDockedRef.current) {
                applyDockedLayout();
                updateRailCue();
                return;
            }
            applyAll(layout.poses, layout.poses);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isOpen, detailIndex, layoutFor]);

    useEffect(() => {
        const container = copyRef.current;
        if (!copyVisible || detailIndex == null || !container) return undefined;
        const textEls = [titleRef.current, dateRef.current, textRef.current].filter(Boolean);
        if (motion.reduced) {
            revealRef.current.clear({ container, textEls });
            return undefined;
        }
        const id = window.requestAnimationFrame(() => {
            revealRef.current.start({
                container,
                textEls,
                reducedMotion: false,
            });
        });
        return () => {
            window.cancelAnimationFrame(id);
            revealRef.current.clear({ container, textEls });
        };
    }, [copyVisible, detailIndex, motion.reduced]);

    useEffect(() => () => {
        window.clearTimeout(leaveTimerRef.current);
        stopMotion();
        clearBusyTimer();
        revealRef.current.clear();
    }, []);

    useEffect(() => {
        const indexes = [fannedStack, cyclingStack, openStack].filter(Number.isInteger);
        indexes.forEach((stackIndex) => {
            const stack = stacks[stackIndex];
            if (!stack) return;
            stack.items.forEach((item) => {
                if (item.type !== 'image' || !item.src) return;
                const preload = new Image();
                preload.decoding = 'async';
                preload.src = item.src;
                decodeImage(preload);
            });
        });
    }, [fannedStack, cyclingStack, openStack, stacks]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const { body } = document;
        const previousOverflow = body.style.overflow;
        const previousPadding = body.style.paddingRight;
        const gutter = window.innerWidth - document.documentElement.clientWidth;
        body.style.overflow = 'hidden';
        if (gutter > 0) body.style.paddingRight = `${gutter}px`;
        const node = closeRef.current || overlayRef.current;
        if (node) node.focus();
        return () => {
            body.style.overflow = previousOverflow;
            body.style.paddingRight = previousPadding;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            if (detailIndex != null) closeDetail();
            else closeStack();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, detailIndex, closeDetail, closeStack]);

    const onRailBarPointerDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const node = railElRef.current;
        const rail = railRef.current;
        const bar = railBarRef.current;
        if (!node || !rail || !bar) return;
        const vertical = rail.axis !== 'x';
        const rect = bar.getBoundingClientRect();
        const client = vertical ? node.clientHeight : node.clientWidth;
        const scrollSize = vertical ? node.scrollHeight : node.scrollWidth;
        const max = Math.max(0, scrollSize - client);
        const track = Math.max(1, vertical ? rect.height : rect.width);
        const thumbPx = Math.max(24, (client / Math.max(1, scrollSize)) * track);
        const travel = Math.max(1, track - thumbPx);
        const pointer = vertical ? event.clientY - rect.top : event.clientX - rect.left;
        const currentPos = max ? ((vertical ? node.scrollTop : node.scrollLeft) / max) * travel : 0;
        if (pointer < currentPos || pointer > currentPos + thumbPx) {
            const next = ((pointer - thumbPx / 2) / travel) * max;
            if (vertical) node.scrollTop = next;
            else node.scrollLeft = next;
        }
        const start = vertical ? event.clientY : event.clientX;
        const startScroll = vertical ? node.scrollTop : node.scrollLeft;
        const onMove = (moveEvent) => {
            const delta = (vertical ? moveEvent.clientY : moveEvent.clientX) - start;
            const next = startScroll + (delta / travel) * max;
            if (vertical) node.scrollTop = next;
            else node.scrollLeft = next;
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const onOverlayKeyDown = (event) => {
        if (event.key !== 'Tab') return;
        const overlay = overlayRef.current;
        if (!overlay) return;
        const focusable = overlay.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const onOverlayClick = (event) => {
        if (event.target.closest('.stack-grid-card')) return;
        if (event.target.closest('.stack-overlay-close')) return;
        if (event.target.closest('.stack-detail-copy')) return;
        if (event.target.closest('.stack-detail-rail-wrap')) return;
        if (event.target.closest('.stack-overlay-title')) return;
        if (detailIndex != null) {
            closeDetail();
            return;
        }
        closeStack();
    };

    const openFromButton = (stackIndex, button) => {
        window.clearTimeout(leaveTimerRef.current);
        setCyclingStack(null);
        setFannedStack(null);
        hideCopy();
        pileRef.current = measurePilePoses(stackIndex);
        setDetailIndex(null);
        openedRef.current = false;
        posesRef.current = [];
        destRef.current = [];
        pendingJobRef.current = null;
        pendingPinRef.current = null;
        pendingCloseRef.current = null;
        busyTokenRef.current += 1;
        releaseBusy();
        setThumbsDocked(false);
        setRailCue(emptyRailCue);
        const rect = button?.getBoundingClientRect();
        if (rect) {
            setOrigin({
                x: rect.left + rect.width / 2 - window.innerWidth / 2,
                y: rect.top + rect.height / 2 - window.innerHeight / 2,
            });
        } else {
            setOrigin({ x: 0, y: 0 });
        }
        setOpenStack(stackIndex);
    };

    return (
        <div className="bg-level-3 design-page">
            <div className="header-container">
                <div className="header-nav" ref={navRef}>
                    <button className="header-button" onClick={() => navigate('/portfolio')}>
                        Portfolio
                    </button>
                    <button className="header-button" onClick={() => navigate('/store')}>
                        Store
                    </button>
                </div>
                <span className="header-logo" onClick={() => navigate('/')}>
                    Return Home
                </span>
            </div>

            <div className="design-stacks">
                <div className="design-stacks-grid">
                    {stacks.map((stack, stackIndex) => {
                        const order = orders[stackIndex];
                        const depths = new Map(order.map((item, depth) => [item, depth]));
                        const fanned = fannedStack === stackIndex && !isOpen && !motion.reduced;
                        return (
                            <button
                                type="button"
                                key={stack.title}
                                ref={(node) => {
                                    buttonsRef.current[stackIndex] = node;
                                }}
                                className={[
                                    'design-stack',
                                    fanned ? 'is-fanned' : '',
                                    isOpen && stackIndex !== openStack ? 'is-background' : '',
                                    isOpen && stackIndex === openStack ? 'is-source-open' : '',
                                ].filter(Boolean).join(' ')}
                                style={{ '--card-ms': `${fanned ? cardMs : FAN_MS}ms` }}
                                aria-label={`${stack.title}, ${stack.items.length} items`}
                                onMouseEnter={() => {
                                    if (!motion.fineHover) return;
                                    beginHover(stackIndex);
                                }}
                                onMouseLeave={() => {
                                    if (!motion.fineHover) return;
                                    endHover(stackIndex);
                                }}
                                onFocus={(event) => {
                                    if (!isKeyboardFocus(event.target)) return;
                                    beginHover(stackIndex);
                                }}
                                onBlur={() => endHover(stackIndex)}
                                onClick={(event) => openFromButton(stackIndex, event.currentTarget)}
                            >
                                <span className="design-stack-cards">
                                    {stack.items.map((item, itemIndex) => {
                                        const depth = depths.get(itemIndex) ?? 0;
                                        const pose = poseFor(depth, fanned);
                                        const stackActive = fanned
                                            || cyclingStack === stackIndex
                                            || (isOpen && stackIndex === openStack);
                                        const onTop = depth === 0;
                                        const fit = pileFit(item, stack);
                                        return (
                                            <span
                                                key={itemIndex}
                                                className={`stack-card ${cardClassNames(stack)}`}
                                                style={{
                                                    zIndex: stack.items.length - depth,
                                                    '--fit-w': String(fit.w),
                                                    '--fit-h': String(fit.h),
                                                    transform: `translate(-50%, -50%) translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.r}deg)`,
                                                }}
                                            >
                                                <StackCardFace
                                                    item={item}
                                                    index={itemIndex}
                                                    title={stack.title}
                                                    loading={stackActive || onTop ? 'eager' : 'lazy'}
                                                    fetchPriority={onTop ? 'high' : 'low'}
                                                />
                                            </span>
                                        );
                                    })}
                                </span>
                                <span className="design-stack-title">{stack.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {openDetail ? (
                <div
                    className={`stack-overlay${isLeaving ? ' is-leaving' : ''}${chromeOn ? ' is-chrome-on' : ''}${motion.reduced ? ' is-reduced' : ''}${inDetail ? ' is-detail' : ''}`}
                    style={{ '--chrome-fade-ms': `${CHROME_FADE_MS}ms` }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={openDetail.title}
                    ref={overlayRef}
                    tabIndex={-1}
                    onClick={onOverlayClick}
                    onKeyDown={onOverlayKeyDown}
                >
                    <div className="stack-page-veil" ref={veilRef} />
                    <div className="stack-overlay-head" ref={headRef}>
                        <h2 className="stack-overlay-title">{openDetail.title}</h2>
                        <button
                            type="button"
                            className="stack-overlay-close"
                            aria-label={inDetail ? 'Back to grid' : 'Close'}
                            ref={closeRef}
                            onClick={onCloseStep}
                        >
                            ×
                        </button>
                    </div>
                    <div className="stack-overlay-stage" ref={stageRef}>
                        {inDetail && railBox ? (
                            <div
                                className={[
                                    'stack-detail-rail-wrap',
                                    railBox.axis === 'x' ? 'is-x' : 'is-y',
                                    (thumbsDocked && (railCue.canScroll || railBox.contentH > railBox.h + 1)) ? 'is-scrollable' : '',
                                    railCue.fadeStart ? 'has-fade-start' : '',
                                    railCue.fadeEnd ? 'has-fade-end' : '',
                                ].filter(Boolean).join(' ')}
                                style={{
                                    left: `${railBox.x}px`,
                                    top: `${railBox.y}px`,
                                    width: `${railBox.w}px`,
                                    height: `${railBox.h}px`,
                                }}
                                onClick={(event) => event.stopPropagation()}
                                onWheel={(event) => {
                                    event.stopPropagation();
                                    const node = railElRef.current;
                                    const rail = railRef.current;
                                    if (!node || !rail || !event.target.closest('.stack-detail-rail-bar')) return;
                                    if (rail.axis === 'x') node.scrollLeft += event.deltaX || event.deltaY;
                                    else node.scrollTop += event.deltaY;
                                }}
                            >
                                <div
                                    className="stack-detail-rail"
                                    ref={railElRef}
                                    onScroll={updateRailCue}
                                >
                                    <div
                                        className="stack-detail-rail-inner"
                                        ref={railInnerRef}
                                        style={{
                                            gap: `${railBox.gap || 0}px`,
                                            padding: railBox.axis === 'x'
                                                ? `${railBox.pad || 0}px 0`
                                                : `0 ${railBox.pad || 0}px`,
                                        }}
                                    />
                                </div>
                                <div className="stack-detail-rail-fade is-start" />
                                <div className="stack-detail-rail-fade is-end" />
                                {railCue.canScroll ? (
                                    <div
                                        className="stack-detail-rail-bar"
                                        ref={railBarRef}
                                        role="scrollbar"
                                        aria-orientation={railBox.axis === 'x' ? 'horizontal' : 'vertical'}
                                        aria-valuenow={Math.round(railCue.ratio * 100)}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        onPointerDown={onRailBarPointerDown}
                                    >
                                        <div
                                            className="stack-detail-rail-bar-thumb"
                                            style={
                                                railBox.axis === 'x'
                                                    ? {
                                                        width: `${railCue.thumbPx}px`,
                                                        transform: `translateX(${railCue.thumbPos}px)`,
                                                    }
                                                    : {
                                                        height: `${railCue.thumbPx}px`,
                                                        transform: `translateY(${railCue.thumbPos}px)`,
                                                    }
                                            }
                                        />
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {openDetail.items.map((item, itemIndex) => {
                            const pose = destRef.current[itemIndex];
                            const role = !inDetail
                                ? 'grid'
                                : (pose?.role || (itemIndex === detailIndex ? 'hero' : 'thumb'));
                            const aspect = role === 'hero'
                                ? aspectOf(item)
                                : itemGridAspect(openDetail, item);
                            const docked = thumbsDocked && role === 'thumb';
                            const hot = !isLeaving && role !== 'hero' && role !== 'pile';
                            return (
                                <DockableCard
                                    key={itemIndex}
                                    docked={docked}
                                    host={railInnerRef.current}
                                >
                                    <button
                                        type="button"
                                        ref={(node) => {
                                            cardRefs.current[itemIndex] = node;
                                        }}
                                        className={`stack-grid-card ${cardClassNames(openDetail, [
                                            role === 'hero' ? 'is-hero' : '',
                                            role === 'thumb' ? 'is-thumb' : '',
                                            role === 'pile' ? 'is-pile' : '',
                                            docked ? 'is-docked' : '',
                                            hot ? 'is-hot' : '',
                                        ])}`}
                                        style={{
                                            '--delay': `${itemIndex * OPEN_STAGGER_MS}ms`,
                                            '--aspect': String(aspect),
                                            zIndex: role === 'hero' ? 4 : 2,
                                        }}
                                        aria-label={
                                            role === 'hero'
                                                ? (item.title || `${openDetail.title} ${itemIndex + 1}`)
                                                : `Open ${item.title || `${openDetail.title} ${itemIndex + 1}`}`
                                        }
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (role === 'hero') return;
                                            moveDetail(itemIndex);
                                        }}
                                    >
                                        <span className="stack-grid-card-face">
                                            <StackCardFace
                                                item={item}
                                                index={itemIndex}
                                                title={openDetail.title}
                                                loading="eager"
                                                fetchPriority="high"
                                            />
                                        </span>
                                    </button>
                                </DockableCard>
                            );
                        })}
                        {inDetail && copy && copyBox ? (
                            <div
                                className={`stack-detail-copy${copyVisible ? ' is-on' : ''}${copyBox.stacked ? ' is-stacked' : ''}`}
                                ref={copyRef}
                                style={{
                                    left: `${copyBox.x}px`,
                                    top: `${copyBox.y}px`,
                                    width: `${copyBox.w}px`,
                                    height: `${copyBox.h}px`,
                                }}
                            >
                                <div className="stack-detail-meta">
                                    <i className="stack-detail-title" ref={titleRef}>{copy.title}</i>
                                    {copy.date ? (
                                        <div className="stack-detail-date" ref={dateRef}>{copy.date}</div>
                                    ) : null}
                                </div>
                                <p className="stack-detail-text" ref={textRef}>{copy.description}</p>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default GraffitiGallery;
