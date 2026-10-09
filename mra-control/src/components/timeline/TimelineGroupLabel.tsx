import React, {type DragEvent, useState} from 'react';

import {allDronesGroupId} from '../../state/groupMigration';
import {type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {ConfirmationModal} from '../modal/ConfirmationModal';
import {RenamableText} from '../utils/RenamableText';

// Drag data type for robot name tags. Lanes accept blocks (text/plain) and ignore it.
const robotDragType = 'application/x-robart-robot';
const defaultGroupColor = '#9ca3af';

const acceptRobotDrop = (onRobot: (robotId: string) => void) => ({
	onDragOver: (e: DragEvent) => {
		if (e.dataTransfer.types.includes(robotDragType)) e.preventDefault();
	},
	onDrop: (e: DragEvent) => {
		const robotId = e.dataTransfer.getData(robotDragType);
		if (!robotId) return;
		e.preventDefault();
		onRobot(robotId);
	},
});

const RobotTag = ({robotId, color}: {robotId: string; color: string}) => {
	const name = useRobartState((state) => state.robots[robotId]?.name);
	const setEditingRobotId = useUIState((state) => state.setEditingRobotId);
	return (
		<span
			draggable
			onDragStart={(e) => {
				e.dataTransfer.setData(robotDragType, robotId);
				e.dataTransfer.effectAllowed = 'move';
			}}
			onClick={() => {
				setEditingRobotId(robotId);
			}}
			title="Drag onto another group to move"
			className="cursor-grab whitespace-nowrap rounded-full px-2 text-xs"
			style={{background: `${color}40`}}
		>
			{name}
		</span>
	);
};

export const TimelineGroupLabel = ({group}: {group: TimelineGroupState}) => {
	const renameGroup = useRobartState((state) => state.renameGroup);
	const removeGroup = useRobartState((state) => state.removeGroup);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	const createRobot = useRobartState((state) => state.createRobot);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	if (group.id === allDronesGroupId) {
		return (
			<div className="flex h-16 w-52 flex-col justify-center rounded bg-green-400 px-2">
				<div className="font-bold">{group.name}</div>
			</div>
		);
	}

	const color = group.color ?? defaultGroupColor;
	const robotIds = Object.keys(group.robots);
	return (
		<div
			className="flex h-16 w-52 flex-col justify-center gap-1 rounded bg-white px-2"
			style={{borderLeft: `8px solid ${color}`}}
			{...acceptRobotDrop((robotId) => {
				setRobotGroup(robotId, group.id);
			})}
		>
			<div className="flex items-center gap-1">
				{/* Click to rename. Only the name changes; the id (used in exported file names) stays. */}
				<div className="min-w-0 flex-1 truncate">
					<RenamableText
						text={group.name}
						className="font-bold"
						updateText={(newText) => {
							if (newText.trim() !== '') renameGroup(group.id, newText.trim());
						}}
					/>
				</div>
				{/* Adds a drone to this group at the next free spot; click its name tag to edit it */}
				<button className="rounded border border-gray-400 px-1 text-xs hover:bg-gray-100" onClick={() => {
					createRobot(group.id);
				}}>
					+ add
				</button>
				<button aria-label={`Remove ${group.name}`} title="Remove group" className="px-1 text-gray-500 hover:text-red-600" onClick={() => {
					setConfirmRemoveOpen(true);
				}}>
					×
				</button>
			</div>
			<div className="flex gap-1 overflow-x-auto">
				{robotIds.length === 0
					? <span className="text-xs text-gray-400">No drones yet</span>
					: robotIds.map((robotId) => <RobotTag key={robotId} robotId={robotId} color={color} />)}
			</div>

			<ConfirmationModal
				// Its drones are deleted with it, so say so
				header={robotIds.length === 0 ? `Remove ${group.name}?` : `Remove ${group.name} and its ${robotIds.length} drone${robotIds.length === 1 ? '' : 's'}?`}
				open={confirmRemoveOpen}
				onCancel={() => {
					setConfirmRemoveOpen(false);
				}}
				onConfirm={() => {
					removeGroup(group.id);
					setConfirmRemoveOpen(false);
				}}
			/>
		</div>
	);
};
