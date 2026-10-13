/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {type RobartBlockDefinition} from '../BlockDefinition';
import {slotFunction, slotSequence} from './slots';
import * as Blockly from 'blockly';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {Simulation} from '@MRAControl/layout/simulation/Simulation';

export const blockSubtractTrajectories: RobartBlockDefinition = {
	name: 'subtractTrajectories',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('subtract trajectories');
			this.appendStatementInput('firstTrajectory')
				.appendField('first trajectory:');
			this.appendStatementInput('secondTrajectory')
				.appendField('second trajectory:');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Subtract two trajectories (see add).');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		return `${slotFunction(block, python, 'firstTrajectory', '_first')}${slotFunction(block, python, 'secondTrajectory', '_second')}subtractTrajectories(groupState, _first, _second)\n`;
	},
	javascriptGenerator: (block, js) => {
		return `simulator.addTrajectories(groupState, ${slotSequence(block, js, 'firstTrajectory')}, ${slotSequence(block, js, 'secondTrajectory')}, false)\n`;
	},
};