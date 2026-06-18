# Design QA — Skyline Legion v2

- Source visual truth: Codex thread ImageGen result, **Azure Utopia (Option 1)**.
- Implementation URL: `http://127.0.0.1:4173/`
- Primary viewport: `390 × 844`
- Additional viewports: `320 × 568`, `1200 × 900`
- Evidence:
  - `game/output/playwright/mobile-start-v2.png`
  - `game/output/playwright/mobile-gameplay-v2.png`
  - `game/output/playwright/mobile-boss-v2.png`
  - `game/output/playwright/mobile-victory-v2.png`
  - `game/output/playwright/desktop-start-v2.png`
- Tested states: menu, gate charging, wave combat, pause/resume, muted audio, drone upgrade, Boss combat, victory, replay, local high score.

## Full-view comparison evidence

The revised implementation preserves the selected concept's portrait composition, bright sci-fi island setting, suspended white causeway, cyan energy gates, turquoise ocean, compact HUD and expanding formation. Real-time geometry remains intentionally simpler than the concept render, but the game now maintains clear depth, readable lane choices and a stable player silhouette throughout the complete run.

## Focused comparison evidence

- **Gate area:** panels are now thin and translucent, with per-lane charging bars and readable READY/CHARGING states. Gates no longer cover most of the viewport.
- **Player area:** movement is clamped to the road and large formations remain visible at both edges.
- **Enemy waves:** visible enemy count decreases under fire; surviving enemies cause casualties and are removed immediately after the collision resolves.
- **Boss area:** the Boss appears only near the final encounter, has readable layered armor, attacks the formation and is paired with a live health bar.
- **HUD and overlays:** troop count, combo, sound, pause, upgrades, damage feedback and result information remain readable at 320 px width.

## Findings and patches

- [Fixed P1] Gates previously obscured the playfield and did not visibly charge.
- [Fixed P1] Combat previously resolved as invisible timed subtraction; enemies now visibly disappear under fire.
- [Fixed P1] Large formations could leave the road and clip off-screen.
- [Fixed P1] The Boss appeared too early and rendered as a near-black block.
- [Fixed P1] Final-wave enemies remained visible after their collision resolved.
- [Fixed P1] Victory data could be overwritten by a late frame update.
- [Fixed P2] Win/loss events could fire more than once across adjacent frames.
- [Fixed P2] Paused gameplay allowed the player formation to drift.
- [Fixed P2] The distant ring structure collided visually with the HUD.
- [Fixed P2] External font loading made typography dependent on network access.
- [Fixed P2] Unused post-processing dependencies increased complexity and bundle size.

## Required fidelity surfaces

- Fonts and typography: system display and Chinese UI fallbacks render consistently without external font requests.
- Spacing and layout: verified at 320 × 568, 390 × 844 and 1200 × 900; no essential controls or result content clip.
- Colors and visual tokens: cyan/white player language, green/blue upgrades and orange threats remain consistent.
- Image and asset fidelity: the scene uses coherent real-time 3D materials and geometry; no visual placeholders remain.
- Copy and content: Chinese instructions, feedback, results and accessibility labels were checked in the browser snapshot.

## Functional and performance checks

- Production build: passed.
- Browser console: zero runtime errors.
- Two-second active-play sample: approximately 114 frames per second on the current test environment.
- Pause state: unit count and progression remained unchanged over four seconds.
- Sound toggle: accessible label and state changed correctly.
- Replay: creates a clean new run with reset world state.
- Remaining console warning: upstream Three.js Clock deprecation warning from the current rendering stack; no gameplay impact.

## Follow-up polish

- P3: bespoke character and environment models would improve concept-art fidelity further.
- P3: code splitting can reduce the current Three.js initial JavaScript payload.

final result: passed
