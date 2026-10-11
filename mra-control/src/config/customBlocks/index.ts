import {pythonGenerator} from 'blockly/python';
import {javascriptGenerator as js} from 'blockly/javascript';
import {blockCircle} from './curves/circle';
import {blockCircleRadians} from './curves/circle';
import {blockStop} from './motion/stop';
import {blockGoTo} from './motion/go_to_duration';
import {blockGoToSpeed} from './motion/go_to';
import {blockLand} from './motion/land';
import {blockMoveXyz} from './motion/move_xyz';
import {blockMove} from './motion/move';
import {blockTakeoff} from './motion/takeoff';
import {blockGetPosition} from './utility/get_a_position';
import {blockColor, blockRandomColor} from './colors/color';
import {blockColorOff} from './colors/colorOff';
import * as Blockly from 'blockly';
import {multiTraj} from './trajectoryModifiers/multi_traj';
import {blockCircleArc} from './curves/circleArc';
import {blockNegate} from './trajectoryModifiers/negate_trajectory';
import {blockAddTrajectories} from './trajectoryModifiers/add_trajectories';
import {blockSubtractTrajectories} from './trajectoryModifiers/subtract_trajectories';
import {blockStretchTrajectories} from './trajectoryModifiers/stretch_trajectory';
import {blockRotateTrajectoryDegrees, blockRotateTrajectoryRadians} from './trajectoryModifiers/rotate_trajectory';
import {blockTranslateTrajectory} from './trajectoryModifiers/translate_trajectory';
import {blockParametricPath} from './curves/parametric_path';
import {blockRepeat} from './loops/repeat';

/**
 * This is where we collect all of the custom blocks and actually update Blockly definitions.
 */
export const CUSTOM_BLOCKS = {
	//  blockGoTo_xyz,
	blockGoToSpeed,
	blockGoTo,
	blockLand,
	blockMoveXyz,
	// blockMove,
	blockStop,
	blockTakeoff,
	blockCircle,
	blockCircleRadians,
	blockCircleArc,
	blockGetPosition,
	blockColor,
	blockColorOff,
	// multiTraj,
	blockNegate,
	blockAddTrajectories,
	blockSubtractTrajectories,
	blockStretchTrajectories,
	blockRotateTrajectoryDegrees,
	blockRotateTrajectoryRadians,
	blockTranslateTrajectory,
	blockParametricPath,
	blockRandomColor,
	blockRepeat,
};

// A command with an empty slot (a trajectory modifier or repeat with nothing inside) writes no code, so a block holding
// only that counts as empty. Its code used to be a call with a missing argument, which the simulator skipped as an error,
// yet the block looked filled, measured 0.1 s and could go on the timeline.
const hasEmptySlot = (b: Blockly.Block) => b.inputList.some((input) => input instanceof Blockly.inputs.StatementInput && !input.connection?.targetBlock());

Object.values(CUSTOM_BLOCKS).forEach((block) => {
	Blockly.Blocks[block.name] = block.block;
	pythonGenerator.forBlock[block.name] = (b: Blockly.Block) => (hasEmptySlot(b) ? '' : block.pythonGenerator(b, pythonGenerator));
	js.forBlock[block.name] = (b: Blockly.Block) => (hasEmptySlot(b) ? '' : block.javascriptGenerator(b, js));
});
