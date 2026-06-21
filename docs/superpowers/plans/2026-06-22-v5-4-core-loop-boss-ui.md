# v5.4 Core Loop Boss UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game start from one unit, require real gate movement, shorten Boss time, add group-damage Boss shots, and improve pause/HUD feedback.

**Architecture:** Keep balance constants in `src/gameConfig.js`; keep gameplay loop, pause restart, and Boss damage in `src/App.jsx`; keep visual feedback in `src/styles.css`; record verification in `design-qa.md`.

**Tech Stack:** React, Vite, Three.js, Playwright/browser autoPilot debug flags.

---

### Task 1: Early-Game And Gate Rules

**Files:**
- Modify: `src/gameConfig.js`
- Modify: `src/App.jsx`

- [x] Add a starting troop constant set to `1`.
- [x] Change UI reset and world initialization from `12` troops to the starting troop constant.
- [x] Reduce early volley count so one troop fires one normal shot.
- [x] Raise or hide gate growth caps so gate values do not visibly hit a small maximum.
- [x] Make later negative gate templates reach the `-99 ~ -30` range.
- [x] Restrict gate charging to the side the player is currently choosing.

### Task 2: Pause Restart And UI Feedback

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [x] Add a restart action to the pause overlay.
- [x] Keep the existing continue action.
- [x] Add restrained HUD/button/pause panel motion and polish without changing the whole art direction.

### Task 3: Boss Pace And Group Damage

**Files:**
- Modify: `src/App.jsx`

- [x] Increase player damage against Boss enough to target roughly `8-12s` Boss duration.
- [x] Keep Boss projectile volleys at one projectile per volley.
- [x] Increase Boss projectile radius and remove the old 1-2 victim cap.
- [x] Record Boss projectile hit radius and losses in debug balance telemetry.

### Task 4: Verification And Docs

**Files:**
- Modify: `design-qa.md`

- [x] Run `npm run build`.
- [x] Run full autoPilot verification.
- [x] Run Boss-focused verification for group projectile damage.
- [x] Verify pause overlay has restart.
- [x] Add a v5.4 QA note and commit the finished change.
