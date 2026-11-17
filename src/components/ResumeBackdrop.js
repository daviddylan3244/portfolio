import React, { useEffect, useRef } from 'react';
import backdropPhotos from '../data/backdrop-photos.json';
import '../styles/ResumeBackdrop.css';

// Production uses this. In development, ?design=1 or ?design=2 overrides it.
const ACTIVE_DESIGN = 1;

// Each preset owns its scatter numbers so one design can be tuned alone.
// tileScale is the photo height relative to the gallery row height.
// spacingScale is the gaps and row gaps relative to the gallery's.
const DESIGNS = {
  1: {
    tileScale: 0.5,
    spacingScale: 0.5,
    speedScale: 0.4,
    opacity: 0.18,
    rowSizeMin: 0.8,
    rowSizeMax: 1,
    rowSpeedMin: 0.85,
    rowSpeedMax: 1.15,
    rowOpacityDelta: 0.04,
    photoSizeJitter: 0.1,
    gapMin: 0.5,
    gapMax: 1.5,
  },
  2: {
    tileScale: 1,
    spacingScale: 1,
    speedScale: 0.4,
    opacity: 0.18,
    rowSizeMin: 0.8,
    rowSizeMax: 1,
    rowSpeedMin: 0.85,
    rowSpeedMax: 1.15,
    rowOpacityDelta: 0.04,
    photoSizeJitter: 0.1,
    gapMin: 0.5,
    gapMax: 2,
  },
};

// Keep in sync with Clothing.js: clampItemHeight, ITEM_GAP_PX, the label
// clearance used as the minimum row gap, and ROW_SPEED_HEIGHTS_PER_SECOND.
const ITEM_HEIGHT_MIN_PX = 70;
const ITEM_HEIGHT_VW = 10;
const ITEM_HEIGHT_MAX_PX = 120;
const ITEM_GAP_PX = 40;
const MOBILE_BREAKPOINT_PX = 768;
const ROW_SPEED_HEIGHTS_PER_SECOND = (1440 + 120) / 14 / 120;
const LABEL_GAP_PX = 6;
const LABEL_BREATH_PX = 4;
const VIEWER_BORDER_MIN_PX = 12;
const VIEWER_BORDER_MAX_PX = 48;

const PHOTO_DIR = '/photos/Website digital/Photography/backdrop';
const backdropList = Array.isArray(backdropPhotos) ? backdropPhotos : backdropPhotos.photos;
const LIBRARY = backdropList.map((entry) => ({
  number: entry.number,
  aspect: entry.aspect,
  src: `${PHOTO_DIR}/backdrop-photo-${entry.number}.jpg`,
}));

const FADE_MS = 1500;
const DECODE_CONCURRENCY = 6;
const RESIZE_DEBOUNCE_MS = 200;
const HEIGHT_IGNORE_PX = 150;

function resolveDesign() {
  let id = ACTIVE_DESIGN;
  if (process.env.NODE_ENV !== 'production') {
    const param = new URLSearchParams(window.location.search).get('design');
    if (param === '1' || param === '2') id = Number(param);
  }
  return { id, ...DESIGNS[id] };
}

function clampItemHeight(viewportWidth) {
  if (viewportWidth <= MOBILE_BREAKPOINT_PX) {
    const preferred = viewportWidth * 0.26;
    return Math.min(ITEM_HEIGHT_MAX_PX, Math.max(96, preferred));
  }
  const preferred = (ITEM_HEIGHT_VW / 100) * viewportWidth;
  return Math.min(ITEM_HEIGHT_MAX_PX, Math.max(ITEM_HEIGHT_MIN_PX, preferred));
}

function labelClearancePx(viewportWidth, height) {
  const fontPx = Math.max(11, Math.min(13, height * 0.12));
  const labelH = Math.ceil(fontPx * 1.2);
  const border = Math.round(Math.min(
    VIEWER_BORDER_MAX_PX,
    Math.max(VIEWER_BORDER_MIN_PX, viewportWidth * 0.025)
  ));
  const outline = Math.max(6, Math.round(border * 0.3));
  return labelH + LABEL_GAP_PX + outline + LABEL_BREATH_PX;
}

function fitRows(viewportHeight, bandHeight, minGap) {
  if (!(bandHeight > 0) || !(viewportHeight > 0) || viewportHeight <= bandHeight) {
    return { gap: minGap, count: 1 };
  }
  const count = Math.max(1, Math.floor((viewportHeight + minGap) / (bandHeight + minGap)));
  if (count <= 1) return { gap: minGap, count: 1 };
  const gap = Math.max(minGap, (viewportHeight - count * bandHeight) / (count - 1));
  return { gap, count };
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

function sequenceWidth(items) {
  let width = 0;
  for (let i = 0; i < items.length; i += 1) width += items[i].width + items[i].gap;
  return width;
}

function metricsFor(viewportWidth, viewportHeight, design) {
  const galleryHeight = clampItemHeight(viewportWidth);
  const tileHeight = galleryHeight * design.tileScale;
  const bandHeight = tileHeight * design.rowSizeMax * (1 + design.photoSizeJitter);
  const baseGap = ITEM_GAP_PX * design.spacingScale;
  const minRowGap = labelClearancePx(viewportWidth, galleryHeight) * design.spacingScale;
  const baseSpeed = galleryHeight * ROW_SPEED_HEIGHTS_PER_SECOND * design.speedScale;
  const fitted = fitRows(viewportHeight, bandHeight, minRowGap);
  return {
    tileHeight,
    bandHeight,
    baseGap,
    baseSpeed,
    rowGap: fitted.gap,
    rowCount: fitted.count,
  };
}

function makeItem(spec, rowPhotoHeight, bandHeight, baseGap, design) {
  const jitter = 1 + (Math.random() * 2 - 1) * design.photoSizeJitter;
  const height = rowPhotoHeight * jitter;
  const width = Math.max(1, height * (spec.aspect || 1.5));
  const gapScale = design.gapMin + Math.random() * (design.gapMax - design.gapMin);
  const room = bandHeight - height;
  return {
    src: spec.src,
    width,
    height,
    gap: baseGap * gapScale,
    top: room > 0 ? Math.random() * room : 0,
  };
}

function buildPlan(viewportWidth, metrics, design) {
  const order = shuffle(LIBRARY);
  const rows = [];
  for (let index = 0; index < metrics.rowCount; index += 1) {
    const depth = Math.random();
    const size = design.rowSizeMin + (design.rowSizeMax - design.rowSizeMin) * depth;
    const speedMul = design.rowSpeedMin + (design.rowSpeedMax - design.rowSpeedMin) * depth;
    const opacity = design.opacity + (depth - 0.5) * 2 * design.rowOpacityDelta;
    rows.push({
      photoHeight: metrics.tileHeight * size,
      speed: Math.max(1, metrics.baseSpeed * speedMul),
      opacity: Math.min(1, Math.max(0, opacity)),
      items: [],
    });
  }

  let cursor = 0;
  while (cursor < order.length) {
    let target = -1;
    let narrowest = Infinity;
    for (let index = 0; index < rows.length; index += 1) {
      const width = sequenceWidth(rows[index].items);
      if (width >= viewportWidth) continue;
      if (width < narrowest) {
        narrowest = width;
        target = index;
      }
    }
    if (target < 0) break;
    const row = rows[target];
    row.items.push(makeItem(order[cursor], row.photoHeight, metrics.bandHeight, metrics.baseGap, design));
    cursor += 1;
  }

  rows.forEach((row, index) => {
    if (!row.items.length && order.length) {
      const spec = order[index % order.length];
      row.items.push(makeItem(spec, row.photoHeight, metrics.bandHeight, metrics.baseGap, design));
    }
    if (!row.items.length) return;
    const unit = row.items.map((item) => ({ ...item }));
    let guard = 0;
    while (sequenceWidth(row.items) < viewportWidth && guard < 40) {
      unit.forEach((item) => row.items.push({ ...item }));
      guard += 1;
    }
    let left = 0;
    row.placed = row.items.map((item) => {
      const placed = { ...item, left };
      left += item.width + item.gap;
      return placed;
    });
    row.copyWidth = left;
    row.phase = Math.random();
  });

  return rows.filter((row) => row.placed && row.placed.length);
}

function decodeAll(urls, isCurrent) {
  let index = 0;
  const worker = async () => {
    while (index < urls.length) {
      if (!isCurrent()) return;
      const url = urls[index];
      index += 1;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      try {
        await img.decode();
      } catch (err) {
        await new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }
    }
  };
  const count = Math.min(DECODE_CONCURRENCY, urls.length);
  const workers = [];
  for (let i = 0; i < count; i += 1) workers.push(worker());
  return Promise.all(workers);
}

function ResumeBackdrop() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let dead = false;
    let generation = 0;
    let idleId = 0;
    let idleTimer = 0;
    let resizeTimer = 0;
    let layoutWidth = 0;
    let layoutHeight = 0;
    let animations = [];
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const clearRows = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
      while (root.firstChild) root.removeChild(root.firstChild);
    };

    const mount = (rows, metrics, reduced) => {
      const stride = metrics.bandHeight + metrics.rowGap;
      const fragment = document.createDocumentFragment();
      const built = [];
      rows.forEach((row, index) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'resume-backdrop-row';
        rowEl.style.top = `${index * stride}px`;
        rowEl.style.height = `${metrics.bandHeight}px`;
        rowEl.style.opacity = '0';

        const strip = document.createElement('div');
        strip.className = 'resume-backdrop-strip';
        strip.style.width = `${row.copyWidth * 2}px`;

        const addPhoto = (item, left) => {
          const img = document.createElement('img');
          img.alt = '';
          img.draggable = false;
          img.decoding = 'async';
          img.fetchPriority = 'low';
          img.setAttribute('fetchpriority', 'low');
          img.src = item.src;
          img.style.left = `${left}px`;
          img.style.top = `${item.top}px`;
          img.style.width = `${item.width}px`;
          img.style.height = `${item.height}px`;
          strip.appendChild(img);
        };
        row.placed.forEach((item) => {
          addPhoto(item, item.left);
          addPhoto(item, item.left + row.copyWidth);
        });
        rowEl.appendChild(strip);
        fragment.appendChild(rowEl);
        built.push({ row, rowEl, strip });
      });
      root.appendChild(fragment);

      const next = [];
      built.forEach(({ row, rowEl, strip }) => {
        if (reduced) {
          rowEl.style.opacity = String(row.opacity);
          strip.style.transform = `translate3d(${-row.phase * row.copyWidth}px,0,0)`;
          return;
        }
        const duration = (row.copyWidth / row.speed) * 1000;
        const drift = strip.animate(
          [
            { transform: `translate3d(${-row.copyWidth}px,0,0)` },
            { transform: 'translate3d(0px,0,0)' },
          ],
          { duration, iterations: Infinity, easing: 'linear' }
        );
        drift.currentTime = row.phase * duration;
        next.push(drift);
        const fade = rowEl.animate(
          [{ opacity: 0 }, { opacity: row.opacity }],
          { duration: FADE_MS, easing: 'linear', fill: 'forwards' }
        );
        fade.onfinish = () => {
          rowEl.style.opacity = String(row.opacity);
          fade.cancel();
        };
        next.push(fade);
      });
      animations = next;
    };

    const layout = async () => {
      const gen = generation + 1;
      generation = gen;
      const design = resolveDesign();
      const reduced = motionQuery.matches;
      const viewportWidth = window.innerWidth;
      const viewportHeight = root.clientHeight || window.innerHeight;
      const metrics = metricsFor(viewportWidth, viewportHeight, design);
      const rows = buildPlan(viewportWidth, metrics, design);
      const urls = [];
      const seen = new Set();
      rows.forEach((row) => {
        row.placed.forEach((item) => {
          if (seen.has(item.src)) return;
          seen.add(item.src);
          urls.push(item.src);
        });
      });
      await decodeAll(urls, () => !dead && gen === generation);
      if (dead || gen !== generation) return;
      clearRows();
      mount(rows, metrics, reduced);
      layoutWidth = window.innerWidth;
      layoutHeight = window.innerHeight;
    };

    const afterIdle = () => new Promise((resolve) => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(() => resolve(), { timeout: 1000 });
      } else {
        idleTimer = window.setTimeout(resolve, 200);
      }
    });

    const boot = async () => {
      if (document.readyState !== 'complete') {
        await new Promise((resolve) => {
          window.addEventListener('load', resolve, { once: true });
        });
      }
      if (dead) return;
      await afterIdle();
      if (dead) return;
      await layout();
    };

    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (layoutWidth && width === layoutWidth && Math.abs(height - layoutHeight) < HEIGHT_IGNORE_PX) {
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!dead) layout();
      }, RESIZE_DEBOUNCE_MS);
    };

    const onMotion = () => {
      if (!dead) layout();
    };

    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    motionQuery.addEventListener?.('change', onMotion);
    boot();

    return () => {
      dead = true;
      generation += 1;
      window.clearTimeout(resizeTimer);
      window.clearTimeout(idleTimer);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      motionQuery.removeEventListener?.('change', onMotion);
      clearRows();
    };
  }, []);

  return <div ref={rootRef} className="resume-backdrop" aria-hidden="true" />;
}

export default ResumeBackdrop;
