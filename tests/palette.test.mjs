import assert from "node:assert/strict";
import { test } from "node:test";

import { PALETTES, PALETTE_VARIABLES, paletteToCssVariables, resolvePalette } from "../dist/palette.js";

test("resolvePalette merges a preset with explicit overrides", () => {
  const resolved = resolvePalette({ preset: "gold", edge: "red" });
  assert.equal(resolved.edge, "red");
  assert.deepEqual(resolved.sunpillars, PALETTES.gold.sunpillars);
  assert.equal("preset" in resolved, false);
});

test("resolvePalette without a preset returns the palette as-is", () => {
  const resolved = resolvePalette({ edge: "blue" });
  assert.equal(resolved.edge, "blue");
  assert.equal(resolved.sunpillars, undefined);
});

test("paletteToCssVariables cycles short sunpillar lists across all six stops", () => {
  const vars = paletteToCssVariables({ sunpillars: ["a", "b"] });
  assert.equal(vars["--sunpillar-1"], "a");
  assert.equal(vars["--sunpillar-2"], "b");
  assert.equal(vars["--sunpillar-3"], "a");
  assert.equal(vars["--sunpillar-6"], "b");
});

test("paletteToCssVariables cycles a single spectrum colour into every stop", () => {
  const vars = paletteToCssVariables({ spectrum: ["x"] });
  for (const name of ["--red", "--yellow", "--green", "--blue", "--violet"]) {
    assert.equal(vars[name], "x");
  }
});

test("paletteToCssVariables maps edge/back/glow onto card variables", () => {
  const vars = paletteToCssVariables({ edge: "e", back: "b", glow: "g" });
  assert.equal(vars["--card-edge"], "e");
  assert.equal(vars["--card-back"], "b");
  assert.equal(vars["--card-glow"], "g");
});

test("paletteToCssVariables ignores empty colour lists", () => {
  const vars = paletteToCssVariables({ sunpillars: [], spectrum: [], cosmos: [] });
  assert.deepEqual(vars, {});
});

test("every emitted variable is listed in PALETTE_VARIABLES", () => {
  const vars = paletteToCssVariables({ preset: "rainbow", edge: "e", back: "b", glow: "g" });
  for (const name of Object.keys(vars)) {
    assert.ok(PALETTE_VARIABLES.includes(name), `${name} missing from PALETTE_VARIABLES`);
  }
});
