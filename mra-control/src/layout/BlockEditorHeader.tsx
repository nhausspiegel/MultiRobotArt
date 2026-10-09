import {RenamableText} from '@MRAControl/components/utils/RenamableText';

import {type CodeBlock, useRobartState} from '../state/useRobartState';
import React from 'react';

// First unused "New Block N"; a counter restarted on reload and repeated names already in the project
export const newBlockName = () => {
	const usedNames = new Set(Object.values(useRobartState.getState().blocks).map((block) => block.name));
	let i = 1;
	while (usedNames.has(`New Block ${i}`)) i += 1;
	return `New Block ${i}`;
};

export const BlockEditorHeader = () => {
	const currentBlockId = useRobartState((state) => state.editingBlockId);
	const currentBlock: CodeBlock | undefined = useRobartState((state) => state.blocks[currentBlockId ?? '']);
	const renameBlock = useRobartState((state) => state.renameBlock);

	if (!currentBlock) return <div className="h-full w-full text-3xl font-bold flex justify-center items-center">No timeline block selected</div>;

	return (
		<div className="m-2 flex items-center gap-2">
			<RenamableText
				text={currentBlock.name}
				className="text-lg font-bold"
				updateText={(newText: string) => {
					if (newText !== '') {
						renameBlock(newText);
					} else {
						renameBlock(newBlockName());
					}
				}}
			/>
		</div>
	);
};
