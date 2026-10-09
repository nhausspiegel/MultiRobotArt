// Run: node --experimental-strip-types checks/groupMigration.check.ts (from mra-control)
import assert from 'node:assert/strict';
import {allDronesGroupId, migrateGroups} from '../src/state/groupMigration.ts';

const robot = (id: string, name: string) => ({id, name, type: 'crazyflie' as const, startingPosition: [0, 0, 0] as [number, number, number]});
const robots = {a: robot('a', 'CF 1'), b: robot('b', 'CF 2')};
const lane = (id: string, name: string, robotIds: string[], items = {}) => ({
	id,
	name,
	items,
	robots: Object.fromEntries(robotIds.map((robotId) => [robotId, robot(robotId, 'stale copy')])),
	duration: 120,
});
const item = {id: 'i', groupId: 'group2', blockId: 'x', isTrajectory: false, startTime: 0, duration: 1};

const old = {
	robots,
	timelineState: {
		scale: 1,
		groups: {
			[allDronesGroupId]: lane(allDronesGroupId, 'All CFs', ['a']),
			group1: lane('group1', 'Group 1', ['a', 'b']),
			group2: lane('group2', 'Group 2', ['b', 'deleted'], {i: item}),
			group3: lane('group3', 'Group 3', []),
		},
	},
};

const migrated = migrateGroups(old);
const {groups} = migrated.timelineState;

// All drones: renamed, holds every robot (current objects, not stale copies)
assert.equal(groups[allDronesGroupId].name, 'All drones');
assert.deepEqual(Object.keys(groups[allDronesGroupId].robots).sort(), ['a', 'b']);
assert.equal(groups[allDronesGroupId].robots.a.name, 'CF 1');

// Robot b was in group1 and group2: kept in the top-most (group1), removed from group2, with a note
assert.deepEqual(Object.keys(groups.group1.robots).sort(), ['a', 'b']);
assert.deepEqual(Object.keys(groups.group2.robots), []); // deleted robot dropped too
assert.equal(migrated.notices.length, 1);
assert.match(migrated.notices[0], /CF 2 .*kept in Group 1, removed from Group 2/);

// group2 kept (has a block), group3 dropped (empty), lanes keep their order with All drones first
assert.deepEqual(Object.keys(groups), [allDronesGroupId, 'group1', 'group2']);

// Colors: every group but All drones, all different
assert.equal(groups[allDronesGroupId].color, undefined);
assert.ok(groups.group1.color && groups.group2.color && groups.group1.color !== groups.group2.color);

// Running it again changes nothing
const again = migrateGroups(migrated);
assert.deepEqual(again.timelineState, migrated.timelineState);
assert.deepEqual(again.notices, []);

console.log('group migration ok');
