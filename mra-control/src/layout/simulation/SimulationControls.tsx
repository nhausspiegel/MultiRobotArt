import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import React from 'react';

const speeds = [0.5, 1, 2, 4, 8];

const formatTime = (seconds: number) => {
	const wholeSeconds = Math.floor(seconds);
	return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

export const SimulationControls = () => {
	const time = useSimulator((state) => state.time);
	const timeDilation = useSimulator((state) => state.timeDilation);
	const showCoordinates = useSimulator((state) => state.showCoordinates);
	const seek = useSimulator((state) => state.seek);
	const setTimeDilation = useSimulator((state) => state.setTimeDilation);
	const toggleCoordinates = useSimulator((state) => state.toggleCoordinates);
	// End of the last timeline item, so the scrubber spans the whole show
	const endTime = useRobartState((state) => {
		const {groups, scale} = state.timelineState;
		const itemEnds = Object.values(groups).flatMap((group) =>
			Object.values(group.items).map((item) => (item.startTime + item.duration) * scale),
		);
		return Math.max(10, ...itemEnds);
	});
	// Blocks can run past their estimated duration; keep the playhead on the bar
	const maxTime = Math.max(endTime, time);

	return (
		<div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/60 px-3 py-2 text-sm text-white">
			<input
				type="range"
				className="flex-grow"
				aria-label="Simulation time"
				min={0}
				max={maxTime}
				step={0.01}
				value={time}
				onChange={(e) => {
					seek(Number(e.target.value));
				}}
			/>
			<span className="tabular-nums">
				{formatTime(time)} / {formatTime(maxTime)}
			</span>
			<select
				className="rounded border-none bg-gray-800 py-0 pl-2 pr-8 text-sm"
				aria-label="Simulation speed"
				value={timeDilation}
				onChange={(e) => {
					setTimeDilation(Number(e.target.value));
				}}
			>
				{speeds.map((speed) => (
					<option key={speed} value={speed}>
						{speed}×
					</option>
				))}
			</select>
			<label className="flex items-center gap-1">
				<input type="checkbox" checked={showCoordinates} onChange={toggleCoordinates} />
				Coordinates
			</label>
		</div>
	);
};
