import {faSync} from '@fortawesome/free-solid-svg-icons';
import {Button, Checkbox, Label, Modal, Tabs, TabsRef, TextInput} from 'flowbite-react';
import clsx from 'clsx';
import React, {useEffect, useRef, useState} from 'react';

import {CancelButton} from '../../components/buttons/CancelButton';
import {IconButton} from '../../components/buttons/IconButton';
import {ConfirmationModal} from '../../components/modal/ConfirmationModal';
import {defaultBoundingBoxSize, useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import {CurveEditorModal} from '../curveEditor/CurveEditorModal';
import {type Group} from 'three';
import { useSimulator } from '@MRAControl/state/useSimulator';
import { Crazyflie, CrazyflieProps } from '@MRAControl/components/vector/Crazyflie';

const isPositiveNumber = (value: string) => value.trim() !== '' && Number(value) > 0;

// The boxes keep whatever is typed; the size is only saved while all three are positive numbers
const BoundingBoxSizeEditor = () => {
	const size = useRobartState((state) => state.boundingBoxSize ?? defaultBoundingBoxSize);
	const setSize = useRobartState((state) => state.setBoundingBoxSize);
	const [values, setValues] = useState(size.map(String));
	// Follow changes made elsewhere (Reset Project, Load Project), but not the ones typed here
	useEffect(() => {
		if (!values.every((value, i) => Number(value) === size[i])) setValues(size.map(String));
	}, [size]);

	return (
		<div className="mt-4">
			<div className="mb-1 font-bold">Bounding box dimensions (m):</div>
			<div className="flex gap-3">
				{['x', 'y', 'z'].map((axis, i) => (
					<label key={axis} className="flex items-center gap-1">
						{axis}
						<input
							className={clsx('w-20 rounded', isPositiveNumber(values[i]) ? 'border-gray-300' : 'border-2 border-red-500')}
							inputMode="decimal"
							value={values[i]}
							onChange={(e) => {
								const next = values.map((value, j) => (j === i ? e.target.value : value));
								setValues(next);
								if (next.every(isPositiveNumber)) setSize(next.map(Number) as [number, number, number]);
							}}
						/>
					</label>
				))}
			</div>
		</div>
	);
};

export const SettingsModal = () => {
	const settingsModalOpen = useUIState((state) => state.settingsModalOpen);
	const toggleSettingsModal = useUIState((state) => state.toggleSettingsModal);
	const resetProject = useRobartState((state) => state.resetProject);
	const projectName = useRobartState((state) => state.projectName);
	const setProjectName = useRobartState((state) => state.setProjectName);
	const toggleCurveEditor = useUIState((state) => state.toggleCurveEditor);
	const marker = useRef<Group>(null!);
	const robots = useSimulator((state) => state.robots);

	const [confirmOpen, setConfirmOpen] = useState(false);
	const renderBoundingBoxes = useSimulator((state) => state.renderBoundingBoxes);
	const handleBoundingBoxChange = (() => {
		useSimulator.setState({renderBoundingBoxes: !renderBoundingBoxes});
	});
	return (
		<>
			<Modal show={settingsModalOpen} onClose={toggleSettingsModal}>
				<Modal.Header>Settings</Modal.Header>
				<Modal.Body>
					<Tabs.Group style="default">
						<Tabs.Item active title="Project">
							<div>
								<div className="mb-2 block">
									<Label value="Project Name" />
								</div>
								<TextInput value={projectName} onChange={(e) => {
									setProjectName(e.target.value); 
								}} />
							</div>
						</Tabs.Item>
						<Tabs.Item title="Preferences">
							{/* Controlled, so it shows the current setting when Settings is reopened */}
							<Checkbox
								checked={!renderBoundingBoxes}
								onChange={handleBoundingBoxChange} />
							<span style={{ marginLeft: '10px' }}>Remove Bounding Boxes</span>
							<BoundingBoxSizeEditor />
						</Tabs.Item>
						<Tabs.Item title="Utilities">
							<Button onClick={toggleCurveEditor}>Curve Editor</Button>
						</Tabs.Item>
					</Tabs.Group>
				</Modal.Body>
				<Modal.Footer>
					<CancelButton onClick={toggleSettingsModal} />
					<IconButton color="warning" text="Reset Project" icon={faSync} onClick={() => {
						setConfirmOpen(true); 
					}} />
				</Modal.Footer>
			</Modal>
			<ConfirmationModal
				header="Confirm Reset Project"
				open={confirmOpen}
				onCancel={() => {
					setConfirmOpen(false); 
				}}
				onConfirm={() => {
					resetProject();
					setConfirmOpen(false);
					toggleSettingsModal();
				}}
			>
        Are you sure?
			</ConfirmationModal>
			<CurveEditorModal />
		</>
	);
};
