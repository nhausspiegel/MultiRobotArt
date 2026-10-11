import {lastItemEnd, useShowLength} from '@MRAControl/layout/timeline/SimulationOptions';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {useDrag} from '@use-gesture/react';
import React, {useRef} from 'react';

import {convertPixelsToSeconds, convertSecondsToPixels, everyAtLeast, tickArea, tickLayer, tickSpacing, timelineLength, timelineStartPadding, timeToX} from './TimelineGroupBody';

// Heights (px) of the ruler's rows; the scroll area's top padding (Timeline) is both plus the gap between lanes
export const rulerNumbersHeight = 15;
export const rulerScrubHeight = 10;
export const rulerHeight = rulerNumbersHeight + rulerScrubHeight;
// Where the lanes start: below the ruler and the same gap as between lanes (gap-2)
export const lanesTop = rulerHeight + 8;
const tickColor = '#334155';

// The ruler above the lanes, as in Logic, and the playhead. The ruler's upper row holds the numbers, each just right of
// its tick; its lower row has every tick and is where clicking jumps the playhead and dragging scrubs (so does dragging
// the playhead's handle, which sits in it). Also the line where the show ends.
export const TimelineMarker = ({labelRange}: {labelRange: [number, number]}) => {
	const time = useSimulator((state) => state.time);
	const seek = useSimulator((state) => state.seek);
	const scale = useRobartState((state) => state.timelineState.scale);
	const showLength = useShowLength();
	const length = useRobartState(timelineLength);
	const end = useRobartState(lastItemEnd);
	const markerRef = useRef<HTMLDivElement>(null);

	// On press too, so a click jumps
	const bind = useDrag(({xy: [x]}) => {
		// The marker sits in the lanes' scroll area, where lanes start at the left edge
		const scroller = markerRef.current?.parentElement;
		if (!scroller || showLength === 0) return;
		const contentX = x - scroller.getBoundingClientRect().left + scroller.scrollLeft;
		seek(Math.min(showLength, Math.max(0, convertPixelsToSeconds(contentX - timelineStartPadding, scale))));
	}, {pointer: {keys: false}});

	const width = timeToX(length, scale);
	const {major, minor} = tickSpacing(scale);
	// Numbers far enough apart to read, and only near what's visible (see Timeline); none on an empty timeline
	const numberEvery = everyAtLeast(convertSecondsToPixels(1, scale), 48);
	const firstNumber = Math.max(0, Math.floor(labelRange[0] / numberEvery));
	const numberCount = end === 0 ? 0 : Math.max(0, Math.min(Math.ceil(length / numberEvery), Math.ceil(labelRange[1] / numberEvery)) - firstNumber);

	return (<>
		{end > 0 && (
			<div
				className="pointer-events-none absolute left-0 top-0"
				style={{
					width,
					height: rulerNumbersHeight,
					backgroundImage: tickLayer(convertSecondsToPixels(numberEvery, scale), tickColor, 1.5),
					backgroundSize: `${tickArea} 100%`,
					backgroundPosition: `${timelineStartPadding}px 0`,
					backgroundRepeat: 'no-repeat',
				}}
			>
				{[...new Array(numberCount)].map((_, i) => (firstNumber + i) * numberEvery).map((seconds) => (
					<span
						key={seconds}
						className="absolute top-0 text-[11px] tabular-nums text-slate-700"
						style={{left: timeToX(seconds, scale) + 4, lineHeight: `${rulerNumbersHeight}px`}}
					>
						{seconds}
					</span>
				))}
			</div>
		)}
		<div
			{...bind()}
			className="absolute left-0 cursor-pointer touch-none rounded-sm bg-blue-200/90"
			style={{
				top: rulerNumbersHeight,
				width,
				height: rulerScrubHeight,
				// Major ticks full height, minor ones half, from the bottom
				backgroundImage: [tickLayer(major, tickColor, 1.5), ...(minor ? [tickLayer(minor, tickColor, 1)] : [])].join(', '),
				backgroundSize: [`${tickArea} 100%`, ...(minor ? [`${tickArea} 50%`] : [])].join(', '),
				backgroundPosition: [`${timelineStartPadding}px 0`, ...(minor ? [`${timelineStartPadding}px 100%`] : [])].join(', '),
				backgroundRepeat: 'no-repeat',
			}}
		/>
		{end > 0 && (
			<div
				className="pointer-events-none absolute bottom-0 z-[5] w-0.5 -translate-x-1/2 bg-blue-900"
				style={{left: timeToX(end, scale), top: lanesTop}}
			/>
		)}
		<div
			ref={markerRef}
			className="pointer-events-none absolute bottom-0 z-10 flex -translate-x-1/2 flex-col items-center"
			style={{left: timeToX(time, scale), top: rulerNumbersHeight}}
		>
			<div {...bind()} className="pointer-events-auto h-2.5 w-2.5 shrink-0 cursor-grab touch-none rounded-full bg-black" />
			<div className="w-[3px] flex-1 bg-black" />
		</div>
	</>);
};
