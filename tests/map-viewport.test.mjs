import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canvasSize, clampMapPan } from '../src/lib/map-viewport.ts';

test('fit the entire original map inside the viewport', () => {
  const size = canvasSize({ width: 600, height: 540 }, 1);
  assert.equal(size.height, 540);
  assert.ok(size.width <= 600);
  assert.deepEqual(clampMapPan({ x: 100, y: -200 }, { width: 600, height: 540 }, 1), { x: 0, y: 0 });
});
test('zoom affects only canvas dimensions and clamps both pan axes', () => {
  const view = { width: 504, height: 520 };
  assert.deepEqual(canvasSize(view, 2), { width: 1008, height: 1040 });
  assert.deepEqual(clampMapPan({ x: 999, y: -999 }, view, 2), { x: 252, y: -260 });
  assert.deepEqual(clampMapPan({ x: 25, y: -30 }, view, 2), { x: 25, y: -30 });
  assert.deepEqual(clampMapPan({ x: 252, y: -260 }, view, 1), { x: 0, y: 0 });
});
test('resizing to a narrow viewport retains the original map proportions', () => {
  const size = canvasSize({ width: 300, height: 540 }, 1);
  assert.equal(size.width, 300);
  assert.ok(Math.abs(size.height / size.width - 1040 / 1008) < 0.000001);
});
