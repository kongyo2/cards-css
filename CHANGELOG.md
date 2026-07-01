# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-07-01

### Fixed

- Activating one card no longer disturbs every other card: active-registry
  notifications are now transition-guarded, so cards that were never active no
  longer run a spurious `retreat()` that reassigned their spring dynamics
  mid-interaction or mid-showcase (and corrupted a running showcase's motion).
- Switching browser tabs no longer visually retreats a card that is still
  active: the popover scale/translate are preserved across `visibilitychange`,
  and only inactive cards are hard-reset.
- A non-interactive card's showcase now animates back to rest instead of
  jumping: the inline render variables are shed only once every spring has
  settled (new `Spring.settled` getter).
- `showcase: null` no longer throws at construction (`typeof null === "object"`
  slipped past the options guard).
- `destroy()` now cancels the pending render frame (it could re-apply inline
  styles to a destroyed element), clears the inline interaction variables and
  `--card-active`, and unsubscribes before releasing the active slot so a
  destroyed card does not react to its own deactivation.
- Pointer interaction guards against a zero-size rotator rect, which previously
  poisoned the springs (and the CSS variables) with `NaN`.
- `pointercancel` is now handled as a safety net for browsers that fail to fire
  the `pointerleave` that the spec mandates after a cancelled touch.
- Losing focus no longer schedules a spurious snap-back on cards that were
  never active.
- Duplicate `setActiveCard` calls with the same card no longer re-notify every
  subscriber.

### Added

- Keyboard accessibility for `activateOnClick`: non-button rotators get
  `role="button"` and respond to <kbd>Enter</kbd> / <kbd>Space</kbd> (Space on
  keyup, per the ARIA button pattern), and the rotator reflects its state via
  `aria-pressed`. Keystrokes from focusable content nested inside the card
  (interactive overlays, links) keep their native behaviour. Everything added
  (role, tabindex, aria-pressed, listeners) is removed again on `destroy()`.
- The showcase auto-animation now respects `prefers-reduced-motion` by default;
  opt out with `showcase: { respectReducedMotion: false }`.
- `textureSeed` now also seeds the cosmos background placement (`--seedx` /
  `--seedy` / `--cosmosbg`), making a seeded card fully deterministic.
- `Spring.settled` — whether the spring is at rest.
- `mulberry32` seeded PRNG is exported from the textures module.
- A `node --test` suite covering the pure modules (math, palette, textures,
  spring, subscribers, active registry, orientation) plus a CI job running it.
- `package.json` is exposed through the package `exports` map for tooling.

### Changed

- Internal refactors: shared timer/interval teardown helpers, a single source
  of truth for the spring list and max-tilt resolution, and assertion-free
  palette cycling. No public behaviour changes beyond the fixes above.

## [0.3.2] - 2026-06-28

### Fixed

- Graceful foil degradation when no `textureSeed` is provided, and a pure-CSS
  hover fallback for non-interactive cards.

## [0.3.1] - 2026-06-28

### Fixed

- Bounded the spring timestep after background-tab pauses and resolved
  superseded `set()` promises at settle via a shared promise.

## [0.3.0] - 2026-06-28

### Added

- Palette theming (`palette`), custom glare (`glare`), gyroscope tuning
  (`gyroscope`) and foil 3D depth (`depth`).

## [0.2.1] - 2026-06-27

### Fixed

- Quote and escape `url()` for foil/mask/layer images.

## [0.2.0] - 2026-06-25

### Added

- Interaction physics (`physics`), visual controls (`visual`), stacked layers
  (`layers`), masks (`mask`) and free-form content options.

## [0.1.1] - 2026-06-23

- First public release: holo / reverse / cosmos / glitter foils, procedural
  textures, pointer + gyroscope tilt, showcase and popover interactions.
