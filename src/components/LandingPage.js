import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const SITE_VERSION = 'v0.9.4';

// Frames each character spends scrambling before it locks into place.
const CHARS_PER_FRAME = 0.42;
const MIN_SCRAMBLE_FRAMES = 13;
const EXTRA_SCRAMBLE_FRAMES = 19;

function randomScrambleChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function useDecryptedText(text, { animate, delay = 0, onComplete }) {
  const [display, setDisplay] = useState(animate ? '' : text);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!animate) {
      setDisplay(text);
      onCompleteRef.current?.();
      return undefined;
    }

    const queue = text.split('').map((char, index) => {
      const start = Math.floor(index / CHARS_PER_FRAME);
      return {
        char,
        start,
        end:
          start +
          MIN_SCRAMBLE_FRAMES +
          Math.floor(Math.random() * EXTRA_SCRAMBLE_FRAMES),
      };
    });

    let frame = 0;
    let rafId;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      onCompleteRef.current?.();
    };

    const tick = () => {
      let settled = 0;

      const output = queue
        .map(({ char, start, end }) => {
          if (frame >= end) {
            settled += 1;
            return char;
          }
          if (frame >= start) {
            return char === ' ' ? ' ' : randomScrambleChar();
          }
          return '';
        })
        .join('');

      setDisplay(output);

      if (settled === queue.length) {
        finish();
        return;
      }
      frame += 1;
      rafId = requestAnimationFrame(tick);
    };

    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [text, animate, delay]);

  return display;
}

function DecryptText({ text, animate, delay, className, onComplete }) {
  const display = useDecryptedText(text, { animate, delay, onComplete });

  return (
    <span className={className ? `decrypt ${className}` : 'decrypt'}>
      <span className="decrypt-sizer" aria-hidden="true">
        {text}
      </span>
      <span className="decrypt-value">{display || '\u00A0'}</span>
    </span>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  const [prefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const animate = !prefersReducedMotion;
  const [titleDecoded, setTitleDecoded] = useState(!animate);

  const handleTouch = (event) => {
    const element = event.currentTarget;
    element.classList.add('touched');
    setTimeout(() => {
      element.classList.remove('touched');
    }, 300);
  };

  return (
    <div className="landing-container">
      <div className="content-wrapper">
        <div
          className="logo-online-container"
          onClick={() => navigate('/')}
          onTouchStart={handleTouch}
        >
          <span className="logo-text">
            <DecryptText
              text="daviddylan.digital"
              animate={animate}
              delay={200}
              onComplete={() => setTitleDecoded(true)}
            />
          </span>
        </div>
        <div className="button-container">
          <button
            onClick={() => navigate('/portfolio')}
            onTouchStart={handleTouch}
            className="nav-button"
          >
            <DecryptText text="Portfolio" animate={animate} delay={650} />
          </button>
          <button
            onClick={() => navigate('/store')}
            onTouchStart={handleTouch}
            className="nav-button store-button"
          >
            <DecryptText text="Store" animate={animate} delay={800} />
          </button>
        </div>
      </div>
      <p
        className={`reconstruction-notice${titleDecoded ? ' is-visible' : ''}`}
      >
        **Site Under Reconstruction**
      </p>
      <p
        className={`reconstruction-notice reconstruction-notice-sub${
          titleDecoded ? ' is-visible' : ''
        }`}
      >
        {`**Initial Prototype Version · ${SITE_VERSION}**`}
      </p>
    </div>
  );
}

export default LandingPage;
