import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/GraffitiGallery.css';

const GraffitiGallery = () => {
    const navigate = useNavigate();
    
    // Increase the base image width
    const getImageWidth = () => {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 480) return 160;  // Adjusted for phones
        if (screenWidth <= 768) return 200;  // Adjusted for tablets
        return 350;  // Adjusted for desktop
    };
    
    const imageWidth = getImageWidth();
    const gap = 10; // Reduced gap for mobile
    
    // Reorganize positions for 2 columns (3+2 layout on mobile)
    const getInitialPosition = (index) => {
        const isMobile = window.innerWidth <= 768;
        
        if (index < 6) {
            // First 6 images (original grid)
            const isTopRow = index < 3;
            const rowIndex = isTopRow ? index : index - 3;
            const startX = (window.innerWidth - (imageWidth * 3) - (gap * 2)) / 2;
            return {
                x: startX + (rowIndex * (imageWidth + gap)),
                y: isTopRow ? 80 : 80 + imageWidth + gap
            };
        } else if (index < 8) {
            // Goya images (index 6-7)
            const goyaIndex = index - 6;
            const goyaWidth = goyaIndex === 0 ? 1108 : 1363;
            const startX = (window.innerWidth - goyaWidth) / 2;
            return {
                x: startX,
                y: 80 + (imageWidth + gap) * 2 + (goyaIndex * (350 + gap))
            };
        } else {
            // New section (index 8-10)
            const newSectionIndex = index - 8;
            const startX = (window.innerWidth - (imageWidth * 3) - (gap * 2)) / 2;
            return {
                x: startX + (newSectionIndex * (imageWidth + gap)),
                y: 80 + (imageWidth + gap) * 2 + (350 + gap) * 2 + 100 // Position below Goya images with extra spacing
            };
        }
    };
    
    // Updated image URLs with correct file extensions
    const imageUrls = [
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
    
    const [images, setImages] = useState(
        Array.from({length: 11}, (_, i) => ({
            id: i,
            src: imageUrls[i],
            width: i === 6 ? 1108 : i === 7 ? 1363 : imageWidth,
            height: i === 6 ? 274 : i === 7 ? 337 : imageWidth * 0.75,  // Made regular images shorter
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
                    width: index >= 6 ? newWidth * 2 : newWidth,
                    height: index >= 6 ? newWidth * 0.6 : newWidth,
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
                                    alt={`Product design ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',  // Changed from 'cover' to 'contain'
                                        padding: '10px',  // Add some padding to prevent edge cropping
                                        backgroundColor: 'black'  // Keep black background
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