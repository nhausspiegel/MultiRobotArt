// Run: node --experimental-strip-types checks/trackpad.check.ts (from mra-control)
import assert from 'node:assert/strict';
import {PerspectiveCamera, Vector3} from 'three';
import {panView} from '../src/layout/simulation/trackpad.ts';

// Where a point shows on an 800 x 600 screen, in pixels from the top left
const onScreen = (camera: PerspectiveCamera, point: Vector3) => {
	camera.updateMatrixWorld();
	const p = point.clone().project(camera);
	return [(p.x + 1) * 400, (1 - p.y) * 300];
};
const near = (a: number[], b: number[]) => a.every((value, i) => Math.abs(value - b[i]) < 1e-6);

const camera = new PerspectiveCamera(75, 800 / 600);
camera.up.set(0, 0, 1);
camera.position.set(-5, 1, 2);
const target = new Vector3(0.3, 0.2, 0.5);
camera.lookAt(target);
const point = target.clone();
const offset = camera.position.clone().sub(target);

// Scrolling right 30 and up 20 moves the scene left 30 and down 20, and keeps the view's angle and distance
panView(camera, target, 30, -20, 600);
assert.ok(near(onScreen(camera, point), [370, 320]), String(onScreen(camera, point)));
assert.ok(camera.position.clone().sub(target).distanceTo(offset) < 1e-9);
console.log('trackpad ok');
