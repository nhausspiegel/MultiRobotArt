import {TimelineMarker} from '@MRAControl/components/timeline/TimelineMarker';

import {usePinch} from '@use-gesture/react';

import {DroneEditor} from '../../components/timeline/DroneEditor';
import {convertPixelsToSeconds, convertSecondsToPixels, TimelineGroupBody, timelineLength, timelineStartPadding, timeToX} from '../../components/timeline/TimelineGroupBody';
import {TimelineGroupLabel} from '../../components/timeline/TimelineGroupLabel';
import {useRobartState} from '../../state/useRobartState';
import {nextGroupName} from '../../state/groupMigration';
import {useSimulator} from '../../state/useSimulator';
import {SimulationOptions} from './SimulationOptions';
import {TimelineSimulationButtons} from './TimelineSimulationButtons';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

const addNewGroup = () => {
	useRobartState.getState().addGroup(nextGroupName(useRobartState.getState().timelineState.groups));
};



const maxScale = 10;

export const Timeline = () => {
	const timelineState = useRobartState((state) => state.timelineState);
	const groups = Object.values(timelineState.groups);
	const setTimelineScale = useRobartState((state) => state.setTimelineScale);

	// Pinch to zoom, keeping the time under the fingers in place
	const scrollerRef = useRef<HTMLDivElement>(null);
	const zoomAnchor = useRef<{time: number; x: number}>();
	usePinch(({offset: [scale], origin: [originX]}) => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const x = originX - scroller.getBoundingClientRect().left;
		const currentScale = useRobartState.getState().timelineState.scale;
		zoomAnchor.current = {time: convertPixelsToSeconds(scroller.scrollLeft + x - timelineStartPadding, currentScale), x};
		setTimelineScale(scale);
	}, {
		target: scrollerRef,
		eventOptions: {passive: false}, // Lets it stop the browser's page zoom
		from: () => [useRobartState.getState().timelineState.scale, 0],
		// Zooms out only until the whole timeline fits the view
		scaleBounds: () => {
			const fitWidth = (scrollerRef.current?.clientWidth ?? 0) - timelineStartPadding;
			const fitScale = fitWidth / convertSecondsToPixels(timelineLength(useRobartState.getState()), 1);
			return {min: Math.min(Math.max(fitScale, 0.01), maxScale), max: maxScale};
		},
	});
	// Lanes draw second labels only near what's visible (a screen to either side). Lanes grow with the show, and zoomed in
	// they had thousands of labels, all moved on every zoom step. Re-rendered only when the view leaves the range, or it's
	// far wider than needed (after zooming in).
	const [labelRange, setLabelRange] = useState<[number, number]>([0, 0]);
	const updateLabelRange = useCallback(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const {scale} = useRobartState.getState().timelineState;
		const from = convertPixelsToSeconds(scroller.scrollLeft - timelineStartPadding, scale);
		const span = convertPixelsToSeconds(scroller.clientWidth, scale);
		setLabelRange((range) => (from >= range[0] && from + span <= range[1] && range[1] - range[0] <= 4 * span
			? range
			: [from - span, from + 2 * span]));
	}, []);
	useEffect(() => {
		window.addEventListener('resize', updateLabelRange);
		return () => {
			window.removeEventListener('resize', updateLabelRange);
		};
	}, [updateLabelRange]);

	// After the zoomed timeline renders, scroll so the anchor time is back under the fingers
	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		const anchor = zoomAnchor.current;
		if (scroller && anchor) scroller.scrollLeft = timeToX(anchor.time, timelineState.scale) - anchor.x;
		zoomAnchor.current = undefined;
		updateLabelRange();
	}, [timelineState.scale, updateLabelRange]);

	// Item lengths come from simulating the show; redo it shortly after the timeline, blocks or robots change.
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const remeasure = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				const {status, time, measureShowLength, seek} = useSimulator.getState();
				measureShowLength();
				// Measuring rewinds to the start; put a paused or running simulation back where it was
				if (status !== 'STOPPED') seek(time);
			}, 300);
		};

		remeasure();
		const unsubscribe = useRobartState.subscribe((state, previous) => {
			if (state.timelineState.groups !== previous.timelineState.groups || state.blocks !== previous.blocks || state.robots !== previous.robots
				|| state.boundingBoxSize !== previous.boundingBoxSize || state.limits !== previous.limits) {
				remeasure();
			}
		});
		return () => {
			clearTimeout(timer);
			unsubscribe();
		};
	}, []);

	return (
		<div className="flex h-full w-full flex-col gap-2 rounded bg-blue-100">
			<div className="flex items-center gap-3 pl-2 pt-2">
				<TimelineSimulationButtons />
				<SimulationOptions />
			</div>

			<div className="overflow-y-auto">
				<div className="flex flex-shrink-0 gap-2">
					{/* pt-5 on both columns: room above the lanes for the ruler (h-3) plus the gap between lanes (gap-2), so rows stay
					    aligned */}
					<div className="ml-2 flex h-full flex-col gap-2 pt-5">
						{groups.map((group) => (
							<TimelineGroupLabel group={group} key={group.id} />
						))}
						<button className="h-8 w-52 rounded px-2 text-left font-bold text-blue-900 hover:bg-blue-200" onClick={addNewGroup}>
							+ New group
						</button>
					</div>
					<div ref={scrollerRef} onScroll={updateLabelRange} className="relative flex h-full w-full touch-pan-x touch-pan-y flex-col gap-2 overflow-x-auto pt-5">
						{groups.map((group) => (
							<TimelineGroupBody group={group} labelRange={labelRange} key={group.id} />
						))}

						<TimelineMarker />
					</div>
				</div>
				<DroneEditor />
			</div>
		</div>
	);
};
