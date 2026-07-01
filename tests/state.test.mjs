import assert from "node:assert/strict";
import { test } from "node:test";

import { Subscribers } from "../dist/subscribers.js";
import { getActiveCard, setActiveCard, subscribeActiveCard } from "../dist/active-registry.js";
import { requestOrientationPermission, resetBaseOrientation, subscribeOrientation } from "../dist/orientation.js";

test("Subscribers calls a new subscriber immediately with the current value", () => {
  const subscribers = new Subscribers(() => "current");
  const seen = [];
  subscribers.subscribe((value) => seen.push(value));
  assert.deepEqual(seen, ["current"]);
});

test("Subscribers emits to every subscriber and honours unsubscribe/clear", () => {
  const subscribers = new Subscribers(() => 0);
  const first = [];
  const second = [];
  const unsubscribe = subscribers.subscribe((value) => first.push(value));
  subscribers.subscribe((value) => second.push(value));
  subscribers.emit(1);
  unsubscribe();
  subscribers.emit(2);
  assert.equal(subscribers.size, 1);
  subscribers.clear();
  subscribers.emit(3);
  assert.deepEqual(first, [0, 1]);
  assert.deepEqual(second, [0, 1, 2]);
  assert.equal(subscribers.size, 0);
});

test("the active registry tracks the active card and notifies transitions", () => {
  const events = [];
  const unsubscribe = subscribeActiveCard((active) => events.push(active));
  const token = { card: true };
  setActiveCard(token);
  assert.equal(getActiveCard(), token);
  setActiveCard(null);
  assert.equal(getActiveCard(), null);
  unsubscribe();
  assert.deepEqual(events, [null, token, null]);
});

test("setActiveCard skips no-op updates", () => {
  const events = [];
  const unsubscribe = subscribeActiveCard((active) => events.push(active));
  const token = {};
  setActiveCard(token);
  setActiveCard(token);
  setActiveCard(null);
  setActiveCard(null);
  unsubscribe();
  assert.deepEqual(events, [null, token, null]);
});

test("orientation helpers are safe without a window or DeviceOrientationEvent", async () => {
  const seen = [];
  const unsubscribe = subscribeOrientation((orientation) => seen.push(orientation));
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].relative, { alpha: 0, beta: 0, gamma: 0 });
  unsubscribe();
  resetBaseOrientation();
  assert.equal(await requestOrientationPermission(), false);
});
