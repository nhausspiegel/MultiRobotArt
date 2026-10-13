/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {type RobartBlockDefinition} from '../BlockDefinition';
import {slotFunction, slotSequence} from './slots';
import * as Blockly from 'blockly';
import * as SIM from '@MRAControl/state/simulatorCommands';
import {Simulation} from '@MRAControl/layout/simulation/Simulation';

export const blockAddTrajectories: RobartBlockDefinition = {
	name: 'addTrajectories',
	block: {
		init: function () {
			this.appendDummyInput()
				.appendField('add trajectory');
			this.appendStatementInput('firstTrajectory');
			this.appendDummyInput()
				.appendField('to trajectory')
				// The Scratch look draws a row holding just one label between two slots thinner than the top row. A second, blank
				// label keeps it as thick.
				.appendField(new Blockly.FieldLabel(''));
			this.appendStatementInput('secondTrajectory');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(90);
			this.setTooltip('Add two trajectories together. At every timestep, the output (relative change from initial position) of each trajectory is added together. When trajectories have different durations, this will run for the longer of the two durations.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, python) => {
		return `${slotFunction(block, python, 'firstTrajectory', '_first')}${slotFunction(block, python, 'secondTrajectory', '_second')}addTrajectories(groupState, _first, _second)\n`;
	},
	javascriptGenerator: (block, js) => {
		return `simulator.addTrajectories(groupState, ${slotSequence(block, js, 'firstTrajectory')}, ${slotSequence(block, js, 'secondTrajectory')})\n`;
	},
};