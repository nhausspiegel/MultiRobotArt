/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-extraneous-dependencies */
import {type DragEventHandler, useRef, useState} from 'react';

import {type CodeBlock, type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {HoverTimelineBlock} from './HoverTimelineBlock';
import {TickMark} from './TickMark';
import {TimelineBlock} from './TimelineBlock';
import React from 'react';

type TimelineGroupProps = {
	group: TimelineGroupState;
};

export const pixelsPerSecond = 100;
export const SUBDIVISIONS_PER_SECOND = 8;

export const convertPixelsToSeconds = (distance: number, scale: number) => {
	return distance / (pixelsPerSecond * scale);
};

export const convertSecondsToPixels = (duration: number, scale: number) => {
	return duration * pixelsPerSecond * scale;
};

export const blockOverlaps = (
	group: TimelineGroupState,
	blocks: Record<string, CodeBlock>,
	startTime: number | undefined,
	selectedBlock: CodeBlock,
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
  	const newBlockEnd = startTime + selectedBlock.duration;

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

	const computeTimelineBlockOffset = (clientX: number | undefined, blockId: string | undefined) => {
		if (clientX === undefined) return;

		if (laneBodyRef.current) {
			const parentOffsetX = (laneBodyRef.current.offsetParent as HTMLElement)?.offsetLeft;
			const parentScrollOffsetX = laneBodyRef.current.parentElement?.scrollLeft;
			const offsetX = clientX - parentOffsetX;

			if (blockId === undefined || parentScrollOffsetX === undefined) return;
			if (blocks[blockId] === undefined) return;
			const startTime = (offsetX + parentScrollOffsetX) / (pixelsPerSecond * scale) - blocks[blockId].duration / 2;

			return startTime;
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

		const startTime = computeTimelineBlockOffset(e.clientX, blockId);

		if (startTime !== undefined && !blockOverlaps(group, blocks, startTime, blocks[blockId])) {
			// TODO: Add isTraj appropriately (Currently hardcoded false), find better way to do it...
			var isTraj = false;
			if ( blocks[blockId].javaScript.includes('circle')) {
				isTraj = true;
			}

			addBlockToTimeline(group.id, blockId, startTime, isTraj);
		}
	};

	return (
		<div
			className="relative h-16 rounded bg-blue-300"
			ref={laneBodyRef}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			style={{width: `${convertSecondsToPixels(group.duration, scale)}px`}}
		>
			{[...new Array(group.duration * SUBDIVISIONS_PER_SECOND)].map((_, tickNumber) => (
				<TickMark tickNumber={tickNumber} key={tickNumber} scale={scale} subdivisionsPerSecond={SUBDIVISIONS_PER_SECOND} />
			))}
			{Object.values(group.items).map((item) => (
				<TimelineBlock key={item.id} scale={scale} item={item} />
			))}
			{hoverX !== undefined && (
				<HoverTimelineBlock
					scale={scale}
					startTime={computeTimelineBlockOffset(hoverX, selectedBlockId)}
					isOverlapping={blockOverlaps(group, blocks, computeTimelineBlockOffset(hoverX, selectedBlockId), blocks[selectedBlockId ?? ''])}
				/>
			)}
		</div>
	);
};
