import {type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {RenamableText} from '../utils/RenamableText';
import React from 'react';

type TimelineGroupProps = {
	group: TimelineGroupState;
};

export const TimelineGroupLabel = ({group}: TimelineGroupProps) => {
	const renameGroup = useRobartState((state) => state.renameGroup);
	return (
		<div className="flex h-16 w-16 items-center justify-center rounded bg-green-400">
			{/* Click to rename. Only the name changes; the id (used in exported file names) stays. */}
			<RenamableText
				text={group.name}
				className="text-center font-bold"
				updateText={(newText) => {
					if (newText.trim() !== '') renameGroup(group.id, newText.trim());
				}}
			/>
		</div>
	);
};
