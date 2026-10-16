import {commandLines, type RobartBlockDefinition} from '../BlockDefinition';
import * as Blockly from 'blockly';

export const blockRepeat: RobartBlockDefinition = {
	name: 'repeat',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('repeat')
				// Whole numbers up to 1000: the simulator writes the commands out that many times
				.appendField(new Blockly.FieldNumber(10, 0, 1000, 1), 'times');
			this.appendStatementInput('body');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			// Scratch's Control color
			this.setColour('#FFAB19');
			this.setTooltip('Repeat commands a given number of times.');
			this.setHelpUrl('');
		},
	},
	// (An empty body writes no code at all: hasEmptySlot in ../index.ts)
	pythonGenerator: (block, python) => {
		const body = python.statementToCode(block, 'body');
		// Exported commands wait until they finish, so the loop runs them in turn like the simulator's copies
		return `for _ in range(${block.getFieldValue('times') as number}):\n${body}`;
	},
	javascriptGenerator: (block, js) => {
		// The simulator runs block code one line (one command) at a time, so the loop is written out instead
		return commandLines(js.statementToCode(block, 'body')).map((line) => `${line}\n`).join('').repeat(block.getFieldValue('times') as number);
	},
};
