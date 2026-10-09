import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {type MRAState, useRobartState} from '../state/useRobartState';
import {laneOverlapWarnings} from '../state/warnings';

// Everything the Warnings tab lists; also counted on the tab's button
const warningLines = (state: MRAState) => [
	// Notes from loading the project, e.g. robots moved out of extra groups
	...(state.notices ?? []),
	...laneOverlapWarnings(state).map((warning) => warning.full),
	// Speed and work area, found when the show is measured
	...(state.warnings ?? []),
];

export const warningCount = (state: MRAState) => warningLines(state).length;

export const WarningsPanel = () => {
	// Selected from the store so the tab updates while open (it used to read warnings once when opened)
	const text = useRobartState((state) => warningLines(state).join(''));
	return (
		<div className="overflow-auto h-full w-full ">
			<CodeMirror value={text} className="h-full w-full" readOnly={true} />
		</div>
	);
};
