import type {MRAState} from './useRobartState';

// A warning tied to a moment in the show. The simulation's corner list shows `short` once playback reaches `time`;
// the Warnings tab shows `full`.
export type TimedWarning = {time: number; short: string; full: string};

// A robot in two lanes whose blocks overlap in time: the simulator runs those blocks one after the other,
// but on the real drones each lane runs on its own and the later command takes over mid-flight.
export const laneOverlapWarnings = (state: Pick<MRAState, 'robots' | 'timelineState'>): TimedWarning[] => {
	const warnings: TimedWarning[] = [];
	const groups = Object.values(state.timelineState.groups);
	Object.values(state.robots).forEach((robot) => {
		const items = groups
			.filter((group) => robot.id in group.robots)
			.flatMap((group) => Object.values(group.items).map((item) => ({item, group})));
		items.forEach((a, i) => {
			items.slice(i + 1).forEach((b) => {
				if (a.group.id === b.group.id) return;
				const start = Math.max(a.item.startTime, b.item.startTime);
				const end = Math.min(a.item.startTime + a.item.duration, b.item.startTime + b.item.duration);
				if (start < end) {
					warnings.push({
						time: start,
						short: `${robot.name} in ${a.group.name} and ${b.group.name} at once`,
						full: `robot ${robot.name} is in lanes ${a.group.name} and ${b.group.name}, which both have blocks between ${start.toFixed(2)} s and ${end.toFixed(2)} s.\n`,
					});
				}
			});
		});
	});
	return warnings;
};

type Position = {x: number; y: number; z: number};

// Pairs of robots whose bounding boxes overlap. Each box is boxSize (x, y, z) centered on its robot, so two boxes
// overlap when the robots are closer than one box size on every axis.
export const overlappingPairs = (positions: Record<string, Position>, [sizeX, sizeY, sizeZ]: number[]): Array<[string, string]> => {
	const ids = Object.keys(positions);
	return ids.flatMap((a, i) => ids.slice(i + 1)
		.filter((b) => Math.abs(positions[a].x - positions[b].x) < sizeX
			&& Math.abs(positions[a].y - positions[b].y) < sizeY
			&& Math.abs(positions[a].z - positions[b].z) < sizeZ)
		.map((b): [string, string] => [a, b]));
};

export const collisionWarning = (time: number, nameA: string, nameB: string): TimedWarning => ({
	time,
	short: `${nameA} and ${nameB} too close`,
	full: `robots ${nameA} and ${nameB} came too close at time ${time.toFixed(2)} (their bounding boxes overlapped).\n`,
});

export const speedWarning = (time: number, name: string, speed: number): TimedWarning => ({
	time,
	short: `${name} too fast (${speed.toFixed(1)} m/s)`,
	full: `robot ${name} has violated a velocity constraint at time ${time.toFixed(2)}. It was travelling at ${speed.toFixed(2)} m/s.\n`,
});

export const workAreaWarning = (time: number, name: string, position: Position): TimedWarning => ({
	time,
	short: `${name} outside the work area`,
	full: `robot ${name} has violated a workspace constraint at time ${time.toFixed(2)}. Its position was ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}\n`,
});
