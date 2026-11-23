export const MAP_WORLD_WIDTH = 72;
export const MAP_WORLD_DEPTH = 64;
export const MAP_SHARED_START = [36.6, 32] as const;

export const MAP_RIVER_POINTS = [
	[-5, 37], [4, 37], [14, 37], [21, 32], [28, 28],
	[25.5, 19.5], [24, 8], [24, -5],
] as const;
export const MAP_BRIDGE_POSITIONS = [[14, 37], [25.5, 19.5]] as const;
export const MAP_RIVER_CONTINUATION_TARGET = [28, 28] as const;

export const MAP_LARGE_ASSETS = [
	[2, 12], [4, 9], [45, 10], [56, 8],
	[2, 18], [4, 20], [3, 23], [5, 25],
	[2.5, 20.5], [4.5, 22.5], [3, 26],
	[4, 45], [55, 43],
] as const;

export const READING_STOPS = [
	[0.583, 0.327], [0.483, 0.308], [0.417, 0.25], [0.264, 0.344],
	[0.258, 0.462], [0.15, 0.404], [0.07, 0.484],
	[0.278, 0.625], [0.321, 0.558], [0.383, 0.538], [0.467, 0.558],
	[0.467, 0.635], [0.417, 0.672], [0.167, 0.712], [0.183, 0.769],
] as const;

export const MATH_STOPS = [
	[0.60, 0.519], [0.60, 0.452], [0.75, 0.577],
	[0.70, 0.404], [0.783, 0.462], [0.817, 0.308],
] as const;
