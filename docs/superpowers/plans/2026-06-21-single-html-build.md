# Single HTML Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a temporary one-file playable HTML export for sharing Skyline Legion with people who cannot open GitHub Pages.

**Architecture:** Reuse the existing Vite production build, but run it with a `SINGLE_FILE_BUILD=1` environment flag so JavaScript is emitted as one bundle. A Node script then inlines the built CSS, JS, and runtime image assets into `output/SkylineLegion.html`.

**Tech Stack:** Node.js ESM, Vite, React, Three.js.

---

### Task 1: Add single-file build support

**Files:**
- Modify: `vite.config.mjs`
- Modify: `src/App.jsx`
- Modify: `package.json`
- Create: `scripts/build-single.mjs`
- Modify: `README.md`

- [x] **Step 1: Disable manual chunks for single-file builds**

Add a `SINGLE_FILE_BUILD=1` path in `vite.config.mjs`, keeping normal GitHub Pages builds unchanged.

- [x] **Step 2: Make runtime asset helper data-URL safe**

Update `assetUrl()` in `src/App.jsx` so generated data URLs are returned as-is when the single-file build script substitutes image paths.

- [x] **Step 3: Add the single-file build script**

Create `scripts/build-single.mjs` to run Vite, inline CSS/JS, convert asset URLs to base64 data URLs, and write `output/SkylineLegion.html`.

- [x] **Step 4: Add npm command and README instructions**

Expose the export as `npm run build:single` and document how to send/open the generated file.

- [x] **Step 5: Verify**

Run `npm run build:single`, confirm `output/SkylineLegion.html` exists, and smoke test it in a browser.
