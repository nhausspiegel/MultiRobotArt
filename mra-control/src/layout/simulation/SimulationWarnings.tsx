import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {laneOverlapWarnings} from '@MRAControl/state/warnings';
import {faTriangleExclamation} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import React from 'react';

import {formatTime} from '../timeline/SimulationOptions';

// The warnings playback has reached since Run Sim, oldest first. Both this corner list and the Warnings tab show these.
export const useReachedWarnings = () => {
	const shownUntil = useSimulator((state) => state.warningsShownUntil);
	const atStart = useSimulator((state) => state.status === 'STOPPED' && state.time === 0);
	const timedWarnings = useSimulator((state) => state.timedWarnings);
	const overlapWarnings = useRobartState(laneOverlapWarnings);
	if (atStart) return [];
	return [...timedWarnings, ...overlapWarnings]
		.filter((warning) => warning.time <= shownUntil)
		.sort((a, b) => a.time - b.time);
};

// Corner list of the reached warnings, newest first, so they're noticed while watching. Scrolls when longer than the view;
// it takes the pointer for that, so the 3D view can't be dragged from behind it.
export const SimulationWarnings = () => {
	const reached = useReachedWarnings();
	if (reached.length === 0) return null;

	return (
		<div className="absolute right-2 top-2 max-h-[calc(100%-1rem)] max-w-xs overflow-y-auto rounded bg-black/60 px-2 py-1 text-xs text-white">
			<div className="font-bold text-yellow-300">
				<FontAwesomeIcon icon={faTriangleExclamation} /> {reached.length}
			</div>
			{reached.slice().reverse().map((warning, i) => (
				<div key={i} className="truncate">
					<span className="tabular-nums text-gray-300">{formatTime(warning.time)}</span> {warning.short}
				</div>
			))}
		</div>
	);
};
