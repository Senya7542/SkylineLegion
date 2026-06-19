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

## v4.1 aircraft and crowd verification

- Source visual truth: `C:/Users/Yoru17/AppData/Local/Temp/codex-clipboard-056adeb5-4625-4ab4-af6a-336bbb1b72d4.png`.
- Implementation evidence: `game/.playwright-cli/page-2026-06-19T12-19-19-479Z.png`.
- Combined comparison evidence: `C:/Users/Yoru17/AppData/Local/Temp/v4-1-comparison.png`.
- Comparison viewport/state: portrait active gameplay after the first positive gate, with an upgraded player formation and continuous fire.
- Full-view comparison: both compositions now use a visible aircraft as the formation anchor, a surrounding blue player crowd, forward projectile lanes, numeric gates and distant enemy mass. The implementation intentionally keeps the existing low-poly real-time Azure Utopia environment instead of matching the concept render's offline-model detail.
- Focused gameplay comparison: the aircraft now leads and tilts with direct input, troops form a bounded elastic cluster around its forward/side area, and a larger heavy round is visibly distinct from troop volleys while sharing the same gold-white visual language.
- [Fixed P1] The aircraft was decorative and had no combat role. It is now the direct-control anchor, heavy cannon and formation center.
- [Fixed P1] Player troops formed a rigid grid and new units emerged from behind. Units now spawn at the cluster center and separate through spring attraction, pairwise repulsion, damping and X/Z constraints.
- [Fixed P1] Enemy waves could be hit before their region gate resolved. Targeting and collision now require the corresponding gate to unlock the wave.
- [Fixed P2] Player/enemy scale and player readability diverged. Player geometry and emissive white-blue materials were enlarged and brightened.
- [Fixed P2] Instance tinting did not guarantee visible hit flashes. Player and enemy units now use independent unlit overlay instances for white damage flashes and gold upgrade flashes.
- [Fixed P2] Projectile and impact effects mixed gate colors and could render black instance artifacts. All combat projectiles, muzzle flashes, sparks and rings now use a fixed white-core/gold-glow palette.
- [Fixed P2] Audio was a detached repeating timer. Volley, heavy cannon, enemy/gate/Boss impacts and kills now emit rate-limited event-driven sound cues.
- Region verification before first gate contact at distance `24`: all four wave states reported `unlocked: false`, `alerted: false`, and enemy counts remained `36/48/64/80`.
- Crowd bounds with `51` visible troops stayed within approximately X `-1.11..1.15` and Z `1.97..3.42` before the final centering polish; the simulation clamps longitudinal movement to prevent units being ejected.
- Performance remained approximately `109–112 FPS` in the active high-effect development sample.
- Final production run completed with `238` survivors, combo `×5`, and zero browser runtime errors.

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
- P3: a bespoke aircraft model with authored wing silhouette, cockpit, engine nozzles and animation would materially improve the concept-art match.
- P3: code splitting can reduce the current Three.js initial JavaScript payload.

## v4.2 combat feedback, crowd physics and environment verification

- Source visual truth: `C:/Users/Yoru17/AppData/Local/Temp/codex-clipboard-056adeb5-4625-4ab4-af6a-336bbb1b72d4.png`.
- Generated environment asset: `game/public/assets/azure-sky-panorama-v1.jpg`.
- Implementation screenshots:
  - `game/.playwright-cli/page-2026-06-19T18-25-58-856Z.png` — elevated aircraft, cannon corridor, crowd spacing, shadows and sky.
  - `game/.playwright-cli/page-2026-06-19T18-20-48-083Z.png` — isolated Boss encounter with health bar and active fire.
- Combined comparison evidence: `C:/Users/Yoru17/AppData/Local/Temp/v4-2-comparison.png`.
- Comparison viewport: `390 × 844`.
- Comparison state: active portrait gameplay; the simulation was paused and the pause overlay hidden only to capture a stable frame.

### Full-view and focused comparison evidence

- The implementation retains the reference's portrait causeway, aircraft-led formation, two-lane numeric gates, forward projectile stream, enemy mass, sky-island setting and compact upper HUD.
- The aircraft now sits above the crowd while the crowd solver enforces a shaped exclusion zone around its body and cannon line. Soldiers remain clustered around the craft without occupying the barrel corridor.
- New units spawn immediately at the formation center, scale in elastically and push neighboring units outward through iterative circle collisions, spring attraction and damping.
- The generated azure panorama adds real cloud and floating-island image detail behind the real-time scene. Directional shadows and environment reflections restore depth that was absent from the previous flat background.
- The Boss encounter now has a readable health bar, forward pressure, twin aimed projectiles, an expanding shockwave and exact-unit casualty resolution.

### Findings and patches

- [Fixed P1] Soldiers could block and intersect the aircraft cannon. The aircraft was raised and a silhouette-shaped physics exclusion zone now preserves the cannon corridor.
- [Fixed P1] Hit and upgrade feedback could appear black or hard-switch for one frame. Additive overlays now animate smooth intensity curves from the original color into white or gold and back.
- [Fixed P1] Death feedback was inconsistent. Player and enemy units now transition through a white hit flash into a persistent grey death state while receiving physical launch, gravity and spin.
- [Fixed P1] Player casualties could select an unrelated unit. Enemy and Boss contact now resolves the nearest real unit instance and applies death to that exact ID.
- [Fixed P1] New troops appeared late and did not displace the formation. Spawning is immediate at the center and the collision solver visibly expands the cluster.
- [Fixed P1] Projectiles could interact with later regions. Every projectile now carries an explicit region and phase; travel bullets expire quickly and cannot charge future gates or damage locked waves.
- [Fixed P1] The Boss lacked readable attacks and pressure. It now advances, fires twin projectiles and periodically emits a visible shockwave.
- [Fixed P2] The scene lacked a sky image, environmental reflection and readable shadows. A generated equirectangular panorama, shadow-casting key light and receiving surfaces were added.
- [Fixed P2] Character rendering and gameplay state were tightly coupled. `game/src/entityVisuals.js` now defines the procedural/model adapter contract for later GLB or FBX-derived character replacement.

### Required fidelity surfaces

- Fonts and typography: existing condensed system-display treatment remains coherent and readable at 390 px; Boss and gate labels preserve the established hierarchy.
- Spacing and layout rhythm: the HUD, gate pair, aircraft and formation remain separated at the portrait viewport; no essential controls clip or overlap.
- Colors and visual tokens: player cyan, combat gold-white, enemy red-orange, death grey and gate semantic colors are consistent across projectiles, impacts and state feedback.
- Image quality and asset fidelity: the 2048 × 1024 generated panorama is sharp enough for the blurred environment layer and matches the azure floating-island art direction. Procedural characters remain intentionally lower fidelity than the reference render.
- Copy and content: troop count, combo, gate values, Boss name/health and result text remain coherent in Chinese/English mixed presentation.

### Functional and performance checks

- Production build: passed.
- Physics regression: exact target ID matched the requested collision target; formation replacement count, aircraft clearance and world bounds all passed.
- Region regression: later gates and waves remain unchanged until their own region becomes active.
- Full production run: victory reached after 42 seconds with `252` survivors and combo `×9`.
- Browser console: zero runtime errors; only upstream Three.js deprecation/shader precision warnings remain.
- Active development samples remained approximately `112–120 FPS` on the current machine.

### Follow-up polish

- P3: replace procedural soldiers, aircraft and Boss with authored GLB assets and animation clips for a materially closer match to the reference render.
- P3: add authored Boss muzzle, shockwave and death animation clips once the external model sockets are available.
- P3: split the current Three.js bundle to reduce initial JavaScript payload.

final result: passed
