/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-dynamic-delete */
import uuid from 'react-uuid';
import {create} from 'zustand';
import {createJSONStorage, persist, subscribeWithSelector} from 'zustand/middleware';
import {immer} from 'zustand/middleware/immer';

import {ROBART_VERSION} from '../config/Version';
import {exportROS, loadProjectFromFile, saveProjectToFile} from '../tools/projectFileConversion';
import {useSimulator} from './useSimulator';
import {allDronesGroupId, migrateGroups, newGroup, withoutHiddenGroups} from './groupMigration';

export type CodeBlock = {
	/**
   * Code Block uuid
   */
	id: string;
	/**
   * The XML code that blockly uses to define the state of the code block.
   */
	xml: string;
	/**
   * The actual python code that a given block corresponds to.
   */
	python: string;
	/**
   * The JavaScript code that we can execute in the browser to simulate the action in browser simulation.
   */
	javaScript: string;
	/**
   * The user-defined name of the block.
   */
	name: string;
	/**
   * The user-defined duration of a block (in seconds).
   */
	duration: number;
	/**
   * Shown in the block list and on the timeline. Unset in older projects (blockColor picks one from the id).
   */
	color?: string;

	// block exec function
};

// No blues: blocks sit on blue timeline lanes
export const blockColors = ['#fbbf24', '#34d399', '#fb7185', '#a78bfa', '#fb923c', '#a3e635', '#f472b6', '#2dd4bf'];

export const blockColor = (block: Pick<CodeBlock, 'id' | 'color'>) =>
	block.color ?? blockColors[[...block.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % blockColors.length];

// The first color no block has yet, cycling once all are used
const nextBlockColor = (blocks: Record<string, CodeBlock>) => {
	const used = Object.values(blocks).map(blockColor);
	return blockColors.find((color) => !used.includes(color)) ?? blockColors[Object.keys(blocks).length % blockColors.length];
};

export type TimelineItem = {
	id: string;
	groupId: string;
	blockId: string;
	isTrajectory: boolean;
	/**
   * Start time of the block, in seconds from the start of the program.
   */
	startTime: number;
	duration: number;
};

export type TimelineGroupState = {
	id: string;
	name: string;
	items: Record<string, TimelineItem>;
	/**
   * Robots in this group. A robot is in at most one group besides All drones, which holds every robot.
   */
	robots: Record<string, RobotState>;
	// Length of time line in milliseconds
	duration: number;
	/**
   * Shown on the lane label and under its robots in the 3D view. Unset for All drones.
   */
	color?: string;
	/**
   * Lane shown as a thin strip to save space. Display only; it still runs.
   */
	collapsed?: boolean;
	/**
   * Its robots are left out of the simulation and the export (the eye on its label). Unset for All drones.
   */
	hidden?: boolean;
};

export type TimelineState = {
	groups: Record<string, TimelineGroupState>;
	scale: number;
};

export type RobotType = 'crazyflie';

export type RobotState = {
	id: string;
	name: string;
	startingPosition: [number, number, number];
	type: RobotType;
};

export type MRAState = {
	/**
   * Store of blocks created by the user.
   */
	blocks: Record<string, CodeBlock>;
	projectName: string;
	timelineState: TimelineState;
	editingBlockId: string | undefined;
	version: number;
	robots: Record<string, RobotState>;
	warnings: string[];
	/**
   * Notes from loading the project (e.g. robots moved out of extra groups), shown in the Warnings tab.
   */
	notices?: string[];
	/**
   * Full x, y, z size (m) of the box around each robot, centered on it. Overlapping boxes count as a collision.
   * Set in Settings. Older project files don't have it; loading fills in defaultBoundingBoxSize.
   */
	boundingBoxSize: [number, number, number];
	/**
   * Speed limit and work area that measuring the show warns about. Set in Settings. Older project files don't have it;
   * loading fills in defaultLimits.
   */
	limits: Limits;
};

// A project as saved, which may predate the box size and limits
export type ProjectFile = Omit<MRAState, 'boundingBoxSize' | 'limits'> & Partial<Pick<MRAState, 'boundingBoxSize' | 'limits'>>;

export const defaultBoundingBoxSize: [number, number, number] = [0.4, 0.4, 0.7];

export type Limits = {
	speedLimitOn: boolean;
	/** m/s */
	speedLimit: number;
	workAreaOn: boolean;
	/** Corners of the work area box (m): lowest x, y, z and highest x, y, z */
	workAreaMin: [number, number, number];
	workAreaMax: [number, number, number];
};

export const defaultLimits: Limits = {
	speedLimitOn: true,
	speedLimit: 1,
	workAreaOn: true,
	workAreaMin: [-4, -2.5, 0],
	workAreaMax: [2, 2.5, 2.5],
};

export type TimelineActions = {
	/**
   * Adds a block to timeline and returns its unique ID.
   * @param groupId The id of the group to add the block to
   * @param blockId The id of the block to add to the timeline group
   * @param startTime The start time of the block's execution
   */
	addBlockToTimeline: (groupId: string, blockId: string, startTime: number, isTrajectory: boolean) => void;
	removeTimelineItem: (groupId: string, itemId: string) => void;

	/**
   * Moves a robot into a group, out of its old one (All drones always keeps it). Every robot is in exactly one group.
   */
	setRobotGroup: (robotId: string, groupId: string) => void;
	updateBlockInTimeline: (groupId: string, itemId: string, startTime: number) => void;
	/**
   * Moves a timeline item to another lane, at a new start time.
   */
	moveTimelineItem: (fromGroupId: string, itemId: string, toGroupId: string, startTime: number) => void;
	/**
   * Sets the timeline zoom (pixels per second multiplier). Visual only.
   */
	setTimelineScale: (scale: number) => void;
	setBoundingBoxSize: (size: [number, number, number]) => void;
	setLimits: (limits: Partial<Limits>) => void;
	/**
   * Collapses every lane, or expands them all (the toggle beside + New group)
   */
	setAllGroupsCollapsed: (collapsed: boolean) => void;
	setGroupsHidden: (groupIds: string[], hidden: boolean) => void;
	/**
   * Stores lengths measured by simulating: how long timeline items take in the show, and how long each block takes
   * on its own (used for the drop preview and the initial length of new timeline items).
   * @param durations Duration in seconds by timeline item id.
   * @param blockLengths Duration in seconds by block id.
   */
	setMeasuredDurations: (durations: Record<string, number>, blockLengths: Record<string, number>) => void;
};

export type BlockActions = {
	/**
   * Saves changes to a given block. Assumes that the block is already present.
   * @param blockId The Id of the block that we want to save.
   * @param block A partial containing the fields of the block that we want to update.
   */
	saveBlock: (blockId: string, block: Partial<CodeBlock>) => void;
	/**
   * Removes a block
   * @param blockId the id of the block to remove
   */
	removeBlock: (blockId: string) => void;
	/**
   * Renames the current editing block to have the current name.
   * @param name The name that you want to rename the block to.
   */
	renameBlock: (name: string) => void;
	/**
   * Creates a new block, and returns its ID.
   * @param blockName The name of the block to create.
   * @returns The ID of the newly created block.
   */
	createBlock: (blockName: string) => string;
	/**
   * Adds a copy of a block, and returns the new ID.
   * @param block the block to copy; a snapshot works too (pasting a block that was copied, then changed or deleted).
   * @returns The ID of the newly created block.
   */
	copyBlock: (block: CodeBlock) => string;
	/**
   * Sets the currently selected block.
   * @param blockId The ID of the block to select in the block editor for editing.
   */
	setEditingBlock: (blockId: string | undefined) => void;
};

export type RobotActions = {
	/**
   * Creates a robot in the given group, at the first free spot with the first unused name.
   * @returns The new robot's id.
   */
	createRobot: (groupId: string) => string;
	saveRobot: (id: string, robot: Partial<RobotState>) => void;
	deleteRobot: (id: string) => void;
};

export type MRAGeneralActions = {
	loadProject: (fileContents: string) => void;
	saveProject: (fileName?: string) => void;
	resetProject: () => void;
	setProjectName: (projectName: string) => void;
	exportToROS: (filename: string) => void;
	/**
   * @returns The new group's id.
   */
	addGroup: (groupName: string) => string;
	renameGroup: (groupId: string, groupName: string) => void;
	/**
   * Removes a group with its blocks and its robots.
   */
	removeGroup: (groupId: string) => void;
};

// New projects start with one group holding one drone
const firstDrone: RobotState = {id: uuid(), name: 'CF 1', type: 'crazyflie', startingPosition: [0, 0, 0]};
const firstGroup: TimelineGroupState = {...newGroup('Group 1', {}), robots: {[firstDrone.id]: firstDrone}};

const defaultRobartState: MRAState = {
	blocks: {},
	projectName: 'New Robart Project',
	timelineState: {
		scale: 1,
		groups: {
			[allDronesGroupId]: {
				id: allDronesGroupId,
				name: 'All drones',
				items: {},
				robots: {[firstDrone.id]: firstDrone},
				duration: 120,
			},
			[firstGroup.id]: firstGroup,
		},
	},
	editingBlockId: undefined,
	version: ROBART_VERSION,
	robots: {[firstDrone.id]: firstDrone},
	warnings: [],
	notices: [],
	boundingBoxSize: defaultBoundingBoxSize,
	limits: defaultLimits,
};

type MRAActions = MRAGeneralActions & TimelineActions & BlockActions & RobotActions;

type MRACompleteState = MRAState & MRAActions;

function* startingPositionGenerator(): Generator<[number, number, number]> {
	// Fill in 0.5m grid with crazyflies by default (can be overridden by user obviously)
	let i = 0;
	let x = 0, y = 0;
	while (true) {
		yield [x, y, 0];
		if (i % 2 == 1) {
			x += 0.5;
		} else {
			y += 0.5;
		}

		i += 1;
	}
}

export const useRobartState = create<MRAState & MRAActions>()(
	immer(
		subscribeWithSelector(
			persist(
				(set, get): MRACompleteState => ({
					...defaultRobartState,
					loadProject: (file) => {
						// Older project files can have robots in several groups
						const newState = migrateGroups(loadProjectFromFile(file));
						// Older files have no box size or limits; don't keep the previous project's
						set({...newState, boundingBoxSize: newState.boundingBoxSize ?? defaultBoundingBoxSize, limits: newState.limits ?? defaultLimits});
						useSimulator.getState().reset();
					},
					saveProject: (fileName: string | undefined) => {
						const state: MRAState = {
							blocks: get().blocks,
							editingBlockId: undefined,
							projectName: get().projectName,
							timelineState: get().timelineState,
							version: ROBART_VERSION,
							robots: get().robots,
							warnings: get().warnings,
							boundingBoxSize: get().boundingBoxSize,
							limits: get().limits,
						};
						saveProjectToFile(state, fileName);
					},
					exportToROS: (fileName: string) => {
						const state: MRAState = {
							blocks: get().blocks,
							editingBlockId: undefined,
							projectName: get().projectName,
							timelineState: get().timelineState,
							version: ROBART_VERSION,
							robots: get().robots,
							warnings: get().warnings,
							boundingBoxSize: get().boundingBoxSize,
							limits: get().limits,
						};
						exportROS(withoutHiddenGroups(state), fileName);
					},
					resetProject: () => {
						set(defaultRobartState);
						useSimulator.getState().reset();
					},
					setProjectName: (name) => {
						set({projectName: name}); 
					},
					addBlockToTimeline: (groupId: string, blockId: string, startTime: number, isTrajectory: boolean) => {
						// The block's last measured length; the timeline re-measures by simulating shortly after (setMeasuredDurations)
						const duration = get().blocks[blockId].duration;
						const newItem = {
							id: uuid(),
							groupId,
							blockId,
							startTime,
							isTrajectory,
							duration,
						};
            
						const oldItems = {...get().timelineState.groups[groupId].items};
						oldItems[newItem.id] = newItem;

						set((state) => {
							state.timelineState.groups[groupId].items = oldItems;
						});
					},
					updateBlockInTimeline: (groupId, itemId, startTime) => {
						const newItem = {
							...get().timelineState.groups[groupId].items[itemId],
							startTime,
						};
						const oldItems = {...get().timelineState.groups[groupId].items};
						oldItems[newItem.id] = newItem;

						set((state) => {
							state.timelineState.groups[groupId].items = oldItems;
						});
					},
					moveTimelineItem: (fromGroupId, itemId, toGroupId, startTime) => {
						set((state) => {
							const item = {...state.timelineState.groups[fromGroupId].items[itemId], groupId: toGroupId, startTime};
							delete state.timelineState.groups[fromGroupId].items[itemId];
							state.timelineState.groups[toGroupId].items[itemId] = item;
						});
					},
					setGroupsHidden: (groupIds, hidden) => {
						set((state) => {
							groupIds.forEach((groupId) => {
								state.timelineState.groups[groupId].hidden = hidden;
							});
						});
					},
					setAllGroupsCollapsed: (collapsed) => {
						set((state) => {
							Object.values(state.timelineState.groups).forEach((group) => {
								group.collapsed = collapsed;
							});
						});
					},
					setBoundingBoxSize: (size) => {
						set({boundingBoxSize: size});
					},
					setLimits: (limits) => {
						set({limits: {...get().limits, ...limits}});
					},
					setTimelineScale: (scale) => {
						set((state) => {
							state.timelineState.scale = scale;
						});
					},
					saveBlock: (blockId: string, block: Partial<CodeBlock>) => {
						if (get().blocks[blockId] === undefined) return;

						set((state) => {
							state.blocks[blockId] = {
								...state.blocks[blockId],
								...block,
							};
						});
					},
					removeBlock: (id) => {
						// Delete the block from the list of blocks
						const newBlocks = Object.fromEntries(Object.entries(get().blocks).filter(([key, _]) => key !== id));

						// Remove all references to the block in the timeline
						const itemsToRemove = Object.values(get().timelineState.groups).map((group) =>
							Object.values(group.items).filter((item) => item.blockId === id),
						);

						itemsToRemove.flat().forEach((item) => {
							get().removeTimelineItem(item.groupId, item.id); 
						});

						// Select the block that takes its place in the list (the next one, else the previous), like a file list
						const ids = Object.keys(get().blocks);
						const index = ids.indexOf(id);
						const selectedBlockId = ids[index + 1] ?? ids[index - 1];

						set({blocks: newBlocks, editingBlockId: selectedBlockId});
					},
					renameBlock: (name) => {
						set((state) => {
							state.blocks[state.editingBlockId!].name = name;
						}); 
					},
					createBlock: (name) => {
						const block: CodeBlock = {
							id: uuid(),
							name: name,
							xml: '',
							python: '',
							javaScript: '',
							duration: 1,
							color: nextBlockColor(get().blocks),
						};
						set((state) => {
							state.blocks[block.id] = block;
						});
						return block.id;
					},
					copyBlock: (block) => {
						const newBlock: CodeBlock = {
							...block,
							id: uuid(),
							name: `Copy of ${block.name}`,
							// The next color in turn, as for a new block
							color: nextBlockColor(get().blocks),
						};

						set((state) => {
							state.blocks[newBlock.id] = newBlock;
						});

						return newBlock.id;
					},
					setMeasuredDurations: (durations, blockLengths) => {
						// Only real changes are written; a set() that writes nothing leaves the state as it was, and notifies no one
						const changed = (measured: number | undefined, current: number) => measured !== undefined && Math.abs(measured - current) > 1e-3;
						set((state) => {
							Object.values(state.timelineState.groups).forEach((group) => {
								Object.values(group.items).forEach((item) => {
									if (changed(durations[item.id], item.duration)) item.duration = durations[item.id];
								});
							});
							Object.values(state.blocks).forEach((block) => {
								if (changed(blockLengths[block.id], block.duration)) block.duration = blockLengths[block.id];
							});
						});
					},
					setEditingBlock: (blockId) => {
						const oldEditingBlockId = get().editingBlockId;
						set({editingBlockId: undefined});
						if (blockId != oldEditingBlockId) set({editingBlockId: blockId});
					},
					setRobotGroup: (robotId, groupId) => {
						set((state) => {
							Object.values(state.timelineState.groups).forEach((group) => {
								if (group.id !== allDronesGroupId) delete group.robots[robotId];
							});
							state.timelineState.groups[groupId].robots[robotId] = state.robots[robotId];
						});
					},
					createRobot: (groupId) => {
						const id = uuid();
						const robots = Object.values(get().robots);
						// First free grid spot and unused name. A shared counter restarted on reload (stacking robots at the
						// origin) and repeated names after deletes.
						const isTaken = (position: [number, number, number]) =>
							robots.some((robot) => robot.startingPosition.every((value, i) => value === position[i]));
						let startingPosition: [number, number, number] = [0, 0, 0];
						for (const position of startingPositionGenerator()) {
							if (!isTaken(position)) {
								startingPosition = position;
								break;
							}
						}
						let number = 1;
						while (robots.some((robot) => robot.name === `CF ${number}`)) number++;

						set((state) => {
							state.robots[id] = {
								id,
								name: `CF ${number}`,
								type: 'crazyflie',
								startingPosition,
							};
							state.timelineState.groups[allDronesGroupId].robots[id] = state.robots[id];
							state.timelineState.groups[groupId].robots[id] = state.robots[id];
						});
						return id;
					},
					saveRobot: (id, robot) => {
						set((state) => {
							state.robots[id] = {
								...state.robots[id],
								...robot,
							};
						});
					},
					deleteRobot: (id) => {
						set((state) => {
							delete state.robots[id];
							// Lanes keep their own copy of their robots; without this they keep a ghost entry
							Object.values(state.timelineState.groups).forEach((group) => {
								delete group.robots[id];
							});
						});
						useSimulator.getState().reset();
					},
					removeTimelineItem: (groupId, itemId) => {
						const newItems = {...get().timelineState.groups[groupId].items};
						delete newItems[itemId];

						set((state) => {
							state.timelineState.groups[groupId].items = newItems;
						});
					},
					renameGroup: (groupId: string, groupName: string) => {
						// Through the draft: the stored state is frozen, so assigning to it directly throws
						set((state) => {
							state.timelineState.groups[groupId].name = groupName;
						});
					},
					addGroup: (groupName: string) => {
						const group = newGroup(groupName, get().timelineState.groups);
						// Matches the collapse-all toggle
						if (Object.values(get().timelineState.groups).every((other) => other.collapsed)) group.collapsed = true;
						set((state) => {
							state.timelineState.groups[group.id] = group;
						});
						return group.id;
					},
					removeGroup: (groupId: string) => {
						const robotIds = Object.keys(get().timelineState.groups[groupId].robots);
						set((state) => {
							delete state.timelineState.groups[groupId];
							// Every robot is in a group, so its robots go with it
							robotIds.forEach((robotId) => {
								delete state.robots[robotId];
								delete state.timelineState.groups[allDronesGroupId].robots[robotId];
							});
						});
						if (robotIds.length > 0) useSimulator.getState().reset();
					},
				}),
				{
					storage: createJSONStorage(() => sessionStorage),
					name: 'robartState',
					// The project kept in the browser may predate one-group-per-robot
					merge: (persistedState, currentState) => {
						if (!persistedState) return currentState;
						const merged = {...currentState, ...(persistedState as Partial<MRAState>)};
						return {...merged, ...migrateGroups(merged)};
					},
				},
			),
		),
	),
);

useRobartState.subscribe(
	(state) => state.robots,
	(robots) => {
		// Only while stopped: mid-show this put every drone back at its start and emptied its queue, which could end the
		// show. Timeline's re-measure updates a paused or running show instead.
		if (useSimulator.getState().status === 'STOPPED') useSimulator.getState().setRobots(withoutHiddenGroups({robots, timelineState: useRobartState.getState().timelineState}).robots);
	},
);
