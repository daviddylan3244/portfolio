import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';
import '../styles/Clothing.css';
import '../styles/LandingPage.css';

const ArrowLeft = () => (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
            d="M45 10L15 30L45 50" 
            stroke="white" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
    </svg>
);

const ArrowRight = () => (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
            d="M15 10L45 30L15 50" 
            stroke="white" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
    </svg>
);

const Clothing = () => {
    const navigate = useNavigate();
    const imageWidth = 300;
    const enlargedWidth = window.innerWidth <= 768 ? window.innerWidth * 0.9 : 500; // Responsive enlarged width
    const currentImageWidth = 350;
    const gap = 20;
    
    const pieces = [
        { src: '/photos/hockey-1.JPG', title: 'Northeastern Hockey', year: '2024' },
        { src: '/photos/ICA.jpg', title: 'ICA Boston', year: '2024' },
        { src: '/photos/redbullEvent-copy.jpg', title: 'Red Bull Heavy Metal', year: '2025' },
        { src: '/photos/blackfires.jpg', title: 'Blackfires Concert', year: '2025' },
        { src: '/photos/boston.jpg', title: 'Boston Skyline', year: '2024' }
    ];

    const pieces2 = [
        { src: '/photos/MFA.JPG', title: 'Museum of Fine Arts', year: '2025' },
        { src: '/photos/Nydia.jpg', title: 'Nydia Caro Concert', year: '2025' },
        { src: '/photos/Hockey2.JPG', title: 'Northeastern Hockey', year: '2024' },
        { src: '/photos/Chinese New Year-47.jpg', title: 'Chinese New Year Event', year: '2025' },
        { src: '/photos/ISGM.jpg', title: 'Isabella Stewart Gardner Museum', year: '2025' }
    ];

    const [enlargedIdTop, setEnlargedIdTop] = useState(null);
    const [enlargedIdBottom, setEnlargedIdBottom] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(2);
    const [currentIndex2, setCurrentIndex2] = useState(2);

    const getImageWidth = () => {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 480) return 200; // Smaller images for phones
        if (screenWidth <= 768) return 250; // Medium size for tablets
        return 300; // Original size for desktop
    };

    const getStaggerX = () => {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 480) return 150; // Closer spacing for phones
        if (screenWidth <= 768) return 200; // Medium spacing for tablets
        return 250; // Original spacing for desktop
    };

    const getInitialPosition = (index) => {
        const staggerX = getStaggerX();
        const screenWidth = window.innerWidth;
        const centerX = (screenWidth - (getImageWidth() + (staggerX * 4))) / 2 + (screenWidth <= 768 ? 250 : 450);
        const baseY = screenWidth <= 768 ? window.innerHeight / 5 : window.innerHeight / 4;
        
        const arcHeight = screenWidth <= 480 ? -60 : -120; // Smaller arc for mobile
        const adjustedIndex = index - 2;
        const x = centerX + (adjustedIndex * staggerX);
        const y = baseY + (Math.sin((index / (pieces.length - 1)) * Math.PI) * arcHeight);
        
        return { x, y };
    };

    const [images, setImages] = useState(
        pieces.map((piece, i) => ({
            id: i,
            ...piece,
            width: i === 2 ? currentImageWidth : imageWidth,
            height: i === 2 ? currentImageWidth : imageWidth,
            ...getInitialPosition(i),
            zIndex: Math.abs(currentIndex - i) === 0 ? 2 : 1,
        }))
    );

    const [images2, setImages2] = useState(
        pieces2.map((piece, i) => ({
            id: i,
            ...piece,
            width: i === 2 ? currentImageWidth : imageWidth,
            height: i === 2 ? currentImageWidth : imageWidth,
            ...getInitialPosition(i),
            zIndex: Math.abs(currentIndex2 - i) === 0 ? 2 : 1,
        }))
    );

    const handleArrowClick = (direction) => {
        setCurrentIndex(prev => {
            const newIndex = direction === 'next' 
                ? (prev + 1) % images.length 
                : (prev - 1 + images.length) % images.length;
            
            setImages(prevImages => prevImages.map((img, i) => {
                const newPosition = (i - newIndex + 2 + images.length) % images.length;
                const isCenterImage = newPosition === 2;
                
                return {
                    ...img,
                    ...getInitialPosition(newPosition),
                    width: isCenterImage ? currentImageWidth : imageWidth,
                    height: isCenterImage ? currentImageWidth : imageWidth,
                    zIndex: Math.abs(newIndex - i) === 0 ? 2 : 1,
                };
            }));
            
            return newIndex;
        });
        setEnlargedIdTop(null);
        setEnlargedIdBottom(null);
    };

    const handleArrowClick2 = (direction) => {
        setCurrentIndex2(prev => {
            const newIndex = direction === 'next' 
                ? (prev + 1) % images2.length 
                : (prev - 1 + images2.length) % images2.length;
            
            setImages2(prevImages => prevImages.map((img, i) => {
                const newPosition = (i - newIndex + 2 + images2.length) % images2.length;
                const isCenterImage = newPosition === 2;
                
                return {
                    ...img,
                    ...getInitialPosition(newPosition),
                    width: isCenterImage ? currentImageWidth : imageWidth,
                    height: isCenterImage ? currentImageWidth : imageWidth,
                    zIndex: Math.abs(newIndex - i) === 0 ? 2 : 1,
                };
            }));
            
            return newIndex;
        });
        setEnlargedIdTop(null);
        setEnlargedIdBottom(null);
    };

    const handleImageClickTop = (id) => {
        if (enlargedIdTop === id) {
            setEnlargedIdTop(null);
        } else {
            setEnlargedIdTop(id);
            setEnlargedIdBottom(null);
        }
    };

    const handleImageClickBottom = (id) => {
        if (enlargedIdBottom === id) {
            setEnlargedIdBottom(null);
        } else {
            setEnlargedIdBottom(id);
            setEnlargedIdTop(null);
        }
    };

    const bringToFront = (id) => {
        if (!enlargedIdTop) {
            setImages(prevImages => prevImages.map(img => ({
                ...img,
                zIndex: Math.abs(currentIndex - img.id) === 0 ? 2 : 1
            })));
        }
    };

    // Update the enlargedStyle object
    const enlargedStyle = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: window.innerWidth <= 768 ? '95vw' : '80vw',
        height: window.innerWidth <= 768 ? '60vh' : '80vh',
        zIndex: 2000,
        backgroundColor: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
    };

    // Update the enlarged-view class in your styles
    const styles = `
    .enlarged-text {
        position: absolute;
        bottom: -100px;
        left: 0;
        right: 0;
        text-align: center;
        color: white;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: inherit;
    }

    .enlarged-text .nav-button {
        font-size: 1.2rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .enlarged-view {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2000;  // Increased z-index
        width: 80%;
        height: 80%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .enlarged-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .carousel-container {
        position: relative;
    }

    @media (max-width: 768px) {
        .carousel-container {
            overflow: hidden;
        }

        .carousel-arrow {
            width: 40px;
            height: 40px;
            padding: 5px;
        }

        .piece-info {
            font-size: 14px;
        }

        .enlarged-text {
            bottom: -40px;
        }

        .enlarged-text .nav-button {
            font-size: 1rem;
        }
    }

    @media (max-width: 480px) {
        .carousel-container {
            margin-top: -150px; // Adjust spacing between carousels on mobile
        }

        .carousel-arrow {
            width: 30px;
            height: 30px;
        }

        .piece-info {
            font-size: 12px;
        }
    }
    `;

    return (
        <div className="clothing-container">
            <div className="header-container">
                <div className="header-nav">
                    <button 
                        className="header-button"
                        onClick={() => navigate('/store')}
                    >
                        Store
                    </button>
                    <button 
                        className="header-button"
                        onClick={() => navigate('/portfolio')}
                    >
                        Portfolio
                    </button>
                </div>
                <span 
                    className="header-logo"
                    onClick={() => navigate('/')}
                >
                    Return Home
                </span>
            </div>
            <div className="carousel-container" style={{ position: 'relative', zIndex: 1000 }}>
                <div className="carousel-section">
                    <div 
                        className="carousel-arrow left"
                        onClick={() => handleArrowClick('prev')}
                    >
                        <ArrowLeft />
                    </div>
                    <div 
                        className="carousel-arrow right"
                        onClick={() => handleArrowClick('next')}
                    >
                        <ArrowRight />
                    </div>
                    {images.map((image) => (
                        <div 
                            key={image.id}
                            className={`draggable-image-container ${enlargedIdTop === image.id ? 'enlarged' : ''}`}
                            style={{
                                ...(enlargedIdTop === image.id ? enlargedStyle : {
                                    position: 'absolute',
                                    width: `${window.innerWidth <= 768 ? getImageWidth() : image.width}px`,
                                    height: `${window.innerWidth <= 768 ? getImageWidth() : image.height}px`,
                                    left: `${image.x}px`,
                                    top: `${image.y}px`,
                                    transform: `rotate(${window.innerWidth <= 768 ? (image.id * 1 - 3) : (image.id * 2 - 7)}deg)`,
                                    zIndex: Math.abs(currentIndex - image.id) === 0 ? 2 : 1,
                                }),
                                transition: 'all 0.3s ease-in-out'
                            }}
                            onClick={() => handleImageClickTop(image.id)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Clothing piece ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: enlargedIdTop === image.id ? 'contain' : 'cover'
                                    }}
                                    loading="lazy"
                                />
                                {enlargedIdTop === image.id && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-60px',
                                        left: '0',
                                        width: '100%',
                                        textAlign: 'center',
                                        color: 'white',
                                        padding: '20px'
                                    }}>
                                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                                            {image.title}
                                        </div>
                                        <div style={{ fontSize: '18px' }}>
                                            {image.year}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Only show this text when no image is enlarged */}
                {enlargedIdTop === null && (
                    <div className="content-wrapper piece-info">
                        <div className="piece-title">
                            <span className="nav-button">{images[currentIndex].title}</span>
                        </div>
                        <div className="piece-year">
                            <span className="nav-button">{images[currentIndex].year}</span>
                        </div>
                    </div>
                )}
            </div>
            {/* Add overlay when image is enlarged */}
            {enlargedIdTop !== null && (
                <div className="enlarged-view" onClick={() => setEnlargedIdTop(null)}>
                    <div className="enlarged-image-container" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={images[enlargedIdTop].src} 
                            alt={images[enlargedIdTop].title}
                            className="enlarged-image"
                        />
                        <div className="enlarged-text">
                            <span className="nav-button">{images[enlargedIdTop].title}</span>
                            <span className="nav-button">{images[enlargedIdTop].year}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Second Carousel */}
            <div className="carousel-container" style={{ marginTop: '-300px', position: 'relative', zIndex: 900 }}>
                <div className="carousel-section">
                    <div className="carousel-arrow left" onClick={() => handleArrowClick2('prev')}>
                        <ArrowLeft />
                    </div>
                    <div className="carousel-arrow right" onClick={() => handleArrowClick2('next')}>
                        <ArrowRight />
                    </div>
                    {images2.map((image) => (
                        <div 
                            key={image.id}
                            className={`draggable-image-container ${enlargedIdBottom === image.id ? 'enlarged' : ''}`}
                            style={{
                                ...(enlargedIdBottom === image.id ? enlargedStyle : {
                                    position: 'absolute',
                                    width: `${window.innerWidth <= 768 ? getImageWidth() : image.width}px`,
                                    height: `${window.innerWidth <= 768 ? getImageWidth() : image.height}px`,
                                    left: `${image.x}px`,
                                    top: `${image.y}px`,
                                    transform: `rotate(${window.innerWidth <= 768 ? (image.id * 1 - 3) : (image.id * 2 - 7)}deg)`,
                                    zIndex: Math.abs(currentIndex2 - image.id) === 0 ? 2 : 1,
                                }),
                                transition: 'all 0.3s ease-in-out'
                            }}
                            onClick={() => handleImageClickBottom(image.id)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Clothing piece ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: enlargedIdBottom === image.id ? 'contain' : 'cover'
                                    }}
                                    loading="lazy"
                                />
                                {enlargedIdBottom === image.id && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-60px',
                                        left: '0',
                                        width: '100%',
                                        textAlign: 'center',
                                        color: 'white',
                                        padding: '20px'
                                    }}>
                                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                                            {image.title}
                                        </div>
                                        <div style={{ fontSize: '18px' }}>
                                            {image.year}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Only show this text when no image is enlarged */}
                {enlargedIdBottom === null && (
                    <div className="content-wrapper piece-info">
                        <div className="piece-title">
                            <span className="nav-button">{images2[currentIndex2].title}</span>
                        </div>
                        <div className="piece-year">
                            <span className="nav-button">{images2[currentIndex2].year}</span>
                        </div>
                    </div>
                )}
            </div>
            {/* Add overlay when image is enlarged */}
            {enlargedIdBottom !== null && (
                <div className="enlarged-view" onClick={() => setEnlargedIdBottom(null)}>
                    <div className="enlarged-image-container" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={images2[enlargedIdBottom].src} 
                            alt={images2[enlargedIdBottom].title}
                            className="enlarged-image"
                        />
                        <div className="enlarged-text">
                            <span className="nav-button">{images2[enlargedIdBottom].title}</span>
                            <span className="nav-button">{images2[enlargedIdBottom].year}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clothing; 