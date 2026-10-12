/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {type RobartBlockDefinition} from '../BlockDefinition';
import * as Blockly from 'blockly';
import * as SIM from '@MRAControl/state/simulatorCommands';

// Was "stop and hover"; keeps its name so saved projects still load
export const blockStop: RobartBlockDefinition = {
	name: 'stop',
	block:{
		init: function () {
			this.appendDummyInput()
				.appendField('hover for')
				.appendField(new Blockly.FieldNumber(1, 0), 'duration')
				.appendField('seconds');
			this.setPreviousStatement(true, null);
			this.setNextStatement(true, null);
			this.setColour(0);
			this.setTooltip('Hover in place for a given number of seconds.');
			this.setHelpUrl('');
		},
	},
	pythonGenerator: (block, _python) => {
		return `hover(groupState, ${block.getFieldValue('duration')})\n`;
	},
	javascriptGenerator: (block, _js) => {
		return `simulator.hover(groupState, ${block.getFieldValue('duration')})\n`;
	},
};