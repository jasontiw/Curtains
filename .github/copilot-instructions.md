# Copilot Instructions

## Commands

```bash
npm run dev          # Dev server on port 5173
npm run build        # Production build
npm run test         # Vitest in watch mode
npm run test:run     # Run tests once
npm run test:coverage  # Coverage report (html in coverage/)
```

Run a single test file:
```bash
npx vitest run tests/unit/windowDetector.test.ts
```

Run tests matching a pattern:
```bash
npx vitest run -t "sortCorners"
```

## Architecture

This is a React + TypeScript curtain visualizer. The user uploads a room photo, marks a window area with 4 draggable points, selects a fabric, and sees a real-time curtain overlay with pleat/breeze/rod/valance effects.

**Data flow:**
```
App.tsx (hardcoded fabric list, state: activeId / photoUrl / points)
  ├── CurtainScene    – 3D animated fabric preview (@react-three/fiber)
  ├── FabricPicker    – Category-grouped fabric selector chips
  ├── UploadStage     – Photo input, 4-point quad editor, OpenCV auto-detect
  └── OverlayPreview  – 2D canvas curtain compositing with all effects
```

**`UploadStage`** manages two drag modes: handle drag (single corner) and polygon drag (whole quad). It preloads OpenCV.js from CDN when a photo is uploaded. Points are normalized 0–1 and propagated up to `App`.

**`OverlayPreview`** does pixel-by-pixel inverse bilinear mapping to warp the fabric texture onto the quadrilateral. It renders the rod, rings, hem, and valance directly onto the canvas via 2D drawing calls. Breeze animation uses `requestAnimationFrame`; a second canvas syncs for fullscreen mode.

**`windowDetector.ts`** loads OpenCV.js dynamically from CDN (singleton, lazy). It uses Canny edge detection → contour finding → quadrilateral approximation, with a Hough line fallback.

## Key Conventions

**`Point` type** — always normalized `{ x: number; y: number }` in 0–1 range. Corner order is always **TL, TR, BR, BL** (indices 0–3).

**`Fabric.translucency`** — higher value = more opaque (0 = invisible, 1 = fully opaque). Applied as alpha in canvas pixel compositing.

**Fabric data** is hardcoded in `App.tsx` — there is no API or store. To add fabrics, add entries to the `fabrics` array and place SVG textures in `public/fabrics/`.

**CSS** — global styles only via `src/styles/theme.css` and `src/styles/responsive.css`. No CSS modules or Tailwind. Design tokens are CSS variables (e.g. `--accent`, `--ink`, `--radius`, `--shadow`).

**UI language** — all visible text is in Spanish.

**Tests live in `tests/unit/`**, not `src/`. Test environment is jsdom. Because many utility functions in `src/` are not exported, the test files **duplicate the function implementations** locally rather than importing them (see `windowDetector.test.ts` which re-implements `sortCorners`). When adding new testable utilities, either export them or follow this duplication pattern.

**Three.js** (`@react-three/fiber`, `@react-three/drei`) is used only in `CurtainScene.tsx`. `useFrame` and other R3F hooks must stay inside a `Canvas` subtree.

**OpenCV.js** is never bundled — it is injected as a `<script>` tag at runtime from `https://docs.opencv.org/4.x/opencv.js`. Access it via `window.cv` after `loadOpenCV()` resolves.
