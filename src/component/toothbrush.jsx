import { useRef, useState, useEffect, useCallback } from 'react';

const GAME_DURATION = 20;
const PROGRESS_RATE = 0.025;
const BASE_BRUSH_RADIUS = 30;
const MIN_BRUSH_RADIUS = 20;
const MAX_BRUSH_RADIUS = 50;

// Colgate Brand Colors
const COLORS = {
  primary: '#ed1b24',      // Colgate Red
  primaryDark: '#c41520',  // Ruby Red
  primaryLight: '#FF3344', // Lighter red for hover
  accent: '#007AC2',       // Colgate Blue
  accentLight: '#00A3E0',  // Light Blue
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#6C757D',
  darkGray: '#343A40',
  success: '#28A745',
  gold: '#FFD700',
};

// Stain color palette - realistic tooth discoloration
const STAIN_COLORS = [
  { r: 180, g: 150, b: 80 },   // Yellow plaque
  { r: 160, g: 120, b: 60 },   // Dark yellow
  { r: 140, g: 100, b: 50 },   // Brown-ish
  { r: 200, g: 170, b: 100 },  // Light yellow
  { r: 170, g: 130, b: 70 },   // Coffee stain
  { r: 150, g: 140, b: 90 },   // Tartar
];

// Generate random stains for a tooth
function generateStains(tooth) {
  const count = 2 + Math.floor(Math.random() * 4); // 2-5 stains per tooth
  const stains = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * tooth.r * 0.7;
    const color = STAIN_COLORS[Math.floor(Math.random() * STAIN_COLORS.length)];
    stains.push({
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist,
      size: tooth.r * (0.3 + Math.random() * 0.5),
      color,
      opacity: 0.4 + Math.random() * 0.4,
      // Irregular shape: use multiple overlapping ellipses
      scaleX: 0.6 + Math.random() * 0.8,
      scaleY: 0.6 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI,
    });
  }
  return stains;
}

// Pre-configured tooth positions for the tooth.jpg image
const INITIAL_TEETH = [
  // Upper arch (top row)
  { id: 1, x: 175, y: 95, r: 18 },
  { id: 2, x: 205, y: 70, r: 18 },
  { id: 3, x: 240, y: 52, r: 18 },
  { id: 4, x: 280, y: 42, r: 16 },
  { id: 5, x: 315, y: 38, r: 16 },
  { id: 6, x: 350, y: 42, r: 16 },
  { id: 7, x: 385, y: 52, r: 18 },
  { id: 8, x: 420, y: 70, r: 18 },
  { id: 9, x: 450, y: 95, r: 18 },
  // Upper arch inner
  { id: 10, x: 195, y: 130, r: 16 },
  { id: 11, x: 230, y: 105, r: 16 },
  { id: 12, x: 265, y: 90, r: 15 },
  { id: 13, x: 300, y: 85, r: 15 },
  { id: 14, x: 335, y: 90, r: 15 },
  { id: 15, x: 370, y: 105, r: 16 },
  { id: 16, x: 405, y: 130, r: 16 },

  // Lower arch (bottom row)
  { id: 17, x: 190, y: 450, r: 18 },
  { id: 18, x: 215, y: 480, r: 18 },
  { id: 19, x: 250, y: 502, r: 17 },
  { id: 20, x: 285, y: 515, r: 16 },
  { id: 21, x: 320, y: 518, r: 16 },
  { id: 22, x: 355, y: 515, r: 16 },
  { id: 23, x: 390, y: 502, r: 17 },
  { id: 24, x: 425, y: 480, r: 18 },
  { id: 25, x: 450, y: 450, r: 18 },
  // Lower arch inner
  { id: 26, x: 210, y: 420, r: 15 },
  { id: 27, x: 245, y: 445, r: 15 },
  { id: 28, x: 280, y: 460, r: 14 },
  { id: 29, x: 315, y: 465, r: 14 },
  { id: 30, x: 350, y: 460, r: 14 },
  { id: 31, x: 385, y: 445, r: 15 },
  { id: 32, x: 420, y: 420, r: 15 },
];

export default function ToothBrushGame() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const bgImageRef = useRef(null);
  const teethRef = useRef([]);
  const particlesRef = useRef([]);
  const brushPosRef = useRef(null);
  const isBrushingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const scaleRef = useRef({ x: 1, y: 1, offsetX: 0, offsetY: 0 });
  const brushRadiusRef = useRef(BASE_BRUSH_RADIUS);
  const audioCtxRef = useRef(null);
  const lastDingTimeRef = useRef(0);

  const [gameState, setGameState] = useState('idle'); // idle, playing, won, lost
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [cleanCount, setCleanCount] = useState(0);
  const [shieldProgress, setShieldProgress] = useState(0);
  const [screenSize, setScreenSize] = useState('desktop'); // mobile, tablet, desktop
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showPerfect, setShowPerfect] = useState(false);

  const totalTeeth = INITIAL_TEETH.length;
  const lastCleanRef = useRef(0);

  // Calculate responsive brush radius based on canvas size
  const calculateBrushRadius = useCallback((canvasWidth, canvasHeight) => {
    const minDimension = Math.min(canvasWidth, canvasHeight);
    // Scale brush radius: ~5% of the smaller canvas dimension
    const scaledRadius = minDimension * 0.05;
    return Math.max(MIN_BRUSH_RADIUS, Math.min(MAX_BRUSH_RADIUS, scaledRadius));
  }, []);

  // Determine screen size category
  const updateScreenSize = useCallback(() => {
    const width = window.innerWidth;
    if (width < 480) {
      setScreenSize('mobile');
    } else if (width < 1024) {
      setScreenSize('tablet');
    } else {
      setScreenSize('desktop');
    }
  }, []);

  // Initialize audio context and create reusable noise buffer
  const noiseBufferRef = useRef(null);
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // Pre-generate a noise buffer for brushing sounds
    const sampleRate = ctx.sampleRate;
    const length = sampleRate; // 1 second of noise
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBufferRef.current = buffer;
  }, []);

  // Play a short brushing scrub sound (filtered noise burst)
  const playDing = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buffer = noiseBufferRef.current;
    if (!ctx || !buffer) return;
    const now = Date.now();
    if (now - lastDingTimeRef.current < 100) return;
    lastDingTimeRef.current = now;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter: lower range for a softer brushing texture
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600 + Math.random() * 600; // 600-1200Hz, warm range
    filter.Q.value = 0.4 + Math.random() * 0.3;

    // Lowpass to cut harsh/itchy high frequencies
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1500;
    lowpass.Q.value = 0.5;

    // Gain envelope: gentle attack, soft sustain, smooth fade
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.03);
    gain.gain.setValueAtTime(0.04, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    source.connect(filter);
    filter.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    // Start at a random offset in the buffer for variety
    const offset = Math.random() * 0.5;
    source.start(t, offset, 0.15);
  }, []);

  // Play a win jingle
  const playWinSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }, []);

  // Play a lose/buzzer sound
  const playLoseSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // Initialize teeth with stains
  useEffect(() => {
    teethRef.current = INITIAL_TEETH.map(t => ({
      ...t,
      progress: 0,
      stains: generateStains(t),
    }));
  }, []);

  // Inject CSS animations
  useEffect(() => {
    const styleId = 'colgate-game-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        @keyframes popIn {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(226, 5, 20, 0.4); }
          50% { box-shadow: 0 0 30px rgba(226, 5, 20, 0.6); }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, []);

  // Load images
  useEffect(() => {
    const img = new Image();
    img.src = '/tooth.jpg';
    img.onload = () => {
      imageRef.current = img;
    };

    const bgImg = new Image();
    bgImg.src = '/interactive-screen-colgate-2.jpg.jpeg';
    bgImg.onload = () => {
      bgImageRef.current = bgImg;
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Calculate scale to fit image in canvas
  const calculateScale = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Use display dimensions (pre-DPR scaling)
    const container = canvas.parentElement;
    const displayWidth = container?.clientWidth || canvas.width;
    const displayHeight = container?.clientHeight || canvas.height;

    const canvasRatio = displayWidth / displayHeight;
    const imgRatio = img.width / img.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      drawHeight = displayHeight;
      drawWidth = img.width * (displayHeight / img.height);
      offsetX = (displayWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = displayWidth;
      drawHeight = img.height * (displayWidth / img.width);
      offsetX = 0;
      offsetY = (displayHeight - drawHeight) / 2;
    }

    scaleRef.current = {
      x: drawWidth / img.width,
      y: drawHeight / img.height,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
      displayWidth,
      displayHeight
    };
  }, []);

  // Convert image coordinates to screen coordinates
  const imageToScreen = useCallback((imgX, imgY) => {
    const scale = scaleRef.current;
    return {
      x: imgX * scale.x + scale.offsetX,
      y: imgY * scale.y + scale.offsetY
    };
  }, []);

  // Create particle with Colgate-themed colors
  const createParticle = useCallback((x, y, type = 'foam') => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;

    let color;
    if (type === 'sparkle') {
      // Gold and white sparkles
      color = Math.random() > 0.5 ? COLORS.gold : COLORS.white;
    } else if (type === 'star') {
      color = COLORS.gold;
    } else if (type === 'clean') {
      // Blue/white mint effect
      color = Math.random() > 0.5 ? COLORS.accentLight : COLORS.white;
    } else if (type === 'stain') {
      // Stain removal particles - brownish/yellowish specks
      const stainColor = STAIN_COLORS[Math.floor(Math.random() * STAIN_COLORS.length)];
      color = `rgba(${stainColor.r}, ${stainColor.g}, ${stainColor.b}, ${0.6 + Math.random() * 0.4})`;
    } else {
      // Foam - white with slight blue tint
      color = `rgba(200, 230, 255, ${0.6 + Math.random() * 0.4})`;
    }

    // Stain particles fling off faster
    const particleSpeed = type === 'stain' ? speed * 1.8 : speed;
    const particleDecay = type === 'stain' ? Math.random() * 0.025 + 0.025 : Math.random() * 0.03 + 0.02;

    return {
      x,
      y,
      vx: Math.cos(angle) * particleSpeed,
      vy: Math.sin(angle) * particleSpeed,
      life: 1,
      decay: particleDecay,
      size: type === 'star' ? Math.random() * 8 + 6 : type === 'stain' ? Math.random() * 4 + 2 : Math.random() * 6 + 3,
      type,
      color,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2
    };
  }, []);

  // Update particles with rotation
  const updateParticles = useCallback(() => {
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.vy += 0.08; // Slightly slower gravity
      if (p.rotation !== undefined) {
        p.rotation += p.rotationSpeed;
      }
      return p.life > 0;
    });
  }, []);

  // Check brush overlap with tooth
  const checkBrushOverlap = useCallback((brushX, brushY, tooth) => {
    const screenTooth = imageToScreen(tooth.x, tooth.y);
    const dx = brushX - screenTooth.x;
    const dy = brushY - screenTooth.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const toothScreenRadius = tooth.r * scaleRef.current.x;
    return distance < brushRadiusRef.current + toothScreenRadius;
  }, [imageToScreen]);

  // Handle brushing with scoring
  const handleBrushing = useCallback((x, y) => {
    if (gameState !== 'playing' || !isBrushingRef.current) return;

    brushPosRef.current = { x, y };

    // Add foam particles with mint effect
    for (let i = 0; i < 3; i++) {
      particlesRef.current.push(createParticle(x, y, 'foam'));
    }
    // Occasional clean sparkle
    if (Math.random() > 0.8) {
      particlesRef.current.push(createParticle(x, y, 'clean'));
    }

    let newCleanCount = 0;
    let justCleaned = false;

    teethRef.current.forEach(tooth => {
      if (checkBrushOverlap(x, y, tooth)) {
        if (tooth.progress < 1) {
          const wasClean = tooth.progress >= 1;
          tooth.progress = Math.min(1, tooth.progress + PROGRESS_RATE);

          const screenTooth = imageToScreen(tooth.x, tooth.y);

          // Play ding while brushing
          playDing();

          // Emit stain removal particles while tooth is still dirty
          if (tooth.progress < 0.8 && Math.random() > 0.4) {
            for (let i = 0; i < 2; i++) {
              particlesRef.current.push(createParticle(
                screenTooth.x + (Math.random() - 0.5) * tooth.r * scaleRef.current.x,
                screenTooth.y + (Math.random() - 0.5) * tooth.r * scaleRef.current.y,
                'stain'
              ));
            }
          }

          // Add sparkles while brushing (more as tooth gets cleaner)
          if (Math.random() > (0.8 - tooth.progress * 0.4)) {
            particlesRef.current.push(createParticle(screenTooth.x, screenTooth.y, 'sparkle'));
          }

          // Tooth just became clean
          if (!wasClean && tooth.progress >= 1) {
            justCleaned = true;
            // Burst of particles for clean tooth
            for (let i = 0; i < 8; i++) {
              particlesRef.current.push(createParticle(screenTooth.x, screenTooth.y, 'star'));
            }
            // Final burst of stain particles flying off
            for (let i = 0; i < 6; i++) {
              particlesRef.current.push(createParticle(screenTooth.x, screenTooth.y, 'stain'));
            }
          }
        }
      }
      if (tooth.progress >= 1) newCleanCount++;
    });

    // Update score and streak
    if (justCleaned) {
      const now = Date.now();
      const timeSinceLastClean = now - lastCleanRef.current;

      // Calculate new streak first so we can use it for scoring
      let newStreak;
      if (timeSinceLastClean < 2000) {
        // Quick succession - increase streak
        newStreak = streak + 1;
        if (newStreak >= 3) {
          setShowPerfect(true);
          setTimeout(() => setShowPerfect(false), 1000);
        }
      } else {
        newStreak = 1;
      }

      setStreak(newStreak);
      lastCleanRef.current = now;
      setScore(prev => prev + 100 * (1 + newStreak * 0.5));
    }

    setCleanCount(newCleanCount);

    if (newCleanCount === teethRef.current.length) {
      // Bonus points for time remaining
      const timeBonus = timeLeft * 50;
      setScore(prev => prev + timeBonus);
      playWinSound();
      setGameState('won');
    }
  }, [gameState, checkBrushOverlap, createParticle, imageToScreen, streak, timeLeft, playDing, playWinSound]);

  // Pointer handlers
  const getPointerPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Use display coordinates (not canvas internal coordinates)
    // since we're rendering in display space
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const pos = getPointerPos(e);
    isBrushingRef.current = true;
    brushPosRef.current = pos;
    handleBrushing(pos.x, pos.y);
  }, [gameState, getPointerPos, handleBrushing]);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    if (!isBrushingRef.current) return;
    const pos = getPointerPos(e);
    handleBrushing(pos.x, pos.y);
  }, [getPointerPos, handleBrushing]);

  const handlePointerUp = useCallback(() => {
    isBrushingRef.current = false;
    brushPosRef.current = null;
  }, []);

  // Draw stains on a tooth (fades as progress increases), clipped to tooth boundary
  const drawStains = useCallback((ctx, tooth) => {
    if (!tooth.stains || tooth.progress >= 1) return;

    const screen = imageToScreen(tooth.x, tooth.y);
    const scaleX = scaleRef.current.x;
    const scaleY = scaleRef.current.y;
    const screenRadius = tooth.r * scaleX;
    const stainOpacity = 1 - tooth.progress; // Stains fade as tooth is cleaned

    // Clip all stains to the tooth circle so nothing bleeds outside
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenRadius * 1.1, 0, Math.PI * 2);
    ctx.clip();

    tooth.stains.forEach(stain => {
      const sx = screen.x + stain.offsetX * scaleX;
      const sy = screen.y + stain.offsetY * scaleY;
      const size = stain.size * scaleX;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(stain.rotation);
      ctx.scale(stain.scaleX, stain.scaleY);

      // Draw irregular stain blob
      const { r, g, b } = stain.color;
      const alpha = stain.opacity * stainOpacity;

      // Main stain body with soft edge gradient
      const stainGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      stainGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      stainGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`);
      stainGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fillStyle = stainGrad;
      ctx.fill();

      // Inner darker core for depth
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4);
      coreGrad.addColorStop(0, `rgba(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 20)}, ${alpha * 0.5})`);
      coreGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      ctx.restore();
    });

    ctx.restore(); // Remove clip
  }, [imageToScreen]);

  // Draw dirty overlay tint on uncleaned teeth
  const drawDirtyOverlay = useCallback((ctx, tooth) => {
    if (tooth.progress >= 1) return;

    const screen = imageToScreen(tooth.x, tooth.y);
    const screenRadius = tooth.r * scaleRef.current.x;
    const dirtyAmount = 1 - tooth.progress;

    // Yellowish tint overlay that fades as tooth gets cleaner, kept within tooth bounds
    const overlay = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, screenRadius
    );
    overlay.addColorStop(0, `rgba(180, 160, 80, ${dirtyAmount * 0.25})`);
    overlay.addColorStop(0.7, `rgba(160, 140, 70, ${dirtyAmount * 0.15})`);
    overlay.addColorStop(1, `rgba(140, 120, 60, 0)`);

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
    ctx.fillStyle = overlay;
    ctx.fill();
  }, [imageToScreen]);

  // Draw tooth with stains and whitening glow effect
  const drawTooth = useCallback((ctx, tooth) => {
    const screen = imageToScreen(tooth.x, tooth.y);
    const screenRadius = tooth.r * scaleRef.current.x;

    // Draw stains first (below other effects)
    drawStains(ctx, tooth);

    // Draw dirty overlay tint on uncleaned teeth
    if (tooth.progress > 0 && tooth.progress < 1) {
      drawDirtyOverlay(ctx, tooth);
    } else if (tooth.progress <= 0) {
      // Fully dirty tooth - just show stains and a slight tint
      drawDirtyOverlay(ctx, tooth);
      return; // No clean effects to draw
    }

    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, screenRadius * 1.8
    );

    if (tooth.progress >= 1) {
      // Clean tooth - bright white with blue glow (minty fresh look)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(200, 240, 255, 0.7)');
      gradient.addColorStop(0.7, 'rgba(0, 163, 224, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 122, 194, 0)');

      // Animated sparkle ring for clean teeth
      const time = Date.now() / 150;
      for (let i = 0; i < 6; i++) {
        const angle = time + (i * Math.PI / 3);
        const distance = screenRadius * (0.6 + Math.sin(time * 2 + i) * 0.2);
        const sparkleX = screen.x + Math.cos(angle) * distance;
        const sparkleY = screen.y + Math.sin(angle) * distance;
        const sparkleSize = 2 + Math.sin(time * 3 + i) * 1;

        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + Math.sin(time + i) * 0.3})`;
        ctx.fill();
      }

      // Center star burst
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(time * 0.5);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -screenRadius * 0.3);
        ctx.lineTo(2, 0);
        ctx.lineTo(0, screenRadius * 0.3);
        ctx.lineTo(-2, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Partially cleaned - whitening transition effect
      const alpha = tooth.progress * 0.8;

      // Whitening glow that increases with progress
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`);
      gradient.addColorStop(0.3, `rgba(220, 240, 255, ${alpha * 0.4})`);
      gradient.addColorStop(0.6, `rgba(0, 163, 224, ${alpha * 0.2})`);
      gradient.addColorStop(1, 'rgba(200, 240, 255, 0)');

      // Progress ring
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, screenRadius * 1.3, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * tooth.progress), false);
      ctx.strokeStyle = COLORS.accentLight;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenRadius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [imageToScreen, drawStains, drawDirtyOverlay]);

  // Draw Colgate-themed brush cursor
  const drawBrush = useCallback((ctx) => {
    if (!brushPosRef.current || !isBrushingRef.current) return;

    const { x, y } = brushPosRef.current;
    const radius = brushRadiusRef.current;
    const time = Date.now() / 100;

    // Outer pulsing ring
    const pulseRadius = radius * (1.1 + Math.sin(time) * 0.1);
    ctx.beginPath();
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(226, 5, 20, ${0.3 + Math.sin(time) * 0.1})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Main brush area with Colgate red gradient
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(226, 5, 20, 0.4)');
    gradient.addColorStop(0.5, 'rgba(226, 5, 20, 0.2)');
    gradient.addColorStop(1, 'rgba(226, 5, 20, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner white core (toothpaste foam effect)
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
    const innerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.4);
    innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    innerGradient.addColorStop(1, 'rgba(200, 230, 255, 0.3)');
    ctx.fillStyle = innerGradient;
    ctx.fill();

    // Brush ring
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // Draw particles with enhanced effects
  const drawParticles = useCallback((ctx) => {
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;

      if (p.type === 'star') {
        // Draw star shape
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        const size = p.size * p.life;
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const innerAngle = angle + Math.PI / 5;
          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * size, Math.sin(angle) * size);
          } else {
            ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
          }
          ctx.lineTo(Math.cos(innerAngle) * size * 0.4, Math.sin(innerAngle) * size * 0.4);
        }
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.type === 'sparkle') {
        // Diamond sparkle
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const size = p.size * p.life;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.3, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.3, 0);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.type === 'stain') {
        // Stain removal particles - irregular brownish specks
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const size = p.size * p.life;
        ctx.beginPath();
        // Slightly irregular shape
        ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        // Circular particles (foam, clean)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        if (p.type === 'clean') {
          ctx.fillStyle = p.color;
          ctx.shadowColor = COLORS.accentLight;
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = p.color;
        }
        ctx.fill();
      }

      ctx.restore();
    });
  }, []);

  // Draw Colgate-themed shield animation
  const drawShield = useCallback((ctx, progress) => {
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    const displayWidth = container?.clientWidth || canvas.width;
    const displayHeight = container?.clientHeight || canvas.height;
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const maxRadius = Math.max(displayWidth, displayHeight);
    const currentRadius = maxRadius * progress;
    const time = Date.now() / 100;

    // Outer glow ring with Colgate red
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      centerX, centerY, currentRadius * 0.7,
      centerX, centerY, currentRadius
    );
    gradient.addColorStop(0, 'rgba(226, 5, 20, 0)');
    gradient.addColorStop(0.5, `rgba(226, 5, 20, ${0.3 * (1 - progress * 0.5)})`);
    gradient.addColorStop(0.8, `rgba(255, 255, 255, ${0.4 * (1 - progress * 0.5)})`);
    gradient.addColorStop(1, 'rgba(226, 5, 20, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner blue protection ring
    const innerRadius = currentRadius * 0.95;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 122, 194, ${(1 - progress * 0.3) * 0.6})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main Colgate red ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(226, 5, 20, ${(1 - progress * 0.5) * 0.8})`;
    ctx.lineWidth = 8;
    ctx.stroke();

    // Animated sparkles around the ring
    const sparkleCount = 12;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2 + time * 0.05;
      const sparkleX = centerX + Math.cos(angle) * currentRadius;
      const sparkleY = centerY + Math.sin(angle) * currentRadius;
      const sparkleSize = 4 + Math.sin(time + i) * 2;

      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${0.8 * (1 - progress * 0.5)})`;
      ctx.fill();
    }
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const render = () => {
      const container = canvas.parentElement;
      const displayWidth = container?.clientWidth || canvas.width;
      const displayHeight = container?.clientHeight || canvas.height;

      // Save context state and reset transform for clearing
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Clear display area with white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      if (gameState === 'idle') {
        // Idle screen: only show the Colgate background image
        if (bgImageRef.current) {
          const bgImg = bgImageRef.current;
          const bgRatio = bgImg.width / bgImg.height;
          const canvasRatio = displayWidth / displayHeight;
          let bgW, bgH, bgX, bgY;
          if (canvasRatio > bgRatio) {
            bgW = displayWidth;
            bgH = displayWidth / bgRatio;
            bgX = 0;
            bgY = (displayHeight - bgH) / 2;
          } else {
            bgH = displayHeight;
            bgW = displayHeight * bgRatio;
            bgX = (displayWidth - bgW) / 2;
            bgY = 0;
          }
          ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
        }
      } else {
        // Playing / won / lost: show the tooth image and game elements
        if (imageRef.current) {
          calculateScale();
          const s = scaleRef.current;
          ctx.drawImage(imageRef.current, s.offsetX, s.offsetY, s.drawWidth, s.drawHeight);
        }

        teethRef.current.forEach(tooth => drawTooth(ctx, tooth));

        updateParticles();
        drawParticles(ctx);

        if (gameState === 'playing') {
          drawBrush(ctx);
        }

        if (gameState === 'won' && shieldProgress < 1) {
          drawShield(ctx, shieldProgress);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [calculateScale, drawTooth, drawBrush, drawParticles, drawShield, updateParticles, gameState, shieldProgress]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          playLoseSound();
          setGameState('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, playLoseSound]);

  // Shield animation
  useEffect(() => {
    if (gameState !== 'won') return;

    const interval = setInterval(() => {
      setShieldProgress(prev => prev >= 1 ? 1 : prev + 0.02);
    }, 16);

    return () => clearInterval(interval);
  }, [gameState]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = container.clientWidth;
      const displayHeight = container.clientHeight;

      // Set canvas size accounting for device pixel ratio for sharper rendering
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;

      // Scale context to account for DPR
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Update brush radius based on display size
      brushRadiusRef.current = calculateBrushRadius(displayWidth, displayHeight);

      calculateScale();
      updateScreenSize();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [calculateScale, calculateBrushRadius, updateScreenSize]);

  // Game controls
  const startGame = () => {
    initAudio();
    teethRef.current = INITIAL_TEETH.map(t => ({ ...t, progress: 0, stains: generateStains(t) }));
    particlesRef.current = [];
    setTimeLeft(GAME_DURATION);
    setCleanCount(0);
    setShieldProgress(0);
    setScore(0);
    setStreak(0);
    lastCleanRef.current = 0;
    setGameState('playing');
  };

  const resetGame = () => {
    teethRef.current = INITIAL_TEETH.map(t => ({ ...t, progress: 0, stains: generateStains(t) }));
    particlesRef.current = [];
    setTimeLeft(GAME_DURATION);
    setCleanCount(0);
    setShieldProgress(0);
    setScore(0);
    setStreak(0);
    lastCleanRef.current = 0;
    setGameState('idle');
  };

  const styles = getResponsiveStyles(screenSize);
  const progressPercent = (cleanCount / totalTeeth) * 100;

  return (
    <div style={styles.container}>
      {/* Header - hidden on start screen */}
      {gameState !== 'idle' && (
        <div style={styles.header}>
          <div style={styles.logoSection}>
            <h1 style={styles.title}>
              <span style={styles.logoText}>Colgate</span>
              <span style={styles.logoSubtext}>Brush Challenge</span>
            </h1>
          </div>
          {gameState === 'playing' && (
            <div style={styles.statsContainer}>
              <div style={styles.scoreBox}>
                <span style={styles.scoreLabel}>SCORE</span>
                <span style={styles.scoreValue}>{Math.floor(score)}</span>
              </div>
              <div style={styles.timerBox}>
                <span style={styles.timerValue}>{timeLeft}</span>
                <span style={styles.timerLabel}>SEC</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {gameState === 'playing' && (
        <div style={styles.progressBarContainer}>
          <div style={styles.progressBarBg}>
            <div style={{...styles.progressBarFill, width: `${progressPercent}%`}} />
          </div>
          <span style={styles.progressText}>{cleanCount}/{totalTeeth} Teeth Clean</span>
          {streak >= 2 && (
            <span style={styles.streakBadge}>🔥 x{streak}</span>
          )}
        </div>
      )}

      {/* Perfect Combo Popup */}
      {showPerfect && (
        <div style={styles.perfectPopup}>
          ⭐ PERFECT COMBO! ⭐
        </div>
      )}

      {/* Game Canvas */}
      <div style={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />

        {/* Start Screen */}
        {gameState === 'idle' && (
          <div style={styles.overlay}>
            <div style={styles.messageBox}>
              <div style={styles.colgateLogo}>Colgate</div>
              <h2 style={styles.messageTitle}>Brush Challenge</h2>
              <p style={styles.messageText}>
                Clean all {totalTeeth} teeth before time runs out!
              </p>
              <div style={styles.instructions}>
                <div style={styles.instructionItem}>Brush each tooth until it sparkles</div>
                <div style={styles.instructionItem}> Clean quickly for combo bonuses</div>
                <div style={styles.instructionItem}>Beat the clock to win!</div>
              </div>
              <button style={styles.button} onClick={startGame}>
                Start Brushing!
              </button>
            </div>
          </div>
        )}

        {/* Win Screen */}
        {gameState === 'won' && shieldProgress >= 1 && (
          <div style={styles.overlayDimmed}>
            <div style={styles.messageBox}>
              <div style={styles.winBadge}>🏆</div>
              <h2 style={styles.winTitle}>Cavity Protection Activated!</h2>
              <p style={styles.messageText}>All teeth are sparkling clean!</p>
              <div style={styles.finalScore}>
                <span style={styles.finalScoreLabel}>Final Score</span>
                <span style={styles.finalScoreValue}>{Math.floor(score)}</span>
              </div>
              <div style={styles.statsRow}>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{timeLeft}s</span>
                  <span style={styles.statLabel}>Time Left</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{totalTeeth}</span>
                  <span style={styles.statLabel}>Teeth Cleaned</span>
                </div>
              </div>
              <button style={styles.button} onClick={resetGame}>
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Lose Screen */}
        {gameState === 'lost' && (
          <div style={styles.overlayDimmed}>
            <div style={styles.messageBox}>
              <div style={styles.loseBadge}>⏰</div>
              <h2 style={styles.loseTitle}>Time&apos;s Up!</h2>
              <p style={styles.messageText}>
                You cleaned {cleanCount} of {totalTeeth} teeth
              </p>
              <div style={styles.finalScore}>
                <span style={styles.finalScoreLabel}>Score</span>
                <span style={styles.finalScoreValue}>{Math.floor(score)}</span>
              </div>
              <p style={styles.encourageText}>Keep brushing for better protection!</p>
              <button style={styles.button} onClick={resetGame}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate Colgate-themed responsive styles
const getResponsiveStyles = (screenSize) => {
  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';

  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      minHeight: '100vh',
      maxHeight: '100dvh',
      backgroundColor: COLORS.white,
      color: COLORS.darkGray,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      overflow: 'hidden',
    },
    header: {
      padding: isMobile ? '12px 16px' : isTablet ? '14px 20px' : '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
      flexShrink: 0,
      minHeight: isMobile ? '70px' : isTablet ? '65px' : '70px',
      boxShadow: '0 4px 20px rgba(226, 5, 20, 0.3)',
    },
    logoSection: {
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    logoText: {
      fontSize: isMobile ? '1.6rem' : isTablet ? '1.8rem' : '2rem',
      fontWeight: '800',
      color: COLORS.white,
      textTransform: 'uppercase',
      letterSpacing: '2px',
      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
    },
    logoSubtext: {
      fontSize: isMobile ? '0.7rem' : isTablet ? '0.8rem' : '0.85rem',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
      textTransform: 'uppercase',
      letterSpacing: '3px',
    },
    statsContainer: {
      display: 'flex',
      gap: isMobile ? '12px' : '16px',
      alignItems: 'center',
    },
    scoreBox: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      padding: isMobile ? '6px 12px' : '8px 16px',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)',
    },
    scoreLabel: {
      fontSize: isMobile ? '0.6rem' : '0.7rem',
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
      letterSpacing: '1px',
    },
    scoreValue: {
      fontSize: isMobile ? '1.2rem' : '1.4rem',
      fontWeight: '800',
      color: COLORS.white,
    },
    timerBox: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      padding: isMobile ? '6px 14px' : '8px 18px',
      borderRadius: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    },
    timerValue: {
      fontSize: isMobile ? '1.4rem' : '1.6rem',
      fontWeight: '800',
      color: COLORS.primary,
    },
    timerLabel: {
      fontSize: isMobile ? '0.55rem' : '0.65rem',
      color: COLORS.gray,
      fontWeight: '600',
      letterSpacing: '1px',
    },
    progressBarContainer: {
      padding: isMobile ? '10px 16px' : '12px 24px',
      backgroundColor: COLORS.offWhite,
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '12px' : '16px',
      borderBottom: `1px solid ${COLORS.offWhite}`,
      flexShrink: 0,
    },
    progressBarBg: {
      flex: 1,
      height: isMobile ? '12px' : '14px',
      backgroundColor: '#E0E0E0',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
    },
    progressBarFill: {
      height: '100%',
      background: `linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%)`,
      borderRadius: '10px',
      transition: 'width 0.3s ease-out',
      boxShadow: '0 0 10px rgba(0, 122, 194, 0.5)',
    },
    progressText: {
      fontSize: isMobile ? '0.85rem' : '0.95rem',
      fontWeight: '600',
      color: COLORS.darkGray,
      whiteSpace: 'nowrap',
    },
    streakBadge: {
      fontSize: isMobile ? '0.9rem' : '1rem',
      fontWeight: '700',
      color: COLORS.primary,
      backgroundColor: '#FFF3CD',
      padding: '4px 10px',
      borderRadius: '20px',
      animation: 'pulse 0.5s ease-in-out infinite alternate',
    },
    perfectPopup: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: isMobile ? '1.5rem' : '2rem',
      fontWeight: '800',
      color: COLORS.gold,
      textShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(226, 5, 20, 0.4), 2px 2px 4px rgba(0,0,0,0.5)',
      zIndex: 100,
      animation: 'popIn 0.3s ease-out',
      pointerEvents: 'none',
    },
    canvasContainer: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 0,
      backgroundColor: '#FFFFFF',
    },
    canvas: {
      width: '100%',
      height: '100%',
      display: 'block',
      touchAction: 'none',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: isMobile ? '20px' : '24px',
    },
    overlayDimmed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      padding: isMobile ? '20px' : '24px',
      backdropFilter: 'blur(4px)',
    },
    messageBox: {
      textAlign: 'center',
      padding: isMobile ? '32px 24px' : isTablet ? '40px 36px' : '48px 48px',
      background: `linear-gradient(180deg, ${COLORS.white} 0%, ${COLORS.offWhite} 100%)`,
      borderRadius: isMobile ? '24px' : '28px',
      border: `4px solid ${COLORS.primary}`,
      maxWidth: isMobile ? '95%' : isTablet ? '85%' : '480px',
      width: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 20px 60px rgba(226, 5, 20, 0.2), 0 8px 32px rgba(0,0,0,0.15)',
    },
    colgateLogo: {
      fontSize: isMobile ? '2.5rem' : '3rem',
      fontWeight: '800',
      color: COLORS.primary,
      textTransform: 'uppercase',
      letterSpacing: '3px',
      marginBottom: '8px',
      textShadow: '2px 2px 0 rgba(226, 5, 20, 0.2)',
    },
    messageTitle: {
      margin: '0 0 16px 0',
      fontSize: isMobile ? '1.6rem' : isTablet ? '1.8rem' : '2rem',
      fontWeight: '700',
      color: COLORS.darkGray,
    },
    winBadge: {
      fontSize: isMobile ? '4rem' : '5rem',
      marginBottom: '16px',
    },
    loseBadge: {
      fontSize: isMobile ? '4rem' : '5rem',
      marginBottom: '16px',
    },
    winTitle: {
      margin: '0 0 16px 0',
      fontSize: isMobile ? '1.5rem' : isTablet ? '1.7rem' : '1.9rem',
      fontWeight: '700',
      color: COLORS.accent,
    },
    loseTitle: {
      margin: '0 0 16px 0',
      fontSize: isMobile ? '1.6rem' : isTablet ? '1.8rem' : '2rem',
      fontWeight: '700',
      color: COLORS.primary,
    },
    messageText: {
      margin: '0 0 20px 0',
      fontSize: isMobile ? '1.1rem' : isTablet ? '1.15rem' : '1.2rem',
      color: COLORS.gray,
      lineHeight: 1.5,
    },
    instructions: {
      margin: '20px 0',
      padding: '16px',
      backgroundColor: 'rgba(0, 122, 194, 0.08)',
      borderRadius: '16px',
      border: `1px solid rgba(0, 122, 194, 0.2)`,
    },
    instructionItem: {
      fontSize: isMobile ? '0.95rem' : '1rem',
      color: COLORS.darkGray,
      padding: '8px 0',
      borderBottom: '1px solid rgba(0, 122, 194, 0.1)',
    },
    finalScore: {
      margin: '24px 0',
      padding: '20px',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    finalScoreLabel: {
      fontSize: isMobile ? '0.8rem' : '0.9rem',
      color: 'rgba(255,255,255,0.8)',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      fontWeight: '600',
    },
    finalScoreValue: {
      fontSize: isMobile ? '2.5rem' : '3rem',
      fontWeight: '800',
      color: COLORS.white,
      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
    },
    statsRow: {
      display: 'flex',
      justifyContent: 'center',
      gap: isMobile ? '24px' : '40px',
      marginBottom: '20px',
    },
    statItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    },
    statValue: {
      fontSize: isMobile ? '1.5rem' : '1.8rem',
      fontWeight: '700',
      color: COLORS.accent,
    },
    statLabel: {
      fontSize: isMobile ? '0.75rem' : '0.85rem',
      color: COLORS.gray,
      textTransform: 'uppercase',
      letterSpacing: '1px',
    },
    encourageText: {
      fontSize: isMobile ? '0.95rem' : '1rem',
      color: COLORS.accent,
      fontWeight: '500',
      marginBottom: '8px',
    },
    button: {
      marginTop: '20px',
      padding: isMobile ? '18px 48px' : isTablet ? '16px 44px' : '18px 48px',
      fontSize: isMobile ? '1.2rem' : isTablet ? '1.15rem' : '1.2rem',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
      color: COLORS.white,
      border: 'none',
      borderRadius: '50px',
      cursor: 'pointer',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      minWidth: isMobile ? '200px' : '220px',
      minHeight: isMobile ? '56px' : '52px',
      boxShadow: '0 6px 20px rgba(226, 5, 20, 0.4)',
    },
  };
};
