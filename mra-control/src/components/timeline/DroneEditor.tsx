import clsx from 'clsx';
import {Button, Modal} from 'flowbite-react';
import React, {useState} from 'react';

import {allDronesGroupId} from '../../state/groupMigration';
import {useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {ConfirmationModal} from '../modal/ConfirmationModal';
import {RenamableText} from '../utils/RenamableText';

const axes = ['x', 'y', 'z'];
const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));

// The boxes keep whatever is typed; the drone is only updated while all three are numbers
const StartingPosition = ({robotId}: {robotId: string}) => {
	const startingPosition = useRobartState((state) => state.robots[robotId].startingPosition);
	const saveRobot = useRobartState((state) => state.saveRobot);
	const [values, setValues] = useState(startingPosition.map(String));

	return (
		<div>
			<div className="mb-1 font-bold">Starting position</div>
			<div className="flex gap-3">
				{axes.map((axis, i) => (
					<label key={axis} className="flex items-center gap-1">
						{axis}
						<input
							// border: preflight zeroes input border widths, so a color alone draws nothing
							className={clsx('w-20 rounded px-2 py-1', isNumber(values[i]) ? 'border border-gray-300' : 'border-2 border-red-500')}
							inputMode="decimal"
							value={values[i]}
							onChange={(e) => {
								const next = values.map((value, j) => (j === i ? e.target.value : value));
								setValues(next);
								if (next.every(isNumber)) saveRobot(robotId, {startingPosition: next.map(Number) as [number, number, number]});
							}}
						/>
					</label>
				))}
			</div>
		</div>
	);
};

const GroupSelect = ({robotId}: {robotId: string}) => {
	const groups = useRobartState((state) => state.timelineState.groups);
	const setRobotGroup = useRobartState((state) => state.setRobotGroup);
	// Every drone is in exactly one group besides All drones
	const otherGroups = Object.values(groups).filter((group) => group.id !== allDronesGroupId);
	const currentGroup = otherGroups.find((group) => robotId in group.robots);

	return (
		<div className="flex items-center gap-3">
			<label htmlFor="drone-group" className="font-bold">Group</label>
			<select
				id="drone-group"
				className="rounded border-gray-300"
				style={{borderLeft: `8px solid ${currentGroup?.color ?? '#9ca3af'}`}}
				value={currentGroup?.id}
				onChange={(e) => {
					setRobotGroup(robotId, e.target.value);
				}}
			>
				{otherGroups.map((group) => (
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
