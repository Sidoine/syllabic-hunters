import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CHAPTERS } from "../src/data/story";
import {
	MAP_SHARED_START,
	MAP_DIRECTION_SIGN_POSITION,
	MAP_BRIDGE_POSITIONS,
	MAP_BRIDGE_ROTATION,
	MAP_LARGE_ASSETS,
	MAP_LANDMARKS,
	MAP_MATH_SPECIALS,
	MAP_READING_SPECIALS,
	MAP_RIVER_CONTINUATION_TARGET,
	MAP_RIVER_POINTS,
	MAP_WORLD_DEPTH,
	MAP_WORLD_WIDTH,
	MATH_STOPS,
	mountainBlendAt,
	READING_STOPS,
} from "../src/screens/map-layout";

const ADJACENT_STAGE_MIN_DISTANCE = 3.2;
const NON_ADJACENT_STAGE_MIN_DISTANCE = 7.5;
const OTHER_REGION_STAGE_MIN_DISTANCE = 5.5;
const ROAD_CROSSING_TOLERANCE = 0.7;
const STAGE_TO_UNRELATED_ROAD_MIN_DISTANCE = 3;
const RIVER_CROSSING_TOLERANCE = 0.9;
const BRIDGE_CROSSING_RADIUS = 2;
const RIVER_CROSSING_TO_STAGE_MIN_DISTANCE = 4.5;
const RIVER_TO_TRAIL_MIN_CLEARANCE = 2.2;
const ASSET_TO_STAGE_MIN_DISTANCE = 3.2;
const RIVER_TO_LANDMARK_MIN_CLEARANCE = 4.5;
const ROAD_SAMPLES_PER_STOP = 10;

type Point = { x: number; z: number };
type RoadSample = { a: Point; b: Point; controlSegment: number };

const worldPoints = (stops: readonly (readonly [number, number])[]) => stops.map(([x, z]) => ({
	x: x * MAP_WORLD_WIDTH,
	z: z * MAP_WORLD_DEPTH,
}));

const routes = [
	{ name: "lecture", stops: worldPoints(READING_STOPS), points: [{ x: MAP_SHARED_START[0], z: MAP_SHARED_START[1] }, ...worldPoints(READING_STOPS)] },
	{ name: "maths", stops: worldPoints(MATH_STOPS), points: [{ x: MAP_SHARED_START[0], z: MAP_SHARED_START[1] }, ...worldPoints(MATH_STOPS)] },
] as const;

function sampleRoad(points: readonly Point[]): RoadSample[] {
	const curve = new THREE.CatmullRomCurve3(points.map(({ x, z }) => new THREE.Vector3(x, 0, z)), false, "centripetal");
	const samples: RoadSample[] = [];
	const controlSegments = points.length - 1;
	for (let controlSegment = 0; controlSegment < controlSegments; controlSegment++) {
		let previous = curve.getPoint(controlSegment / controlSegments);
		for (let index = 1; index <= ROAD_SAMPLES_PER_STOP; index++) {
			const next = curve.getPoint((controlSegment + index / ROAD_SAMPLES_PER_STOP) / controlSegments);
			samples.push({ a: { x: previous.x, z: previous.z }, b: { x: next.x, z: next.z }, controlSegment });
			previous = next;
		}
	}
	return samples;
}

const roadSamples = routes.map((route) => ({ ...route, samples: sampleRoad(route.points) }));

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const lengthSquared = dx * dx + dz * dz;
	const projection = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared)) : 0;
	return Math.hypot(point.x - start.x - projection * dx, point.z - start.z - projection * dz);
}

test("the illustrated direction sign stays clear of stage markers and trails", () => {
	const sign = { x: MAP_DIRECTION_SIGN_POSITION[0], z: MAP_DIRECTION_SIGN_POSITION[1] };
	const stages = [{ x: MAP_SHARED_START[0], z: MAP_SHARED_START[1] }, ...routes.flatMap((route) => route.stops)];
	for (const stage of stages) {
		assert.ok(Math.hypot(sign.x - stage.x, sign.z - stage.z) >= 3.5, "the sign should not crowd a stage marker");
	}
	for (const route of routes) {
		for (const sample of sampleRoad(route.points)) {
			assert.ok(pointToSegmentDistance(sign, sample.a, sample.b) >= 2.5, "the sign should stand beside, not on, a trail");
		}
	}
});

function cross(a: Point, b: Point, c: Point) {
	return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
	const abC = cross(a, b, c);
	const abD = cross(a, b, d);
	const cdA = cross(c, d, a);
	const cdB = cross(c, d, b);
	return abC * abD <= 1e-8 && cdA * cdB <= 1e-8;
}

function segmentDistance(first: RoadSample, second: RoadSample) {
	if (segmentsIntersect(first.a, first.b, second.a, second.b)) return 0;
	return Math.min(
		pointToSegmentDistance(first.a, second.a, second.b),
		pointToSegmentDistance(first.b, second.a, second.b),
		pointToSegmentDistance(second.a, first.a, first.b),
		pointToSegmentDistance(second.b, first.a, first.b),
	);
}

test("mission stages have enough space between them", () => {
	for (const route of routes) {
		for (let first = 0; first < route.stops.length; first++) {
			for (let second = first + 1; second < route.stops.length; second++) {
				const a = route.stops[first];
				const b = route.stops[second];
				const distance = Math.hypot(a.x - b.x, a.z - b.z);
				const minimum = second === first + 1 ? ADJACENT_STAGE_MIN_DISTANCE : NON_ADJACENT_STAGE_MIN_DISTANCE;
				assert.ok(distance >= minimum, `${route.name} stages ${first} and ${second} are only ${distance.toFixed(2)} units apart (need ${minimum})`);
			}
		}
	}
	for (const reading of routes[0].stops) {
		for (const math of routes[1].stops) {
			const distance = Math.hypot(reading.x - math.x, reading.z - math.z);
			assert.ok(distance >= OTHER_REGION_STAGE_MIN_DISTANCE, `reading and math stages are only ${distance.toFixed(2)} units apart`);
		}
	}
});

test("reading advances west and maths east through several bends", () => {
	const reading = routes[0].points;
	const maths = routes[1].points;
	assert.ok(reading.slice(1).every((point, index) => point.x < reading[index].x), "reading stages must keep moving west");
	assert.ok(maths.slice(1).every((point, index) => point.x > maths[index].x), "maths stages must keep moving east");
	for (const [route, minimumDirectionChanges] of [[reading, 3], [maths, 2]] as const) {
		const verticalDirections = route.slice(1).map((point, index) => Math.sign(point.z - route[index].z)).filter((direction) => direction !== 0);
		const directionChanges = verticalDirections.slice(1).filter((direction, index) => direction !== verticalDirections[index]).length;
		assert.ok(directionChanges >= minimumDirectionChanges, `route should form several clear bends, found ${directionChanges}`);
		assert.ok(route.every(({ x, z }) => x >= 0 && x <= MAP_WORLD_WIDTH && z >= 0 && z <= MAP_WORLD_DEPTH), "route must remain inside the enlarged map");
	}
});

test("every reading chapter has a distinct map stop, with Grand Concert at the western end", () => {
	assert.equal(READING_STOPS.length, CHAPTERS.length, "every reading chapter needs a map stop");
	const grandConcertIndex = CHAPTERS.findIndex((chapter) => chapter.title === "Le Grand Concert");
	assert.ok(grandConcertIndex >= 0, "Grand Concert chapter should exist");
	assert.equal(grandConcertIndex, CHAPTERS.length - 1, "Grand Concert should be the final reading chapter");
	const [grandConcertX] = READING_STOPS[grandConcertIndex];
	assert.ok(grandConcertX < READING_STOPS[0][0], "Grand Concert should be placed west of the reading start");
});

test("roads do not cross or loop back through non-adjacent parts", () => {
	for (const route of roadSamples) {
		for (let first = 0; first < route.samples.length; first++) {
			for (let second = first + 1; second < route.samples.length; second++) {
				const a = route.samples[first];
				const b = route.samples[second];
				if (Math.abs(a.controlSegment - b.controlSegment) <= 1) continue;
				const distance = segmentDistance(a, b);
				assert.ok(distance >= ROAD_CROSSING_TOLERANCE, `${route.name} road crosses between control segments ${a.controlSegment} and ${b.controlSegment}`);
			}
		}
	}
	for (const reading of roadSamples[0].samples) {
		for (const math of roadSamples[1].samples) {
			if (reading.controlSegment === 0 && math.controlSegment === 0) continue;
			const distance = segmentDistance(reading, math);
			assert.ok(distance >= ROAD_CROSSING_TOLERANCE, `reading and math roads cross near ${distance.toFixed(2)} units apart`);
		}
	}
});

test("no stage pin sits on an unrelated part of either road", () => {
	for (const [routeIndex, route] of routes.entries()) {
		for (const [stageIndex, stage] of route.stops.entries()) {
			for (const road of roadSamples) {
				for (const sample of road.samples) {
					if (road === roadSamples[routeIndex] && (sample.controlSegment === stageIndex || sample.controlSegment === stageIndex + 1)) continue;
					const distance = pointToSegmentDistance(stage, sample.a, sample.b);
					assert.ok(distance >= STAGE_TO_UNRELATED_ROAD_MIN_DISTANCE, `${route.name} stage ${stageIndex} is ${distance.toFixed(2)} units from ${road.name} road segment ${sample.controlSegment}`);
				}
			}
		}
	}
});

test("the river crosses trails only at the bridge, clear of stage pins", () => {
	const riverEntry = MAP_RIVER_POINTS[0];
	const riverExit = MAP_RIVER_POINTS.at(-1)!;
	const boundarySide = ([x, z]: readonly [number, number]) =>
		x < 0 ? "left" : x > MAP_WORLD_WIDTH ? "right" : z < 0 ? "top" : z > MAP_WORLD_DEPTH ? "bottom" : "inside";
	assert.notEqual(boundarySide(riverEntry), "inside", "the river must enter from the map boundary");
	assert.notEqual(boundarySide(riverExit), "inside", "the river must leave through the map boundary");
	assert.notEqual(boundarySide(riverEntry), boundarySide(riverExit), "the river must leave through a different side than it entered");
	const bridgeControlPointIndex = MAP_RIVER_POINTS.findIndex(([x, z]) => Math.hypot(x - 28, z - 28) < 0.01);
	assert.ok(bridgeControlPointIndex >= 0, "the river should pass through the bridge control point");
	const downstream = MAP_RIVER_POINTS.slice(bridgeControlPointIndex);
	assert.ok(downstream.slice(1).every(([x, z], index) => x > downstream[index][0] && z < downstream[index][1]), "after the bridge, the river should continue toward the northeast exit");
	const downstreamVectors = downstream.slice(1).map(([x, z], index) => new THREE.Vector2(x - downstream[index][0], z - downstream[index][1]).normalize());
	const downstreamTurns = downstreamVectors.slice(1).map((direction, index) => direction.dot(downstreamVectors[index]));
	assert.ok(downstreamTurns.every((dot) => dot > Math.cos(THREE.MathUtils.degToRad(30))), "downstream bends should stay gradual");
	assert.ok(downstreamTurns.some((dot) => dot < Math.cos(THREE.MathUtils.degToRad(5))), "the river should meander after the bridge");
	for (let index = 1; index < MAP_RIVER_POINTS.length - 1; index++) {
		const before = MAP_RIVER_POINTS[index - 1];
		const current = MAP_RIVER_POINTS[index];
		const after = MAP_RIVER_POINTS[index + 1];
		const incoming = new THREE.Vector2(current[0] - before[0], current[1] - before[1]).normalize();
		const outgoing = new THREE.Vector2(after[0] - current[0], after[1] - current[1]).normalize();
		const turnDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing), -1, 1)));
		assert.ok(turnDegrees < 125, `river makes an abrupt ${turnDegrees.toFixed(1)}° turn at control point ${index}`);
	}
	const riverCurve = new THREE.CatmullRomCurve3(
		MAP_RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
		false,
		"centripetal",
	);
	const riverPoints = riverCurve.getPoints(480).map(({ x, z }) => ({ x, z }));
	const targetDistance = Math.min(...riverPoints.map(({ x, z }) => Math.hypot(x - MAP_RIVER_CONTINUATION_TARGET[0], z - MAP_RIVER_CONTINUATION_TARGET[1])));
	assert.ok(targetDistance <= 1, `river misses its intended continuation area by ${targetDistance.toFixed(2)} units`);
	const bridgeDistance = (point: Point) => Math.min(...MAP_BRIDGE_POSITIONS.map(([x, z]) => Math.hypot(point.x - x, point.z - z)));
	const crossings: Point[] = [];
	const uncovered: string[] = [];
	for (const route of roadSamples) {
		for (const road of route.samples) {
			for (let index = 0; index < riverPoints.length - 1; index++) {
				const riverSegment = { a: riverPoints[index], b: riverPoints[index + 1], controlSegment: index };
				const midpoint = {
					x: (road.a.x + road.b.x + riverSegment.a.x + riverSegment.b.x) / 4,
					z: (road.a.z + road.b.z + riverSegment.a.z + riverSegment.b.z) / 4,
				};
				const distance = segmentDistance(road, riverSegment);
				if (bridgeDistance(midpoint) > BRIDGE_CROSSING_RADIUS + 1) {
					assert.ok(distance >= RIVER_TO_TRAIL_MIN_CLEARANCE, `river is only ${distance.toFixed(2)} units from ${road.name} trail away from the bridge`);
				}
				if (distance >= RIVER_CROSSING_TOLERANCE) continue;
				if (bridgeDistance(midpoint) > BRIDGE_CROSSING_RADIUS) uncovered.push(`${midpoint.x.toFixed(1)},${midpoint.z.toFixed(1)}`);
				crossings.push(midpoint);
			}
		}
	}
	assert.ok(crossings.length > 0, "the bridge must cover a trail/river crossing");
	assert.deepEqual([...new Set(uncovered)], [], `unbridged crossings at ${[...new Set(uncovered)].join("; ")}`);
	for (const [index, [x, z]] of MAP_BRIDGE_POSITIONS.entries()) {
		const distance = Math.min(...crossings.map((crossing) => Math.hypot(crossing.x - x, crossing.z - z)));
		assert.ok(distance <= BRIDGE_CROSSING_RADIUS, `bridge ${index} is ${distance.toFixed(2)} units from the nearest trail/river crossing`);
	}
	for (const [bridgeIndex, [x, z]] of MAP_BRIDGE_POSITIONS.entries()) {
		const bridgeRoad = roadSamples.flatMap((route) => route.samples).reduce((nearest, sample) => {
			const distance = pointToSegmentDistance({ x, z }, sample.a, sample.b);
			return distance < nearest.distance ? { sample, distance } : nearest;
		}, { sample: roadSamples[0].samples[0], distance: Number.POSITIVE_INFINITY }).sample;
		const roadDirection = new THREE.Vector2(bridgeRoad.b.x - bridgeRoad.a.x, bridgeRoad.b.z - bridgeRoad.a.z).normalize();
		const bridgeDirection = new THREE.Vector2(Math.cos(MAP_BRIDGE_ROTATION), -Math.sin(MAP_BRIDGE_ROTATION));
		assert.ok(Math.abs(roadDirection.dot(bridgeDirection)) >= Math.cos(THREE.MathUtils.degToRad(20)), `bridge ${bridgeIndex} should align with the trail crossing`);
	}
	for (const crossing of crossings) {
		for (const route of routes) {
			for (const stage of route.stops) {
				const distance = Math.hypot(crossing.x - stage.x, crossing.z - stage.z);
				assert.ok(distance >= RIVER_CROSSING_TO_STAGE_MIN_DISTANCE, `river crossing (${crossing.x.toFixed(1)}, ${crossing.z.toFixed(1)}) is only ${distance.toFixed(2)} units from a stage pin (${stage.x.toFixed(1)}, ${stage.z.toFixed(1)})`);
			}
		}
	}
});

test("the river uses a rocky mountain section after entering the maths biome", () => {
	const blends = MAP_RIVER_POINTS.map(([x, z]) => mountainBlendAt(x, z));
	assert.ok(blends.some((blend) => blend < 0.5), "the river should retain its woodland style before the biome transition");
	assert.ok(blends.some((blend) => blend >= 0.5), "the river should switch to its rocky style in the maths biome");
	assert.ok(blends.slice(-2).every((blend) => blend > 0.95), "the river should use the mountain style all the way to its exit");
});

test("large environment assets stay clear of stage pins", () => {
	const stagePins = routes.flatMap((route) => route.stops);
	for (const [assetIndex, [x, z]] of MAP_LARGE_ASSETS.entries()) {
		for (const stage of stagePins) {
			const distance = Math.hypot(x - stage.x, z - stage.z);
			assert.ok(distance >= ASSET_TO_STAGE_MIN_DISTANCE, `large asset ${assetIndex} is only ${distance.toFixed(2)} units from a stage pin`);
		}
	}
});

test("unique landmarks stay visible near the trails without crowding stages", () => {
	const stagePins = routes.flatMap((route) => route.stops);
	for (const [name, [x, z]] of Object.entries(MAP_LANDMARKS)) {
		const roadDistance = Math.min(...roadSamples.flatMap((route) => route.samples.map((sample) => pointToSegmentDistance({ x, z }, sample.a, sample.b))));
	const stageDistance = Math.min(...stagePins.map((stage) => Math.hypot(x - stage.x, z - stage.z)));
		if (name === "readingArch") {
			assert.ok(roadDistance <= 1, `readingArch should span the trail, but it is ${roadDistance.toFixed(2)} units away`);
		} else {
			assert.ok(roadDistance >= 4.5 && roadDistance <= 8.5, `${name} is ${roadDistance.toFixed(2)} units from the nearest trail; landmarks should be nearby and visible`);
		}
		assert.ok(stageDistance >= (name === "readingArch" ? 3.2 : 4.5), `${name} is only ${stageDistance.toFixed(2)} units from a stage pin`);
	}
});

test("landmarks stay clear of the river", () => {
	const river = new THREE.CatmullRomCurve3(MAP_RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
	const riverSamples = river.getPoints(480).map(({ x, z }) => ({ x, z }));
	for (const [name, [x, z]] of Object.entries(MAP_LANDMARKS)) {
		const distance = Math.min(...riverSamples.slice(0, -1).map((point, index) =>
			pointToSegmentDistance({ x, z }, point, riverSamples[index + 1]),
		));
		assert.ok(distance >= RIVER_TO_LANDMARK_MIN_CLEARANCE, `${name} is only ${distance.toFixed(2)} units from the river`);
	}
});

test("every pair of route stages has a nearby unique landmark", () => {
	for (const [name, specials, route] of [
		["reading", MAP_READING_SPECIALS, routes[0]],
		["maths", MAP_MATH_SPECIALS, routes[1]],
	] as const) {
		assert.ok(specials.length >= Math.ceil(route.stops.length / 2), `${name} should have at least one landmark for every two stages`);
		for (let stageIndex = 0; stageIndex < route.stops.length; stageIndex += 2) {
			const stagePair = route.stops.slice(stageIndex, stageIndex + 2);
			const landmarkDistance = Math.min(...specials.map(([x, z]) =>
				Math.min(...stagePair.map((stage) => Math.hypot(x - stage.x, z - stage.z))),
			));
			assert.ok(landmarkDistance <= 12, `${name} stages ${stageIndex + 1}-${stageIndex + stagePair.length} have no nearby special asset`);
		}
		const xCoordinates = specials.map(([x]) => x);
		const progressesInRouteDirection = name === "reading"
			? xCoordinates.every((x, index) => index === 0 || x < xCoordinates[index - 1])
			: xCoordinates.every((x, index) => index === 0 || x > xCoordinates[index - 1]);
		assert.ok(progressesInRouteDirection, `${name} landmarks should be distributed along the route`);
	}
});
