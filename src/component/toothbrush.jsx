import { useRef, useState, useEffect, useCallback } from 'react';

const GAME_DURATION = 20;
const PROGRESS_RATE = 0.025;
const BASE_BRUSH_RADIUS = 30;
const MIN_BRUSH_RADIUS = 20;
const MAX_BRUSH_RADIUS = 50;

// Colgate Brand Colors
const COLORS = {
  primary: '#E20514',      // Colgate Red
  primaryDark: '#A0181F',  // Ruby Red
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
  const teethRef = useRef([]);
  const particlesRef = useRef([]);
  const brushPosRef = useRef(null);
  const isBrushingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const scaleRef = useRef({ x: 1, y: 1, offsetX: 0, offsetY: 0 });
  const brushRadiusRef = useRef(BASE_BRUSH_RADIUS);

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

  // Initialize teeth
  useEffect(() => {
    teethRef.current = INITIAL_TEETH.map(t => ({ ...t, progress: 0 }));
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

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = '/tooth.jpg';
    img.onload = () => {
      imageRef.current = img;
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
    } else {
      // Foam - white with slight blue tint
      color = `rgba(200, 230, 255, ${0.6 + Math.random() * 0.4})`;
    }

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: Math.random() * 0.03 + 0.02,
      size: type === 'star' ? Math.random() * 8 + 6 : Math.random() * 6 + 3,
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

          // Add sparkles while brushing
          if (Math.random() > 0.6) {
            const screenTooth = imageToScreen(tooth.x, tooth.y);
            particlesRef.current.push(createParticle(screenTooth.x, screenTooth.y, 'sparkle'));
          }

          // Tooth just became clean
          if (!wasClean && tooth.progress >= 1) {
            justCleaned = true;
            const screenTooth = imageToScreen(tooth.x, tooth.y);
            // Burst of particles for clean tooth
            for (let i = 0; i < 8; i++) {
              particlesRef.current.push(createParticle(screenTooth.x, screenTooth.y, 'star'));
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
      setGameState('won');
    }
  }, [gameState, checkBrushOverlap, createParticle, imageToScreen, streak, timeLeft]);

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

  // Draw tooth with Colgate-themed glow effect
  const drawTooth = useCallback((ctx, tooth) => {
    if (tooth.progress <= 0) return;

    const screen = imageToScreen(tooth.x, tooth.y);
    const screenRadius = tooth.r * scaleRef.current.x;

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
      // Partially cleaned - show progress with Colgate blue tint
      const alpha = tooth.progress * 0.8;
      gradient.addColorStop(0, `rgba(0, 163, 224, ${alpha * 0.5})`);
      gradient.addColorStop(0.5, `rgba(200, 240, 255, ${alpha * 0.3})`);
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
  }, [imageToScreen]);

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

    // Inner white protection ring
    const innerRadius = currentRadius * 0.95;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress * 0.3) * 0.8})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main Colgate red ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(226, 5, 20, ${1 - progress * 0.5})`;
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
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress * 0.5)})`;
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

      // Dark gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#1a1a2e');
      bgGradient.addColorStop(0.5, '#16213e');
      bgGradient.addColorStop(1, '#0f0f23');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Clear with display dimensions using gradient
      const displayGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
      displayGradient.addColorStop(0, '#1a1a2e');
      displayGradient.addColorStop(0.5, '#16213e');
      displayGradient.addColorStop(1, '#0f0f23');
      ctx.fillStyle = displayGradient;
      ctx.fillRect(0, 0, displayWidth, displayHeight);

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
          setGameState('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

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
    teethRef.current = INITIAL_TEETH.map(t => ({ ...t, progress: 0 }));
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
    teethRef.current = INITIAL_TEETH.map(t => ({ ...t, progress: 0 }));
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
      {/* Header */}
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
          <div style={styles.overlay}>
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
          <div style={styles.overlay}>
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
      textShadow: '0 0 20px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0,0,0,0.3)',
      zIndex: 100,
      animation: 'popIn 0.3s ease-out',
      pointerEvents: 'none',
    },
    canvasContainer: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 0,
      backgroundColor: '#1a1a2e',
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
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      padding: isMobile ? '20px' : '24px',
      backdropFilter: 'blur(8px)',
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
      boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
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
