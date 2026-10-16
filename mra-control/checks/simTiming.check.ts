// Playback must end where measuring says, at any speed and frame size.
// Run (from mra-control): npx esbuild checks/simTiming.check.ts --bundle --platform=node --format=esm \
//   --alias:@MRAControl=./src --loader:.py=text --loader:.md=text --log-level=error --outfile=/tmp/simTiming.mjs && node /tmp/simTiming.mjs
import './browserShims';
import assert from 'node:assert/strict';
import {useRobartState} from '@MRAControl/state/useRobartState';
import {useSimulator} from '@MRAControl/state/useSimulator';

// One drone, ten 1 s moves
const robot = {id: 'r1', name: 'CF 1', type: 'crazyflie' as const, startingPosition: [0, 0, 1] as [number, number, number]};
const moves = [...Array(10)].map((_, i) => `simulator.goToXyzDuration(groupState, ${i % 2}, 0, 1, 1)`).join('\n');
useRobartState.setState({
	robots: {r1: robot},
	blocks: {b1: {id: 'b1', name: 'Moves', xml: '', python: '', javaScript: moves, duration: 10}},
	timelineState: {scale: 1, groups: {g1: {id: 'g1', name: 'G', robots: {r1: robot}, items: {i1: {id: 'i1', groupId: 'g1', blockId: 'b1', isTrajectory: false, startTime: 0, duration: 10}}, duration: 120}}},
} as never);

useSimulator.getState().measureShowLength();
const measured = useSimulator.getState().endTime;
assert.ok(Math.abs(measured - 10) < 0.05, `measured ${measured}`);

// Plays with frames of frameSeconds of real time at the given speed; returns when playback ended
const play = (frameSeconds: number, speed: number) => {
	useSimulator.setState({timeDilation: speed});
	useSimulator.getState().play();
	for (let frame = 0; frame < 10000 && useSimulator.getState().status === 'RUNNING'; frame++) {
		useSimulator.setState({lastStepTime: performance.now() - frameSeconds * 1000});
		useSimulator.getState().step();
	}
	return useSimulator.getState().time;
};
for (const [frameSeconds, speed] of [[1 / 60, 1], [1 / 120, 1], [1 / 60, 8], [5, 1]]) {
	const ended = play(frameSeconds, speed);
	// Within one 1/60 s step of the measured end
	assert.ok(Math.abs(ended - measured) <= 1 / 60 + 1e-6, `${speed}x, ${frameSeconds} s frames: ended at ${ended}, measured ${measured}`);
}
// A run of short commands takes exactly what they add up to, like the exported Python's waits: a command that ends
// partway through a step hands the rest of the step to the next one. Block comments (// lines) take no time.
const blockLength = (javaScript: string) => useSimulator.getState().measureBlockLength(javaScript);
const times = (line: string, count: number) => Array<string>(count).fill(line).join('\n');
const skipped: unknown[] = [];
const warn = console.warn;
console.warn = (...args) => skipped.push(args);
for (const [javaScript, expected] of [
	[times('simulator.hover(groupState, 0.1)', 10), 1],
	[times('simulator.hover(groupState, 0.25)', 10), 2.5],
	[times('simulator.setColor(groupState, 255, 0, 0)', 30), 3],
	[times('// a note\nsimulator.hover(groupState, 0.1)', 60), 6],
] as const) {
	const length = blockLength(javaScript);
	assert.ok(Math.abs(length - expected) < 1e-6, `${javaScript.split('\n')[0]}...: ${length}, not ${expected}`);
}
console.warn = warn;
assert.equal(skipped.length, 0, 'comment lines were run as commands');

// A block placed partway through a step starts there, not at the step's start
useRobartState.setState({
	blocks: {b1: {id: 'b1', name: 'Hover', xml: '', python: '', javaScript: 'simulator.hover(groupState, 1)', duration: 1}},
	timelineState: {scale: 1, groups: {g1: {id: 'g1', name: 'G', robots: {r1: robot}, items: {i1: {id: 'i1', groupId: 'g1', blockId: 'b1', isTrajectory: false, startTime: 1 / 3 + 0.001, duration: 1}}, duration: 120}}},
} as never);
useSimulator.getState().measureShowLength();
const item = useRobartState.getState().timelineState.groups.g1.items.i1;
assert.ok(Math.abs(item.duration - 1) < 1e-6, `item ${item.duration} s`);
console.log('sim timing ok');
