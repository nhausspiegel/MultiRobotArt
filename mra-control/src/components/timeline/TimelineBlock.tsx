/* eslint-disable import/no-extraneous-dependencies */
import {blockColor, type TimelineItem, useRobartState} from '@MRAControl/state/useRobartState';
import {faXmarkCircle} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {useDrag} from '@use-gesture/react';
import clsx from 'clsx';
import React, {useState} from 'react';
import {create} from 'zustand';

import {convertPixelsToSeconds, convertSecondsToPixels, laneOccupiedItems, minItemWidth, pixelsPerSecond, snapReach, timeToX} from './TimelineGroupBody';
import {landingTime} from './placement';

// The timeline item being dragged, where it would land: read by what follows it before the drop (the show's end line,
// and All drones' busy stripes on the other lanes)
export const useItemDrag = create<{drag?: {itemId: string; laneId: string; startTime: number}}>(() => ({}));

// The show's end, following a dragged item
export const useShowEnd = () => {
	const drag = useItemDrag((state) => state.drag);
	return useRobartState((state) => Math.max(0, ...Object.values(state.timelineState.groups).flatMap((group) =>
		Object.values(group.items).map((item) => (item.id === drag?.itemId ? drag.startTime : item.startTime) + item.duration))));
};

export const TimelineBlock = ({item, scale}: {item: TimelineItem; scale: number}) => {
	const blockName = useRobartState((state) => state.blocks[item.blockId]?.name);
	// The block's color, as in the block list
	const color = useRobartState((state) => (state.blocks[item.blockId] ? blockColor(state.blocks[item.blockId]) : undefined));
	const removeItem = useRobartState((state) => state.removeTimelineItem);
	const updateItem = useRobartState((state) => state.updateBlockInTimeline);
	const moveItem = useRobartState((state) => state.moveTimelineItem);
	// Pointer offset while dragging. The item follows the pointer freely and only moves in the project on release.
	const [drag, setDrag] = useState<{x: number; y: number; valid: boolean}>();

	const bind = useDrag(({active, tap, movement: [mx, my], xy: [x, y]}) => {
		if (tap) return; // A click: focuses the item for Delete
		const {groups} = useRobartState.getState().timelineState;
		// The lane under the pointer; the dragged item itself is on top, so look through it
		const laneId = document.elementsFromPoint(x, y)
			.map((element) => (element as HTMLElement).dataset?.laneId)
			.find(Boolean) ?? item.groupId;
		// Under the pointer but not before 0, and against a neighbor it would overlap
		const underPointer = Math.max(0, item.startTime + convertPixelsToSeconds(mx, scale));
		const landing = landingTime(laneOccupiedItems(groups, laneId), underPointer, item.duration, snapReach(item.duration, scale), item.id);
		const startTime = landing ?? underPointer;
		// Can't move into a lane with no drones; moving within its own lane is fine
		const laneHasDrones = Object.keys(groups[laneId]?.robots ?? {}).length > 0;
		const valid = (laneId === item.groupId || laneHasDrones) && landing !== undefined;

		if (active) {
			// Drawn where it would land
			setDrag({x: convertSecondsToPixels(startTime - item.startTime, scale), y: my, valid});
			useItemDrag.setState({drag: {itemId: item.id, laneId, startTime}});
			return;
		}

		setDrag(undefined);
		useItemDrag.setState({drag: undefined});
		if (!valid) return; // Snaps back
		if (laneId === item.groupId) updateItem(item.groupId, item.id, startTime);
		else moveItem(item.groupId, item.id, laneId, startTime);
	// keys: false, otherwise bind() returns its own onKeyDown (arrow-key dragging) that replaces the delete handler below
	}, {pointer: {keys: false}, filterTaps: true});

	return (
		<div
			// Focusable so a click selects it; clicking anywhere else deselects
			tabIndex={0}
			className={clsx(
				'absolute top-1/2 flex h-5/6 -translate-y-1/2 cursor-move items-center justify-center rounded-xl border border-black/15 touch-none select-none focus:outline-none focus:ring-2 focus:ring-indigo-600',
				drag && !drag.valid && 'bg-red-400',
			)}
			style={{
				backgroundColor: drag && !drag.valid ? undefined : color,
				width: pixelsPerSecond * scale * item.duration,
				minWidth: minItemWidth,
				left: timeToX(item.startTime, scale),
				// Replaces the class's -50% y translate while dragging, so keep it
				transform: drag ? `translate(${drag.x}px, calc(-50% + ${drag.y}px))` : undefined,
				zIndex: drag ? 20 : undefined,
			}}
			onKeyDown={(e) => {
				// Mac's delete key reports Backspace
				if (e.key !== 'Delete' && e.key !== 'Backspace') return;
				e.preventDefault();
				// Blockly listens for keydown on document and would also delete its selected block
				e.stopPropagation();
				removeItem(item.groupId, item.id);
			}}
			{...bind()}
		>
			{/* Can't go here: the same mark as the drop preview from the block list */}
			{drag && !drag.valid && <FontAwesomeIcon icon={faXmarkCircle} className="mx-1 shrink-0 text-red-700" />}
			<span className="block overflow-hidden text-ellipsis whitespace-nowrap">{blockName}</span>
		</div>
	);
};
