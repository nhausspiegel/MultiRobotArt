import {useShowLength} from '@MRAControl/layout/timeline/SimulationOptions';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {useDrag} from '@use-gesture/react';
import React, {useRef} from 'react';

import {convertPixelsToSeconds, timelineStartPadding, timeToX} from './TimelineGroupBody';

// The playhead: a line through the lanes with a round handle above them. Dragging the handle scrubs the simulation.
export const TimelineMarker = () => {
	const time = useSimulator((state) => state.time);
	const stopped = useSimulator((state) => state.status === 'STOPPED');
	const seek = useSimulator((state) => state.seek);
	const scale = useRobartState((state) => state.timelineState.scale);
	const showLength = useShowLength();
	const markerRef = useRef<HTMLDivElement>(null);

	const bind = useDrag(({xy: [x], tap}) => {
		// The marker sits in the lanes' scroll area, where lanes start at the left edge
		const scroller = markerRef.current?.parentElement;
		if (tap || !scroller || showLength === 0) return;
		const contentX = x - scroller.getBoundingClientRect().left + scroller.scrollLeft;
		seek(Math.min(showLength, Math.max(0, convertPixelsToSeconds(contentX - timelineStartPadding, scale))));
	}, {pointer: {keys: false}, filterTaps: true});

	// Stopped at the start, only the handle shows: the line would sit on every lane's "0" label
	const lineHidden = stopped && time === 0;
	return (
		<div
			ref={markerRef}
			className="pointer-events-none absolute inset-y-0 z-10 flex -translate-x-1/2 flex-col items-center"
			style={{left: timeToX(time, scale)}}
		>
			<div {...bind()} className="pointer-events-auto h-3 w-3 shrink-0 cursor-grab touch-none rounded-full bg-black" />
			{!lineHidden && <div className="w-[3px] flex-1 bg-black" />}
		</div>
	);
};
