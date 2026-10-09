import { Modal } from 'flowbite-react';
import {CancelButton} from '../../components/buttons/CancelButton';
import {useRobartState} from '../../state/useRobartState';
import {useUIState} from '../../state/useUIState';
import { useState } from 'react';
import { IconButton } from '../buttons/IconButton';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';

export const RemoveGroupModal = () => {
	const RGModalOpen = useUIState((state) => state.RGModalOpen);
	const toggleRGModal = useUIState((state) => state.toggleRGModal);
	const groups = useRobartState((state) => state.timelineState.groups);
	const removeGroups = useRobartState((state) => state.removeGroups);
	const [groupsToRemove, setGroupsToRemove] = useState<string[]>([]);

	const close = () => {
		setGroupsToRemove([]);
		toggleRGModal();
	};

	return (
		<>
			<Modal show={RGModalOpen} onClose={close}>
				<Modal.Header>Remove Groups</Modal.Header>
				<Modal.Body>
					<div>
						{/* All CFs can't be removed: every new robot is added to it */}
						{Object.values(groups).filter((group) => group.id !== 'groupAllCFs').map((group) => (
							<div key={group.id}>
								<label>
									<input
										type="checkbox"
										checked={groupsToRemove.includes(group.id)}
										onChange={(event) => {
											setGroupsToRemove(event.target.checked
												? [...groupsToRemove, group.id]
												: groupsToRemove.filter((id) => id !== group.id));
										}}
									/>
									<span style={{ marginLeft: '10px' }}>{group.name}</span>
								</label>
							</div>
						))}
					</div>
				</Modal.Body>
				<Modal.Footer>
					<CancelButton onClick={close} />
					<IconButton color="warning" text="Remove" icon={faTrashCan} onClick={() => {
						removeGroups(groupsToRemove);
						close();
					}} />
				</Modal.Footer>
			</Modal>
		</>
	);
};
