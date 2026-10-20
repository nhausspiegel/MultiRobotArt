/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-extraneous-dependencies */
import clsx from 'clsx';
import {type DragEventHandler, useRef, useState} from 'react';

import {allDronesGroupId, isGroupHidden} from '../../state/groupMigration';
import {type MRAState, type TimelineGroupState, type TimelineItem, useRobartState} from '../../state/useRobartState';
import {lastItemEnd} from '../../layout/timeline/SimulationOptions';
import {HoverTimelineBlock} from './HoverTimelineBlock';
import {TimelineBlock, useItemDrag, useShowEnd} from './TimelineBlock';
import {landingTime} from './placement';
import {writesNoCode} from '../../config/customBlocks/BlockDefinition';
import React from 'react';

type TimelineGroupProps = {
	group: TimelineGroupState;
};

export const pixelsPerSecond = 100;
// Lanes reach this far past the last block (s), and are at least minTimelineLength long, so there's always room to add more
const roomAfterLastBlock = 30;
const minTimelineLength = 120;
// Seconds between ruler numbers and between major ticks, when that many seconds are far enough apart (px)
const roundSeconds = [1, 2, 5, 10, 15, 30, 60];
export const everyAtLeast = (secondWidth: number, minWidth: number) => roundSeconds.find((seconds) => seconds * secondWidth >= minWidth) ?? 60;

/**
 * Tick spacing (px): a major tick every second, or every few seconds when zoomed out (every second merged into a black
 * band); 2, 4 or 8 minor ticks per second when they stay far enough apart (none otherwise).
 */
export const tickSpacing = (scale: number) => {
	const secondWidth = convertSecondsToPixels(1, scale);
	const major = everyAtLeast(secondWidth, 10) * secondWidth;
	const perSecond = major === secondWidth ? [8, 4, 2].find((count) => secondWidth / count >= 12) : undefined;
	return {major, minor: perSecond ? secondWidth / perSecond : undefined};
};

/**
 * Ticks as repeating backgrounds, not elements: thousands of tick elements made zooming slow. Each is one repeating
 * gradient from time 0 onward (a tiled image would also repeat backwards into the start padding).
 */
export const tickLayer = (spacing: number, color: string, width: number) =>
	`repeating-linear-gradient(to right, ${color} 0 ${width}px, transparent ${width}px ${spacing}px)`;

// Length of every lane (s)
export const timelineLength = (state: Pick<MRAState, 'timelineState'>) => Math.max(minTimelineLength, lastItemEnd(state) + roomAfterLastBlock);
// Display only: very short items (an LED color change is 0.1 s) would be too thin to see or grab
export const minItemWidth = 12;

export const convertPixelsToSeconds = (distance: number, scale: number) => {
	return distance / (pixelsPerSecond * scale);
};

export const convertSecondsToPixels = (duration: number, scale: number) => {
	return duration * pixelsPerSecond * scale;
};

// Time 0 starts this far into each lane, so the "0" label can be centered on its tick without being cut off
export const timelineStartPadding = 12;
// Ticks are drawn across the lane after the start padding
export const tickArea = `calc(100% - ${timelineStartPadding}px)`;

// x of a time within a lane, and within the timeline's scroll area (lanes start at its left edge)
export const timeToX = (seconds: number, scale: number) => timelineStartPadding + convertSecondsToPixels(seconds, scale);

// How far a dropped or dragged block may snap to sit against a neighbor (landingTime): half its length, and for short
// blocks at least two minimum widths. A block is held by its middle, so lining its edge up with a neighbor's overlaps by
// up to half; further in, it shows that it can't go there instead of jumping aside (e.g. an All drones block over a
// block in another lane).
export const snapReach = (duration: number, scale: number) => Math.max(duration / 2, convertPixelsToSeconds(2 * minItemWidth, scale));

// What a block placed on this lane must not overlap: the lane's own items and, on group lanes, All drones' items
// (those run on every drone, this group's included)
export const laneOccupiedItems = (groups: Record<string, TimelineGroupState>, laneId: string): TimelineItem[] => (laneId === allDronesGroupId
	// All drones runs on everyone, so every lane's blocks are in the way
	? Object.values(groups).flatMap((group) => Object.values(group.items))
	: [...Object.values(groups[laneId]?.items ?? {}), ...Object.values(groups[allDronesGroupId]?.items ?? {})]);

export const TimelineGroupBody = ({group}: TimelineGroupProps) => {
	const addBlockToTimeline = useRobartState((state) => state.addBlockToTimeline);
	const selectedBlockId = useRobartState((state) => state.editingBlockId);
	const blocks = useRobartState((state) => state.blocks);
	const scale = useRobartState((state) => state.timelineState.scale);
	// The same for every lane, so they line up
	const length = useRobartState(timelineLength);
	// Where the show ends: the room after it is faded (all of it on an empty timeline)
	const end = useShowEnd();
	const drag = useItemDrag((state) => state.drag);
	const groups = useRobartState((state) => state.timelineState.groups);
	const occupiedItems = laneOccupiedItems(groups, group.id);
	// Shown greyed out on group lanes: time these drones are already busy. Follows an All drones item while it's dragged
	// (and one dragged onto All drones, or away from it).
	const allDronesItems = group.id === allDronesGroupId ? [] : Object.values(groups).flatMap((lane) => Object.values(lane.items))
		.filter((item) => (item.id === drag?.itemId ? drag.laneId === allDronesGroupId : item.groupId === allDronesGroupId))
		.map((item) => (item.id === drag?.itemId ? {...item, startTime: drag.startTime} : item));

	// Pointer x while a block from the block list is dragged over this lane
	const [hoverX, setHoverX] = useState<number | undefined>();

	const laneBodyRef = useRef<HTMLDivElement>(null);

	// A lane with no drones runs nothing, so it takes no new blocks (with no drones at all, that includes All drones)
	const hasDrones = Object.keys(group.robots).length > 0;
	// Dimmed like its label while its group is hidden (left out of the simulation and export)
	const hidden = isGroupHidden(groups, group.id);

	// A block with nothing in it does nothing, so it isn't allowed on the timeline
	const isEmptyBlock = (blockId: string | undefined) => {
		const code = blocks[blockId ?? '']?.javaScript;
		return code !== undefined && writesNoCode(code);
	};

	// Where a block from the block list is under the pointer: centered on it, but never starting before 0 (long blocks
	// near the left edge would otherwise be refused)
	const pointerStart = (clientX: number | undefined, blockId: string | undefined) => {
		if (clientX === undefined || !laneBodyRef.current || blockId === undefined || blocks[blockId] === undefined) return;
		// The lane's on-screen rect already reflects scrolling
		const offsetX = clientX - laneBodyRef.current.getBoundingClientRect().left - timelineStartPadding;
		return Math.max(0, convertPixelsToSeconds(offsetX, scale) - (blocks[blockId].duration / 2));
	};

	// Where it lands: there, or against a neighbor it would overlap. Undefined when it can't go there.
	const landing = (clientX: number | undefined, blockId: string | undefined) => {
		const start = pointerStart(clientX, blockId);
		if (start === undefined) return;
		const {duration} = blocks[blockId!];
		return landingTime(occupiedItems, start, duration, snapReach(duration, scale));
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

		const startTime = landing(e.clientX, blockId);

		if (startTime !== undefined) {
			// TODO: Add isTraj appropriately (Currently hardcoded false), find better way to do it...
			var isTraj = false;
			if ( blocks[blockId].javaScript.includes('circle')) {
				isTraj = true;
			}

			addBlockToTimeline(group.id, blockId, startTime, isTraj);
		}
	};

	// Faint full-height lines at the finest tick spacing; the numbers and major ticks are on the ruler
	const {major, minor} = tickSpacing(scale);

	return (
		<div
			className={clsx('relative rounded', group.collapsed ? 'h-7' : 'h-16', hasDrones ? 'bg-blue-300' : 'bg-gray-300', hidden && 'opacity-50')}
			ref={laneBodyRef}
			// Found by timeline items dragged between lanes
			data-lane-id={group.id}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			style={{
				width: `${timeToX(length, scale)}px`,
				backgroundImage: tickLayer(minor ?? major, 'rgb(30 58 138 / 0.14)', 1),
				backgroundSize: `${tickArea} 100%`,
				backgroundPosition: `${timelineStartPadding}px 0`,
				backgroundRepeat: 'no-repeat',
			}}
		>
			{/* After the end of the show, faded; still takes drops */}
			<div className={clsx('pointer-events-none absolute inset-y-0 right-0 bg-white/60', end > 0 ? 'rounded-r' : 'rounded')} style={{left: end > 0 ? timeToX(end, scale) : 0}} />
			{allDronesItems.map((item) => (
				<div
					key={`all-drones-${item.id}`}
					className="pointer-events-none absolute top-1/2 flex h-5/6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-xl text-gray-500"
					style={{
						width: convertSecondsToPixels(item.duration, scale),
						minWidth: minItemWidth,
						left: timeToX(item.startTime, scale),
						background: 'repeating-linear-gradient(45deg, #d1d5db, #d1d5db 6px, #e5e7eb 6px, #e5e7eb 12px)',
					}}
				>
					<span className="truncate px-1">{blocks[item.blockId]?.name}</span>
				</div>
			))}
			{Object.values(group.items).map((item) => (
				<TimelineBlock key={item.id} scale={scale} item={item} />
			))}
			{hoverX !== undefined && (() => {
				// Where it would land, or else under the pointer, marked as not droppable
				const landsAt = landing(hoverX, selectedBlockId);
				return (
					<HoverTimelineBlock
						scale={scale}
						startTime={landsAt ?? pointerStart(hoverX, selectedBlockId)}
						cannotDrop={!hasDrones || isEmptyBlock(selectedBlockId) || landsAt === undefined}
					/>
				);
			})()}
		</div>
	);
};
