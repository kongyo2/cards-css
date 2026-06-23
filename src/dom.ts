import type { CreateHoloCardOptions } from "./types.js";

export const CLASS = {
  root: "holo-card",
  translater: "holo-card__translater",
  rotator: "holo-card__rotator",
  front: "holo-card__front",
  back: "holo-card__back",
  image: "holo-card__image",
  shine: "holo-card__shine",
  glare: "holo-card__glare",
  interactive: "holo-card--interactive",
  active: "holo-card--active",
  interacting: "holo-card--interacting",
  loading: "holo-card--loading",
  masked: "holo-card--masked",
} as const;

const requireDocument = (): Document => {
  if (typeof document === "undefined") {
    throw new Error("@kongyo2/cards-css: a DOM document is required to build a holo card element.");
  }
  return document;
};

export const buildHoloCardElement = (options: CreateHoloCardOptions): HTMLElement => {
  const doc = requireDocument();

  const root = doc.createElement("div");
  root.className = CLASS.root;
  if (options.className) {
    for (const name of options.className.split(/\s+/).filter(Boolean)) {
      root.classList.add(name);
    }
  }
  root.dataset.effect = options.effect ?? "none";
  if (options.mask) {
    root.classList.add(CLASS.masked);
  }

  const translater = doc.createElement("div");
  translater.className = CLASS.translater;

  const rotator = doc.createElement("div");
  rotator.className = CLASS.rotator;

  if (options.back) {
    const back = doc.createElement("img");
    back.className = CLASS.back;
    back.src = options.back;
    back.alt = options.backAlt ?? "";
    back.loading = "lazy";
    rotator.appendChild(back);
  }

  const front = doc.createElement("div");
  front.className = CLASS.front;

  const image = doc.createElement("img");
  image.className = CLASS.image;
  image.src = options.image;
  image.alt = options.imageAlt ?? "";
  image.loading = "lazy";
  front.appendChild(image);

  const shine = doc.createElement("div");
  shine.className = CLASS.shine;

  const glare = doc.createElement("div");
  glare.className = CLASS.glare;

  front.appendChild(shine);
  front.appendChild(glare);
  rotator.appendChild(front);
  translater.appendChild(rotator);
  root.appendChild(translater);

  return root;
};
