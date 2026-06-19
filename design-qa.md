# Design QA — Skyline Legion v4

- Source visual truth: Codex thread ImageGen result, **Azure Utopia (Option 1)**.
- Implementation URL: `http://127.0.0.1:4180/`
- Primary viewport: `390 × 844`
- Additional viewports: `320 × 568`, `1200 × 900`
- Evidence:
  - `game/output/playwright/mobile-start-v2.png`
  - `game/output/playwright/mobile-gameplay-v2.png`
  - `game/output/playwright/mobile-boss-v2.png`
  - `game/output/playwright/mobile-victory-v2.png`
  - `game/output/playwright/desktop-start-v2.png`
  - `game/output/playwright/v3-gate-before-contact.png`
  - `game/output/playwright/v3-gate-after-contact.png`
  - `game/output/playwright/v3-precise-enemy-hits.png`
  - `game/output/playwright/v3-victory.png`
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
- [Fixed P1] Visible player/world motion was driven by 10 Hz React snapshots, producing stutter despite a high canvas frame rate.
- [Fixed P1] Bullets were decorative and enemy deaths were resolved by aggregate wave damage, so a right-side hit could remove an unrelated soldier.
- [Fixed P1] Gate charge was time/alignment based instead of projectile-hit based, and rewards were granted before the formation visibly crossed the gate.
- [Fixed P1] Resolved gates remained visible instead of bursting and collapsing away.
- [Fixed P2] Hundreds of independent meshes and animation callbacks increased CPU and draw-call cost.

## v3 interaction verification

- All player, road, gate, enemy, projectile and impact positions now update every animation frame; React state is reserved for the HUD.
- Player input uses frame-rate-independent damping and direct pointer coordinates from the canvas bounds.
- Browser instrumentation measured 116–120 FPS in the current test environment.
- A controlled movement test at 120 FPS produced 69 distinct interpolated positions rather than low-frequency jumps.
- Projectiles use swept collision checks and stop on their first target.
- Controlled right-lane test: bullet X `0.718` hit enemy X `0.510`; only that enemy object received damage/death state.
- Enemy deaths apply hit flash, squash and directional knockback/flight based on the impacting bullet.
- Gate test before contact at track distance `29`: troop count `12`, right gate charge `1.0`, `resolved: false`.
- Gate test after physical contact at distance `31`: troop count `30`, `resolved: true`; the chosen `+18` gate collapsed and disappeared.
- Production build completed a full run to the victory screen with zero browser runtime errors.

## v4 gameplay verification

- Numeric gates now expose their actual signed reward. Negative values render red, positive values render cyan, every accepted projectile hit increases the displayed value, and contact applies that exact number.
- Gate layouts are deterministically varied per run while preserving at least one recoverable route in every pair.
- Normal volleys originate from active troop positions across the formation. The outer shooters produce visible edge-lane fire, with only a small lateral correction toward a real enemy target.
- A hit on any member alerts the whole wave. Surviving enemies advance together and lightly track the player's horizontal position while retaining exact per-enemy collision and death state.
- Enemy hit/death feedback now colors body, head and legs white, then applies squash, delayed launch, spin and shrink.
- Added troops use staggered elastic scale-in, spring attraction and local crowd separation instead of appearing as an instant rigid grid.
- Existing troops receive a gold upgrade pulse and expanding formation ring when a positive gate reward is applied.
- Projectiles use a white core, gold glow and longer silhouette. Enemy, gate and Boss impacts include larger sparks and an expanding additive ring.
- Boss armor, core and side pods participate in the white hit flash; Boss damage was rebalanced so the final encounter remains visible under a large upgraded formation.
- Controlled gate test at distance `31`: selected gate resolved at displayed value `+40`, troop count changed from `12` to `52`, and the gate collapsed.
- Controlled combat test measured `115–120 FPS` with `52` rendered troops, multiple active enemy waves and continuous edge-to-edge volleys.
- Full production run completed with `230` survivors, combo `×5`, and zero browser runtime errors.

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
