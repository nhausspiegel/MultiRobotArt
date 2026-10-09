import {IconButton} from '@MRAControl/components/buttons/IconButton';
import {faCopy, faPlusCircle, faTrash} from '@fortawesome/free-solid-svg-icons';
import {Button} from 'flowbite-react';
import React, {useState} from 'react';
import {ConfirmationModal} from '@MRAControl/components/modal/ConfirmationModal';
import {newBlockName} from './BlockEditorHeader';

import {useRobartState} from '../state/useRobartState';

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

	return (
		<div>
			<div className="flex flex-wrap gap-2 p-2">
				<IconButton
					icon={faPlusCircle}
					text="New"
					onClick={() => {
						const id = createBlock(newBlockName());
						setEditingBlock(id);
					}}
				/>
				<IconButton
					icon={faCopy}
					text="Copy"
					onClick={() => {
						if (selectedBlockId === undefined) return;
						const id = copyBlock(selectedBlockId);
						setEditingBlock(id);
					}}
				/>
				<IconButton
					color="failure"
					icon={faTrash}
					text="Delete"
					onClick={() => {
						if (selectedBlockId === undefined) return;
						setConfirmDeleteOpen(true);
					}}
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
				&quot;{selectedBlock?.name}&quot; will also be removed from the timeline
				{selectedBlockUses > 0 ? ` (used ${selectedBlockUses} time${selectedBlockUses === 1 ? '' : 's'})` : ''}. This can&apos;t be undone.
			</ConfirmationModal>
			<div className="flex flex-wrap gap-2 p-2">
				{blocks.map((b) => (
					<div
						key={b.id}
						className={`flex ${selectedBlockId === b.id ? 'border-4 border-cyan-500 rounded-lg' : ''}`}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData('text/plain', b.id);
							e.dataTransfer.effectAllowed = 'copy';
							// The timeline's drop preview reads the selected block (drag data is unreadable until drop)
							if (selectedBlockId !== b.id) setEditingBlock(b.id);
						}}
					>
						<Button 
							onClick={() => {
								setEditingBlock(b.id); 
							}} 
							color="success">
							{b.name}
						</Button>
					</div>
				))}
			</div>
		</div>
	);
};
