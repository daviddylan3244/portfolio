import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';

const IMAGE_URLS = [
    '/Product-design/Coinsorter.png',
    '/Product-design/Coinsorter2.png',
    '/Product-design/jackethook.png',
    '/Product-design/jackethook2.png',
    '/Product-design/WindowShelf.png',
    '/Product-design/WindowShelf2.png',
    '/Product-design/Goya-1.png',
    '/Product-design/Goya-2.png',
    '/Product-design/Shelf-Sidex.png',
    '/Product-design/shelfWheels-Sidex.png',
    '/Product-design/Box-Sidex.png',
];

const GAP = 10;
const MIN_SIZE = 90;
const CANVAS_BOTTOM_PADDING = 320;
const MIN_CANVAS_HEIGHT = 1200;
const DOUBLE_TAP_DELAY = 300;

function getBaseWidth(viewportWidth) {
    if (viewportWidth <= 480) return 160;
    if (viewportWidth <= 768) return 200;
    return 350;
}

function buildInitialLayout() {
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const baseWidth = getBaseWidth(viewportWidth);
    const maxWidth = Math.max(MIN_SIZE, viewportWidth - 40);
    const gridStartX = Math.max(
        20,
        (viewportWidth - baseWidth * 3 - GAP * 2) / 2
    );
    const gridRowHeight = baseWidth * 0.75 + GAP;

    return IMAGE_URLS.map((src, index) => {
        const isBanner = index === 6 || index === 7;

        if (isBanner) {
            const naturalWidth = index === 6 ? 1108 : 1363;
            const naturalHeight = index === 6 ? 274 : 337;
            const width = Math.min(naturalWidth, maxWidth);
            const height = width * (naturalHeight / naturalWidth);
            return {
                id: index,
                src,
                width,
                height,
                x: Math.max(20, (viewportWidth - width) / 2),
                y: 80 + gridRowHeight * 2 + (index - 6) * (height + GAP),
                zIndex: 1,
            };
        }

        const gridIndex = index < 6 ? index : index - 8;
        const column = index < 6 ? gridIndex % 3 : gridIndex;
        const row = index < 6 ? Math.floor(gridIndex / 3) : 0;
        const bannerBlock = index < 6 ? 0 : gridRowHeight * 2 + 700;

        return {
            id: index,
            src,
            width: baseWidth,
            height: baseWidth * 0.75,
            x: gridStartX + column * (baseWidth + GAP),
            y: 80 + bannerBlock + row * gridRowHeight,
            zIndex: 1,
        };
    });
}

function canvasHeightFor(images) {
    const lowestEdge = images.reduce(
        (lowest, image) => Math.max(lowest, image.y + image.height),
        0
    );
    return Math.max(MIN_CANVAS_HEIGHT, lowestEdge + CANVAS_BOTTOM_PADDING);
}

const GalleryImage = React.memo(function GalleryImage({
    image,
    isFocused,
    anyFocused,
    zCounterRef,
    canvasRef,
    onCommit,
    onToggleFocus,
}) {
    const nodeRef = useRef(null);
    const lastTapRef = useRef(0);
    const poseRef = useRef({
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
    });
    const dragRef = useRef(null);
    const resizeRef = useRef(null);

    // Keep the live pose in sync if React remounts (reset) or commits.
    const raise = () => {
        const node = nodeRef.current;
        if (!node) return;
        zCounterRef.current += 1;
        node.style.zIndex = String(zCounterRef.current);
    };

    const applyPose = () => {
        const node = nodeRef.current;
        if (!node) return;
        const { x, y, width, height } = poseRef.current;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
    };

    const growCanvasIfNeeded = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const needed = poseRef.current.y + poseRef.current.height + CANVAS_BOTTOM_PADDING;
        const current = parseFloat(canvas.style.height) || canvas.offsetHeight;
        if (needed > current) {
            canvas.style.height = `${needed}px`;
        }
    };

    const startDrag = (event) => {
        if (anyFocused || event.button === 2) return;
        if (event.target.closest('.resize-handle')) return;

        event.preventDefault();
        raise();

        const node = nodeRef.current;
        node.classList.add('is-dragging');
        node.setPointerCapture(event.pointerId);

        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: poseRef.current.x,
            originY: poseRef.current.y,
            frame: 0,
        };

        const onMove = (moveEvent) => {
            if (!dragRef.current || moveEvent.pointerId !== dragRef.current.pointerId) return;
            moveEvent.preventDefault();

            const nextX = dragRef.current.originX + (moveEvent.clientX - dragRef.current.startX);
            const nextY = Math.max(0, dragRef.current.originY + (moveEvent.clientY - dragRef.current.startY));
            poseRef.current.x = nextX;
            poseRef.current.y = nextY;

            if (dragRef.current.frame) return;
            dragRef.current.frame = requestAnimationFrame(() => {
                if (!dragRef.current) return;
                dragRef.current.frame = 0;
                applyPose();
                growCanvasIfNeeded();
            });
        };

        const onUp = (upEvent) => {
            if (!dragRef.current || upEvent.pointerId !== dragRef.current.pointerId) return;
            cancelAnimationFrame(dragRef.current.frame);
            dragRef.current = null;
            node.classList.remove('is-dragging');
            try {
                node.releasePointerCapture(upEvent.pointerId);
            } catch {
                // Capture may already be released.
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            applyPose();
            onCommit(image.id, { ...poseRef.current });
        };

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const startResize = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (anyFocused) return;

        raise();
        const node = nodeRef.current;
        node.classList.add('is-dragging');
        node.setPointerCapture(event.pointerId);

        const aspectRatio = poseRef.current.width / poseRef.current.height;
        resizeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: poseRef.current.width,
            startHeight: poseRef.current.height,
            aspectRatio,
            frame: 0,
        };

        const onMove = (moveEvent) => {
            if (!resizeRef.current || moveEvent.pointerId !== resizeRef.current.pointerId) return;
            moveEvent.preventDefault();

            const deltaX = moveEvent.clientX - resizeRef.current.startX;
            const deltaY = moveEvent.clientY - resizeRef.current.startY;
            const delta =
                Math.abs(deltaX) > Math.abs(deltaY)
                    ? deltaX
                    : deltaY * resizeRef.current.aspectRatio;
            const width = Math.max(MIN_SIZE, resizeRef.current.startWidth + delta);
            poseRef.current.width = width;
            poseRef.current.height = width / resizeRef.current.aspectRatio;

            if (resizeRef.current.frame) return;
            resizeRef.current.frame = requestAnimationFrame(() => {
                if (!resizeRef.current) return;
                resizeRef.current.frame = 0;
                applyPose();
                growCanvasIfNeeded();
            });
        };

        const onUp = (upEvent) => {
            if (!resizeRef.current || upEvent.pointerId !== resizeRef.current.pointerId) return;
            cancelAnimationFrame(resizeRef.current.frame);
            resizeRef.current = null;
            node.classList.remove('is-dragging');
            try {
                node.releasePointerCapture(upEvent.pointerId);
            } catch {
                // Capture may already be released.
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            applyPose();
            onCommit(image.id, { ...poseRef.current });
        };

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const handleTouchStart = () => {
        const now = Date.now();
        if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            onToggleFocus(image.id);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    };

    return (
        <div
            ref={nodeRef}
            className={`draggable-image-container${isFocused ? ' focused' : ''}`}
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${image.width}px`,
                height: `${image.height}px`,
                transform: `translate3d(${image.x}px, ${image.y}px, 0)`,
                zIndex: isFocused ? 2000 : image.zIndex,
            }}
            onPointerDown={startDrag}
            onDoubleClick={() => onToggleFocus(image.id)}
            onTouchStart={handleTouchStart}
        >
            <div className="image-wrapper">
                <img
                    src={image.src}
                    alt={`Product design ${image.id + 1}`}
                    className="gallery-image"
                    draggable={false}
                />
                {!anyFocused && (
                    <div
                        className="resize-handle"
                        onPointerDown={startResize}
                        role="presentation"
                    >
                        <div className="resize-arrow" />
                    </div>
                )}
            </div>
        </div>
    );
});

const GraffitiGallery = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState(buildInitialLayout);
    const [focusedImage, setFocusedImage] = useState(null);
    const [layoutVersion, setLayoutVersion] = useState(0);
    const zCounterRef = useRef(10);
    const canvasRef = useRef(null);

    const commitImage = useCallback((id, pose) => {
        setImages((previous) =>
            previous.map((image) => (image.id === id ? { ...image, ...pose } : image))
        );
    }, []);

    const toggleFocus = useCallback((id) => {
        setFocusedImage((current) => (current === id ? null : id));
    }, []);

    return (
        <div style={{ backgroundColor: 'transparent', minHeight: '100vh', color: 'white' }}>
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
                <button
                    className="header-button gallery-reset"
                    onClick={() => {
                        zCounterRef.current = 10;
                        setFocusedImage(null);
                        setImages(buildInitialLayout());
                        setLayoutVersion((version) => version + 1);
                    }}
                >
                    Reset layout
                </button>
            </div>

            <div className="gallery-viewport">
                <div
                    ref={canvasRef}
                    className="gallery-canvas"
                    style={{ height: `${canvasHeightFor(images)}px` }}
                >
                    {images.map((image) => (
                        <GalleryImage
                            key={`${layoutVersion}-${image.id}`}
                            image={image}
                            isFocused={focusedImage === image.id}
                            anyFocused={focusedImage !== null}
                            zCounterRef={zCounterRef}
                            canvasRef={canvasRef}
                            onCommit={commitImage}
                            onToggleFocus={toggleFocus}
                        />
                    ))}
                </div>
            </div>

            {focusedImage !== null && (
                <div className="overlay" onClick={() => setFocusedImage(null)} />
            )}
        </div>
    );
};

export default GraffitiGallery;
