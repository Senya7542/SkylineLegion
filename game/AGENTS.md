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
