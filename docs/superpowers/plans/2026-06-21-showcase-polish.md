# Showcase Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the GitHub Pages showcase feel like a polished playable build by hiding raw loading, prewarming the 3D scene, smoothing the start transition, and reducing obvious unused asset weight.

**Architecture:** Keep the React/Vite/Three stack intact. Avoid a broad App.jsx split in this pass; instead add a small boot/start state layer, stabilize the Canvas lifecycle, and route public asset URLs through existing Vite base handling. The 3D world remains mounted on the menu so textures, shader compilation, and instanced meshes warm before the player presses start.

**Tech Stack:** React 19, Vite 6, Three.js, @react-three/fiber, GitHub Pages.

---

### Task 1: Stabilize Canvas lifecycle and add boot/start states

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [x] Add `booting` and `intro` status handling while keeping the existing `menu`, `playing`, `paused`, `won`, and `lost` states.
- [x] Remove `key={runId}` from `<Canvas>` so the WebGL renderer is not destroyed when a run starts.
- [x] Keep the world mounted during menu/boot; only gameplay simulation runs when status is `playing`.
- [x] First start from `menu` should not increment `runId`; restarts from end states may increment `runId`.
- [x] Use a 900ms intro window: `intro` then `playing`.

### Task 2: Add visible loading and first-frame readiness

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [x] Add `LoadingOverlay` component with brand title, short Chinese loading copy, and animated progress bar.
- [x] Add `onReady` callback from `World` to `App`, fired after the first rendered frame and texture-dependent scene has mounted.
- [x] Show loading overlay until ready, with a minimum display time so it does not flicker.
- [x] Fade into the menu once ready.

### Task 3: Add entrance reveal animation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [x] Add an `introProgress` ref in `World` that eases from 0 to 1 while status is `intro`.
- [x] Pass intro progress to visual groups: road, gates, enemies, player rig, bullets/impacts where useful.
- [x] During menu keep the world prewarmed but dimmed behind overlay.
- [x] During intro: plane rises/slides in, road/gates/enemies reveal with opacity/scale, HUD appears slightly after the start.

### Task 4: Remove obvious unused public assets from deployment

**Files:**
- Move: `public/assets/references/lowpoly-unit-style-v1.png` to `docs/reference/lowpoly-unit-style-v1.png`
- Move or delete old unused background candidates after confirming current references.

- [x] Use `rg` to confirm active references to each public asset.
- [x] Keep active runtime assets in `public/assets`.
- [x] Move reference-only art to `docs/reference` so it does not ship in Pages artifacts.
- [x] Remove old unused background candidates if no code/docs need them as runtime assets.

### Task 5: Verify and publish

**Files:**
- Verify all modified files.

- [x] Run `npm run build`.
- [x] Simulate GitHub Pages build with `GITHUB_ACTIONS=true` and `GITHUB_REPOSITORY=Senya7542/SkylineLegion`.
- [x] Run local preview with `/SkylineLegion/` base and use Playwright/Chrome headless to verify root children, canvas count, and no asset 404/pageerror.
- [x] Commit and push.
- [x] Watch GitHub Actions deployment and verify live page.

