import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import React from 'react';

const speeds = [0.5, 1, 2, 4, 8];

export const formatTime = (seconds: number) => {
	const wholeSeconds = Math.floor(seconds);
	return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

// How far the playhead can be scrubbed: the show's length as measured when it starts (exact), or before the first run
// the end of the last timeline item (an estimate). 0 with no blocks.
export const useShowLength = () => {
	const time = useSimulator((state) => state.time);
	const measuredEndTime = useSimulator((state) => state.endTime);
	const estimatedEndTime = useRobartState((state) => {
		const itemEnds = Object.values(state.timelineState.groups).flatMap((group) =>
			Object.values(group.items).map((item) => item.startTime + item.duration),
		);
		return Math.max(0, ...itemEnds);
	});
	// Keep the playhead in range if the sim runs slightly past the measured end (frame timing)
	return Math.max(measuredEndTime > 0 ? measuredEndTime : estimatedEndTime, time);
};

// Time, speed and display options, in the timeline's top row next to the sim buttons
export const SimulationOptions = () => {
	const time = useSimulator((state) => state.time);
	const showLength = useShowLength();
	const timeDilation = useSimulator((state) => state.timeDilation);
	const setTimeDilation = useSimulator((state) => state.setTimeDilation);
	const showPaths = useSimulator((state) => state.showPaths);
	const togglePaths = useSimulator((state) => state.togglePaths);
	const showCoordinates = useSimulator((state) => state.showCoordinates);
	const toggleCoordinates = useSimulator((state) => state.toggleCoordinates);
	const showWorkArea = useSimulator((state) => state.showWorkArea);
	const toggleWorkArea = useSimulator((state) => state.toggleWorkArea);

	return (
		<div className="flex items-center gap-3 text-sm">
			<label className="flex items-center gap-1">
				<input type="checkbox" checked={showCoordinates} onChange={toggleCoordinates} />
				Coordinates
			</label>
			<label className="flex items-center gap-1">
				<input type="checkbox" checked={showPaths} onChange={togglePaths} />
				Paths
			</label>
			<label className="flex items-center gap-1">
				<input type="checkbox" checked={showWorkArea} onChange={toggleWorkArea} />
				Work area
			</label>
			<select
				className="rounded border border-gray-300 bg-white py-1 pl-2 pr-8 text-sm"
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
			<span className="tabular-nums">
				{formatTime(time)} / {formatTime(showLength)}
			</span>
		</div>
	);
};
