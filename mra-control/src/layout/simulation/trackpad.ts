import {type PerspectiveCamera, Vector3} from 'three';

const right = new Vector3();
const forward = new Vector3();

// Slides the camera and the point it orbits along the floor, keeping their height, so the floor follows the fingers:
// a scroll of (dx, dy) pixels moves the orbit point by (-dx, -dy) pixels on screen. Moving in the screen's plane
// instead raised and lowered the camera, which made the floor grow and shrink like a zoom.
export const panView = (camera: PerspectiveCamera, target: Vector3, dx: number, dy: number, screenHeight: number) => {
	const distance = camera.position.distanceTo(target);
	// How much one pixel covers at the orbit point's distance
	const perPixel = 2 * distance * Math.tan(camera.fov * Math.PI / 360) / screenHeight;
	// The flatter the view, the further along the floor a pixel reaches
	const sinDown = (camera.position.z - target.z) / distance;
	camera.updateMatrix();
	right.setFromMatrixColumn(camera.matrix, 0); // Level, as the camera never rolls
	forward.crossVectors(camera.up, right);
	right.multiplyScalar(dx * perPixel);
	forward.multiplyScalar(-dy * perPixel / sinDown);
	camera.position.add(right).add(forward);
	target.add(right).add(forward);
};
