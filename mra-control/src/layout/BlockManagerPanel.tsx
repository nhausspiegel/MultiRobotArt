import {faCopy, faPlus, faTrash, type IconDefinition} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import clsx from 'clsx';
import React, {useState} from 'react';
import {ConfirmationModal} from '@MRAControl/components/modal/ConfirmationModal';
import {newBlockName} from './BlockEditorHeader';

import {blockColor, type CodeBlock, useRobartState} from '../state/useRobartState';

// Cmd/Ctrl+C in the block list: a snapshot, so pasting still works after the block is changed or deleted
let copiedBlock: CodeBlock | undefined;

const ToolbarButton = ({icon, title, danger, disabled, onClick}: {icon: IconDefinition; title: string; danger?: boolean; disabled?: boolean; onClick: () => void}) => (
	<button
		className={clsx(
			'flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm hover:bg-gray-50',
			'disabled:cursor-default disabled:border-gray-100 disabled:text-gray-300 disabled:hover:bg-white',
			danger ? 'text-red-600' : 'text-gray-700',
		)}
		title={title}
		disabled={disabled}
		onClick={onClick}
	>
		<FontAwesomeIcon icon={icon} />
	</button>
);

export const BlockManagerPanel = () => {
	const blocks = useRobartState((state) => Object.values(state.blocks));
	const removeBlock = useRobartState((state) => state.removeBlock);
	const createBlock = useRobartState((state) => state.createBlock);
	const copyBlock = useRobartState((state) => state.copyBlock);
	const selectedBlockId = useRobartState((state) => state.editingBlockId);
	const setEditingBlock = useRobartState((state) => state.setEditingBlock);
	const selectedBlock = useRobartState((state) => state.blocks[selectedBlockId ?? '']);
	const selectedBlockUses = useRobartState((state) => Object.values(state.timelineState.groups)
		.flatMap((group) => Object.values(group.items))
		.filter((item) => item.blockId === selectedBlockId).length);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

	const addCopy = (block: CodeBlock) => {
		setEditingBlock(copyBlock(block));
	};
	const deleteSelected = () => {
		if (selectedBlockId === undefined) return;
		// Nothing to lose when it's empty and not on the timeline, so no confirmation
		if (selectedBlock?.javaScript.trim() === '' && selectedBlockUses === 0) removeBlock(selectedBlockId);
		else setConfirmDeleteOpen(true);
	};

	return (
		<div
			className="flex h-full flex-col"
			// Copy, paste and delete blocks while something in the list has focus (e.g. after clicking a block)
			onKeyDown={(e) => {
				const key = e.key.toLowerCase();
				// Mac's delete key reports Backspace
				if ((key === 'delete' || key === 'backspace') && !e.metaKey && !e.ctrlKey && !e.altKey && selectedBlock) {
					deleteSelected();
				} else if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) {
					return;
				} else if (key === 'c' && selectedBlock) {
					copiedBlock = selectedBlock;
				} else if (key === 'v' && copiedBlock) {
					addCopy(copiedBlock);
				} else {
					return;
				}
				e.preventDefault();
				// Blockly listens on the whole page and would also copy, paste or delete its own selected blocks
				e.stopPropagation();
			}}
		>
			<div className="flex gap-1 border-b border-gray-100 p-2">
				<ToolbarButton
					icon={faPlus}
					title="New block"
					onClick={() => {
						setEditingBlock(createBlock(newBlockName()));
					}}
				/>
				<ToolbarButton
					icon={faCopy}
					title="Copy block"
					disabled={!selectedBlock}
					onClick={() => {
						if (selectedBlock) addCopy(selectedBlock);
					}}
				/>
				<ToolbarButton
					icon={faTrash}
					title="Delete block"
					danger
					disabled={!selectedBlock}
					onClick={deleteSelected}
				/>
			</div>
			<ConfirmationModal
				header="Delete block?"
				open={confirmDeleteOpen}
				onCancel={() => {
					setConfirmDeleteOpen(false);
				}}
				onConfirm={() => {
					if (selectedBlockId !== undefined) removeBlock(selectedBlockId);
					setConfirmDeleteOpen(false);
				}}
			>
				{/* Only when it's on the timeline; otherwise just the title */}
				{selectedBlockUses > 0 && <>
					&quot;{selectedBlock?.name}&quot; will also be removed from the timeline (used {selectedBlockUses} time{selectedBlockUses === 1 ? '' : 's'}).
				</>}
			</ConfirmationModal>
			{/* Scrolls when there are more blocks than fit; the buttons stay above it */}
			<div className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto p-2">
				{blocks.map((b) => {
					// Empty blocks can't go on the timeline, so they look unfilled
					const empty = b.javaScript.trim() === '';
					return (
						<div
							key={b.id}
							role="button"
							tabIndex={0}
							className={clsx(
								'flex max-w-full cursor-grab items-baseline gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm focus:outline-none',
								empty ? 'border-dashed border-gray-400 bg-white text-gray-400' : 'border-black/15',
								selectedBlockId === b.id && 'ring-2 ring-indigo-600 ring-offset-2',
							)}
							style={{backgroundColor: empty ? undefined : blockColor(b)}}
							draggable
							onDragStart={(e) => {
								e.dataTransfer.setData('text/plain', b.id);
								e.dataTransfer.effectAllowed = 'copy';
								// The timeline's drop preview reads the selected block (drag data is unreadable until drop)
								if (selectedBlockId !== b.id) setEditingBlock(b.id);
							}}
							onClick={() => {
								setEditingBlock(b.id);
							}}
						>
							<span className="truncate">{b.name}</span>
							{!empty && <span className="shrink-0 text-xs tabular-nums text-black/55">{b.duration.toFixed(1)} s</span>}
						</div>
					);
				})}
			</div>
		</div>
	);
};
