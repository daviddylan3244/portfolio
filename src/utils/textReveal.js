import { randomScrambleChar, SCRAMBLE_START_INTERVAL_MS } from './decrypt';

export const TEXT_REVEAL_SWEEP_MS = 620;
export const TEXT_REVEAL_CHAR_MIN_MS = 160;
export const TEXT_REVEAL_CHAR_EXTRA_MS = 140;

const textRect = (range, node, index) => {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    return range.getBoundingClientRect();
};

export function createTextReveal({
    overlayClass = 'stream-panel-scramble',
    layerClass = 'stream-panel-scramble-layer',
    glyphClass = 'stream-panel-glyph',
    sweepMs = TEXT_REVEAL_SWEEP_MS,
    charMinMs = TEXT_REVEAL_CHAR_MIN_MS,
    charExtraMs = TEXT_REVEAL_CHAR_EXTRA_MS,
} = {}) {
    let raf = 0;
    let glyphs = [];
    let overlay = null;

    const stop = () => {
        if (!raf) return;
        cancelAnimationFrame(raf);
        raf = 0;
    };

    const clear = ({ container, textEls, ruleEl, innerEl } = {}) => {
        stop();
        glyphs = [];
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        (textEls || []).forEach((el) => {
            if (el) el.style.visibility = '';
        });
        if (ruleEl) {
            ruleEl.style.opacity = '';
            ruleEl.style.clipPath = '';
        }
        if (innerEl) innerEl.removeAttribute('aria-hidden');
        if (container) container.removeAttribute('aria-label');
    };

    const start = ({
        container,
        textEls,
        ruleEl,
        innerEl,
        reducedMotion,
        debug,
    } = {}) => {
        clear({ container, textEls, ruleEl, innerEl });
        if (!container || reducedMotion) return false;
        const els = (textEls || []).filter(Boolean);
        if (!els.length) return false;

        container.setAttribute(
            'aria-label',
            els.map((el) => el.textContent).filter(Boolean).join('. ')
        );

        const base = container.getBoundingClientRect();
        const nextOverlay = document.createElement('div');
        nextOverlay.className = overlayClass;
        nextOverlay.setAttribute('aria-hidden', 'true');
        const range = document.createRange();
        const nextGlyphs = [];
        const layers = [];
        let maxX = 1;

        els.forEach((el) => {
            const node = el.firstChild;
            if (!node || node.nodeType !== 3 || !node.nodeValue) return;
            const text = node.nodeValue;
            const style = window.getComputedStyle(el);
            const layer = document.createElement('span');
            layer.className = layerClass;
            layer.style.fontFamily = style.fontFamily;
            layer.style.fontSize = style.fontSize;
            layer.style.fontStyle = style.fontStyle;
            layer.style.fontWeight = style.fontWeight;
            let probe = null;
            for (let index = 0; index < text.length; index += 1) {
                const char = text[index];
                if (char === ' ' || char === '\u00A0') continue;
                const rect = textRect(range, node, index);
                if (!rect.width) continue;
                const x = rect.left - base.left;
                const glyph = document.createElement('span');
                glyph.className = glyphClass;
                glyph.textContent = char;
                glyph.style.left = `${x}px`;
                glyph.style.top = `${rect.top - base.top}px`;
                glyph.style.lineHeight = `${rect.height}px`;
                glyph.style.opacity = '0';
                layer.append(glyph);
                nextGlyphs.push({ el: glyph, char, x, start: 0, end: 0, tick: -1, done: false });
                if (x > maxX) maxX = x;
                if (!probe) probe = { glyph, rect, label: el.className };
            }
            if (!layer.childNodes.length) return;
            nextOverlay.append(layer);
            layers.push({ layer, probe });
        });

        if (!nextGlyphs.length) {
            container.removeAttribute('aria-label');
            return false;
        }

        nextGlyphs.forEach((glyph) => {
            glyph.start = (glyph.x / maxX) * sweepMs;
            glyph.end = glyph.start + charMinMs + Math.random() * charExtraMs;
        });
        glyphs = nextGlyphs;
        overlay = nextOverlay;
        const checked = debug
            ? { scrollHeight: container.scrollHeight, innerTop: innerEl?.getBoundingClientRect().top }
            : null;
        els.forEach((el) => {
            el.style.visibility = 'hidden';
        });
        if (innerEl) innerEl.setAttribute('aria-hidden', 'true');
        container.append(nextOverlay);

        const report = [];
        layers.forEach(({ layer, probe }) => {
            if (!probe) return;
            const shown = textRect(range, probe.glyph.firstChild, 0);
            const dx = probe.rect.left - shown.left;
            const dy = probe.rect.top - shown.top;
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                layer.style.transform = `translate(${dx}px, ${dy}px)`;
            }
            if (checked) report.push({ line: probe.label, dx, dy, probe });
        });

        if (checked) {
            const after = report.map(({ line, dx, dy, probe }) => {
                const fixed = textRect(range, probe.glyph.firstChild, 0);
                return {
                    line,
                    beforeDx: Number(dx.toFixed(2)),
                    beforeDy: Number(dy.toFixed(2)),
                    afterDx: Number((probe.rect.left - fixed.left).toFixed(2)),
                    afterDy: Number((probe.rect.top - fixed.top).toFixed(2)),
                };
            });
            console.info('[panel] glyph vs real character offset', after);
            if (innerEl) {
                console.info('[panel] overlay layout cost', {
                    scrollHeight: container.scrollHeight - checked.scrollHeight,
                    innerTop: Number(
                        (innerEl.getBoundingClientRect().top - checked.innerTop).toFixed(2)
                    ),
                });
            }
        }

        if (ruleEl) {
            ruleEl.style.opacity = '0';
            ruleEl.style.clipPath = 'inset(0 100% 0 0)';
        }

        const t0 = performance.now();
        const tick = (now) => {
            raf = 0;
            const elapsed = now - t0;
            let pending = 0;
            for (let i = 0; i < glyphs.length; i += 1) {
                const glyph = glyphs[i];
                if (glyph.done) continue;
                if (elapsed < glyph.start) {
                    pending += 1;
                    continue;
                }
                if (elapsed >= glyph.end) {
                    glyph.done = true;
                    glyph.el.style.opacity = '1';
                    if (glyph.el.textContent !== glyph.char) glyph.el.textContent = glyph.char;
                    continue;
                }
                pending += 1;
                const amount = (elapsed - glyph.start) / (glyph.end - glyph.start);
                glyph.el.style.opacity = amount.toFixed(2);
                const step = Math.floor((elapsed - glyph.start) / SCRAMBLE_START_INTERVAL_MS);
                if (step !== glyph.tick) {
                    glyph.tick = step;
                    glyph.el.textContent = randomScrambleChar();
                }
            }
            const sweep = Math.min(1, elapsed / sweepMs);
            if (ruleEl) {
                ruleEl.style.opacity = String(Math.min(1, elapsed / 150));
                ruleEl.style.clipPath = `inset(0 ${((1 - sweep) * 100).toFixed(1)}% 0 0)`;
            }
            if (!pending && sweep >= 1) {
                clear({ container, textEls: els, ruleEl, innerEl });
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return true;
    };

    return { start, clear, stop };
}
