# Design QA — Skyline Legion v4

- Source visual truth: Codex thread ImageGen result, **Azure Utopia (Option 1)**.
- Implementation URL: `http://127.0.0.1:4180/`
- Primary viewport: `390 × 844`
- Additional viewports: `320 × 568`, `1200 × 900`
- Evidence:
  - `output/playwright/mobile-start-v2.png`
  - `output/playwright/mobile-gameplay-v2.png`
  - `output/playwright/mobile-boss-v2.png`
  - `output/playwright/mobile-victory-v2.png`
  - `output/playwright/desktop-start-v2.png`
  - `output/playwright/v3-gate-before-contact.png`
  - `output/playwright/v3-gate-after-contact.png`
  - `output/playwright/v3-precise-enemy-hits.png`
  - `output/playwright/v3-victory.png`
- Tested states: menu, gate charging, wave combat, pause/resume, muted audio, drone upgrade, Boss combat, victory, replay, local high score.

## v5.8 exposed shooters, real gate bullets and enemy cluster physics verification

- Source feedback: user requested hiding the dev panel from normal play, replacing all-soldier visual fire with real outer/front shooters, making gates grow by exactly one per real bullet, and giving enemy troops physical clustering like the player formation.
- Implementation URL: `http://127.0.0.1:4180/`
- Automated verification screenshot: `output/playwright/v5.8-autopilot.png`.

### Findings and patches

- [Fixed P1] v5.7 made every visible soldier fire weak visual bullets, which felt fake. Volley selection now only chooses unblocked outer/front soldiers; every spawned normal bullet is real `power: 1`.
- [Fixed P1] Gate charge still used fractional power and `shotsPerPoint`. A normal bullet now increases the hit side by exactly `+1`; heavy cannon shells count as heavier special shots.
- [Fixed P1] Enemy units could visually stack because they tracked targets individually without pair separation. Enemy waves now spawn around a circular home cluster, keep local velocity, separate against nearby enemies, and move as a group center.
- [Fixed P2] The dev panel is hidden during normal play. `window.__SKYLINE_DEBUG__` still exposes seed, gates, bullet stats, exposed shooter count and enemy spacing for debugging; the panel only appears with `?flags=devPanel`.
- [Fixed P2] Enemy HP was reduced to match the new separated cluster read, so a visible enemy is less likely to feel like several overlapped enemies pretending to be one target.

### Verification

- Logic tests: `node --test tests/combatLogic.test.mjs` passed `9/9`.
- Production build: passed. Vite still reports the existing large vendor chunk warning.
- Browser run: dev panel count stayed `0` in menu and gameplay without `devPanel`; debug state remained available.
- Browser run: all sampled bullets were real (`visual: 0`), later waves kept enemy spacing around `0.38`, and the full auto-pilot run completed with Boss duration `10.25s`.
- Observed balance note: with true `+1` gate bullets, later positive gates can climb high (`+74`, `+115` in the sample seed), so the next tuning pass should adjust shooter cadence and/or gate starting values.

### Follow-up polish

- P1: retune gate starting values and shooter cadence around the new true-bullet economy.
- P2: add an explicit debug toggle in a settings modal only if manual QA needs it; for now URL flag access is enough.
- P2: tune enemy cluster radius per wave so early waves are looser and late waves feel denser without overlapping.

## v5.7 projectile density, physical collision, debug panel and player AoE verification

- Source feedback: user reported that projectile lanes felt fake and too sparse, restart runs could pass later gates and then bullets would appear to miss enemies/gates, requested a live tuning panel, and asked for player aircraft shells to use AoE damage.
- Implementation URL: `http://127.0.0.1:4180/`
- Automated verification screenshot: `output/playwright/v5.7-autopilot.png`.

### Findings and patches

- [Fixed P1] Normal volleys capped visible shooters to a small lane sample. Every visible ready soldier now emits a projectile, while each bullet carries a `power` value so weak visual rounds do not explode combat math.
- [Fixed P1] Bullet collision was gated by spawn-time `phase/regionIndex`. If an old wave had stragglers, later gates/enemies could look like they were being ignored. Collision now checks physical swept intersections against unresolved gates, unlocked enemies and Boss, independent of stale phase tags.
- [Fixed P1] Combat stage selection used the oldest uncleared wave, so aim/debug state could stick to an old region. Stage selection now follows the current/highest active region and reports Boss after `TRACK_END`.
- [Fixed P2] Player heavy cannon splash was a small nearby-enemy special case. It now uses a radius query similar to Boss shell damage and records `player-heavy-splash` telemetry.
- [Fixed P2] Added a dev-only live panel with status, seed, stage, distance, troop count, visible units, shooter count, bullet power buckets, gate values, wave counts, Boss HP/duration and last hit.

### Verification

- Logic tests: `node --test tests/combatLogic.test.mjs` passed `6/6`.
- Production build: passed. Vite still reports the existing large vendor chunk warning.
- Restart/later-area browser regression: passed. After pause/restart and fourth gate, debug showed `wave #4`, `128` shooters and `449` active bullets, with enemy hits still updating.
- Complete auto-pilot run: passed with `MISSION COMPLETE`, Boss duration `7.52s`, Boss start troops `66`, final troops `50`, and no browser runtime errors.
- Player heavy splash telemetry: recorded `14` splash events in the full run.

### Follow-up polish

- P2: tune gate charge rates after hands-on play, because the new visual-fire system makes the game feel much better but will shift preferred door values.
- P2: add a small warning/reticle improvement for both player heavy shell splash and Boss shell splash so AoE reads more clearly.
- P3: consider making the dev panel collapsible if it gets in the way during longer manual tuning sessions.

## v5.6 restart, first-run gates, softer values and Boss pacing verification

- Source feedback: user requested first-run gate side randomization, softer second-area values, Boss targeting the nearest/front troop, smaller Boss AoE, and a reliable pause/restart flow.
- Implementation URL: `http://127.0.0.1:4180/`
- Automated verification screenshot: `output/playwright/v5.6-autopilot.png`.

### Findings and patches

- [Fixed P1] First play used the default run seed, so the first blue/reward gate side felt fixed until restart. Starting a run now generates a fresh seed every time, including from the menu.
- [Fixed P1] Pause -> continue -> restart could leave validation paths looking stale. Start now clears the intro timer, remounts the world with a fresh seed, and debug telemetry exposes `status` and `runSeed`.
- [Fixed P1] Boss projectiles were targeting the rear of the troop cluster. Target selection now sorts by the lower troop `z`, which is nearest to the Boss/front line in the current coordinate system.
- [Fixed P2] Second-region values were too extreme for the requested pacing. Gate templates now start around `-9..-5 / +12..+18`, with later values reduced and the final pair allowed to be red/red.
- [Fixed P2] Boss still took too long after the AoE change. Boss health is now `60`, projectile radius is about `0.59..0.68`, and the final wave was reduced to `96` enemies so the run can reach a short final encounter.

### Verification

- Production build: passed. Vite still reports the existing large vendor chunk warning.
- Pause/restart regression: passed. First run seed `4125277`, restart seed `7408806`; gate layout changed, first gate resolved after restart, and enemy hits resumed after restart.
- Complete auto-pilot run: passed with `MISSION COMPLETE`, Boss duration `10.18s`, Boss start troops `42`, final troops `10`.
- Boss projectile telemetry: passed. Five Boss volleys recorded `targetSource: front-troop`, target `z` around `1.96..2.40`, and AoE losses of `3..5` troops per shell.
- Browser runtime errors: none. Remaining console warning is the existing Three.js `Clock` deprecation warning.

### Follow-up polish

- P2: add player-readable danger telegraphs that make dodging Boss shells feel intentional instead of purely punitive.
- P2: tune enemy cleanup around the Boss threshold, because a clean run can enter Boss while a few late-wave enemies remain alive.
- P3: expose a simple in-game balance overlay for seeds, gate values and Boss duration so future tuning can be faster.

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
- Implementation evidence: `.playwright-cli/page-2026-06-19T12-19-19-479Z.png`.
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

## v5.3 gate, wave and Boss projectile verification

- Real troop count remains capped at `320`; visible troop rendering increased from `96` to `128` so late gate growth remains visible longer.
- HUD now shows the rendered crowd cap as `128 VIS` when the true troop count exceeds the visible troop cap.
- Gate templates now start the later negative lanes lower: zone 3 uses `[-26, -16]`, and zone 4 uses `[-34, -22]`.
- Enemy wave counts increased to `48/74/104/132`, putting more troop control into regional attrition.
- Boss volley behavior changed from two lateral projectiles per volley to one centered projectile per volley.
- Boss projectile radius now starts around `1.28` and scales upward; final autoPilot run recorded radii `1.31`, `1.36`, `1.41`, `1.46`, `1.51` across the first five Boss shots.
- Full autoPilot verification at `390 × 844` won the run with peak troops `127`, Boss start troops `78`, final troops `57`, combo `×7`, and Boss duration `16.35s`.
- The same run recorded gate gains `+24`, `+31`, `+38`, `+45`, wave losses `79`, Boss projectile losses `0`, and max active Boss projectiles `1`.
- Boss-focused verification recorded three consecutive `boss-fire` events with `projectiles: 1`, radii `1.29`, `1.32`, `1.35`, and max active Boss projectiles `1`.
- Browser verification reported zero runtime errors. Remaining console warnings are the existing Three.js Clock deprecation and shader precision warnings.
- Production build passed; remaining build warning is the existing large vendor chunk warning.
- Evidence screenshot: `F:/Users/Yoru17/Documents/Git项目/SkylineLegion/output/playwright/v5.3-final-autopilot.png`.

## v5.4 core loop, Boss and UI verification

- Start troops changed from `12` to `1`; normal volley count now starts at one lane and scales with troop count.
- Gate values no longer visibly hit the old small cap; gate value cap is raised to `999` as a background safety guard.
- Gate charging now requires the player to lean into the matching side. Standing near center does not freely charge both doors.
- Later wrong-side gates now use heavy negative starts, including ranges `[-78, -48]` and `[-99, -70]`.
- Enemy wave counts are tuned to `40/60/86/112` for the one-troop opening.
- Pause overlay now includes both `继续战斗` and `重新开始`; browser verification confirmed both controls render at `390 × 844`.
- Boss max health is reduced to `98`, and player Boss damage is increased so the encounter ends in roughly 9-10 seconds.
- Boss projectile remains single-shot per volley, but hit resolution removes every troop inside the blast radius instead of capping losses at one or two.
- Final two full autoPilot samples both won. Sample 1: peak troops `234`, Boss start `194`, final troops `6`, Boss duration `9.23s`. Sample 2: peak troops `237`, Boss start `197`, final troops `8`, Boss duration `9.09s`.
- The same samples recorded Boss projectile group hits of `41/48/58/36` and `38/42/56/51`; max single blast loss was `58`.
- Gate verification samples recorded right-route values around `+32`, `+50/+51`, `+76/+77`, and `+94/+95`, while wrong-side values remained negative.
- Browser verification reported zero runtime errors. Remaining console warnings are the existing Three.js Clock deprecation and shader precision warnings.
- Production build passed; remaining build warning is the existing large vendor chunk warning.
- Evidence screenshots: `F:/Users/Yoru17/Documents/Git项目/SkylineLegion/output/playwright/v5.4-final-autopilot.png`, `F:/Users/Yoru17/Documents/Git项目/SkylineLegion/output/playwright/v5.4-pause-restart.png`.

## v5.5 gate blocking and Boss targeting verification

- Removed the v5.4 player-side gate charging restriction. Current-region gates again block bullets based on bullet impact side, so standing center can naturally charge both gates.
- Seeded gate generation no longer fixes red gates on the left and blue gates on the right. Gate sampling across seeds showed rewards on both left and right sides.
- Final gate pair now supports two negative red choices. Verification run resolved the final right gate at `-9` while the left gate remained `-80`.
- Gate sample for seed `1`: gate 1 left `+6` / right `-10`, gate 2 left `-36` / right `+34`, gate 3 left `+53` / right `-76`, final gate left `-85` / right `-37`.
- Boss projectile targeting now records `targetSource: front-troop`; the autoPilot run recorded all five Boss shots targeting front troops.
- Boss projectile radius was reduced from v5.4's roughly `1.5-1.85` range to `0.76-0.93` in the verified run.
- Full autoPilot verification won with peak troops `158`, Boss start troops `90`, final troops `61`, and Boss duration `10.87s`.
- Boss projectile group losses after the radius reduction were `0/2/5/6/7`, with max single blast loss `7`.
- Browser verification reported zero runtime errors. Remaining console warnings are the existing Three.js Clock deprecation and shader precision warnings.
- Production build passed; remaining build warning is the existing large vendor chunk warning.
- Evidence screenshot: `F:/Users/Yoru17/Documents/Git项目/SkylineLegion/output/playwright/v5.5-autopilot.png`.

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
- Generated environment asset: `docs/reference/azure-sky-panorama-v1.jpg`.
- Implementation screenshots:
  - `.playwright-cli/page-2026-06-19T18-25-58-856Z.png` — elevated aircraft, cannon corridor, crowd spacing, shadows and sky.
  - `.playwright-cli/page-2026-06-19T18-20-48-083Z.png` — isolated Boss encounter with health bar and active fire.
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
- [Fixed P2] Character rendering and gameplay state were tightly coupled. `src/entityVisuals.js` now defines the procedural/model adapter contract for later GLB or FBX-derived character replacement.

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

## v4.3 feedback visibility, free crowd and seamless environment verification

- Source visual truth: `C:/Users/Yoru17/AppData/Local/Temp/codex-clipboard-056adeb5-4625-4ab4-af6a-336bbb1b72d4.png`.
- Full-view implementation evidence: `.playwright-cli/page-2026-06-20T03-35-37-152Z.png`.
- Upgrade feedback evidence: `.playwright-cli/page-2026-06-20T03-47-16-039Z.png`.
- Hit/death feedback evidence: `.playwright-cli/page-2026-06-20T03-48-54-682Z.png`.
- Combined comparison evidence: `C:/Users/Yoru17/AppData/Local/Temp/v4-3-comparison.png`.
- Viewport/state: `390 × 844`, active portrait gameplay after the first gate.

### Findings and patches

- [Fixed P1] Per-instance feedback tinting could render as black silhouettes on the current WebGL path. Feedback now uses separate fixed-color instanced layers: gold for upgrades, white for hits and grey for death. Layer scale follows smooth attack/hold/release curves.
- [Fixed P1] The crowd was visibly boxed by hard X/Z clamps. Those clamps were removed. Living units keep Y at ground height while spring attraction and five-pass circle collisions form an organic cluster.
- [Fixed P1] Units still intersected under pressure. The collision radius increased and five solver passes maintain a measured minimum center distance of approximately `0.40`.
- [Fixed P2] Death knockback was too subtle. Player victims now travel more than `3.3` local Z units in the regression sample, and enemy deaths launch backward with stronger vertical and rotational impulses for up to `1.8` seconds.
- [Fixed P1] The opaque ocean plane created a hard lower-frame seam against the panorama. It was removed, allowing the generated cloud-sea image to continue naturally beneath the suspended road.
- [Fixed P2] Side islands recycled as a synchronized group. Eleven islands now wrap independently over a `154`-unit loop; the loop regression recorded at most one island wrapping on any distance step.
- [Fixed P2] Pausing allowed feedback and corpse simulation to continue, making visual inspection inconsistent. Army and enemy render simulations now freeze while paused.

### Verification

- Upgrade capture shows the complete formation in the gold upgrade state without black artifacts.
- Combat capture shows white hit silhouettes transitioning into persistent grey bodies while exact victims are physically launched.
- The crowd simulation has no rectangular boundary; the 80-unit sample naturally occupied approximately X `-2.04..1.96`, Z `1.17..4.81`, with Y fixed at `0`.
- The cloud panorama now fills the lower background without the previous flat turquoise cut.
- Active development sample remained at approximately `120 FPS`.
- Production build passed and the complete production run reached victory with `252` survivors, combo `×9`, and zero browser runtime errors.

### Follow-up polish

- P3: replace the procedural islands with authored environment models that match the panorama's architectural detail.
- P3: external animated soldier models will make the white-to-grey death transition more legible through authored hit and ragdoll poses.

final result: passed

## v5.2 难度平衡验证

- Source feedback: v5.1 后倍增门已经按可见子弹命中成长；本轮检查普通流程是否过易，并只做小范围数值平衡。
- Baseline result: v5.1 autoPilot 基线胜利，4 次右侧过门值为 `+32 / +42 / +52 / +62`，过门后兵力为 `44 / 85 / 137 / 187`，Boss 前 `147` 兵，Boss 战 `5.38` 秒，最终 `123` 兵，wave contact 总损失 `70`，采样 FPS `120`。
- Tuned result: v5.2 autoPilot 胜利，4 次右侧过门值为 `+24 / +31 / +38 / +45`，过门后兵力为 `36 / 66 / 103 / 135`，Boss 前 `95` 兵，Boss 战 `16.27` 秒，最终 `52` 兵，wave contact 总损失 `73`，采样 FPS `120`。

### Findings and patches

- [Fixed P1] v5.1 基线下 Boss 死得太快，自动驾驶好路线只打了 `5.38` 秒 Boss 战。v5.2 将 Boss 内部血量调到 `126`，并把普通/rapid/重炮对 Boss 伤害调为 `0.135 / 0.21 / 1.5`，让 Boss 战延长到目标窗口内。
- [Fixed P1] Boss 血量原本同时承担内部数值和 HUD 百分比。v5.2 拆出 `BOSS_MAX_HEALTH`，HUD 继续显示 `0-100%`，调试日志同时记录 `bossHealth` 百分比和 `bossHp` 内部血量。
- [Fixed P1] 倍增门在 `1 bullet = +1` 后容易顶到过高上限。v5.2 将 4 组门上限从 `32 / 42 / 52 / 62` 收到 `24 / 31 / 38 / 45`，并稍微下压后段门的初始范围。
- [Fixed P2] 敌群压力偏低且自动复测路线不稳定。v5.2 将波次数量/速度调到 `44@2.05 / 66@2.32 / 86@2.62 / 108@2.92`，并新增 dev-only `autoPilot`：接近门时走右侧好路线，非门阶段追踪敌群中心清怪。
- [Fixed P2] 新增 dev-only `balanceLog`，记录 gate、wave-hit、wave-clear、boss-start、won/lost 节点，方便后续不靠肉眼猜数值。

### Verification

- Production build: passed.
- Browser console: zero runtime errors；保留既有 Three.js Clock deprecation 和 shader precision warning。
- AutoPilot full run: final result `won`，Boss 前 `95` 兵，最终 `52` 兵，Boss duration `16.27s`，FPS `120`。
- Gate feedback remained responsive: right gates still reached `+24 / +31 / +38 / +45` under visible fire.
- The run no longer ends as an unthreatened oversized-army sweep; wave contact and Boss pressure reduced the army from `135` after the final gate to `52` at victory.

### Follow-up polish

- P2: 需要真人手感复测，确认自动驾驶平衡在手玩时也公平，尤其是第三、第四波的压迫是否过猛。
- P2: 如果真人走位比 autoPilot 更灵活，后续可把 Boss 战目标收紧到 `18-24` 秒，或微增 Boss projectile 命中压力。
- P3: 后续模型和动画升级可以提升 Boss 威胁感，避免继续单纯堆数值。

final result: passed

## v5.1 gate-hit accounting, v5 camera backdrop and procedural mech kit verification

- Source feedback: user reported gate values barely grew despite many bullets, suspected the gate should count received bullet hits rather than per-shooter cadence; also reported final-region bullets passing through enemies/Boss. User then requested autonomous overnight polish for the new generated background and procedural low-poly character/Boss style.
- Generated background asset: `docs/reference/skyline-backdrop-v3-source.png`; runtime WebP: `src/assets/skyline-backdrop-v3.webp`.
- Generated character reference: `docs/reference/lowpoly-unit-style-v1.png`.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T19-19-11-751Z.png`.
- Boss visual screenshot evidence: `.playwright-cli/page-2026-06-20T19-37-51-855Z.png`.

### Findings and patches

- [Fixed P1] Gate growth was throttled by a `chargePower` cadence layer, so many visible bullets hit gates without changing values. This layer was removed. Gate value growth now belongs to the gate: every normal bullet hit contributes `1`, heavy shots contribute `2`.
- [Fixed P1] Later gate thresholds made the game feel too punishing after the visual-fire change. All gate templates now use `shotsPerPoint: 1`, matching the requested "one bullet equals one increment" test tuning.
- [Fixed P1] Boss collision depended on `bullet.phase === "boss"`, so bullets could visually pass through Boss if the run state was still wave/gate flavored when Boss was active. Boss collision now checks whenever Boss is active and alive.
- [Fixed P2] A new backdrop was generated for the v5.0 camera, with a clearer centered ocean/cloud corridor and horizon alignment for the glass runway. Runtime CSS now uses `skyline-backdrop-v3.webp`.
- [Fixed P2] A low-poly character style board was generated and saved as a reference asset. Friendly troops gained glowing cyan visors and darker boots; enemy troops gained orange visors and chest cores.
- [Fixed P2] Boss readability was improved by moving twin cannons and the main weak-point core to the player-facing side, adding a glowing weak-point ring, and reducing the white-hit lerp so the Boss no longer becomes a white blob under sustained fire.
- [Fixed P3] Debug workflow now supports comma-bundled flags such as `?flags=bossTest,bossPin`, avoiding Windows shell issues with `&`. `bossPin` now locks Boss health and pauses Boss attacks for stable visual QA.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only LF-to-CRLF warnings from Git on touched files.
- Gate accounting debug: no-enemy dev run produced clearly increased gate values (`30/32`, `42/42`, etc.) and recorded Boss hits after the phase-independent collision change.
- Browser console: zero runtime errors in normal gameplay and Boss visual checks; remaining messages are Three.js warnings.
- Visual check: background v3 aligns the central sea/cloud corridor better with the glass runway, normal gameplay remains readable, enemy/friendly squads now read more like stylized chibi mechs, and Boss weak point/twin cannons are visible without washing to white.

### Follow-up polish

- P1: playtest full normal difficulty after the `1 bullet = +1` gate tuning; it is intentionally easier now and may need later max-value/initial-value balancing.
- P2: troop silhouettes are improved but still tiny in dense crowds; next pass can slightly enlarge heads/visors or add a thin dark underlay for mobile readability.
- P2: Boss now reads as a procedural mecha core, but authored animation/model replacement would still be the biggest future fidelity upgrade.

final result: passed

## v5.0 camera perspective pass for runway-horizon alignment

- Source feedback: user compared the new generated backdrop against the live game screenshot and noted the road vanishing point was still too far from the backdrop horizon/sea line.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T15-01-05-467Z.png`.
- Viewport/state: portrait gameplay capture in a non-headed Playwright CLI session against `http://127.0.0.1:4180/`.

### Findings and patches

- [Fixed P1] The gameplay camera's road vanishing point sat too high relative to the generated backdrop's cloud-ocean horizon. The camera pitch was reduced, the camera was moved slightly back/lower, and FOV was narrowed from `49` to `43`.
- [Fixed P2] This preserves a readable TopWar-style lane while making the road edges converge closer to the background's mid-frame sky corridor.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only LF-to-CRLF warnings from Git on touched files.
- Browser console: zero runtime errors in menu and active-game checks; remaining messages are Three.js warnings.
- Visual check: the glass runway now visually points nearer to the backdrop's central cloud/sea corridor instead of terminating too high in the sky.

### Follow-up polish

- P1: generate a new background variant using this v5.0 camera as the fixed target, with the horizon/central corridor explicitly aligned to the new road convergence point.
- P2: after the new background lands, retest gate/enemy readability because the narrower FOV makes foreground aircraft and bullets feel slightly larger.

final result: passed

## v4.9 generated vanishing-point backdrop and procedural low-poly kit verification

- Source feedback: user approved a three-step direction: procedural glass road/environment first, then procedural low-poly soldiers, then procedural low-poly Boss; avoid relying on external models for now.
- Generated project asset: `docs/reference/skyline-backdrop-v2.png`.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T14-41-26-969Z.png`.
- Viewport/state: portrait gameplay capture in a non-headed Playwright CLI session against `http://127.0.0.1:4180/`.

### Findings and patches

- [Fixed P1] The previous background was beautiful but did not reserve a clean gameplay vanishing corridor. A new 9:16 sky-utopia backdrop was generated with a central open cloud corridor and side-weighted towers/islands.
- [Fixed P1] The CSS background now points to `skyline-backdrop-v2.png`, keeping the image as a real project asset instead of an external generated-image cache path.
- [Fixed P2] Player troops looked too much like capsule placeholders. They now use a small procedural low-poly robot kit: angular torso, dodeca head, shoulder bar and longer gun silhouette.
- [Fixed P2] Enemy troops looked like arbitrary geometry. They now use a matching low-poly red assault unit kit with angular body, octa head, shoulder bar and blocky base.
- [Fixed P2] Boss geometry was too box-like. The Boss now has a more intentional modular mecha-core structure with a central low-poly core, forward twin cannons and side armor wings.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only LF-to-CRLF warnings from Git on touched files.
- Browser console: zero runtime errors in menu and active-game checks; remaining messages are Three.js warnings.
- Visual check: the new backdrop aligns better with the central glass-runway corridor, the road remains continuous, and player/enemy silhouettes are more intentionally low-poly.

### Follow-up polish

- P1: review the generated background in real play and decide whether to keep this v2 asset or generate a stricter variant with the horizon/vanishing point a little lower.
- P2: player/enemy low-poly silhouettes may need slightly stronger outline/scale because individual units are still small at gameplay distance.
- P2: capture a clean Boss-only debug shot after improving the internal debug URL flow; the current build passes, but the visual QA screenshot primarily covers normal gameplay.

final result: passed

## v4.8 continuous procedural glass runway verification

- Source feedback: user liked the glass-runway direction but noticed the previous road was built from repeated chunks with visible seams and inconsistent widths; requested a more procedural low-poly asset approach before relying on external models.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T14-30-33-300Z.png`.
- Viewport/state: portrait gameplay capture in a non-headed Playwright CLI session against `http://127.0.0.1:4180/`.

### Findings and patches

- [Fixed P1] Road chunks were visually exposing their construction. The road is now a continuous procedural glass plane instead of repeated box slabs.
- [Fixed P1] Chunk joins and tapering created visible seams and width inconsistencies. Side rails are now long continuous emissive strips; moving detail is limited to intentional lightweight guide markings.
- [Fixed P2] Camera changes were starting to serve the background at the expense of gameplay framing. The gameplay camera was restored to the more stable baseline, leaving vanishing-point alignment to a future background image generated for this camera.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only LF-to-CRLF warnings from Git on touched files.
- Browser console: zero runtime errors in menu and active-game checks; remaining messages are Three.js warnings.
- Visual check: the road no longer shows repeated slab seams, the lane rails are continuous, and the gameplay framing is back to the stable camera baseline.

### Follow-up polish

- P1: generate a new 9:16 background image whose central horizon/sky corridor matches the restored gameplay camera's road vanishing point.
- P2: create a procedural low-poly character kit for player soldiers, enemies and Boss so the asset language feels intentional rather than placeholder-like.

final result: passed

## v4.7 runway perspective and sky corridor verification

- Source feedback: user annotated screenshot requesting the road vanishing point and camera perspective expose more of the beautiful forward sky/background.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T14-06-36-204Z.png`.
- Viewport/state: `405 x 720` portrait gameplay capture in a non-headed Playwright CLI session against `http://127.0.0.1:4180/`.

### Findings and patches

- [Fixed P1] The road was visually behaving like an opaque slab and covering the strongest part of the backdrop. Road panels now use a lighter glass-runway treatment with lower opacity, while cyan rails remain bright enough to preserve the play lane.
- [Fixed P1] The road extended too far into the top of the frame. The visible segment count was reduced and the far segments now fade earlier, creating a clearer sky corridor toward the vanishing point.
- [Fixed P2] Camera perspective was too flat/low for the new fixed backdrop. The camera was raised/backed off slightly and the look target moved farther forward, reducing the sense that the runway is pasted over the whole background.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only LF-to-CRLF warnings from Git on touched files.
- Browser console: zero runtime errors in menu and active-game checks; remaining messages are Three.js warnings.
- Visual check: the central cloud/sky background is now visible through the play corridor, the road reads more like a transparent sci-fi runway, and gates/enemies remain aligned to the lane.

### Follow-up polish

- P2: if gameplay readability drops in busier combat, increase near-road opacity slightly while keeping far-road fade.
- P3: author a dedicated 9:16 background with the road corridor baked into the composition for an even cleaner reference-match.

final result: passed

## v4.6 strict portrait frame, fixed backdrop, projectile scale and sustained fire verification

- Source feedback: latest 9:16 portrait screenshots and notes about background coverage, procedural side props, bullet size, firepower drop and visible Playwright windows.
- Menu screenshot evidence: `.playwright-cli/page-2026-06-20T13-01-46-342Z.png`.
- Active gameplay screenshot evidence: `.playwright-cli/page-2026-06-20T13-04-53-272Z.png`.
- Viewport/state: `405 x 720` portrait viewport in a non-headed Playwright CLI session against `http://127.0.0.1:4180/`.

### Findings and patches

- [Fixed P1] Desktop layout could render as `500 x 950`, which is not a strict 9:16 portrait surface. The game shell now uses an aspect-ratio locked `9 / 16` frame capped by viewport height and width.
- [Fixed P1] The fixed 3D backdrop plane did not cover the frame corners and fought with scene background color. The skyline image is now a CSS background on the shell, while the Three.js renderer clears transparently over it.
- [Fixed P2] Procedural side islands and the floating ring made the fixed-camera backdrop feel inconsistent. Those world props were removed from the active scene so the authored background image owns the environment read.
- [Fixed P2] Player bullets were too large. Projectile glow/core geometry and instance scale were reduced while retaining additive yellow readability.
- [Fixed P2] Firepower dropped during gate-only moments because gate phases reduced volley count and cadence. Visual fire cadence now stays high; only a timed subset of bullets contributes to gate number growth so the gate does not inflate too fast.

### Verification

- Production build: passed.
- `git diff --check`: passed, with only existing LF-to-CRLF warnings from Git on touched files.
- Portrait metric check: `.game-shell` measured `405 x 720`, ratio `0.5625`; CSS background included `skyline-backdrop-v1.jpg`.
- Browser console: zero runtime errors in menu and active-game checks; remaining messages are Three.js warnings.
- Active screenshot check: background fills all corners, sky is visible, side procedural models are gone, bullets are smaller, and gate values no longer spike immediately despite sustained fire.

### Follow-up polish

- P2: full gameplay balance still needs a controlled playthrough with steering because the automated no-input run can lose before the boss.
- P3: if the background feels too soft after this layout fix, replace `skyline-backdrop-v1.jpg` with a higher-resolution authored/generated 9:16 asset.
- P3: corpse fade/knockback can be accelerated further to reduce the perception that dead enemies are blocking shots.

final result: passed

## v4.5 regional projectile logic, fixed backdrop, easier gates and Boss balance verification

- Source visual truth: `C:/Users/Yoru17/AppData/Local/Temp/codex-clipboard-056adeb5-4625-4ab4-af6a-336bbb1b72d4.png`.
- Implementation evidence: `.playwright-cli/page-2026-06-20T12-35-54-578Z.png`.
- Full-run result evidence: `.playwright-cli/page-2026-06-20T12-35-10-617Z.png`.
- Viewport/state: active gameplay and full result state in local browser at `http://127.0.0.1:4175/`.
- Focused region evidence: debug state from `window.__SKYLINE_DEBUG__` after a complete run.

### Findings and patches

- [Fixed P1] During wave combat, bullets could no longer interact with the next gate in the same region. Wave-phase bullets can now hit current-region enemies and the same region's following gate, while still blocking interaction with later regions.
- [Fixed P1] Later-area bullets appeared to miss enemies too often. Normal projectile hit radius and heavy-shot steering were increased so side and rear rows are hit more reliably.
- [Fixed P1] Gate charging was too punishing. Gate thresholds are now region 1 = 1 shot per +1, regions 2/3 = 2 shots per +1, region 4 = 3 shots per +1; heavy cannon counts as 2 shots.
- [Fixed P1] Boss damage made the game effectively unwinnable after the AoE update. Boss health, projectile radius, hit cap, volley cadence and shockwave cadence were tuned so the boss remains threatening but a clean run can win.
- [Fixed P2] The sky-sphere background was too blurry for a fixed camera. A portrait fixed-camera backdrop was generated and added as `docs/reference/skyline-backdrop-v1-source.jpg`; runtime uses `public/assets/skyline-backdrop-v1.webp`; the old panorama remains only as low-strength environment lighting.
- [Fixed P2] Upgrade yellow and projectiles were not bright enough. Upgrade feedback now completes faster and pushes the shader toward a brighter yellow emission-style peak; bullets use larger additive yellow glows.
- [Fixed P2] Death grey read too close to black. Player and enemy death grey colors were lifted to lighter grey values.

### Required fidelity surfaces

- Fonts and typography: no typography regressions observed; HUD and result states remain readable.
- Spacing and layout rhythm: the fixed backdrop preserves a clear central play corridor and keeps high-detail islands to the side thirds.
- Colors and visual tokens: bullets and upgrade feedback are brighter yellow; death feedback is lighter grey; gate colors remain semantic red/blue.
- Image quality and asset fidelity: the fixed portrait backdrop is visibly sharper than the previous equirectangular sky in the fixed camera view. It still does not replace authored 3D environment props, but it better matches the requested TopWar-style fantasy sci-fi setting.
- Copy and content: score, combo, gate values, troop count and result copy remain coherent.

### Verification

- Production build: passed.
- Browser console: zero runtime errors. Remaining messages are React DevTools info, Three.js deprecation warnings and Playwright reload context-lost logs.
- Complete run: passed with `MISSION COMPLETE`, `19` survivors, combo `x9`, score `31,375`.
- Regional bullet logic: complete-run debug showed all four waves cleared and gates charged/resolved in sequence without later-region cross-hits.
- Dead-enemy collision audit: code paths filter `!enemy.alive` in target selection and bullet collision, so killed enemies stop blocking projectile collision immediately; remaining corpse visuals are visual-only.

### Follow-up polish

- P3: upgrade glow may now be slightly too broad visually; if desired, constrain the strongest yellow to newly spawned troops only.
- P3: corpse visuals can be made more transparent or launched farther to reduce the perception that dead units are still blocking bullets.
- P3: replace procedural soldiers/Boss/aircraft with authored GLB assets for a major fidelity step.

final result: passed

## v4.4 shader feedback, gate pacing, Boss AoE and 4K sky verification

- Source visual truth: `C:/Users/Yoru17/AppData/Local/Temp/codex-clipboard-056adeb5-4625-4ab4-af6a-336bbb1b72d4.png`.
- Implementation screenshot: `.playwright-cli/page-2026-06-20T06-09-31-685Z.png`.
- Gate-state screenshot: `.playwright-cli/page-2026-06-20T06-04-00-192Z.png`.
- Full-view comparison evidence: `C:/Users/Yoru17/AppData/Local/Temp/v4-4-comparison.png`.
- Viewport/state: `1280 x 720` desktop capture of the portrait game surface, active gate-combat state.
- Focused region evidence: gate-state capture and debug samples from `window.__SKYLINE_DEBUG__`; no additional crop was needed because the gate, projectile stream, aircraft, crowd and sky are visible in the full-frame capture.

### Findings and patches

- [Fixed P1] Hit/upgrade/death feedback still read as one-frame switching. Player and enemy instanced meshes now use per-instance shader attributes for `feedbackColor`, `feedbackAmount` and `greyAmount`, so visible materials lerp from original color to white/yellow and then to grey over time.
- [Fixed P1] HMR/fast reload could race the feedback attributes on the first frame. Instanced feedback attributes are now initialized in layout effects and guarded before writes; the browser verification run reported zero runtime errors after the fix.
- [Fixed P1] Boss projectile damage was single-target and low-threat. Boss projectiles now telegraph a red impact radius, detonate on the target zone and kill the actual units inside the radius, capped by boss health phase.
- [Fixed P1] Gate values rose too quickly because every troop volley could charge the gate. Gate combat now uses fewer charge bolts, a slower gate-phase fire cadence, per-region `shotsPerPoint`, and later gates begin more negative while opening their charge window earlier.
- [Fixed P2] The sky was blurry/dark or visibly cut by a lower seam. A new generated azure panorama was added as source references plus WebP runtime assets `azure-sky-panorama-v2-4k.webp` and `azure-sky-panorama-v2-2k.webp`; background/environment intensity was tuned to avoid overexposure.
- [Fixed P2] The aircraft/cannon blended into the pale floor. The craft shell and wings now use darker navy/gunmetal surfaces with a gold-emissive cannon muzzle so the weapon silhouette remains readable.

### Required fidelity surfaces

- Fonts and typography: existing HUD and gate display remain legible; no new copy or font mismatch was introduced.
- Spacing and layout rhythm: aircraft, soldier cluster and gate corridor remain separated; the cannon line is visually readable and not fully covered by the cluster in the gate-state capture.
- Colors and visual tokens: projectile/impact charge color remains unified gold, gate semantics remain red/blue, Boss attacks use red danger telegraphing, and death state resolves to grey.
- Image quality and asset fidelity: the new sky better matches the reference's bright floating-island sci-fi backdrop, though procedural soldiers/Boss still remain intentionally lower-fidelity placeholders until external GLB/FBX-derived assets are introduced.
- Copy and content: gate values, troop count, combo, Boss name/health and result states remain coherent.

### Verification

- Production build: passed.
- Browser run: zero runtime errors after the feedback-attribute race fix; remaining logs are Three.js deprecation/shader precision warnings and occasional context-lost messages during repeated Playwright page reloads.
- Normal-speed gate debug sample: first gate resolved at moderate values (`leftValue: 7`, `rightValue: 15`) instead of maxing both sides, confirming the new gate charging throttle.
- Feedback debug sample: dying units showed intermediate material states (`hitIntensity: 0.774`, `greyAmount: 0.226`, sample color `cfdfe7`), confirming smooth white-to-grey interpolation rather than a hard switch.
- Boss isolation capture: boss phase displayed red attack telegraphs and the projectile pool completed without runtime errors.

### Follow-up polish

- P3: Boss model and authored attack animations should be replaced with external assets for a more premium “weapon system” read.
- P3: authored soldier models/animations will make upgrade glow, death grey-out and knockback much more legible than procedural capsule/sphere figures.
- P3: bundle splitting remains useful later because the Three.js chunk is still above Vite's default warning threshold.

final result: passed

