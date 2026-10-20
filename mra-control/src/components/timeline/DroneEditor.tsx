import {Button, Modal} from 'flowbite-react';
import React, {useState} from 'react';

import {noGroupColor, otherGroups, robotGroup} from '../../state/groupMigration';
import {useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {ConfirmationModal} from '../modal/ConfirmationModal';
import {RenamableText} from '../utils/RenamableText';
import {XyzInputs, isNumber} from '../utils/XyzInputs';

// The drone is only updated while all three are numbers
const StartingPosition = ({robotId}: {robotId: string}) => {
	const startingPosition = useRobartState((state) => state.robots[robotId].startingPosition);
	const saveRobot = useRobartState((state) => state.saveRobot);
	return <XyzInputs title="Starting position" value={startingPosition} isValid={isNumber} onSave={(position) => {
		saveRobot(robotId, {startingPosition: position});
	}} />;
};

const GroupSelect = ({robotId}: {robotId: string}) => {
	const groups = useRobartState((state) => state.timelineState.groups);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	// Every drone is in exactly one group besides All drones
	const choices = otherGroups(groups);
	const currentGroup = robotGroup(groups, robotId);

	return (
		<div className="flex items-center gap-3">
			<label htmlFor="drone-group" className="font-bold">Group</label>
			<select
				id="drone-group"
				className="rounded border-gray-300"
				style={{borderLeft: `8px solid ${currentGroup?.color ?? noGroupColor}`}}
				value={currentGroup?.id}
				onChange={(e) => {
					setRobotGroup(robotId, e.target.value);
				}}
			>
				{choices.map((group) => (
					<option key={group.id} value={group.id}>{group.name}</option>
				))}
			</select>
		</div>
	);
};

// Opened by clicking a drone's name tag on the timeline
export const DroneEditor = () => {
	const robotId = useUIState((state) => state.editingRobotId);
	const setEditingRobotId = useUIState((state) => state.setEditingRobotId);
	const robot = useRobartState((state) => state.robots[robotId ?? '']);
	const saveRobot = useRobartState((state) => state.saveRobot);
	const deleteRobot = useRobartState((state) => state.deleteRobot);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

	const close = () => {
		setEditingRobotId(undefined);
	};

	// The modals stay mounted and are shown/hidden. flowbite's Modal removes its portal container when unmounted, and
	// React StrictMode's dev-only remount runs that cleanup right after mounting, so a freshly mounted modal rendered
	// into a detached container (invisible) until its next re-render: every other "+ New drone" showed nothing.
	return (
		<>
			<Modal show={robot !== undefined} onClose={close} size="md">
				{robot && (
					<>
						<Modal.Header>
							<RenamableText
								text={robot.name}
								className="text-xl font-extrabold"
								updateText={(newText) => {
									if (newText.trim() !== '') saveRobot(robot.id, {name: newText.trim()});
								}}
							/>
						</Modal.Header>
						<Modal.Body>
							<div className="flex flex-col gap-4">
								<StartingPosition key={robot.id} robotId={robot.id} />
								<GroupSelect robotId={robot.id} />
							</div>
						</Modal.Body>
						<Modal.Footer>
							<div className="flex w-full justify-between">
								<Button color="failure" onClick={() => {
									setConfirmDeleteOpen(true);
								}}>Delete drone</Button>
								<Button onClick={close}>Done</Button>
							</div>
						</Modal.Footer>
					</>
				)}
			</Modal>
			<ConfirmationModal
				header={`Delete ${robot?.name ?? ''}?`}
				open={confirmDeleteOpen}
				onCancel={() => {
					setConfirmDeleteOpen(false);
				}}
				onConfirm={() => {
					setConfirmDeleteOpen(false);
					close();
					if (robot) deleteRobot(robot.id);
				}}
			/>
		</>
	);
};
