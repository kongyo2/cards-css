import { HoloCard } from "./holo-card.js";
import { buildHoloCardElement } from "./dom.js";
import type { CreateHoloCardOptions, HoloCardOptions } from "./types.js";

export { HoloCard } from "./holo-card.js";
export { buildHoloCardElement, CLASS } from "./dom.js";
export {
  generateTextures,
  texturesToCssVariables,
  grainTexture,
  glitterTexture,
  TEXTURE_VARIABLES,
  DEFAULT_TEXTURE_SEED,
  type Textures,
  type TextureOptions,
} from "./textures.js";
export {
  subscribeOrientation,
  requestOrientationPermission,
  resetBaseOrientation,
  type Orientation,
  type RelativeOrientation,
} from "./orientation.js";
export { getActiveCard, setActiveCard, subscribeActiveCard } from "./active-registry.js";
export { Spring, type SpringValue, type SpringOpts, type SpringSetOpts } from "./spring.js";
export { round, clamp, adjust } from "./math.js";
export type { HoloEffect, HoloCardOptions, CreateHoloCardOptions } from "./types.js";

export const createHoloCard = (options: CreateHoloCardOptions): HoloCard => {
  const element = buildHoloCardElement(options);
  return new HoloCard(element, options);
};

export const attachHoloCard = (element: HTMLElement, options: HoloCardOptions = {}): HoloCard =>
  new HoloCard(element, options);
