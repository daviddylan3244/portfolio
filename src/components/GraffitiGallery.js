import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';

const GraffitiGallery = () => {
    const navigate = useNavigate();
    
    // Adjust image width based on screen size
    const getImageWidth = () => {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 480) return 140; // phones
        if (screenWidth <= 768) return 160; // tablets
        return 300; // desktop
    };
    
    const imageWidth = getImageWidth();
    const gap = 10; // Reduced gap for mobile
    
    // Reorganize positions for 2 columns (3+2 layout on mobile)
    const getInitialPosition = (index) => {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const columnWidth = imageWidth + gap;
            const startX = (window.innerWidth - (columnWidth * 2)) / 2;
            
            // Adjust vertical position to be more visible
            return {
                x: startX + (column * columnWidth),
                y: 100 + (row * (imageWidth + gap))
            };
        } else {
            // Original desktop layout
            const isTopRow = index < 4;
            if (isTopRow) {
                const topRowWidth = (imageWidth * 4) + (gap * 3);
                const startX = Math.max(20, (window.innerWidth - topRowWidth) / 2 - 50);
                return {
                    x: startX + (index * (imageWidth + gap)),
                    y: 80
                };
            } else {
                const bottomRowWidth = (imageWidth * 3) + (gap * 2);
                const startX = Math.max(20, (window.innerWidth - bottomRowWidth) / 2 - 50);
                const bottomIndex = index - 4;
                return {
                    x: startX + (bottomIndex * (imageWidth + gap)),
                    y: 80 + imageWidth + gap
                };
            }
        }
    };
    
    // Updated image URLs with correct file extensions
    const imageUrls = [
        '/graffiti/coinsorter.png',  // New image
        '/graffiti/Coinsorter2.png',
        '/graffiti/jackethook.png',
        '/graffiti/jackethook2.png',
        '/graffiti/WindowShelf.png',
        '/graffiti/WindowShelf2.png',
    ];
    
    const [images, setImages] = useState(
        Array.from({length: 7}, (_, i) => ({
            id: i,
            src: imageUrls[i],
            width: imageWidth,
            height: imageWidth,
            ...getInitialPosition(i),
            zIndex: 1
        }))
    );

    // Add resize handler
    React.useEffect(() => {
        const handleResize = () => {
            const newWidth = getImageWidth();
            setImages(prevImages => 
                prevImages.map((img, index) => ({
                    ...img,
                    width: newWidth,
                    height: newWidth,
                    ...getInitialPosition(index)
                }))
            );
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const bringToFront = (id) => {
        setImages(prevImages => prevImages.map(img => ({
            ...img,
            zIndex: img.id === id ? 1000 : 1
        })));
    };

    const handleMouseEnter = (id) => {
        bringToFront(id);
    };

    const handleResize = (id, startEvent) => {
        startEvent.stopPropagation();
        
        const image = images.find(img => img.id === id);
        if (!image) return;

        const container = startEvent.target.closest('.draggable-image-container');
        const startRect = container.getBoundingClientRect();
        const startWidth = startRect.width;
        const startHeight = startRect.height;
        const startX = startEvent.clientX;
        const startY = startEvent.clientY;

        const mouseMoveHandler = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            
            const newWidth = Math.max(100, startWidth + deltaX);
            const newHeight = Math.max(100, startHeight + deltaY);
            
            const aspectRatio = startWidth / startHeight;
            const finalWidth = newWidth;
            const finalHeight = newWidth / aspectRatio;

            setImages(prevImages => prevImages.map(img =>
                img.id === id
                    ? { ...img, width: finalWidth, height: finalHeight }
                    : img
            ));
        };

        const mouseUpHandler = () => {
            window.removeEventListener('mousemove', mouseMoveHandler);
            window.removeEventListener('mouseup', mouseUpHandler);
        };

        window.addEventListener('mousemove', mouseMoveHandler);
        window.addEventListener('mouseup', mouseUpHandler);
    };

    const [focusedImage, setFocusedImage] = useState(null);
    const lastTapRef = useRef(0);

    const handleTap = (imageId, e) => {
        e.preventDefault(); // Prevent default touch behavior
        
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
            // Double tap detected
            setFocusedImage(focusedImage === imageId ? null : imageId);
            lastTapRef.current = 0;
        } else {
            // First tap
            lastTapRef.current = now;
        }
    };

    return (
        <div style={{ backgroundColor: 'black', minHeight: '100vh', color: 'white', overflow: 'hidden' }}>
            <div className="header-container">
                <div className="header-nav">
                    <button 
                        className="header-button"
                        onClick={() => navigate('/portfolio')}
                    >
                        Portfolio
                    </button>
                    <button 
                        className="header-button"
                        onClick={() => navigate('/store')}
                    >
                        Store
                    </button>
                </div>
                <span 
                    className="header-logo"
                    onClick={() => navigate('/')}
                >
                    Return Home
                </span>
            </div>
            <div style={{ 
                position: 'relative', 
                height: 'calc(100vh - 80px)',
                padding: '10px',
                overflowY: 'auto',
                overflowX: 'hidden' // Prevent horizontal scrolling
            }}>
                {images.map((image) => (
                    <Draggable
                        key={image.id}
                        defaultPosition={{x: image.x, y: image.y}}
                        bounds="parent"
                        onStart={() => bringToFront(image.id)}
                        disabled={focusedImage !== null}
                    >
                        <div 
                            className={`draggable-image-container ${focusedImage === image.id ? 'focused' : ''}`}
                            style={{
                                position: 'absolute',
                                width: `${image.width}px`,
                                height: `${image.height}px`,
                                zIndex: focusedImage === image.id ? 2000 : image.zIndex,
                                transition: focusedImage !== null ? 'all 0.3s ease' : 'none'
                            }}
                            onClick={() => bringToFront(image.id)}
                            onMouseEnter={() => handleMouseEnter(image.id)}
                            onTouchStart={(e) => handleTap(image.id, e)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Graffiti artwork ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                {!focusedImage && (
                                    <div 
                                        className="resize-handle"
                                        onMouseDown={handleResize.bind(null, image.id)}
                                    >
                                        <div className="resize-arrow" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Draggable>
                ))}
            </div>
            {focusedImage !== null && (
                <div 
                    className="overlay"
                    onClick={() => setFocusedImage(null)}
                />
            )}
        </div>
    );
};

export default GraffitiGallery; 