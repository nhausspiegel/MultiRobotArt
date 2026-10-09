import * as THREE from 'three';
import Sandbox from '@nyariv/sandboxjs';

// The browser build exports the class directly; the Node build (used by checks/) puts it on .default
const SandboxClass: typeof Sandbox = (Sandbox as unknown as {default?: typeof Sandbox}).default ?? Sandbox;

export abstract class Trajectory {
	constructor(public duration: number) {
		this.duration = duration;
	}

	abstract evaluate(t: number): THREE.Vector3;
}

// export class TrajectoryWrapper extends Trajectory {
// 	traj: Trajectory | undefined;
// 	trajectoryType: new (duration: number) => Trajectory;
// 	args: any[];
// 	constructor(trajectoryType: new (arg: any[]) => Trajectory, ...args: any[]) {
// 		super(-1.0);
// 		this.traj = undefined;
// 		this.trajectoryType = trajectoryType;
// 		this.args = args;
// 	}

// 	evaluate(t: number) {
// 		if (this.traj === undefined) {
// 			this.traj = new this.trajectoryType(this.args);
// 			this.duration = this.traj.duration;
// 		}

// 		return this.traj.evaluate(t);
// 	}
// }

export class NullTrajectory extends Trajectory {
	constructor() {
		super(0.1);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	evaluate(t: number): THREE.Vector3 {
		return new THREE.Vector3();
	}
}

export class Hover extends Trajectory {
	position: THREE.Vector3;
	constructor(position: THREE.Vector3) {
		super(0.1);
		this.position = position;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	evaluate(_t: number): THREE.Vector3 {
		return this.position;
	}
}

export class PolynomialTrajectory extends Trajectory {
	coefs: THREE.Vector3[];
	constructor(duration: number, coefficients: THREE.Vector3[]) {
		super(duration);
		this.coefs = coefficients;
	}

	evaluate(t: number): THREE.Vector3 { 
		const newPos = new THREE.Vector3();
		this.coefs.map((coefficient, i) => {
			newPos.addScaledVector(coefficient, Math.pow(t, i));
		});
		return newPos;
	}
}

export class CircleTrajectory extends Trajectory {
	radius: number;
	axes: string[];
	radians: number;
	clockwise: boolean;
	pos: THREE.Vector3;
	startAngle: number;
	endAngle: number;

	constructor(duration: number, init_pos: THREE.Vector3, radius: number, axes = ['Y', 'Z'], radians = 2 * Math.PI, clockwise = true, startAngle = 0, endAngle = 360) {
		super(duration);
		this.radius = radius;
		this.axes = axes;
		this.radians = radians;
		this.clockwise = clockwise;
		this.pos = init_pos;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
	}

	evaluate(t: number): THREE.Vector3 {
		// As t varies from 0 to 1, complete the desired arclength rotation for a given radius on a given axes
		// subtract 1 from v1 to start at 0, 0
		// console.warn(t)
		const v1 = this.radius * (Math.cos(t * (this.radians)) - 1); // TODO add starting and ending angles.
		const v2 = this.radius * Math.sin(t * (this.radians));
		var x = this.pos.x, y = this.pos.y, z = this.pos.z;
		if (this.axes.some((X) => X === 'X')) {
			x = v1 + this.pos.x;
		} else {
			y = v1 + this.pos.y;
		}

		if (this.axes.some((Z) => Z === 'Z')) {
			z = v2 + this.pos.z;

		} else {
			y = v2 + this.pos.y;
		}

		return new THREE.Vector3(x, y, z);
	}
}

export class ComponentTrajectory extends Trajectory {
	trajX: Trajectory;
	trajY: Trajectory;
	trajZ: Trajectory;

	durX: number;
	durY: number;
	durZ: number;

	durScalingX: number;
	durScalingY: number;
	durScalingZ: number;
	constructor(duration: number, durX: number, trajX: Trajectory, durY: number, trajY: Trajectory, durZ: number, trajZ: Trajectory) {
		super(duration);
		this.trajX = trajX;
		this.trajY = trajY;
		this.trajZ = trajZ;

		this.durX = durX;
		this.durY = durY;
		this.durZ = durZ;

		// Rescale the duration for x, y, z so that it can end midway through the whole trajectory
		// e.g. if two different goto commands are specified for y and z axes 
		this.durScalingX = durX / duration;
		this.durScalingY = durY / duration;
		this.durScalingZ = durZ / duration;
	}
	
	evaluate(t: number): THREE.Vector3 {
		var x = 0, y = 0, z = 0;
		if (t / this.durScalingX > 1) {
			x = this.trajX.evaluate(1).x;
		} else {
			x = this.trajX.evaluate(t / this.durScalingX).x;
		}

		if (t / this.durScalingY > 1) {
			y = this.trajY.evaluate(1).y;
		} else {
			y = this.trajY.evaluate(t / this.durScalingY).y;
		}

		if (t * this.durScalingZ > 1) {
			z = this.trajZ.evaluate(1).z;
		} else {
			z = this.trajZ.evaluate(t / this.durScalingZ).z;
		}

		return new THREE.Vector3(x, y, z);
	}
}

// Names parametric expressions can use, e.g. "sin(t) * 2" or "pow(t, 2)". Same names as parametric() in the exported
// Python. (The expression sandbox has no ** operator, so powers use pow.)
const parametricScope = {
	sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
	sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, log: Math.log,
	pow: Math.pow, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, pi: Math.PI, e: Math.E,
};

// A typo or unknown name gives 0 instead of throwing, which would stop the simulation
export const compileExpression = (expression: string): ((t: number) => number) => {
	try {
		const run = new SandboxClass().compile<number>(`return (${expression});`);
		return (t: number) => {
			try {
				const value = Number(run({...parametricScope, t}).run());
				return Number.isFinite(value) ? value : 0;
			} catch {
				return 0;
			}
		};
	} catch {
		console.warn(`Could not read the expression "${expression}"; using 0`);
		return () => 0;
	}
};

// For the block's text fields: rejects what the simulator can't evaluate (typos, unknown names, the ** operator), so
// it never reaches the exported Python either. ^ is rejected too: it's bitwise in both languages, not a power.
export const isValidExpression = (expression: string): boolean => {
	if (expression.trim() === '' || expression.includes('^')) return false;
	// Only what reads the same in Python: numbers, t, the scope's names, + - * / ( ) and commas. JavaScript-only syntax
	// (?:, <, &&, %, Math.sin) passed the check below but broke or changed meaning in the exported Python.
	if (!/^[\w\s.+\-*/(),]*$/.test(expression)) return false;
	const names = expression.replace(/\b\d+(\.\d*)?(e[+-]?\d+)?\b/gi, '0').match(/[A-Za-z_]\w*/g) ?? [];
	if (names.some((name) => name !== 't' && !(name in parametricScope))) return false;
	try {
		new SandboxClass().compile(`return (${expression});`)({...parametricScope, t: 0}).run();
		return true;
	} catch {
		return false;
	}
};

/**
 * The path (x(t), y(t), z(t)) for t from startT to endT, shifted so it starts at the initial position.
 */
export class ParametricTrajectory extends Trajectory {
	functions: Array<(t: number) => number>;
	startT: number;
	endT: number;
	offset: THREE.Vector3;

	constructor(initPos: THREE.Vector3, x: string, y: string, z: string, startT: number, endT: number, duration: number) {
		super(duration);
		this.functions = [x, y, z].map(compileExpression);
		this.startT = startT;
		this.endT = endT;
		this.offset = initPos.clone().sub(this.pathAt(startT));
	}

	pathAt(t: number): THREE.Vector3 {
		const [x, y, z] = this.functions.map((f) => f(t));
		return new THREE.Vector3(x, y, z);
	}

	evaluate(t: number): THREE.Vector3 {
		return this.pathAt(this.startT + (t * (this.endT - this.startT))).add(this.offset);
	}
}

export class NegateTrajectory extends Trajectory {
	duration: number;
	initPos: THREE.Vector3;
	originalTrajectory: Trajectory;
	constructor(initPos: THREE.Vector3, originalTrajectory: Trajectory) {
		const duration = originalTrajectory.duration;
		super(duration);
		this.duration = duration;
		this.initPos = new THREE.Vector3;
		this.initPos.copy(initPos);
		this.originalTrajectory = originalTrajectory;
	}

	evaluate(t: number): THREE.Vector3 {
		const originalTrajectoryPosition = this.originalTrajectory.evaluate(t);
		const initPos = new THREE.Vector3().copy(this.initPos);
		const desiredPosition = initPos.multiplyScalar(2).sub(originalTrajectoryPosition);
		return desiredPosition;
	}
}

export class AddTrajectories extends Trajectory {
	duration: number;
	firstTrajectory: Trajectory;
	secondTrajectory: Trajectory;
	initPos: THREE.Vector3;
	operation: 'add' | 'subtract';

	constructor(initPos: THREE.Vector3, firstTrajectory: Trajectory, secondTrajectory: Trajectory, add = true) {
		const duration = Math.max(firstTrajectory.duration, secondTrajectory.duration);
		super(duration);
		this.duration = duration;
		this.firstTrajectory = firstTrajectory;
		this.secondTrajectory = secondTrajectory;
		this.operation = add ? 'add' : 'subtract';
		this.initPos = initPos;
	}

	evaluate(t: number): THREE.Vector3 {
		if (this.operation === 'add') {
			return this.firstTrajectory.evaluate(t).add(this.secondTrajectory.evaluate(t)).sub(this.initPos); 
		} else {
			return this.firstTrajectory.evaluate(t).sub(this.secondTrajectory.evaluate(t)).add(this.initPos); 
		}
	}
}

export class StretchTrajectory extends Trajectory {
	duration: number;
	originalTrajectory: Trajectory;
	positionStretch: THREE.Vector3;
	timeStretch: number;
	initialPosition: THREE.Vector3;

	constructor(initialPosition: THREE.Vector3, originalTrajectory: Trajectory, xStretch: number, yStretch: number, zStretch: number, tStretch: number) {
		super(originalTrajectory.duration * tStretch);
		this.duration = originalTrajectory.duration * tStretch;
		this.originalTrajectory = originalTrajectory;
		this.positionStretch = new THREE.Vector3(xStretch, yStretch, zStretch);
		this.timeStretch = tStretch;
		this.initialPosition = initialPosition;
	}

	evaluate(t: number): THREE.Vector3 {
		const originalVal = this.originalTrajectory.evaluate(t)
		const offset = originalVal.sub(this.initialPosition);
		const newOffset = offset.multiply(this.positionStretch);
		return newOffset.add(this.initialPosition);
	}
}

export class RotationTrajectory extends Trajectory {
	duration: number;
	originalTrajectory: Trajectory;
	rotationEuler: THREE.Euler;
	initialPosition: THREE.Vector3;

	constructor(initialPosition: THREE.Vector3, originalTrajectory: Trajectory, xRotation: number, yRotation: number, zRotation: number) {
		super(originalTrajectory.duration);
		this.duration = originalTrajectory.duration;
		this.originalTrajectory = originalTrajectory;
		this.rotationEuler = new THREE.Euler(xRotation, yRotation, zRotation, 'XYZ');
		this.initialPosition = initialPosition;
	}

	evaluate(t: number): THREE.Vector3 {
		return this.originalTrajectory.evaluate(t).sub(this.initialPosition).applyEuler(this.rotationEuler).add(this.initialPosition);
	}
}

// Speed (m/s) of the move to a translated trajectory's start; matches translate() in the exported Python
export const translationTravelSpeed = 0.5;

/**
 * The original trajectory shifted by an offset. It first eases from the starting position to the shifted start, so the
 * robot doesn't jump, then follows the original path plus the offset.
 */
export class TranslationTrajectory extends Trajectory {
	originalTrajectory: Trajectory;
	offset: THREE.Vector3;
	initialPosition: THREE.Vector3;
	travelDuration: number;

	constructor(initialPosition: THREE.Vector3, originalTrajectory: Trajectory, offset: THREE.Vector3) {
		const travelDuration = offset.length() / translationTravelSpeed;
		super(travelDuration + originalTrajectory.duration);
		this.originalTrajectory = originalTrajectory;
		this.offset = offset;
		this.initialPosition = new THREE.Vector3().copy(initialPosition);
		this.travelDuration = travelDuration;
	}

	evaluate(t: number): THREE.Vector3 {
		const elapsed = t * this.duration;
		if (elapsed < this.travelDuration) {
			// Quintic ease in/out: starts and ends at rest
			const u = elapsed / this.travelDuration;
			const ease = u * u * u * (10 - 15 * u + 6 * u * u);
			return this.initialPosition.clone().addScaledVector(this.offset, ease);
		}

		const originalDuration = this.originalTrajectory.duration;
		const originalT = originalDuration > 0 ? Math.min(1, (elapsed - this.travelDuration) / originalDuration) : 1;
		return this.originalTrajectory.evaluate(originalT).clone().add(this.offset);
	}
}
