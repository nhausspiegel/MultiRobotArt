import {IconButton} from '@MRAControl/components/buttons/IconButton';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {faPause, faPlay, faSquare} from '@fortawesome/free-solid-svg-icons';
import React, {useEffect} from 'react';

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
			{simulationStatus === 'RUNNING' && <IconButton icon={faPause} onClick={pause} text="Pause Sim" color="gray" />}
			{simulationStatus === 'PAUSED' && <IconButton icon={faPlay} onClick={resume} text="Resume Sim" color="success" />}
			{simulationStatus === 'STOPPED' && <IconButton icon={faPlay} onClick={play} text="Run Sim" color="success" disabled={!hasDrones} />}
			{simulationStatus !== 'STOPPED' && <IconButton icon={faSquare} onClick={halt} text="Stop Sim" color="failure" />}
		</>
	);
};
