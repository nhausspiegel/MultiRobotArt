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
console.log('sim timing ok');
