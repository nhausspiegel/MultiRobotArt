import {faSync} from '@fortawesome/free-solid-svg-icons';
import {Button, Checkbox, Label, Modal, Tabs, TabsRef, TextInput} from 'flowbite-react';
import clsx from 'clsx';
import React, {useEffect, useRef, useState} from 'react';

import {CancelButton} from '../../components/buttons/CancelButton';
import {IconButton} from '../../components/buttons/IconButton';
import {ConfirmationModal} from '../../components/modal/ConfirmationModal';
import {defaultBoundingBoxSize, defaultLimits, useRobartState} from '../../state/useRobartState';
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
		<div>
			<div className="mb-1 font-bold">Bounding box dimensions (m):</div>
			<div className="flex gap-3">
				{['x', 'y', 'z'].map((axis, i) => (
					<label key={axis} className="flex items-center gap-1">
						{axis}
						<input
							// border: preflight zeroes input border widths, so a color alone draws nothing
							className={clsx('w-20 rounded px-2 py-1', isPositiveNumber(values[i]) ? 'border border-gray-300' : 'border-2 border-red-500')}
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

const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
// border: preflight zeroes input border widths, so a color alone draws nothing
const fieldClass = (valid: boolean) => clsx('w-20 rounded px-2 py-1 disabled:opacity-50', valid ? 'border border-gray-300' : 'border-2 border-red-500');

// What measuring the show warns about. Like the box size, fields keep whatever is typed and are only saved while valid.
const LimitsEditor = () => {
	const limits = useRobartState((state) => state.limits ?? defaultLimits);
	const setLimits = useRobartState((state) => state.setLimits);
	const area = [...limits.workAreaMin, ...limits.workAreaMax];
	const [speed, setSpeed] = useState(String(limits.speedLimit));
	// Lowest x, y, z, then highest x, y, z
	const [areaValues, setAreaValues] = useState(area.map(String));
	// Follow changes made elsewhere (Reset Project, Load Project), but not the ones typed here
	useEffect(() => {
		if (Number(speed) !== limits.speedLimit) setSpeed(String(limits.speedLimit));
	}, [limits.speedLimit]);
	useEffect(() => {
		if (!areaValues.every((value, i) => Number(value) === area[i])) setAreaValues(area.map(String));
	}, [limits.workAreaMin, limits.workAreaMax]);
	const axisValid = (values: string[], axis: number) =>
		isNumber(values[axis]) && isNumber(values[axis + 3]) && Number(values[axis]) < Number(values[axis + 3]);

	const areaField = (index: number) => (
		<input
			className={fieldClass(axisValid(areaValues, index % 3))}
			value={areaValues[index]}
			disabled={!limits.workAreaOn}
			onChange={(e) => {
				const next = areaValues.map((value, j) => (j === index ? e.target.value : value));
				setAreaValues(next);
				if ([0, 1, 2].every((axis) => axisValid(next, axis))) {
					setLimits({
						workAreaMin: next.slice(0, 3).map(Number) as [number, number, number],
						workAreaMax: next.slice(3).map(Number) as [number, number, number],
					});
				}
			}}
		/>
	);

	return (
		<div className="mt-4 flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<label className="flex items-center gap-2">
					<Checkbox checked={limits.speedLimitOn} onChange={() => {
						setLimits({speedLimitOn: !limits.speedLimitOn});
					}} />
					Speed limit (m/s):
				</label>
				<input
					className={fieldClass(isPositiveNumber(speed))}
					inputMode="decimal"
					value={speed}
					disabled={!limits.speedLimitOn}
					onChange={(e) => {
						setSpeed(e.target.value);
						if (isPositiveNumber(e.target.value)) setLimits({speedLimit: Number(e.target.value)});
					}}
				/>
			</div>
			<label className="flex items-center gap-2">
				<Checkbox checked={limits.workAreaOn} onChange={() => {
					setLimits({workAreaOn: !limits.workAreaOn});
				}} />
				Work area (m):
			</label>
			{['X', 'Y', 'Z'].map((axis, i) => (
				<div key={axis} className="ml-6 flex items-center gap-2">
					{axis} from {areaField(i)} to {areaField(i + 3)}
				</div>
			))}
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
							<BoundingBoxSizeEditor />
							<div className="mt-4 flex items-center">
								{/* Controlled, so it shows the current setting when Settings is reopened */}
								<Checkbox
									checked={!renderBoundingBoxes}
									onChange={handleBoundingBoxChange} />
								<span style={{ marginLeft: '10px' }}>Remove Bounding Boxes</span>
							</div>
							<LimitsEditor />
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
