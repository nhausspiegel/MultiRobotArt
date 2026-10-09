import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {laneOverlapWarnings} from '@MRAControl/state/warnings';
import {faTriangleExclamation} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import React from 'react';

import {formatTime} from '../timeline/SimulationOptions';

// Most recent warnings shown at once; the count covers all of them
const maxShown = 4;

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

// Corner list of the reached warnings, newest first, so they're noticed while watching
export const SimulationWarnings = () => {
	const reached = useReachedWarnings();
	if (reached.length === 0) return null;

	return (
		<div className="pointer-events-none absolute right-2 top-2 max-w-xs rounded bg-black/60 px-2 py-1 text-xs text-white">
			<div className="font-bold text-yellow-300">
				<FontAwesomeIcon icon={faTriangleExclamation} /> {reached.length}
			</div>
			{reached.slice(-maxShown).reverse().map((warning, i) => (
				<div key={i} className="truncate">
					<span className="tabular-nums text-gray-300">{formatTime(warning.time)}</span> {warning.short}
				</div>
			))}
		</div>
	);
};
