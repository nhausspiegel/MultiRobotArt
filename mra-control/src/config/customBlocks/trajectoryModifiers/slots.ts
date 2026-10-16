import type * as Blockly from 'blockly';
import {type BlocklyGenerator, commandLines} from '../BlockDefinition';

// A modifier's slot can hold any commands: several blocks, repeats, LED changes, hovers, other modifiers.

// For the simulator: the slot's commands as one expression on one line, since the simulator runs a block one line at a
// time. simulator.sequence runs them one after another; the modifier then changes them all together.
export const slotSequence = (block: Blockly.Block, js: BlocklyGenerator, input: string) => {
	// (Without comment lines, which would comment out the rest of the line)
	return `simulator.sequence(groupState, [${commandLines(js.statementToCode(block, input)).map((command) => `() => ${command}`).join(', ')}])`;
};

// For the exported Python: the slot's commands as a function, defined just before the modifier that runs it. Blockly
// indents the slot's code, which makes it the function's body. A modifier inside it defines its own, in its own scope.
// (A slot that writes no code makes the whole modifier write none: hasEmptySlot in ../index.ts.)
export const slotFunction = (block: Blockly.Block, python: BlocklyGenerator, input: string, name: string) =>
	`def ${name}(groupState):\n${python.statementToCode(block, input)}`;
