import { createHoloCard, requestOrientationPermission } from "../src/index.js";

const CARDS = [
  {
    effect: "holo",
    image: "./cards/phoenix.svg",
    name: "Phoenix",
    rarity: "Mythic",
    physics: { maxTilt: 18 },
    visual: { saturate: 1.1 },
  },
  {
    effect: "reverse",
    image: "./cards/leviathan.svg",
    name: "Leviathan",
    rarity: "Legendary",
    physics: { parallax: 1.3, glareRange: 1.1 },
  },
  {
    effect: "cosmos",
    image: "./cards/nebula.svg",
    name: "Nebula",
    rarity: "Cosmic",
    textureSeed: 222,
    physics: { maxTiltX: 16, maxTiltY: 11, parallax: 1.2 },
    showcase: { intensity: 30 },
  },
  {
    effect: "glitter",
    image: "./cards/prism.svg",
    name: "Prism Golem",
    rarity: "Holo Rare",
    textureSeed: 777,
    physics: { glareRange: 1.2, springs: { rotate: { axes: { x: { stiffness: 0.09 } } } } },
    visual: { brightness: 1.05 },
  },
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const grid = document.getElementById("cards");

const rarityPlate = (label) => {
  const plate = document.createElement("div");
  plate.className = "rarity";
  plate.textContent = label;
  return plate;
};

for (const def of CARDS) {
  const card = createHoloCard({
    image: def.image,
    imageAlt: def.name,
    effect: def.effect,
    showcase: reduceMotion ? false : (def.showcase ?? true),
    activateOnClick: true,
    physics: def.physics,
    ...(def.visual ? { visual: def.visual } : {}),
    overlay: rarityPlate(def.rarity),
    ...(typeof def.textureSeed === "number" ? { textureSeed: def.textureSeed } : {}),
  });

  const stage = document.createElement("div");
  stage.className = "stage";
  stage.appendChild(card.element);

  const caption = document.createElement("figcaption");
  caption.className = "caption";

  const effect = document.createElement("span");
  effect.className = "effect";
  effect.textContent = def.effect;

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = def.name;

  caption.append(effect, name);

  const slot = document.createElement("figure");
  slot.className = "slot";
  slot.append(stage, caption);

  grid.appendChild(slot);
}

const unlockGyroscope = () => {
  void requestOrientationPermission();
};
window.addEventListener("pointerdown", unlockGyroscope, { once: true });
