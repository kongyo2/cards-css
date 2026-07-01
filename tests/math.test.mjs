import assert from "node:assert/strict";
import { test } from "node:test";

import { adjust, clamp, round } from "../dist/math.js";

test("round rounds to three decimals by default", () => {
  assert.equal(round(1.23456), 1.235);
  assert.equal(round(-1.23456), -1.235);
  assert.equal(round(2), 2);
});

test("round honours an explicit precision", () => {
  assert.equal(round(1.2345, 1), 1.2);
  assert.equal(round(1.5, 0), 2);
});

test("clamp defaults to the 0..100 range", () => {
  assert.equal(clamp(150), 100);
  assert.equal(clamp(-10), 0);
  assert.equal(clamp(42), 42);
});

test("clamp honours explicit bounds", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, -1, 1), -1);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test("adjust remaps a value between ranges", () => {
  assert.equal(adjust(0.5, 0, 1, 0, 100), 50);
  assert.equal(adjust(-1, -1, 1, 0, 100), 0);
  assert.equal(adjust(1, -1, 1, 0, 100), 100);
  assert.equal(adjust(50, 0, 100, 37, 63), 50);
});
