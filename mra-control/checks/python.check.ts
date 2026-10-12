// The exported Python of the blocks added or changed since the fork, run against a fake drone (checks/fake_drones.py):
// what the drone is sent, in what order and when. Not what a real drone does with it.
// Run (from mra-control; needs python3 with numpy):
// npx esbuild checks/python.check.ts --bundle --platform=node --format=cjs --packages=external --alias:@MRAControl=./src \
//   --loader:.py=text --loader:.md=text --log-level=error --outfile=node_modules/.cache/checks/python.cjs && node node_modules/.cache/checks/python.cjs
import './browserShims';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import '@MRAControl/config/customBlocks';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {type Trajectory} from '@MRAControl/state/trajectories';
import {useSimulator} from '@MRAControl/state/useSimulator';

type BlockJson = {type: string; fields?: Record<string, number | string>; inputs?: Record<string, {block: BlockJson}>; next?: {block: BlockJson}};
type Sent = {t: number; command: string; pos?: number[]; duration?: number; height?: number; color?: number[]};

// Blocks one after another
const stack = (...blocks: BlockJson[]) => blocks.reduceRight((next, block) => ({...block, next: {block: next}}));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// The block's Python, run on a fake drone starting at `start`
const fly = (block: BlockJson, start = [0, 0, 0]) => {
	const workspace = new Blockly.Workspace();
	Blockly.serialization.blocks.append(block, workspace);
	const code = pythonGenerator.workspaceToCode(workspace);
	const output = execFileSync('python3', ['-I', 'checks/fake_drones.py', JSON.stringify(start)], {input: code, encoding: 'utf8'});
	// The last line: commands may print along the way
	return {code, ...(JSON.parse(output.trim().split('\n').pop()!) as {log: Sent[]; end: number})};
};

// The same block in the app's simulator, from the same start: its length and its position at any time
const simulate = (block: BlockJson, start: number[]) => {
	const workspace = new Blockly.Workspace();
	Blockly.serialization.blocks.append(block, workspace);
	const javaScript = javascriptGenerator.workspaceToCode(workspace).trim();
	useSimulator.getState().setRobots({drone: {id: 'drone', name: 'drone', type: 'crazyflie', startingPosition: start as [number, number, number]}});
	// Named like in the simulator, for the block code
	const simulator = SIM;
	const groupState = {robotIDs: ['drone']};
	const [duration, trajectories] = eval(javaScript) as [number, Map<string, Trajectory>];
	return {duration, at: (t: number) => trajectories.get('drone')!.evaluate(Math.min(t / duration, 1)), simulator, groupState};
};

// Every position the exported Python sends is where the simulator has the drone at that moment (within `tolerance` m),
// and the Python takes as long as the simulator (within one 1/20 s step)
const sameAsSimulator = (block: BlockJson, start: number[], tolerance: number) => {
	const {code, log, end} = fly(block, start);
	const {duration, at} = simulate(block, start);
	const positions = log.filter((sent) => sent.command === 'cmdPosition');
	assert.ok(positions.length > 0, code);
	for (const {t, pos} of positions) {
		const expected = at(t);
		const off = Math.hypot(pos![0] - expected.x, pos![1] - expected.y, pos![2] - expected.z);
		assert.ok(off < tolerance, `${code}at ${t} s: sent ${pos!.map((v) => v.toFixed(3))}, simulator ${expected.toArray().map((v) => v.toFixed(3))}`);
	}
	assert.ok(Math.abs(end - duration) <= 1 / 20 + 1e-6, `${code}took ${end} s, simulator ${duration} s`);
	return {log, end};
};

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
	const added = sameAsSimulator(both('addTrajectories', move(1, 0, 0), move(0, 1, 0)), [0, 0, 1], 1e-6);
	assert.equal(added.end, 4);
	assert.deepEqual(added.log.slice(-2).map((sent) => sent.command), ['notifySetpointsStop', 'goTo']);
	assert.deepEqual(added.log[added.log.length - 1].pos, [1, 1, 1]);
	const subtracted = sameAsSimulator(both('subtractTrajectories', move(1, 0, 0), move(0, 1, 0)), [0, 0, 1], 1e-6);
	assert.deepEqual(subtracted.log[subtracted.log.length - 1].pos, [1, -1, 1]);
	// A 4 s move stretched over an 8 s one, the way the simulator stretches the shorter slot
	sameAsSimulator(both('addTrajectories', move(1, 0, 0), move(0, 2, 0)), [0, 0, 1], 1e-6);
	// A circle streams its own 1/20 s steps, so it can be up to a step (2.5 cm at 0.5 m/s) apart
	sameAsSimulator(both('addTrajectories', {type: 'circle', fields: {radius_m: 1, velocity: 0.5, angle_degrees: 360}}, move(0, 0, 2)), [0, 0, 1], 0.05);
}

console.log('python ok');
