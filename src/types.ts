import type { SpringOpts } from "./spring.js";

export type HoloEffect = "none" | "holo" | "reverse" | "cosmos" | "glitter";

/**
 * Arbitrary card content: a DOM node, or a factory that builds one from the
 * owning document (handy for SSR / custom-element setups where `document` is
 * only safe to touch lazily).
 */
export type HoloContent = Node | ((doc: Document) => Node);

/** A map of CSS custom properties to apply to an element; numbers are stringified. */
export type CssVars = Record<string, string | number>;

/**
 * Spring tuning for a single motion target. `axes` carries independent,
 * asymmetric dynamics per component (`x` / `y` / `o`).
 */
export type SpringTuning = SpringOpts;

/** Interaction & physics adjustment surface. */
export interface PhysicsOptions {
  /** Tilt in degrees reached at the card edge (default ≈ 14.29). */
  maxTilt?: number;
  /** Independent horizontal tilt; overrides `maxTilt` for the X axis. */
  maxTiltX?: number;
  /** Independent vertical tilt; overrides `maxTilt` for the Y axis. */
  maxTiltY?: number;
  /** Multiplier on the foil/background parallax shift (default 1; 0 disables). */
  parallax?: number;
  /** Multiplier on the glare travel away from centre (default 1). */
  glareRange?: number;
  /** ms to wait after the pointer leaves before the relaxed snap-back (default 500). */
  returnDelay?: number;
  /** Tuning shared by the live pointer springs (rotate / glare / background). */
  interactSpring?: SpringTuning;
  /** Tuning shared by the popover springs (scale / translate / flip). */
  popoverSpring?: SpringTuning;
  /** Tuning for the relaxed snap-back applied when the pointer leaves. */
  snapSpring?: SpringTuning;
  /** Per-target overrides layered on top of the group tuning above. */
  springs?: {
    rotate?: SpringTuning;
    glare?: SpringTuning;
    background?: SpringTuning;
    rotateDelta?: SpringTuning;
    translate?: SpringTuning;
    scale?: SpringTuning;
  };
}

/** Showcase (auto-animation) customisation. `true` keeps the legacy defaults. */
export interface ShowcaseOptions {
  /** ms before the sweep begins (default 2000). */
  delay?: number;
  /** ms the sweep runs before relaxing; ignored when `loop` is set (default 4000). */
  duration?: number;
  /** Keep sweeping until the user interacts instead of running once (default false). */
  loop?: boolean;
  /** Angular step per tick — higher is faster (default 0.05). */
  speed?: number;
  /** Tilt amplitude in degrees (default 25). */
  intensity?: number;
  /** Spring tuning while the showcase runs. */
  spring?: SpringTuning;
}

/** Built-in foil colour schemes for {@link PaletteOptions.preset}. */
export type PalettePreset = "rainbow" | "gold" | "aurora" | "ruby" | "sapphire" | "mono";

/**
 * Foil colour-palette / theming. Every field maps onto the foil CSS custom
 * properties, so a palette can be supplied up front or swapped at runtime with
 * `card.setPalette(...)`. Colours accept any CSS colour string.
 */
export interface PaletteOptions {
  /** A built-in scheme used as the base; the explicit fields below override it. */
  preset?: PalettePreset;
  /** Holographic spectrum stops (`--sunpillar-1…6`). 1–6 colours; fewer are cycled to fill the ramp. */
  sunpillars?: string[];
  /** Rainbow stops for the `holo` foil sweep (`--red` / `--yellow` / `--green` / `--blue` / `--violet`). 1–5 colours, cycled. */
  spectrum?: string[];
  /** Ramp stops for the `cosmos` foil (`--cosmos-clr-1…6`). 1–6 colours, cycled. */
  cosmos?: string[];
  /** Card edge highlight colour (`--card-edge`). */
  edge?: string;
  /** Card back fill colour (`--card-back`). */
  back?: string;
  /** Card glow colour (`--card-glow`); equivalent to the top-level `glow` option. */
  glow?: string;
}

/**
 * Custom dynamic glare (reflected light). Supply a full `image` for total
 * control, or compose the built-in pointer-tracking radial gradient from
 * `shape` / `extent` / `size` / `stops`. Applies across every effect and can be
 * updated at runtime with `card.setGlare(...)`.
 */
export interface GlareOptions {
  /**
   * Full `background-image` for the glare layer, overriding the built-in
   * gradient on every effect. `var(--pointer-x)` / `var(--pointer-y)` are
   * available for pointer tracking.
   */
  image?: string;
  /** Radial-gradient shape when composing the gradient (default `circle`). */
  shape?: "circle" | "ellipse";
  /** Radial-gradient extent keyword, e.g. `farthest-corner` / `closest-side` (default `farthest-corner`). */
  extent?: string;
  /** Explicit gradient size, e.g. `60%` or `60% 40%`; overrides `extent` when set. */
  size?: string;
  /** Colour stops, e.g. `["hsla(0,0%,100%,.8) 10%", "hsla(0,0%,0%,.5) 90%"]`. */
  stops?: string[];
  /** `mix-blend-mode` for the glare layer. */
  blend?: string;
  /** Glare opacity multiplier (mirrors `visual.glareOpacity`). */
  opacity?: number;
}

/**
 * Physical-behaviour tuning for the device-orientation (gyroscope) response.
 * Passing `true` keeps the defaults; `false` disables gyroscope tilt.
 */
export interface GyroscopeOptions {
  /** Master switch (default true); `false` matches `gyroscope: false`. */
  enabled?: boolean;
  /** Device tilt (deg) on the X axis (gamma) that reaches the full effect (default 16). Lower is more sensitive. */
  rangeX?: number;
  /** Device tilt (deg) on the Y axis (beta) that reaches the full effect (default 18). */
  rangeY?: number;
  /** Sensitivity multiplier applied to the raw tilt before clamping (default 1). */
  sensitivity?: number;
  /** Flip the horizontal response. */
  invertX?: boolean;
  /** Flip the vertical response. */
  invertY?: boolean;
}

/**
 * Foil 3D depth / extrusion simulation. Lifts the foil stack above the artwork
 * in true 3D so it parallaxes as the card tilts, with a tilt-reactive contact
 * shadow. Passing `true` enables it with the defaults.
 */
export interface DepthOptions {
  /** Foil extrusion height in px — how far the foil floats above the artwork (default 14). */
  strength?: number;
  /** Perspective in px for the card's 3D space; lower exaggerates the depth (default 600). */
  perspective?: number;
  /** Contact-shadow opacity beneath the lifted card, 0–1 (default 0.35). */
  shadow?: number;
  /** Multiplier turning each extra layer's `parallax` into Z-lift, so stacked layers extrude in depth (default 1). */
  layerScale?: number;
}

/** Fine-grained visual / effect control. Numeric fields are multipliers (1 = unchanged). */
export interface VisualOptions {
  /** Foil brightness multiplier. */
  brightness?: number;
  /** Foil contrast multiplier. */
  contrast?: number;
  /** Foil saturation multiplier. */
  saturate?: number;
  /** Glare layer opacity multiplier. */
  glareOpacity?: number;
  /** Shine/foil layer opacity multiplier. */
  shineOpacity?: number;
  /** Foil line spacing for the glitter/cosmos foils (`--space`); a number is read as a percentage. */
  lineSpace?: string | number;
  /** Foil sweep angle for the glitter/cosmos foils (`--angle`); a number is read as degrees. */
  lineAngle?: string | number;
  /** Glitter cell size (`--glittersize`); a number is read as a percentage. */
  glitterSize?: string | number;
  /** Artwork object-fit (`--imgsize`, default `cover`). */
  imageFit?: string;
}

/** Advanced mask processing. A bare string is shorthand for `{ image }`. */
export interface MaskOptions {
  /** Mask image URL. */
  image?: string;
  /** `mask-size` (default `cover`). */
  size?: string;
  /** `mask-position` (default `center center`). */
  position?: string;
  /** `mask-repeat` (default `no-repeat`). */
  repeat?: string;
  /**
   * What the mask clips:
   * - `shine` (default) clips only the foil, as before;
   * - `card` clips the whole card into the mask silhouette (artwork included).
   */
  mode?: "shine" | "card";
}

/** An extra stacked layer between the artwork and the foil. */
export interface HoloLayerOptions {
  /** Image URL painted into the layer. */
  image?: string;
  /** Arbitrary content for the layer (overrides `image`). */
  content?: HoloContent;
  /** `mix-blend-mode` for the layer (default `normal`). */
  blend?: string;
  /** Layer opacity 0–1 (default 1). */
  opacity?: number;
  /** Pointer-driven parallax depth in px; the layer drifts with the tilt (default 0). */
  parallax?: number;
  /** Per-layer mask image URL. */
  mask?: string;
  /** `background-size` when an `image` is used (default `cover`). */
  size?: string;
  /** `background-position` when an `image` is used (default `center`). */
  position?: string;
  /** Extra class names for the layer element. */
  className?: string;
  /** Extra CSS custom properties for the layer element. */
  vars?: CssVars;
}

export interface HoloCardOptions {
  effect?: HoloEffect;
  interactive?: boolean;
  activateOnClick?: boolean;
  /** Device-orientation tilt: `true`/`false`, or an object for physical-behaviour tuning. */
  gyroscope?: boolean | GyroscopeOptions;
  showcase?: boolean | ShowcaseOptions;
  glow?: string;
  aspectRatio?: number;
  textureSeed?: number;
  mask?: string | MaskOptions;
  foil?: string;
  /** Foil colour palette / theming. */
  palette?: PaletteOptions;
  /** Custom dynamic glare (reflected light). */
  glare?: GlareOptions;
  /** Foil 3D depth / extrusion: `true` for the defaults, or an object to tune it. */
  depth?: boolean | DepthOptions;
  /** Interaction & physics adjustments. */
  physics?: PhysicsOptions;
  /** Fine-grained visual control. */
  visual?: VisualOptions;
  /** Extra stacked layers between the artwork and the foil. */
  layers?: HoloLayerOptions[];
  /** Arbitrary CSS custom properties applied to the root (for content linkage). */
  vars?: CssVars;
}

export interface CreateHoloCardFields extends HoloCardOptions {
  imageAlt?: string;
  back?: string;
  backAlt?: string;
  /** Foreground content above the foil — name plates, badges, live data, etc. */
  overlay?: HoloContent;
  /** Let the overlay receive pointer events (default false: purely decorative). */
  overlayInteractive?: boolean;
  className?: string;
}

/**
 * Options for `createHoloCard`. Either `image` (front artwork) or `content`
 * (custom front content) must be supplied — both may be combined — so the card
 * is never built blank.
 */
export type CreateHoloCardOptions = CreateHoloCardFields &
  ({ image: string; content?: HoloContent } | { image?: string; content: HoloContent });
