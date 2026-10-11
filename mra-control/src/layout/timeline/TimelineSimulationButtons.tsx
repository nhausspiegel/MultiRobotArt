import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {faPause, faPlay, faSquare, type IconDefinition} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import clsx from 'clsx';
import React, {useEffect} from 'react';

// Compact, to fit the timeline's top-left corner (as tall as the ruler); they share its width
const SimButton = ({icon, text, color, onClick, disabled}: {icon: IconDefinition; text: string; color: 'green' | 'red' | 'white'; onClick: () => void; disabled?: boolean}) => (
	<button
		className={clsx(
			'flex h-full flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
			color === 'green' && 'border-transparent bg-green-700 text-white enabled:hover:bg-green-800',
			color === 'red' && 'border-transparent bg-red-700 text-white hover:bg-red-800',
			color === 'white' && 'border-gray-200 bg-white text-gray-900 hover:bg-gray-100',
		)}
		onClick={onClick}
		disabled={disabled}
	>
		<FontAwesomeIcon icon={icon} className="h-2.5 w-2.5" />
		{text}
	</button>
);

export const TimelineSimulationButtons = () => {
	const simulationStatus = useSimulator((state) => state.status);
	const play = useSimulator((state) => state.play);
	const halt = useSimulator((state) => state.halt);
	const pause = useSimulator((state) => state.pause);
	const resume = useSimulator((state) => state.resume);
	// Nothing to simulate without drones
	const hasDrones = useRobartState((state) => Object.keys(state.robots).length > 0);

	// Space: Run / Pause / Resume, like a video player. Not while typing, or on a focused button (Space presses it).
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== ' ' || event.repeat) return;
			if ((event.target as HTMLElement | null)?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
			event.preventDefault(); // Space would otherwise scroll the page
			const simulator = useSimulator.getState();
			if (simulator.status === 'RUNNING') simulator.pause();
			else if (simulator.status === 'PAUSED') simulator.resume();
			else if (Object.keys(useRobartState.getState().robots).length > 0) simulator.play();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, []);

	return (
		<>
			{simulationStatus === 'RUNNING' && <SimButton icon={faPause} onClick={pause} text="Pause" color="white" />}
			{simulationStatus === 'PAUSED' && <SimButton icon={faPlay} onClick={resume} text="Resume" color="green" />}
			{simulationStatus === 'STOPPED' && <SimButton icon={faPlay} onClick={play} text="Run" color="green" disabled={!hasDrones} />}
			{simulationStatus !== 'STOPPED' && <SimButton icon={faSquare} onClick={halt} text="Stop" color="red" />}
		</>
	);
};
