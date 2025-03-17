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
        { src: '/photos/hockey-1.JPG', title: 'Northeastern Hockey', year: '2023' },
        { src: '/photos/ICA.jpg', title: 'ICA Boston', year: '2023' },
        { src: '/photos/RedBullHeavyMetal.jpg', title: 'Red Bull Heavy Metal', year: '2023' },
        { src: '/clothing/clothing4.JPG', title: 'Unstoppable Chaos (Brown)', year: '2022' },
        { src: '/clothing/clothing5.JPG', title: 'Unstoppable Chaos (Black)', year: '2022' }
    ];

    const [enlargedId, setEnlargedId] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(2);

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
            zIndex: i === 2 ? 8 : 7 - Math.abs(i - 2)
        }))
    );

    const bringToFront = (id) => {
        if (!enlargedId) {
            setImages(prevImages => prevImages.map(img => ({
                ...img,
                zIndex: img.id === id ? 1000 : img.zIndex
            })));
        }
    };

    const handleImageClick = (id) => {
        if (enlargedId === id) {
            setEnlargedId(null);
        } else {
            setEnlargedId(id);
            bringToFront(id);
        }
    };

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
                    zIndex: isCenterImage ? 8 : 7 - Math.abs(newPosition - 2)
                };
            }));
            
            return newIndex;
        });
        setEnlargedId(null);
    };

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
                <img 
                    src="/am.png" 
                    alt="AM Logo" 
                    className="header-logo"
                    onClick={() => navigate('/')}
                />
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
                                position: enlargedId === image.id ? 'fixed' : 'absolute',
                                width: `${enlargedId === image.id ? enlargedWidth : image.width}px`,
                                height: `${enlargedId === image.id ? enlargedWidth : image.height}px`,
                                ...(enlargedId !== image.id && {
                                    left: `${image.x}px`,
                                    top: `${image.y}px`,
                                    transform: `rotate(${image.id * 2 - 7}deg)`
                                })
                            }}
                            onMouseEnter={() => bringToFront(image.id)}
                            onClick={() => handleImageClick(image.id)}
                        >
                            <div className="image-wrapper">
                                <img 
                                    src={image.src}
                                    alt={`Clothing piece ${image.id + 1}`}
                                    className="gallery-image"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="content-wrapper piece-info">
                    <div className="piece-title">
                        <span className="nav-button">{images[currentIndex].title}</span>
                    </div>
                    <div className="piece-year">
                        <span className="nav-button">{images[currentIndex].year}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Clothing; 