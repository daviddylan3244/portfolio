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
    let srLabel = null;

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
        if (srLabel) {
            srLabel.remove();
            srLabel = null;
        }
        (textEls || []).forEach((el) => {
            if (!el) return;
            el.style.visibility = '';
            el.removeAttribute('aria-hidden');
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
        holdEls,
        ruleEl,
        innerEl,
        reducedMotion,
        debug,
    } = {}) => {
        clear({ container, textEls, ruleEl, innerEl });
        if (!container) return false;
        const els = (textEls || []).filter(Boolean);
        const holdSet = new Set((holdEls || []).filter(Boolean));
        if (!els.length) return false;
        if (reducedMotion && !holdSet.size) return false;

        const spoken = els
            .filter((el) => !holdSet.has(el) && el.textContent)
            .map((el) => el.textContent);
        if (holdSet.size) spoken.push('Description coming soon');
        if (spoken.length) container.setAttribute('aria-label', spoken.join('. '));

        if (holdSet.size) {
            srLabel = document.createElement('span');
            srLabel.className = 'stream-panel-sr';
            srLabel.textContent = 'Description coming soon';
            container.append(srLabel);
            holdSet.forEach((el) => el.setAttribute('aria-hidden', 'true'));
        }

        const overlayEls = reducedMotion ? els.filter((el) => holdSet.has(el)) : els;
        const base = container.getBoundingClientRect();
        const nextOverlay = document.createElement('div');
        nextOverlay.className = overlayClass;
        nextOverlay.setAttribute('aria-hidden', 'true');
        const range = document.createRange();
        const nextGlyphs = [];
        const layers = [];
        let maxX = 1;

        overlayEls.forEach((el) => {
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
                nextGlyphs.push({
                    el: glyph,
                    char,
                    x,
                    start: 0,
                    end: 0,
                    tick: -1,
                    done: false,
                    hold: holdSet.has(el),
                });
                if (x > maxX) maxX = x;
                if (!probe) probe = { glyph, rect, label: el.className };
            }
            if (!layer.childNodes.length) return;
            nextOverlay.append(layer);
            layers.push({ layer, probe });
        });

        if (!nextGlyphs.length) {
            if (srLabel) {
                srLabel.remove();
                srLabel = null;
            }
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
        overlayEls.forEach((el) => {
            el.style.visibility = 'hidden';
        });
        if (innerEl && !reducedMotion) innerEl.setAttribute('aria-hidden', 'true');
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

        if (reducedMotion) {
            glyphs.forEach((glyph) => {
                glyph.el.style.opacity = '1';
                glyph.el.textContent = glyph.hold ? randomScrambleChar() : glyph.char;
            });
            if (ruleEl) {
                ruleEl.style.opacity = '1';
                ruleEl.style.clipPath = '';
            }
            return true;
        }

        const t0 = performance.now();
        const tick = (now) => {
            raf = 0;
            const elapsed = now - t0;
            let pending = 0;
            let holding = 0;
            for (let i = 0; i < glyphs.length; i += 1) {
                const glyph = glyphs[i];
                if (glyph.hold) holding += 1;
                if (elapsed < glyph.start) {
                    pending += 1;
                    continue;
                }
                if (elapsed >= glyph.end && !glyph.hold) {
                    if (!glyph.done) {
                        glyph.done = true;
                        glyph.el.style.opacity = '1';
                        if (glyph.el.textContent !== glyph.char) glyph.el.textContent = glyph.char;
                    }
                    continue;
                }
                if (elapsed < glyph.end) pending += 1;
                const amount = Math.min(1, (elapsed - glyph.start) / (glyph.end - glyph.start));
                if (glyph.el.style.opacity !== '1') glyph.el.style.opacity = amount.toFixed(2);
                const step = Math.floor((elapsed - glyph.start) / SCRAMBLE_START_INTERVAL_MS);
                if (step !== glyph.tick) {
                    glyph.tick = step;
                    if (glyph.hold || elapsed < glyph.end) {
                        glyph.el.textContent = randomScrambleChar();
                    }
                }
            }
            const sweep = Math.min(1, elapsed / sweepMs);
            if (ruleEl) {
                ruleEl.style.opacity = String(Math.min(1, elapsed / 150));
                ruleEl.style.clipPath = `inset(0 ${((1 - sweep) * 100).toFixed(1)}% 0 0)`;
            }
            if (!pending && sweep >= 1 && !holding) {
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
