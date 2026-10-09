import {allDronesGroupId} from '@MRAControl/state/groupMigration';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useRobotManager} from '@MRAControl/state/useRobotManager';
import React from 'react';

export const RobotGroupEditor = () => {
	const groups = useRobartState((state) => state.timelineState.groups);
	const selectedRobotId = useRobotManager((state) => state.selectedRobotId);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);

	if (selectedRobotId === undefined) return <></>;

	// A robot is in at most one group besides All drones
	const otherGroups = Object.values(groups).filter((group) => group.id !== allDronesGroupId);
	const currentGroup = otherGroups.find((group) => selectedRobotId in group.robots);

	return (
		<div className="flex items-center gap-3">
			<label htmlFor="robot-group" className="text-lg font-extrabold">Group</label>
			<select
				id="robot-group"
				className="rounded border-gray-300"
				style={{borderLeft: `8px solid ${currentGroup?.color ?? '#9ca3af'}`}}
				value={currentGroup?.id ?? ''}
				onChange={(e) => {
					setRobotGroup(selectedRobotId, e.target.value || undefined);
				}}
			>
				<option value="">No group</option>
				{otherGroups.map((group) => (
					<option key={group.id} value={group.id}>{group.name}</option>
				))}
			</select>
		</div>
	);
};
