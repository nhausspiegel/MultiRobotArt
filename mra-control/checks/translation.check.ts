// Run: node --experimental-transform-types checks/translation.check.ts (from mra-control)
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Trajectory, TranslationTrajectory, translationTravelSpeed} from '../src/state/trajectories.ts';

// A 4 s straight line from the start, 1 m along x
class Line extends Trajectory {
	start: THREE.Vector3;

	constructor(start: THREE.Vector3) {
		super(4);
		this.start = start;
	}

	evaluate(t: number) {
		return this.start.clone().add(new THREE.Vector3(t, 0, 0));
	}
}

const near = (a: THREE.Vector3, b: THREE.Vector3) => a.distanceTo(b) < 1e-9;
const start = new THREE.Vector3(1, 2, 0.5);
const offset = new THREE.Vector3(0, 3, 4); // 5 m away
const translated = new TranslationTrajectory(start, new Line(start), offset);

const travel = 5 / translationTravelSpeed;
assert.equal(translated.travelDuration, travel);
assert.equal(translated.duration, travel + 4);

// Starts where the robot is: no jump
assert.ok(near(translated.evaluate(0), start));
// Reaches the shifted start when the travel ends, and continues smoothly into the shifted path
const handOff = travel / translated.duration;
assert.ok(near(translated.evaluate(handOff), start.clone().add(offset)));
assert.ok(translated.evaluate(handOff - 1e-6).distanceTo(translated.evaluate(handOff + 1e-6)) < 1e-4);
// Ends at the original end plus the offset
assert.ok(near(translated.evaluate(1), start.clone().add(new THREE.Vector3(1, 0, 0)).add(offset)));
// Never mutates the original trajectory's start
assert.ok(near(new Line(start).evaluate(0), new THREE.Vector3(1, 2, 0.5)));

// No offset: just the original path
const unmoved = new TranslationTrajectory(start, new Line(start), new THREE.Vector3());
assert.equal(unmoved.duration, 4);
assert.ok(near(unmoved.evaluate(0.5), start.clone().add(new THREE.Vector3(0.5, 0, 0))));

console.log('translation ok');
