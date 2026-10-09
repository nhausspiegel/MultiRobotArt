/* eslint-disable import/no-extraneous-dependencies */
import {type TimelineItem, useRobartState} from '@MRAControl/state/useRobartState';
import {useDrag} from '@use-gesture/react';
import clsx from 'clsx';
import React, {useState} from 'react';

import {blockOverlaps, convertPixelsToSeconds, laneOccupiedItems, minItemWidth, pixelsPerSecond} from './TimelineGroupBody';

export const TimelineBlock = ({item, scale}: {item: TimelineItem; scale: number}) => {
	const blockName = useRobartState((state) => state.blocks[item.blockId]?.name);
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
		const startTime = Math.max(0, item.startTime + convertPixelsToSeconds(mx, scale));
		// Can't move into a lane with no drones; moving within its own lane is fine
		const laneHasDrones = Object.keys(groups[laneId]?.robots ?? {}).length > 0;
		const valid = (laneId === item.groupId || laneHasDrones)
			&& !blockOverlaps(laneOccupiedItems(groups, laneId), startTime, item.duration, item.id);

		if (active) {
			setDrag({x: mx, y: my, valid});
			return;
		}

		setDrag(undefined);
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
				'absolute top-1/2 flex h-5/6 -translate-y-1/2 cursor-move items-center justify-center rounded-xl touch-none select-none focus:outline-none focus:ring-2 focus:ring-purple-800',
				drag && !drag.valid ? 'bg-red-400' : 'bg-purple-400',
			)}
			style={{
				width: pixelsPerSecond * scale * item.duration,
				minWidth: minItemWidth,
				left: pixelsPerSecond * scale * item.startTime,
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
			<span className="block overflow-hidden text-ellipsis whitespace-nowrap">{blockName}</span>
		</div>
	);
};
