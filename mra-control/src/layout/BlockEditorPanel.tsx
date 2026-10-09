import {blocklyToolboxConfiguration} from '@MRAControl/config/BlockToolboxConfig';
import '@MRAControl/config/customBlocks';
import {useRobartState} from '@MRAControl/state/useRobartState';
import * as Blockly from 'blockly';
import defaultTheme from 'tailwindcss/defaultTheme';
import {inMultipleSelectionModeWeakMap, Multiselect} from '@mit-app-inventor/blockly-plugin-workspace-multiselect';
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

// In multi-select mode, a drag that starts on empty space draws the selection box. Blockly 13 drags whatever is selected
// when a drag starts, and the multi-select plugin keeps the selected blocks selected there, so they followed the pointer.
type GestureInternals = {targetBlock?: unknown; startBubble?: unknown; startComment?: unknown; startIcon?: unknown; startWorkspace_?: Blockly.WorkspaceSvg; calledUpdateIsDragging: boolean};
const gesturePrototype = Blockly.Gesture.prototype as unknown as GestureInternals & {updateIsDragging: (this: GestureInternals, e: PointerEvent) => void};
const updateIsDragging = gesturePrototype.updateIsDragging;
gesturePrototype.updateIsDragging = function (e) {
	const onEmptySpace = !this.targetBlock && !this.startBubble && !this.startComment && !this.startIcon;
	if (onEmptySpace && this.startWorkspace_ && inMultipleSelectionModeWeakMap.get(this.startWorkspace_)) {
		this.calledUpdateIsDragging = true;
		return;
	}
	updateIsDragging.call(this, e);
};

// Space plays/pauses the simulation (TimelineSimulationButtons). Blockly also uses it, besides Enter, to act on the
// focused block and finish a keyboard move; leave those to Enter.
for (const name of [Blockly.ShortcutItems.names.PERFORM_ACTION, Blockly.ShortcutItems.names.FINISH_MOVE]) {
	Blockly.ShortcutRegistry.registry.removeKeyMapping(String(Blockly.utils.KeyCodes.SPACE), name, true);
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
			renderer: 'geras', // Blockly 9's block look; Blockly 12+ defaults to the flatter 'thrasos'
			sounds: false, // Blockly 12+ plays a click when a block is dropped
		},
		onWorkspaceChange: (workspaceChanged) => {
			if (!loadedBlockId.current) return;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const python = pythonGenerator.workspaceToCode(workspaceChanged) as string;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const javaScript = javascriptGenerator.workspaceToCode(workspaceChanged) as string;
			// Read the layout from the workspace itself; the hook's xml copy updates 200 ms late, so saving it dropped the latest edit
			const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceChanged));
			// Blockly also reports selecting, scrolling and zooming; saving those anyway re-measured the whole show
			const saved = useRobartState.getState().blocks[loadedBlockId.current];
			if (saved?.xml === xml && saved.python === python && saved.javaScript === javaScript) return;
			saveBlock(loadedBlockId.current, {xml, python, javaScript});
		},
		ref: workspaceRef,
	});

	// Multi-select: Shift-click adds/removes blocks, Shift-drag on the background box-selects (workspace-multiselect plugin)
	useEffect(() => {
		if (!workspace) return;
		const multiselect = new Multiselect(workspace);
		multiselect.init({
			workspaceAutoFocus: false, // Its default focuses the editor whenever the pointer enters it, taking focus from text fields
			multiselectIcon: {hideIcon: true}, // Shift does the same; its default icons load from GitHub
			bumpNeighbours: true, // Keep Blockly's nudging of overlapping blocks (the plugin turns it off by default)
			multiselectCopyPaste: {crossTab: true, menu: false}, // Keyboard copy/paste only, no extra menu items
		});

		const isOn = () => inMultipleSelectionModeWeakMap.get(workspace) === true;

		// Box select only adds. The plugin toggled every block the box touched, so blocks already selected (the one clicked
		// before Shift, or ones from an earlier box) were deselected when the box passed over them. This reaches into the
		// plugin's DragSelect, which it creates each time multi-select turns on, and replaces its two handlers.
		const controls = multiselect.controls_;
		const enableMultiselect = controls.enableMultiselect.bind(controls);
		controls.enableMultiselect = (...args: unknown[]) => {
			enableMultiselect(...args);
			const dragSelect = controls.dragSelect_;
			if (!dragSelect) return;
			dragSelect.setSettings({multiSelectToggling: false});
			const addedByBox = new Set<string>();
			const blockOf = ({item}: {item: Element}) => workspace.getBlockById((item.parentElement as HTMLElement | null)?.dataset.id ?? '');
			// Both only while multi-select is on: turning it off (releasing Shift) clears the box's picks, which reports each as
			// unselected, and the selection must stay
			dragSelect.PubSub.subscribers.elementselect = [(event: {item: Element}) => {
				const block = blockOf(event);
				if (!isOn() || !block || controls.dragSelection.has(block.id)) return;
				addedByBox.add(block.id);
				controls.updateDraggables_(block);
			}];
			dragSelect.PubSub.subscribers.elementunselect = [(event: {item: Element}) => {
				const block = blockOf(event);
				// Only undoes what this box selected, when it shrinks away from the block
				if (isOn() && block && addedByBox.delete(block.id)) controls.updateDraggables_(block);
			}];
		};

		// Clicking empty space (without Shift) clears the multi-selection. The plugin clears it on Blockly's selection events,
		// which Blockly 13 doesn't fire for that click, so the blocks looked unselected but the next box added to them.
		const onWorkspaceClick = (event: Blockly.Events.Abstract) => {
			if (event.type !== Blockly.Events.CLICK || (event as Blockly.Events.Click).targetType !== 'workspace' || isOn()) return;
			controls.multiDraggable.clearAll_(); // Also unhighlights them
			controls.dragSelection.clear();
		};
		workspace.addChangeListener(onWorkspaceClick);

		// The plugin only hears Shift while the editor has keyboard focus, which it often doesn't (e.g. after clicking
		// the timeline). Pass Shift on from the whole page while the pointer is over the editor, without taking focus.
		const editor = workspace.getInjectionDiv();
		let pointerInside = false;
		const onPointerEnter = (event: PointerEvent) => {
			pointerInside = true;
			// Shift pressed before the pointer came in
			if (event.shiftKey && !isOn()) multiselect.controls_?.enableMultiselect();
		};
		const onPointerLeave = () => {
			pointerInside = false;
		};
		// Only switch when it changes: enabling twice leaks a box-select instance, and disabling when off clears the selection
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Shift' && pointerInside && !isOn()) multiselect.controls_?.enableMultiselect();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key === 'Shift' && isOn()) multiselect.controls_?.disableMultiselect();
		};
		editor.addEventListener('pointerenter', onPointerEnter);
		editor.addEventListener('pointerleave', onPointerLeave);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		return () => {
			editor.removeEventListener('pointerenter', onPointerEnter);
			editor.removeEventListener('pointerleave', onPointerLeave);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			workspace.removeChangeListener(onWorkspaceClick);
			multiselect.dispose();
		};
	}, [workspace]);

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
				var xmlDom = Blockly.utils.xml.textToDom(currentBlock.xml);
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
