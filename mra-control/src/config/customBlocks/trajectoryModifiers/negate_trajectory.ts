/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {type RobartBlockDefinition} from '../BlockDefinition';
import {slotFunction, slotSequence} from './slots';
import * as Blockly from 'blockly';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {Simulation} from '@MRAControl/layout/simulation/Simulation';

export const blockNegate: RobartBlockDefinition = {
	name: 'negate',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('negate trajectory');
			this.appendStatementInput('originalTraj');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Do the opposite (relative to current position) of the given trajectory.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		return `${slotFunction(block, python, 'originalTraj', '_body')}negate(groupState, _body)\n`;
	},
	javascriptGenerator: (block, js) => {
		return `simulator.negateTrajectory(groupState, ${slotSequence(block, js, 'originalTraj')})\n`;
	},
};