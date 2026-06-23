export interface TextureOptions {
  seed?: number;
}

export interface Textures {
  grain: string;
  glitter: string;
  cosmosBottom: string;
  cosmosMiddle: string;
  cosmosTop: string;
}

export const DEFAULT_TEXTURE_SEED = 0x9e3779b9;

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const svgToDataUri = (svg: string): string => {
  const cleaned = svg
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
  const encoded = cleaned
    .replace(/%/g, "%25")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/#/g, "%23")
    .replace(/&/g, "%26")
    .replace(/"/g, "'")
    .replace(/\n/g, "%0A");
  return `data:image/svg+xml,${encoded}`;
};

const pick = <T>(rng: () => number, items: readonly T[]): T => {
  const value = items[Math.floor(rng() * items.length)];
  return value ?? (items[0] as T);
};

const rand = (rng: () => number, min: number, max: number): number => min + rng() * (max - min);

const discreteTable = (keep: number, steps = 32): string => {
  const ones = Math.min(steps, Math.max(1, Math.round(steps * keep)));
  const cells: string[] = [];
  for (let i = 0; i < steps - ones; i += 1) {
    cells.push("0");
  }
  for (let i = 0; i < ones; i += 1) {
    cells.push("1");
  }
  return cells.join(" ");
};

interface SpeckleLayer {
  freq: number;
  keep: number;
  color: string;
  opacity: number;
}

const speckleField = (
  idBase: string,
  seed: number,
  layers: readonly SpeckleLayer[],
  stitch = true,
): { defs: string; body: string } => {
  let defs = "";
  let body = "";
  const stitchTiles = stitch ? "stitch" : "noStitch";
  layers.forEach((layer, index) => {
    const id = `${idBase}${index}`;
    defs +=
      `<filter id='${id}' x='0%' y='0%' width='100%' height='100%'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='${layer.freq}' numOctaves='1' seed='${(seed + index * 37) % 9973}' stitchTiles='${stitchTiles}' result='n'/>` +
      `<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='a'/>` +
      `<feComponentTransfer in='a' result='m'><feFuncA type='discrete' tableValues='${discreteTable(layer.keep)}'/></feComponentTransfer>` +
      `<feComposite in='SourceGraphic' in2='m' operator='in'/>` +
      `</filter>`;
    body += `<rect width='100%' height='100%' fill='${layer.color}' filter='url(#${id})' opacity='${layer.opacity}'/>`;
  });
  return { defs, body };
};

const clusterBlobs = (
  rng: () => number,
  width: number,
  height: number,
  count: number,
  palette: readonly string[],
  blurId: string,
  radius: [number, number],
  opacity: [number, number],
): string => {
  let blobs = "";
  for (let i = 0; i < count; i += 1) {
    const cx = (rng() * width).toFixed(1);
    const cy = (rng() * height).toFixed(1);
    const r = rand(rng, radius[0], radius[1]).toFixed(1);
    blobs += `<circle cx='${cx}' cy='${cy}' r='${r}' fill='${pick(rng, palette)}' opacity='${rand(rng, opacity[0], opacity[1]).toFixed(2)}'/>`;
  }
  return `<g filter='url(${blurId})'>${blobs}</g>`;
};

const brightStars = (rng: () => number, width: number, height: number, count: number, glowId: string): string => {
  let stars = "";
  for (let i = 0; i < count; i += 1) {
    const cx = (rng() * width).toFixed(1);
    const cy = (rng() * height).toFixed(1);
    const r = rand(rng, 1.1, 2.6);
    stars +=
      `<circle cx='${cx}' cy='${cy}' r='${(r * 2.6).toFixed(1)}' fill='#ffffff' opacity='0.14' filter='url(${glowId})'/>` +
      `<circle cx='${cx}' cy='${cy}' r='${r.toFixed(2)}' fill='#ffffff' opacity='${rand(rng, 0.75, 1).toFixed(2)}'/>`;
  }
  return stars;
};

const ringClusters = (rng: () => number, width: number, height: number, count: number, color: string): string => {
  let out = "";
  for (let i = 0; i < count; i += 1) {
    const cx = rng() * width;
    const cy = rng() * height;
    const radius = rand(rng, 14, 30);
    const dots = 26 + Math.floor(rng() * 22);
    for (let k = 0; k < dots; k += 1) {
      const angle = rng() * Math.PI * 2;
      const rr = radius * rand(rng, 0.78, 1.28);
      const x = (cx + Math.cos(angle) * rr).toFixed(1);
      const y = (cy + Math.sin(angle) * rr * 1.05).toFixed(1);
      out += `<circle cx='${x}' cy='${y}' r='${rand(rng, 0.5, 1.5).toFixed(2)}' fill='${color}' opacity='${rand(rng, 0.4, 0.9).toFixed(2)}'/>`;
    }
  }
  return out;
};

const COSMOS_W = 512;
const COSMOS_H = 716;

const cosmosSvgOpen = (extraDefs: string): string =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${COSMOS_W}' height='${COSMOS_H}' viewBox='0 0 ${COSMOS_W} ${COSMOS_H}'>` +
  `<defs>` +
  `<filter id='blur' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='2.6'/></filter>` +
  `<filter id='glow' x='-200%' y='-200%' width='500%' height='500%'><feGaussianBlur stdDeviation='2.4'/></filter>` +
  `${extraDefs}` +
  `</defs>`;

export const grainTexture = (seed: number): string => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
    `<filter id='grain' x='0%' y='0%' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed % 9973}' stitchTiles='stitch' result='n'/>` +
    `<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='a'/>` +
    `<feComponentTransfer in='a' result='m'><feFuncA type='discrete' tableValues='${discreteTable(0.28)}'/></feComponentTransfer>` +
    `<feFlood flood-color='#ffffff' result='w'/>` +
    `<feComposite in='w' in2='m' operator='in'/>` +
    `</filter>` +
    `<rect width='100%' height='100%' fill='#000000'/>` +
    `<rect width='100%' height='100%' filter='url(#grain)' opacity='0.4'/>` +
    `</svg>`;
  return svgToDataUri(svg);
};

export const glitterTexture = (seed: number): string => {
  const { defs, body } = speckleField("gl", seed, [
    { freq: 0.82, keep: 0.42, color: "#8f8f8f", opacity: 0.85 },
    { freq: 0.7, keep: 0.22, color: "#dcdcdc", opacity: 1 },
    { freq: 0.6, keep: 0.08, color: "#ffffff", opacity: 1 },
  ]);
  const rng = mulberry32(seed + 99);
  const flares = brightStars(rng, 240, 240, 16, "#glow");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>` +
    `<defs><filter id='glow' x='-200%' y='-200%' width='500%' height='500%'><feGaussianBlur stdDeviation='1.5'/></filter>${defs}</defs>` +
    `<rect width='100%' height='100%' fill='#050505'/>` +
    `${body}${flares}` +
    `</svg>`;
  return svgToDataUri(svg);
};

const cosmosBottom = (seed: number): string => {
  const rng = mulberry32(seed);
  const { defs, body } = speckleField(
    "csb",
    seed,
    [
      { freq: 0.85, keep: 0.32, color: "#97a3c8", opacity: 0.8 },
      { freq: 0.72, keep: 0.13, color: "#ffffff", opacity: 0.95 },
      { freq: 0.76, keep: 0.05, color: "#9fb6ff", opacity: 0.85 },
      { freq: 0.78, keep: 0.04, color: "#ffc2d8", opacity: 0.8 },
    ],
    false,
  );
  const clusters = clusterBlobs(
    rng,
    COSMOS_W,
    COSMOS_H,
    26,
    ["#465777", "#6d6088", "#9a7790", "#aab3cc", "#566f9e"],
    "#blur",
    [5, 14],
    [0.18, 0.4],
  );
  const stars = brightStars(rng, COSMOS_W, COSMOS_H, 24, "#glow");
  const svg = cosmosSvgOpen(defs) + `<rect width='100%' height='100%' fill='#04030c'/>${clusters}${body}${stars}</svg>`;
  return svgToDataUri(svg);
};

const cosmosMiddle = (seed: number): string => {
  const rng = mulberry32(seed);
  const { defs, body } = speckleField(
    "csm",
    seed,
    [
      { freq: 0.66, keep: 0.2, color: "#241a4e", opacity: 0.95 },
      { freq: 0.58, keep: 0.11, color: "#4a2168", opacity: 0.9 },
      { freq: 0.52, keep: 0.055, color: "#7a1f6b", opacity: 0.85 },
      { freq: 0.5, keep: 0.03, color: "#c87a3a", opacity: 0.85 },
    ],
    false,
  );
  const clusters = clusterBlobs(
    rng,
    COSMOS_W,
    COSMOS_H,
    16,
    ["#241a4e", "#3a2168", "#1a1430"],
    "#blur",
    [7, 18],
    [0.45, 0.8],
  );
  const svg = cosmosSvgOpen(defs) + `${clusters}${body}</svg>`;
  return svgToDataUri(svg);
};

const cosmosTop = (seed: number): string => {
  const rng = mulberry32(seed);
  const { defs, body } = speckleField(
    "cst",
    seed,
    [
      { freq: 0.62, keep: 0.06, color: "#6a6a76", opacity: 0.85 },
      { freq: 0.52, keep: 0.035, color: "#42424c", opacity: 0.9 },
    ],
    false,
  );
  const rings = ringClusters(rng, COSMOS_W, COSMOS_H, 7, "#54545f");
  const svg = cosmosSvgOpen(defs) + `${body}${rings}</svg>`;
  return svgToDataUri(svg);
};

export const generateTextures = (options: TextureOptions = {}): Textures => {
  const seed = options.seed ?? DEFAULT_TEXTURE_SEED;
  return {
    grain: grainTexture(seed),
    glitter: glitterTexture(seed + 1),
    cosmosBottom: cosmosBottom(seed + 2),
    cosmosMiddle: cosmosMiddle(seed + 3),
    cosmosTop: cosmosTop(seed + 4),
  };
};

export const TEXTURE_VARIABLES = {
  grain: "--hc-grain",
  glitter: "--hc-glitter",
  cosmosBottom: "--hc-cosmos-bottom",
  cosmosMiddle: "--hc-cosmos-middle",
  cosmosTop: "--hc-cosmos-top",
} as const satisfies Record<keyof Textures, string>;

export const texturesToCssVariables = (textures: Textures): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(TEXTURE_VARIABLES) as (keyof Textures)[]) {
    vars[TEXTURE_VARIABLES[key]] = `url("${textures[key]}")`;
  }
  return vars;
};
