
import * as THREE from 'three';

import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {immer} from 'zustand/middleware/immer';
import {useRobartState} from './useRobartState';

type ConstraintViolation = 'velocity' | 'acceleration' | 'workspace';

export type ConstraintWarning = {
	time: number;
	repr: string;
	violationType: ConstraintViolation;
	robotId: string;
};

export type DynamicConstraintState = {
	maxVelocity: number;
	maxAcceleration: number;
	deltaT: number;
	setMaxVelocity: (vel: number) => void;
	setMaxAcceleration: (acc: number) => void;
};

export type KinematicConstraintState = {
	workspaceDimensions: THREE.Box3;
	setWorkspaceDimensions: (dim: THREE.Box3) => void;
};

export type PositionHistoryEntry = {
	timestep: number;
	robotPositions: Record<string, THREE.Vector3>;
}

export type PositionHistory  = PositionHistoryEntry[];

export type ConstraintChecker = {
	checkConstraints: (robotIDs: string[]) => ConstraintWarning[] | undefined;
	checkKinematicConstraints: (robotIDs: string[]) => ConstraintWarning[] | undefined;
	checkDynamicConstraints: (robotIDs: string[]) => ConstraintWarning[] | undefined;
	positionHistory: [];
};

export type ConstraintState = DynamicConstraintState & KinematicConstraintState & ConstraintChecker;

export const useCrazyflieConstraintState = create<ConstraintState>()(
	subscribeWithSelector(
		immer((set, get) => ({
			maxVelocity: 1.0,
			maxAcceleration: 5.0,
			workspaceDimensions: new THREE.Box3(new THREE.Vector3(-4, -2.5, -0.01), new THREE.Vector3(2, 2.5, 2.5)),
			positionHistory: [],
			deltaT: 1 / 60,
			setMaxVelocity(vel) {
				set({
					maxVelocity: vel,
				});
			},
			setMaxAcceleration(acc) {
				set({
					maxAcceleration: acc,
				});
			},
			setWorkspaceDimensions(dim) {
				set({
					workspaceDimensions: dim,
				});
			},
			checkDynamicConstraints(robotIDs: string[]) {
				const positions = get().positionHistory as PositionHistory;
				if (positions.length === 0) {
					return undefined;
				}

				let warnings: ConstraintWarning[] = [];
				//Check velocity Constraints
				robotIDs.forEach(id => {
					// Warn once per stretch of violation, not once per frame
					let violating = false;
					for (let i = 1; i < positions.length; i++) {
						const currentPosition = positions[i]?.robotPositions[id];
						const previousPosition = positions[i-1]?.robotPositions[id];
						// Actual time between steps: it varies with screen refresh rate and sim speed, so a fixed 1/60 s misjudged speeds
						const timeBetween = positions[i].timestep - positions[i-1].timestep;
						if (!currentPosition || !previousPosition || timeBetween <= 0) {
							violating = false;
							continue;
						}
						const velocity = currentPosition.distanceTo(previousPosition) / timeBetween;
						if (velocity > get().maxVelocity && !violating) {
							const robotName = useRobartState.getState().robots[id]?.name ?? 'Deleted robot';
							warnings.push({
								time: positions[i].timestep,
								repr: 'robot ' + robotName + ' has violated a velocity constraint at time ' + positions[i].timestep.toFixed(2) + '. It was travelling at ' + velocity.toFixed(2) + ' m/s.\n',
								violationType: 'velocity',
								robotId: id,
							});
						}
						violating = velocity > get().maxVelocity;
					}
				});
                
				// Check Acceleration Constraints

				return warnings;
			},
			checkConstraints(robotIDs: string[]) {
				const dynamicConstraints = this.checkDynamicConstraints(robotIDs);
				const kinematicConstraints = this.checkKinematicConstraints(robotIDs);
				if (kinematicConstraints === undefined)
					return dynamicConstraints;
				return dynamicConstraints?.concat(kinematicConstraints);
			},
			checkKinematicConstraints(robotIDs: string[]) {
				const history = get().positionHistory as PositionHistory;
				if (history.length > 0) {
					let warnings: ConstraintWarning[] = [];

					// Check workspace bounds
					robotIDs.forEach(id => {
						// Warn once each time the robot leaves the workspace, not once per frame
						let outside = false;
						for (let i = 1; i < history.length; i++) {
							const currentPosition = history[i]?.robotPositions[id];
							if (!currentPosition) continue;
							const isOutside = !this.workspaceDimensions.containsPoint(currentPosition);
							if (isOutside && !outside) {
								const robotName = useRobartState.getState().robots[id]?.name ?? 'Deleted robot';
								warnings.push({
									time: history[i].timestep,
									repr: 'robot ' + robotName + ' has violated a workspace constraint at time ' + history[i].timestep.toFixed(2) + '. Its position was ' + currentPosition.x.toFixed(2) + ', ' + currentPosition.y.toFixed(2) + ', ' + currentPosition.z.toFixed(2) + '\n',
									violationType: 'workspace',
									robotId: id,
								});
							}
							outside = isOutside;
						}
					});
					return warnings;
				}

				return undefined;           
			},
		})),
	),
);