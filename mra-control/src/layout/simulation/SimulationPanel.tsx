import {Canvas} from '@react-three/fiber';

import {Simulation} from './Simulation';
import {SimulationControls} from './SimulationControls';
import {SimulationWarnings} from './SimulationWarnings';
import React from 'react';

export const SimulationPanel = () => {
	return (
		<div className="relative h-full w-full">
			{/* The screen's pixel ratio, between 1 and 2. A PerformanceMonitor used to lower it on frame drops; the busy
			    first seconds (model load, measuring the show) tripped it, and it rarely raised it back, leaving the view
			    pixelated. The scene is light enough for full resolution. */}
			<Canvas dpr={[1, 2]}>
				<Simulation />
			</Canvas>
			<SimulationWarnings />
			<SimulationControls />
		</div>
	);
};
