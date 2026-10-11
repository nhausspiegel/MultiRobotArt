import {type MRAState, useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';
import {faGear} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import clsx from 'clsx';
import React, {useEffect, useRef, useState} from 'react';

const speeds = [0.5, 1, 2, 4, 8];

export const formatTime = (seconds: number) => {
	const wholeSeconds = Math.floor(seconds);
	return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

// Where the last timeline item ends (s), 0 with none
export const lastItemEnd = (state: Pick<MRAState, 'timelineState'>) => Math.max(0, ...Object.values(state.timelineState.groups).flatMap((group) =>
	Object.values(group.items).map((item) => item.startTime + item.duration),
));

// How far the playhead can be scrubbed: the show's length as measured when it starts (exact), or before the first run
// the end of the last timeline item (an estimate). 0 with no blocks.
export const useShowLength = () => {
	const time = useSimulator((state) => state.time);
	const measuredEndTime = useSimulator((state) => state.endTime);
	const estimatedEndTime = useRobartState(lastItemEnd);
	// Keep the playhead in range if the sim runs slightly past the measured end (frame timing)
	return Math.max(measuredEndTime > 0 ? measuredEndTime : estimatedEndTime, time);
};

// A gear in the simulation view's upper left that opens the display options and the speed
export const SimulationSettings = () => {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const timeDilation = useSimulator((state) => state.timeDilation);
	const setTimeDilation = useSimulator((state) => state.setTimeDilation);
	const showPaths = useSimulator((state) => state.showPaths);
	const togglePaths = useSimulator((state) => state.togglePaths);
	const showCoordinates = useSimulator((state) => state.showCoordinates);
	const toggleCoordinates = useSimulator((state) => state.toggleCoordinates);
	const showWorkArea = useSimulator((state) => state.showWorkArea);
	const toggleWorkArea = useSimulator((state) => state.toggleWorkArea);

	// Clicking anywhere else, or Escape, closes it
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div ref={menuRef} className="absolute left-2 top-2 z-10">
			<button
				className={clsx('flex h-[30px] w-[30px] items-center justify-center rounded-md text-gray-200', open ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25')}
				title="Simulation settings"
				aria-expanded={open}
				onClick={() => {
					setOpen(!open);
				}}
			>
				<FontAwesomeIcon icon={faGear} />
			</button>
			{open && (
				<div className="mt-1.5 w-44 rounded-lg bg-white px-2.5 py-2 text-sm shadow-lg">
					<label className="flex items-center gap-2 py-0.5">
						<input type="checkbox" checked={showCoordinates} onChange={toggleCoordinates} />
						Coordinates
					</label>
					<label className="flex items-center gap-2 py-0.5">
						<input type="checkbox" checked={showPaths} onChange={togglePaths} />
						Paths
					</label>
					<label className="flex items-center gap-2 py-0.5">
						<input type="checkbox" checked={showWorkArea} onChange={toggleWorkArea} />
						Work area
					</label>
					<label className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2">
						Speed
						<select
							className="rounded border border-gray-300 bg-white py-0.5 pl-2 pr-8 text-sm"
							value={timeDilation}
							onChange={(e) => {
								setTimeDilation(Number(e.target.value));
							}}
						>
							{speeds.map((speed) => (
								<option key={speed} value={speed}>
									{speed}×
								</option>
							))}
						</select>
					</label>
				</div>
			)}
		</div>
	);
};

// Playhead time and show length in the simulation view's lower left, like a video player
export const SimulationTime = () => {
	const time = useSimulator((state) => state.time);
	const showLength = useShowLength();
	return (
		<div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums text-white">
			{formatTime(time)} / {formatTime(showLength)}
		</div>
	);
};
