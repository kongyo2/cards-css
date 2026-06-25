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
  /** Foil line spacing (`--space`); a number is read as a percentage. */
  lineSpace?: string | number;
  /** Foil sweep angle (`--angle`); a number is read as degrees. */
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
  gyroscope?: boolean;
  showcase?: boolean | ShowcaseOptions;
  glow?: string;
  aspectRatio?: number;
  textureSeed?: number;
  mask?: string | MaskOptions;
  foil?: string;
  /** Interaction & physics adjustments. */
  physics?: PhysicsOptions;
  /** Fine-grained visual control. */
  visual?: VisualOptions;
  /** Extra stacked layers between the artwork and the foil. */
  layers?: HoloLayerOptions[];
  /** Arbitrary CSS custom properties applied to the root (for content linkage). */
  vars?: CssVars;
}

export interface CreateHoloCardOptions extends HoloCardOptions {
  /** Front artwork source. Optional when `content` is supplied. */
  image?: string;
  imageAlt?: string;
  back?: string;
  backAlt?: string;
  /** Front content, used instead of (or alongside) `image` for richer cards. */
  content?: HoloContent;
  /** Foreground content above the foil — name plates, badges, live data, etc. */
  overlay?: HoloContent;
  /** Let the overlay receive pointer events (default false: purely decorative). */
  overlayInteractive?: boolean;
  className?: string;
}
