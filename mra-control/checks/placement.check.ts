// Run: node --experimental-strip-types checks/placement.check.ts (from mra-control)
import assert from 'node:assert/strict';
import {blockOverlaps, landingTime} from '../src/components/timeline/placement.ts';

// Two 10 s blocks on the timeline: 10-20 s and 40-50 s
const placed = [{id: 'a', startTime: 10, duration: 10}, {id: 'b', startTime: 40, duration: 10}] as Parameters<typeof landingTime>[0];

// Touching is fine; overlapping isn't; before 0 isn't
assert.equal(blockOverlaps(placed, 20, 5), false);
assert.equal(blockOverlaps(placed, 5, 5), false);
assert.equal(blockOverlaps(placed, 19, 5), true);
assert.equal(blockOverlaps(placed, -1, 1), true);

// A free spot stays where it was dropped
assert.equal(landingTime(placed, 25, 8, 8), 25);
// Overlapping the end of a: snaps to just after it
assert.equal(landingTime(placed, 17, 8, 8), 20);
// Overlapping the start of b: snaps to just before it
assert.equal(landingTime(placed, 35, 8, 8), 32);
// Overlapping a, both of its sides within reach: the nearer one wins
assert.equal(landingTime(placed, 10.5, 8, 20), 2);
assert.equal(landingTime(placed, 13, 8, 20), 20);
// Only the side within reach counts
assert.equal(landingTime(placed, 13, 8, 8), 20);
assert.equal(landingTime(placed, 5, 8, 8), 2);
// Too long for the 20 s gap between a and b: after a it would hit b, before b it would hit a, and after b is out of reach
assert.equal(landingTime(placed, 25, 25, 20), undefined);
// ...but with after b in reach, it goes there
assert.equal(landingTime(placed, 25, 25, 25), 50);
// Further than `reach` from any free spot: can't go there (a short block over the middle of a long one doesn't jump out)
assert.equal(landingTime([{id: 'long', startTime: 0, duration: 60}] as typeof placed, 30, 1, 1), undefined);
// The block being moved doesn't get in its own way
assert.equal(landingTime(placed, 12, 10, 10, 'a'), 12);
// Just before a would start before 0, so it goes after a
assert.equal(landingTime(placed, 8, 12, 12), 20);

console.log('placement ok');
