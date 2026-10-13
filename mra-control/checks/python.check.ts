// The exported Python of the blocks added or changed since the fork, run against a fake drone (checks/fake_drones.py):
// what the drone is sent, in what order and when. Not what a real drone does with it.
// Run (from mra-control; needs python3 with numpy):
// npx esbuild checks/python.check.ts --bundle --platform=node --format=cjs --packages=external --alias:@MRAControl=./src \
//   --loader:.py=text --loader:.md=text --log-level=error --outfile=node_modules/.cache/checks/python.cjs && node node_modules/.cache/checks/python.cjs
import './browserShims';
import './documentShim';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import '@MRAControl/config/customBlocks';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {type Trajectory} from '@MRAControl/state/trajectories';
import {useSimulator} from '@MRAControl/state/useSimulator';

type BlockJson = {type: string; fields?: Record<string, number | string>; inputs?: Record<string, {block: BlockJson}>; next?: {block: BlockJson}; icons?: Record<string, unknown>};
type Sent = {t: number; command: string; pos?: number[]; duration?: number; height?: number; color?: number[]};

// Blocks one after another
const stack = (...blocks: BlockJson[]) => blocks.reduceRight((next, block) => ({...block, next: {block: next}}));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// A block's code: the exported Python and the simulator's line (a modifier writes one line)
type Code = {python: string; javaScript: string};
const codeOf = (block: BlockJson): Code => {
	const workspace = new Blockly.Workspace();
	Blockly.serialization.blocks.append(block, workspace);
	return {python: pythonGenerator.workspaceToCode(workspace), javaScript: javascriptGenerator.workspaceToCode(workspace).trim()};
};

// Python run on a fake drone starting at `start`
const flyCode = (python: string, start = [0, 0, 0]) => {
	// A hang (e.g. a loop that stops advancing the clock) fails the check instead of stalling it
	const output = execFileSync('python3', ['-I', 'checks/fake_drones.py', JSON.stringify(start)], {input: python, encoding: 'utf8', timeout: 30_000});
	// The last line: commands may print along the way
	return {code: python, ...(JSON.parse(output.trim().split('\n').pop()!) as {log: Sent[]; end: number})};
};
const fly = (block: BlockJson, start = [0, 0, 0]) => flyCode(codeOf(block).python, start);

// The simulator's code from the same start: its length, its position at any time, and its LED color changes
const simulateCode = (javaScript: string, start: number[]) => {
	useSimulator.getState().setRobots({drone: {id: 'drone', name: 'drone', type: 'crazyflie', startingPosition: start as [number, number, number]}});
	// Named like in the simulator, for the block code
	const simulator = SIM;
	const groupState = {robotIDs: ['drone']};
	const [duration, trajectories] = eval(javaScript) as [number, Map<string, Trajectory>];
	const trajectory = trajectories.get('drone')!;
	// Each change's time (rounded to the millisecond) and color, as the simulator applies them while playing
	const colors = new Map<string, number[]>();
	for (let t = 0; t <= duration + 1e-9; t += 0.01) {
		const change = trajectory.lastColor(Math.min(t / duration, 1));
		if (change) colors.set((change.t * duration).toFixed(3), [change.color.r, change.color.g, change.color.b]);
	}

	return {duration, at: (t: number) => trajectory.evaluate(Math.min(t / duration, 1)), colors, simulator, groupState};
};

// The firmware's go-to (and the simulator's robotGoTo): a degree 7 curve from rest to rest
const goToCurve = (from: number[], to: number[], u: number) => {
	const ease = u * u * u * u * (35 - (84 * u) + (70 * u * u) - (20 * u * u * u));
	return from.map((v, i) => v + ((to[i] - v) * ease));
};

// Where the drone was told to be at any time, from what it was sent: a go-to (takeoff, land) follows the go-to curve from
// where it was until the next command, and a streamed position holds until the next one
const toldPath = (log: Sent[], start: number[]) => {
	const segments: Array<{t: number; from: number[]; to: number[]; duration: number; streamed: boolean}> = [];
	const last = (t: number) => segments.filter((segment) => segment.t <= t + 1e-9).pop();
	const at = (t: number): number[] => {
		const segment = last(t);
		if (!segment) return start;
		if (segment.streamed) return segment.to;
		return goToCurve(segment.from, segment.to, segment.duration > 0 ? Math.min(1, (t - segment.t) / segment.duration) : 1);
	};

	for (const sent of log) {
		if (!['cmdPosition', 'goTo', 'takeoff', 'land'].includes(sent.command)) continue;
		const from = at(sent.t);
		const to = sent.command === 'cmdPosition' ? sent.pos!
			: sent.command !== 'goTo' ? [from[0], from[1], sent.height!]
				: sent.relative ? from.map((v, i) => v + sent.pos![i]) : sent.pos!;
		segments.push({t: sent.t, from, to, duration: sent.duration ?? 0, streamed: sent.command === 'cmdPosition'});
	}

	return {at, streamingAt: (t: number) => last(t)?.streamed === true};
};

// What the exported Python tells the drone is what the simulator shows, within `tolerance` m:
// - every streamed position is where the simulator has the drone when it's sent
// - every 1/20 s, while the drone isn't streaming (going to a point or holding one), it's told to be where the simulator
//   has it. (Between two streamed positions the drone is told the last one, so that's only compared when it's sent.)
// - the LED changes are the simulator's, at the same times
// - it takes as long as the simulator (within one 1/20 s step)
const sameAsSimulator = ({python, javaScript}: Code, start: number[], tolerance: number) => {
	const {log, end} = flyCode(python, start);
	const {duration, at, colors} = simulateCode(javaScript, start);
	const told = toldPath(log, start);
	const near = (position: number[], t: number, what: string) => {
		const expected = at(t);
		const off = Math.hypot(position[0] - expected.x, position[1] - expected.y, position[2] - expected.z);
		assert.ok(off < tolerance, `${python}${what} at ${t.toFixed(3)} s: ${position.map((v) => v.toFixed(3))}, simulator ${expected.toArray().map((v) => v.toFixed(3))}`);
	};

	const sentColors = new Map<string, number[]>();
	for (const sent of log) {
		if (sent.command === 'cmdPosition') near(sent.pos!, sent.t, 'streamed position');
		if (sent.command === 'setLEDColor') sentColors.set(sent.t.toFixed(3), sent.color!);
	}

	for (let t = 0; t <= Math.max(end, duration) + 1e-9; t += 0.05) {
		if (!told.streamingAt(t)) near(told.at(t), t, 'told position');
	}

	assert.deepEqual([...sentColors], [...colors], `${python}LED changes ${JSON.stringify([...sentColors])}, simulator ${JSON.stringify([...colors])}`);
	assert.ok(Math.abs(end - duration) <= 1 / 20 + 1e-6, `${python}took ${end} s, simulator ${duration} s`);
	return {log, end};
};
const sameBlockAsSimulator = (block: BlockJson, start: number[], tolerance: number) => sameAsSimulator(codeOf(block), start, tolerance);

const takeoff = {type: 'takeoff', fields: {height: 1, duration: 2}};
const land = {type: 'land', fields: {height: 0, duration: 2}};

// repeat 3 { takeoff, land }: takeoff and land in turn, each when the one before has finished
{
	const {code, log, end} = fly({type: 'repeat', fields: {times: 3}, inputs: {body: {block: stack(takeoff, land)}}});
	assert.deepEqual(log.map((sent) => [sent.command, sent.t]), [0, 2, 4, 6, 8, 10].map((t, i) => [i % 2 === 0 ? 'takeoff' : 'land', t]), code);
	assert.equal(end, 12, code);
}

// takeoff, hover 2, land: nothing is sent while hovering, and land comes 2 s after takeoff finishes
{
	const {code, log, end} = fly(stack(takeoff, {type: 'stop', fields: {duration: 2}}, land));
	assert.deepEqual(log.map((sent) => [sent.command, sent.t]), [['takeoff', 0], ['land', 4]], code);
	assert.equal(end, 6, code);
}

// translate (1, 0, 0) { go to (1, 0, 1) over 2 s } from (0, 0, 1): first to the shifted start, at 0.5 m/s, then to (2, 0, 1)
{
	const goTo = {type: 'go_to', fields: {x_pos: 1, y_pos: 0, z_pos: 1, duration: 2}};
	const {code, log, end} = fly({type: 'translateTrajectory', fields: {x: 1, y: 0, z: 0}, inputs: {originalTraj: {block: goTo}}}, [0, 0, 1]);
	assert.deepEqual(log.map((sent) => [sent.command, sent.t, sent.pos, sent.duration]), [['goTo', 0, [1, 0, 1], 2], ['goTo', 2, [2, 0, 1], 2]], code);
	assert.equal(end, 4, code);
}

// circle of radius 1 at 0.5 m/s for 360°, then land: positions every 1/20 s for 2π·1 / 0.5 s, around the start in the
// y-z plane (like the simulator), and land right after. The circle used to end without a line break, so a command
// after it was written on the same line.
{
	const circle = {type: 'circle', fields: {radius_m: 1, velocity: 0.5, angle_degrees: 360}};
	const {code, log, end} = fly(stack(circle, land), [0, 0, 1]);
	const positions = log.filter((sent) => sent.command === 'cmdPosition').map((sent) => sent.pos!);
	const duration = 2 * Math.PI / 0.5;
	assert.equal(positions.length, Math.ceil(duration * 20), code);
	assert.ok(positions.every(([x, y, z]) => x === 0 && close(Math.hypot(y + 1, z - 1), 1)), 'off the circle');
	// The far side, to within the 1/20 s steps
	assert.ok(Math.abs(Math.min(...positions.map(([, y]) => y)) + 2) < 1e-3, 'not a full circle');
	const last = log[log.length - 1];
	assert.equal(last.command, 'land', code);
	assert.ok(close(last.t, positions.length / 20), `land at ${last.t}`);
	assert.ok(close(end, last.t + 2), `${end}`);
}

// random LED color: one whole-number color from 0 to 255. It used to send the text "[object Object]" as a color.
{
	const {code, log} = fly({type: 'randomColor'});
	assert.equal(log.length, 1, code);
	assert.equal(log[0].command, 'setLEDColor', code);
	assert.ok(log[0].color!.every((value) => Number.isInteger(value) && value >= 0 && value <= 255), JSON.stringify(log[0]));
}

// parametric path (its default figure eight over 8 s) from (0, 0, 1): positions every 1/20 s starting where the drone
// is, then back to the high-level commander, holding the end. parametric_check.py checks the positions themselves.
{
	const {code, log, end} = fly({type: 'parametricPath'}, [0, 0, 1]);
	const positions = log.filter((sent) => sent.command === 'cmdPosition').map((sent) => sent.pos!);
	assert.deepEqual(positions[0], [0, 0, 1], code);
	assert.equal(positions.length, 8 * 20 + 1, code);
	assert.deepEqual(log.slice(-2).map((sent) => sent.command), ['notifySetpointsStop', 'goTo'], code);
	assert.ok(close(end, positions.length / 20), `${end}`);
}

// Add and subtract fly both slots at the same time, in the simulator's time and through its positions. They used to take
// twice as long on the drones and jump by the second slot's movement at the end; subtract crashed.
{
	const move = (x: number, y: number, z: number) => ({type: 'move_xyz', fields: {x, y, z, speed: 0.5}});
	const both = (type: string, first: BlockJson, second: BlockJson) => ({type, inputs: {firstTrajectory: {block: first}, secondTrajectory: {block: second}}});
	// Go-tos follow the same polynomial on both sides, so these match exactly
	// (The move block halves its speed, issue #10, so each of these moves takes 4 s on both sides)
	const added = sameBlockAsSimulator(both('addTrajectories', move(1, 0, 0), move(0, 1, 0)), [0, 0, 1], 1e-6);
	assert.equal(added.end, 4);
	assert.deepEqual(added.log.slice(-2).map((sent) => sent.command), ['notifySetpointsStop', 'goTo']);
	assert.deepEqual(added.log[added.log.length - 1].pos, [1, 1, 1]);
	const subtracted = sameBlockAsSimulator(both('subtractTrajectories', move(1, 0, 0), move(0, 1, 0)), [0, 0, 1], 1e-6);
	assert.deepEqual(subtracted.log[subtracted.log.length - 1].pos, [1, -1, 1]);
	// A 4 s move stretched over an 8 s one, the way the simulator stretches the shorter slot
	sameBlockAsSimulator(both('addTrajectories', move(1, 0, 0), move(0, 2, 0)), [0, 0, 1], 1e-6);
	// A circle streams its own 1/20 s steps, so it can be up to a step (2.5 cm at 0.5 m/s) apart
	sameBlockAsSimulator(both('addTrajectories', {type: 'circle', fields: {radius_m: 1, velocity: 0.5, angle_degrees: 360}}, move(0, 0, 2)), [0, 0, 1], 0.05);
}

// Modifiers run whatever is in their slot (#4): several blocks, repeats, hovers, LED changes, other modifiers. The exported
// Python must tell the drone exactly what the simulator shows. Before, stacked blocks or a repeat in a slot were a
// SyntaxError, an LED change crashed, a hover was skipped, negating a move crashed, stretching a move went the wrong
// way, and translate's move to the shifted start followed a different curve than the simulator's.
{
	const move = (x: number, y: number, z: number) => ({type: 'move_xyz', fields: {x, y, z, speed: 0.5}});
	const goTo = (x: number, y: number, z: number) => ({type: 'go_to', fields: {x_pos: x, y_pos: y, z_pos: z, duration: 2}});
	const hover = (duration: number) => ({type: 'stop', fields: {duration}});
	const led = (color: string) => ({type: 'color', fields: {color}});
	const slot = (...blocks: BlockJson[]) => ({originalTraj: {block: stack(...blocks)}});
	const translate = (x: number, y: number, z: number, ...blocks: BlockJson[]) => ({type: 'translateTrajectory', fields: {x, y, z}, inputs: slot(...blocks)});
	const rotate = (x: number, y: number, z: number, ...blocks: BlockJson[]) => ({type: 'rotateDegrees', fields: {x, y, z}, inputs: slot(...blocks)});
	const negate = (...blocks: BlockJson[]) => ({type: 'negate', inputs: slot(...blocks)});
	const stretch = (x: number, y: number, z: number, t: number, ...blocks: BlockJson[]) => ({type: 'stretch', fields: {x, y, z, t}, inputs: slot(...blocks)});
	const add = (first: BlockJson[], second: BlockJson[]) => ({type: 'addTrajectories', inputs: {firstTrajectory: {block: stack(...first)}, secondTrajectory: {block: stack(...second)}}});
	const from = [0, 0, 1];

	sameBlockAsSimulator(translate(1, 0, 0, goTo(1, 0, 1), goTo(1, 1, 1)), from, 1e-6);
	sameBlockAsSimulator(translate(1, 0, 0, goTo(1, 0, 1), hover(1), led('#ff0000'), goTo(1, 1, 1)), from, 1e-6);
	// All three angles, so the order they're applied in matters
	sameBlockAsSimulator(rotate(30, 45, 60, move(1, 0, 0)), from, 1e-6);
	sameBlockAsSimulator(negate(move(1, 0, 0)), from, 1e-6);
	sameBlockAsSimulator(negate(move(1, 0, 0), hover(1), move(0, 1, 0)), from, 1e-6);
	sameBlockAsSimulator(stretch(2, 1, 1, 2, move(1, 0, 0), led('#ff0000'), move(0, 1, 0)), from, 1e-6);
	sameBlockAsSimulator(translate(0, 1, 0, {type: 'repeat', fields: {times: 2}, inputs: {body: {block: move(1, 0, 0)}}}), from, 1e-6);
	sameBlockAsSimulator(rotate(0, 0, 90, translate(1, 0, 0, move(1, 0, 0))), from, 1e-6);
	// Takeoff and land are changed like everything else
	sameBlockAsSimulator(translate(1, 0, 0, takeoff, land), from, 1e-6);
	// A sequence in a slot: a circle that bobs up and down once. Circles stream 1/20 s steps (#7).
	sameBlockAsSimulator(add([move(0, 0, 1), move(0, 0, -1)], [{type: 'circle', fields: {radius_m: 1, velocity: 0.5, angle_degrees: 360}}]), from, 0.05);
	// Both slots change the color at the same moment: the second slot's color stays
	const clash = sameBlockAsSimulator(add([led('#ff0000'), move(1, 0, 0)], [led('#0000ff'), move(0, 1, 0)]), from, 1e-6);
	assert.deepEqual(clash.log.filter((sent) => sent.command === 'setLEDColor').map((sent) => sent.color), [[255, 0, 0], [0, 0, 255]]);
	// LED changes in add come at their own moment, not the next 1/20 s step (this one: 4.1 s stretched over 8 s, 7.805 s)
	sameBlockAsSimulator(add([move(1, 0, 0), led('#ff0000')], [move(0, 2, 0)]), from, 1e-6);
	sameBlockAsSimulator(add([led('#ff0000'), move(1, 0, 0)], [move(0, 1, 0), led('#0000ff')]), from, 1e-6);

	// Hovers (and LED changes, which hover) inside modifiers that change positions in place: the drone holds still
	sameBlockAsSimulator(stretch(2, 1, 1, 1, move(1, 0, 0), hover(1), move(0, 1, 0)), from, 1e-6);
	sameBlockAsSimulator(rotate(0, 0, 90, move(1, 0, 0), hover(1), move(0, 1, 0)), from, 1e-6);
	sameBlockAsSimulator(add([move(1, 0, 0), hover(4)], [move(0, 2, 0)]), from, 1e-6);
	sameBlockAsSimulator({type: 'subtractTrajectories', inputs: {firstTrajectory: {block: stack(move(1, 0, 0), hover(2))}, secondTrajectory: {block: stretch(1, 1, 1, 2, move(0, 1, 0))}}}, from, 1e-6);

	// An add inside another modifier: its loop runs on a stand-in clock, which once stopped advancing
	sameBlockAsSimulator(negate(add([move(1, 0, 0)], [move(0, 1, 0)])), from, 1e-6);
	// A slot whose blocks write no code (an empty repeat): the Python must still be valid
	sameBlockAsSimulator(negate({type: 'repeat', fields: {times: 2}, inputs: {}}, move(1, 0, 0)), from, 1e-6);
	const emptyBody = codeOf(negate({type: 'repeat', fields: {times: 2}, inputs: {}}));
	assert.equal(emptyBody.python.includes('pass'), true, emptyBody.python);
	flyCode(emptyBody.python, from);
	// A comment on a block in a slot: the simulator still runs the slot
	sameBlockAsSimulator(translate(1, 0, 0, {...move(1, 0, 0), icons: {comment: {text: 'a note', pinned: false, height: 80, width: 160}}} as BlockJson, move(0, 1, 0)), from, 1e-6);

	// Projects saved before this keep their old code (one command, as a lambda), which must still run the same way
	const old = (python: string, javaScript: string) => sameAsSimulator({python: `${python}\n`, javaScript}, from, 1e-6);
	old('negate(groupState, lambda groupState: goto_velocity_relative_position(groupState, 1,0,0,0.25))', 'simulator.negateTrajectory(groupState, simulator.moveSpeed(groupState, 1, 0, 0, 0.25))');
	old('translate(groupState, lambda groupState: goto_duration(groupState, 1,0,1,2), 1, 0, 0)', 'simulator.translateTrajectory(groupState, simulator.goToXyzDuration(groupState, 1, 0, 1, 2), 1, 0, 0)');
	old('rotate(groupState, lambda groupState: goto_velocity_relative_position(groupState, 1,0,0,0.25), 0, 0, 1.5707963267948966)', 'simulator.rotateTrajectory(groupState, simulator.moveSpeed(groupState, 1, 0, 0, 0.25), 0, 0, 1.5707963267948966)');
	old('stretchTrajectory(groupState, lambda groupState: goto_velocity_relative_position(groupState, 1,0,0,0.25), 2, 1, 1, 2)', 'simulator.stretchTrajectory(groupState, simulator.moveSpeed(groupState, 1, 0, 0, 0.25), 2, 1, 1, 2)');
	old('addTrajectories(groupState, lambda groupState: goto_velocity_relative_position(groupState, 1,0,0,0.25), lambda groupState: goto_velocity_relative_position(groupState, 0,1,0,0.25))', 'simulator.addTrajectories(groupState, simulator.moveSpeed(groupState, 1, 0, 0, 0.25), simulator.moveSpeed(groupState, 0, 1, 0, 0.25))');
	old('subtractTrajectories(groupState, lambda groupState: goto_velocity_relative_position(groupState, 1,0,0,0.25), lambda groupState: goto_velocity_relative_position(groupState, 0,1,0,0.25), False)', 'simulator.addTrajectories(groupState, simulator.moveSpeed(groupState, 1, 0, 0, 0.25), simulator.moveSpeed(groupState, 0, 1, 0, 0.25), false)');
}

console.log('python ok');
