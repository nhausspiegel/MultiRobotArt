/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
// @ts-nocheck

import * as THREE from 'three';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Queue } from 'queue-typescript';
import { type SimulatorGroupState } from './simulatorCommands';
import * as SIM from './simulatorCommands';
import { type RobotState, useRobartState } from './useRobartState';
import * as traj from './trajectories';
import { type ConstraintWarning, useCrazyflieConstraintState } from './useConstraintState';
export const fps = 60;

// type TrajectoryPolynomial =
//   | [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
//   | null;

// export interface Trajectory {
//   polynomial: TrajectoryPolynomial;
//   duration: number;
// }

export type RobotSimState = {
	id: string;
	boundingBox?: THREE.Box3;
	pos: THREE.Vector3;
	vel: THREE.Vector3;
	acc: THREE.Vector3;
	color: THREE.Color;
	trajectories: Map<string, traj.Trajectory[]>;
	trajectory: traj.Trajectory | undefined;
	trajectoryDuration: number;
	timeAlongTrajectory: number;
	trajectoryStartTime: number;
	trajectoryQueue: Queue<{ line: string; itemId: string }>;
};

export type TrajectorySimState = {
	robotId: string;
	trajectory: traj.Trajectory | undefined;
	startTime: number;
	duration: number;
};

export type SimulatorState = {
	robots: Record<string, RobotSimState>;
	trajectories: Map<string, TrajectorySimState[]>;
	time: number;
	timeDilation: number;
	status: 'RUNNING' | 'STOPPED' | 'PAUSED';
	renderBoundingBoxes: boolean;
	showCoordinates: boolean;
	trajectoryQueue: Queue<string>;
	trajectoryMarkers: Array<{ position: THREE.Vector3; color: THREE.Color; id: string }>;
	markerFrequency: number;
	lastStepTime: number;
	/**
   * Sim time at which the show finishes, measured when it starts. 0 until measured.
   */
	endTime: number;
};

const defaultSimulatorState: SimulatorState = {
	robots: {},
	time: 0,
	timeDilation: 1,
	trajectories: new Map<string, TrajectorySimState[]>(),
	status: 'STOPPED',
	renderBoundingBoxes: true,
	showCoordinates: false,
	trajectoryQueue: new Queue<string>(),
	trajectoryMarkers: [],
	markerFrequency: 0.25,
	lastStepTime: performance.now(),
	endTime: 0,
};

const nullTrajectory = new traj.PolynomialTrajectory(-1, []) as traj.Trajectory;

// Timeline items not started yet, sorted by start time (sim seconds). advance() starts them when the sim reaches them.
const pendingItems: Array<{ itemId: string; time: number; robotIds: string[]; lines: string[] }> = [];

// Which timeline item each robot's current trajectory came from, and the last sim time each item kept a robot busy.
// Used to measure how long timeline items really take.
const runningItemIds: Record<string, string> = {};
let itemEndTimes: Record<string, number> = {};

// Block code -> its length run alone, so blocks are only re-timed when their code changes
const blockLengthCache = new Map<string, number>();

// Upper bound when measuring a show's length, in case something never finishes (lanes are 120 s long)
const maxShowLength = 10 * 60;

// Nothing left to start, queue, or fly
const isFinished = (robots: Record<string, RobotSimState>) =>
	pendingItems.length === 0 &&
	Object.values(robots).every((robot) => robot.trajectoryQueue.length === 0 && !(robot.trajectory?.duration > 0));

export type SimulatorActions = {
	play: () => void;
	pause: () => void;
	resume: () => void;
	halt: () => void;
	step: () => void;
	/**
   * Moves the simulation forward by deltaT sim seconds.
   */
	advance: (deltaT: number) => void;
	/**
   * Jumps the simulation to the given sim time, replaying from the start when going backwards.
   */
	seek: (time: number) => void;
	/**
   * Runs the whole show without rendering to find endTime, then resets to the start.
   */
	measureShowLength: () => void;
	/**
   * Runs one block's code alone, without rendering, and returns how long it takes. Leaves the simulator dirty;
   * callers reset it.
   */
	measureBlockLength: (javaScript: string) => number;
	setTimeDilation: (timeDilation: number) => void;
	toggleCoordinates: () => void;
	/**
   * Can only be used when simulator is STOPPED mode.
   * @param robots
   * @returns
   */
	setRobots: (robots: Record<string, RobotState>) => void;
	updateRobotBoundingBox: (robotId: string, boundingBox: THREE.Box3) => void;
	checkCollisions: (robotId: string) => boolean;
	updateTrajectory: (robotId: string, trajectory: traj.Trajectory, duration: number) => void;
	addTrajectory: (robotId: string, trajectory: string, itemId: string) => void;
	getMostRecentTrajectory: (robotId: string, time: number) => [traj.Trajectory | undefined, number];
	robotGoTo: (robotId: string, position: THREE.Vector3, velocity: THREE.Vector3, acceleration: THREE.Vector3, duration: number) => traj.Trajectory;
	robotCircle: (robotId: string, radius?: number, axes?: string[], radians?: number, clockwise?: boolean, duration?: number) => traj.Trajectory;
	executeSimulation: (startTime: number) => void;
	cancelSimulation: () => void;
	/**
   * Stops the simulation and reloads robots from the project, e.g. after robots are deleted or a project is loaded.
   */
	reset: () => void;
};
export const useSimulator = create<SimulatorState & SimulatorActions>()(
	immer((set, get) => ({
		...defaultSimulatorState,
		play: () => {
			// Also resets robots to their initial positions
			get().measureShowLength();
			set({ status: 'RUNNING', lastStepTime: performance.now() });
		},
		pause: () => {
			const warnings: ConstraintWarning[] | undefined = useCrazyflieConstraintState.getState().checkConstraints(Object.keys(get().robots));
			let reprs = warnings?.map((warning) => {
				return warning.repr;
			});
			const state = useRobartState.getState();
			useRobartState.setState({ warnings: reprs ?? [] }); // undefined when nothing was recorded; the Warnings tab joins this list

			set({ status: 'PAUSED' });
		},
		resume: () => {
			// Reset lastStepTime so the paused duration isn't simulated on the next step
			set({ status: 'RUNNING', lastStepTime: performance.now() });
		},
		halt: () => {
			const warnings: ConstraintWarning[] | undefined = useCrazyflieConstraintState.getState().checkConstraints(Object.keys(get().robots));
			let reprs = warnings?.map((warning) => {
				return warning.repr;
			});
			const state = useRobartState.getState();
			useRobartState.setState({ warnings: reprs ?? [] }); // undefined when nothing was recorded; the Warnings tab joins this list

			set({ status: 'STOPPED' });
			get().cancelSimulation();
		},
		step: () => {
			if (get().status !== 'RUNNING') return;
			const currentTime = performance.now();
			get().advance((currentTime - get().lastStepTime) / 1000 * get().timeDilation);
			set({ lastStepTime: currentTime });
			if (isFinished(get().robots)) get().halt();
		},
		advance: (deltaT) => {
			const newSimTime = get().time + deltaT;

			// Start the timeline items the sim has reached
			while (pendingItems.length > 0 && pendingItems[0].time <= newSimTime) {
				const item = pendingItems.shift();
				item.lines.forEach((line) => {
					item.robotIds.forEach((robotId) => {
						get().addTrajectory(robotId, line, item.itemId);
					});
				});
			}

			const { time, robots: currentRobots, markerFrequency } = get();
			const trajectoryMarkers = get().trajectoryMarkers.slice();
			const robots = { ...currentRobots };

			const simulator = SIM;


			const state = useCrazyflieConstraintState.getState();

			const positionHistory = state.positionHistory;
			positionHistory.push({ timestep: newSimTime, robotPositions: [] });
			// update trajectories from most recent trajectory
			Object.keys(robots).forEach((robotId) => {
				if (robots[robotId] == undefined)
					return;

				// Every robot in a group has the group's lines queued, so each line runs for its own robot only.
				// Must be named groupState: the eval'd block code references it.
				const groupState: SimulatorGroupState = {
					robotIDs: [robotId],
				};

				if (robots[robotId].timeAlongTrajectory >= 1) {
					//switch trajectories
					let newTraj: Map<string, traj.Trajectory>;
					let duration = 0;
					if (robots[robotId].trajectoryQueue.length > 0) {
						const next = robots[robotId].trajectoryQueue.dequeue();
						runningItemIds[robotId] = next.itemId;
						[duration, newTraj] = eval(next.line);
						get().updateTrajectory(robotId, newTraj.get(robotId), duration);
					} else {
						get().updateTrajectory(robotId, new traj.NullTrajectory(), -1);
					}
				} else if (robots[robotId].trajectoryQueue.length > 0 && robots[robotId].trajectory.duration <= 0) {
					let newTraj: Map<string, traj.Trajectory>;
					let duration = 0;
					const next = robots[robotId].trajectoryQueue.dequeue();
					runningItemIds[robotId] = next.itemId;
					[duration, newTraj] = eval(next.line);
					get().updateTrajectory(robotId, newTraj.get(robotId), duration);
				}


				// if trajectory doesn't exist or has non-positive duration, do nothing
				if (get().robots[robotId]?.trajectory.duration === undefined || get().robots[robotId].trajectory.duration <= 0) {
					return;
				}

				const trajectoryTime = get().robots[robotId].timeAlongTrajectory + deltaT / get().robots[robotId].trajectory?.duration;
				const newPos = get().robots[robotId].trajectory.evaluate(trajectoryTime);
				itemEndTimes[runningItemIds[robotId]] = newSimTime;

				const offset = newPos.clone().sub(get().robots[robotId].pos);
				robots[robotId] = {
					...robots[robotId],
					pos: newPos,
					boundingBox: get().robots[robotId].boundingBox?.clone().translate(offset),
					timeAlongTrajectory: trajectoryTime,
					trajectory: get().robots[robotId].trajectory,
					trajectoryStartTime: get().robots[robotId].trajectoryStartTime,
				};
				// TODO: switch to next trajectory if available...
				if (robots[robotId].timeAlongTrajectory >= 1) {
					robots[robotId].trajectory = nullTrajectory;
					robots[robotId].timeAlongTrajectory = 0;
				}

				if (positionHistory) {
					const currTimestep = positionHistory[positionHistory.length - 1];
					currTimestep.robotPositions[robotId] = newPos;
				}

				robots[robotId].color = get().robots[robotId].color;

				if (markerFrequency !== 0 && time % markerFrequency < deltaT) {
					trajectoryMarkers.push({ position: new THREE.Vector3().copy(robots[robotId].pos), color: robots[robotId].color, id: robotId + time });
				}
				// Do not delete! Needed to keep variables from being removed for being unused
				if (time > 99999) {
					console.log(groupState, simulator);
				}
			});

			set({
				robots,
				time: newSimTime,
				trajectoryMarkers: trajectoryMarkers,
			});
		},
		seek: (targetTime) => {
			const wasRunning = get().status === 'RUNNING';
			if (get().status === 'STOPPED') {
				get().measureShowLength();
			} else if (targetTime < get().time) {
				// The sim only runs forward, so going back means replaying from the start
				get().executeSimulation(0);
			}
			// ponytail: replays in 1/fps steps, can lag on long shows; cache snapshots if it does
			while (get().time < targetTime - 1e-6) {
				get().advance(Math.min(1 / fps, targetTime - get().time));
			}
			set({ status: wasRunning ? 'RUNNING' : 'PAUSED', lastStepTime: performance.now() });
		},
		measureShowLength: () => {
			get().executeSimulation(0);
			while (!isFinished(get().robots) && get().time < maxShowLength) {
				get().advance(1 / fps);
			}
			const endTime = get().time;

			// Timeline items are drawn this long. Items on lanes without robots never run and keep their old length.
			const { groups } = useRobartState.getState().timelineState;
			const durations: Record<string, number> = {};
			Object.values(groups).forEach((group) => {
				Object.values(group.items).forEach((item) => {
					if (itemEndTimes[item.id] !== undefined) durations[item.id] = Math.max(0.1, itemEndTimes[item.id] - item.startTime);
				});
			});

			// Each block's own length, so the drop preview is right before the block is on the timeline
			const blockLengths: Record<string, number> = {};
			Object.values(useRobartState.getState().blocks).forEach((block) => {
				if (!blockLengthCache.has(block.javaScript)) blockLengthCache.set(block.javaScript, get().measureBlockLength(block.javaScript));
				blockLengths[block.id] = blockLengthCache.get(block.javaScript);
			});

			get().executeSimulation(0);
			set({ endTime });
			useRobartState.getState().setMeasuredDurations(durations, blockLengths);
		},
		measureBlockLength: (javaScript) => {
			// A stand-in robot on the ground at the origin. Only an estimate for position-dependent blocks (e.g. go to at a speed);
			// the in-context length replaces it once the block is on the timeline.
			set({ time: 0, trajectoryMarkers: [] });
			get().setRobots({ standIn: { id: 'standIn', name: 'standIn', type: 'crazyflie', startingPosition: [0, 0, 0] } });
			itemEndTimes = {};
			pendingItems.length = 0;
			pendingItems.push({ itemId: 'standIn', time: 0, robotIds: ['standIn'], lines: javaScript.split('\n').filter((line) => line.length > 0) });
			while (!isFinished(get().robots) && get().time < maxShowLength) {
				get().advance(1 / fps);
			}
			return Math.max(0.1, itemEndTimes.standIn ?? 0);
		},
		setTimeDilation: (timeDilation) => {
			set({ timeDilation });
		},
		toggleCoordinates: () => {
			set({ showCoordinates: !get().showCoordinates });
		},
		setRobots: (robots) => {
			const simRobots: Record<string, RobotSimState> = {};
			const bboxSize = new THREE.Vector3(0.2, 0.2, 0.35);
			Object.values(robots).forEach((robot) => {
				const position = new THREE.Vector3(robot.startingPosition[0], robot.startingPosition[1], robot.startingPosition[2])
				simRobots[robot.id] = {
					id: robot.id,
					// boundingBox: new THREE.Box3(),
					pos: new THREE.Vector3(...robot.startingPosition),
					vel: new THREE.Vector3(),
					acc: new THREE.Vector3(),
					color: new THREE.Color(255, 255, 255),
					timeAlongTrajectory: 0,
					trajectory: nullTrajectory,
					trajectoryDuration: -1,
					trajectories: new Map<string, traj.Trajectory[]>,
					trajectoryStartTime: -1,
					trajectoryQueue: new Queue<{ line: string; itemId: string }>,
					boundingBox: new THREE.Box3(position.clone().sub(bboxSize), position.clone().add(bboxSize)),

				};
				// simRobots[robot.id].boundingBox?.setFromObject()
			});
			set({ robots: simRobots });
		},
		updateRobotBoundingBox: (robotId, boundingBox) => {
			set((state) => {
				if (state.robots[robotId] !== undefined)
					state.robots[robotId].boundingBox = boundingBox;
			});
		},
		checkCollisions: (robotId) => {
			const thisRobot = get().robots[robotId];
			const robots = Object.entries(get().robots);

			if (thisRobot.boundingBox === undefined) return false;

			return robots.some(([otherRobotId, otherRobot]) => {
				// there's a collision if
				// 1. the other robot is not this robot
				// 2. the other robot has a bounding box
				// 3. this robot has a bounding box
				// 4. the bounding boxes intersect

				if (
					otherRobotId !== robotId &&
					otherRobot.boundingBox &&
					thisRobot.boundingBox &&
					thisRobot.boundingBox.intersectsBox(otherRobot.boundingBox)
				)
					return (
						otherRobotId !== robotId && otherRobot.boundingBox && thisRobot.boundingBox && thisRobot.boundingBox.intersectsBox(otherRobot.boundingBox)
					);
			});
		},
		updateTrajectory: (robotId, trajectory, duration) => {
			set((state) => {
				if (state.robots[robotId] !== undefined)
					state.robots[robotId].timeAlongTrajectory = 0;
				state.robots[robotId].trajectory = trajectory;
				state.robots[robotId].trajectoryDuration = duration;
				state.robots[robotId].trajectoryStartTime = state.time;
			});
		},
		addTrajectory: (robotId, javascriptLine, itemId) => {
			// Add trajectory to trajectories Map
			set((state) => {
				if (state.robots[robotId] !== undefined)
					state.robots[robotId].trajectoryQueue.enqueue({ line: javascriptLine, itemId });
			});
		},
		getMostRecentTrajectory: (robotId: string, time: number): [traj.Trajectory | undefined, number] => {
			const trajectories = get().trajectories.get(robotId);
			var mostRecentTime = 0;
			var mostRecentTraj: traj.Trajectory | undefined = undefined;
			trajectories?.forEach((trajectory) => {
				if (trajectory.startTime - time < 0 && trajectory.startTime > mostRecentTime) {
					mostRecentTime = trajectory.startTime;
					mostRecentTraj = trajectory.trajectory;
				}
			});
			return [mostRecentTraj, mostRecentTime];
		},
		robotGoTo: (robotId, pos, vel, acc, duration) => {

			const robot = get().robots[robotId];
			if (robot === undefined) {
				return nullTrajectory;
			}

			// Degree 7 Polynomial solution to IVP
			const a0 = robot.pos.clone();
			const a1 = robot.vel.clone();
			const a2 = robot.acc.clone().multiplyScalar(0.5);
			const a3 = new THREE.Vector3();
			const a4 = robot.acc
				.clone()
				.multiplyScalar(2)
				.addScaledVector(acc, -1)
				.addScaledVector(robot.vel, 8)
				.addScaledVector(vel, 6)
				.addScaledVector(robot.pos, 14)
				.addScaledVector(pos, -14)
				.multiplyScalar(-2.5);
			const a5 = robot.acc
				.clone()
				.multiplyScalar(10)
				.addScaledVector(acc, -7)
				.addScaledVector(robot.vel, 45)
				.addScaledVector(vel, 39)
				.addScaledVector(robot.pos, 84)
				.addScaledVector(pos, -84);
			const a6 = robot.acc
				.clone()
				.multiplyScalar(-15)
				.addScaledVector(acc, 13)
				.addScaledVector(robot.vel, -72)
				.addScaledVector(vel, -68)
				.addScaledVector(robot.pos, -140)
				.addScaledVector(pos, 140)
				.multiplyScalar(0.5);
			const a7 = robot.acc
				.clone()
				.addScaledVector(acc, -1)
				.addScaledVector(robot.vel, 5)
				.addScaledVector(vel, 5)
				.addScaledVector(robot.pos, 10)
				.addScaledVector(pos, -10)
				.multiplyScalar(2);

			return (new traj.PolynomialTrajectory(duration, [a0, a1, a2, a3, a4, a5, a6, a7])) as traj.Trajectory;
		},
		robotCircle: (robotId: string, radius = 1, axes = ['Y', 'Z'], radians = 2 * Math.PI, clockwise = false, duration = 1): traj.Trajectory => {
			const robot = get().robots[robotId];
			const trajectory = new traj.CircleTrajectory(duration, robot.pos, radius, axes, radians, clockwise);
			return trajectory as traj.Trajectory;
		},
		executeSimulation: (startTime) => {
			// if(startTime === 0){
			//   const robartRobots = useRobartState().robots;
			//   get().setRobots(robartRobots);
			// }
			const timeline = useRobartState.getState().timelineState;
			const blocks = useRobartState.getState().blocks;
			const robartRobots = useRobartState.getState().robots;
			if (startTime === 0) {
				set({ time: 0, trajectoryMarkers: [] });
				get().setRobots(robartRobots);
				useRobartState.setState({ warnings: [] }); // setState, not assignment, so the Warnings tab updates
				// Constraint warnings are computed from this; without the reset they repeat across runs and replays
				useCrazyflieConstraintState.setState({ positionHistory: [] });
				itemEndTimes = {};
			}
			pendingItems.length = 0;

			Object.values(timeline.groups).forEach((group) => {
				// Need the following local variables so that the EVAL works properly.
				/*const groupState: SimulatorGroupState = {
					robotIDs: Object.keys(group.robots),
				};
				const simulator = SIM; // This is the simulator object for commands, necessary for the eval to work.*/
				// END: The need of said local variables

				Object.values(group.items).forEach(timelineItem => {
					if (timelineItem.startTime < startTime) return;

					pendingItems.push({
						itemId: timelineItem.id,
						time: timelineItem.startTime,
						robotIds: Object.keys(group.robots),
						lines: blocks[timelineItem.blockId].javaScript.split('\n').filter((line) => line.length > 0),
					});
				});
			});
			pendingItems.sort((a, b) => a.time - b.time);
		},
		cancelSimulation: () => {
			pendingItems.length = 0;
		},
		reset: () => {
			set({ status: 'STOPPED', endTime: 0 });
			get().executeSimulation(0);
			get().cancelSimulation();
		},
	})),
);
