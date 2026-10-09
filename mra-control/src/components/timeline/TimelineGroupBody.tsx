/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-extraneous-dependencies */
import clsx from 'clsx';
import {type DragEventHandler, useRef, useState} from 'react';

import {allDronesGroupId} from '../../state/groupMigration';
import {type TimelineGroupState, type TimelineItem, useRobartState} from '../../state/useRobartState';
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
	occupiedItems: TimelineItem[],
	startTime: number | undefined,
	duration: number,
	id?: string,
) =>
	startTime === undefined ||
  startTime < 0 ||
  occupiedItems.some((items) => {
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

// What a block placed on this lane must not overlap: the lane's own items and, on group lanes, All drones' items
// (those run on every drone, this group's included)
export const laneOccupiedItems = (groups: Record<string, TimelineGroupState>, laneId: string): TimelineItem[] => [
	...Object.values(groups[laneId]?.items ?? {}),
	...(laneId === allDronesGroupId ? [] : Object.values(groups[allDronesGroupId]?.items ?? {})),
];

export const TimelineGroupBody = ({group}: TimelineGroupProps) => {
	const addBlockToTimeline = useRobartState((state) => state.addBlockToTimeline);
	const selectedBlockId = useRobartState((state) => state.editingBlockId);
	const blocks = useRobartState((state) => state.blocks);
	const scale = useRobartState((state) => state.timelineState.scale);
	const groups = useRobartState((state) => state.timelineState.groups);
	const occupiedItems = laneOccupiedItems(groups, group.id);
	// Shown greyed out on group lanes: time these drones are already busy
	const allDronesItems = group.id === allDronesGroupId ? [] : Object.values(groups[allDronesGroupId]?.items ?? {});

	// Pointer x while a block from the block list is dragged over this lane
	const [hoverX, setHoverX] = useState<number | undefined>();

	const laneBodyRef = useRef<HTMLDivElement>(null);

	// A lane with no drones runs nothing, so it takes no new blocks (with no drones at all, that includes All drones)
	const hasDrones = Object.keys(group.robots).length > 0;

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
		if (!e.dataTransfer.types.includes('text/plain')) return; // Not a block, e.g. a robot name tag
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
		if (isEmptyBlock(blockId) || !hasDrones) return;

		const startTime = computeTimelineBlockOffset(e.clientX, blockId);

		if (startTime !== undefined && !blockOverlaps(occupiedItems, startTime, blocks[blockId].duration)) {
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
			className={clsx('relative h-16 rounded bg-repeat-x', hasDrones ? 'bg-blue-300' : 'bg-gray-300')}
			ref={laneBodyRef}
			// Found by timeline items dragged between lanes
			data-lane-id={group.id}
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
			{allDronesItems.map((item) => (
				<div
					key={`all-drones-${item.id}`}
					className="pointer-events-none absolute top-1/2 flex h-5/6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-xl text-gray-500"
					style={{
						width: convertSecondsToPixels(item.duration, scale),
						minWidth: minItemWidth,
						left: convertSecondsToPixels(item.startTime, scale),
						background: 'repeating-linear-gradient(45deg, #d1d5db, #d1d5db 6px, #e5e7eb 6px, #e5e7eb 12px)',
					}}
				>
					<span className="truncate px-1">{blocks[item.blockId]?.name}</span>
				</div>
			))}
			{Object.values(group.items).map((item) => (
				<TimelineBlock key={item.id} scale={scale} item={item} />
			))}
			{hoverX !== undefined && (
				<HoverTimelineBlock
					scale={scale}
					startTime={computeTimelineBlockOffset(hoverX, selectedBlockId)}
					cannotDrop={!hasDrones || isEmptyBlock(selectedBlockId) || blockOverlaps(occupiedItems, computeTimelineBlockOffset(hoverX, selectedBlockId), blocks[selectedBlockId ?? '']?.duration ?? 0)}
				/>
			)}
		</div>
	);
};
