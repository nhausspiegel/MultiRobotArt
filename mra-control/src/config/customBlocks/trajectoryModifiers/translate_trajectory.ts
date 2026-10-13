import {type RobartBlockDefinition} from '../BlockDefinition';
import {slotFunction, slotSequence} from './slots';
import * as Blockly from 'blockly';

export const blockTranslateTrajectory: RobartBlockDefinition = {
	name: 'translateTrajectory',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('translate trajectory by')
				.appendField('x: ')
				.appendField(new Blockly.FieldNumber(0), 'x')
				.appendField(' y: ')
				.appendField(new Blockly.FieldNumber(0), 'y')
				.appendField(' z: ')
				.appendField(new Blockly.FieldNumber(0), 'z');
			this.appendStatementInput('originalTraj')
				.appendField('trajectory:');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Shift the given trajectory by x, y, z meters. The drones first fly to the shifted start at 0.4 m/s.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;
		return `${slotFunction(block, python, 'originalTraj', '_body')}translate(groupState, _body, ${x}, ${y}, ${z})\n`;
	},
	javascriptGenerator: (block, js) => {
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;
		return `simulator.translateTrajectory(groupState, ${slotSequence(block, js, 'originalTraj')}, ${x}, ${y}, ${z})\n`;
	},
};
