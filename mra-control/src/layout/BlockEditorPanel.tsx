import {blocklyToolboxConfiguration} from '@MRAControl/config/BlockToolboxConfig';
import '@MRAControl/config/customBlocks';
import {useRobartState} from '@MRAControl/state/useRobartState';
import Blockly from 'blockly';
import defaultTheme from 'tailwindcss/defaultTheme';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import React, {useEffect, useRef} from 'react';
import {useBlocklyWorkspace} from 'react-blockly';

import {BlockEditorHeader} from './BlockEditorHeader';

const zoomScaleSpeed = 1.2;

// Block text in the page's font (Tailwind's sans stack) instead of Blockly's plain sans-serif (Helvetica/Arial).
// Set through the theme so Blockly also measures text with it. Reused if already registered (module reloads).
const blocklyTheme = Blockly.registry.getObject(Blockly.registry.Type.THEME, 'robart', false)
	?? Blockly.Theme.defineTheme('robart', {
		name: 'robart',
		base: Blockly.Themes.Classic,
		fontStyle: {family: defaultTheme.fontFamily.sans.join(', ')},
	});

// Thinner than the default 15 px; read when the workspace is created. Colors are in index.css.
Blockly.Scrollbar.scrollbarThickness = 8;

// The toolbox's block palette. By default it follows the workspace's zoom; keep it at normal size instead.
class FixedScaleFlyout extends Blockly.VerticalFlyout {
	getFlyoutScale() {
		return 1;
	}
}

export const BlockEditorPanel = () => {
	const currentBlockId = useRobartState((state) => state.editingBlockId);
	const saveBlock = useRobartState((state) => state.saveBlock);

	const workspaceRef = useRef<HTMLDivElement>(null);
	// The block loaded in the editor. A ref, not state: Blockly reports changes asynchronously,
	// and they must be saved to the block that is loaded at that moment.
	const loadedBlockId = useRef<string>();

	const {workspace} = useBlocklyWorkspace({
		toolboxConfiguration: blocklyToolboxConfiguration,
		// Non-empty so react-blockly's one-time initial import runs at once with nothing in it. With '' it waited for its
		// own debounced xml copy to fill and then imported it on top of the block we had already loaded (domToWorkspace
		// appends), duplicating the block's contents on every page load.
		initialXml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
		workspaceConfiguration: {
			grid: {
				spacing: 20,
				length: 3,
				colour: '#ccc',
				snap: true,
			},
			// Pinch (ctrl+wheel in Chrome/Firefox) and cmd+scroll zoom; plain scrolling pans. move.wheel is needed,
			// or every scroll would zoom.
			zoom: {wheel: true, pinch: true, minScale: 0.3, maxScale: 3, scaleSpeed: zoomScaleSpeed},
			move: {wheel: true, drag: true, scrollbars: true},
			plugins: {flyoutsVerticalToolbox: FixedScaleFlyout},
			theme: blocklyTheme,
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

	// Safari reports trackpad pinches as gesture events instead of ctrl+wheel, so Blockly's wheel zoom misses them
	useEffect(() => {
		const element = workspaceRef.current;
		if (!workspace || !element) return;
		let previousScale = 1;
		const onGestureStart = (event: Event) => {
			event.preventDefault(); // Otherwise Safari zooms the whole page
			previousScale = 1;
		};
		const onGestureChange = (event: Event) => {
			event.preventDefault();
			const {scale, clientX, clientY} = event as Event & {scale: number; clientX: number; clientY: number};
			const rect = element.getBoundingClientRect();
			// zoom() counts in steps of scaleSpeed
			workspace.zoom(clientX - rect.left, clientY - rect.top, Math.log(scale / previousScale) / Math.log(zoomScaleSpeed));
			previousScale = scale;
		};
		element.addEventListener('gesturestart', onGestureStart);
		element.addEventListener('gesturechange', onGestureChange);
		return () => {
			element.removeEventListener('gesturestart', onGestureStart);
			element.removeEventListener('gesturechange', onGestureChange);
		};
	}, [workspace]);

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
