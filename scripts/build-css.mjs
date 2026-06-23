import { build } from "esbuild";

await build({
  entryPoints: ["src/styles/index.css"],
  bundle: true,
  outfile: "dist/holo-cards.css",
  logLevel: "info",
});
