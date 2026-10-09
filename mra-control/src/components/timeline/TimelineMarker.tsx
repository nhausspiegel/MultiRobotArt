import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {timeToX} from './TimelineGroupBody';
import React from 'react';
export const TimelineMarker = () => {
	const time = useSimulator((state) => state.time);
	const stopped = useSimulator((state) => state.status === 'STOPPED');
	const scale = useRobartState((state) => state.timelineState.scale);
	// Hidden while stopped at the start: it would sit on every lane's "0" label
	if (stopped && time === 0) return null;
	return (
		<div
			className="min-w-1 absolute z-10 h-full w-1 -translate-x-1/2 bg-black"
			style={{left: timeToX(time, scale)}}
		></div>
	);
};
