import { createHoloCard, requestOrientationPermission } from "../src/index.js";

const CARDS = [
  { effect: "holo", image: "./cards/phoenix.svg", name: "Phoenix" },
  { effect: "reverse", image: "./cards/leviathan.svg", name: "Leviathan" },
  { effect: "cosmos", image: "./cards/nebula.svg", name: "Nebula", textureSeed: 222 },
  { effect: "glitter", image: "./cards/prism.svg", name: "Prism Golem", textureSeed: 777 },
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const grid = document.getElementById("cards");

for (const def of CARDS) {
  const card = createHoloCard({
    image: def.image,
    imageAlt: def.name,
    effect: def.effect,
    showcase: !reduceMotion,
    activateOnClick: true,
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
