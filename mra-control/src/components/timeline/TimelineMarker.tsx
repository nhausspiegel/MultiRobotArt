import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {convertSecondsToPixels} from './TimelineGroupBody';
import React from 'react';
export const TimelineMarker = () => {
	const time = useSimulator((state) => state.time);
	const scale = useRobartState((state) => state.timelineState.scale);
	return (
		<div
			className="min-w-1 absolute z-10 h-full w-1 bg-black"
			style={{left: convertSecondsToPixels(time, scale)}}
		></div>
	);
};
