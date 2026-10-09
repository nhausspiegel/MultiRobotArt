import {faPlusCircle, faXmarkCircle} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import clsx from 'clsx';
import React from 'react';

import {useRobartState} from '../../state/useRobartState';
import {minItemWidth, pixelsPerSecond, timeToX} from './TimelineGroupBody';

export const HoverTimelineBlock = ({scale, startTime, cannotDrop}: {scale: number; startTime: number | undefined; cannotDrop: boolean}) => {
	const selectedBlockId = useRobartState((state) => state.editingBlockId);
	const selectedBlock = useRobartState((state) => state.blocks[selectedBlockId ?? '']);

	if (startTime === undefined || !selectedBlockId) return <></>;

	return (
		<div
			className={clsx(
				'absolute top-1/2 flex h-5/6 -translate-y-1/2 items-center justify-center rounded-xl border border-dashed',
				cannotDrop ? 'border-red-500/50 bg-red-300/50 text-red-500/50' : 'border-green-500/50 bg-green-300/50 text-green-500/50',
			)}
			style={{
				width: pixelsPerSecond * scale * selectedBlock.duration,
				minWidth: minItemWidth,
				left: timeToX(startTime, scale),
			}}
		>
			{cannotDrop ? <FontAwesomeIcon icon={faXmarkCircle} /> : <FontAwesomeIcon icon={faPlusCircle} />}
		</div>
	);
};
