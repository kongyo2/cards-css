export type HoloEffect = "none" | "holo" | "reverse" | "cosmos" | "glitter";

export interface HoloCardOptions {
  effect?: HoloEffect;
  interactive?: boolean;
  activateOnClick?: boolean;
  gyroscope?: boolean;
  showcase?: boolean;
  glow?: string;
  aspectRatio?: number;
  textureSeed?: number;
  mask?: string;
  foil?: string;
}

export interface CreateHoloCardOptions extends HoloCardOptions {
  image: string;
  imageAlt?: string;
  back?: string;
  backAlt?: string;
  className?: string;
}
