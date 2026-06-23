import { build } from "esbuild";
import { cp, copyFile, mkdir, rm } from "node:fs/promises";

const out = "_site";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await build({
  entryPoints: ["examples/demo.js"],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  minify: true,
  sourcemap: true,
  outfile: `${out}/demo.js`,
  logLevel: "info",
});

await build({
  entryPoints: ["src/styles/index.css"],
  bundle: true,
  outfile: `${out}/holo-cards.css`,
  logLevel: "info",
});

await copyFile("examples/index.html", `${out}/index.html`);
await cp("examples/cards", `${out}/cards`, { recursive: true });
