// The repeat block's code: written out for the simulator, a for loop in the exported Python, and N times as long.
// Run (from mra-control; installed packages stay outside the bundle, since Blockly's Node build can't be bundled):
// npx esbuild checks/repeat.check.ts --bundle --platform=node --format=cjs --packages=external --alias:@MRAControl=./src \
//   --loader:.py=text --loader:.md=text --log-level=error --outfile=node_modules/.cache/checks/repeat.cjs && node node_modules/.cache/checks/repeat.cjs
import './browserShims';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import '@MRAControl/config/customBlocks';
import {useSimulator} from '@MRAControl/state/useSimulator';

// repeat 3 { take off, land }
const workspace = new Blockly.Workspace();
const repeat = workspace.newBlock('repeat');
repeat.setFieldValue(3, 'times');
const takeoff = workspace.newBlock('takeoff');
const land = workspace.newBlock('land');
repeat.getInput('body')!.connection!.connect(takeoff.previousConnection!);
takeoff.nextConnection!.connect(land.previousConnection!);

const js = javascriptGenerator.workspaceToCode(workspace);
const lines = js.split('\n').filter((line) => line.trim() !== '');
assert.equal(lines.length, 6, js);
assert.ok(lines.every((line, i) => line.startsWith(i % 2 === 0 ? 'simulator.takeoff(' : 'simulator.land(')), js);

const python = pythonGenerator.workspaceToCode(workspace);
assert.match(python, /^for _ in range\(3\):\n {2}takeoff\(groupState, .*\)\n {2}land\(groupState, .*\)\n/, python);

// Three times as long as once through
const once = useSimulator.getState().measureBlockLength('simulator.takeoff(groupState, 1, 3)\nsimulator.land(groupState, 0, 3)\n');
const repeated = useSimulator.getState().measureBlockLength(js);
assert.ok(Math.abs(repeated - 3 * once) < 0.1, `${repeated} vs 3 x ${once}`);

// Empty, or zero times: no code, like an empty block
const emptyWorkspace = new Blockly.Workspace();
emptyWorkspace.newBlock('repeat');
assert.equal(javascriptGenerator.workspaceToCode(emptyWorkspace).trim(), '');
assert.equal(pythonGenerator.workspaceToCode(emptyWorkspace).trim(), '');
repeat.setFieldValue(0, 'times');
assert.equal(javascriptGenerator.workspaceToCode(workspace).trim(), '');

console.log('repeat ok');
