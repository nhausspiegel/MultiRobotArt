import {blocklyToolboxConfiguration} from '@MRAControl/config/BlockToolboxConfig';
import '@MRAControl/config/customBlocks';
import {useRobartState} from '@MRAControl/state/useRobartState';
import * as Blockly from 'blockly';
import {ContinuousCategory, ContinuousFlyout, ContinuousToolbox, registerContinuousToolbox} from '@blockly/continuous-toolbox';
import defaultTheme from 'tailwindcss/defaultTheme';
import {dragSelectionWeakMap, inMultipleSelectionModeWeakMap, Multiselect} from '@mit-app-inventor/blockly-plugin-workspace-multiselect';
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
type GestureInternals = {
	targetBlock?: Blockly.BlockSvg; startField?: Blockly.Field; startBubble?: unknown; startComment?: unknown; startIcon?: unknown;
	startWorkspace_?: Blockly.WorkspaceSvg; calledUpdateIsDragging: boolean; hasExceededDragRadius: boolean;
	// Set by setTargetBlock below: a press on a field that hasn't selected its block
	fieldPressUnselected?: boolean;
};
type GesturePrototype = GestureInternals & {
	updateIsDragging: (this: GestureInternals, e: PointerEvent) => void;
	setTargetBlock: (this: GestureInternals, block: Blockly.BlockSvg) => void;
	handleRightClick: (this: GestureInternals, e: PointerEvent) => void;
};
const gesturePrototype = Blockly.Gesture.prototype as unknown as GesturePrototype;

// Gives the block whose field was pressed the focus that setTargetBlock below held back, once the press turns out to be
// more than a click on the field. Not when the block is in a multi-selection: the plugin has focused the whole selection
// for this press, so that's what gets dragged or shows its menu.
const focusFieldBlock = (gesture: GestureInternals) => {
	const block = gesture.targetBlock;
	if (!gesture.fieldPressUnselected || !block) return;
	gesture.fieldPressUnselected = false;
	if (!dragSelectionWeakMap.get(block.workspace)?.has(block.id)) Blockly.getFocusManager().focusNode(block);
};

const updateIsDragging = gesturePrototype.updateIsDragging;
gesturePrototype.updateIsDragging = function (e) {
	const onEmptySpace = !this.targetBlock && !this.startBubble && !this.startComment && !this.startIcon;
	if (onEmptySpace && this.startWorkspace_ && inMultipleSelectionModeWeakMap.get(this.startWorkspace_)) {
		this.calledUpdateIsDragging = true;
		return;
	}

	// A drag that starts on a field drags its block, which Blockly 13 does by dragging the selection: select it now
	if (this.hasExceededDragRadius) focusFieldBlock(this);

	updateIsDragging.call(this, e);
};

// A click on a block's field (a number to type, a dropdown) doesn't select the block, like in Scratch. Blockly 13 selects
// whatever has focus: it focused the block on the press, then opening the field's editor moved focus to the field, so
// the block flickered selected and back.
const setTargetBlock = gesturePrototype.setTargetBlock;
gesturePrototype.setTargetBlock = function (block) {
	if (this.startField?.isClickable() && !block.isShadow()) {
		this.targetBlock = block;
		block.bringToFront();
		this.fieldPressUnselected = true;
		return;
	}

	setTargetBlock.call(this, block);
};

// A right-click (or a long press on a touch screen) shows the menu of whatever has focus, so on a field it showed the
// previously selected block's menu
const handleRightClick = gesturePrototype.handleRightClick;
gesturePrototype.handleRightClick = function (e) {
	focusFieldBlock(this);
	handleRightClick.call(this, e);
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
		// False while a press on the background hasn't moved yet: that's a click, not a box (see the box handlers below)
		let boxStarted = true;

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
				// The box touches blocks by their bounding boxes, which take in the gap inside a C-shaped block and corners
				// outside its outline, so a click there picked the block. Until the press moves it's a click: let the box drop
				// the block (unreported), and it finds it again once it's really drawn.
				if (!boxStarted) {
					dragSelect.removeSelection(event.item);
					return;
				}
				addedByBox.add(block.id);
				controls.updateDraggables_(block);
			}];
			dragSelect.PubSub.subscribers.elementunselect = [(event: {item: Element}) => {
				const block = blockOf(event);
				// Only undoes what this box selected, when it shrinks away from the block
				if (isOn() && block && addedByBox.delete(block.id)) controls.updateDraggables_(block);
			}];
		};

		// Each press in the editor decides whether multi-select is on, rather than holding a key:
		// - the background: a box, starting a new selection; with Shift, off, so Blockly pans
		// - a block with Shift: on, so a click adds or removes it and a drag moves the whole selection
		// - a block without Shift: off, Blockly's own selecting and dragging (a drag on a selected group moves all of it)
		// It's turned off again once each press is done with it, which keeps the selection: a box when it's released, a
		// click on the background when Blockly reports the click, a Shift-click on a block when Blockly reports the
		// selection change (after the plugin has handled it in multi-select), or on release if none comes.
		const svg = workspace.getParentSvg();
		const editor = workspace.getInjectionDiv();
		// Where a press on the background started, until it moves far enough to be a box: Blockly's own drag distance, so
		// it's a click to Blockly exactly when it isn't a box here
		let pressStart: {x: number; y: number} | undefined;
		let boxPress = false;
		let shiftBlockPress = false;
		// A Shift-press on a block that was already selected, and where: released there, it's a click that takes it out
		let shiftPressOnSelected: {id: string; x: number; y: number} | undefined;
		const turnOn = () => {
			if (!isOn()) controls.enableMultiselect(); // Enabling twice leaks a box-select instance
		};
		const turnOff = () => {
			if (isOn()) controls.disableMultiselect(); // Disabling when off clears the selection
		};
		const clearSelection = () => {
			controls.multiDraggable.clearAll_(); // Also unhighlights them
			controls.dragSelection.clear();
			// The plugin remembers the last block selected on its own, and adds it back when multi-select reports a selection
			// change: after a click away from one selected block, it flickered back before the click cleared it
			controls.lastSelectedElement_ = null;
			// Deselects a single selected block, the way the plugin does (selection follows focus in Blockly 13)
			const focusTarget = workspace.getWorkspaceFocusTarget();
			if (focusTarget) Blockly.getFocusManager().focusNode(focusTarget);
		};

		const onPointerDown = (event: PointerEvent) => {
			boxStarted = true;
			pressStart = undefined;
			boxPress = false;
			shiftBlockPress = false;
			shiftPressOnSelected = undefined;
			if (event.button !== 0 || !svg.contains(event.target as Node)) return;
			const target = event.target as Element;
			const onBackground = target.classList.contains('blocklyMainBackground');
			const onBlock = !onBackground && target.closest('.blocklyDraggable') !== null;
			if (onBackground && event.shiftKey) editor.classList.add('shiftPanning');
			if (onBackground && !event.shiftKey) {
				boxPress = true;
				boxStarted = false;
				pressStart = {x: event.clientX, y: event.clientY};
				// A new box: the old selection goes (enabling would otherwise add the selected block to it)
				clearSelection();
				turnOn();
			} else if (onBlock && event.shiftKey) {
				shiftBlockPress = true;
				turnOn(); // Also adds a block that was selected on its own
				const id = target.closest<SVGElement>('[data-id]')?.dataset.id;
				if (id && controls.dragSelection.has(id)) shiftPressOnSelected = {id, x: event.clientX, y: event.clientY};
			} else if (onBackground || onBlock) {
				turnOff();
			}
		};
		// Capturing, so the box handlers above see a press as started on the move that starts it
		const onPointerMove = (event: PointerEvent) => {
			if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > Blockly.config.dragRadius) {
				boxStarted = true;
				pressStart = undefined;
			}
		};
		// Capturing: Blockly stops a press's pointerup from going further once it has handled it
		const onPointerUp = (event: PointerEvent) => {
			editor.classList.remove('shiftPanning');
			editor.classList.toggle('shiftPan', event.shiftKey);
			pressStart = undefined;
			// A box is done (a click waits for Blockly's click, below)
			if (boxPress && boxStarted) turnOff();

			// A Shift-click on a block, once Blockly is done with it: takes the block out if it was already selected (the box
			// select only adds), and ends multi-select if Blockly reported no selection change (none comes for a block that
			// was already selected on its own)
			if (!shiftBlockPress && !shiftPressOnSelected) return;
			const press = shiftPressOnSelected;
			const takeOut = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= Blockly.config.dragRadius
				? workspace.getBlockById(press.id) : null;
			shiftBlockPress = false;
			shiftPressOnSelected = undefined;
			setTimeout(() => {
				if (takeOut && controls.dragSelection.has(takeOut.id)) {
					turnOn();
					controls.updateDraggables_(takeOut);
				}

				turnOff();
			}, 0);
		};
		const onWorkspaceEvent = (event: Blockly.Events.Abstract) => {
			// After the plugin's own listener has seen the selection change (it was added first); once the whole batch of
			// events is through
			if (event.type === Blockly.Events.SELECTED && shiftBlockPress) {
				shiftBlockPress = false;
				setTimeout(turnOff, 0);
				return;
			}

			// A click on the background clears the selection. (The plugin clears it on Blockly's selection events, which
			// Blockly 13 doesn't fire for that click.)
			if (event.type !== Blockly.Events.CLICK || (event as Blockly.Events.Click).targetType !== 'workspace') return;
			boxPress = false;
			turnOff();
			clearSelection();
		};
		workspace.addChangeListener(onWorkspaceEvent);

		// Shift pans the background: an open hand while it's held, a closed one while panning (index.css)
		const onShift = (event: KeyboardEvent | PointerEvent) => {
			if (!(event instanceof KeyboardEvent) || event.key === 'Shift') editor.classList.toggle('shiftPan', event.shiftKey);
		};
		const onWindowBlur = () => {
			editor.classList.remove('shiftPan', 'shiftPanning');
		};
		// Capturing: before Blockly and the plugin's box start handling the same press
		editor.addEventListener('pointerdown', onPointerDown, true);
		editor.addEventListener('pointermove', onShift);
		window.addEventListener('pointermove', onPointerMove, true);
		window.addEventListener('pointerup', onPointerUp, true);
		window.addEventListener('pointercancel', onPointerUp, true);
		window.addEventListener('keydown', onShift);
		window.addEventListener('keyup', onShift);
		window.addEventListener('blur', onWindowBlur);
		return () => {
			editor.removeEventListener('pointerdown', onPointerDown, true);
			editor.removeEventListener('pointermove', onShift);
			window.removeEventListener('pointermove', onPointerMove, true);
			window.removeEventListener('pointerup', onPointerUp, true);
			window.removeEventListener('pointercancel', onPointerUp, true);
			window.removeEventListener('keydown', onShift);
			window.removeEventListener('keyup', onShift);
			window.removeEventListener('blur', onWindowBlur);
			workspace.removeChangeListener(onWorkspaceEvent);
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
