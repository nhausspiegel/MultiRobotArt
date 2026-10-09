
import * as THREE from 'three';

import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {immer} from 'zustand/middleware/immer';
import {defaultLimits, useRobartState} from './useRobartState';

type ConstraintViolation = 'velocity' | 'acceleration' | 'workspace';

export type ConstraintWarning = {
	time: number;
	repr: string;
	// One-line version for the simulation's corner list
	short: string;
	violationType: ConstraintViolation;
	robotId: string;
};

export type DynamicConstraintState = {
	maxAcceleration: number;
	deltaT: number;
	setMaxAcceleration: (acc: number) => void;
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

export type ConstraintState = DynamicConstraintState & ConstraintChecker;

export const useCrazyflieConstraintState = create<ConstraintState>()(
	subscribeWithSelector(
		immer((set, get) => ({
			maxAcceleration: 5.0,
			positionHistory: [],
			deltaT: 1 / 60,
			setMaxAcceleration(acc) {
				set({
					maxAcceleration: acc,
				});
			},
			checkDynamicConstraints(robotIDs: string[]) {
				const positions = get().positionHistory as PositionHistory;
				if (positions.length === 0) {
					return undefined;
				}

				// Speed limit from Settings
				const {speedLimitOn, speedLimit} = useRobartState.getState().limits ?? defaultLimits;
				if (!speedLimitOn) return [];
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
						if (velocity > speedLimit && !violating) {
							const robotName = useRobartState.getState().robots[id]?.name ?? 'Deleted robot';
							warnings.push({
								time: positions[i].timestep,
								repr: 'robot ' + robotName + ' has violated a velocity constraint at time ' + positions[i].timestep.toFixed(2) + '. It was travelling at ' + velocity.toFixed(2) + ' m/s.\n',
								short: `${robotName} too fast (${velocity.toFixed(1)} m/s)`,
								violationType: 'velocity',
								robotId: id,
							});
						}
						violating = velocity > speedLimit;
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
					// Work area from Settings, with 1 cm leeway so a robot resting on the floor (z = 0) counts as inside
					const {workAreaOn, workAreaMin, workAreaMax} = useRobartState.getState().limits ?? defaultLimits;
					if (!workAreaOn) return [];
					const workArea = new THREE.Box3(new THREE.Vector3(...workAreaMin), new THREE.Vector3(...workAreaMax)).expandByScalar(0.01);
					let warnings: ConstraintWarning[] = [];

					// Check workspace bounds
					robotIDs.forEach(id => {
						// Warn once each time the robot leaves the workspace, not once per frame
						let outside = false;
						for (let i = 1; i < history.length; i++) {
							const currentPosition = history[i]?.robotPositions[id];
							if (!currentPosition) continue;
							const isOutside = !workArea.containsPoint(currentPosition);
							if (isOutside && !outside) {
								const robotName = useRobartState.getState().robots[id]?.name ?? 'Deleted robot';
								warnings.push({
									time: history[i].timestep,
									repr: 'robot ' + robotName + ' has violated a workspace constraint at time ' + history[i].timestep.toFixed(2) + '. Its position was ' + currentPosition.x.toFixed(2) + ', ' + currentPosition.y.toFixed(2) + ', ' + currentPosition.z.toFixed(2) + '\n',
									short: `${robotName} outside the work area`,
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