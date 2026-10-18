import {type PerspectiveCamera, Vector3} from 'three';

const right = new Vector3();
const up = new Vector3();

// Moves the camera and the point it orbits across the screen so the scene follows the fingers, like scrolling a page:
// a scroll of (dx, dy) pixels moves whatever is at the orbit point by (-dx, -dy) pixels
export const panView = (camera: PerspectiveCamera, target: Vector3, dx: number, dy: number, screenHeight: number) => {
	camera.updateMatrix();
	// How much one pixel covers at the orbit point's distance
	const perPixel = 2 * camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360) / screenHeight;
	right.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(dx * perPixel);
	up.setFromMatrixColumn(camera.matrix, 1).multiplyScalar(-dy * perPixel);
	camera.position.add(right).add(up);
	target.add(right).add(up);
};
