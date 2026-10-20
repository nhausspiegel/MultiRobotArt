import clsx from 'clsx';
import React, {type DragEvent, useState} from 'react';

import {allDronesGroupId, isGroupHidden, noGroupColor} from '../../state/groupMigration';
import {type TimelineGroupState, useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {ConfirmationModal} from '../modal/ConfirmationModal';
import {RenamableText} from '../utils/RenamableText';

// Drag data type for robot name tags. Lanes accept blocks (text/plain) and ignore it.
const robotDragType = 'application/x-robart-robot';

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

// Lucide's eye and eye-off icons (ISC license)
const EyeIcon = ({closed}: {closed: boolean}) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
		{closed ? (
			<>
				<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
				<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
				<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
				<line x1="2" x2="22" y1="2" y2="22" />
			</>
		) : (
			<>
				<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
				<circle cx="12" cy="12" r="3" />
			</>
		)}
	</svg>
);

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
	const setGroupsHidden = useRobartState((state) => state.setGroupsHidden);
	const hidden = useRobartState((state) => isGroupHidden(state.timelineState.groups, group.id));
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
	const isAllDrones = group.id === allDronesGroupId;

	// Hidden groups' robots are left out of the simulation and the export. All drones' eye hides or shows every group.
	const eyeButton = (
		<button
			aria-label={isAllDrones ? (hidden ? 'Show all groups' : 'Hide all groups') : (hidden ? 'Show in simulation' : 'Hide from simulation')}
			title={isAllDrones ? (hidden ? 'Show all groups' : 'Hide all groups') : (hidden ? 'Show in simulation' : 'Hide from simulation')}
			className="flex w-4 shrink-0 items-center justify-center text-black"
			onClick={() => {
				const groupIds = isAllDrones ? Object.keys(useRobartState.getState().timelineState.groups).filter((id) => id !== allDronesGroupId) : [group.id];
				setGroupsHidden(groupIds, !hidden);
			}}
		>
			<EyeIcon closed={hidden} />
		</button>
	);

	if (isAllDrones) {
		return (
			<div className={clsx('flex w-52 items-center gap-1 rounded bg-green-400 px-2', group.collapsed ? 'h-7' : 'h-16', hidden && 'opacity-50')}>
				{eyeButton}
				<div className="truncate font-bold">{group.name}</div>
			</div>
		);
	}

	const color = group.color ?? noGroupColor;
	const robotIds = Object.keys(group.robots);

	if (group.collapsed) {
		return (
			<div
				className={clsx('flex h-7 w-52 items-center gap-1 rounded bg-white px-2', hidden && 'opacity-50')}
				style={{borderLeft: `8px solid ${color}`}}
				{...acceptRobotDrop((robotId) => {
					setRobotGroup(robotId, group.id);
				})}
			>
				{eyeButton}
				<div className="truncate font-bold">{group.name}</div>
			</div>
		);
	}

	return (
		<div
			className={clsx('flex h-16 w-52 flex-col justify-center gap-1 rounded bg-white px-2', hidden && 'opacity-50')}
			style={{borderLeft: `8px solid ${color}`}}
			{...acceptRobotDrop((robotId) => {
				setRobotGroup(robotId, group.id);
			})}
		>
			<div className="flex items-center gap-1">
				{eyeButton}
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
					// Nothing to lose without drones or blocks, so no confirmation
					if (robotIds.length === 0 && Object.keys(group.items).length === 0) removeGroup(group.id);
					else setConfirmRemoveOpen(true);
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
