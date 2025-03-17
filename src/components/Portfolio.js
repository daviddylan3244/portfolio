import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Portfolio.css';

const Portfolio = () => {
    const navigate = useNavigate();

    return (
        <div className="portfolio-container">
            <div className="menu-container">
                <div className="top-menu-row">
                    <button 
                        className="menu-item"
                        onClick={() => navigate('/resume')}
                    >
                        Resume
                    </button>
                    <button 
                        className="menu-item"
                        onClick={() => navigate('/clothing')}
                    >
                        Photography
                    </button>
                </div>
                <button 
                    className="menu-item"
                    onClick={() => navigate('/graffiti')}
                >
                    Design Work
                </button>
            </div>
        </div>
    );
};

export default Portfolio; 