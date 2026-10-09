import {type RobartBlockDefinition} from '../BlockDefinition';
import Blockly from 'blockly';

export const blockTranslateTrajectory: RobartBlockDefinition = {
	name: 'translateTrajectory',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('Translate Trajectory')
				.appendField('x: ')
				.appendField(new Blockly.FieldNumber(0), 'x')
				.appendField(' y: ')
				.appendField(new Blockly.FieldNumber(0), 'y')
				.appendField(' z: ')
				.appendField(new Blockly.FieldNumber(0), 'z');
			this.appendStatementInput('originalTraj')
				.appendField('Trajectory: ');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Shift the given trajectory by x, y, z meters. The drones first fly to the shifted start at 0.5 m/s.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		const originalTraj = python.statementToCode(block, 'originalTraj').trim();
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;
		return `translate(groupState, lambda groupState: ${originalTraj}, ${x}, ${y}, ${z})\n`;
	},
	javascriptGenerator: (block, js) => {
		const originalTraj = js.statementToCode(block, 'originalTraj').trim();
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;
		return `simulator.translateTrajectory(groupState, ${originalTraj}, ${x}, ${y}, ${z})\n`;
	},
};
