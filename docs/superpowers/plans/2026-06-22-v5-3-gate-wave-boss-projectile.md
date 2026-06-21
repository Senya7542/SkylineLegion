# v5.3 Gate Wave Boss Projectile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune late-game troop control through harsher gate negatives, denser enemy waves, clearer visible troop caps, and single-shot larger Boss projectiles.

**Architecture:** Keep the balance data in `src/gameConfig.js`. Keep Boss projectile spawn behavior and HUD display logic in `src/App.jsx`. Validate with production build plus browser autoPilot telemetry.

**Tech Stack:** React, Vite, Three.js, Playwright/browser autoPilot debug flags.

---

### Task 1: Balance Configuration

**Files:**
- Modify: `src/gameConfig.js`

- [x] Raise `MAX_VISIBLE_TROOPS` from `96` to `128`.
- [x] Make gate negatives deeper in zones 2-4, with the largest penalty in zone 4.
- [x] Increase enemy wave counts, especially waves 3 and 4.
- [x] Run `npm run build`.

### Task 2: Boss Projectile And HUD

**Files:**
- Modify: `src/App.jsx`

- [x] Replace Boss volley twin muzzle loop with one projectile per volley.
- [x] Increase Boss projectile radius from the current small twin-shot radius to a larger single-shot radius.
- [x] Add HUD text that reveals the visible troop cap when true troops exceed the rendered crowd cap.
- [x] Run `npm run build`.

### Task 3: Browser Verification And QA

**Files:**
- Modify: `design-qa.md`

- [x] Start the local preview server.
- [x] Run autoPilot through a full match.
- [x] Record gate gains, losses, Boss start troops, final troops, result, and console errors.
- [x] Add a v5.3 QA note to `design-qa.md`.
- [x] Commit the finished change.
