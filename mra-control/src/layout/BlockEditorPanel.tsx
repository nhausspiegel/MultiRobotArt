import {blocklyToolboxConfiguration} from '@MRAControl/config/BlockToolboxConfig';
import '@MRAControl/config/customBlocks';
import {useRobartState} from '@MRAControl/state/useRobartState';
import Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import React, {useEffect, useRef} from 'react';
import {useBlocklyWorkspace} from 'react-blockly';

import {BlockEditorHeader} from './BlockEditorHeader';

export const BlockEditorPanel = () => {
	const currentBlockId = useRobartState((state) => state.editingBlockId);
	const saveBlock = useRobartState((state) => state.saveBlock);

	const workspaceRef = useRef<HTMLDivElement>(null);
	// The block loaded in the editor. A ref, not state: Blockly reports changes asynchronously,
	// and they must be saved to the block that is loaded at that moment.
	const loadedBlockId = useRef<string>();

	const {workspace} = useBlocklyWorkspace({
		toolboxConfiguration: blocklyToolboxConfiguration,
		initialXml: '',
		workspaceConfiguration: {
			grid: {
				spacing: 20,
				length: 3,
				colour: '#ccc',
				snap: true,
			},
		},
		onWorkspaceChange: (workspaceChanged) => {
			if (!loadedBlockId.current) return;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const python = pythonGenerator.workspaceToCode(workspaceChanged) as string;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const javaScript = javascriptGenerator.workspaceToCode(workspaceChanged) as string;
			// Read the layout from the workspace itself; the hook's xml copy updates 200 ms late, so saving it dropped the latest edit
			const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceChanged));
			saveBlock(loadedBlockId.current, {xml, python, javaScript});
		},
		ref: workspaceRef,
	});

	useEffect(() => {
		window.dispatchEvent(new Event('resize'));
		if (!workspace) return;

		loadedBlockId.current = currentBlockId;
		if (currentBlockId) {
			workspace.setVisible(true);
			const currentBlock = useRobartState.getState().blocks[currentBlockId];
			if (currentBlock.xml) {
				var xmlDom = Blockly.Xml.textToDom(currentBlock.xml);
				Blockly.Xml.clearWorkspaceAndLoadFromXml(xmlDom, workspace);
			} else if (!currentBlock.xml) {
				workspace.clear();
			}
		} else {
			workspace.setVisible(false);
			workspace.clear();
		}
		// workspace too: it is created after the first render, and the selected block must load once it exists (e.g. after a reload)
	}, [currentBlockId, workspace]);

	return (
		<div className="flex h-full w-full flex-col">
			<BlockEditorHeader />
			<div ref={workspaceRef} className="w-full flex-grow"></div>
		</div>
	);
};
