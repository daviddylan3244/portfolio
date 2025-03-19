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
        { src: '/photos/Hockey-2.jpg', title: 'Northeastern Hockey', year: '2024' },
        { src: '/photos/Chinese New Year-47.jpg', title: 'Chinese New Year Event', year: '2025' },
        { src: '/photos/ISGM.jpg', title: 'Isabella Stewart Gardner Museum', year: '2025' }
    ];

    const [enlargedId, setEnlargedId] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(2);
    const [currentIndex2, setCurrentIndex2] = useState(2);

    const getInitialPosition = (index) => {
        const staggerX = 250;
        const centerX = (window.innerWidth - (imageWidth + (staggerX * 4))) / 2 + 450;
        const baseY = (window.innerHeight / 4);
        
        const arcHeight = -120;
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
            zIndex: i  // This makes each image overlap the one to its left
        }))
    );

    const [images2, setImages2] = useState(
        pieces2.map((piece, i) => ({
            id: i,
            ...piece,
            width: i === 2 ? currentImageWidth : imageWidth,
            height: i === 2 ? currentImageWidth : imageWidth,
            ...getInitialPosition(i),
            zIndex: i
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
                    zIndex: newPosition  // Maintain left-to-right overlap during rotation
                };
            }));
            
            return newIndex;
        });
        setEnlargedId(null);
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
                    zIndex: newPosition
                };
            }));
            
            return newIndex;
        });
        setEnlargedId(null);
    };

    const handleImageClick = (id) => {
        if (enlargedId === id) {
            setEnlargedId(null);
        } else {
            setEnlargedId(id);
        }
    };

    const bringToFront = (id) => {
        if (!enlargedId) {
            setImages(prevImages => prevImages.map(img => ({
                ...img,
                zIndex: img.id === id ? 20 : img.zIndex
            })));
        }
    };

    // Add this CSS to handle the enlarged state
    const enlargedStyle = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vw',  // 80% of viewport width
        height: '80vh',  // 80% of viewport height
        zIndex: 1000,
        backgroundColor: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
    };

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
        z-index: 1000;
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
            <div className="carousel-container">
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
                            className={`draggable-image-container ${enlargedId === image.id ? 'enlarged' : ''}`}
                            style={{
                                ...(enlargedId === image.id ? enlargedStyle : {
                                    position: 'absolute',
                                    width: `${image.width}px`,
                                    height: `${image.height}px`,
                                    left: `${image.x}px`,
                                    top: `${image.y}px`,
                                    transform: `rotate(${image.id * 2 - 7}deg)`,
                                    zIndex: image.zIndex
                                }),
                                transition: 'all 0.3s ease-in-out'
                            }}
                            onClick={() => handleImageClick(image.id)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Clothing piece ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: enlargedId === image.id ? 'contain' : 'cover'
                                    }}
                                    loading="lazy"
                                />
                                {enlargedId === image.id && (
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
                {enlargedId === null && (
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
            {enlargedId !== null && (
                <div className="enlarged-view" onClick={() => setEnlargedId(null)}>
                    <div className="enlarged-image-container" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={images[enlargedId].src} 
                            alt={images[enlargedId].title}
                            className="enlarged-image"
                        />
                        <div className="enlarged-text">
                            <span className="nav-button">{images[enlargedId].title}</span>
                            <span className="nav-button">{images[enlargedId].year}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Second Carousel */}
            <div className="carousel-container" style={{ marginTop: '-300px' }}>
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
                            className={`draggable-image-container ${enlargedId === image.id ? 'enlarged' : ''}`}
                            style={{
                                ...(enlargedId === image.id ? enlargedStyle : {
                                    position: 'absolute',
                                    width: `${image.width}px`,
                                    height: `${image.height}px`,
                                    left: `${image.x}px`,
                                    top: `${image.y}px`,
                                    transform: `rotate(${image.id * 2 - 7}deg)`,
                                    zIndex: image.zIndex
                                }),
                                transition: 'all 0.3s ease-in-out'
                            }}
                            onClick={() => handleImageClick(image.id)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Clothing piece ${image.id + 1}`}
                                    className="gallery-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: enlargedId === image.id ? 'contain' : 'cover'
                                    }}
                                    loading="lazy"
                                />
                                {enlargedId === image.id && (
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
                {enlargedId === null && (
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
        </div>
    );
};

export default Clothing; 