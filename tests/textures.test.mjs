import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_TEXTURE_SEED,
  TEXTURE_VARIABLES,
  generateTextures,
  glitterTexture,
  grainTexture,
  mulberry32,
  texturesToCssVariables,
} from "../dist/textures.js";

test("mulberry32 is deterministic and stays in [0, 1)", () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  for (let i = 0; i < 20; i += 1) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test("generateTextures is deterministic for a given seed", () => {
  assert.deepEqual(generateTextures({ seed: 42 }), generateTextures({ seed: 42 }));
  assert.deepEqual(generateTextures(), generateTextures({ seed: DEFAULT_TEXTURE_SEED }));
});

test("different seeds produce different textures", () => {
  assert.notEqual(grainTexture(1), grainTexture(2));
  assert.notEqual(glitterTexture(1), glitterTexture(2));
});

test("every texture is an encoded SVG data URI", () => {
  const textures = generateTextures({ seed: 7 });
  for (const value of Object.values(textures)) {
    assert.ok(value.startsWith("data:image/svg+xml,"), "expected an SVG data URI");
    assert.equal(value.includes("<"), false, "raw '<' must be URI-encoded");
    assert.equal(value.includes("#"), false, "raw '#' must be URI-encoded");
    assert.equal(value.includes('"'), false, "double quotes must be replaced");
  }
});

test("texturesToCssVariables wraps every texture in url() under its variable", () => {
  const textures = generateTextures({ seed: 7 });
  const vars = texturesToCssVariables(textures);
  assert.deepEqual(Object.keys(vars).sort(), Object.values(TEXTURE_VARIABLES).sort());
  for (const [key, name] of Object.entries(TEXTURE_VARIABLES)) {
    assert.equal(vars[name], `url("${textures[key]}")`);
  }
});
