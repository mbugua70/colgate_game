# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture

React 19 + Vite 7 tooth brushing game with React Compiler enabled for automatic optimizations.

**Entry flow:** `index.html` → `src/main.jsx` → `src/App.jsx` → `src/component/toothbrush.jsx`

**Key files:**
- `src/component/toothbrush.jsx` - Main game component (ToothBrushGame) with canvas rendering
- `vite.config.js` - Vite config with babel-plugin-react-compiler enabled
- `public/tooth.jpg` - Mouth/teeth image used as game background

## Game Component (ToothBrushGame)

Canvas-based tooth brushing game with:
- **Calibration Mode**: Click teeth to define interactive regions, export/import JSON configurations
- **Gameplay**: Drag/touch to brush teeth, each tooth has cleaning progress (0-1)
- **Win condition**: Clean all teeth within 20 second timer
- **Shield animation**: Plays on completion

**State management:**
- UI state in `useState` (gameState, timeLeft, calibrationMode)
- Render state in `useRef` (teeth, particles, brush position)
- `requestAnimationFrame` loop for smooth 60fps rendering

**Coordinate system:**
- Teeth stored in image coordinates
- `screenToImage`/`imageToScreen` functions handle canvas scaling
- Canvas maintains image aspect ratio with letterboxing
