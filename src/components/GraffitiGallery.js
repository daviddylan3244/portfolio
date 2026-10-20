import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';
import designStacks from '../data/design-stacks.json';

const CAROUSEL_INTERVAL_MS = 1000;
const SWAP_MS = 450;
const FAN_MS = 300;
const CLOSE_MS = 380;
const OPEN_STAGGER_MS = 40;
const TWIST_STEP_DEG = 3.5;
const TWIST_MAX_DEG = 25;

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

    const buttonsRef = useRef([]);
    const overlayRef = useRef(null);
    const closeRef = useRef(null);
    const leaveTimerRef = useRef(0);
    const lastSwapRef = useRef(0);
    const cyclingRef = useRef(null);
    cyclingRef.current = cyclingStack;

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

    const finishClose = useCallback(() => {
        const trigger = Number.isInteger(openStack) ? buttonsRef.current[openStack] : null;
        setIsLeaving(false);
        setOpenStack(null);
        if (trigger) trigger.focus();
    }, [openStack]);

    const closeStack = useCallback(() => {
        if (!isOpen || isLeaving) return;
        if (motion.reduced) {
            finishClose();
            return;
        }
        setIsLeaving(true);
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = window.setTimeout(finishClose, CLOSE_MS);
    }, [isOpen, isLeaving, motion.reduced, finishClose]);

    useEffect(() => () => window.clearTimeout(leaveTimerRef.current), []);

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
            if (event.key === 'Escape') closeStack();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, closeStack]);

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
        if (event.target.closest('.stack-overlay-title')) return;
        closeStack();
    };

    const openFromButton = (stackIndex, button) => {
        window.clearTimeout(leaveTimerRef.current);
        setCyclingStack(null);
        setFannedStack(null);
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

    const openDetail = isOpen ? stacks[openStack] : null;

    return (
        <div className="bg-level-3 design-page">
            <div className="header-container">
                <div className="header-nav">
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

            <div className={`design-stacks${isOpen ? ' is-dimmed' : ''}`}>
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
                                    isOpen && !isLeaving && stackIndex === openStack ? 'is-source-open' : '',
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
                    className={`stack-overlay${isLeaving ? ' is-leaving' : ''}${motion.reduced ? ' is-reduced' : ''}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={openDetail.title}
                    ref={overlayRef}
                    tabIndex={-1}
                    onClick={onOverlayClick}
                    onKeyDown={onOverlayKeyDown}
                    style={{
                        '--from-x': `${origin.x}px`,
                        '--from-y': `${origin.y}px`,
                    }}
                >
                    <div className="stack-overlay-inner">
                        <div className="stack-overlay-head">
                            <h2 className="stack-overlay-title">{openDetail.title}</h2>
                            <button
                                type="button"
                                className="stack-overlay-close"
                                aria-label="Close"
                                ref={closeRef}
                                onClick={closeStack}
                            >
                                ×
                            </button>
                        </div>
                        <div className="stack-overlay-grid">
                            {openDetail.items.map((item, itemIndex) => {
                                const aspect = openDetail.cardAspect > 0
                                    ? openDetail.cardAspect
                                    : aspectOf(item);
                                return (
                                    <div
                                        key={itemIndex}
                                        className={`stack-grid-card ${cardClassNames(openDetail)}`}
                                        style={{
                                            '--delay': `${itemIndex * OPEN_STAGGER_MS}ms`,
                                            '--aspect': String(aspect),
                                        }}
                                    >
                                        <StackCardFace
                                            item={item}
                                            index={itemIndex}
                                            title={openDetail.title}
                                            loading="eager"
                                            fetchPriority="high"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default GraffitiGallery;
