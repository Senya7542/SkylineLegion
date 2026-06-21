# v5.5 Gate Blocking Boss Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore gate bullet blocking, randomize red/blue gate side distribution, and retune Boss projectile targeting/radius.

**Architecture:** Keep gate templates and seeded gate generation in `src/gameConfig.js`; keep projectile collision and Boss targeting in `src/App.jsx`; record verification in `design-qa.md`.

**Tech Stack:** React, Vite, Three.js, Playwright/browser autoPilot debug flags.

---

### Task 1: Gate Blocking And Layout

**Files:**
- Modify: `src/gameConfig.js`
- Modify: `src/App.jsx`

- [x] Remove player-side gating from bullet-to-gate collision.
- [x] Randomize which side receives the positive or less-negative gate value.
- [x] Allow the final gate pair to be double-negative.
- [x] Keep seeded deterministic generation per run.

### Task 2: Boss Projectile Targeting

**Files:**
- Modify: `src/App.jsx`

- [x] Add a helper that finds the front-most active troop.
- [x] Target Boss projectile at that troop's world X/Z position.
- [x] Reduce Boss projectile radius to roughly half of v5.4.
- [x] Keep single-shot volley behavior.

### Task 3: Verification And Docs

**Files:**
- Modify: `design-qa.md`

- [x] Run `npm run build`.
- [x] Run autoPilot verification.
- [x] Run gate seed inspection for mixed side distribution and final double-negative possibility.
- [x] Update QA notes and commit.
