// Run: node --experimental-strip-types checks/collisions.check.ts (from mra-control)
import assert from 'node:assert/strict';
import {collisionWarning, overlappingPairs} from '../src/state/warnings.ts';

const box = [0.4, 0.4, 0.7];
const at = (x: number, y: number, z: number) => ({x, y, z});

assert.deepEqual(overlappingPairs({a: at(0, 0, 1), b: at(0.3, 0.1, 1.2)}, box), [['a', 'b']]);
// Far apart on one axis is enough to not overlap
assert.deepEqual(overlappingPairs({a: at(0, 0, 1), b: at(0.3, 0, 1.8)}, box), []);
// Exactly touching boxes don't overlap
assert.deepEqual(overlappingPairs({a: at(0, 0, 1), b: at(0.4, 0, 1)}, box), []);
assert.deepEqual(overlappingPairs({a: at(0, 0, 1), b: at(1, 0, 1), c: at(1.1, 0, 1)}, box), [['b', 'c']]);
assert.equal(collisionWarning(4.2, 'CF 1', 'CF 2').short, 'CF 1 and CF 2 too close');
assert.equal(collisionWarning(4.2, 'CF 1', 'CF 2').full, 'robots CF 1 and CF 2 came too close at time 4.20 (their bounding boxes overlapped).\n');
console.log('collisions ok');
