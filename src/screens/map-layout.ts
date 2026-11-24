export const MAP_WORLD_WIDTH = 136;
export const MAP_WORLD_DEPTH = 64;
export const MAP_SHARED_START = [68, 32] as const;
export const MAP_DIRECTION_SIGN_POSITION = [68, 28] as const;
export const MAP_LANDMARKS = {
	readingTree: [61, 18],
	readingBlossom: [56, 18],
	readingArch: [40, 37],
	readingTreeLibrary: [29, 44],
	readingBookstone: [24, 40],
	storybookCottage: [21, 38],
	readingMushrooms: [5, 18],
	mathAbacus: [77, 16],
	mathCrystals: [97, 26],
	mountainObservatory: [116, 47],
} as const;
export type MapLandmarkKey = keyof typeof MAP_LANDMARKS;
export type MapLandmarkLayout = Record<MapLandmarkKey, readonly [number, number] | null>;

export const MAP_RIVER_POINTS = [
	[-5, 37], [4, 37], [14, 37], [21, 32], [28, 28],
	[38, 21.5], [48, 17.5], [58, 8.5], [68, 5.5], [78, -2],
] as const;
// Center the bridge on the actual trail/river crossing, not on the river's
// nearby control point. The bridge's long axis follows the reading trail.
export const MAP_BRIDGE_POSITIONS = [[27.2, 29.1]] as const;
export const MAP_BRIDGE_ROTATION = 1.73;
export const MAP_RIVER_CONTINUATION_TARGET = [28, 28] as const;
export const MAP_READING_SPECIALS = [
	MAP_LANDMARKS.readingTree,
	MAP_LANDMARKS.readingBlossom,
	MAP_LANDMARKS.readingArch,
	MAP_LANDMARKS.readingTreeLibrary,
	MAP_BRIDGE_POSITIONS[0],
	MAP_LANDMARKS.readingBookstone,
	MAP_LANDMARKS.storybookCottage,
	MAP_LANDMARKS.readingMushrooms,
] as const;
export const MAP_MATH_SPECIALS = [MAP_LANDMARKS.mathAbacus, MAP_LANDMARKS.mathCrystals, MAP_LANDMARKS.mountainObservatory] as const;

export function mountainBlendAt(x: number, z: number) {
	const biomeEdge = 61 + (z - 32) * 0.18 + Math.sin(z * 0.22) * 1.8;
	const blend = Math.min(1, Math.max(0, (x - (biomeEdge - 5)) / 10));
	return blend * blend * (3 - 2 * blend);
}

export const MAP_LARGE_ASSETS = [
	...Object.values(MAP_LANDMARKS),
	[16, 49], [19, 52], [22, 50], [25, 53],
	[16.5, 52], [20.5, 54], [23, 56],
] as const;

export const READING_STOPS = [
	[63 / 136, 28 / 64], [58 / 136, 24 / 64], [52 / 136, 23 / 64],
	[47 / 136, 27 / 64], [42 / 136, 34 / 64], [38 / 136, 40 / 64],
	[33 / 136, 39 / 64], [29 / 136, 36 / 64], [25 / 136, 22 / 64],
	[21 / 136, 24 / 64], [17 / 136, 29 / 64], [14 / 136, 27 / 64],
	[10 / 136, 23 / 64], [8 / 136, 34 / 64], [4 / 136, 31 / 64],
	[1 / 136, 24 / 64],
] as const;

export const MATH_STOPS = [
	[73 / 136, 27 / 64], [81 / 136, 23 / 64], [91 / 136, 28 / 64],
	[101 / 136, 38 / 64], [111 / 136, 42 / 64], [123 / 136, 34 / 64],
] as const;
