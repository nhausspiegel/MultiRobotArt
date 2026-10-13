
import type * as Blockly from 'blockly';

export type BlocklyGenerator = Pick<Blockly.CodeGenerator, 'statementToCode'>;

/**
 * A lightweight wrapping interface for defining custom blocks within Robart.
 */
export type RobartBlockDefinition = {
	/**
     * The name of the block to define.
     */
	name: string;
	/**
     * The actual Blockly block definition (ex. what is exported from the Blockly editor).
     */
	block: any | {
		init: () => void;
	}; 
	/**
     * Function to generate Python code for this block.
     * @param block The blockly block to generate code for.
     * @param python An instance of the Blockly Python generator.
     * @returns A string of Python code.
     */
	pythonGenerator: (block: Blockly.Block, python: BlocklyGenerator) => string;
	/**
     * Function to generate JavaScript code for this block.
     * @param block The blockly block to generate code for.
     * @param js An instance of the Blockly JavaScript generator.
     * @returns A string of JavaScript code.
     */
	javascriptGenerator: (block: Blockly.Block, js: BlocklyGenerator) => string;
};

// Whether generated code does nothing: blank, or only comments (Blockly writes a block's comment as a // or # line even
// when the block itself writes no code). A block, or a slot, holding only such code counts as empty.
export const writesNoCode = (code: string) => code.split('\n').every((line) => /^\s*(\/\/.*|#.*)?$/.test(line));
