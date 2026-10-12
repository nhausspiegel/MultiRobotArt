// The exported Python of the blocks added or changed since the fork, run against a fake drone (checks/fake_drones.py):
// what the drone is sent, in what order and when. Not what a real drone does with it.
// Run (from mra-control; needs python3 with numpy):
// npx esbuild checks/python.check.ts --bundle --platform=node --format=cjs --packages=external --alias:@MRAControl=./src \
//   --loader:.py=text --loader:.md=text --log-level=error --outfile=node_modules/.cache/checks/python.cjs && node node_modules/.cache/checks/python.cjs
import './browserShims';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as Blockly from 'blockly';
import {pythonGenerator} from 'blockly/python';
import '@MRAControl/config/customBlocks';

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
	return {code, ...(JSON.parse(output) as {log: Sent[]; end: number})};
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

console.log('python ok');
