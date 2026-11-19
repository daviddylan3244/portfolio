import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';
import designStacks from '../data/design-stacks.json';
import { createTextReveal, setDescriptionText } from '../utils/textReveal';

const CLOSE_MS = 450;
const CHROME_FADE_MS = 180;
const OPEN_STAGGER_MS = 40;
const DETAIL_MS = 450;
const DETAIL_BUSY_MARGIN_MS = 120;
const DETAIL_EASE = [0.22, 1, 0.36, 1];
const DETAIL_NARROW_PX = 819;
const DETAIL_LOREM =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const FILE_TURN_MS = 750;
const FILE_OPEN_MS = 700;
const FILE_FIRST_TURN_MS = 1500;
const FILE_EVERY_MS = 1600;
const FILE_BACK_GAP_MS = 110;
const FILE_LOOP_PAUSE_MS = 700;
const FILE_REST_FILL = 0.8;

const fileNumber = (index) => String(index + 1).padStart(3, '0');

// Keep in sync with pageSrc in scripts/make-design-pages.js.
const pageSrc = (src) => String(src)
    .replace(/^\/Product-design\//, '/Product-design/pages/')
    .replace(/\.[^./]+$/, '.jpg');

const aspectOf = (item) => {
    const width = Number(item?.width);
    const height = Number(item?.height);
    if (width > 0 && height > 0) return width / height;
    return 1;
};

const usesOwnCard = (stack, item) => (
    stack.cardShape === 'fixed'
    && stack.fit === 'cover'
    && stack.cardAspect > 1
    && aspectOf(item) < 1
);

const pileFit = (item, stack) => {
    if (stack.cardShape === 'square') return { w: 1, h: 1 };
    const aspect = usesOwnCard(stack, item)
        ? aspectOf(item)
        : (stack.cardAspect > 0 ? stack.cardAspect : aspectOf(item));
    if (aspect >= 1) return { w: 1, h: 1 / aspect };
    return { w: aspect, h: 1 };
};

const cardClassNames = (stack, extra = [], item = null) => {
    const names = [
        stack.cardShape === 'square' ? 'is-square' : '',
        stack.cardShape === 'fixed' ? 'is-fixed' : '',
        stack.cardShape === 'natural' ? 'is-natural' : '',
        stack.fit === 'cover' && !(item && usesOwnCard(stack, item)) ? 'is-cover' : '',
        stack.frame === 'thin-white' ? 'is-framed' : '',
        ...extra,
    ];
    return names.filter(Boolean).join(' ');
};

const itemCopy = (item) => ({
    title: item?.title ? item.title : 'Untitled',
    date: item?.date ? item.date : '',
    description: item?.description ? String(item.description).trim() : '',
});

const itemGridAspect = (stack, item) => {
    if (usesOwnCard(stack, item)) return aspectOf(item);
    if (stack.cardShape === 'square') return 1;
    if (stack.cardAspect > 0) return stack.cardAspect;
    return aspectOf(item);
};

const thumbWidthFor = (vw) => Math.round(Math.min(220, Math.max(165, vw * 0.1146)));
const textWidthFor = (vw) => Math.round(Math.min(380, Math.max(300, vw * 0.21)));

const readSafe = (name) => {
    if (typeof document === 'undefined') return 0;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
};

const detailIsNarrow = (vw, vh) => vw <= DETAIL_NARROW_PX || vh <= 500;

let copyProbe = null;

const measureDetailCopyHeight = (copy, textW) => {
    if (!copy || !(textW > 0) || typeof document === 'undefined') return 0;
    if (!copyProbe) {
        const probe = document.createElement('div');
        probe.className = 'stack-detail-copy is-stacked';
        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'fixed';
        probe.style.left = '0';
        probe.style.top = '0';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.height = 'auto';
        probe.style.maxHeight = 'none';
        probe.style.zIndex = '-1';
        const meta = document.createElement('div');
        meta.className = 'stack-detail-meta';
        const title = document.createElement('i');
        title.className = 'stack-detail-title';
        const date = document.createElement('div');
        date.className = 'stack-detail-date';
        const text = document.createElement('p');
        text.className = 'stack-detail-text';
        meta.append(title, date);
        probe.append(meta, text);
        document.body.appendChild(probe);
        copyProbe = { probe, title, date, text };
    }
    copyProbe.title.textContent = copy.title || '';
    copyProbe.date.textContent = copy.date || '';
    copyProbe.date.style.display = copy.date ? '' : 'none';
    setDescriptionText(copyProbe.text, copy.description || DETAIL_LOREM);
    copyProbe.probe.style.width = `${Math.round(textW)}px`;
    return Math.ceil(copyProbe.probe.offsetHeight);
};

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

const CLOSE_BTN = 44;
const CLOSE_BTN_PAD = 8;
const TITLE_TOP_REM = 5.5;
const DETAIL_PROBE = process.env.NODE_ENV !== 'production';

const predictedTitleBottom = (vw) => {
    const rem = remPx();
    const font = clamp(vw * 0.024, 1.2 * rem, 1.7 * rem);
    return TITLE_TOP_REM * rem + font * 1.2;
};

const sameBox = (a, b) => (
    !!a
    && !!b
    && Math.abs(a.x - b.x) < 0.01
    && Math.abs(a.y - b.y) < 0.01
    && Math.abs(a.w - b.w) < 0.01
    && Math.abs(a.h - b.h) < 0.01
);

const remPx = () => {
    if (typeof window === 'undefined') return 16;
    const raw = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(raw) && raw > 0 ? raw : 16;
};

const closeGapFor = (vw) => Math.round(clamp((vw * 28) / 1440, 22, 36));

const gridClosePose = (vw) => {
    const rem = remPx();
    return {
        x: vw - 1.25 * rem - CLOSE_BTN,
        y: 5.5 * rem,
    };
};

const boxesOverlap = (a, b) => (
    !!a
    && !!b
    && a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
);

const asBox = (rect) => {
    if (!rect) return null;
    if (rect.w != null) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    return {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
    };
};

const nudgeClear = (btn, box, minX, maxX, minY, maxY) => {
    if (!boxesOverlap(btn, box)) return btn;
    const options = [
        { x: box.x + box.w + 2, y: btn.y },
        { x: box.x - btn.w - 2, y: btn.y },
        { x: btn.x, y: box.y + box.h + 2 },
        { x: btn.x, y: box.y - btn.h - 2 },
    ].map((option) => ({
        x: clamp(option.x, minX, maxX),
        y: clamp(option.y, minY, maxY),
    }));
    let best = btn;
    let bestCost = Infinity;
    options.forEach((option) => {
        const cost = Math.abs(option.x - btn.x) + Math.abs(option.y - btn.y);
        if (cost < bestCost && !boxesOverlap({ ...option, w: btn.w, h: btn.h }, box)) {
            best = { ...btn, x: option.x, y: option.y };
            bestCost = cost;
        }
    });
    return best;
};

const detailClosePose = (hero, view, copy, title) => {
    const { vw, vh } = view;
    const gap = closeGapFor(vw);
    const minX = CLOSE_BTN_PAD;
    const maxX = vw - CLOSE_BTN_PAD - CLOSE_BTN;
    const minY = Math.max(CLOSE_BTN_PAD, readSafe('--sat'));
    const maxY = vh - CLOSE_BTN_PAD - CLOSE_BTN;
    let x = clamp(hero.x + hero.w + gap - CLOSE_BTN / 2, minX, maxX);
    let y = clamp(hero.y - gap - CLOSE_BTN / 2, minY, maxY);
    let btn = { x, y, w: CLOSE_BTN, h: CLOSE_BTN };
    btn = nudgeClear(btn, { x: hero.x, y: hero.y, w: hero.w, h: hero.h }, minX, maxX, minY, maxY);
    btn = nudgeClear(btn, asBox(copy), minX, maxX, minY, maxY);
    btn = nudgeClear(btn, asBox(title), minX, maxX, minY, maxY);
    return { x: btn.x, y: btn.y };
};

const closePoseFromPoses = (poses, view, copy, title) => {
    const hero = poses?.find((pose) => pose && pose.role === 'hero');
    if (!hero) return gridClosePose(view.vw);
    return detailClosePose(hero, view, copy, title);
};

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
    const narrow = detailIsNarrow(vw, vh);
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
        const maxHeroW = (vw - margin * 2) * 0.8;
        const maxHeroH = Math.min(bandH * 0.52, vh * 0.42) * 0.8;
        const hero = fitRect(heroAspect, maxHeroW, maxHeroH);
        const heroX = (vw - hero.w) / 2;
        const heroY = bandTop;
        const textY = heroY + hero.h + 14;
        const textH = measureDetailCopyHeight(itemCopy(stack.items[heroIndex]), textW);
        const thumbY = textY + textH + 16;
        const thumbs = [];
        let x = margin;
        let maxThumbH = 44;
        stack.items.forEach((item, index) => {
            if (index === heroIndex) {
                thumbs[index] = null;
                return;
            }
            const aspect = itemGridAspect(stack, item);
            const w = Math.max(thumbW, 44);
            const h = Math.max(44, w / aspect);
            thumbs[index] = { x, y: thumbY, w, h, o: 1, role: 'thumb' };
            maxThumbH = Math.max(maxThumbH, h);
            x += w + 12;
        });
        const railH = maxThumbH + 8;
        const contentBottom = thumbY + railH + Math.max(margin, readSafe('--sab'));
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
            extent: contentBottom > vh ? contentBottom : 0,
            rail: {
                x: margin,
                y: thumbY,
                w: vw - margin * 2,
                h: railH,
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

function DecodedImage({ src, alt, loading, fetchPriority, placeholder, hold = false }) {
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

    const shown = ready && !(hold && placeholder);

    return (
        <>
            {placeholder && !shown ? (
                <img
                    className="stack-card-image stack-card-placeholder is-ready"
                    src={placeholder}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="sync"
                />
            ) : null}
            <img
                ref={nodeRef}
                className={`stack-card-image${shown ? ' is-ready' : ''}`}
                style={hold && placeholder ? { visibility: 'hidden' } : undefined}
                src={src}
                alt={alt}
                draggable={false}
                loading={loading}
                decoding="async"
                fetchPriority={fetchPriority}
                onLoad={(event) => reveal(event.currentTarget)}
                onError={() => setReady(true)}
            />
        </>
    );
}

function StackCardFace({ item, index, title, loading = 'lazy', fetchPriority = 'low', placeholder, hold }) {
    if (item.type === 'image' && item.src) {
        return (
            <DecodedImage
                src={item.src}
                alt={item.title || `${title} ${index + 1}`}
                loading={loading}
                fetchPriority={fetchPriority}
                placeholder={placeholder}
                hold={hold}
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

const contentsOf = (items) => {
    const counts = new Map();
    items.forEach((item) => {
        const { title } = itemCopy(item);
        counts.set(title, (counts.get(title) || 0) + 1);
    });
    return [...counts];
};

function PaperClip() {
    return (
        <svg className="design-file-clip" viewBox="0 0 22 56" aria-hidden="true" focusable="false">
            <path d="M7 40V9a4.5 4.5 0 0 1 9 0v34a7.5 7.5 0 0 1-15 0V14" />
        </svg>
    );
}

const contentBox = (img) => {
    const rect = img?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return null;
    const style = getComputedStyle(img);
    const left = parseFloat(style.paddingLeft) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    const top = parseFloat(style.paddingTop) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    return {
        left: rect.left + left,
        top: rect.top + top,
        width: Math.max(1, rect.width - left - right),
        height: Math.max(1, rect.height - top - bottom),
    };
};

function bakeStamp(text, width) {
    const fontSize = Math.max(13, width * 0.1);
    const padX = fontSize * 0.46;
    const padTop = fontSize * 0.34;
    const padBottom = fontSize * 0.26;
    const border = Math.max(2, width * 0.011);
    const outline = Math.max(1, width * 0.005);
    const outlineOffset = Math.max(2, width * 0.012);
    const innerW = Math.max(40, width - padX * 2 - border * 2 - (outline + outlineOffset) * 2);
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `${fontSize}px "Black Ops One"`;
    probe.letterSpacing = `${fontSize * 0.05}px`;
    const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (current && probe.measureText(next).width > innerW) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    });
    if (current) lines.push(current);
    const lineH = fontSize * 1.02;
    const textH = Math.max(lineH, lines.length * lineH);
    const boxW = width;
    const boxH = padTop + textH + padBottom + border * 2 + (outline + outlineOffset) * 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(boxW * dpr));
    canvas.height = Math.max(1, Math.ceil(boxH * dpr));
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = `${fontSize}px "Black Ops One"`;
    ctx.letterSpacing = `${fontSize * 0.05}px`;
    ctx.fillStyle = '#b2281f';
    ctx.strokeStyle = '#b2281f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = outline;
    ctx.strokeRect(outline / 2, outline / 2, boxW - outline, boxH - outline);
    ctx.lineWidth = border;
    const edge = outline + outlineOffset + border / 2;
    ctx.strokeRect(edge, edge, boxW - edge * 2, boxH - edge * 2);
    lines.forEach((line, index) => {
        const y = outline + outlineOffset + border + padTop + lineH * (index + 0.5);
        ctx.fillText(line, boxW / 2, y);
    });
    const baked = document.createElement('canvas');
    baked.width = canvas.width;
    baked.height = canvas.height;
    const out = baked.getContext('2d');
    try {
        out.filter = 'url(#design-stamp-ink)';
        out.drawImage(canvas, 0, 0);
        if (out.filter !== 'none') return baked.toDataURL('image/png');
    } catch (err) {
        // The live filter could not be applied; the plain drawing is still one bitmap.
    }
    return canvas.toDataURL('image/png');
}

function BakedStamp({ text, measureWidth, moving }) {
    const [src, setSrc] = useState('');
    const movingRef = useRef(moving);
    movingRef.current = moving;

    const bake = useCallback(() => {
        if (movingRef.current) return false;
        const width = measureWidth();
        if (!(width > 0) || !document.fonts.check('16px "Black Ops One"')) return false;
        setSrc(bakeStamp(text, width));
        return true;
    }, [measureWidth, text]);

    useLayoutEffect(() => {
        if (bake()) return undefined;
        let cancelled = false;
        document.fonts.ready.then(() => {
            if (!cancelled) bake();
        });
        return () => {
            cancelled = true;
        };
    }, [bake]);

    useEffect(() => {
        if (moving) return undefined;
        const onResize = () => bake();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [bake, moving]);

    if (!src) return <span className="design-file-stamp">{text}</span>;
    return (
        <img
            className="design-file-stamp is-baked"
            src={src}
            alt=""
            draggable={false}
        />
    );
}

function CaseFile({ stack, stackIndex, className, inert, showPage, setButton, onOpenDetail, onOpenFile }) {
    const fileRef = useRef(null);
    const coverRef = useRef(null);
    const pageRefs = useRef([]);
    const stateRef = useRef({
        open: false,
        turned: 0,
        timers: [],
        auto: 0,
        manual: false,
        flipping: false,
        pointer: 'mouse',
    });
    const propsRef = useRef({});
    propsRef.current = { inert, onOpenDetail, onOpenFile };
    const showPageRef = useRef(showPage);
    showPageRef.current = showPage;
    const count = stack.items.length;
    const number = fileNumber(stackIndex);

    const pages = () => pageRefs.current.slice(0, count).filter(Boolean);

    const later = (ms, fn) => {
        const state = stateRef.current;
        const id = window.setTimeout(() => {
            state.timers = state.timers.filter((timer) => timer !== id);
            fn();
        }, ms);
        state.timers.push(id);
    };

    const clearAuto = () => {
        const state = stateRef.current;
        window.clearTimeout(state.auto);
        state.auto = 0;
    };

    const clearTimers = () => {
        const state = stateRef.current;
        state.timers.forEach((timer) => window.clearTimeout(timer));
        state.timers = [];
        state.flipping = false;
        clearAuto();
    };

    const pageIsMoving = (page) => {
        const transition = getComputedStyle(page).transitionProperty;
        if (!transition || transition === 'none') return false;
        const running = getComputedStyle(page);
        return running.transitionDuration !== '0s'
            && (page.classList.contains('is-turned')
                || page.classList.contains('is-turning')
                || page.classList.contains('is-fading'));
    };

    const resetPages = () => {
        const file = fileRef.current;
        if (!file) return;
        if (pages().some(pageIsMoving)) return;
        file.classList.add('no-anim');
        pages().forEach((page, index) => {
            page.classList.remove('is-turned', 'is-turning', 'is-fading');
            page.style.zIndex = String(100 - index);
        });
        stateRef.current.turned = 0;
        void file.offsetWidth;
        file.classList.remove('no-anim');
    };

    const turnForward = () => {
        const state = stateRef.current;
        const list = pages();
        if (state.turned >= list.length - 1) return;
        const page = list[state.turned];
        page.style.zIndex = String(200 + state.turned);
        page.classList.add('is-turned', 'is-turning');
        later(FILE_TURN_MS * 0.6, () => page.classList.remove('is-turning'));
        state.turned += 1;
    };

    const turnBack = () => {
        const state = stateRef.current;
        if (state.turned === 0) return;
        state.turned -= 1;
        const index = state.turned;
        const page = pages()[index];
        page.classList.remove('is-turned');
        later(FILE_TURN_MS, () => {
            page.style.zIndex = String(100 - index);
        });
    };

    const flipAllBack = (done) => {
        const state = stateRef.current;
        const list = pages();
        const turned = state.turned;
        state.flipping = true;
        for (let k = turned - 1, step = 0; k >= 0; k -= 1, step += 1) {
            const index = k;
            const page = list[index];
            later(step * FILE_BACK_GAP_MS, () => {
                page.classList.remove('is-turned');
                later(FILE_TURN_MS, () => {
                    page.style.zIndex = String(100 - index);
                });
            });
        }
        state.turned = 0;
        later(Math.max(0, turned - 1) * FILE_BACK_GAP_MS + FILE_TURN_MS + 20, () => {
            state.flipping = false;
            done?.();
        });
    };

    const scheduleTick = (ms) => {
        const state = stateRef.current;
        clearAuto();
        state.auto = window.setTimeout(() => {
            state.auto = 0;
            tick();
        }, ms);
    };

    function tick() {
        const state = stateRef.current;
        if (!state.open || state.manual) return;
        if (state.turned < pages().length - 1) {
            turnForward();
            scheduleTick(FILE_EVERY_MS);
            return;
        }
        flipAllBack(() => scheduleTick(FILE_LOOP_PAUSE_MS));
    }

    const openFile = () => {
        const state = stateRef.current;
        if (propsRef.current.inert || Number.isInteger(showPageRef.current)) return;
        const file = fileRef.current;
        if (state.closing) {
            clearTimers();
            state.closing = false;
            state.open = true;
            state.manual = false;
            file?.classList.remove('is-closing');
            file?.classList.add('is-open');
            const restored = state.turnedAtClose || 0;
            pages().forEach((page, index) => {
                page.classList.remove('is-turning', 'is-fading');
                if (index < restored) {
                    page.style.zIndex = String(200 + index);
                    page.classList.add('is-turned');
                }
            });
            state.turned = restored;
            later(FILE_OPEN_MS * 0.55, () => coverRef.current?.classList.add('is-low'));
            if (count > 1) scheduleTick(restored > 0 ? FILE_EVERY_MS : FILE_FIRST_TURN_MS);
            propsRef.current.onOpenFile?.(stackIndex);
            return;
        }
        if (state.open) return;
        clearTimers();
        state.open = true;
        state.manual = false;
        file?.classList.remove('is-closing');
        file?.classList.add('is-open');
        later(FILE_OPEN_MS * 0.55, () => coverRef.current?.classList.add('is-low'));
        if (count > 1) scheduleTick(FILE_FIRST_TURN_MS);
        propsRef.current.onOpenFile?.(stackIndex);
    };

    const settleClosed = () => {
        const state = stateRef.current;
        if (state.open || !state.closing) return;
        pages().forEach((page, index) => {
            page.classList.remove('is-turning', 'is-fading');
            page.style.zIndex = String(100 - index);
        });
        state.turned = 0;
        state.turnedAtClose = 0;
        state.closing = false;
        fileRef.current?.classList.remove('is-closing');
    };

    const closeFile = () => {
        const state = stateRef.current;
        if (!state.open || Number.isInteger(showPageRef.current)) return;
        clearTimers();
        state.open = false;
        state.closing = true;
        state.turnedAtClose = state.turned;
        const file = fileRef.current;
        pages().forEach((page) => {
            page.classList.remove('is-turning', 'is-fading');
            if (page.classList.contains('is-turned')) page.classList.remove('is-turned');
        });
        coverRef.current?.classList.remove('is-low');
        file?.classList.add('is-closing');
        file?.classList.remove('is-open');
        later(FILE_OPEN_MS + 40, settleClosed);
    };

    const closeNow = () => {
        const file = fileRef.current;
        clearTimers();
        const state = stateRef.current;
        state.open = false;
        state.closing = false;
        state.turnedAtClose = 0;
        if (!file) return;
        file.classList.add('no-anim');
        file.classList.remove('is-open', 'is-closing');
        coverRef.current?.classList.remove('is-low');
        pages().forEach((page, index) => {
            page.classList.remove('is-turned', 'is-turning', 'is-fading');
            page.style.zIndex = String(100 - index);
        });
        state.turned = 0;
        void file.offsetWidth;
        file.classList.remove('no-anim');
    };

    const snapOpenAt = (index) => {
        const file = fileRef.current;
        if (!file) return;
        clearTimers();
        file.classList.add('no-anim');
        file.classList.remove('is-closing');
        file.classList.add('is-open');
        coverRef.current?.classList.add('is-low');
        pages().forEach((page, pageIndex) => {
            page.classList.remove('is-turning', 'is-fading');
            if (pageIndex < index) {
                page.classList.add('is-turned');
                page.style.zIndex = String(200 + pageIndex);
            } else {
                page.classList.remove('is-turned');
                page.style.zIndex = String(100 - pageIndex);
            }
        });
        const state = stateRef.current;
        state.open = true;
        state.closing = false;
        state.manual = true;
        state.turned = index;
        state.turnedAtClose = index;
        void file.offsetWidth;
        file.classList.remove('no-anim');
    };

    const currentIndex = () => Math.min(stateRef.current.turned, Math.max(0, count - 1));

    const openDetail = (index) => {
        const img = pages()[index]?.querySelector('.design-file-mount img');
        propsRef.current.onOpenDetail?.(stackIndex, index, contentBox(img));
        closeNow();
    };

    const actionsRef = useRef(null);
    actionsRef.current = { resetPages, clearTimers, closeNow, snapOpenAt, closeFile };

    useLayoutEffect(() => {
        const actions = actionsRef.current;
        actions.resetPages();
        return () => actions.clearTimers();
    }, []);

    useEffect(() => {
        if (inert) actionsRef.current.closeNow();
    }, [inert]);

    const posedRef = useRef(false);
    useLayoutEffect(() => {
        const actions = actionsRef.current;
        if (Number.isInteger(showPage)) {
            actions.snapOpenAt(showPage);
            posedRef.current = true;
            return;
        }
        if (!posedRef.current) return;
        posedRef.current = false;
        const button = fileRef.current?.closest('button');
        const hovered = stateRef.current.pointer !== 'touch' && button?.matches(':hover');
        const focused = document.activeElement === button && isKeyboardFocus(button);
        if (!hovered && !focused) actions.closeFile();
    }, [showPage]);

    const measureStampWidth = useCallback(() => {
        if (stateRef.current.open || stateRef.current.closing) return 0;
        const face = fileRef.current?.querySelector('.design-file-cover .design-file-face.is-front');
        if (!face) return 0;
        const style = getComputedStyle(face);
        const contentW = face.clientWidth
            - (parseFloat(style.paddingLeft) || 0)
            - (parseFloat(style.paddingRight) || 0);
        return contentW * 0.88;
    }, []);

    const onPointerDown = (event) => {
        stateRef.current.pointer = event.pointerType || 'mouse';
    };

    const onPointerEnter = (event) => {
        if (event.pointerType === 'touch') return;
        openFile();
    };

    const onPointerLeave = (event) => {
        if (event.pointerType === 'touch' || propsRef.current.inert) return;
        const button = event.currentTarget;
        if (document.activeElement === button && isKeyboardFocus(button)) return;
        closeFile();
    };

    const onFocus = (event) => {
        if (!isKeyboardFocus(event.currentTarget)) return;
        openFile();
    };

    const onBlur = (event) => {
        if (propsRef.current.inert) return;
        const hovered = stateRef.current.pointer !== 'touch' && event.currentTarget.matches(':hover');
        if (!hovered) closeFile();
    };

    const onKeyDown = (event) => {
        if (propsRef.current.inert) return;
        const state = stateRef.current;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            if (!state.open) {
                openFile();
                return;
            }
            if (state.flipping) return;
            state.manual = true;
            clearAuto();
            if (state.turned < pages().length - 1) turnForward();
            else flipAllBack();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!state.open || state.flipping) return;
            state.manual = true;
            clearAuto();
            turnBack();
        } else if (event.key === 'Escape') {
            if (!state.open) return;
            event.preventDefault();
            closeFile();
        }
    };

    const onClick = (event) => {
        if (propsRef.current.inert) return;
        const state = stateRef.current;
        const fromKeyboard = event.detail === 0;
        if (!fromKeyboard && state.pointer === 'touch') {
            if (!state.open) {
                openFile();
                return;
            }
            const onCover = event.target.closest('.design-file-cover, .design-file-page.is-turned');
            if (onCover) {
                closeFile();
                return;
            }
            openDetail(currentIndex());
            return;
        }
        if (fromKeyboard && !state.open) {
            openFile();
            return;
        }
        openDetail(currentIndex());
    };

    return (
        <button
            type="button"
            ref={setButton}
            className={className}
            aria-label={`${stack.title}, ${count} items`}
            onPointerDown={onPointerDown}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onClick={onClick}
        >
            <span className="design-file" ref={fileRef}>
                <span className="design-file-stage">
                    <span className="design-file-back">
                        <span className="design-file-tab">
                            <span className="design-file-tab-label">FILE {number}</span>
                        </span>
                    </span>
                    <span className="design-file-pages">
                        {stack.items.map((item, itemIndex) => {
                            const { title } = itemCopy(item);
                            return (
                                <span
                                    key={itemIndex}
                                    className="design-file-page"
                                    ref={(node) => {
                                        pageRefs.current[itemIndex] = node;
                                    }}
                                >
                                    <span className="design-file-face is-front">
                                        <PaperClip />
                                        <span className="design-file-mount">
                                            {item.type === 'image' && item.src ? (
                                                <img
                                                    src={pageSrc(item.src)}
                                                    width={item.width}
                                                    height={item.height}
                                                    alt=""
                                                    draggable={false}
                                                    decoding="async"
                                                    fetchPriority={itemIndex === 0 ? 'high' : 'low'}
                                                />
                                            ) : null}
                                        </span>
                                        <span className="design-file-cap">{title}</span>
                                        <span className="design-file-meta">
                                            Item {itemIndex + 1} of {count}
                                        </span>
                                    </span>
                                    <span className="design-file-face is-reverse" />
                                </span>
                            );
                        })}
                    </span>
                    <span className="design-file-cover" ref={coverRef}>
                        <span className="design-file-face is-front">
                            <span className="design-file-typed">
                                <span>Design Work</span>
                                <span>File No. {number}</span>
                                <span>Contents: {count} {count === 1 ? 'item' : 'items'}</span>
                            </span>
                            <BakedStamp
                                text={stack.title}
                                measureWidth={measureStampWidth}
                                moving={false}
                            />
                        </span>
                        <span className="design-file-face is-inside">
                            <span className="design-file-typed">Contents</span>
                            <span className="design-file-index">
                                {contentsOf(stack.items).map(([title, views], entry) => (
                                    <span key={title} className="design-file-entry">
                                        <span className="design-file-entry-no">{entry + 1}.</span>
                                        <span>
                                            {title}
                                            {views > 1 ? (
                                                <span className="design-file-entry-views"> ({views} views)</span>
                                            ) : null}
                                        </span>
                                    </span>
                                ))}
                            </span>
                        </span>
                    </span>
                </span>
            </span>
        </button>
    );
}

const GraffitiGallery = () => {
    const navigate = useNavigate();
    const stacks = designStacks;

    const [openStack, setOpenStack] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [restoreFolder, setRestoreFolder] = useState(false);
    const [origin] = useState({ x: 0, y: 0 });
    const [detailIndex, setDetailIndex] = useState(null);
    const [copyVisible, setCopyVisible] = useState(false);
    const [copyBox, setCopyBox] = useState(null);
    const [railBox, setRailBox] = useState(null);
    const [detailExtent, setDetailExtent] = useState(0);
    const [thumbsDocked, setThumbsDocked] = useState(false);
    const [railCue, setRailCue] = useState(emptyRailCue);
    const [motionGen, setMotionGen] = useState(0);
    const [chromeOn, setChromeOn] = useState(false);
    const [heroHold, setHeroHold] = useState(false);

    const buttonsRef = useRef([]);
    const overlayRef = useRef(null);
    const overlayGestureRef = useRef({ scroll: 0 });
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
    const preloadedRef = useRef(new Map());
    const returnArmed = useRef(false);
    const returnIndexRef = useRef(null);
    const cardRefs = useRef([]);
    const copyRef = useRef(null);
    const titleRef = useRef(null);
    const dateRef = useRef(null);
    const textRef = useRef(null);
    const revealRef = useRef(null);
    const posesRef = useRef([]);
    const destRef = useRef([]);
    const settledRef = useRef(null);
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
    thumbsDockedRef.current = thumbsDocked;

    const motion = useMemo(
        () => ({
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
        const viewport = window.visualViewport;
        const rawHeight = window.innerHeight;
        const vh = detailIsNarrow(vw, viewport?.height || rawHeight) && viewport?.height
            ? viewport.height
            : rawHeight;
        const head = headRef.current?.getBoundingClientRect();
        const nav = navRef.current?.getBoundingClientRect();
        return {
            vw,
            vh,
            margin: detailIsNarrow(vw, vh) ? 16 : 28,
            titleBottom: head && head.height > 1 ? head.bottom : predictedTitleBottom(vw),
            menuBottom: (nav && nav.height > 1 ? nav.bottom : (head && head.height > 1 ? head.bottom : 94)) + 10,
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

    const applyAll = (visuals, dests, skipRoles = null) => {
        visuals.forEach((visual, index) => {
            const dest = dests[index] || visual;
            if (skipRoles && dest?.role && skipRoles.has(dest.role)) return;
            applyVisual(cardRefs.current[index], visual, dest);
        });
    };

    const titleBox = () => asBox(headRef.current?.querySelector('.stack-overlay-title')?.getBoundingClientRect());

    const placeClose = (pose) => {
        const el = closeRef.current;
        if (!el || !pose) return;
        el.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0)`;
    };

    const syncClose = (poses, copy) => {
        placeClose(closePoseFromPoses(poses, viewBox(), copy, titleBox()));
    };

    const applyBox = (el, box) => {
        if (!el || !box) return;
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.w}px`;
        el.style.height = `${box.h}px`;
    };

    const pinSettledHero = (layout = settledRef.current) => {
        if (!layout?.poses) return;
        const index = layout.poses.findIndex((pose) => pose && pose.role === 'hero');
        if (index < 0) return;
        applyVisual(cardRefs.current[index], layout.poses[index], layout.poses[index]);
    };

    const probeHero = (label, layout = settledRef.current) => {
        if (!DETAIL_PROBE || !layout?.poses) return;
        const index = layout.poses.findIndex((pose) => pose && pose.role === 'hero');
        const dest = index >= 0 ? layout.poses[index] : null;
        const el = index >= 0 ? cardRefs.current[index] : null;
        if (!dest || !el) return;
        const rect = el.getBoundingClientRect();
        const edges = {
            left: rect.left - dest.x,
            top: rect.top - dest.y,
            right: rect.right - (dest.x + dest.w),
            bottom: rect.bottom - (dest.y + dest.h),
        };
        const max = Math.max(
            Math.abs(edges.left),
            Math.abs(edges.top),
            Math.abs(edges.right),
            Math.abs(edges.bottom)
        );
        const row = {
            label,
            stack: openDetail?.title,
            index,
            dest: { x: dest.x, y: dest.y, w: dest.w, h: dest.h },
            actual: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
            edges,
            max,
        };
        if (!window.__detailGrowProbe) window.__detailGrowProbe = [];
        window.__detailGrowProbe.push(row);
        if (max > 0.5) {
            console.warn('[detail-grow] hero missed target', row);
        }
    };

    const lockDetailLayout = (heroIndex, predicted) => {
        const view = viewBox();
        const layout = heroIndex == null
            ? {
                poses: computeGridLayout(openDetail, stageBox()),
                copy: null,
                rail: null,
            }
            : computeDetailLayout(openDetail, heroIndex, view);
        settledRef.current = layout;
        destRef.current = layout.poses;
        railRef.current = layout.rail;
        applyBox(copyRef.current, layout.copy);
        const railWrap = railElRef.current?.parentElement;
        if (railWrap && layout.rail) {
            applyBox(railWrap, layout.rail);
        }
        if (
            predicted
            && layout.copy
            && predicted.copy
            && !sameBox(layout.copy, predicted.copy)
        ) {
            setCopyBox(layout.copy);
        }
        if (
            predicted
            && layout.rail
            && predicted.rail
            && !sameBox(layout.rail, predicted.rail)
        ) {
            setRailBox(layout.rail);
        }
        const extent = layout.extent || 0;
        if ((predicted?.extent || 0) !== extent) setDetailExtent(extent);
        return layout;
    };

    const measurePilePoses = (stackIndex) => {
        const stack = stacks[stackIndex];
        if (!stack) return [];
        const button = buttonsRef.current[stackIndex];
        const box = button?.querySelector('.design-file-stage')?.getBoundingClientRect();
        const size = (box?.width || 200) * FILE_REST_FILL;
        return stack.items.map((item, itemIndex) => {
            const fit = pileFit(item, stack);
            const w = size * fit.w;
            const h = size * fit.h;
            return {
                x: (box?.left ?? 0) + ((box?.width ?? size) - w) / 2,
                y: (box?.top ?? 0) + ((box?.height ?? size) - h) / 2,
                w,
                h,
                o: 1,
                z: stack.items.length - itemIndex,
                role: 'pile',
            };
        });
    };

    const measureOnScreen = () => {
        const fallback = posesRef.current.length ? posesRef.current : destRef.current;
        const scroller = overlayRef.current;
        if (!openDetail) {
            if (scroller) {
                scroller.scrollTop = 0;
                scroller.scrollLeft = 0;
            }
            return fallback;
        }
        const poses = openDetail.items.map((_, index) => {
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
        if (scroller) {
            scroller.scrollTop = 0;
            scroller.scrollLeft = 0;
        }
        return poses;
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
        const hero = destRef.current.find((pose) => pose && pose.role === 'hero');
        if (hero) syncClose(destRef.current, copyBox);
        else syncClose(destRef.current, null);
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
        const skipRoles = extras.skipRoles || null;
        const view = viewBox();
        const closeStart = extras.closeFrom
            || closePoseFromPoses(from, view, extras.copyFrom, titleBox());
        const closeEnd = extras.closeTo
            || closePoseFromPoses(to, view, extras.copyTo, titleBox());
        const setVeil = (amount) => {
            if (!veilRef.current || veilFrom == null || veilTo == null) return;
            veilRef.current.style.opacity = String(lerp(veilFrom, veilTo, amount));
        };
        const setClose = (amount) => {
            placeClose({
                x: lerp(closeStart.x, closeEnd.x, amount),
                y: lerp(closeStart.y, closeEnd.y, amount),
            });
        };
        const safeFrom = to.map((pose, index) => poseOr(from[index], pose));
        const finish = () => {
            setVeil(1);
            setClose(1);
            applyAll(to, to, skipRoles);
            posesRef.current = to;
            if (extras.probe) probeHero(extras.probe, { poses: to });
            onDone?.();
        };
        if (motion.reduced) {
            finish();
            return;
        }
        setVeil(0);
        setClose(0);
        applyAll(safeFrom, to, skipRoles);
        posesRef.current = safeFrom;
        let t0 = extras.startOnFrame ? null : performance.now();
        const tick = (now) => {
            try {
                if (t0 == null) t0 = now;
                const raw = Math.min(1, (now - t0) / duration);
                const amount = easeBezier(DETAIL_EASE, raw);
                const next = safeFrom.map((pose, index) => lerpPose(pose, to[index], amount));
                posesRef.current = next;
                applyAll(next, to, skipRoles);
                setVeil(amount);
                setClose(amount);
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

    const preloadStack = useCallback((stackIndex) => {
        const stack = stacks[stackIndex];
        if (!stack || preloadedRef.current.has(stackIndex)) return;
        const images = [];
        stack.items.forEach((item) => {
            if (item.type !== 'image' || !item.src) return;
            const preload = new Image();
            preload.decoding = 'async';
            preload.src = item.src;
            decodeImage(preload);
            images.push(preload);
        });
        preloadedRef.current.set(stackIndex, images);
    }, [stacks]);

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
        setDetailExtent(0);
        setThumbsDocked(false);
        setRailCue(emptyRailCue);
        setChromeOn(false);
        setHeroHold(false);
        setRestoreFolder(false);
        returnArmed.current = false;
        returnIndexRef.current = null;
        posesRef.current = [];
        destRef.current = [];
        settledRef.current = null;
        pileRef.current = [];
        openedRef.current = false;
        busyTokenRef.current += 1;
        releaseBusy();
        railRef.current = null;
        pendingJobRef.current = null;
        pendingPinRef.current = null;
        pendingCloseRef.current = null;
        if (trigger) window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    }, [openStack]);

    const moveDetail = useCallback((nextIndex) => {
        if (!openDetail) return;
        if (nextIndex === detailIndex && !busyRef.current) return;
        hideCopy();
        setHeroHold(false);
        const layout = layoutFor(nextIndex);
        if (!layout) {
            releaseBusy();
            return;
        }
        const measured = measureOnScreen();
        const from = (measured.length ? measured : layout.poses)
            .map((pose, index) => poseOr(pose, layout.poses[index]));
        stopMotion();
        destRef.current = layout.poses;
        settledRef.current = layout;
        const token = armBusy();
        pendingJobRef.current = { from, layout, nextIndex, token };
        pendingPinRef.current = from;
        pendingCloseRef.current = null;
        setDetailIndex(nextIndex);
        setCopyBox(layout.copy);
        setRailBox(layout.rail);
        setDetailExtent(layout.extent || 0);
        railRef.current = layout.rail;
        setThumbsDocked(false);
        setMotionGen((value) => value + 1);
    }, [openDetail, detailIndex, layoutFor]);

    const closeDetail = useCallback(() => {
        if (!isOpen || isLeaving || detailIndex == null) return;
        returnIndexRef.current = detailIndex;
        setHeroHold(true);
        setChromeOn(false);
        setIsLeaving(true);
        setRestoreFolder(true);
    }, [isOpen, isLeaving, detailIndex]);

    const closeStack = useCallback(() => {
        if (!isOpen || isLeaving) return;
        if (detailIndex != null) {
            closeDetail();
            return;
        }
        hideCopy();
        const from = measureOnScreen();
        const to = from.map((pose) => ({ ...pose, o: 0 }));
        setIsLeaving(true);
        setChromeOn(false);
        const token = armBusy();
        runMotion(from, to, () => {
            releaseBusy(token);
            finishClose();
        }, { duration: CLOSE_MS, veilFrom: 1, veilTo: 0 });
    }, [isOpen, isLeaving, detailIndex, closeDetail, finishClose]);

    useLayoutEffect(() => {
        if (!restoreFolder) {
            returnArmed.current = false;
            return;
        }
        if (returnArmed.current) return;
        returnArmed.current = true;
        const index = returnIndexRef.current;
        const button = buttonsRef.current[openStack];
        const img = button?.querySelectorAll('.design-file-page')[index]
            ?.querySelector('.design-file-mount img');
        const box = contentBox(img);
        const from = measureOnScreen();
        const docked = thumbsDockedRef.current;
        const to = from.map((pose, poseIndex) => {
            if (poseIndex === index && box) {
                return {
                    x: box.left,
                    y: box.top,
                    w: box.width,
                    h: box.height,
                    o: 1,
                    role: 'hero',
                };
            }
            if (poseIndex === index) {
                return { ...poseOr(pose, pose), o: 0, role: 'hero' };
            }
            return { ...poseOr(pose, pose), o: 0, role: 'thumb' };
        });
        const closeRect = closeRef.current?.getBoundingClientRect();
        const closePose = closeRect ? { x: closeRect.left, y: closeRect.top } : null;
        const token = armBusy();
        runMotion(from, to, () => {
            releaseBusy(token);
            finishClose();
        }, {
            duration: CLOSE_MS,
            veilFrom: 1,
            veilTo: 0,
            startOnFrame: true,
            skipRoles: docked ? new Set(['thumb']) : null,
            closeFrom: closePose,
            closeTo: closePose,
        });
    }, [restoreFolder, openStack, finishClose]);

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
            syncClose(grid, null);
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
        if (!openDetail || isLeaving || animRef.current) return;
        const poses = destRef.current.length ? destRef.current : posesRef.current;
        if (poses.length) syncClose(poses, inDetail ? copyBox : null);
    }, [openDetail, isLeaving, inDetail, copyBox, chromeOn]);

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
            const layout = lockDetailLayout(job.nextIndex, job.layout);
            destRef.current = layout.poses;
            applyAll(job.from, layout.poses);
            runMotion(job.from, layout.poses, () => {
                setHeroHold(false);
                if (!releaseBusy(job.token)) return;
                pinSettledHero(layout);
                probeHero(job.nextIndex != null ? 'grow-end' : 'grid-end', layout);
                if (job.nextIndex != null) {
                    setThumbsDocked(true);
                    setCopyVisible(true);
                    return;
                }
                settledRef.current = layout;
                setThumbsDocked(false);
                setRailBox(null);
                setRailCue(emptyRailCue);
                railRef.current = null;
                destRef.current = layout.poses;
                posesRef.current = layout.poses;
                applyAll(layout.poses, layout.poses);
            }, {
                probe: job.nextIndex != null ? 'grow-frame' : null,
                ...job.extras,
            });
            return;
        }
        if (thumbsDocked) {
            if (railElRef.current) {
                railElRef.current.scrollTop = 0;
                railElRef.current.scrollLeft = 0;
            }
            pinSettledHero();
            applyDockedLayout();
            updateRailCue();
            probeHero('after-dock');
        }
    }, [thumbsDocked, motionGen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onResize = () => {
            if (busyRef.current) return;
            const layout = layoutFor(detailIndex);
            if (!layout) return;
            const from = measureOnScreen();
            settledRef.current = layout;
            destRef.current = layout.poses;
            setCopyBox(layout.copy);
            setRailBox(layout.rail);
            setDetailExtent(layout.extent || 0);
            railRef.current = layout.rail;
            const docked = detailIndex != null && thumbsDockedRef.current;
            const token = armBusy();
            runMotion(from, layout.poses, () => {
                releaseBusy(token);
                if (docked) {
                    applyDockedLayout();
                    updateRailCue();
                }
                pinSettledHero(layout);
                syncClose(layout.poses, layout.copy);
            }, {
                skipRoles: docked ? new Set(['thumb']) : null,
            });
        };
        window.addEventListener('resize', onResize);
        const viewport = window.visualViewport;
        if (viewport) viewport.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            if (viewport) viewport.removeEventListener('resize', onResize);
        };
    }, [isOpen, detailIndex, layoutFor]);

    useLayoutEffect(() => {
        if (!inDetail || !textRef.current) return;
        setDescriptionText(textRef.current, copy?.description || DETAIL_LOREM);
    }, [inDetail, copy?.description, detailIndex]);

    useEffect(() => {
        const container = copyRef.current;
        if (!copyVisible || detailIndex == null || !container) return undefined;
        const textEls = [titleRef.current, dateRef.current, textRef.current].filter(Boolean);
        const holdEls = copy && !copy.description && textRef.current
            ? [textRef.current]
            : [];
        const id = window.requestAnimationFrame(() => {
            revealRef.current.start({
                container,
                textEls,
                holdEls,
                reducedMotion: motion.reduced,
            });
        });
        return () => {
            window.cancelAnimationFrame(id);
            revealRef.current.clear({ container, textEls });
        };
    }, [copyVisible, detailIndex, motion.reduced, copy?.description]);

    useEffect(() => () => {
        window.clearTimeout(leaveTimerRef.current);
        stopMotion();
        clearBusyTimer();
        revealRef.current.clear();
    }, []);

    useEffect(() => {
        if (Number.isInteger(openStack)) preloadStack(openStack);
    }, [openStack, preloadStack]);

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

    const onOverlayPointerDown = () => {
        overlayGestureRef.current.scroll = overlayRef.current?.scrollTop || 0;
    };

    const onOverlayClick = (event) => {
        const scrolled = Math.abs(
            (overlayRef.current?.scrollTop || 0) - (overlayGestureRef.current.scroll || 0)
        );
        if (scrolled > 2) return;
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

    const openFromFolder = (stackIndex, itemIndex, rect) => {
        const stack = stacks[stackIndex];
        if (!stack || isOpen || !stack.items[itemIndex]) return;
        window.clearTimeout(leaveTimerRef.current);
        stopMotion();
        hideCopy();
        busyTokenRef.current += 1;
        releaseBusy();
        const layout = computeDetailLayout(stack, itemIndex, viewBox());
        const from = layout.poses.map((pose, index) => (
            index === itemIndex && rect
                ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height, o: 1, role: 'hero' }
                : { ...pose, o: 0 }
        ));
        openedRef.current = true;
        pileRef.current = [];
        posesRef.current = [];
        destRef.current = layout.poses;
        settledRef.current = layout;
        railRef.current = layout.rail;
        const token = armBusy();
        pendingJobRef.current = {
            from,
            layout,
            nextIndex: itemIndex,
            token,
            extras: { veilFrom: 0, veilTo: 1, startOnFrame: true },
        };
        pendingPinRef.current = from;
        pendingCloseRef.current = null;
        setThumbsDocked(false);
        setRailCue(emptyRailCue);
        setHeroHold(Boolean(rect));
        setDetailIndex(itemIndex);
        setCopyBox(layout.copy);
        setRailBox(layout.rail);
        setDetailExtent(layout.extent || 0);
        setOpenStack(stackIndex);
        setMotionGen((value) => value + 1);
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

            <svg className="design-file-defs" width="0" height="0" aria-hidden="true" focusable="false">
                <filter id="design-stamp-ink" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="grit" />
                    <feDisplacementMap in="SourceGraphic" in2="grit" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
                    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="9" result="spots" />
                    <feColorMatrix in="spots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -7 5" result="holes" />
                    <feComposite in="rough" in2="holes" operator="in" />
                </filter>
            </svg>

            <div className="design-stacks">
                <div className="design-stacks-grid">
                    {stacks.map((stack, stackIndex) => (
                        <CaseFile
                            key={stack.title}
                            stack={stack}
                            stackIndex={stackIndex}
                            className={[
                                'design-stack',
                                isOpen && stackIndex !== openStack ? 'is-background' : '',
                                isOpen && stackIndex === openStack && !restoreFolder ? 'is-source-open' : '',
                            ].filter(Boolean).join(' ')}
                            inert={isOpen && !restoreFolder}
                            showPage={restoreFolder && stackIndex === openStack ? detailIndex : null}
                            setButton={(node) => {
                                buttonsRef.current[stackIndex] = node;
                            }}
                            onOpenDetail={openFromFolder}
                            onOpenFile={preloadStack}
                        />
                    ))}
                </div>
            </div>

            {openDetail ? (
                <div
                    className={`stack-overlay${isLeaving ? ' is-leaving' : ''}${chromeOn ? ' is-chrome-on' : ''}${motion.reduced ? ' is-reduced' : ''}${inDetail ? ' is-detail' : ''}${detailExtent > 0 ? ' is-detail-scroll' : ''}`}
                    style={{
                        '--chrome-fade-ms': `${CHROME_FADE_MS}ms`,
                        '--detail-scroll-h': `${detailExtent > 0 ? detailExtent : 0}px`,
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={openDetail.title}
                    ref={overlayRef}
                    tabIndex={-1}
                    onPointerDown={onOverlayPointerDown}
                    onClick={onOverlayClick}
                    onKeyDown={onOverlayKeyDown}
                >
                    <div className="stack-page-veil" ref={veilRef} />
                    <div className="stack-overlay-head" ref={headRef}>
                        <h2 className="stack-overlay-title">{openDetail.title}</h2>
                    </div>
                    <button
                        type="button"
                        className="stack-overlay-close"
                        aria-label="Close"
                        ref={closeRef}
                        onClick={onCloseStep}
                    >
                        ×
                    </button>
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
                            const role = !inDetail
                                ? 'grid'
                                : (itemIndex === detailIndex ? 'hero' : 'thumb');
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
                                        ], item)}`}
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
                                                placeholder={role === 'hero' && item.src ? pageSrc(item.src) : null}
                                                hold={role === 'hero' && heroHold}
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
                                <p
                                    className="stack-detail-text"
                                    ref={textRef}
                                    aria-hidden={copy.description ? undefined : 'true'}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default GraffitiGallery;
