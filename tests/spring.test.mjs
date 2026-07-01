import assert from "node:assert/strict";
import { test } from "node:test";

import { Spring } from "../dist/spring.js";

const FAST = { stiffness: 0.5, damping: 0.8 };

test("a hard set applies the value immediately", async () => {
  const spring = new Spring(0, FAST);
  await spring.set(10, { hard: true });
  assert.equal(spring.current, 10);
  assert.equal(spring.settled, true);
});

test("stiffness/damping >= 1 behaves like a hard set", async () => {
  const spring = new Spring(0, { stiffness: 1, damping: 1 });
  await spring.set(5);
  assert.equal(spring.current, 5);
});

test("a scalar spring animates to its target and resolves at settle", async () => {
  const spring = new Spring(0, FAST);
  assert.equal(spring.settled, true);
  const promise = spring.set(100);
  assert.equal(spring.settled, false);
  await promise;
  assert.equal(spring.current, 100);
  assert.equal(spring.settled, true);
});

test("an object spring settles every key, including axes overrides", async () => {
  const spring = new Spring({ x: 0, y: 0, o: 0 }, { ...FAST, axes: { o: { stiffness: 0.9, damping: 0.9 } } });
  await spring.set({ x: 10, y: -10, o: 1 });
  assert.deepEqual(spring.current, { x: 10, y: -10, o: 1 });
});

test("superseded set() promises resolve once the spring settles", async () => {
  const spring = new Spring(0, FAST);
  const resolved = [];
  const first = spring.set(50).then(() => resolved.push("first"));
  const second = spring.set(100).then(() => resolved.push("second"));
  await Promise.all([first, second]);
  assert.deepEqual(resolved.sort(), ["first", "second"]);
  assert.equal(spring.current, 100);
});

test("subscribe emits the current value immediately and on every tick", async () => {
  const spring = new Spring(0, FAST);
  const seen = [];
  const unsubscribe = spring.subscribe((value) => seen.push(value));
  assert.deepEqual(seen, [0]);
  await spring.set(10);
  assert.ok(seen.length > 1, "expected animation ticks to notify");
  assert.equal(seen.at(-1), 10);
  unsubscribe();
  await spring.set(0, { hard: true });
  assert.equal(seen.at(-1), 10, "unsubscribed listeners must not be notified");
});

test("destroy aborts the animation and resolves the pending settle promise", async () => {
  const spring = new Spring(0, { stiffness: 0.001, damping: 0.9 });
  const pending = spring.set(100);
  spring.destroy();
  await pending;
  assert.equal(spring.settled, true);
});
