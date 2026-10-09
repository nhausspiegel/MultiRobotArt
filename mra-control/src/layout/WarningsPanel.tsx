import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {useRobartState} from '../state/useRobartState';
import {useReachedWarnings} from './simulation/SimulationWarnings';

// Everything the Warnings tab lists; also counted on the tab's button
const useWarningLines = () => {
	// Notes from loading the project, e.g. robots moved out of extra groups
	const notices = useRobartState((state) => state.notices);
	// The same warnings as the simulation's corner list: those reached since Run Sim
	const reached = useReachedWarnings();
	return [...(notices ?? []), ...reached.map((warning) => warning.full)];
};

export const useWarningCount = () => useWarningLines().length;

export const WarningsPanel = () => {
	const text = useWarningLines().join('');
	return (
		<div className="overflow-auto h-full w-full ">
			<CodeMirror value={text} className="h-full w-full" readOnly={true} />
		</div>
	);
};
