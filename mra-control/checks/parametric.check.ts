// Run: node --experimental-transform-types checks/parametric.check.ts (from mra-control)
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {compileExpression, isValidExpression, ParametricTrajectory} from '../src/state/trajectories.ts';

const near = (a: THREE.Vector3, b: THREE.Vector3) => a.distanceTo(b) < 1e-9;
const start = new THREE.Vector3(1, 2, 1);

// The block's default figure eight: starts where the robot is, ends at path(end) - path(start) from there
const path = new ParametricTrajectory(start, 'sin(t)', 'sin(2 * t) / 2', '0', 0, 6.28, 8);
assert.equal(path.duration, 8);
assert.ok(near(path.evaluate(0), start));
const atEnd = new THREE.Vector3(Math.sin(6.28), Math.sin(2 * 6.28) / 2, 0);
assert.ok(near(path.evaluate(1), start.clone().add(atEnd)));
const quarter = 0.25 * 6.28;
assert.ok(near(path.evaluate(0.25), start.clone().add(new THREE.Vector3(Math.sin(quarter), Math.sin(2 * quarter) / 2, 0))));
// The robot's position object isn't modified
assert.ok(near(start, new THREE.Vector3(1, 2, 1)));

// Shifted start: a path not starting at its own origin still begins at the robot
const shifted = new ParametricTrajectory(start, 'cos(t)', 'pow(t, 2)', 't', 1, 2, 3);
assert.ok(near(shifted.evaluate(0), start));
assert.ok(near(shifted.evaluate(1), start.clone().add(new THREE.Vector3(Math.cos(2) - Math.cos(1), 4 - 1, 1))));

// A broken expression gives 0 instead of throwing (the simulator must keep running)
assert.equal(compileExpression('sin(t) +* 2')(1), 0);
assert.equal(compileExpression('nope(t)')(1), 0);

// What the block's text fields accept
for (const ok of ['sin(t)', 'pow(t, 3) / 2', 'pi * t', 'max(0, t - 1)', '0']) assert.ok(isValidExpression(ok), ok);
for (const bad of ['', 't ** 2', 't ^ 2', 'sin(t', 'nope(t)']) assert.ok(!isValidExpression(bad), bad);

console.log('parametric ok');
