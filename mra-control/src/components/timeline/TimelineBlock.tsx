/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
import {type TimelineItem, useRobartState} from '@MRAControl/state/useRobartState';
import {useDrag} from '@use-gesture/react';
import React from 'react';

import {pixelsPerSecond, blockOverlaps, convertPixelsToSeconds} from './TimelineGroupBody';

export const TimelineBlock = ({item, scale}: {item: TimelineItem; scale: number}) => {
	const blocks = useRobartState((state) => state.blocks);
	const removeItem = useRobartState((state) => state.removeTimelineItem);
	const groups = useRobartState((state) => state.timelineState.groups);
	const updateItem = useRobartState((state) => state.updateBlockInTimeline);

	const correspondingBlock = blocks[item.blockId];

	const bind = useDrag(({delta: [x, _]}) => {
		const secondsDelta = convertPixelsToSeconds(x, scale);
		const newStartTime = item.startTime + secondsDelta;

		if (!blockOverlaps(groups[item.groupId], blocks, newStartTime, correspondingBlock, item.id)) {
			updateItem(item.groupId, item.id, newStartTime);
		}
	});
	let duration = 0;
	if (item === undefined) {
		duration = 0.1;
	} else {
		duration = item.duration;
	}

	return (
		<div
			// Focusable so a click selects it; clicking anywhere else deselects
			tabIndex={0}
			className="absolute top-1/2 flex h-5/6 -translate-y-1/2 cursor-move items-center justify-center rounded-xl bg-purple-400 touch-none select-none focus:outline-none focus:ring-2 focus:ring-purple-800"
			style={{
				width: pixelsPerSecond * scale * duration,
				left: pixelsPerSecond * scale * item.startTime,
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
			<span className="block overflow-hidden text-ellipsis whitespace-nowrap">{correspondingBlock.name}</span>
		</div>
	);
};
