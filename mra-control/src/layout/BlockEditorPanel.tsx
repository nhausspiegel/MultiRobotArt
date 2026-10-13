import {blocklyToolboxConfiguration} from '@MRAControl/config/BlockToolboxConfig';
import '@MRAControl/config/customBlocks';
import {useRobartState} from '@MRAControl/state/useRobartState';
import * as Blockly from 'blockly';
import {ContinuousCategory, ContinuousFlyout, ContinuousToolbox, registerContinuousToolbox} from '@blockly/continuous-toolbox';
import defaultTheme from 'tailwindcss/defaultTheme';
import {inMultipleSelectionModeWeakMap, Multiselect} from '@mit-app-inventor/blockly-plugin-workspace-multiselect';
import {javascriptGenerator} from 'blockly/javascript';
import {pythonGenerator} from 'blockly/python';
import React, {useEffect, useRef} from 'react';
import {useBlocklyWorkspace} from 'react-blockly';

import {BlockEditorHeader} from './BlockEditorHeader';

const zoomScaleSpeed = 1.2;
// Scratch-style blocks (zelos) are big at full size; this makes them about the size the classic ones were
const blockScale = 0.8;

// Block text in the page's font (Tailwind's sans stack) instead of Blockly's plain sans-serif (Helvetica/Arial).
// Set through the theme so Blockly also measures text with it. Reused if already registered (module reloads).
const blocklyTheme = Blockly.registry.getObject(Blockly.registry.Type.THEME, 'robart', false)
	?? Blockly.Theme.defineTheme('robart', {
		name: 'robart',
		base: Blockly.Themes.Classic,
		fontStyle: {family: defaultTheme.fontFamily.sans.join(', ')},
		componentStyles: {workspaceBackgroundColour: '#f9f9f9', toolboxBackgroundColour: '#fff', flyoutBackgroundColour: '#fff', flyoutOpacity: 1},
	});

// Thinner than the default 15 px; read when the workspace is created. Colors are in index.css.
Blockly.Scrollbar.scrollbarThickness = 8;

// The block palette: every category in one scrolling list (continuous-toolbox plugin). Clicking a category opens it
// over the workspace, scrolled to that category; it closes once a block is dragged out, like Blockly's own palette.
registerContinuousToolbox();
class PopoverFlyout extends ContinuousFlyout {
	autoClose = true; // The plugin keeps it open beside the workspace, which leaves the workspace too narrow

	// By default it follows the workspace's zoom; keep it at the starting size instead
	getFlyoutScale() {
		return blockScale;
	}
}
class PopoverToolbox extends ContinuousToolbox {
	init() {
		super.init();
		this.getFlyout().hide(); // The plugin opens it at the start
	}

	updateFlyout_(oldItem: Blockly.ISelectableToolboxItem | null, newItem: Blockly.ISelectableToolboxItem | null) {
		const opening = newItem && !this.getFlyout().isVisible();
		super.updateFlyout_(oldItem, newItem);
		// The plugin scrolls to the category before opening the palette, while its sizes are stale; scroll again now it's open
		if (opening) this.getFlyout().scrollToCategory(newItem);
	}
}

// Toolbox categories as a column of colored circles with the name under each, like Scratch (styles in index.css)
class CircleCategory extends ContinuousCategory {
	createIconDom_() {
		const circle = document.createElement('div');
		circle.className = 'categoryCircle';
		circle.style.backgroundColor = this.colour_;
		return circle;
	}

	// The circle shows the color instead of a strip beside the name
	addColourBorder_() {}

	// Selected: a light background from the CSS, not the category's color
	setSelected(isSelected: boolean) {
		super.setSelected(isSelected);
		if (this.rowDiv_) this.rowDiv_.style.backgroundColor = '';
	}
}
Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Blockly.ToolboxCategory.registrationName, CircleCategory, true);

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
				colour: '#ddd',
				snap: true,
			},
			// Pinch (ctrl+wheel in Chrome/Firefox) and cmd+scroll zoom; plain scrolling pans. move.wheel is needed,
			// or every scroll would zoom.
			zoom: {wheel: true, pinch: true, minScale: 0.3, maxScale: 3, scaleSpeed: zoomScaleSpeed, startScale: blockScale},
			move: {wheel: true, drag: true, scrollbars: true},
			plugins: {toolbox: PopoverToolbox, flyoutsVerticalToolbox: PopoverFlyout},
			theme: blocklyTheme,
			renderer: 'zelos', // Scratch's block look
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

	// Multi-select (workspace-multiselect plugin): a drag on the background box-selects, Shift-drag on it pans, and Shift-click
	// adds or removes a block
	useEffect(() => {
		if (!workspace) return;
		const multiselect = new Multiselect(workspace);
		multiselect.init({
			workspaceAutoFocus: false, // Its default focuses the editor whenever the pointer enters it, taking focus from text fields
			multiselectIcon: {hideIcon: true}, // Its default icons load from GitHub
			// Its own key for multi-select mode, held down, would fight the presses that decide it below (and a held Shift
			// repeats on some systems, turning it back on mid-pan); a key name that no key has
			multiSelectKeys: ['(set per press)'],
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

		// Clicking empty space clears the multi-selection. The plugin clears it on Blockly's selection events,
		// which Blockly 13 doesn't fire for that click, so the blocks looked unselected but the next box added to them.
		const onWorkspaceClick = (event: Blockly.Events.Abstract) => {
			if (event.type !== Blockly.Events.CLICK || (event as Blockly.Events.Click).targetType !== 'workspace' || isOn()) return;
			controls.multiDraggable.clearAll_(); // Also unhighlights them
			controls.dragSelection.clear();
		};
		workspace.addChangeListener(onWorkspaceClick);

		// Each press in the editor decides whether multi-select is on, rather than holding a key:
		// - the background: a box, starting a new selection; with Shift, off, so Blockly pans
		// - a block with Shift: on, so a click adds or removes it and a drag moves the whole selection
		// - a block without Shift: off, Blockly's own selecting and dragging (a drag on a selected group moves all of it)
		// A press that turned it on turns it off afterwards, which keeps the selection. Not right away: Blockly reports the
		// click a frame and a timer later, and the plugin must still be in multi-select then.
		const svg = workspace.getParentSvg();
		let presses = 0;
		let turnedOn = false;
		const turnOn = () => {
			if (isOn()) return; // Enabling twice leaks a box-select instance
			controls.enableMultiselect();
			turnedOn = true;
		};
		const turnOff = () => {
			turnedOn = false;
			if (isOn()) controls.disableMultiselect(); // Disabling when off clears the selection
		};
		const onPointerDown = (event: PointerEvent) => {
			presses += 1;
			if (event.button !== 0 || !svg.contains(event.target as Node)) return;
			const target = event.target as Element;
			const onBackground = target.classList.contains('blocklyMainBackground');
			const onBlock = !onBackground && target.closest('.blocklyDraggable') !== null;
			if (onBackground && !event.shiftKey) {
				// A new box: the old selection goes (enabling would otherwise add the selected block to it)
				controls.multiDraggable.clearAll_();
				controls.dragSelection.clear();
				// Deselects the selected block, the way the plugin does (selection follows focus in Blockly 13)
				const focusTarget = workspace.getWorkspaceFocusTarget();
				if (focusTarget) Blockly.getFocusManager().focusNode(focusTarget);
				turnOn();
			} else if (onBlock && event.shiftKey) {
				turnOn();
			} else if (onBackground || onBlock) {
				turnOff();
			}
		};
		const onPointerUp = () => {
			if (!turnedOn) return;
			const press = presses;
			// After Blockly's events (requestAnimationFrame, then a timer), unless another press has started since
			requestAnimationFrame(() => setTimeout(() => {
				if (press === presses && turnedOn) turnOff();
			}, 0));
		};
		// Capturing: before Blockly and the plugin's box start handling the same press
		const editor = workspace.getInjectionDiv();
		editor.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		return () => {
			editor.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
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
