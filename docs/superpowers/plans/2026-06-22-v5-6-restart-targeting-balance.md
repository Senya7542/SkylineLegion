# v5.6 Restart Targeting Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix restart/pause state drift, make first-run gate layouts vary, retarget Boss shots to front-most troops near the Boss, and soften gate values.

**Architecture:** Keep balance ranges in `src/gameConfig.js`; keep restart lifecycle and Boss target selection in `src/App.jsx`; record verification in `design-qa.md`.

**Tech Stack:** React, Vite, Three.js, Playwright/browser debug flags.

---

### Task 1: Balance And Gate Seeds

**Files:**
- Modify: `src/gameConfig.js`
- Modify: `src/App.jsx`

- [x] Reduce gate ranges around the requested `-7 / +15` second-region scale.
- [x] Generate a fresh run seed on every start, including first play from menu.
- [x] Keep gate blocking and simultaneous center charging unchanged.

### Task 2: Boss And Restart Bugs

**Files:**
- Modify: `src/App.jsx`

- [x] Change Boss target selection to nearest-to-Boss troop using the lower troop `z` value.
- [x] Record target `z` in `boss-fire` telemetry.
- [x] Harden restart flow by clearing intro timer and remounting World before play resumes.

### Task 3: Verification

**Files:**
- Modify: `design-qa.md`

- [x] Run `npm run build`.
- [x] Verify first start and restart produce varying gates.
- [x] Verify pause/continue/restart still produces gate and enemy hits.
- [x] Verify Boss fire target telemetry.
- [x] Update QA and commit.
