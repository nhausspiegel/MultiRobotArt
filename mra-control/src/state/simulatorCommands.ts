/**
 * The idea of this file is to contain all of the JavaScript commands that
 * will exported by the Blockly JavaScript exporter, and be evaluated in
 * the actual JavaScript context.
 *
 * Note: Due to scope issues, they _may_ have to be specifically defined locally in the context of the `eval` function.
 */

import {useSimulator} from '@MRAControl/state/useSimulator';
import {Vector3, Color} from 'three';
import {AddTrajectories, CircleTrajectory, ComponentTrajectory, Hover, NegateTrajectory, NullTrajectory, ParametricTrajectory, RotationTrajectory, SequenceTrajectory, StretchTrajectory, TranslationTrajectory, type Trajectory} from './trajectories';

export type SimulatorGroupState = {
	robotIDs: string[];
};

export const toRadians = (degrees: number): number => {
	return degrees / 180 * Math.PI;
};

export const goToXyzSpeed = (groupState: SimulatorGroupState, x: number, y: number, z: number, speed: number) => {
	var duration = 0;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		var currPosition;
		if (useSimulator.getState().robots[robotId] == undefined) {
			currPosition = new Vector3(0, 0, 0);
		} else {
			var pos = useSimulator.getState().robots[robotId].pos;
			currPosition = new Vector3(pos.x, pos.y, pos.z);
		}

		var currDuration = currPosition.distanceTo(new Vector3(x, y, z)) / speed;
		duration = Math.max(currDuration, duration);
		const newTrajectory = useSimulator.getState().robotGoTo(robotId, new Vector3(x, y, z), new Vector3(0, 0, 0), new Vector3(0, 0, 0), currDuration);
		//useSimulator.getState().updateTrajectory(robotId, newTrajectory, duration);
		trajectories.set(robotId, newTrajectory);
	});
	return [duration, trajectories];
};

// The color is part of the trajectory, so it changes when the trajectory plays (advance() applies it), also when it's
// inside a modifier
// (There is actually a cost to switching LEDs: 0.1 s.)
export const setColor = (groupState: SimulatorGroupState, r = 0, g = 0, b = 0) => hover(groupState, 0.1, new Color(r, g, b));

// The robots hold where they are for the duration, changing color at the start if one is given
export const hover = (groupState: SimulatorGroupState, duration: number, color?: Color): [number, Map<string, Trajectory>] => {
	const trajectories = new Map<string, Trajectory>();
	groupState.robotIDs.forEach((robotId) => {
		const robot = useSimulator.getState().robots[robotId];
		if (robot) trajectories.set(robotId, new Hover(robot.pos.clone(), duration, color));
	});
	return [duration, trajectories];
};

export const goToXyzDuration = (groupState: SimulatorGroupState, x: number, y: number, z: number, duration: number) =>{
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		const newTrajectory = useSimulator.getState().robotGoTo(robotId, new Vector3(x, y, z), new Vector3(0, 0, 0), new Vector3(0, 0, 0), duration);
		trajectories.set(robotId, newTrajectory);
		// useSimulator.getState().updateTrajectory(robotId, newTrajectory, duration);
	});
	return [duration, trajectories];
};

export const land = (groupState: SimulatorGroupState, height: number, duration: number) => {
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		var currPosition;
		if (useSimulator.getState().robots[robotId] == undefined) {
			currPosition = new Vector3(0, 0, 0);
		} else {
			var pos = useSimulator.getState().robots[robotId].pos;
			currPosition = new Vector3(pos.x, pos.y, pos.z);
		}

		var goalPosition = currPosition;
		goalPosition.z = height;

		const newTrajectory = useSimulator.getState().robotGoTo(robotId, goalPosition, new Vector3(0, 0, 0), new Vector3(0, 0, 0), duration);
		//useSimulator.getState().updateTrajectory(robotId, newTrajectory, duration);
		trajectories.set(robotId, newTrajectory);
	});
	return [duration, trajectories];
};

export const takeoff = (groupState: SimulatorGroupState, height: number, duration: number) => {
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		var currPosition;
		if (useSimulator.getState().robots[robotId] == undefined) {
			currPosition = new Vector3(0, 0, 0);
		} else {
			var pos = useSimulator.getState().robots[robotId].pos;
			currPosition = new Vector3(pos.x, pos.y, pos.z);
		}

		var goalPosition = currPosition;
		goalPosition.z = height;
		const newTrajectory = useSimulator.getState().robotGoTo(robotId, goalPosition, new Vector3(0, 0, 0), new Vector3(0, 0, 0), duration);
		//useSimulator.getState().updateTrajectory(robotId, newTrajectory, duration);
		trajectories.set(robotId, newTrajectory);
	});
	return [duration, trajectories];
};

export const moveSpeed = (groupState: SimulatorGroupState, x: number, y: number, z: number, speed: number) =>{
	var duration = 0;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		var currPosition;
		if (useSimulator.getState().robots[robotId] == undefined) {
			currPosition = new Vector3(0, 0, 0);
		} else {
			var pos = useSimulator.getState().robots[robotId].pos;
			currPosition = new Vector3(pos.x, pos.y, pos.z);
		}

		var goalPosition = currPosition;
		goalPosition.x += x;
		goalPosition.y += y;
		goalPosition.z += z;
		const currDuration = new Vector3(x, y, z).length() / speed; 
		const newTrajectory = useSimulator.getState().robotGoTo(robotId, goalPosition, new Vector3(0, 0, 0), new Vector3(0, 0, 0), currDuration);
		duration = Math.max(currDuration, duration);
		trajectories.set(robotId, newTrajectory);
		//useSimulator.getState().updateTrajectory(robotId, newTrajectory, duration);
	});
	return [duration, trajectories];
};

export const moveCircleVel = (groupState: SimulatorGroupState, radius: number, velocity: number, degrees: number, direction: any): [number, Map<string, Trajectory>] =>{
	var duration = 0;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	// console.log('Circle!')
	groupState.robotIDs.forEach((robotId) =>{
		const axes = ['Y', 'Z'];
		const radians = toRadians(degrees);
		const clockwise = true;
		const arclength = Math.abs(radius * (radians));
		duration = arclength / velocity;
		// console.log('duration', duration, 'arclength', arclength)
		const circleTraj = useSimulator.getState().robotCircle(robotId, radius, axes, radians, clockwise, duration);
		trajectories.set(robotId, circleTraj);
		// useSimulator.getState().updateTrajectory(robotId, circleTraj, duration);
	});
	return [duration, trajectories];
};


export const dummy = (groupState: SimulatorGroupState) => {
	let duration = .1;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) =>{
		let trajectory = new NullTrajectory();
		trajectories.set(robotId, trajectory); 
	});	
	return [0.1, new NullTrajectory()];
}; // non-zero duration so it's not hidden


export const componentTraj = (groupState: SimulatorGroupState, [durX, trajX]: [number, Map<string, Trajectory>],
	[durY, trajY]: [number, Map<string, Trajectory>], [durZ, trajZ]: [number, Map<string, Trajectory>]): [number, Map<string, Trajectory>] => {
	//Duration is the max of the sums of all durations for one component
	let duration = Math.max(durX, durY, durZ);
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) =>{
		let trajectory = new ComponentTrajectory(duration, durX, trajX.get(robotId)!, durY, trajY.get(robotId)!, durZ, trajZ.get(robotId)!);
		trajectories.set(robotId, trajectory); 
	});
	return [duration, trajectories];
};

export const moveCircleArcVel = (groupState: SimulatorGroupState, radius: number, velocity: number, degreesStart: number, degreesEnd: number, direction: boolean): [number, Map<string, Trajectory>] => {
	let arcLength = 0;
	let arcAngle = 0;
	let zeroedAngles = [degreesStart - Math.min(degreesStart, degreesEnd), degreesEnd - Math.min(degreesStart, degreesEnd)];
	if (direction) { //Clockwise
		arcAngle = 360 - Math.max(...zeroedAngles);
	} else {
		arcAngle = Math.max(...zeroedAngles);
	}

	// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
	arcLength = Math.abs(radius *  arcAngle * Math.PI / 180.);
	let duration = arcLength / velocity;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	const robots = useSimulator.getState().robots;
	groupState.robotIDs.forEach((robotId) =>{
		//let trajectory = new ComponentTrajectory(duration, durX, trajX.get(robotId), durY, trajY.get(robotId), durZ, trajZ.get(robotId));
		const initPos = robots[robotId].pos;
		// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
		let trajectory = new CircleTrajectory(duration, initPos, radius, ['Y', 'Z'], arcAngle * Math.PI / 180., true, degreesStart, degreesEnd);
		trajectories.set(robotId, trajectory); 
	});
	return [duration, trajectories];
};

export const makeParametricTrajectory = (groupState: SimulatorGroupState, x: string, y: string, z: string, startT: number, endT: number, duration: number): [number, Map<string, Trajectory>] => {
	const robots = useSimulator.getState().robots;
	const trajectories: Map<string, Trajectory> = new Map<string, Trajectory>();
	groupState.robotIDs.forEach((robotId) => {
		trajectories.set(robotId, new ParametricTrajectory(robots[robotId].pos, x, y, z, startT, endT, duration));
	});
	return [duration, trajectories];
};

type Command = () => [number, Map<string, Trajectory>];

// A modifier's commands as one trajectory per robot: they run one after another, each as if the robot were where the one
// before it ends, and the modifier then changes all of them together. Commands read the robot's position from the store,
// so it's moved there for each one and put back after.
export const sequence = (groupState: SimulatorGroupState, commands: Command[]): [number, Map<string, Trajectory>] => {
	const trajectories = new Map<string, Trajectory>();
	let duration = 0;
	const placeRobot = (robotId: string, position: Vector3) => {
		useSimulator.setState((state) => {
			state.robots[robotId].pos = position;
		});
	};

	groupState.robotIDs.forEach((robotId) => {
		const robot = useSimulator.getState().robots[robotId];
		if (!robot) return;
		const start = robot.pos;
		const pieces: Trajectory[] = [];
		try {
			commands.forEach((command) => {
				const piece = command()[1].get(robotId);
				if (!piece) return;
				pieces.push(piece);
				if (piece.duration > 0) placeRobot(robotId, piece.evaluate(1).clone());
			});
		} finally {
			placeRobot(robotId, start);
		}

		const trajectory = new SequenceTrajectory(pieces, start);
		trajectories.set(robotId, trajectory);
		duration = Math.max(duration, trajectory.duration);
	});
	return [duration, trajectories];
};

export const negateTrajectory = (groupState: SimulatorGroupState, [duration, originalTrajectory]: [number, Map<string, Trajectory>]): [number, Map<string, Trajectory>] => {
	const robots = useSimulator.getState().robots;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		const initPos = robots[robotId].pos;
		let originalTrajectoryValue = originalTrajectory.get(robotId);
		if (originalTrajectoryValue) {
			let trajectory = new NegateTrajectory(initPos, originalTrajectoryValue);
			trajectories.set(robotId, trajectory);
		}
	});
	return [duration, trajectories];
};

export const addTrajectories = (groupState: SimulatorGroupState, [firstDuration, firstTrajectory]: [number, Map<string, Trajectory>], [secondDuration, secondTrajectory]: [number, Map<string, Trajectory>], add: boolean) => {
	const robots = useSimulator.getState().robots;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		const initPos = robots[robotId].pos;
		let firstTrajectoryForRobot = firstTrajectory.get(robotId);
		let secondTrajectoryForRobot = secondTrajectory.get(robotId);
		if (firstTrajectoryForRobot && secondTrajectoryForRobot) {
			let trajectory = new AddTrajectories(initPos, firstTrajectoryForRobot, secondTrajectoryForRobot, add);
			trajectories.set(robotId, trajectory);
		}
	});
	return [Math.max(firstDuration, secondDuration), trajectories];
};

export const stretchTrajectory = (groupState: SimulatorGroupState, [duration, traj]: [number, Map<string, Trajectory>], xStretch: number, yStretch: number, zStretch: number, tStretch: number): [number, Map<string, Trajectory>] => {
	const robots = useSimulator.getState().robots;
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	groupState.robotIDs.forEach((robotId) => {
		let originalTrajectory = traj.get(robotId);
		if (originalTrajectory) {
			let trajectory = new StretchTrajectory(robots[robotId].pos, originalTrajectory, xStretch, yStretch, zStretch, tStretch);
			trajectories.set(robotId, trajectory);
		}
	});
	return [duration * tStretch, trajectories];
};

export const rotateTrajectory = (groupState: SimulatorGroupState, [duration, traj]: [number, Map<string, Trajectory>], xRotation: number, yRotation: number, zRotation: number): [number, Map<string, Trajectory>] => {
	let trajectories: Map<string, Trajectory> = new Map<string, Trajectory>;
	const robots = useSimulator.getState().robots;
	groupState.robotIDs.forEach((robotId) => {
		let originalTrajectory = traj.get(robotId);
		if (originalTrajectory) {
			const initialPosition = robots[robotId].pos;
			let trajectory = new RotationTrajectory(initialPosition, originalTrajectory, xRotation, yRotation, zRotation);
			trajectories.set(robotId, trajectory);
		}
	});
	return [duration, trajectories];
};
export const translateTrajectory = (groupState: SimulatorGroupState, [duration, traj]: [number, Map<string, Trajectory>], x: number, y: number, z: number): [number, Map<string, Trajectory>] => {
	const trajectories: Map<string, Trajectory> = new Map<string, Trajectory>();
	const robots = useSimulator.getState().robots;
	let totalDuration = duration;
	groupState.robotIDs.forEach((robotId) => {
		const originalTrajectory = traj.get(robotId);
		if (originalTrajectory) {
			const trajectory = new TranslationTrajectory(robots[robotId].pos, originalTrajectory, new Vector3(x, y, z));
			trajectories.set(robotId, trajectory);
			totalDuration = trajectory.duration;
		}
	});
	return [totalDuration, trajectories];
};
