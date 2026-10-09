/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-extraneous-dependencies */
import clsx from 'clsx';
import {type DragEventHandler, useRef, useState} from 'react';

import {type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {HoverTimelineBlock} from './HoverTimelineBlock';
import {TimelineBlock} from './TimelineBlock';
import React from 'react';

type TimelineGroupProps = {
	group: TimelineGroupState;
};

export const pixelsPerSecond = 100;
export const SUBDIVISIONS_PER_SECOND = 8;
// Display only: very short items (an LED color change is 0.1 s) would be too thin to see or grab
export const minItemWidth = 12;

export const convertPixelsToSeconds = (distance: number, scale: number) => {
	return distance / (pixelsPerSecond * scale);
};

export const convertSecondsToPixels = (duration: number, scale: number) => {
	return duration * pixelsPerSecond * scale;
};

export const blockOverlaps = (
	group: TimelineGroupState,
	startTime: number | undefined,
	duration: number,
	id?: string,
) =>
	startTime === undefined ||
  startTime < 0 ||
  Object.values(group.items).some((items) => {
  	if (items === undefined) {
  		return false;
  	}

  	const currItemStart = items.startTime;
  	const currItemEnd = items.startTime + items.duration;
  	const newBlockStart = startTime;
  	const newBlockEnd = startTime + duration;

  	if (id !== undefined && id === items.id) return false;
  	return !(currItemEnd < newBlockStart || newBlockEnd < currItemStart);
  });

export const TimelineGroupBody = ({group}: TimelineGroupProps) => {
	const addBlockToTimeline = useRobartState((state) => state.addBlockToTimeline);
	const selectedBlockId = useRobartState((state) => state.editingBlockId);
	const blocks = useRobartState((state) => state.blocks);
	const scale = useRobartState((state) => state.timelineState.scale);

	// Pointer x while a block from the block list is dragged over this lane
	const [hoverX, setHoverX] = useState<number | undefined>();

	const laneBodyRef = useRef<HTMLDivElement>(null);

	// A block with nothing in it does nothing, so it isn't allowed on the timeline
	const isEmptyBlock = (blockId: string | undefined) => blocks[blockId ?? '']?.javaScript.trim() === '';

	const computeTimelineBlockOffset = (clientX: number | undefined, blockId: string | undefined) => {
		if (clientX === undefined) return;

		if (laneBodyRef.current) {
			if (blockId === undefined || blocks[blockId] === undefined) return;
			// The lane's on-screen rect already reflects scrolling
			const offsetX = clientX - laneBodyRef.current.getBoundingClientRect().left;
			// Centered on the pointer, but never starting before 0 (long blocks near the left edge would otherwise be refused)
			return Math.max(0, convertPixelsToSeconds(offsetX, scale) - blocks[blockId].duration / 2);
		}
	};

	const handleDragOver: DragEventHandler = (e) => {
		e.preventDefault(); // Allows dropping
		e.dataTransfer.dropEffect = 'copy';
		setHoverX(e.clientX);
	};

	const handleDragLeave: DragEventHandler = (e) => {
		// Moving over ticks or items inside the lane also fires dragleave; keep the preview then
		if (!laneBodyRef.current?.contains(e.relatedTarget as Node | null)) setHoverX(undefined);
	};

	const handleDrop: DragEventHandler = (e) => {
		e.preventDefault();
		setHoverX(undefined);

		const blockId = e.dataTransfer.getData('text/plain');
		if (blocks[blockId] === undefined) return; // Not a block from the block list
		if (isEmptyBlock(blockId)) return;

		const startTime = computeTimelineBlockOffset(e.clientX, blockId);

		if (startTime !== undefined && !blockOverlaps(group, startTime, blocks[blockId].duration)) {
			// TODO: Add isTraj appropriately (Currently hardcoded false), find better way to do it...
			var isTraj = false;
			if ( blocks[blockId].javaScript.includes('circle')) {
				isTraj = true;
			}

			addBlockToTimeline(group.id, blockId, startTime, isTraj);
		}
	};

	// Tick marks are a repeating background, not elements: thousands of tick elements made zooming slow.
	// Second ticks always; subdivision ticks and labels only when far enough apart to read.
	const secondWidth = convertSecondsToPixels(1, scale);
	const subdivisionWidth = secondWidth / SUBDIVISIONS_PER_SECOND;
	const tick = 'linear-gradient(to right, black 2px, transparent 2px)';
	const showSubdivisions = subdivisionWidth >= 6;
	const labelEvery = [1, 2, 5, 10, 15, 30, 60].find((seconds) => seconds * secondWidth >= 32) ?? 60;

	return (
		<div
			className="relative h-16 rounded bg-blue-300 bg-repeat-x"
			ref={laneBodyRef}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			style={{
				width: `${convertSecondsToPixels(group.duration, scale)}px`,
				backgroundImage: showSubdivisions ? `${tick}, ${tick}` : tick,
				backgroundSize: showSubdivisions ? `${secondWidth}px 25%, ${subdivisionWidth}px 16.67%` : `${secondWidth}px 25%`,
			}}
		>
			{[...new Array(Math.ceil(group.duration / labelEvery))].map((_, index) => (
				// Centered on their ticks. 0 can't be (half would hang off the lane's left edge), so it sits just right of its
				// tick and the playhead, which is 4 px wide at time 0 and drawn on top
				<span
					key={index}
					className={clsx('absolute top-1/4', index > 0 && '-translate-x-1/2')}
					style={{left: index === 0 ? 6 : convertSecondsToPixels(index * labelEvery, scale)}}
				>
					{index * labelEvery}
				</span>
			))}
			{Object.values(group.items).map((item) => (
				<TimelineBlock key={item.id} scale={scale} item={item} />
			))}
			{hoverX !== undefined && (
				<HoverTimelineBlock
					scale={scale}
					startTime={computeTimelineBlockOffset(hoverX, selectedBlockId)}
					cannotDrop={isEmptyBlock(selectedBlockId) || blockOverlaps(group, computeTimelineBlockOffset(hoverX, selectedBlockId), blocks[selectedBlockId ?? '']?.duration ?? 0)}
				/>
			)}
		</div>
	);
};
