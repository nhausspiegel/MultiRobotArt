import {Button, Modal} from 'flowbite-react';
import React, {type DragEvent, useState} from 'react';

import {allDronesGroupId} from '../../state/groupMigration';
import {type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {ConfirmationModal} from '../modal/ConfirmationModal';
import {RenamableText} from '../utils/RenamableText';

// Drag data type for robot name tags. Lanes accept blocks (text/plain) and ignore it.
const robotDragType = 'application/x-robart-robot';
const noGroupColor = '#9ca3af';

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

// The group a robot is in besides All drones, if any
const useGroupOf = () => {
	const groups = useRobartState((state) => state.timelineState.groups);
	return (robotId: string) => Object.values(groups).find((group) => group.id !== allDronesGroupId && robotId in group.robots);
};

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

const GroupMembersModal = ({open, onClose, group}: {open: boolean; onClose: () => void; group: TimelineGroupState}) => {
	const robots = useRobartState((state) => state.robots);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	const createRobot = useRobartState((state) => state.createRobot);
	const groupOf = useGroupOf();

	return (
		<Modal show={open} onClose={onClose} size="md">
			<Modal.Header>Drones in {group.name}</Modal.Header>
			<Modal.Body>
				{Object.values(robots).map((robot) => {
					const currentGroup = groupOf(robot.id);
					return (
						<label key={robot.id} className="flex items-center gap-2 py-1">
							<input
								type="checkbox"
								checked={currentGroup?.id === group.id}
								onChange={(e) => {
									setRobotGroup(robot.id, e.target.checked ? group.id : undefined);
								}}
							/>
							{robot.name}
							{currentGroup && currentGroup.id !== group.id && (
								<span className="text-sm" style={{color: currentGroup.color}}>(in {currentGroup.name})</span>
							)}
							{!currentGroup && <span className="text-sm text-gray-400">(no group)</span>}
						</label>
					);
				})}
				<button className="mt-2 font-bold text-blue-900 hover:underline" onClick={() => {
					setRobotGroup(createRobot(), group.id);
				}}>
					+ New drone
				</button>
			</Modal.Body>
			<Modal.Footer>
				<Button onClick={onClose}>Done</Button>
			</Modal.Footer>
		</Modal>
	);
};

export const TimelineGroupLabel = ({group}: {group: TimelineGroupState}) => {
	const renameGroup = useRobartState((state) => state.renameGroup);
	const removeGroup = useRobartState((state) => state.removeGroup);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	const [membersOpen, setMembersOpen] = useState(false);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	if (group.id === allDronesGroupId) {
		return (
			<div className="flex h-16 w-52 flex-col justify-center rounded bg-green-400 px-2">
				<div className="font-bold">{group.name}</div>
			</div>
		);
	}

	const color = group.color ?? noGroupColor;
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
				<button className="rounded border border-gray-400 px-1 text-xs hover:bg-gray-100" onClick={() => {
					setMembersOpen(true);
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

			<GroupMembersModal open={membersOpen} onClose={() => {
				setMembersOpen(false);
			}} group={group} />
			<ConfirmationModal
				header={`Remove ${group.name}?`}
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

// Robots that are only in All drones, and where new drones are created. Also a drop target for taking a robot out of
// its group. Always shown, since it holds the only "+ New drone" outside a group's checklist.
export const UngroupedRobots = () => {
	const robots = useRobartState((state) => state.robots);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	const createRobot = useRobartState((state) => state.createRobot);
	const setEditingRobotId = useUIState((state) => state.setEditingRobotId);
	const groupOf = useGroupOf();

	const ungrouped = Object.values(robots).filter((robot) => groupOf(robot.id) === undefined);
	return (
		<div
			className="mx-2 mb-2 flex items-center gap-2 rounded border border-dashed border-gray-400 bg-gray-100 px-2 py-1 text-sm"
			{...acceptRobotDrop((robotId) => {
				setRobotGroup(robotId, undefined);
			})}
		>
			<span>Not in a group:</span>
			{ungrouped.length === 0 && Object.keys(robots).length > 0
				&& <span className="text-gray-400">none (drag a drone here to take it out of its group)</span>}
			{ungrouped.map((robot) => <RobotTag key={robot.id} robotId={robot.id} color={noGroupColor} />)}
			{/* Opens the new drone's window, to set its starting position */}
			<button className="ml-2 rounded border border-blue-600 px-2 text-blue-900 hover:bg-blue-100" onClick={() => {
				setEditingRobotId(createRobot());
			}}>
				+ New drone
			</button>
		</div>
	);
};
