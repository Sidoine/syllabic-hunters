import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import readingMarkerBadge from "../assets/ui/map-marker-reading.webp";
import mathMarkerBadge from "../assets/ui/map-marker-math.webp";
import lockedMarkerBadge from "../assets/ui/map-marker-locked.webp";
import { MAP_BRIDGE_POSITIONS, MAP_RIVER_POINTS, MAP_SHARED_START, MAP_WORLD_DEPTH, MAP_WORLD_WIDTH, MATH_STOPS, READING_STOPS } from "./map-layout";


export const WORLD_WIDTH = MAP_WORLD_WIDTH;
export const WORLD_DEPTH = MAP_WORLD_DEPTH;
export const WORLD_SCALE = 52;
export const WORLD_PITCH = 0.82;
export const WORLD_PIXEL_WIDTH = WORLD_WIDTH * WORLD_SCALE;
export const WORLD_PIXEL_HEIGHT = WORLD_DEPTH * WORLD_SCALE * WORLD_PITCH;

const worldPath = (stops: readonly (readonly [number, number])[]) => stops.map(([x, y]) => {
	const worldX = x * WORLD_WIDTH;
	const worldZ = y * WORLD_DEPTH;
	return new THREE.Vector3(worldX, 0, worldZ);
});
const sharedMapStart = new THREE.Vector3(MAP_SHARED_START[0], 0, MAP_SHARED_START[1]);
const readingRoadPoints = [sharedMapStart, ...worldPath(READING_STOPS)];
const mathRoadPoints = [sharedMapStart.clone(), ...worldPath(MATH_STOPS)];
const missionRoadCurves = [
	new THREE.CatmullRomCurve3(readingRoadPoints, false, "centripetal"),
	new THREE.CatmullRomCurve3(mathRoadPoints, false, "centripetal"),
];
const missionRoadSamples = missionRoadCurves.flatMap((curve) => curve.getPoints(240));

function distanceToMissionRoad(x: number, z: number) {
	let closest = Infinity;
	for (const point of missionRoadSamples) closest = Math.min(closest, Math.hypot(x - point.x, z - point.z));
	return closest;
}

export type StageMarkerData = {
	region: "reading" | "math";
	index: number;
	label: string;
	title: string;
	stars: number;
	maxStars: number;
	unlocked: boolean;
	done: boolean;
	current: boolean;
	confirming: boolean;
};

export type MapLoadProgress = { loaded: number; total: number; complete: boolean };

function markerColor(marker: StageMarkerData) {
	if (!marker.unlocked) return "#8a6240";
	if (marker.current) return "#dfaa35";
	return marker.region === "reading" ? "#e347a8" : "#28b9d4";
}

function completionPercent(marker: StageMarkerData) {
	return marker.maxStars > 0 ? Math.round(Math.min(marker.stars / marker.maxStars, 1) * 100) : 0;
}

type MarkerBadgeImages = Record<"reading" | "math" | "locked", HTMLImageElement>;

function drawMarkerFace(canvas: HTMLCanvasElement, marker: StageMarkerData, badges: MarkerBadgeImages) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const center = canvas.width / 2;
	const radius = canvas.width * 0.43;
	const percent = completionPercent(marker);
	const allStarsEarned = marker.maxStars > 0 && marker.stars >= marker.maxStars;
	const badge = badges[marker.unlocked ? marker.region : "locked"];
	if (badge.complete && badge.naturalWidth) ctx.drawImage(badge, 0, 0, canvas.width, canvas.height);
	else {
		ctx.fillStyle = marker.unlocked ? markerColor(marker) : "#705239";
		ctx.beginPath();
		ctx.arc(center, center, radius, 0, Math.PI * 2);
		ctx.fill();
	}
	if (marker.unlocked) {
		const gaugeRadius = canvas.width * 0.445;
		ctx.beginPath();
		ctx.arc(center, center, gaugeRadius, 0, Math.PI * 2);
		ctx.lineWidth = canvas.width * 0.055;
		ctx.strokeStyle = "rgba(46, 35, 37, 0.72)";
		ctx.stroke();
		if (percent > 0) {
			ctx.beginPath();
			ctx.arc(center, center, gaugeRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * percent) / 100);
			ctx.strokeStyle = allStarsEarned ? "#a8ef65" : marker.region === "reading" ? "#ff72c6" : "#71edff";
			ctx.lineWidth = canvas.width * 0.055;
			ctx.lineCap = "round";
			ctx.shadowColor = ctx.strokeStyle;
			ctx.shadowBlur = 7;
			ctx.stroke();
			ctx.shadowBlur = 0;
		}
	}
	if (allStarsEarned) {
		const badgeX = center + canvas.width * 0.27;
		const badgeY = center + canvas.width * 0.27;
		ctx.beginPath();
		ctx.arc(badgeX, badgeY, canvas.width * 0.14, 0, Math.PI * 2);
		ctx.fillStyle = "#76cf39";
		ctx.fill();
		ctx.lineWidth = canvas.width * 0.025;
		ctx.strokeStyle = "#fff8df";
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(badgeX - canvas.width * 0.065, badgeY);
		ctx.lineTo(badgeX - canvas.width * 0.018, badgeY + canvas.width * 0.045);
		ctx.lineTo(badgeX + canvas.width * 0.07, badgeY - canvas.width * 0.055);
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = canvas.width * 0.035;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.stroke();
	}
}

function makeMarkerTitleTexture(lines: string[]) {
	const canvas = document.createElement("canvas");
	canvas.width = 640;
	canvas.height = lines.length === 1 ? 128 : lines.length === 2 ? 176 : 224;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "rgba(34, 21, 48, 0.94)";
		ctx.strokeStyle = "#fff0c8";
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.roundRect(6, 6, 628, canvas.height - 12, 42);
		ctx.fill();
		ctx.stroke();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		lines.forEach((line, index) => {
			ctx.fillStyle = index === 1 && lines.length > 1 ? "#ffe58a" : "#ffffff";
			ctx.font = `bold ${lines.length > 1 && index > 0 ? 30 : 38}px system-ui, sans-serif`;
			ctx.fillText(line, 320, (canvas.height * (index + 0.5)) / lines.length, 570);
		});
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

type SceneStageMarker = {
	group: THREE.Group;
	base: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
	face: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
	ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
	title: THREE.Sprite;
	faceCanvas: HTMLCanvasElement;
	faceTexture: THREE.CanvasTexture;
	titleTexture: THREE.CanvasTexture;
	signature: string;
};

function markerWorldPosition(region: "reading" | "math", index: number) {
	const stops = region === "reading" ? READING_STOPS : MATH_STOPS;
	const [u, v] = stops[index] ?? [0.5, 0.5];
	const x = u * WORLD_WIDTH;
	const z = v * WORLD_DEPTH;
	return new THREE.Vector3(x, terrainHeight(x, z), z);
}

function scatterProps(region: "forest" | "mountain", count: number, seed: number, radius: number, minHeight = 1.15, maxHeight = 3.85): [number, number, number, number, number, number][] {
	let state = seed;
	const random = () => {
		state = (state * 16807) % 2147483647;
		return (state - 1) / 2147483646;
	};
	const landmarks = region === "forest"
		? [[8, 14], [15, 24], [4, 45]]
		: [[45, 10], [56, 8], [55, 43]];
	const placements: [number, number, number, number, number, number][] = [];
	let attempts = 0;
	while (placements.length < count && attempts++ < count * 30) {
		const x = region === "forest" ? 1 + random() * 30 : 38 + random() * 21;
		const z = 1 + random() * 49;
		if (landmarks.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 4.2)) continue;
		// Reserve space around the whole curved trail, not only around its stage pins.
		if (distanceToMissionRoad(x, z) < Math.max(2.5, radius + 0.8)) continue;
		const stops = [...READING_STOPS, ...MATH_STOPS];
		if (stops.some(([u, v]) => Math.hypot(x - u * WORLD_WIDTH, z - v * WORLD_DEPTH) < Math.max(3.2, radius + 0.8))) continue;
		placements.push([x, z, minHeight + random() * (maxHeight - minHeight), random() * Math.PI * 2, 0.72 + random() * 0.7, 0.72 + random() * 0.7]);
	}
	return placements;
}

function createStageMarker(scene: THREE.Scene, data: StageMarkerData, badges: MarkerBadgeImages): SceneStageMarker {
	const group = new THREE.Group();
	group.name = `stageMarker-${data.region}-${data.index}`;
	group.userData.stageMarker = { region: data.region, index: data.index };
	group.position.copy(markerWorldPosition(data.region, data.index));
	const base = new THREE.Mesh(
		new THREE.CylinderGeometry(0.44, 0.52, 0.18, 24),
		new THREE.MeshStandardMaterial({ color: "#9f7448", roughness: 0.72, metalness: 0.18 }),
	);
	base.position.y = 0.09;
	base.castShadow = true;
	base.receiveShadow = true;
	group.add(base);
	const faceCanvas = document.createElement("canvas");
	faceCanvas.width = 256;
	faceCanvas.height = 256;
	drawMarkerFace(faceCanvas, data, badges);
	const faceTexture = new THREE.CanvasTexture(faceCanvas);
	faceTexture.colorSpace = THREE.SRGBColorSpace;
	const face = new THREE.Mesh(
		new THREE.CircleGeometry(0.405, 32),
		new THREE.MeshStandardMaterial({ map: faceTexture, color: "#ffffff", roughness: 0.55, side: THREE.DoubleSide }),
	);
	face.rotation.x = -Math.PI / 2;
	face.position.y = 0.185;
	face.receiveShadow = true;
	group.add(face);
	const ring = new THREE.Mesh(
		new THREE.TorusGeometry(0.455, data.current ? 0.055 : 0.04, 8, 32),
		new THREE.MeshStandardMaterial({ color: data.current ? "#fff0a8" : "#d7ad63", emissive: data.current ? "#7a5010" : "#493014", emissiveIntensity: data.current ? 0.55 : 0.14, roughness: 0.42, metalness: 0.3 }),
	);
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = 0.2;
	ring.castShadow = true;
	group.add(ring);
	const titleTexture = makeMarkerTitleTexture([data.title]);
	const title = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTexture, transparent: true, depthWrite: false }));
	title.scale.set(3.2, 0.64, 1);
	title.position.set(0, data.current ? 4.4 : 1.02, 0);
	title.visible = data.current || data.confirming;
	group.add(title);
	const hitArea = new THREE.Mesh(
		new THREE.CylinderGeometry(0.67, 0.67, 0.4, 16),
		new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
	);
	hitArea.position.y = 0.19;
	group.add(hitArea);
	scene.add(group);
	return { group, base, face, ring, title, faceCanvas, faceTexture, titleTexture, signature: "" };
}

function updateStageMarker(marker: SceneStageMarker, data: StageMarkerData, hovered: boolean, badges: MarkerBadgeImages) {
	const signature = [data.title, data.label, data.stars, data.maxStars, data.unlocked, data.done, data.current, data.confirming, hovered].join("|");
	if (marker.signature === signature) return;
	marker.signature = signature;
	marker.base.material.color.set("#9f7448");
	marker.ring.material.color.set(data.current ? "#fff0a8" : "#d7ad63");
	marker.ring.material.emissive.set(data.current ? "#7a5010" : "#493014");
	marker.ring.scale.setScalar(data.current ? 1.08 : 1);
	drawMarkerFace(marker.faceCanvas, data, badges);
	marker.faceTexture.needsUpdate = true;
	const titleLines = hovered
		? [data.title, `★ ${data.stars}/${data.maxStars} · ${completionPercent(data)}%`, ...(data.confirming ? ["Reclique pour entrer"] : [])]
		: [data.confirming ? "Reclique pour entrer" : data.title];
	const newTitleTexture = makeMarkerTitleTexture(titleLines);
	marker.title.material.map = newTitleTexture;
	marker.title.material.needsUpdate = true;
	const titleHeight = titleLines.length === 1 ? 0.64 : titleLines.length === 2 ? 0.88 : 1.12;
	const isActiveHover = hovered && data.unlocked;
	marker.title.scale.set(isActiveHover ? 3.45 : 3.2, titleHeight * (isActiveHover ? 1.06 : 1), 1);
	marker.title.position.y = data.current ? 4.4 : 1.35;
	marker.title.visible = hovered || data.current || data.confirming;
	marker.titleTexture.dispose();
	marker.titleTexture = newTitleTexture;
}

function terrainHeight(x: number, z: number) {
	const mountainMass = Math.exp(-((x - 50) ** 2) / 190 - ((z - 15) ** 2) / 210) * 2.6;
	const mainPeak = Math.exp(-((x - 52) ** 2) / 34 - ((z - 12) ** 2) / 46) * 2.8;
	const westPeak = Math.exp(-((x - 43) ** 2) / 65 - ((z - 20) ** 2) / 95) * 1.35;
	const forestHill = Math.exp(-((x - 10) ** 2) / 200 - ((z - 19) ** 2) / 250) * 0.72;
	const foothills = Math.exp(-((x - 35) ** 2) / 210 - ((z - 27) ** 2) / 210) * 0.5;
	const ridges = Math.max(0, Math.sin(x * 0.43 + z * 0.11) * Math.cos(z * 0.29 - x * 0.16)) * (x > 34 ? 0.48 : 0.16);
	const rolling = Math.sin(x * 0.23 + z * 0.08) * 0.12 + Math.cos(z * 0.21 - x * 0.1) * 0.1;
	return mountainMass + mainPeak + westPeak + forestHill + foothills + ridges + rolling;
}

function placeModel(scene: THREE.Scene, source: THREE.Group, bounds: THREE.Box3, x: number, z: number, height: number, rotation = 0, stretchX = 1, stretchZ = 1) {
	const model = source.clone(true);
	const size = bounds.getSize(new THREE.Vector3());
	const center = bounds.getCenter(new THREE.Vector3());
	if (!size.y) return;
	model.scale.setScalar(height / size.y);
	model.scale.x *= stretchX;
	model.scale.z *= stretchZ;
	model.rotation.y = rotation;
	model.position.set(x - center.x * model.scale.x, terrainHeight(x, z) - bounds.min.y * model.scale.y, z - center.z * model.scale.z);
	model.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			object.castShadow = true;
			object.receiveShadow = true;
		}
	});
	scene.add(model);
}

function makePathTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext("2d");
	if (!ctx) return new THREE.Texture();
	const soilGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
	soilGradient.addColorStop(0, "#72543b");
	soilGradient.addColorStop(0.18, "#b08a60");
	soilGradient.addColorStop(0.5, "#c2a078");
	soilGradient.addColorStop(0.82, "#a88158");
	soilGradient.addColorStop(1, "#684d36");
	ctx.fillStyle = soilGradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	let seed = 37;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};
	for (let i = 0; i < 2100; i++) {
		const shade = random() > 0.48 ? "#ead0a0" : "#493523";
		ctx.globalAlpha = 0.18 + random() * 0.4;
		ctx.fillStyle = shade;
		const size = 0.8 + random() * 3.2;
		ctx.beginPath();
		ctx.ellipse(random() * 128, random() * 128, size, size * (0.35 + random() * 0.6), random() * 3.14, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}

function makePathRibbon(
	scene: THREE.Scene,
	points: THREE.Vector3[],
	width: number,
	material: THREE.Material,
	heightOffset: number,
	textureScale = 0,
) {
	if (points.length < 2) return;
	const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
	const length = curve.getLength();
	const divisions = Math.max(32, Math.ceil(length * 10));
	const vertices: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	for (let i = 0; i <= divisions; i++) {
		const t = i / divisions;
		const point = curve.getPointAt(t);
		point.y = terrainHeight(point.x, point.z);
		const tangent = curve.getTangentAt(t).setY(0).normalize();
		const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
		vertices.push(point.x + side.x, point.y + heightOffset, point.z + side.z);
		vertices.push(point.x - side.x, point.y + heightOffset, point.z - side.z);
		const u = textureScale ? (length * t) / textureScale : t;
		uvs.push(u, 0, u, 1);
		if (i < divisions) {
			const a = i * 2;
			indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
	geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	const ribbon = new THREE.Mesh(geometry, material);
	ribbon.castShadow = false;
	ribbon.receiveShadow = true;
	scene.add(ribbon);
}

type AssetPlacement = [number, number, number, number?, number?, number?];
type LazyAssetLayer = { url: string; placements: AssetPlacement[]; loaded: Set<number>; pending: Set<number>; loading: boolean; placing: boolean; failed?: boolean; source?: THREE.Group; bounds?: THREE.Box3; onInitialReady?: () => void };

function addVisibleLayerAssets(scene: THREE.Scene, layer: LazyAssetLayer, isNearViewport: (x: number, z: number) => boolean, onInitialLayerReady: () => void, isInitialLayer: boolean, onLoad: () => void, isDisposed: () => boolean) {
	if (isInitialLayer && !layer.onInitialReady) layer.onInitialReady = onInitialLayerReady;
	for (const index of layer.pending) {
		const [x, z] = layer.placements[index];
		if (!isNearViewport(x, z)) layer.pending.delete(index);
	}
	layer.placements.forEach(([x, z], index) => {
		if (!layer.loaded.has(index) && isNearViewport(x, z)) layer.pending.add(index);
	});
	const placeNextBatch = () => {
		if (isDisposed() || layer.placing) return;
		if (!layer.pending.size && layer.source) {
			if (layer.onInitialReady) {
				const done = layer.onInitialReady;
				layer.onInitialReady = undefined;
				done();
			}
			return;
		}
		const source = layer.source;
		const bounds = layer.bounds;
		if (!source || !bounds) return;
		layer.placing = true;
		const indices = [...layer.pending].slice(0, 8);
		indices.forEach((index) => {
			layer.pending.delete(index);
			const [x, z, height, rotation = 0, stretchX = 1, stretchZ = 1] = layer.placements[index];
			placeModel(scene, source, bounds, x, z, height, rotation, stretchX, stretchZ);
			layer.loaded.add(index);
		});
		onLoad();
		if (layer.pending.size) requestAnimationFrame(() => { layer.placing = false; placeNextBatch(); });
		else { layer.placing = false; placeNextBatch(); }
	};
	placeNextBatch();
	if (layer.source || layer.loading || layer.failed || !layer.pending.size) return;
	layer.loading = true;
	const finishInitialLayer = () => {
		if (!layer.onInitialReady) return;
		const done = layer.onInitialReady;
		layer.onInitialReady = undefined;
		done();
	};
	const timeout = window.setTimeout(() => {
		if (!layer.loading) return;
		layer.loading = false;
		layer.failed = true;
		finishInitialLayer();
	}, 10000);
	new GLTFLoader().load(layer.url, (gltf) => {
		window.clearTimeout(timeout);
		if (isDisposed()) return;
		layer.source = gltf.scene;
		layer.bounds = new THREE.Box3().setFromObject(gltf.scene);
		layer.loading = false;
		layer.failed = false;
		placeNextBatch();
	}, undefined, () => {
		window.clearTimeout(timeout);
		layer.loading = false;
		layer.failed = true;
		finishInitialLayer();
	});
}

function makeTerrain(scene: THREE.Scene, forestGround: THREE.Texture, mountainGround: THREE.Texture) {
	const water = new THREE.Mesh(
		new THREE.PlaneGeometry(WORLD_WIDTH + 30, WORLD_DEPTH + 30),
		new THREE.MeshBasicMaterial({ color: "#172b37" }),
	);
	water.rotation.x = -Math.PI / 2;
	water.position.set(WORLD_WIDTH / 2, -0.8, WORLD_DEPTH / 2);
	scene.add(water);

	const geometry = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH, 128, 112);
	const positions = geometry.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < positions.count; i++) {
		const lx = positions.getX(i);
		const ly = positions.getY(i);
		const x = lx + WORLD_WIDTH / 2;
		const z = WORLD_DEPTH / 2 - ly;
		positions.setXYZ(i, x, terrainHeight(x, z), z);
	}
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	forestGround.repeat.set(4, 4);
	mountainGround.repeat.set(4, 4);
	const terrainMaterial = new THREE.MeshStandardMaterial({
		color: "#ffffff",
		map: forestGround,
		emissive: "#182018",
		emissiveIntensity: 0.18,
		roughness: 1,
		side: THREE.DoubleSide,
	});
	terrainMaterial.onBeforeCompile = (shader) => {
		shader.uniforms.forestGroundMap = { value: forestGround };
		shader.uniforms.mountainGroundMap = { value: mountainGround };
		shader.vertexShader = shader.vertexShader.replace(
			"#include <common>",
			"#include <common>\nvarying vec3 vTerrainWorldPosition;",
		);
		shader.vertexShader = shader.vertexShader.replace(
			"#include <begin_vertex>",
			"#include <begin_vertex>\nvTerrainWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
		);
		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <common>",
			"#include <common>\nuniform sampler2D forestGroundMap;\nuniform sampler2D mountainGroundMap;\nvarying vec3 vTerrainWorldPosition;",
		);
		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <map_fragment>",
			"#include <map_fragment>\nvec2 biomeUv = vTerrainWorldPosition.xz * 0.14;\nvec3 forestColor = texture2D(forestGroundMap, biomeUv).rgb;\nvec3 mountainColor = texture2D(mountainGroundMap, biomeUv).rgb;\nfloat biomeEdge = 34.0 + (vTerrainWorldPosition.z - 26.0) * 0.22 + sin(vTerrainWorldPosition.z * 0.22) * 1.4;\nfloat mountainBlend = smoothstep(biomeEdge - 3.0, biomeEdge + 3.0, vTerrainWorldPosition.x);\ndiffuseColor.rgb = mix(forestColor, mountainColor, mountainBlend) * 1.45;",
		);
	};
	terrainMaterial.customProgramCacheKey = () => "biome-terrain-blend-v3";
	const terrain = new THREE.Mesh(geometry, terrainMaterial);
	terrain.receiveShadow = true;
	terrain.castShadow = false;
	scene.add(terrain);
	const roadTexture = makePathTexture();
	const roadSurface = new THREE.MeshStandardMaterial({ color: "#ffffff", map: roadTexture, roughness: 1 });
	const readingPath = readingRoadPoints.map(({ x, z }) => new THREE.Vector3(x, terrainHeight(x, z), z));
	const mathPath = mathRoadPoints.map(({ x, z }) => new THREE.Vector3(x, terrainHeight(x, z), z));
	const paths = [readingPath, mathPath];
	for (const points of paths) {
		makePathRibbon(scene, points, 0.9, roadSurface, 0.09, 2.0);
	}
	return terrain;
}

export function IsoWorldScene({
	containerRef,
	stageMarkers,
	hero,
	onStageClick,
	onLoadProgress,
}: {
	containerRef: React.RefObject<HTMLDivElement | null>;
	stageMarkers: StageMarkerData[];
	hero: "hana" | "yuki" | "momo";
	onStageClick: (region: "reading" | "math", index: number) => void;
	onLoadProgress: (progress: MapLoadProgress) => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const stageMarkersRef = useRef(stageMarkers);
	stageMarkersRef.current = stageMarkers;
	const heroRef = useRef(hero);
	heroRef.current = hero;
	const stageClickRef = useRef(onStageClick);
	stageClickRef.current = onStageClick;
	const loadProgressRef = useRef(onLoadProgress);
	loadProgressRef.current = onLoadProgress;
	const refreshRef = useRef<(() => void) | null>(null);
	useEffect(() => { refreshRef.current?.(); });
	useEffect(() => {
		const host = hostRef.current;
		const scroll = containerRef.current;
		if (!host || !scroll) return;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color("#172b37");
		scene.add(new THREE.HemisphereLight("#ffe9d8", "#52604e", 0.95));
		const sun = new THREE.DirectionalLight("#fff1d6", 3.2);
		sun.position.set(-12, 30, 14);
		sun.target.position.set(WORLD_WIDTH / 2, 0, WORLD_DEPTH / 2);
		sun.castShadow = true;
		sun.shadow.intensity = 0.65;
		sun.shadow.mapSize.set(4096, 4096);
		sun.shadow.camera.left = -42;
		sun.shadow.camera.right = 42;
		sun.shadow.camera.top = 42;
		sun.shadow.camera.bottom = -42;
		sun.shadow.camera.near = 1;
		sun.shadow.camera.far = 100;
		sun.shadow.camera.updateProjectionMatrix();
		sun.shadow.bias = -0.00015;
		sun.shadow.normalBias = 0.02;
		scene.add(sun);
		scene.add(sun.target);
		const forestGlow = new THREE.PointLight("#f06ab2", 0.35, 24, 2);
		forestGlow.position.set(13, 8, 20);
		scene.add(forestGlow);
		const mountainGlow = new THREE.PointLight("#6edff2", 0.45, 28, 2);
		mountainGlow.position.set(49, 9, 14);
		scene.add(mountainGlow);
		const textureLoader = new THREE.TextureLoader();
		let forestGround = new THREE.Texture();
		let mountainGround = new THREE.Texture();
		const forestGroundReady = new Promise<void>((resolve) => {
			const texture = textureLoader.load("/textures/forest-ground.png", () => resolve(), undefined, () => resolve());
			forestGround = texture;
		});
		const mountainGroundReady = new Promise<void>((resolve) => {
			const texture = textureLoader.load("/textures/mountain-ground.png", () => resolve(), undefined, () => resolve());
			mountainGround = texture;
		});
		for (const texture of [forestGround, mountainGround]) {
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = 8;
		}
		makeTerrain(scene, forestGround, mountainGround);
		const markerBadges: MarkerBadgeImages = {
			reading: new Image(),
			math: new Image(),
			locked: new Image(),
		};
		markerBadges.reading.src = readingMarkerBadge;
		markerBadges.math.src = mathMarkerBadge;
		markerBadges.locked.src = lockedMarkerBadge;
		const markerObjects = stageMarkersRef.current.map((marker) => createStageMarker(scene, marker, markerBadges));
		const heroAnchor = new THREE.Group();
		scene.add(heroAnchor);
		const initialLayers = new Set<LazyAssetLayer>();
		let progressInitialized = false;
		let progressLoaded = 0;
		let progressTotal = 6;
		const publishProgress = () => loadProgressRef.current({ loaded: progressLoaded, total: progressTotal, complete: progressLoaded >= progressTotal });
		const completeProgressItem = () => {
			if (disposed || progressLoaded >= progressTotal) return;
			progressLoaded += 1;
			publishProgress();
		};
		loadProgressRef.current({ loaded: 0, total: progressTotal, complete: false });
		let loadedHero = "";
		let disposed = false;
		let heroPositionInitialized = false;
		let heroDestinationKey = "";
		let heroAnimationFrame = 0;
		let heroAnimationStartedAt = 0;
		const heroAnimationStart = new THREE.Vector3();
		const heroAnimationTarget = new THREE.Vector3();
		const animateHeroMovement = () => {
			heroAnimationFrame = 0;
			if (disposed) return;
			const progress = Math.min((performance.now() - heroAnimationStartedAt) / 720, 1);
			const easedProgress = progress * progress * (3 - 2 * progress);
			heroAnchor.position.lerpVectors(heroAnimationStart, heroAnimationTarget, easedProgress);
			heroAnchor.position.y += Math.sin(progress * Math.PI) * 0.32;
			renderer.render(scene, camera);
			if (progress < 1) heroAnimationFrame = requestAnimationFrame(animateHeroMovement);
		};
		const loadHero = (heroKey: "hana" | "yuki" | "momo") => {
			if (loadedHero === heroKey) return;
			loadedHero = heroKey;
			heroAnchor.clear();
			new GLTFLoader().load(`/models/heroes/hero-${heroKey}.glb`, (gltf) => {
				if (disposed) return;
				const bounds = new THREE.Box3().setFromObject(gltf.scene);
				const size = bounds.getSize(new THREE.Vector3());
				const center = bounds.getCenter(new THREE.Vector3());
				if (size.y <= 0) { completeProgressItem(); return; }
				const model = gltf.scene.clone(true);
				const scale = 2.25 / size.y;
				model.scale.setScalar(scale);
				model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
				model.traverse((object) => {
					if (object instanceof THREE.Mesh) {
						object.castShadow = true;
						object.receiveShadow = true;
					}
				});
				heroAnchor.add(model);
				completeProgressItem();
				render();
			}, undefined, completeProgressItem);
		};
		const assetLayers = new Map<string, LazyAssetLayer>();
		const addLayer = (url: string, placements: AssetPlacement[]) => {
			const layer = assetLayers.get(url) ?? { url, placements: [], loaded: new Set<number>(), pending: new Set<number>(), loading: false, placing: false };
			layer.placements.push(...placements);
			assetLayers.set(url, layer);
		};
		const one = (x: number, z: number, height: number, rotation = 0): AssetPlacement[] => [[x, z, height, rotation]];
		// Each model type is requested only when at least one of its instances is near the viewport.
		addLayer("/models/reading-tree.glb", one(2, 12, 4.4));
		addLayer("/models/reading-bookstone.glb", one(4, 9, 2.8));
		addLayer("/models/math-abacus.glb", one(45, 10, 3.1));
		addLayer("/models/math-crystals.glb", one(56, 8, 3.6));
		addLayer("/models/forest-tree.glb", scatterProps("forest", 46, 71, 3.0));
		// A dense grove sits between the close reading stages and the trail loops around it on both sides.
		addLayer("/models/forest-tree.glb", [
			[2, 18, 3.8, 0.2, 1.05, 1.05], [4, 20, 3.7, -0.4, 1.05, 1.05],
			[3, 23, 3.8, 0.5, 1.05, 1.1], [5, 25, 3.6, -0.2, 1.05, 1],
		]);
		addLayer("/models/forest-understory.glb", [
			[2.5, 20.5, 1.05, 0.3, 1.05, 1.05], [4.5, 22.5, 1.1, 1.1, 1.05, 1.05],
			[3, 26, 1.05, -0.4, 1.05, 1.05],
		]);
		addLayer("/models/mountain-fir.glb", scatterProps("mountain", 32, 197, 3.0));
		addLayer("/models/map-forest-flower-patch.glb", [
			...scatterProps("forest", 48, 7541, 2.0, 0.8, 1.5),
			...scatterProps("mountain", 16, 7549, 2.2, 0.7, 1.25),
		]);
		addLayer("/models/forest-understory.glb", [
			...scatterProps("forest", 78, 431, 2.25),
			...scatterProps("mountain", 34, 839, 2.1),
		]);
		addLayer("/models/mossy-boulders.glb", [
			...scatterProps("forest", 20, 1301, 3.2),
			...scatterProps("mountain", 30, 1307, 3.1),
		]);
		addLayer("/models/storybook-cottage.glb", one(4, 45, 3.2));
		addLayer("/models/mountain-observatory.glb", one(55, 43, 3.8));
		// This TRELLIS.2 segment has an open channel along local Z. Orient its open
		// ends along the winding course and overlap neighboring banks slightly.
		const creekPlacements: [number, number, number, number, number, number][] = [];
		const creekCurve = new THREE.CatmullRomCurve3(MAP_RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
		const riverBankPlacements: [number, number, number, number, number, number][] = [];
		for (let distance = 5; distance < creekCurve.getLength(); distance += 7.5) {
			const t = distance / creekCurve.getLength();
			const point = creekCurve.getPointAt(t);
			const tangent = creekCurve.getTangentAt(t);
			const bankOffset = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(1.35);
			const rotation = Math.atan2(-tangent.z, tangent.x);
			for (const side of [-1, 1]) {
				const x = point.x + bankOffset.x * side;
				const z = point.z + bankOffset.z * side;
				if (MAP_BRIDGE_POSITIONS.some(([bridgeX, bridgeZ]) => Math.hypot(x - bridgeX, z - bridgeZ) < 3.2)) continue;
				riverBankPlacements.push([x, z, 1.15, rotation + (side * 0.15), 1.1, 0.9]);
			}
		}
		addLayer("/models/map-riverbank-rock-cluster.glb", riverBankPlacements);
		// The reading trail crosses the creek on the southern loop; this bridge
		// keeps that route walkable and sits directly in the 3D scene.
		for (const [bridgeX, bridgeZ] of MAP_BRIDGE_POSITIONS) {
			addLayer("/models/map-woodland-footbridge.glb", one(bridgeX, bridgeZ, 2.7, 0.48));
		}
		for (let distance = 0; distance <= creekCurve.getLength(); distance += 4.1) {
			const point = creekCurve.getPointAt(distance / creekCurve.getLength());
			const tangent = creekCurve.getTangentAt(distance / creekCurve.getLength());
			creekPlacements.push([point.x, point.z, 0.75, Math.atan2(tangent.x, tangent.z), 1, 0.55]);
		}
		addLayer("/models/creek-open-segment-v2.glb", creekPlacements);

		const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFShadowMap;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		renderer.domElement.dataset.mapScene = "true";
		renderer.domElement.style.touchAction = "pan-x pan-y";
		renderer.domElement.style.cursor = "grab";
		host.appendChild(renderer.domElement);
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let pointerDown: { x: number; y: number; left: number; top: number } | null = null;
		let dragged = false;
		let hoveredMarker: SceneStageMarker | null = null;
		const stateForMarker = (marker: SceneStageMarker) => {
			const stage = marker.group.userData.stageMarker as { region: "reading" | "math"; index: number };
			return stageMarkersRef.current.find((item) => item.region === stage.region && item.index === stage.index);
		};
		const setHoveredMarker = (next: SceneStageMarker | null) => {
			if (hoveredMarker === next) return;
			if (hoveredMarker) {
				hoveredMarker.group.scale.setScalar(1);
				hoveredMarker.ring.material.emissiveIntensity = 0.2;
			}
			hoveredMarker = next;
			const hoveredData = hoveredMarker ? stateForMarker(hoveredMarker) : undefined;
			if (hoveredMarker && hoveredData?.unlocked) {
				hoveredMarker.group.scale.setScalar(1.12);
				hoveredMarker.ring.material.emissiveIntensity = 1.15;
			}
			renderer.domElement.style.cursor = hoveredData?.unlocked ? "pointer" : "grab";
			refreshRef.current?.();
		};
		const findMarkerAtPointer = (clientX: number, clientY: number) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
			raycaster.setFromCamera(pointer, camera);
			const hit = raycaster.intersectObjects(markerObjects.map((marker) => marker.group), true)[0]?.object;
			let markerGroup: THREE.Object3D | null = hit ?? null;
			while (markerGroup && !markerGroup.userData.stageMarker) markerGroup = markerGroup.parent;
			const stage = markerGroup?.userData.stageMarker as { region: "reading" | "math"; index: number } | undefined;
			if (!stage) return null;
			return markerObjects.find((marker) => marker.group === markerGroup) ?? null;
		};
		const onCanvasPointerDown = (event: PointerEvent) => {
			if (event.pointerType !== "mouse" || event.button !== 0) return;
			pointerDown = { x: event.clientX, y: event.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
			dragged = false;
			renderer.domElement.style.cursor = "grabbing";
			renderer.domElement.setPointerCapture(event.pointerId);
		};
		const onCanvasPointerMove = (event: PointerEvent) => {
			if (pointerDown) {
				const dx = event.clientX - pointerDown.x;
				const dy = event.clientY - pointerDown.y;
				if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
				if (dragged) {
					setHoveredMarker(null);
					renderer.domElement.style.cursor = "grabbing";
					scroll.scrollLeft = pointerDown.left - dx;
					scroll.scrollTop = pointerDown.top - dy;
				}
				return;
			}
			setHoveredMarker(findMarkerAtPointer(event.clientX, event.clientY));
		};
		const onCanvasPointerUp = (event: PointerEvent) => {
			pointerDown = null;
			setHoveredMarker(findMarkerAtPointer(event.clientX, event.clientY));
		};
		const onCanvasPointerLeave = () => {
			if (pointerDown) return;
			setHoveredMarker(null);
		};
		const onCanvasClick = (event: MouseEvent) => {
			if (dragged) { dragged = false; return; }
			const marker = findMarkerAtPointer(event.clientX, event.clientY);
			const stage = marker?.group.userData.stageMarker as { region: "reading" | "math"; index: number } | undefined;
			if (!stage) return;
			const state = stageMarkersRef.current.find((item) => item.region === stage.region && item.index === stage.index);
			if (state?.unlocked) stageClickRef.current(stage.region, stage.index);
		};
		renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
		renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
		renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
		renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
		renderer.domElement.addEventListener("pointerleave", onCanvasPointerLeave);
		renderer.domElement.addEventListener("click", onCanvasClick);

		const viewportBounds = { centerX: 0, centerZ: 0, halfWidth: 0, halfDepth: 0 };
		const render = () => {
			const width = host.clientWidth || window.innerWidth;
			const height = host.clientHeight || window.innerHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			const centerX = (scroll.scrollLeft + width / 2) / WORLD_SCALE;
			const centerZ = (scroll.scrollTop + height / 2) / (WORLD_SCALE * WORLD_PITCH);
			// A perspective lens adds depth to the diorama while keeping the
			// selected stage at the center of the viewport during map scrolling.
			camera.position.set(centerX, 21.5, centerZ + 16);
			camera.lookAt(centerX, 0, centerZ);
			viewportBounds.centerX = centerX;
			viewportBounds.centerZ = centerZ;
			viewportBounds.halfWidth = width / (2 * WORLD_SCALE) + 3.5;
			viewportBounds.halfDepth = height / (2 * WORLD_SCALE * WORLD_PITCH) + 4.5;
			const isNearViewport = (x: number, z: number) => Math.abs(x - viewportBounds.centerX) <= viewportBounds.halfWidth && Math.abs(z - viewportBounds.centerZ) <= viewportBounds.halfDepth;
			if (!progressInitialized) {
				for (const layer of assetLayers.values()) {
					if (layer.placements.some(([x, z]) => isNearViewport(x, z))) initialLayers.add(layer);
				}
				progressTotal += initialLayers.size;
				progressInitialized = true;
				publishProgress();
				const renderAfterTextureReady = () => {
					render();
					requestAnimationFrame(() => requestAnimationFrame(completeProgressItem));
				};
				void forestGroundReady.then(renderAfterTextureReady);
				void mountainGroundReady.then(renderAfterTextureReady);
			}
			for (const layer of assetLayers.values()) {
				addVisibleLayerAssets(scene, layer, isNearViewport, () => {
					if (initialLayers.delete(layer)) completeProgressItem();
				}, initialLayers.has(layer), render, () => disposed);
			}
			for (const marker of markerObjects) {
				const data = stateForMarker(marker);
				if (data) updateStageMarker(marker, data, marker === hoveredMarker, markerBadges);
			}
			loadHero(heroRef.current);
			const current = stageMarkersRef.current.find((marker) => marker.current);
			if (current) {
				const destinationKey = `${current.region}-${current.index}`;
				const heroPosition = markerWorldPosition(current.region, current.index);
				heroPosition.y += 0.22;
				heroAnchor.visible = true;
				if (!heroPositionInitialized) {
					heroAnchor.position.copy(heroPosition);
					heroPositionInitialized = true;
					heroDestinationKey = destinationKey;
				} else if (destinationKey !== heroDestinationKey) {
					heroDestinationKey = destinationKey;
					heroAnimationStart.copy(heroAnchor.position);
					heroAnimationTarget.copy(heroPosition);
					heroAnimationStartedAt = performance.now();
					if (heroAnimationFrame) cancelAnimationFrame(heroAnimationFrame);
					heroAnimationFrame = requestAnimationFrame(animateHeroMovement);
				}
			} else heroAnchor.visible = false;
			renderer.setSize(width, height, false);
			renderer.render(scene, camera);
		};
		const refreshMarkerBadges = () => {
			if (disposed) return;
			for (const marker of markerObjects) marker.signature = "";
			render();
		};
		Object.values(markerBadges).forEach((image) => {
			const onBadgeReady = () => { refreshMarkerBadges(); completeProgressItem(); };
			image.addEventListener("load", onBadgeReady, { once: true });
			image.addEventListener("error", onBadgeReady, { once: true });
			if (image.complete) onBadgeReady();
		});
		refreshRef.current = render;
		const observer = new ResizeObserver(render);
		observer.observe(host);
		window.addEventListener("resize", render);
		scroll.addEventListener("scroll", render, { passive: true });
		render();
		return () => {
			disposed = true;
			if (heroAnimationFrame) cancelAnimationFrame(heroAnimationFrame);
			if (refreshRef.current === render) refreshRef.current = null;
			observer.disconnect();
			window.removeEventListener("resize", render);
			scroll.removeEventListener("scroll", render);
			renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
			renderer.domElement.removeEventListener("pointermove", onCanvasPointerMove);
			renderer.domElement.removeEventListener("pointerup", onCanvasPointerUp);
			renderer.domElement.removeEventListener("pointercancel", onCanvasPointerUp);
			renderer.domElement.removeEventListener("pointerleave", onCanvasPointerLeave);
			renderer.domElement.removeEventListener("click", onCanvasClick);
			for (const marker of markerObjects) {
				marker.faceTexture.dispose();
				marker.titleTexture.dispose();
			}
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					if (Array.isArray(object.material)) object.material.forEach((material) => { material.dispose(); });
					else object.material.dispose();
				}
			});
			forestGround.dispose();
			mountainGround.dispose();
			renderer.dispose();
			host.removeChild(renderer.domElement);
		};
	}, [containerRef]);

	return <div ref={hostRef} aria-hidden="true" className="sticky left-0 top-0 z-0 h-screen w-screen overflow-hidden pointer-events-auto" />;
}
