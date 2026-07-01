import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile } from "node:fs/promises";

import { HOLO_EFFECTS } from "../dist/types.js";

const FOILS = HOLO_EFFECTS.filter((effect) => effect !== "none");

test("HOLO_EFFECTS lists none first and every effect exactly once", () => {
  assert.equal(HOLO_EFFECTS[0], "none");
  assert.equal(new Set(HOLO_EFFECTS).size, HOLO_EFFECTS.length);
  assert.equal(FOILS.length, 14);
});

test("every foil ships a stylesheet targeting its data-effect, wired into the bundle", async () => {
  const index = await readFile(new URL("../src/styles/index.css", import.meta.url), "utf8");
  const sheets = await Promise.all(
    FOILS.map(async (effect) => ({
      effect,
      css: await readFile(new URL(`../src/styles/effects/${effect}.css`, import.meta.url), "utf8"),
    })),
  );
  for (const { effect, css } of sheets) {
    assert.ok(css.includes(`[data-effect="${effect}"]`), `${effect}.css targets [data-effect="${effect}"]`);
    assert.ok(index.includes(`./effects/${effect}.css`), `index.css imports ${effect}.css`);
  }
});

test("no stylesheet ships for an effect missing from HOLO_EFFECTS", async () => {
  const files = await readdir(new URL("../src/styles/effects", import.meta.url));
  for (const file of files) {
    const effect = file.replace(/\.css$/u, "");
    assert.ok(HOLO_EFFECTS.includes(effect), `${file} has a matching HOLO_EFFECTS entry`);
  }
});
