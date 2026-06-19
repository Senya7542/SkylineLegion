# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Current visual direction

- Selected concept: "Azure Utopia".
- Preserve the bright premium sci-fi island atmosphere, white suspended causeway, cyan energy gates, turquoise ocean, clean minimal HUD, and strong multiplier feedback.
- Prioritize responsive real-time play and satisfying feedback over pixel-perfect reproduction of concept-art complexity.

## Gameplay feedback requirements

- Player lateral movement must be updated every animation frame with frame-rate-independent damping; never drive visible player/world motion from low-frequency React HUD state.
- Projectiles must use real collision targets. A bullet hitting a specific enemy may only damage and kill that enemy.
- Gate hits need visible impact sparks, flash and elastic squash/stretch. Gate rewards apply only when the formation physically reaches the selected gate.
- Resolved gates must burst/collapse and disappear instead of remaining on the track.
- Enemy deaths should visibly react to the incoming bullet with hit flash, squash and directional knockback/flight.
- A hit on any enemy in a wave alerts the whole surviving wave; alerted enemies advance toward the player and lightly track the formation.
- Normal volleys originate from visible troop gun positions and must cover edge enemies without obvious homing.
- Numeric gates display their live signed value. Bullet hits increase that exact value, negative gates are red, positive gates are blue, and contact applies the displayed number.
- Gate upgrades should add troops through staggered elastic spawning with crowd separation, while the existing formation flashes gold.
- Enemy and boss hit feedback must flash the whole target white and use a clearly visible gold-white projectile and impact burst.
