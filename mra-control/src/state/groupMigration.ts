import type {MRAState, RobotState, TimelineGroupState} from './useRobartState';

// The lane whose blocks run on every robot. Kept as groupAllCFs so older projects and exported file names still match.
export const allDronesGroupId = 'groupAllCFs';

export const groupColors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// First palette color no group uses yet; cycles once all are taken
export const nextGroupColor = (groups: Record<string, TimelineGroupState>) => {
	const usedColors = Object.values(groups).map((group) => group.color);
	return groupColors.find((color) => !usedColors.includes(color)) ?? groupColors[Object.keys(groups).length % groupColors.length];
};

// One past the highest "Group N"; counting lanes repeats names after a lane is removed
export const nextGroupName = (groups: Record<string, TimelineGroupState>) => {
	const highest = Math.max(0, ...Object.values(groups).map((group) => Number(/^group (\d+)$/i.exec(group.name)?.[1] ?? 0)));
	return `Group ${highest + 1}`;
};

export const newGroup = (name: string, groups: Record<string, TimelineGroupState>): TimelineGroupState => {
	// The id is also the exported Python module name (<id>_node), so letters, digits and _ only, not starting with a digit.
	// It must be unique, or the new lane replaces an existing one and wipes its blocks and robots.
	let baseId = name.replace(/\W/g, '');
	if (!/^[A-Za-z_]/.test(baseId)) baseId = 'group' + baseId;
	let id = baseId;
	for (let i = 2; id in groups; i++) id = `${baseId}_${i}`;
	return {id, name, items: {}, robots: {}, duration: 120, color: nextGroupColor(groups)};
};

/**
 * Brings a project to "one group per robot": the All drones lane holds every robot, and each robot is in exactly one
 * other group. Robots in several groups stay in the top-most one; robots in none join the top-most group (Group 1 is
 * created if there is none). Empty lanes (no robots, no blocks) are dropped, groups get colors, and robots that no
 * longer exist are removed from lanes. Safe to run on an already-migrated project.
 * @returns The migrated state, plus notes about robots that were moved, for the Warnings tab.
 */
export const migrateGroups = <T extends Pick<MRAState, 'robots' | 'timelineState'>>(state: T): T & {notices: string[]} => {
	const notices: string[] = [];
	const allDrones = state.timelineState.groups[allDronesGroupId]
		?? {id: allDronesGroupId, name: 'All drones', items: {}, robots: {}, duration: 120};
	const groups: Record<string, TimelineGroupState> = {
		[allDronesGroupId]: {...allDrones, name: allDrones.name === 'All CFs' ? 'All drones' : allDrones.name, robots: {...state.robots}},
	};

	const keptIn = new Map<string, string>(); // Robot id -> name of the group it stays in
	Object.values(state.timelineState.groups).forEach((group) => {
		if (group.id === allDronesGroupId) return;
		const robots: Record<string, RobotState> = {};
		Object.keys(group.robots).forEach((robotId) => {
			const robot = state.robots[robotId];
			if (robot === undefined) return;
			if (keptIn.has(robotId)) {
				notices.push(`${robot.name} was in several groups: kept in ${keptIn.get(robotId)!}, removed from ${group.name}.\n`);
				return;
			}

			keptIn.set(robotId, group.name);
			robots[robotId] = robot;
		});
		// Drop groups the migration emptied (all their robots kept elsewhere), not lanes the user left empty
		if (Object.keys(group.robots).length > 0 && Object.keys(robots).length === 0 && Object.keys(group.items).length === 0) return;
		groups[group.id] = {...group, robots};
	});

	Object.values(groups).forEach((group) => {
		if (group.id !== allDronesGroupId && group.color === undefined) group.color = nextGroupColor(groups);
	});

	const ungrouped = Object.values(state.robots).filter((robot) => !keptIn.has(robot.id));
	if (ungrouped.length > 0) {
		let target = Object.values(groups).find((group) => group.id !== allDronesGroupId);
		if (target === undefined) {
			target = newGroup(nextGroupName(groups), groups);
			groups[target.id] = target;
		}

		ungrouped.forEach((robot) => {
			target!.robots[robot.id] = robot;
			notices.push(`${robot.name} had no group: added to ${target!.name}.\n`);
		});
	}

	return {...state, timelineState: {...state.timelineState, groups}, notices};
};
