import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {type MRAState, useRobartState} from '../state/useRobartState';

// A robot in two lanes whose blocks overlap in time: the simulator runs those blocks one after the other,
// but on the real drones each lane runs on its own and the later command takes over mid-flight.
const laneOverlapWarnings = (state: MRAState) => {
	const warnings: string[] = [];
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
					warnings.push(`robot ${robot.name} is in lanes ${a.group.name} and ${b.group.name}, which both have blocks between ${start.toFixed(2)} s and ${end.toFixed(2)} s.\n`);
				}
			});
		});
	});
	return warnings.join('');
};

export const WarningsPanel = () => {
	// Selected from the store so the tab updates while open (it used to read warnings once when opened)
	const constraintWarnings = useRobartState((state) => (state.warnings ?? []).join(''));
	const overlapWarnings = useRobartState(laneOverlapWarnings);
	// Notes from loading the project, e.g. robots moved out of extra groups
	const notices = useRobartState((state) => (state.notices ?? []).join(''));
	return (
		<div className="overflow-auto h-full w-full ">
			<CodeMirror value={notices + overlapWarnings + constraintWarnings} className="h-full w-full" readOnly={true} />
		</div>
	);
};
