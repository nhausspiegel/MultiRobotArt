/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {type RobartBlockDefinition} from '../BlockDefinition';
import {slotFunction, slotSequence} from './slots';
import * as Blockly from 'blockly';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {Simulation} from '@MRAControl/layout/simulation/Simulation';

export const blockRotateTrajectoryDegrees: RobartBlockDefinition = {
	name: 'rotateDegrees',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('rotate trajectory by')
				.appendField('x: ')
				.appendField(new Blockly.FieldNumber(0), 'x')
				.appendField(' y: ')
				.appendField(new Blockly.FieldNumber(0), 'y')
				.appendField(' z: ')
				.appendField(new Blockly.FieldNumber(0), 'z')
				.appendField('degrees');
			this.appendStatementInput('originalTraj');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Rotate the given trajectory by the given Euler Angles.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		const x = block.getFieldValue('x') as number * Math.PI / 180;
		const y = block.getFieldValue('y') as number * Math.PI / 180;
		const z = block.getFieldValue('z') as number * Math.PI / 180;
		return `${slotFunction(block, python, 'originalTraj', '_body')}rotate(groupState, _body, ${x}, ${y}, ${z})\n`;
	},
	javascriptGenerator: (block, js) => {
		const x = block.getFieldValue('x') as number * Math.PI / 180;
		const y = block.getFieldValue('y') as number * Math.PI / 180;
		const z = block.getFieldValue('z') as number * Math.PI / 180;

		return `simulator.rotateTrajectory(groupState, ${slotSequence(block, js, 'originalTraj')}, ${x}, ${y}, ${z})\n`;
	},
};
export const blockRotateTrajectoryRadians: RobartBlockDefinition = {
	name: 'rotateRadians',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('rotate trajectory by')
				.appendField('x: ')
				.appendField(new Blockly.FieldNumber(0), 'x')
				.appendField(' y: ')
				.appendField(new Blockly.FieldNumber(0), 'y')
				.appendField(' z: ')
				.appendField(new Blockly.FieldNumber(0), 'z')
				.appendField('radians');
			this.appendStatementInput('originalTraj');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Rotate the given trajectory by the given Euler Angles.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;
		return `${slotFunction(block, python, 'originalTraj', '_body')}rotate(groupState, _body, ${x}, ${y}, ${z})\n`;
	},
	javascriptGenerator: (block, js) => {
		const x = block.getFieldValue('x') as number;
		const y = block.getFieldValue('y') as number;
		const z = block.getFieldValue('z') as number;

		return `simulator.rotateTrajectory(groupState, ${slotSequence(block, js, 'originalTraj')}, ${x}, ${y}, ${z})\n`;
	},
};