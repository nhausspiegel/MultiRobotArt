import type {TimelineItem} from '../../state/useRobartState';

// Whether a block of this length placed at startTime would overlap a placed one. Blocks may touch, end to start. `id` is
// the block being moved, which doesn't count. Before 0, or no time at all, counts as overlapping.
export const blockOverlaps = (occupiedItems: TimelineItem[], startTime: number | undefined, duration: number, id?: string) =>
	startTime === undefined
	|| startTime < 0
	|| occupiedItems.some((item) => item !== undefined && item.id !== id
		&& item.startTime + item.duration > startTime + 1e-9 && startTime + duration > item.startTime + 1e-9);

// Where a block of this length lands when dropped or dragged to startTime: there if it fits, or else against the nearest
// block it would overlap (just after it or just before it), when that spot is free and no more than `reach` away.
// Undefined when it can't go there.
export const landingTime = (occupiedItems: TimelineItem[], startTime: number, duration: number, reach: number, id?: string) => {
	if (!blockOverlaps(occupiedItems, startTime, duration, id)) return startTime;
	return occupiedItems
		.filter((item) => item !== undefined && item.id !== id)
		.flatMap((item) => [item.startTime + item.duration, item.startTime - duration])
		.filter((candidate) => Math.abs(candidate - startTime) <= reach && !blockOverlaps(occupiedItems, candidate, duration, id))
		.sort((a, b) => Math.abs(a - startTime) - Math.abs(b - startTime))[0];
};
