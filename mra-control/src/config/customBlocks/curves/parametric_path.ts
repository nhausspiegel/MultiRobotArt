import {type RobartBlockDefinition} from '../BlockDefinition';
import Blockly from 'blockly';
import {isValidExpression} from '@MRAControl/state/trajectories';

// Blockly keeps the previous value when a validator returns null
const expressionField = (value: string) => new Blockly.FieldTextInput(value, (text?: string) => (text !== undefined && isValidExpression(text) ? text : null));

// Expressions go into the generated code as string literals; JSON string syntax is valid in both JavaScript and Python
const fields = (block: Blockly.Block) => ({
	x: JSON.stringify(block.getFieldValue('x') as string),
	y: JSON.stringify(block.getFieldValue('y') as string),
	z: JSON.stringify(block.getFieldValue('z') as string),
	startT: block.getFieldValue('start_t') as number,
	endT: block.getFieldValue('end_t') as number,
	duration: block.getFieldValue('duration') as number,
});

export const blockParametricPath: RobartBlockDefinition = {
	name: 'parametricPath',
	block: {
		init: function () {
			this.appendDummyInput().appendField('Parametric path');
			// Defaults: a figure eight in the horizontal plane at the current height
			this.appendDummyInput().appendField('x(t) =').appendField(expressionField('sin(t)'), 'x');
			this.appendDummyInput().appendField('y(t) =').appendField(expressionField('sin(2 * t) / 2'), 'y');
			this.appendDummyInput().appendField('z(t) =').appendField(expressionField('0'), 'z');
			this.appendDummyInput()
				.appendField('t from')
				.appendField(new Blockly.FieldNumber(0), 'start_t')
				.appendField('to')
				.appendField(new Blockly.FieldNumber(6.28), 'end_t');
			this.appendDummyInput()
				.appendField('over')
				.appendField(new Blockly.FieldNumber(8, 0.1), 'duration')
				.appendField('seconds');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Fly the path (x(t), y(t), z(t)) in meters, shifted so it starts where each drone is. Expressions can use t, sin, cos, tan, sqrt, abs, exp, log, pow(a, b) and pi.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, _python) => {
		const {x, y, z, startT, endT, duration} = fields(block);
		return `parametric(groupState, ${x}, ${y}, ${z}, ${startT}, ${endT}, ${duration})\n`;
	},
	javascriptGenerator: (block, _js) => {
		const {x, y, z, startT, endT, duration} = fields(block);
		return `simulator.makeParametricTrajectory(groupState, ${x}, ${y}, ${z}, ${startT}, ${endT}, ${duration})\n`;
	},
};
