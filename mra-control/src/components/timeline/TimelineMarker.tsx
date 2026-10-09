import {useShowLength} from '@MRAControl/layout/timeline/SimulationOptions';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {useDrag} from '@use-gesture/react';
import React, {useRef} from 'react';

import {convertPixelsToSeconds, tickBackground, timelineLength, timelineStartPadding, timeToX} from './TimelineGroupBody';

// The playhead: a line through the lanes with a round handle above them, and the strip the handle sits in (a ruler, as
// in Logic). Clicking the strip jumps the playhead there; dragging it or the handle scrubs the simulation.
export const TimelineMarker = () => {
	const time = useSimulator((state) => state.time);
	const seek = useSimulator((state) => state.seek);
	const scale = useRobartState((state) => state.timelineState.scale);
	const showLength = useShowLength();
	const length = useRobartState(timelineLength);
	const markerRef = useRef<HTMLDivElement>(null);

	// On press too, so a click jumps
	const bind = useDrag(({xy: [x]}) => {
		// The marker sits in the lanes' scroll area, where lanes start at the left edge
		const scroller = markerRef.current?.parentElement;
		if (!scroller || showLength === 0) return;
		const contentX = x - scroller.getBoundingClientRect().left + scroller.scrollLeft;
		seek(Math.min(showLength, Math.max(0, convertPixelsToSeconds(contentX - timelineStartPadding, scale))));
	}, {pointer: {keys: false}});

	return (<>
		{/* At the top of the room above the lanes (the scroll area's top padding), as wide as the lanes; ticks along its bottom */}
		<div
			{...bind()}
			className="absolute left-0 top-0 h-3 cursor-pointer touch-none rounded-sm bg-blue-50"
			style={{width: timeToX(length, scale), ...tickBackground(scale, '60%', '30%', 'bottom')}}
		/>
		<div
			ref={markerRef}
			className="pointer-events-none absolute inset-y-0 z-10 flex -translate-x-1/2 flex-col items-center"
			style={{left: timeToX(time, scale)}}
		>
			<div {...bind()} className="pointer-events-auto h-3 w-3 shrink-0 cursor-grab touch-none rounded-full bg-black" />
			<div className="w-[3px] flex-1 bg-black" />
		</div>
	</>);
};
