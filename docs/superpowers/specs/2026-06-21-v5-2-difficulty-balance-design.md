# Skyline Legion v5.2 Difficulty Balance Design

## Goal

v5.2 will verify and rebalance the full normal run after the v5.1 change that made gate growth follow the rule "one normal bullet hit equals one gate-value increment, heavy cannon hit equals two increments."

The goal is to keep the visible bullet-to-gate feedback satisfying while preventing the full run from becoming a guaranteed oversized-army sweep. A clean run should still feel powerful, but the player should reach the Boss with enough tension that Boss attacks and prior route choices matter.

## Current Context

- Gate templates in `src/gameConfig.js` now all use `shotsPerPoint: 1`.
- Gate max values are `32`, `42`, `52`, and `62`.
- The player starts with `12` troops and can clamp up to `320`.
- Waves currently contain `40`, `58`, `74`, and `90` enemies with speeds `1.9`, `2.2`, `2.5`, and `2.8`.
- Boss health starts at `82`, with aimed projectiles, shockwave losses, forward pressure, and visible hit feedback.
- `design-qa.md` already notes that v5.1 may be intentionally easier and needs full normal-difficulty playtest.

## Recommended Approach

Use an evidence-first, small-parameter balance pass.

First, run a normal full-play smoke test and collect debug snapshots at the key pressure points:

- values displayed when each gate resolves;
- troops after each gate contact;
- enemies cleared and losses per wave;
- troops at Boss entry;
- Boss fight duration, final survivors, combo, score, and win/loss result.

Then adjust only the minimum set of tuning values needed to restore tension:

- gate initial ranges and max values;
- enemy wave count and speed;
- Boss health, advance, projectile cadence, shockwave cadence, or casualty cap.

Do not introduce dynamic difficulty, new mechanics, new art direction, or structural refactors in this pass.

## Alternative Approaches Considered

### Gate-Only Tuning

This is the fastest option and preserves combat systems untouched, but it may only hide the issue if enemy/Boss pressure is too weak after v5.1. It also risks making gates feel less responsive even though gate feedback was the thing v5.1 improved.

### Enemy/Boss-Only Tuning

This keeps the new gate growth untouched, but it could turn later waves into abrupt punishment and make the run feel unfair after the player has already earned a large army.

### Dynamic Difficulty

Dynamic scaling could keep every run in a target difficulty band, but it is too broad for v5.2. It would make QA harder because the player may not know why enemy pressure changed.

## Gameplay Targets

- A good route should usually win, but should not end with a trivially huge survivor count.
- A poor route or missed positive gate should still be recoverable early, but punishing by the final wave.
- Gate values should visibly climb under fire and keep the "one hit means one increment" feeling.
- The Boss should remain visible long enough to use its projectile and shockwave patterns.
- The Boss fight should usually last long enough to create pressure, roughly 15 to 30 seconds in a successful normal run.
- Final survivors on a clean run should land in a satisfying but not absurd range; exact target can be tuned from measured data.

## Implementation Scope

Expected files:

- `src/gameConfig.js` for gate and wave values.
- `src/App.jsx` for Boss timing, health, and debug/QA instrumentation if needed.
- `design-qa.md` for the v5.2 verification record.

Optional, only if needed:

- a small dev-only debug helper that records balance checkpoints to `window.__SKYLINE_DEBUG__`, as long as it stays out of production behavior.

Out of scope:

- authored GLB/FBX model work;
- new player abilities;
- new enemy types;
- large `App.jsx` refactors;
- deployment or single HTML changes unless the touched code affects them.

## Verification Plan

- Run `git diff --check`.
- Run `npm run build`.
- Run local browser verification in a portrait viewport.
- Complete or simulate at least one normal full run.
- Inspect `window.__SKYLINE_DEBUG__` during or after the run for gate, wave, troop, and Boss metrics.
- Confirm the browser console has zero runtime errors, allowing existing upstream Three.js warnings.
- Append a v5.2 section to `design-qa.md` with the measured before/after result and remaining follow-up items.

## Acceptance Criteria

- Build passes.
- A normal run is winnable with clean play.
- Gate growth remains visibly responsive after v5.1.
- The final run does not consistently snowball into an unthreatened oversized-army finish.
- Boss attacks visibly matter before victory.
- No unrelated visual direction, asset pipeline, or deployment behavior changes are introduced.
