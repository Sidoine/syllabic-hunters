import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { ChapterStage, Speaker } from "../data/chapter";
import { heroSceneSpeaker } from "../data/dialogue";
import type { HeroId } from "../lib/storage";
import { assetUrl } from "../lib/assets";
const readingMarkerBadge = assetUrl("final/ui/map-marker-reading.webp");
const mathMarkerBadge = assetUrl("final/ui/map-marker-math.webp");
const lockedMarkerBadge = assetUrl("final/ui/map-marker-locked.webp");
import {
  MAP_BRIDGE_POSITIONS,
  MAP_BRIDGE_ROTATION,
  MAP_DIRECTION_SIGN_POSITION,
  MAP_LANDMARKS,
  MAP_LARGE_ASSETS,
  MAP_RIVER_POINTS,
  MAP_SHARED_START,
  WORLD_WIDTH,
  WORLD_DEPTH,
  MAP_ERASER_RADIUS,
  WORLD_SCALE,
  WORLD_PITCH,
  MATH_STOPS,
  mountainBlendAt,
  READING_STOPS,
  type MapLandmarkKey,
  type MapLandmarkLayout,
} from "./map-layout";

const MAP_SCENE_HMR_EVENT = "map-scene-hmr-update";
type MapSceneHmrData = { revision?: number };
const mapSceneHmrData = import.meta.hot?.data as MapSceneHmrData | undefined;
if (mapSceneHmrData) mapSceneHmrData.revision ??= 0;

function subscribeToMapSceneHmr(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MAP_SCENE_HMR_EVENT, listener);
  return () => window.removeEventListener(MAP_SCENE_HMR_EVENT, listener);
}

function getMapSceneHmrRevision() {
  return mapSceneHmrData?.revision ?? 0;
}

if (import.meta.hot && import.meta.env.DEV) {
  const handleMapSceneHotUpdate = (payload: {
    updates: { path: string; acceptedPath: string }[];
  }) => {
    if (
      !payload.updates.some(({ path, acceptedPath }) =>
        `${path} ${acceptedPath}`.includes("IsoWorldScene.tsx"),
      )
    )
      return;
    const data = import.meta.hot?.data as MapSceneHmrData | undefined;
    if (!data) return;
    data.revision = (data.revision ?? 0) + 1;
    console.info(
      `[map-hmr] rebuilding Three.js scene revision=${data.revision} cliffInset=${CLIFF_SPLINE_INSET}`,
    );
    window.dispatchEvent(new Event(MAP_SCENE_HMR_EVENT));
  };
  import.meta.hot.on("vite:afterUpdate", handleMapSceneHotUpdate);
  import.meta.hot.dispose((data) => {
    data.revision = mapSceneHmrData?.revision ?? 0;
    import.meta.hot?.off("vite:afterUpdate", handleMapSceneHotUpdate);
  });
}

const EDITABLE_ASSETS: Record<string, keyof typeof MAP_LANDMARKS> = {
  "/models/reading-tree.glb": "readingTree",
  "/models/map-blossom-tree.glb": "readingBlossom",
  "/models/storybook-reading-arch.glb": "readingArch",
  "/models/storybook-tree-library.glb": "readingTreeLibrary",
  "/models/reading-bookstone.glb": "readingBookstone",
  "/models/reading-mushroom-cluster.glb": "readingMushrooms",
  "/models/math-abacus.glb": "mathAbacus",
  "/models/math-crystals.glb": "mathCrystals",
  "/models/storybook-cottage.glb": "storybookCottage",
  "/models/mountain-observatory.glb": "mountainObservatory",
};
const ERASABLE_SCENERY_ASSETS = new Set([
  "/models/forest-tree.glb",
  "/models/mountain-fir.glb",
  "/models/map-forest-flower-patch.glb",
  "/models/mossy-boulders.glb",
  "/models/forest-understory.glb",
  "/models/map-riverbank-rock-cluster.glb",
  "/models/mountain-wildflowers.glb",
  "/models/mountain-rock-cluster.glb",
  "/models/mountain-cushion-shrub.glb",
]);
const INSTANCED_SCENERY_ASSETS = new Set([
  "/models/forest-tree.glb",
  "/models/mountain-fir.glb",
  "/models/map-forest-flower-patch.glb",
  "/models/mossy-boulders.glb",
  "/models/forest-understory.glb",
  "/models/mountain-wildflowers.glb",
  "/models/mountain-rock-cluster.glb",
  "/models/mountain-cushion-shrub.glb",
]);

const worldPath = (stops: readonly (readonly [number, number])[]) =>
  stops.map(([x, y]) => {
    const worldX = x * WORLD_WIDTH;
    const worldZ = y * WORLD_DEPTH;
    return new THREE.Vector3(worldX, 0, worldZ);
  });
const sharedMapStart = new THREE.Vector3(
  MAP_SHARED_START[0],
  0,
  MAP_SHARED_START[1],
);
const readingRoadPoints = [sharedMapStart, ...worldPath(READING_STOPS)];
const mathRoadPoints = [sharedMapStart.clone(), ...worldPath(MATH_STOPS)];
const missionRoadCurves = [
  new THREE.CatmullRomCurve3(readingRoadPoints, false, "centripetal"),
  new THREE.CatmullRomCurve3(mathRoadPoints, false, "centripetal"),
];
const missionRoadSamples = missionRoadCurves.flatMap((curve) =>
  curve.getPoints(240),
);
const readingRoadSamples = missionRoadCurves[0].getPoints(48);

function distanceToMissionRoad(x: number, z: number) {
  let closest = Infinity;
  for (const point of missionRoadSamples)
    closest = Math.min(closest, Math.hypot(x - point.x, z - point.z));
  return closest;
}

export type StageMarkerData = {
  region: "reading" | "math" | "intro";
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

const MAP_FOG_WIDTH = 272;
const MAP_FOG_HEIGHT = 128;
const MAP_FOG_REACH_SCALE = 2 / 3;
type MapFogState = {
  texture: THREE.DataTexture;
  clarity: Uint8Array;
  clouds: Float32Array;
  enabled: { value: number };
  signature: string;
};

function hashNoise(x: number, z: number) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x: number, z: number, frequency: number) {
  const px = x * frequency;
  const pz = z * frequency;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = px - ix;
  const fz = pz - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = THREE.MathUtils.lerp(
    hashNoise(ix, iz),
    hashNoise(ix + 1, iz),
    sx,
  );
  const bottom = THREE.MathUtils.lerp(
    hashNoise(ix, iz + 1),
    hashNoise(ix + 1, iz + 1),
    sx,
  );
  return THREE.MathUtils.lerp(top, bottom, sz);
}

function createMapFogState(): MapFogState {
  const pixels = MAP_FOG_WIDTH * MAP_FOG_HEIGHT;
  const data = new Uint8Array(pixels * 4);
  const clarity = new Uint8Array(pixels);
  const clouds = new Float32Array(pixels);
  for (let y = 0; y < MAP_FOG_HEIGHT; y++) {
    for (let x = 0; x < MAP_FOG_WIDTH; x++) {
      const worldX = (x / (MAP_FOG_WIDTH - 1)) * WORLD_WIDTH;
      const worldZ = (y / (MAP_FOG_HEIGHT - 1)) * WORLD_DEPTH;
      const index = y * MAP_FOG_WIDTH + x;
      clouds[index] =
        smoothNoise(worldX, worldZ, 0.11) * 0.56 +
        smoothNoise(worldX, worldZ, 0.27) * 0.29 +
        smoothNoise(worldX, worldZ, 0.63) * 0.15;
      data[index * 4 + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(
    data,
    MAP_FOG_WIDTH,
    MAP_FOG_HEIGHT,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = "procedural-world-fog-mask";
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, clarity, clouds, enabled: { value: 1 }, signature: "" };
}

function mapFogSmoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function updateMapFogMask(
  state: MapFogState,
  stageMarkers: StageMarkerData[],
  stageLayout: { reading: number[][]; math: number[][] } | undefined,
  sharedStart: readonly [number, number],
) {
  const unlockedByRegion = (region: "reading" | "math") =>
    stageMarkers
      .filter((marker) => marker.region === region && marker.unlocked)
      .reduce((highest, marker) => Math.max(highest, marker.index), -1);
  const unlockedReading = unlockedByRegion("reading");
  const unlockedMath = unlockedByRegion("math");
  const readingStops =
    stageLayout?.reading ??
    READING_STOPS.map(([x, z]) => [x * WORLD_WIDTH, z * WORLD_DEPTH]);
  const mathStops =
    stageLayout?.math ??
    MATH_STOPS.map(([x, z]) => [x * WORLD_WIDTH, z * WORLD_DEPTH]);
  const fullyUnlocked =
    unlockedReading >= readingStops.length - 1 &&
    unlockedMath >= mathStops.length - 1;
  const segments: [number, number, number, number][] = [];
  const hubs: [number, number][] = [[sharedStart[0], sharedStart[1]]];
  for (const [unlockedIndex, stops] of [
    [unlockedReading, readingStops],
    [unlockedMath, mathStops],
  ] as const) {
    if (unlockedIndex < 0) continue;
    const controls = [
      [sharedStart[0], sharedStart[1]],
      ...stops.slice(0, unlockedIndex + 1),
    ];
    for (const point of controls.slice(1)) hubs.push([point[0], point[1]]);
    const curve = new THREE.CatmullRomCurve3(
      controls.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
    );
    const samples = Math.max(2, Math.ceil(curve.getLength() / 2.2));
    const points = curve.getPoints(samples);
    for (let i = 0; i < points.length - 1; i++)
      segments.push([
        points[i].x,
        points[i].z,
        points[i + 1].x,
        points[i + 1].z,
      ]);
  }
  const data = state.texture.image.data as Uint8Array;
  for (let y = 0; y < MAP_FOG_HEIGHT; y++) {
    const worldZ = (y / (MAP_FOG_HEIGHT - 1)) * WORLD_DEPTH;
    for (let x = 0; x < MAP_FOG_WIDTH; x++) {
      const worldX = (x / (MAP_FOG_WIDTH - 1)) * WORLD_WIDTH;
      const index = y * MAP_FOG_WIDTH + x;
      const cloud = state.clouds[index];
      let visibility = fullyUnlocked ? 1 : 0;
      if (!fullyUnlocked) {
        const startDistance = Math.hypot(
          worldX - sharedStart[0],
          worldZ - sharedStart[1],
        );
        visibility = Math.max(
          visibility,
          1 -
            mapFogSmoothstep(
              (10 + cloud * 2) * MAP_FOG_REACH_SCALE,
              (22 + cloud * 4) * MAP_FOG_REACH_SCALE,
              startDistance,
            ),
        );
        for (let hubIndex = 1; hubIndex < hubs.length; hubIndex++) {
          const [hx, hz] = hubs[hubIndex];
          const distance = Math.hypot(worldX - hx, worldZ - hz);
          visibility = Math.max(
            visibility,
            1 -
              mapFogSmoothstep(
                (8 + cloud * 2) * MAP_FOG_REACH_SCALE,
                (17 + cloud * 3) * MAP_FOG_REACH_SCALE,
                distance,
              ),
          );
        }
        for (const [x1, z1, x2, z2] of segments) {
          const dx = x2 - x1;
          const dz = z2 - z1;
          const lengthSquared = dx * dx + dz * dz || 1;
          const t = THREE.MathUtils.clamp(
            ((worldX - x1) * dx + (worldZ - z1) * dz) / lengthSquared,
            0,
            1,
          );
          const distance = Math.hypot(
            worldX - (x1 + dx * t),
            worldZ - (z1 + dz * t),
          );
          visibility = Math.max(
            visibility,
            1 -
              mapFogSmoothstep(
                (5 + cloud * 2) * MAP_FOG_REACH_SCALE,
                (12 + cloud * 3) * MAP_FOG_REACH_SCALE,
                distance,
              ),
          );
        }
      }
      const clarityByte = Math.round(
        THREE.MathUtils.clamp(visibility, 0, 1) * 255,
      );
      state.clarity[index] = clarityByte;
      data[index * 4] = clarityByte;
      data[index * 4 + 1] = Math.round(cloud * 255);
      data[index * 4 + 2] = 0;
    }
  }
  state.texture.needsUpdate = true;
}

function applyMapFogToMaterial(material: THREE.Material, state: MapFogState) {
  if (
    material.userData.mapFogState === state ||
    !(
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshBasicMaterial ||
      material instanceof THREE.MeshLambertMaterial ||
      material instanceof THREE.MeshPhongMaterial
    )
  )
    return;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.uniforms.mapFogMask = { value: state.texture };
    shader.uniforms.mapFogEnabled = state.enabled;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vMapFogWorldPosition;",
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
				vec4 mapFogLocalPosition = vec4(transformed, 1.0);
				#ifdef USE_BATCHING
					mapFogLocalPosition = batchingMatrix * mapFogLocalPosition;
				#endif
				#ifdef USE_INSTANCING
					mapFogLocalPosition = instanceMatrix * mapFogLocalPosition;
				#endif
				vMapFogWorldPosition = (modelMatrix * mapFogLocalPosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D mapFogMask;\nuniform float mapFogEnabled;\nvarying vec3 vMapFogWorldPosition;",
      )
      .replace(
        "#include <opaque_fragment>",
        `
				float fogClarity = texture2D(mapFogMask, vMapFogWorldPosition.xz / vec2(${WORLD_WIDTH.toFixed(1)}, ${WORLD_DEPTH.toFixed(1)})).r;
				float fogCloudNoise = texture2D(mapFogMask, vMapFogWorldPosition.xz / vec2(${WORLD_WIDTH.toFixed(1)}, ${WORLD_DEPTH.toFixed(1)})).g;
				float fogObscurity = (1.0 - fogClarity) * mapFogEnabled;
				float fogGrayAmount = smoothstep(0.06, 0.52, fogObscurity);
				float fogFullAmount = smoothstep(0.48, 0.94, fogObscurity);
				float fogLuminance = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
				vec3 fogGrayColor = mix(outgoingLight, vec3(fogLuminance), 0.68);
				vec3 fogCloudColor = mix(vec3(0.36, 0.43, 0.46), vec3(0.69, 0.75, 0.77), fogCloudNoise);
				vec3 fogTarget = mix(fogGrayColor, fogCloudColor, fogFullAmount);
				outgoingLight = mix(outgoingLight, fogTarget, max(fogGrayAmount, fogFullAmount));
				diffuseColor.a = ${material.userData.mapSplineAlphaFade ? "diffuseColor.a" : "mix(diffuseColor.a, 1.0, max(fogGrayAmount, fogFullAmount))"};
				#include <opaque_fragment>
			`,
      );
  };
  material.customProgramCacheKey = () =>
    `${previousProgramCacheKey()}|map-fog-v1`;
  material.userData.mapFogState = state;
  material.needsUpdate = true;
}

function applyMapFogToObject(object: THREE.Object3D, state: MapFogState) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) applyMapFogToMaterial(material, state);
  });
}

export type MapLoadProgress = {
  loaded: number;
  total: number;
  complete: boolean;
};
export type MapSplineType = "river" | "fence" | "cliff" | "talus";
export type MapSplineElement = {
  id: string;
  type: MapSplineType;
  points: [number, number][];
};
export type MapEditorSelection = {
  kind: "asset" | "stage" | "splinePoint" | "start";
  index: number;
  region?: "reading" | "math";
  key?: MapLandmarkKey;
  splineId?: string;
};
export type MapPaintMode = "select" | "brush" | "spline" | "asset" | "erase";
export type MapDecorationKind = "tree" | "flower" | "rock" | "bush";
export type MapDecoration = {
  id: string;
  kind: MapDecorationKind;
  x: number;
  z: number;
  modelUrl: string;
  scale: number;
  rotation: number;
};

function markerColor(marker: StageMarkerData) {
  if (!marker.unlocked) return "#8a6240";
  if (marker.current) return "#dfaa35";
  return marker.region === "math"
    ? "#28b9d4"
    : marker.region === "intro"
      ? "#ffd23f"
      : "#e347a8";
}

function completionPercent(marker: StageMarkerData) {
  return marker.maxStars > 0
    ? Math.round(Math.min(marker.stars / marker.maxStars, 1) * 100)
    : 0;
}

type MarkerBadgeImages = Record<
  "reading" | "math" | "locked",
  HTMLImageElement
>;

function drawMarkerFace(
  canvas: HTMLCanvasElement,
  marker: StageMarkerData,
  badges: MarkerBadgeImages,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const center = canvas.width / 2;
  const radius = canvas.width * 0.43;
  const percent = completionPercent(marker);
  const allStarsEarned = marker.maxStars > 0 && marker.stars >= marker.maxStars;
  const badge =
    badges[
      marker.unlocked
        ? marker.region === "math"
          ? "math"
          : "reading"
        : "locked"
    ];
  if (marker.region === "intro") {
    const gradient = ctx.createRadialGradient(
      center * 0.75,
      center * 0.7,
      canvas.width * 0.04,
      center,
      center,
      center,
    );
    gradient.addColorStop(0, "#fff6b0");
    gradient.addColorStop(1, "#e89b28");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff4c7";
    ctx.lineWidth = canvas.width * 0.035;
    ctx.stroke();
    ctx.fillStyle = "#8f4e23";
    ctx.font = `bold ${canvas.width * 0.52}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", center, center + canvas.width * 0.015);
  } else if (badge.complete && badge.naturalWidth)
    ctx.drawImage(badge, 0, 0, canvas.width, canvas.height);
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
      ctx.arc(
        center,
        center,
        gaugeRadius,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * percent) / 100,
      );
      ctx.strokeStyle = allStarsEarned
        ? "#a8ef65"
        : marker.region === "math"
          ? "#71edff"
          : "#ff72c6";
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
      ctx.fillText(
        line,
        320,
        (canvas.height * (index + 0.5)) / lines.length,
        570,
      );
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

function markerWorldPosition(
  region: "reading" | "math" | "intro",
  index: number,
  stageLayout?: { reading: number[][]; math: number[][] },
  sharedStart: readonly [number, number] = MAP_SHARED_START,
  reliefProfile: readonly TerrainReliefMound[] = [],
) {
  if (region === "intro") {
    const x = sharedStart[0];
    const z = sharedStart[1];
    return new THREE.Vector3(x, terrainHeight(x, z, reliefProfile), z);
  }
  const stops = region === "reading" ? READING_STOPS : MATH_STOPS;
  const edited = stageLayout?.[region][index];
  const [x, z] = edited ?? [
    (stops[index]?.[0] ?? 0.5) * WORLD_WIDTH,
    (stops[index]?.[1] ?? 0.5) * WORLD_DEPTH,
  ];
  return new THREE.Vector3(x, terrainHeight(x, z, reliefProfile), z);
}

function scatterProps(
  region: "forest" | "mountain",
  count: number,
  seed: number,
  radius: number,
  minHeight = 1.15,
  maxHeight = 3.85,
): [number, number, number, number, number, number][] {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const landmarks =
    region === "forest"
      ? [
          MAP_LANDMARKS.readingTree,
          MAP_LANDMARKS.readingBlossom,
          MAP_LANDMARKS.readingArch,
          MAP_LANDMARKS.readingTreeLibrary,
          MAP_LANDMARKS.readingBookstone,
          MAP_LANDMARKS.storybookCottage,
          MAP_LANDMARKS.readingMushrooms,
        ]
      : [
          MAP_LANDMARKS.mathAbacus,
          MAP_LANDMARKS.mathCrystals,
          MAP_LANDMARKS.mountainObservatory,
        ];
  const placements: [number, number, number, number, number, number][] = [];
  let attempts = 0;
  while (placements.length < count && attempts++ < count * 30) {
    const x = region === "forest" ? 1 + random() * 55 : 70 + random() * 58;
    const z = 1 + random() * 49;
    if (landmarks.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 4.2))
      continue;
    // Reserve space around the whole curved trail, not only around its stage pins.
    if (distanceToMissionRoad(x, z) < Math.max(2.5, radius + 0.8)) continue;
    const stops = [...READING_STOPS, ...MATH_STOPS];
    if (
      stops.some(
        ([u, v]) =>
          Math.hypot(x - u * WORLD_WIDTH, z - v * WORLD_DEPTH) <
          Math.max(3.2, radius + 0.8),
      )
    )
      continue;
    placements.push([
      x,
      z,
      minHeight + random() * (maxHeight - minHeight),
      random() * Math.PI * 2,
      0.72 + random() * 0.7,
      0.72 + random() * 0.7,
    ]);
  }
  return placements;
}

function createStageMarker(
  scene: THREE.Scene,
  data: StageMarkerData,
  badges: MarkerBadgeImages,
  stageLayout?: { reading: number[][]; math: number[][] },
  sharedStart: readonly [number, number] = MAP_SHARED_START,
  reliefProfile: readonly TerrainReliefMound[] = [],
): SceneStageMarker {
  const group = new THREE.Group();
  group.name = `stageMarker-${data.region}-${data.index}`;
  group.userData.stageMarker = { region: data.region, index: data.index };
  group.position.copy(
    markerWorldPosition(
      data.region,
      data.index,
      stageLayout,
      sharedStart,
      reliefProfile,
    ),
  );
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.52, 0.18, 24),
    new THREE.MeshStandardMaterial({
      color: "#9f7448",
      roughness: 0.72,
      metalness: 0.18,
    }),
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
    new THREE.MeshStandardMaterial({
      map: faceTexture,
      color: "#ffffff",
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.185;
  face.receiveShadow = true;
  group.add(face);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.455, data.current ? 0.055 : 0.04, 8, 32),
    new THREE.MeshStandardMaterial({
      color: data.current ? "#fff0a8" : "#d7ad63",
      emissive: data.current ? "#7a5010" : "#493014",
      emissiveIntensity: data.current ? 0.55 : 0.14,
      roughness: 0.42,
      metalness: 0.3,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  ring.castShadow = true;
  group.add(ring);
  const titleTexture = makeMarkerTitleTexture([data.title]);
  const title = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: titleTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  title.renderOrder = 1000;
  title.scale.set(3.2, 0.64, 1);
  title.position.set(0, data.current ? 4.4 : 1.02, 0);
  title.visible = data.current || data.confirming;
  group.add(title);
  const hitArea = new THREE.Mesh(
    new THREE.CylinderGeometry(0.67, 0.67, 0.4, 16),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
    }),
  );
  hitArea.position.y = 0.19;
  group.add(hitArea);
  scene.add(group);
  return {
    group,
    base,
    face,
    ring,
    title,
    faceCanvas,
    faceTexture,
    titleTexture,
    signature: "",
  };
}

function updateStageMarker(
  marker: SceneStageMarker,
  data: StageMarkerData,
  hovered: boolean,
  badges: MarkerBadgeImages,
) {
  const signature = [
    data.title,
    data.label,
    data.stars,
    data.maxStars,
    data.unlocked,
    data.done,
    data.current,
    data.confirming,
    hovered,
  ].join("|");
  if (marker.signature === signature) return;
  marker.signature = signature;
  marker.base.material.color.set("#9f7448");
  marker.ring.material.color.set(data.current ? "#fff0a8" : "#d7ad63");
  marker.ring.material.emissive.set(data.current ? "#7a5010" : "#493014");
  marker.ring.scale.setScalar(data.current ? 1.08 : 1);
  drawMarkerFace(marker.faceCanvas, data, badges);
  marker.faceTexture.needsUpdate = true;
  const titleLines = hovered
    ? [
        data.title,
        ...(data.region === "intro"
          ? ["Histoire d’introduction"]
          : [
              `${data.stars}/${data.maxStars} étoiles · ${completionPercent(data)}%`,
            ]),
        ...(data.confirming ? ["Reclique pour entrer"] : []),
      ]
    : [data.confirming ? "Reclique pour entrer" : data.title];
  const newTitleTexture = makeMarkerTitleTexture(titleLines);
  marker.title.material.map = newTitleTexture;
  marker.title.material.needsUpdate = true;
  const titleHeight =
    titleLines.length === 1 ? 0.64 : titleLines.length === 2 ? 0.88 : 1.12;
  const isActiveHover = hovered && data.unlocked;
  marker.title.scale.set(
    isActiveHover ? 3.45 : 3.2,
    titleHeight * (isActiveHover ? 1.06 : 1),
    1,
  );
  marker.title.position.y = data.current ? 4.4 : 1.35;
  marker.title.visible = hovered || data.current || data.confirming;
  marker.titleTexture.dispose();
  marker.titleTexture = newTitleTexture;
}

type TerrainReliefMound = {
  x: number;
  z: number;
  tangentX: number;
  tangentZ: number;
  alongRadius: number;
  sideRadius: number;
  height: number;
  rampWidth: number;
  sideSign: number;
};

function buildTerrainReliefProfile(
  splineElements: readonly MapSplineElement[],
): TerrainReliefMound[] {
  const profile: TerrainReliefMound[] = [];
  for (const element of splineElements) {
    if (
      (element.type !== "cliff" && element.type !== "talus") ||
      element.points.length < 2
    )
      continue;
    const curve = new THREE.CatmullRomCurve3(
      element.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
    );
    const totalLength = curve.getLength();
    if (totalLength < 0.001) continue;
    const isCliff = element.type === "cliff";
    const height = isCliff ? 3.1 : 1.55;
    // Keep the cliff edge sharply cut; the opposite side still fades over
    // the much wider sideRadius below.
    const rampWidth = isCliff ? 0.55 : 2.3;
    const sideSign = element.type === "cliff" ? -1 : 1;
    const alongRadius = isCliff ? 3.8 : Math.min(totalLength * 0.5, 4.5);
    const sideRadius = rampWidth + (isCliff ? 9 : 4.2);
    const sampleDistances = isCliff
      ? Array.from({ length: Math.ceil(totalLength / 2.5) + 1 }, (_, index) =>
          Math.min(index * 2.5, totalLength),
        )
      : [totalLength * 0.5];
    for (const distance of sampleDistances) {
      const t = distance / totalLength;
      const center = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const endFade = isCliff
        ? splineEndTaper(Math.min(distance, totalLength - distance), 4.5)
        : 1;
      profile.push({
        x: center.x,
        z: center.z,
        tangentX: tangent.x,
        tangentZ: tangent.z,
        alongRadius,
        // A chain of overlapping local mounds follows the spline. The wider
        // back slope and long side falloff avoid a narrow ridge or a map-wide wave.
        sideRadius,
        height: height * endFade,
        rampWidth,
        sideSign,
      });
    }
  }
  return profile;
}

function terrainHeight(
  x: number,
  z: number,
  reliefProfile: readonly TerrainReliefMound[] = [],
) {
  const mountainMass =
    Math.exp(-((x - 103) ** 2) / 520 - (z - 18) ** 2 / 250) * 2.6;
  const mainPeak = Math.exp(-((x - 105) ** 2) / 95 - (z - 13) ** 2 / 52) * 2.8;
  const westPeak =
    Math.exp(-((x - 82) ** 2) / 170 - (z - 22) ** 2 / 110) * 1.35;
  const forestHill =
    Math.exp(-((x - 20) ** 2) / 360 - (z - 20) ** 2 / 250) * 0.72;
  const foothills =
    Math.exp(-((x - 61) ** 2) / 330 - (z - 31) ** 2 / 230) * 0.5;
  const ridges =
    Math.max(0, Math.sin(x * 0.43 + z * 0.11) * Math.cos(z * 0.29 - x * 0.16)) *
    (x > 62 ? 0.48 : 0.16);
  const rolling =
    Math.sin(x * 0.23 + z * 0.08) * 0.12 + Math.cos(z * 0.21 - x * 0.1) * 0.1;
  const baseHeight =
    mountainMass +
    mainPeak +
    westPeak +
    forestHill +
    foothills +
    ridges +
    rolling;
  let reliefHeight = 0;
  for (const mound of reliefProfile) {
    const offsetX = x - mound.x;
    const offsetZ = z - mound.z;
    const along = offsetX * mound.tangentX + offsetZ * mound.tangentZ;
    const signedSide =
      (mound.tangentX * offsetZ - mound.tangentZ * offsetX) * mound.sideSign;
    const alongDistance = Math.abs(along);
    if (
      signedSide <= 0 ||
      alongDistance >= mound.alongRadius ||
      signedSide >= mound.sideRadius
    )
      continue;
    const alongFade =
      1 -
      THREE.MathUtils.smoothstep(
        alongDistance,
        mound.alongRadius * 0.55,
        mound.alongRadius,
      );
    const ramp = THREE.MathUtils.smoothstep(signedSide, 0, mound.rampWidth);
    const sideFade =
      1 -
      THREE.MathUtils.smoothstep(
        signedSide,
        mound.rampWidth + 0.35,
        mound.sideRadius,
      );
    reliefHeight = Math.max(
      reliefHeight,
      mound.height * alongFade * ramp * sideFade,
    );
  }
  return baseHeight + reliefHeight;
}

function updateTerrainSplineRelief(
  terrain: THREE.Mesh,
  splineElements: readonly MapSplineElement[],
) {
  const profile = buildTerrainReliefProfile(splineElements);
  const positions = terrain.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, terrainHeight(x, z, profile));
  }
  positions.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.geometry.computeBoundingBox();
  terrain.geometry.computeBoundingSphere();
  return profile;
}

function styleMountainCreekMaterial(material: THREE.Material) {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  const styled = material.clone();
  styled.metalness = 0.04;
  styled.roughness = 0.34;
  styled.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\nfloat riverWaterMask = smoothstep(0.035, 0.14, diffuseColor.b - diffuseColor.r) * smoothstep(0.02, 0.12, diffuseColor.g - diffuseColor.r);\nvec3 riverWaterBase = diffuseColor.rgb;\nvec3 riverWaterBright = min(riverWaterBase * vec3(0.82, 1.38, 1.62) + vec3(0.0, 0.025, 0.045), vec3(1.0));\ndiffuseColor.rgb = mix(riverWaterBase, riverWaterBright, riverWaterMask);",
    );
  };
  styled.customProgramCacheKey = () => "mountain-creek-water-v1";
  return styled;
}

function placeModel(
  scene: THREE.Scene,
  source: THREE.Group,
  bounds: THREE.Box3,
  x: number,
  z: number,
  height: number,
  rotation = 0,
  stretchX = 1,
  stretchZ = 1,
  mountainCreek = false,
  castShadow = true,
  cliffSegment = false,
) {
  const model = source.clone(true);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!size.y) return;
  if (cliffSegment) {
    // The generated cliff is nearly flat in local Y (0.14 units) but about
    // one unit long in local Z. Isotropic height normalization made it ~22
    // units long, burying the repeated pieces in the terrain.
    model.scale.set(
      1.6 / size.x,
      height / size.y,
      CLIFF_SPLINE_SEGMENT_LENGTH / size.z,
    );
    model.scale.x *= stretchX;
    model.scale.z *= stretchZ;
  } else {
    model.scale.setScalar(height / size.y);
    model.scale.x *= stretchX;
    model.scale.z *= stretchZ;
  }
  model.rotation.y = rotation;
  const reliefProfile = scene.userData.terrainReliefProfile as
    | readonly TerrainReliefMound[]
    | undefined;
  model.position.set(
    x - center.x * model.scale.x,
    terrainHeight(x, z, reliefProfile) - bounds.min.y * model.scale.y,
    z - center.z * model.scale.z,
  );
  if (cliffSegment) {
    const offset = cliffSplineOffset(rotation);
    model.position.x += offset.x;
    model.position.z += offset.z;
  }
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (mountainCreek) {
        object.material = Array.isArray(object.material)
          ? object.material.map(styleMountainCreekMaterial)
          : styleMountainCreekMaterial(object.material);
      }
      object.castShadow = castShadow;
      object.receiveShadow = true;
    }
  });
  const fogState = scene.userData.mapFogState as MapFogState | undefined;
  if (fogState) applyMapFogToObject(model, fogState);
  scene.add(model);
  return model;
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
    ctx.ellipse(
      random() * 128,
      random() * 128,
      size,
      size * (0.35 + random() * 0.6),
      random() * 3.14,
      0,
      Math.PI * 2,
    );
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
  if (points.length < 2) return null;
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
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(
      width / 2,
    );
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
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.castShadow = false;
  ribbon.receiveShadow = true;
  scene.add(ribbon);
  return ribbon;
}

type AssetPlacement = [number, number, number, number?, number?, number?];
type SplineSceneryTargets = Record<string, AssetPlacement[]>;

function splineEndTaper(distanceToEnd: number, fadeLength = 4) {
  const t = THREE.MathUtils.clamp(distanceToEnd / fadeLength, 0, 1);
  return t * t * (3 - 2 * t);
}

const CLIFF_SPLINE_URL = "/models/spline-cliff-segment.glb";
const TALUS_SPLINE_URL = "/models/spline-talus-segment.glb";

// Positive values move the visible half toward the raised side of the spline.
const CLIFF_SPLINE_INSET = 1; // Positive values embed the visible half into the raised edge.
const CLIFF_SPLINE_SPACING = 4.5;
const CLIFF_SPLINE_SEGMENT_LENGTH = 7.2;

function cliffSplineOffset(rotation: number) {
  return {
    x: Math.cos(rotation) * CLIFF_SPLINE_INSET,
    z: -Math.sin(rotation) * CLIFF_SPLINE_INSET,
  };
}

function clipSplineHalfGeometry(
  mesh: THREE.Mesh,
  forcedLongAxis?: 0 | 1,
  keepPositiveHalf = false,
) {
  const source = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  const position = source.getAttribute("position");
  if (!position || position.count < 3) return;
  const bounds = new THREE.Box3().setFromBufferAttribute(
    position as THREE.BufferAttribute,
  );
  const size = bounds.getSize(new THREE.Vector3());
  const longAxis = forcedLongAxis ?? (size.x >= size.z ? 0 : 1);
  const widthAxis = longAxis === 0 ? 2 : 0;
  const lengthPositionAxis = longAxis === 0 ? 0 : 2;
  const widthMin = widthAxis === 0 ? bounds.min.x : bounds.min.z;
  const widthMid =
    ((widthAxis === 0 ? bounds.max.x : bounds.max.z) + widthMin) * 0.5;
  const longMin = longAxis === 0 ? bounds.min.x : bounds.min.z;
  const longMax = longAxis === 0 ? bounds.max.x : bounds.max.z;
  const halfWidth = Math.max(widthMid - widthMin, 0.0001);
  const fadeWidth = halfWidth * 0.82;
  const fadeLength = Math.max((longMax - longMin) * 0.16, 0.0001);
  const sourceAttributes = Object.entries(source.attributes) as [
    string,
    THREE.BufferAttribute,
  ][];
  const outputAttributes = new Map(
    sourceAttributes
      .filter(([name]) => name !== "color")
      .map(([name]) => [name, [] as number[]]),
  );
  const outputColors: number[] = [];
  const readVertex = (index: number) =>
    Object.fromEntries(
      sourceAttributes
        .filter(([name]) => name !== "color")
        .map(([name, attribute]) => [
          name,
          Array.from({ length: attribute.itemSize }, (_, component) =>
            attribute.getComponent(index, component),
          ),
        ]),
    );
  const interpolate = (
    a: Record<string, number[]>,
    b: Record<string, number[]>,
    t: number,
  ) =>
    Object.fromEntries(
      [...outputAttributes.keys()].map((name) => [
        name,
        a[name].map(
          (value, component) => value + (b[name][component] - value) * t,
        ),
      ]),
    );
  const widthOf = (vertex: Record<string, number[]>) =>
    vertex.position[widthAxis];
  const clipTriangle = (vertices: Record<string, number[]>[]) => {
    const clipped: Record<string, number[]>[] = [];
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index];
      const b = vertices[(index + 1) % vertices.length];
      const aInside = keepPositiveHalf
        ? widthOf(a) >= widthMid
        : widthOf(a) <= widthMid;
      const bInside = keepPositiveHalf
        ? widthOf(b) >= widthMid
        : widthOf(b) <= widthMid;
      if (aInside && bInside) clipped.push(b);
      else if (aInside && !bInside)
        clipped.push(
          interpolate(
            a,
            b,
            (widthMid - widthOf(a)) / (widthOf(b) - widthOf(a)),
          ),
        );
      else if (!aInside && bInside) {
        clipped.push(
          interpolate(
            a,
            b,
            (widthMid - widthOf(a)) / (widthOf(b) - widthOf(a)),
          ),
        );
        clipped.push(b);
      }
    }
    return clipped;
  };
  for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
    const polygon = clipTriangle([
      readVertex(triangle),
      readVertex(triangle + 1),
      readVertex(triangle + 2),
    ]);
    for (let fan = 1; fan + 1 < polygon.length; fan++) {
      for (const vertex of [polygon[0], polygon[fan], polygon[fan + 1]]) {
        for (const [name, values] of outputAttributes)
          values.push(...vertex[name]);
        const along = vertex.position[lengthPositionAxis];
        const across = keepPositiveHalf
          ? widthOf(vertex) - widthMid
          : widthMid - widthOf(vertex);
        const endDistance = Math.max(
          0,
          Math.min(along - longMin, longMax - along),
        );
        const sideAlpha = THREE.MathUtils.smoothstep(across, 0, fadeWidth);
        const endAlpha = THREE.MathUtils.smoothstep(endDistance, 0, fadeLength);
        outputColors.push(1, 1, 1, sideAlpha * endAlpha);
      }
    }
  }
  const clipped = new THREE.BufferGeometry();
  for (const [name, values] of outputAttributes) {
    const itemSize = source.getAttribute(name).itemSize;
    clipped.setAttribute(
      name,
      new THREE.Float32BufferAttribute(values, itemSize),
    );
  }
  clipped.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(outputColors, 4),
  );
  clipped.computeBoundingBox();
  clipped.computeBoundingSphere();
  mesh.geometry = clipped;
}

function prepareSplineMaterial(material: THREE.Material) {
  if (
    !(material instanceof THREE.MeshStandardMaterial) ||
    material.userData.mapSplineAlphaFade
  )
    return material;
  const styled = material.clone();
  styled.transparent = true;
  styled.depthWrite = false;
  styled.side = THREE.DoubleSide;
  styled.vertexColors = true;
  styled.userData.mapSplineAlphaFade = true;
  return styled;
}

function prepareSplineSegment(source: THREE.Group, url: string) {
  if (url !== CLIFF_SPLINE_URL && url !== TALUS_SPLINE_URL) return;
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    clipSplineHalfGeometry(object, url === CLIFF_SPLINE_URL ? 1 : undefined);
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const prepared = materials.map(prepareSplineMaterial);
    object.material = Array.isArray(object.material) ? prepared : prepared[0];
    if (url === CLIFF_SPLINE_URL) {
      object.castShadow = false;
      object.frustumCulled = false;
    }
  });
}

function buildSplineSceneryTargets(
  splineElements: readonly MapSplineElement[],
): SplineSceneryTargets {
  const targets: SplineSceneryTargets = {
    "/models/creek-open-segment-v2.glb": [],
    "/models/mountain-creek-segment.glb": [],
    "/models/map-riverbank-rock-cluster.glb": [],
    "/models/mountain-rock-cluster.glb": [],
    "/models/mossy-boulders.glb": [],
    "/models/spline-fence-segment.glb": [],
    "/models/spline-cliff-segment.glb": [],
    "/models/spline-talus-segment.glb": [],
  };
  for (const element of splineElements) {
    if (element.points.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(
      element.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
    );
    const length = curve.getLength();
    if (length < 0.001) continue;
    if (
      element.type === "fence" ||
      element.type === "cliff" ||
      element.type === "talus"
    ) {
      const spacing =
        element.type === "cliff"
          ? CLIFF_SPLINE_SPACING
          : element.type === "talus"
            ? 3.2
            : 2.8;
      const modelUrl =
        element.type === "fence"
          ? "/models/spline-fence-segment.glb"
          : element.type === "cliff"
            ? CLIFF_SPLINE_URL
            : TALUS_SPLINE_URL;
      const baseHeight =
        element.type === "fence" ? 1.35 : element.type === "cliff" ? 3.1 : 1.55;
      const segmentCount = Math.max(1, Math.ceil(length / spacing));
      const segmentSpacing = length / segmentCount;
      const distances =
        element.type === "cliff"
          ? Array.from(
              { length: segmentCount + 1 },
              (_, index) => segmentSpacing * index,
            )
          : [0];
      if (element.type !== "cliff") {
        for (let distance = spacing; distance < length; distance += spacing)
          distances.push(distance);
        distances.push(length);
      }
      for (const distance of distances) {
        const t = distance / length;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const taper =
          element.type === "cliff" || element.type === "talus"
            ? splineEndTaper(Math.min(distance, length - distance))
            : 1;
        const fade = Math.max(0.08, taper);
        const rotation =
          Math.atan2(-tangent.z, tangent.x) +
          (element.type === "cliff" || element.type === "fence"
            ? Math.PI / 2
            : 0);
        const stretchX = element.type === "cliff" ? 1 : fade;
        const stretchZ =
          element.type === "cliff" ? segmentSpacing / spacing : 1;
        targets[modelUrl].push([
          point.x,
          point.z,
          baseHeight * fade,
          rotation,
          stretchX,
          stretchZ,
        ]);
      }
      continue;
    }
    if (element.type !== "river") continue;
    for (let distance = 0; distance <= length; distance += 4.1) {
      const t = distance / length;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const placement: AssetPlacement = [
        point.x,
        point.z,
        0.75,
        Math.atan2(tangent.x, tangent.z),
        1,
        0.55,
      ];
      const url =
        mountainBlendAt(point.x, point.z) >= 0.5
          ? "/models/mountain-creek-segment.glb"
          : "/models/creek-open-segment-v2.glb";
      targets[url].push(placement);
    }
    for (let distance = 5; distance < length; distance += 7.5) {
      const t = distance / length;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      if (mountainBlendAt(point.x, point.z) >= 0.5) continue;
      const bankOffset = new THREE.Vector3(
        -tangent.z,
        0,
        tangent.x,
      ).multiplyScalar(1.35);
      const rotation = Math.atan2(-tangent.z, tangent.x);
      for (const side of [-1, 1]) {
        const x = point.x + bankOffset.x * side;
        const z = point.z + bankOffset.z * side;
        if (
          !MAP_BRIDGE_POSITIONS.some(
            ([bridgeX, bridgeZ]) => Math.hypot(x - bridgeX, z - bridgeZ) < 3.2,
          )
        ) {
          targets["/models/map-riverbank-rock-cluster.glb"].push([
            x,
            z,
            1.15,
            rotation + side * 0.15,
            1.1,
            0.9,
          ]);
        }
      }
    }
  }
  return targets;
}

type InstancedChunk = { meshes: THREE.InstancedMesh[]; indices: number[] };
type LazyAssetLayer = {
  url: string;
  placements: AssetPlacement[];
  models: Map<number, THREE.Group>;
  loaded: Set<number>;
  pending: Set<number>;
  loading: boolean;
  placing: boolean;
  failed?: boolean;
  source?: THREE.Group;
  bounds?: THREE.Box3;
  instancedSourceMeshes?: { mesh: THREE.Mesh; relativeMatrix: THREE.Matrix4 }[];
  instancedChunks?: Map<string, InstancedChunk>;
  placementStartedAt?: number;
  onInitialReady?: () => void;
};

function reportGLTFLoad(url: string, startedAt: number, failed = false) {
  if (!import.meta.env.DEV) return;
  const completedAt = performance.now();
  const resourceUrl = new URL(url, window.location.href).href;
  const resource = performance
    .getEntriesByName(resourceUrl)
    .filter(
      (entry): entry is PerformanceResourceTiming =>
        entry.entryType === "resource",
    )
    .filter(
      (entry) =>
        entry.startTime >= startedAt && entry.responseEnd <= completedAt,
    )
    .at(-1);
  console.info(`[map-load] ${failed ? "failed" : "parse"}: ${url}`, {
    loaderMs: Math.round(completedAt - startedAt),
    networkMs: resource ? Math.round(resource.duration) : null,
    afterResponseMs: resource
      ? Math.round(completedAt - resource.responseEnd)
      : null,
  });
}

function setInstanceVisible(model: THREE.Group, visible: boolean) {
  model.visible = visible;
  const targets = model.userData.instanceTargets as
    | { mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }[]
    | undefined;
  if (!targets) return;
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const { mesh, index, matrix } of targets) {
    mesh.setMatrixAt(index, visible ? matrix : zeroMatrix);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

function buildInstancedLayer(
  scene: THREE.Scene,
  layer: LazyAssetLayer,
  isNearViewport: (x: number, z: number) => boolean,
  erasedIds: ReadonlySet<string>,
) {
  const source = layer.source;
  const bounds = layer.bounds;
  if (!source || !bounds) return 0;
  let chunks = layer.instancedChunks;
  if (!chunks) {
    chunks = new Map();
    layer.instancedChunks = chunks;
  }
  const neededKeys = new Set<string>();
  layer.placements.forEach(([x, z], index) => {
    if (!layer.loaded.has(index) && isNearViewport(x, z))
      neededKeys.add(`${Math.floor(x / 32)}:${Math.floor(z / 32)}`);
  });
  if (!neededKeys.size) return 0;
  let sourceMeshes = layer.instancedSourceMeshes;
  if (!sourceMeshes) {
    source.updateMatrixWorld(true);
    const inverseSourceRoot = source.matrixWorld.clone().invert();
    sourceMeshes = [];
    source.traverse((object) => {
      if (object instanceof THREE.Mesh)
        sourceMeshes?.push({
          mesh: object,
          relativeMatrix: inverseSourceRoot
            .clone()
            .multiply(object.matrixWorld),
        });
    });
    layer.instancedSourceMeshes = sourceMeshes;
  }
  if (!sourceMeshes.length) return 0;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const buckets = new Map<string, number[]>();
  layer.placements.forEach(([x, z], index) => {
    const key = `${Math.floor(x / 32)}:${Math.floor(z / 32)}`;
    if (!neededKeys.has(key)) return;
    const indices = buckets.get(key) ?? [];
    indices.push(index);
    buckets.set(key, indices);
  });
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  let placedCount = 0;
  for (const [key, indices] of buckets) {
    const meshes = sourceMeshes.map(({ mesh: sourceMesh }) => {
      const fogState = scene.userData.mapFogState as MapFogState | undefined;
      if (fogState) {
        const materials = Array.isArray(sourceMesh.material)
          ? sourceMesh.material
          : [sourceMesh.material];
        for (const material of materials)
          applyMapFogToMaterial(material, fogState);
      }
      const instanced = new THREE.InstancedMesh(
        sourceMesh.geometry,
        sourceMesh.material,
        indices.length,
      );
      instanced.castShadow = layer.url !== CLIFF_SPLINE_URL;
      instanced.receiveShadow = true;
      instanced.frustumCulled = true;
      return instanced;
    });
    const chunk: InstancedChunk = { meshes, indices };
    chunks.set(key, chunk);
    indices.forEach((placementIndex, localIndex) => {
      const [x, z, height = 1, rotation = 0, stretchX = 1, stretchZ = 1] =
        layer.placements[placementIndex];
      const unitScale = height / (size.y || 1);
      const scale = new THREE.Vector3(
        unitScale * stretchX,
        unitScale,
        unitScale * stretchZ,
      );
      const reliefProfile = scene.userData.terrainReliefProfile as
        | readonly TerrainReliefMound[]
        | undefined;
      const position = new THREE.Vector3(
        x - center.x * scale.x,
        terrainHeight(x, z, reliefProfile) - bounds.min.y * scale.y,
        z - center.z * scale.z,
      );
      const rootMatrix = new THREE.Matrix4().compose(
        position,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
        scale,
      );
      const proxy = new THREE.Group();
      proxy.position.set(x, terrainHeight(x, z, reliefProfile), z);
      proxy.userData.mapX = x;
      proxy.userData.mapZ = z;
      if (ERASABLE_SCENERY_ASSETS.has(layer.url))
        proxy.userData.mapErasableId = `scenery:${layer.url}:${placementIndex}`;
      const erasedId = proxy.userData.mapErasableId as string | undefined;
      const erased = Boolean(erasedId && erasedIds.has(erasedId));
      const targets: {
        mesh: THREE.InstancedMesh;
        index: number;
        matrix: THREE.Matrix4;
      }[] = [];
      sourceMeshes.forEach(({ relativeMatrix }, meshIndex) => {
        const matrix = rootMatrix.clone().multiply(relativeMatrix);
        const instanced = meshes[meshIndex];
        instanced.setMatrixAt(localIndex, erased ? zeroMatrix : matrix);
        targets.push({ mesh: instanced, index: localIndex, matrix });
      });
      proxy.userData.instanceTargets = targets;
      proxy.visible = !erased;
      layer.models.set(placementIndex, proxy);
      layer.loaded.add(placementIndex);
      placedCount += 1;
    });
    for (const instanced of meshes) {
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      scene.add(instanced);
    }
    const chunkVisible = indices.some((index) => {
      const [x, z] = layer.placements[index];
      return isNearViewport(x, z);
    });
    for (const instanced of meshes) instanced.visible = chunkVisible;
  }
  return placedCount;
}

function addVisibleLayerAssets(
  scene: THREE.Scene,
  layer: LazyAssetLayer,
  isNearViewport: (x: number, z: number) => boolean,
  onInitialLayerReady: () => void,
  isInitialLayer: boolean,
  onLoad: () => void,
  isDisposed: () => boolean,
  loader: GLTFLoader,
  erasedIds: ReadonlySet<string>,
) {
  if (isInitialLayer && !layer.onInitialReady)
    layer.onInitialReady = onInitialLayerReady;
  if (layer.instancedChunks) {
    const placementStartedAt = performance.now();
    const placedCount = buildInstancedLayer(
      scene,
      layer,
      isNearViewport,
      erasedIds,
    );
    if (placedCount && import.meta.env.DEV)
      console.info(`[map-load] placement: ${layer.url}`, {
        durationMs: Math.round(performance.now() - placementStartedAt),
        instances: placedCount,
      });
    for (const chunk of layer.instancedChunks.values()) {
      const visible = chunk.indices.some((index) => {
        const [x, z] = layer.placements[index];
        return isNearViewport(x, z);
      });
      for (const mesh of chunk.meshes) mesh.visible = visible;
    }
    return;
  }
  for (const index of layer.pending) {
    const [x, z] = layer.placements[index];
    if (!isNearViewport(x, z)) layer.pending.delete(index);
  }
  layer.placements.forEach(([x, z], index) => {
    if (!layer.loaded.has(index) && isNearViewport(x, z))
      layer.pending.add(index);
  });
  const placeNextBatch = () => {
    if (isDisposed() || layer.placing) return;
    if (!layer.pending.size && layer.source) {
      if (layer.placementStartedAt !== undefined && import.meta.env.DEV) {
        console.info(`[map-load] placement: ${layer.url}`, {
          durationMs: Math.round(performance.now() - layer.placementStartedAt),
          instances: layer.loaded.size,
        });
        layer.placementStartedAt = undefined;
      }
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
    if (INSTANCED_SCENERY_ASSETS.has(layer.url)) {
      const placementStartedAt = performance.now();
      const placedCount = buildInstancedLayer(
        scene,
        layer,
        isNearViewport,
        erasedIds,
      );
      if (placedCount && import.meta.env.DEV)
        console.info(`[map-load] placement: ${layer.url}`, {
          durationMs: Math.round(performance.now() - placementStartedAt),
          instances: placedCount,
        });
      layer.pending.clear();
      layer.placing = false;
      onLoad();
      if (layer.onInitialReady) {
        const done = layer.onInitialReady;
        layer.onInitialReady = undefined;
        done();
      }
      return;
    }
    if (layer.placementStartedAt === undefined)
      layer.placementStartedAt = performance.now();
    layer.placing = true;
    const indices = [...layer.pending].slice(0, 8);
    indices.forEach((index) => {
      layer.pending.delete(index);
      const [x, z, height, rotation = 0, stretchX = 1, stretchZ = 1] =
        layer.placements[index];
      const model = placeModel(
        scene,
        source,
        bounds,
        x,
        z,
        height,
        rotation,
        stretchX,
        stretchZ,
        layer.url === "/models/mountain-creek-segment.glb",
        layer.url !== CLIFF_SPLINE_URL,
        layer.url === CLIFF_SPLINE_URL,
      );
      if (model) {
        layer.models.set(index, model);
        model.userData.mapX = x;
        model.userData.mapZ = z;
        if (ERASABLE_SCENERY_ASSETS.has(layer.url)) {
          const erasedId = `scenery:${layer.url}:${index}`;
          model.userData.mapErasableId = erasedId;
        }
        const assetKey = EDITABLE_ASSETS[layer.url];
        if (assetKey && index === 0) model.userData.mapAssetKey = assetKey;
      }
      layer.loaded.add(index);
    });
    onLoad();
    if (layer.pending.size)
      requestAnimationFrame(() => {
        layer.placing = false;
        placeNextBatch();
      });
    else {
      layer.placing = false;
      placeNextBatch();
    }
  };
  placeNextBatch();
  if (layer.source || layer.loading || layer.failed || !layer.pending.size)
    return;
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
    if (import.meta.env.DEV)
      console.warn(`[map-load] timeout: ${layer.url} (10s)`);
    finishInitialLayer();
  }, 10000);
  const loadStartedAt = performance.now();
  loader.load(
    layer.url,
    (gltf) => {
      window.clearTimeout(timeout);
      if (isDisposed()) return;
      layer.source = gltf.scene;
      prepareSplineSegment(layer.source, layer.url);
      layer.bounds = new THREE.Box3().setFromObject(gltf.scene);
      layer.loading = false;
      layer.failed = false;
      reportGLTFLoad(layer.url, loadStartedAt);
      placeNextBatch();
    },
    undefined,
    () => {
      window.clearTimeout(timeout);
      layer.loading = false;
      layer.failed = true;
      reportGLTFLoad(layer.url, loadStartedAt, true);
      finishInitialLayer();
    },
  );
}

function makeTerrain(
  scene: THREE.Scene,
  forestGround: THREE.Texture,
  mountainGround: THREE.Texture,
  stageLayout?: { reading: number[][]; math: number[][] },
  sharedStart: readonly [number, number] = MAP_SHARED_START,
  splineElements: readonly MapSplineElement[] = [],
) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_WIDTH + 30, WORLD_DEPTH + 30),
    new THREE.MeshBasicMaterial({ color: "#172b37" }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WORLD_WIDTH / 2, -0.8, WORLD_DEPTH / 2);
  scene.add(water);

  const reliefProfile = buildTerrainReliefProfile(splineElements);
  scene.userData.terrainReliefProfile = reliefProfile;
  const geometry = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH, 128, 112);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const lx = positions.getX(i);
    const ly = positions.getY(i);
    const x = lx + WORLD_WIDTH / 2;
    const z = WORLD_DEPTH / 2 - ly;
    positions.setXYZ(i, x, terrainHeight(x, z, reliefProfile), z);
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
  const fogState = scene.userData.mapFogState as MapFogState | undefined;
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
      "#include <map_fragment>\nvec2 biomeUv = vTerrainWorldPosition.xz * 0.14;\nvec3 forestColor = texture2D(forestGroundMap, biomeUv).rgb;\nvec3 mountainColor = texture2D(mountainGroundMap, biomeUv).rgb;\nfloat biomeEdge = 61.0 + (vTerrainWorldPosition.z - 32.0) * 0.18 + sin(vTerrainWorldPosition.z * 0.22) * 1.8;\nfloat mountainBlend = smoothstep(biomeEdge - 5.0, biomeEdge + 5.0, vTerrainWorldPosition.x);\ndiffuseColor.rgb = mix(forestColor, mountainColor, mountainBlend) * 1.45;",
    );
  };
  terrainMaterial.customProgramCacheKey = () => "biome-terrain-blend-v3";
  if (fogState) applyMapFogToMaterial(terrainMaterial, fogState);
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  scene.add(terrain);
  scene.userData.terrainMesh = terrain;
  scene.userData.terrainReliefProfile = reliefProfile;
  const roadTexture = makePathTexture();
  const roadSurface = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: roadTexture,
    roughness: 1,
  });
  if (fogState) applyMapFogToMaterial(roadSurface, fogState);
  const startPoint: [number, number] = [sharedStart[0], sharedStart[1]];
  const roads = (["reading", "math"] as const).map((region) =>
    [
      startPoint,
      ...(stageLayout?.[region] ??
        (region === "reading" ? READING_STOPS : MATH_STOPS).map(([u, v]) => [
          u * WORLD_WIDTH,
          v * WORLD_DEPTH,
        ])),
    ].map(
      ([x, z]) => new THREE.Vector3(x, terrainHeight(x, z, reliefProfile), z),
    ),
  );
  const readingPath = roads[0];
  const mathPath = roads[1];
  const routeMeshes = [readingPath, mathPath].map((points) =>
    makePathRibbon(scene, points, 0.9, roadSurface, 0.09, 2.0),
  );
  scene.userData.routeMeshes = routeMeshes;
  return terrain;
}

function makeGrassBillboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const blades = [
    "#447a37",
    "#5b943c",
    "#75a948",
    "#91b956",
    "#b0c765",
    "#3e7136",
  ];
  for (let i = 0; i < 15; i++) {
    const x = 4 + Math.random() * 56;
    const height = 23 + Math.random() * 35;
    const bend = (Math.random() - 0.5) * 12;
    context.beginPath();
    context.moveTo(x - 1.5 - Math.random() * 1.5, 62);
    context.quadraticCurveTo(x + bend, 39, x + bend * 0.45, 62 - height);
    context.quadraticCurveTo(x + 2.5, 48, x + 1.5 + Math.random() * 1.5, 62);
    context.closePath();
    context.fillStyle = blades[i % blades.length];
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function addReadingGrass(
  scene: THREE.Scene,
  fogState: MapFogState | undefined,
  assetLayers: Map<string, LazyAssetLayer>,
  stageLayout?: { reading: number[][]; math: number[][] },
  sharedStart: readonly [number, number] = MAP_SHARED_START,
  decorations: MapDecoration[] = [],
) {
  const texture = makeGrassBillboardTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.16,
    color: "#d9f0b2",
    roughness: 1,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  if (fogState) applyMapFogToMaterial(material, fogState);
  const geometry = new THREE.PlaneGeometry(0.78, 0.86);
  geometry.translate(0, 0.43, 0);
  const count = 1350;
  const grass = new THREE.InstancedMesh(geometry, material, count);
  grass.name = "reading-region-grass-billboards";
  grass.frustumCulled = false;
  grass.castShadow = false;
  grass.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tufts: {
    x: number;
    y: number;
    z: number;
    scale: number;
    scaleX: number;
    phase: number;
    yawOffset: number;
  }[] = [];
  const occupied = [...assetLayers.values()].flatMap((layer) =>
    layer.placements.map(([x, z]) => ({
      x,
      z,
      radius:
        layer.url.includes("tree") || layer.url.includes("fir")
          ? 2.7
          : layer.url.includes("understory") || layer.url.includes("flower")
            ? 1.2
            : 1.7,
    })),
  );
  for (const decoration of decorations)
    occupied.push({
      x: decoration.x,
      z: decoration.z,
      radius: decoration.kind === "tree" ? 2.6 : 1.5,
    });
  for (const [x, z] of [...MAP_LARGE_ASSETS, ...MAP_BRIDGE_POSITIONS])
    occupied.push({ x, z, radius: 2.4 });
  const stagePoints = [
    sharedStart,
    ...(stageLayout?.reading ??
      READING_STOPS.map(([u, v]) => [u * WORLD_WIDTH, v * WORLD_DEPTH])),
  ];
  for (const [x, z] of stagePoints) occupied.push({ x, z, radius: 2.2 });
  const spacingGrid = new Set<string>();
  let placed = 0;
  for (let i = 0; i < count * 12 && placed < count; i++) {
    const x = 2 + Math.random() * 56;
    const z = 2 + Math.random() * (WORLD_DEPTH - 4);
    const biomeEdge = 61 + (z - 32) * 0.18 + Math.sin(z * 0.22) * 1.8;
    // Keep tufts near the western trail, but leave the path surface and stage markers clear.
    let nearestRoad = Infinity;
    for (const point of readingRoadSamples)
      nearestRoad = Math.min(nearestRoad, Math.hypot(x - point.x, z - point.z));
    if (x > biomeEdge - 5 || nearestRoad < 1.35 || nearestRoad > 8.5) continue;
    if (
      occupied.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius)
    )
      continue;
    const cellX = Math.floor(x / 0.62);
    const cellZ = Math.floor(z / 0.62);
    const cell = `${cellX}:${cellZ}`;
    if (
      spacingGrid.has(cell) ||
      spacingGrid.has(`${cellX - 1}:${cellZ}`) ||
      spacingGrid.has(`${cellX + 1}:${cellZ}`) ||
      spacingGrid.has(`${cellX}:${cellZ - 1}`) ||
      spacingGrid.has(`${cellX}:${cellZ + 1}`)
    )
      continue;
    spacingGrid.add(cell);
    const scale = 0.65 + Math.random() * 0.95;
    const scaleX = scale * (0.75 + Math.random() * 0.5);
    dummy.position.set(x, terrainHeight(x, z), z);
    const yawOffset = (Math.random() - 0.5) * 0.3;
    dummy.rotation.set(0, yawOffset, 0);
    dummy.scale.set(scaleX, scale, scale);
    dummy.updateMatrix();
    grass.setMatrixAt(placed++, dummy.matrix);
    tufts.push({
      x,
      y: dummy.position.y,
      z,
      scale,
      scaleX,
      phase: Math.random() * Math.PI * 2,
      yawOffset,
    });
    const shade = new THREE.Color().setHSL(
      0.23 + Math.random() * 0.08,
      0.42 + Math.random() * 0.25,
      0.38 + Math.random() * 0.2,
    );
    grass.setColorAt(placed - 1, shade);
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.userData.generatedGrassTexture = texture;
  grass.userData.mapGrassTufts = tufts;
  if (fogState) applyMapFogToObject(grass, fogState);
  scene.add(grass);
  return (elapsedMs: number, camera: THREE.Camera) => {
    for (let index = 0; index < tufts.length; index++) {
      const tuft = tufts[index];
      const yaw =
        Math.atan2(camera.position.x - tuft.x, camera.position.z - tuft.z) +
        tuft.yawOffset;
      const sway = Math.sin(elapsedMs * 0.0016 + tuft.phase) * 0.075;
      dummy.position.set(tuft.x, tuft.y, tuft.z);
      dummy.rotation.set(sway * 0.45, yaw, sway, "YXZ");
      dummy.scale.set(tuft.scaleX, tuft.scale, tuft.scale);
      dummy.updateMatrix();
      grass.setMatrixAt(index, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
  };
}

export function IsoWorldScene({
  containerRef,
  layoutKey,
  stageMarkers,
  landmarks = MAP_LANDMARKS,
  pendingAssetKey = null,
  stageLayout,
  sharedStart = MAP_SHARED_START,
  splineElements = [
    {
      id: "river-main",
      type: "river",
      points: MAP_RIVER_POINTS.map(([x, z]) => [x, z] as [number, number]),
    },
  ],
  assetRotations = {},
  decorations = [],
  erasedDecorations = [],
  editorMode = false,
  paintMode = "select",
  splineType = "river",
  brushKind = "tree",
  brushModel = "auto",
  onEditorSelect,
  onEditorMove,
  onEditorPaint,
  onEditorErase,
  hero,
  cinematic = false,
  dialogueHue = 0,
  dialogueSpeaker = null,
  dialogueCharacters = [],
  dialogueStage,
  dialogueEditMode = false,
  dialogueExiting = false,
  onDialogueBubblePosition,
  onStageClick,
  onLoadProgress,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layoutKey: string;
  stageMarkers: StageMarkerData[];
  landmarks?: MapLandmarkLayout;
  pendingAssetKey?: MapLandmarkKey | null;
  stageLayout?: { reading: number[][]; math: number[][] };
  sharedStart?: readonly [number, number];
  splineElements?: readonly MapSplineElement[];
  assetRotations?: Record<string, number>;
  decorations?: MapDecoration[];
  erasedDecorations?: string[];
  editorMode?: boolean;
  paintMode?: MapPaintMode;
  splineType?: MapSplineType;
  brushKind?: MapDecoration["kind"];
  brushModel?: string;
  onEditorSelect: (selection: MapEditorSelection | null) => void;
  onEditorMove: (selection: MapEditorSelection, x: number, z: number) => void;
  onEditorPaint: (
    x: number,
    z: number,
    phase: "start" | "move" | "end",
    modelUrl?: string,
  ) => void;
  onEditorErase: (ids: string[]) => void;
  hero: HeroId;
  cinematic?: boolean;
  dialogueHue?: number;
  dialogueSpeaker?: Speaker | null;
  dialogueCharacters?: Speaker[];
  dialogueStage?: ChapterStage;
  dialogueEditMode?: boolean;
  dialogueExiting?: boolean;
  onDialogueBubblePosition?: (
    position: { x: number; y: number } | null,
  ) => void;
  onStageClick: (region: "reading" | "math" | "intro", index: number) => void;
  onLoadProgress: (progress: MapLoadProgress) => void;
}) {
  const sceneHmrRevision = useSyncExternalStore(
    subscribeToMapSceneHmr,
    getMapSceneHmrRevision,
    getMapSceneHmrRevision,
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const stageMarkersRef = useRef(stageMarkers);
  stageMarkersRef.current = stageMarkers;
  const layoutRef = useRef({
    landmarks,
    stageLayout,
    sharedStart,
    splineElements,
    assetRotations,
    decorations,
    erasedDecorations,
  });
  layoutRef.current = {
    landmarks,
    stageLayout,
    sharedStart,
    splineElements,
    assetRotations,
    decorations,
    erasedDecorations,
  };
  const editorModeRef = useRef(editorMode);
  editorModeRef.current = editorMode;
  const paintModeRef = useRef(paintMode);
  paintModeRef.current = paintMode;
  const splineTypeRef = useRef(splineType);
  splineTypeRef.current = splineType;
  const brushKindRef = useRef(brushKind);
  brushKindRef.current = brushKind;
  const brushModelRef = useRef(brushModel);
  brushModelRef.current = brushModel;
  const pendingAssetKeyRef = useRef(pendingAssetKey);
  pendingAssetKeyRef.current = pendingAssetKey;
  const editorSelectRef = useRef(onEditorSelect);
  editorSelectRef.current = onEditorSelect;
  const editorMoveRef = useRef(onEditorMove);
  editorMoveRef.current = onEditorMove;
  const editorPaintRef = useRef(onEditorPaint);
  editorPaintRef.current = onEditorPaint;
  const editorEraseRef = useRef(onEditorErase);
  editorEraseRef.current = onEditorErase;
  const heroRef = useRef(hero);
  heroRef.current = hero;
  const cinematicRef = useRef(cinematic);
  cinematicRef.current = cinematic;
  const dialogueHueRef = useRef(dialogueHue);
  dialogueHueRef.current = dialogueHue;
  const dialogueSpeakerRef = useRef(dialogueSpeaker);
  dialogueSpeakerRef.current = dialogueSpeaker;
  const dialogueCharactersRef = useRef(dialogueCharacters);
  dialogueCharactersRef.current = dialogueCharacters;
  const dialogueStageRef = useRef(dialogueStage);
  dialogueStageRef.current = dialogueStage;
  const dialogueEditModeRef = useRef(dialogueEditMode);
  dialogueEditModeRef.current = dialogueEditMode;
  const dialogueExitingRef = useRef(dialogueExiting);
  dialogueExitingRef.current = dialogueExiting;
  const stageClickRef = useRef(onStageClick);
  stageClickRef.current = onStageClick;
  const loadProgressRef = useRef(onLoadProgress);
  loadProgressRef.current = onLoadProgress;
  const refreshRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    refreshRef.current?.();
  });
  useEffect(() => {
    // Recreate the WebGL scene when the external hot-reload revision changes.
    void sceneHmrRevision;
    const host = hostRef.current;
    const scroll = containerRef.current;
    if (!host || !scroll) return;
    const mapLoadStartedAt = performance.now();
    let firstRenderAt: number | null = null;
    let initialReadyLogged = false;
    const resourceObserver =
      import.meta.env.DEV && typeof PerformanceObserver !== "undefined"
        ? new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
              const path = new URL(entry.name).pathname;
              if (!/\/(models|textures)\//.test(path)) continue;
              console.debug(`[map-load] resource: ${path}`, {
                durationMs: Math.round(entry.duration),
                transferKiB: Math.round(entry.transferSize / 1024),
                decodedKiB: Math.round(entry.decodedBodySize / 1024),
              });
            }
          })
        : null;
    resourceObserver?.observe({ type: "resource", buffered: true });

    const scene = new THREE.Scene();
    const mapFogState = createMapFogState();
    scene.userData.mapFogState = mapFogState;
    scene.userData.layoutKey = layoutKey;
    scene.background = new THREE.Color("#172b37");
    scene.add(new THREE.HemisphereLight("#ffe9d8", "#52604e", 0.95));
    const sun = new THREE.DirectionalLight("#fff1d6", 3.2);
    sun.position.set(WORLD_WIDTH / 2 - 48, 30, WORLD_DEPTH / 2 + 48);
    sun.target.position.set(WORLD_WIDTH / 2, 0, WORLD_DEPTH / 2);
    sun.castShadow = true;
    sun.shadow.intensity = 0.65;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -72;
    sun.shadow.camera.right = 72;
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
    mountainGlow.position.set(98, 9, 14);
    scene.add(mountainGlow);
    const textureLoader = new THREE.TextureLoader();
    let forestGround = new THREE.Texture();
    let mountainGround = new THREE.Texture();
    const forestGroundReady = new Promise<void>((resolve) => {
      const texture = textureLoader.load(
        "/textures/forest-ground.png",
        () => resolve(),
        undefined,
        () => resolve(),
      );
      forestGround = texture;
    });
    const mountainGroundReady = new Promise<void>((resolve) => {
      const texture = textureLoader.load(
        "/textures/mountain-ground.png",
        () => resolve(),
        undefined,
        () => resolve(),
      );
      mountainGround = texture;
    });
    for (const texture of [forestGround, mountainGround]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    }
    makeTerrain(
      scene,
      forestGround,
      mountainGround,
      stageLayout,
      sharedStart,
      splineElements,
    );
    const markerBadges: MarkerBadgeImages = {
      reading: new Image(),
      math: new Image(),
      locked: new Image(),
    };
    markerBadges.reading.src = readingMarkerBadge;
    markerBadges.math.src = mathMarkerBadge;
    markerBadges.locked.src = lockedMarkerBadge;
    const markerObjects = stageMarkersRef.current.map((marker) =>
      createStageMarker(
        scene,
        marker,
        markerBadges,
        stageLayout,
        sharedStart,
        scene.userData.terrainReliefProfile as TerrainReliefMound[],
      ),
    );
    for (const marker of markerObjects)
      applyMapFogToObject(marker.group, mapFogState);
    const riverEditHandles = splineElements.flatMap((element) =>
      element.points.map((_, index) => {
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(0.72, 16, 12),
          new THREE.MeshStandardMaterial({
            color: "#54e4f5",
            emissive: "#087d92",
            emissiveIntensity: 0.7,
            roughness: 0.35,
          }),
        );
        handle.userData.mapSplineId = element.id;
        handle.userData.mapSplinePointIndex = index;
        handle.renderOrder = 20;
        scene.add(handle);
        return handle;
      }),
    );
    const startEditHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 18, 14),
      new THREE.MeshStandardMaterial({
        color: "#ffd84d",
        emissive: "#aa6410",
        emissiveIntensity: 0.65,
        roughness: 0.3,
      }),
    );
    startEditHandle.userData.mapEditorStart = true;
    startEditHandle.renderOrder = 21;
    scene.add(startEditHandle);
    const eraseBrushOutline = new THREE.Mesh(
      new THREE.RingGeometry(MAP_ERASER_RADIUS - 0.16, MAP_ERASER_RADIUS, 48),
      new THREE.MeshBasicMaterial({
        color: "#ff4d6d",
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    eraseBrushOutline.rotation.x = -Math.PI / 2;
    eraseBrushOutline.visible = false;
    eraseBrushOutline.renderOrder = 30;
    scene.add(eraseBrushOutline);
    const heroAnchor = new THREE.Group();
    scene.add(heroAnchor);
    const dialogueAnchors = new Map<Speaker, THREE.Group>();
    const initialLayers = new Set<LazyAssetLayer>();
    let progressInitialized = false;
    let progressLoaded = 0;
    let progressTotal = 6;
    const publishProgress = () =>
      loadProgressRef.current({
        loaded: progressLoaded,
        total: progressTotal,
        complete: progressLoaded >= progressTotal,
      });
    const completeProgressItem = () => {
      if (disposed || progressLoaded >= progressTotal) return;
      progressLoaded += 1;
      publishProgress();
      if (
        import.meta.env.DEV &&
        !initialReadyLogged &&
        progressLoaded >= progressTotal
      ) {
        initialReadyLogged = true;
        console.info("[map-load] initial scene ready", {
          totalMs: Math.round(performance.now() - mapLoadStartedAt),
          firstRenderMs:
            firstRenderAt === null
              ? null
              : Math.round(firstRenderAt - mapLoadStartedAt),
          progressItems: progressTotal,
        });
      }
    };
    loadProgressRef.current({
      loaded: 0,
      total: progressTotal,
      complete: false,
    });
    let loadedHero = "";
    const loadedDialogueCharacters = new Set<Speaker>();
    const readyDialogueCharacters = new Set<Speaker>();
    let disposed = false;
    let cameraTransitionStarted = 0;
    let heroPositionInitialized = false;
    let heroDestinationKey = "";
    let heroAnimationFrame = 0;
    let grassAnimationFrame = 0;
    let heroAnimationStartedAt = 0;
    const heroAnimationStart = new THREE.Vector3();
    const heroAnimationTarget = new THREE.Vector3();
    const animateHeroMovement = () => {
      heroAnimationFrame = 0;
      if (disposed) return;
      const progress = Math.min(
        (performance.now() - heroAnimationStartedAt) / 720,
        1,
      );
      const easedProgress = progress * progress * (3 - 2 * progress);
      heroAnchor.position.lerpVectors(
        heroAnimationStart,
        heroAnimationTarget,
        easedProgress,
      );
      heroAnchor.position.y += Math.sin(progress * Math.PI) * 0.32;
      renderer.render(scene, camera);
      if (progress < 1)
        heroAnimationFrame = requestAnimationFrame(animateHeroMovement);
    };
    const loadHero = (heroKey: HeroId) => {
      if (loadedHero === heroKey) return;
      loadedHero = heroKey;
      heroAnchor.clear();
      const heroUrl =
        heroKey === "zelane"
          ? "/models/heroes/hero-zelane-compressed.glb?v=map-assets-optimized-1"
          : `/models/heroes/hero-${heroKey}.glb?v=map-assets-optimized-1`;
      const heroLoadStartedAt = performance.now();
      gltfLoader.load(
        heroUrl,
        (gltf) => {
          reportGLTFLoad(heroUrl, heroLoadStartedAt);
          if (disposed) return;
          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          if (size.y <= 0) {
            completeProgressItem();
            return;
          }
          const model = gltf.scene.clone(true);
          const scale = 2.25 / size.y;
          model.scale.setScalar(scale);
          model.position.set(
            -center.x * scale,
            -bounds.min.y * scale,
            -center.z * scale,
          );
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = true;
              object.receiveShadow = true;
            }
          });
          applyMapFogToObject(model, mapFogState);
          heroAnchor.add(model);
          completeProgressItem();
          render();
        },
        undefined,
        () => {
          reportGLTFLoad(heroUrl, heroLoadStartedAt, true);
          completeProgressItem();
        },
      );
    };
    const prepareDialogueActor = (anchor: THREE.Group, key: Speaker) => {
      if (anchor.userData.dialogueEffectsPrepared) return;
      anchor.userData.dialogueEffectsPrepared = true;
      anchor.userData.dialogueMaterials = [];
      const isKing = key === "king";
      const targetHeight = 2.25;
      const glow = isKing
        ? null
        : new THREE.PointLight(
            key === "hero_male"
              ? "#35d5e7"
              : key === "yuki"
                ? "#67d8ff"
                : "#ff79c5",
            0,
            4.5,
            2,
          );
      if (glow) {
        glow.position.set(0, targetHeight * 0.65, 0);
        anchor.add(glow);
      }
      const shadowAura = isKing
        ? new THREE.Mesh(
            new THREE.RingGeometry(0.85, 1.35, 40),
            new THREE.MeshBasicMaterial({
              color: "#1c0a2c",
              transparent: true,
              opacity: 0,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          )
        : null;
      if (shadowAura) {
        shadowAura.rotation.x = -Math.PI / 2;
        shadowAura.position.y = 0.035;
        shadowAura.renderOrder = 2;
        anchor.add(shadowAura);
      }
      const auraCanvas = document.createElement("canvas");
      auraCanvas.width = 128;
      auraCanvas.height = 128;
      const auraContext = auraCanvas.getContext("2d");
      if (auraContext) {
        const gradient = auraContext.createRadialGradient(
          64,
          64,
          4,
          64,
          64,
          62,
        );
        gradient.addColorStop(0, "rgba(255,255,255,0.55)");
        gradient.addColorStop(0.35, "rgba(255,255,255,0.22)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        auraContext.fillStyle = gradient;
        auraContext.fillRect(0, 0, 128, 128);
      }
      const auraTexture = new THREE.CanvasTexture(auraCanvas);
      const auraSpriteMaterial = new THREE.SpriteMaterial({
        map: auraTexture,
        color: isKing
          ? "#391447"
          : key === "hero_male"
            ? "#8ce9ff"
            : key === "yuki"
              ? "#8ce9ff"
              : "#ff9bce",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: isKing ? THREE.NormalBlending : THREE.AdditiveBlending,
        toneMapped: false,
      });
      const auraSprite = new THREE.Sprite(auraSpriteMaterial);
      auraSprite.position.set(0, targetHeight * 0.58, 0);
      auraSprite.scale.set(3.0, 3.6, 1);
      auraSprite.renderOrder = 1;
      anchor.add(auraSprite);
      anchor.userData.dialogueGlow = glow;
      anchor.userData.dialogueShadowAura = shadowAura;
      anchor.userData.dialogueAuraSprite = auraSprite;
    };
    const startDialogueEntrance = (anchor: THREE.Group, key: Speaker) => {
      if (anchor.userData.dialogueEntranceStarted || dialogueExitingRef.current)
        return;
      anchor.userData.dialogueEntranceStarted = true;
      const startedAt = performance.now();
      anchor.userData.dialogueEntranceStartedAt = startedAt;
      const animateEntrance = (now: number) => {
        if (disposed || dialogueExitingRef.current) return;
        const progress = Math.min((now - startedAt) / 1500, 1);
        const eased = progress * progress * (3 - 2 * progress);
        const materials = anchor.userData.dialogueMaterials as {
          material: THREE.Material;
          opacity: number;
          transparent: boolean;
          depthWrite: boolean;
        }[];
        for (const entry of materials) {
          entry.material.opacity = entry.opacity * eased;
          if (progress === 1) {
            entry.material.transparent = entry.transparent;
            entry.material.depthWrite = entry.depthWrite;
          }
        }
        const glow = anchor.userData.dialogueGlow as THREE.PointLight | null;
        const shadowAura = anchor.userData.dialogueShadowAura as THREE.Mesh<
          THREE.RingGeometry,
          THREE.MeshBasicMaterial
        > | null;
        const sprite = anchor.userData
          .dialogueAuraSprite as THREE.Sprite | null;
        if (glow) glow.intensity = 0.3 + 1.7 * (1 - eased);
        if (shadowAura) shadowAura.material.opacity = 0.14 + 0.34 * (1 - eased);
        if (sprite)
          (sprite.material as THREE.SpriteMaterial).opacity =
            key === "king"
              ? 0.2 + 0.35 * (1 - eased)
              : 0.14 + 0.52 * (1 - eased);
        renderer.render(scene, camera);
        if (progress < 1) requestAnimationFrame(animateEntrance);
        else anchor.userData.dialogueEntranceFinished = true;
      };
      requestAnimationFrame(animateEntrance);
    };
    const resetDialogueActor = (anchor: THREE.Group) => {
      anchor.userData.dialogueEntranceStarted = false;
      anchor.userData.dialogueEntranceFinished = false;
      const materials = anchor.userData.dialogueMaterials as {
        material: THREE.Material;
        opacity: number;
        transparent: boolean;
        depthWrite: boolean;
      }[];
      for (const entry of materials) {
        entry.material.opacity = 0;
        entry.material.transparent = true;
        entry.material.depthWrite = false;
      }
      const glow = anchor.userData.dialogueGlow as THREE.PointLight | null;
      if (glow) glow.intensity = 0;
      const shadowAura = anchor.userData.dialogueShadowAura as THREE.Mesh<
        THREE.RingGeometry,
        THREE.MeshBasicMaterial
      > | null;
      if (shadowAura) shadowAura.material.opacity = 0;
      const sprite = anchor.userData.dialogueAuraSprite as THREE.Sprite | null;
      if (sprite) (sprite.material as THREE.SpriteMaterial).opacity = 0;
    };
    const dialogueRight = new THREE.Vector3(0.55, 0, 0.83).normalize();
    const dialogueForward = new THREE.Vector3(0.835, 0, -0.55).normalize();
    const dialogueSpacing = 3.1;
    const loadDialogueCast = (
      characters: Speaker[],
      playerHero: HeroId,
      focus: THREE.Vector3 | null,
    ) => {
      const playerSpeaker = heroSceneSpeaker(playerHero === "milo");
      const cast = [...new Set(characters)].filter(
        (speaker) => speaker !== playerSpeaker,
      );
      for (const [speaker, anchor] of dialogueAnchors) {
        anchor.visible = Boolean(
          focus && cinematicRef.current && cast.includes(speaker),
        );
      }
      if (!focus || !cinematicRef.current) return;
      cast.forEach((key, index) => {
        let anchor = dialogueAnchors.get(key);
        if (!anchor) {
          anchor = new THREE.Group();
          anchor.visible = false;
          scene.add(anchor);
          dialogueAnchors.set(key, anchor);
        }
        prepareDialogueActor(anchor, key);
        // Keep the hero anchored at focus; stage the other characters in an
        // evenly spaced line to the hero's screen-right.
        const lateralOffset = dialogueSpacing * (index + 1);
        const x = focus.x + lateralOffset * dialogueRight.x;
        const z = focus.z + lateralOffset * dialogueRight.z;
        // The middle character faces the camera in a three-person scene;
        // set them farther from the camera while preserving their
        // screen-space spacing. The rightmost character faces inward.
        const facesCamera = cast.length > 1 && index === 0;
        const depthOffset = facesCamera ? 4 : 0;
        const actorOffset = dialogueStageRef.current?.actors[key] ?? { x: 0, z: 0 };
        const stagedX = x + dialogueForward.x * (depthOffset + actorOffset.z) + dialogueRight.x * actorOffset.x;
        const stagedZ = z + dialogueForward.z * (depthOffset + actorOffset.z) + dialogueRight.z * actorOffset.x;
        anchor.position.set(
          stagedX,
          terrainHeight(stagedX, stagedZ) + 0.05,
          stagedZ,
        );
        const lookDirection = facesCamera
          ? new THREE.Vector3(-0.835, 0, 0.55)
          : dialogueRight.clone().negate();
        // Dialogue models have a local forward offset of -PI/2.
        anchor.rotation.y =
          Math.atan2(lookDirection.x, lookDirection.z) + Math.PI / 2 + (actorOffset.rotation ?? 0) * Math.PI / 180;
        anchor.visible = true;
        anchor.scale.setScalar(1);
        if (loadedDialogueCharacters.has(key)) return;
        loadedDialogueCharacters.add(key);
        const modelUrl =
          key === "demon"
            ? "/models/dialogue/demon.glb?v=demon-trellis-1"
            : key === "mochi"
            ? "/models/dialogue/mochi.glb?v=map-assets-optimized-1"
            : key === "king"
              ? "/models/dialogue/king-chuuut.glb?v=map-assets-optimized-1"
              : key === "hero_male"
                ? "/models/heroes/hero-milo.glb?v=map-assets-optimized-1"
                : key === "hero_female"
                  ? "/models/heroes/hero-hana.glb?v=map-assets-optimized-1"
                  : key === "yuki"
                    ? "/models/dialogue/yuki.glb?v=dialogue-yuki-1"
                    : `/models/heroes/hero-${key}.glb?v=map-assets-optimized-1`;
        const dialogueLoadStartedAt = performance.now();
        gltfLoader.load(
          modelUrl,
          (gltf) => {
            reportGLTFLoad(modelUrl, dialogueLoadStartedAt);
            if (disposed) return;
            const bounds = new THREE.Box3().setFromObject(gltf.scene);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            if (size.y <= 0) {
              readyDialogueCharacters.add(key);
              render();
              return;
            }
            const model = gltf.scene.clone(true);
            const targetHeight = 2.25;
            const scale = targetHeight / size.y;
            model.scale.setScalar(scale);
            model.position.set(
              -center.x * scale,
              -bounds.min.y * scale,
              -center.z * scale,
            );
            model.rotation.y = -Math.PI / 2;
            const dialogueMaterials: {
              material: THREE.Material;
              opacity: number;
              transparent: boolean;
              depthWrite: boolean;
            }[] = [];
            model.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              object.castShadow = true;
              object.receiveShadow = true;
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              const clonedMaterials = materials.map((material) => {
                const clone = material.clone();
                dialogueMaterials.push({
                  material: clone,
                  opacity: clone.opacity,
                  transparent: clone.transparent,
                  depthWrite: clone.depthWrite,
                });
                clone.transparent = true;
                clone.depthWrite = false;
                clone.opacity = 0;
                return clone;
              });
              object.material = Array.isArray(object.material)
                ? clonedMaterials
                : clonedMaterials[0];
            });
            anchor?.add(model);
            if (anchor) anchor.userData.dialogueModel = model;
            applyMapFogToObject(model, mapFogState);
            if (anchor) {
              anchor.userData.dialogueMaterials = dialogueMaterials;
              readyDialogueCharacters.add(key);
            }
            render();
          },
          undefined,
          () => {
            reportGLTFLoad(modelUrl, dialogueLoadStartedAt, true);
            readyDialogueCharacters.add(key);
            render();
          },
        );
      });
    };
    const assetLayers = new Map<string, LazyAssetLayer>();
    const placedDecorations = new Map<string, THREE.Group>();
    const decorationSources = new Map<
      string,
      Promise<{ source: THREE.Group; bounds: THREE.Box3 }>
    >();
    const loadDecorationSource = (url: string) => {
      let pending = decorationSources.get(url);
      if (!pending) {
        const decorationLoadStartedAt = performance.now();
        pending = new Promise((resolve, reject) =>
          gltfLoader.load(
            url,
            (gltf) => {
              reportGLTFLoad(url, decorationLoadStartedAt);
              gltf.scene.updateMatrixWorld(true);
              prepareSplineSegment(gltf.scene, url);
              resolve({
                source: gltf.scene,
                bounds: new THREE.Box3().setFromObject(gltf.scene),
              });
            },
            undefined,
            (error) => {
              reportGLTFLoad(url, decorationLoadStartedAt, true);
              reject(error);
            },
          ),
        );
        decorationSources.set(url, pending);
      }
      return pending;
    };
    const addLayer = (url: string, placements: AssetPlacement[]) => {
      const layer = assetLayers.get(url) ?? {
        url,
        placements: [],
        models: new Map<number, THREE.Group>(),
        loaded: new Set<number>(),
        pending: new Set<number>(),
        loading: false,
        placing: false,
      };
      layer.placements.push(...placements);
      assetLayers.set(url, layer);
    };
    const one = (
      x: number,
      z: number,
      height: number,
      rotation = 0,
    ): AssetPlacement[] => [[x, z, height, rotation]];
    const oneLandmark = (
      key: MapLandmarkKey,
      height: number,
      rotation = 0,
    ): AssetPlacement[] => {
      const position = landmarks[key];
      return position ? one(position[0], position[1], height, rotation) : [];
    };
    // Each model type is requested only when at least one of its instances is near the viewport.
    addLayer(
      "/models/reading-tree.glb",
      oneLandmark("readingTree", 4.4, assetRotations.readingTree ?? 0),
    );
    addLayer(
      "/models/map-blossom-tree.glb",
      oneLandmark("readingBlossom", 4.0, assetRotations.readingBlossom ?? 0),
    );
    addLayer(
      "/models/storybook-reading-arch.glb",
      oneLandmark("readingArch", 3.5, 1.0 + (assetRotations.readingArch ?? 0)),
    );
    addLayer(
      "/models/storybook-tree-library.glb",
      oneLandmark(
        "readingTreeLibrary",
        4.2,
        assetRotations.readingTreeLibrary ?? 0,
      ),
    );
    addLayer(
      "/models/reading-bookstone.glb",
      oneLandmark(
        "readingBookstone",
        2.8,
        assetRotations.readingBookstone ?? 0,
      ),
    );
    addLayer(
      "/models/reading-mushroom-cluster.glb",
      oneLandmark(
        "readingMushrooms",
        4.0,
        assetRotations.readingMushrooms ?? 0,
      ),
    );
    addLayer(
      "/models/math-abacus.glb",
      oneLandmark(
        "mathAbacus",
        3.1,
        Math.PI / 2 + (assetRotations.mathAbacus ?? 0),
      ),
    );
    addLayer(
      "/models/math-crystals.glb",
      oneLandmark("mathCrystals", 3.6, assetRotations.mathCrystals ?? 0),
    );
    // Illustrated book and abacus arrows mark the two routes at their shared start.
    addLayer(
      "/models/direction-signpost.glb",
      one(...MAP_DIRECTION_SIGN_POSITION, 4.0),
    );
    addLayer("/models/forest-tree.glb", scatterProps("forest", 46, 71, 3.0));
    // A dense grove sits north of the western reading route.
    addLayer("/models/forest-tree.glb", [
      [16, 49, 3.8, 0.2, 1.05, 1.05],
      [19, 52, 3.7, -0.4, 1.05, 1.05],
      [22, 50, 3.8, 0.5, 1.05, 1.1],
      [25, 53, 3.6, -0.2, 1.05, 1],
    ]);
    addLayer("/models/forest-understory.glb", [
      [16.5, 52, 1.05, 0.3, 1.05, 1.05],
      [20.5, 54, 1.1, 1.1, 1.05, 1.05],
      [23, 56, 1.05, -0.4, 1.05, 1.05],
    ]);
    addLayer(
      "/models/mountain-fir.glb",
      scatterProps("mountain", 32, 197, 3.0),
    );
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
    addLayer(
      "/models/storybook-cottage.glb",
      oneLandmark(
        "storybookCottage",
        3.2,
        assetRotations.storybookCottage ?? 0,
      ),
    );
    addLayer(
      "/models/mountain-observatory.glb",
      oneLandmark(
        "mountainObservatory",
        3.8,
        assetRotations.mountainObservatory ?? 0,
      ),
    );
    // Spline elements are rendered as repeated channel segments with riverbank dressing.
    const splineScenery = buildSplineSceneryTargets(splineElements);
    for (const [url, placements] of Object.entries(splineScenery))
      addLayer(url, placements);
    // The original river carries the existing bridge at its trail crossing.
    if (splineElements.some((element) => element.id === "river-main")) {
      for (const [bridgeX, bridgeZ] of MAP_BRIDGE_POSITIONS)
        addLayer(
          "/models/map-woodland-footbridge.glb",
          one(bridgeX, bridgeZ, 2.7, MAP_BRIDGE_ROTATION),
        );
    }
    const updateReadingGrass = addReadingGrass(
      scene,
      mapFogState,
      assetLayers,
      stageLayout,
      sharedStart,
      decorations,
    );

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
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
    let pointerDown: {
      x: number;
      y: number;
      left: number;
      top: number;
    } | null = null;
    let activeEditorTarget: MapEditorSelection | null = null;
    let activePainting = false;
    let eraserCursorOnMap = false;
    let dragged = false;
    let hoveredMarker: SceneStageMarker | null = null;
    const stateForMarker = (marker: SceneStageMarker) => {
      const stage = marker.group.userData.stageMarker as {
        region: "reading" | "math" | "intro";
        index: number;
      };
      return stageMarkersRef.current.find(
        (item) => item.region === stage.region && item.index === stage.index,
      );
    };
    const setHoveredMarker = (next: SceneStageMarker | null) => {
      if (hoveredMarker === next) return;
      if (hoveredMarker) {
        hoveredMarker.group.scale.setScalar(1);
        hoveredMarker.ring.material.emissiveIntensity = 0.2;
      }
      hoveredMarker = next;
      const hoveredData = hoveredMarker
        ? stateForMarker(hoveredMarker)
        : undefined;
      if (hoveredMarker && hoveredData?.unlocked) {
        hoveredMarker.group.scale.setScalar(1.12);
        hoveredMarker.ring.material.emissiveIntensity = 1.15;
      }
      renderer.domElement.style.cursor = hoveredData?.unlocked
        ? "pointer"
        : "grab";
      refreshRef.current?.();
    };
    const findMarkerAtPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        markerObjects.map((marker) => marker.group),
        true,
      )[0]?.object;
      let markerGroup: THREE.Object3D | null = hit ?? null;
      while (markerGroup && !markerGroup.userData.stageMarker)
        markerGroup = markerGroup.parent;
      const stage = markerGroup?.userData.stageMarker as
        | { region: "reading" | "math" | "intro"; index: number }
        | undefined;
      if (!stage) return null;
      return (
        markerObjects.find((marker) => marker.group === markerGroup) ?? null
      );
    };
    const setRayFromPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };
    const findGroundAtPointer = (clientX: number, clientY: number) => {
      setRayFromPointer(clientX, clientY);
      const terrain = scene.userData.terrainMesh as THREE.Mesh;
      return raycaster.intersectObject(terrain, false)[0]?.point ?? null;
    };
    let placementPreviewModels: THREE.Group[] = [];
    let placementPreviewCoords: {
      x: number;
      z: number;
      height: number;
      rotation: number;
      stretchX?: number;
      stretchZ?: number;
    }[] = [];
    let placementPreviewSignature = "";
    let placementPreviewLoadToken = 0;
    let placementPreviewLoading = false;
    let placementPreviewBrushModelUrl = "";
    const hidePlacementPreview = () => {
      for (const model of placementPreviewModels) model.visible = false;
    };
    const disposePlacementPreview = () => {
      placementPreviewLoadToken++;
      placementPreviewLoading = false;
      for (const model of placementPreviewModels) {
        scene.remove(model);
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) material.dispose();
        });
      }
      placementPreviewModels = [];
    };
    const autoBrushModelAt = (
      kind: MapDecorationKind,
      x: number,
      z: number,
    ) => {
      const mountain = mountainBlendAt(x, z) >= 0.5;
      const choices: Record<MapDecorationKind, string[]> = {
        tree: mountain
          ? ["/models/mountain-fir.glb"]
          : ["/models/forest-tree.glb", "/models/reading-tree.glb"],
        flower: mountain
          ? ["/models/mountain-wildflowers.glb"]
          : [
              "/models/map-forest-flower-patch.glb",
              "/models/map-blossom-tree.glb",
            ],
        rock: mountain
          ? ["/models/mountain-rock-cluster.glb"]
          : [
              "/models/mossy-boulders.glb",
              "/models/map-riverbank-rock-cluster.glb",
            ],
        bush: mountain
          ? ["/models/mountain-cushion-shrub.glb"]
          : ["/models/forest-understory.glb"],
      };
      const options = choices[kind];
      const cellX = Math.floor(x / 3);
      const cellZ = Math.floor(z / 3);
      const kindSalt =
        kind === "tree" ? 1 : kind === "flower" ? 2 : kind === "rock" ? 3 : 4;
      const choiceIndex =
        Math.abs(
          (cellX * 73856093) ^ (cellZ * 19349663) ^ (kindSalt * 83492791),
        ) % options.length;
      return options[choiceIndex];
    };
    const updatePlacementPreview = (clientX: number, clientY: number) => {
      if (
        !editorModeRef.current ||
        !["brush", "spline"].includes(paintModeRef.current)
      ) {
        hidePlacementPreview();
        return;
      }
      const point = findGroundAtPointer(clientX, clientY);
      if (!point) {
        hidePlacementPreview();
        return;
      }
      const x = THREE.MathUtils.clamp(point.x, 0, WORLD_WIDTH);
      const z = THREE.MathUtils.clamp(point.z, 0, WORLD_DEPTH);
      let previewSpecs: {
        url: string;
        x: number;
        z: number;
        height: number;
        rotation: number;
        stretchX?: number;
        stretchZ?: number;
      }[];
      if (paintModeRef.current === "brush") {
        const kind = brushKindRef.current;
        const selectedModel = brushModelRef.current;
        const modelUrl =
          selectedModel === "auto"
            ? autoBrushModelAt(kind, x, z)
            : selectedModel;
        placementPreviewBrushModelUrl = modelUrl;
        const height =
          kind === "tree"
            ? 3.4
            : kind === "flower"
              ? 1.5
              : kind === "rock"
                ? 1.6
                : 1.7;
        previewSpecs = [{ url: modelUrl, x, z, height, rotation: 0 }];
      } else {
        placementPreviewBrushModelUrl = "";
        const left = Math.max(-5, x - 4);
        const right = Math.min(WORLD_WIDTH + 5, x + 4);
        const type = splineTypeRef.current;
        const previewElement: MapSplineElement = {
          id: "placement-preview",
          type,
          points: [
            [left, z],
            [right, z],
          ],
        };
        const splineTargets = buildSplineSceneryTargets([previewElement]);
        previewSpecs = Object.entries(splineTargets).flatMap(
          ([url, placements]) =>
            placements.map(
              ([px, pz, height, rotation = 0, stretchX = 1, stretchZ = 1]) => ({
                url,
                x: px,
                z: pz,
                height,
                rotation,
                stretchX,
                stretchZ,
              }),
            ),
        );
      }
      placementPreviewCoords = previewSpecs.map(
        ({ x: px, z: pz, height, rotation, stretchX, stretchZ }) => ({
          x: px,
          z: pz,
          height,
          rotation,
          stretchX,
          stretchZ,
        }),
      );
      const signature = `${paintModeRef.current}|${paintModeRef.current === "brush" ? brushKindRef.current : splineTypeRef.current}|${previewSpecs.map(({ url }) => url).join("|")}`;
      if (
        signature !== placementPreviewSignature ||
        (placementPreviewModels.length !== previewSpecs.length &&
          !placementPreviewLoading)
      ) {
        placementPreviewSignature = signature;
        disposePlacementPreview();
        placementPreviewLoading = true;
        const requestToken = placementPreviewLoadToken;
        void Promise.all(
          previewSpecs.map(({ url }) => loadDecorationSource(url)),
        )
          .then((sources) => {
            if (disposed || requestToken !== placementPreviewLoadToken) return;
            placementPreviewLoading = false;
            placementPreviewModels = sources.map(
              ({ source, bounds }, index) => {
                const placement =
                  placementPreviewCoords[index] ?? previewSpecs[index];
                const model = placeModel(
                  scene,
                  source,
                  bounds,
                  placement.x,
                  placement.z,
                  placement.height,
                  placement.rotation,
                  placement.stretchX,
                  placement.stretchZ,
                );
                if (!model) return new THREE.Group();
                model.userData.previewX = placement.x;
                model.userData.previewZ = placement.z;
                model.traverse((object) => {
                  if (!(object instanceof THREE.Mesh)) return;
                  object.castShadow = false;
                  object.receiveShadow = false;
                  const makeGhost = (material: THREE.Material) => {
                    const ghost = material.clone();
                    ghost.transparent = true;
                    ghost.opacity = 0.42;
                    ghost.depthWrite = false;
                    return ghost;
                  };
                  object.material = Array.isArray(object.material)
                    ? object.material.map(makeGhost)
                    : makeGhost(object.material);
                });
                return model;
              },
            );
            render();
          })
          .catch((error: unknown) => {
            if (requestToken === placementPreviewLoadToken)
              placementPreviewLoading = false;
            console.warn("Impossible de charger l’aperçu de placement", error);
          });
      } else if (placementPreviewModels.length === previewSpecs.length) {
        placementPreviewModels.forEach((model, index) => {
          const next = placementPreviewCoords[index];
          const oldX = model.userData.previewX as number;
          const oldZ = model.userData.previewZ as number;
          model.position.x += next.x - oldX;
          model.position.z += next.z - oldZ;
          model.position.y +=
            terrainHeight(next.x, next.z) - terrainHeight(oldX, oldZ);
          model.rotation.y = next.rotation;
          model.visible = true;
          model.userData.previewX = next.x;
          model.userData.previewZ = next.z;
        });
        render();
      }
    };
    const updateEraserCursor = (clientX: number, clientY: number) => {
      const point = findGroundAtPointer(clientX, clientY);
      if (!point) {
        eraserCursorOnMap = false;
        eraseBrushOutline.visible = false;
        return;
      }
      eraserCursorOnMap = true;
      eraseBrushOutline.position.set(
        point.x,
        terrainHeight(point.x, point.z) + 0.075,
        point.z,
      );
      eraseBrushOutline.visible =
        editorModeRef.current && paintModeRef.current === "erase";
      renderer.render(scene, camera);
    };
    const eraseSceneryAt = (x: number, z: number) => {
      const erased: string[] = [];
      for (const layer of assetLayers.values()) {
        for (const model of layer.models.values()) {
          const id = model.userData.mapErasableId as string | undefined;
          if (!id || !model.visible) continue;
          const modelX = model.userData.mapX as number;
          const modelZ = model.userData.mapZ as number;
          if (Math.hypot(modelX - x, modelZ - z) <= MAP_ERASER_RADIUS) {
            setInstanceVisible(model, false);
            erased.push(id);
          }
        }
      }
      if (erased.length) editorEraseRef.current(erased);
    };
    const findEditorTargetAtPointer = (
      clientX: number,
      clientY: number,
    ): MapEditorSelection | null => {
      setRayFromPointer(clientX, clientY);
      for (const intersection of raycaster.intersectObjects(
        scene.children,
        true,
      )) {
        let visibilityNode: THREE.Object3D | null = intersection.object;
        let hiddenByParent = false;
        while (visibilityNode) {
          if (!visibilityNode.visible) {
            hiddenByParent = true;
            break;
          }
          visibilityNode = visibilityNode.parent;
        }
        if (hiddenByParent) continue;
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          if (object.userData.mapAssetKey)
            return {
              kind: "asset",
              key: object.userData.mapAssetKey as keyof typeof MAP_LANDMARKS,
              index: 0,
            };
          if (
            object.userData.mapSplineId !== undefined &&
            object.userData.mapSplinePointIndex !== undefined
          )
            return {
              kind: "splinePoint",
              splineId: object.userData.mapSplineId as string,
              index: object.userData.mapSplinePointIndex as number,
            };
          if (object.userData.mapEditorStart)
            return { kind: "start", index: 0 };
          if (object.userData.stageMarker) {
            const stage = object.userData.stageMarker as {
              region: "reading" | "math" | "intro";
              index: number;
            };
            return stage.region === "intro"
              ? { kind: "start", index: 0 }
              : { kind: "stage", region: stage.region, index: stage.index };
          }
          object = object.parent;
        }
      }
      return null;
    };
    const moveEditorTargetAtPointer = (
      target: MapEditorSelection,
      clientX: number,
      clientY: number,
    ) => {
      const point = findGroundAtPointer(clientX, clientY);
      if (!point) return;
      editorMoveRef.current(
        target,
        THREE.MathUtils.clamp(point.x, 0, WORLD_WIDTH),
        THREE.MathUtils.clamp(point.z, 0, WORLD_DEPTH),
      );
    };
    const onCanvasPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (editorModeRef.current && dialogueEditModeRef.current) {
        event.preventDefault();
        return;
      }
      if (editorModeRef.current) {
        if (
          paintModeRef.current !== "select" &&
          paintModeRef.current !== "asset"
        ) {
          activePainting = true;
          event.preventDefault();
          renderer.domElement.setPointerCapture(event.pointerId);
          editorSelectRef.current(null);
          const point = findGroundAtPointer(event.clientX, event.clientY);
          if (point) {
            updatePlacementPreview(event.clientX, event.clientY);
            if (paintModeRef.current === "erase")
              updateEraserCursor(event.clientX, event.clientY);
            const x = THREE.MathUtils.clamp(point.x, 0, WORLD_WIDTH);
            const z = THREE.MathUtils.clamp(point.z, 0, WORLD_DEPTH);
            editorPaintRef.current(
              x,
              z,
              "start",
              placementPreviewBrushModelUrl || undefined,
            );
            if (paintModeRef.current === "erase") eraseSceneryAt(x, z);
          }
          return;
        }
        activeEditorTarget = findEditorTargetAtPointer(
          event.clientX,
          event.clientY,
        );
        if (activeEditorTarget) {
          event.preventDefault();
          renderer.domElement.setPointerCapture(event.pointerId);
          editorSelectRef.current(activeEditorTarget);
          renderer.domElement.style.cursor = "grabbing";
          return;
        }
        const pendingAssetKey = pendingAssetKeyRef.current;
        if (pendingAssetKey) {
          const point = findGroundAtPointer(event.clientX, event.clientY);
          if (point) {
            const target: MapEditorSelection = {
              kind: "asset",
              key: pendingAssetKey,
              index: 0,
            };
            event.preventDefault();
            editorSelectRef.current(target);
            editorMoveRef.current(
              target,
              THREE.MathUtils.clamp(point.x, 0, WORLD_WIDTH),
              THREE.MathUtils.clamp(point.z, 0, WORLD_DEPTH),
            );
            return;
          }
        }
        editorSelectRef.current(null);
      }
      pointerDown = {
        x: event.clientX,
        y: event.clientY,
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      };
      dragged = false;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onCanvasPointerMove = (event: PointerEvent) => {
      if (editorModeRef.current && activePainting) {
        const point = findGroundAtPointer(event.clientX, event.clientY);
        if (point) {
          updatePlacementPreview(event.clientX, event.clientY);
          if (paintModeRef.current === "erase")
            updateEraserCursor(event.clientX, event.clientY);
          const x = THREE.MathUtils.clamp(point.x, 0, WORLD_WIDTH);
          const z = THREE.MathUtils.clamp(point.z, 0, WORLD_DEPTH);
          editorPaintRef.current(
            x,
            z,
            "move",
            placementPreviewBrushModelUrl || undefined,
          );
          if (paintModeRef.current === "erase") eraseSceneryAt(x, z);
        }
        return;
      }
      if (editorModeRef.current && activeEditorTarget) {
        moveEditorTargetAtPointer(
          activeEditorTarget,
          event.clientX,
          event.clientY,
        );
        return;
      }
      if (editorModeRef.current && !pointerDown) {
        updatePlacementPreview(event.clientX, event.clientY);
        if (paintModeRef.current === "erase")
          updateEraserCursor(event.clientX, event.clientY);
        else {
          eraserCursorOnMap = false;
          eraseBrushOutline.visible = false;
        }
        renderer.domElement.style.cursor = findEditorTargetAtPointer(
          event.clientX,
          event.clientY,
        )
          ? "grab"
          : "default";
        return;
      }
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
      if (activePainting) {
        activePainting = false;
        editorPaintRef.current(0, 0, "end");
      }
      if (activeEditorTarget) {
        activeEditorTarget = null;
        renderer.domElement.style.cursor = "grab";
      }
      pointerDown = null;
      setHoveredMarker(findMarkerAtPointer(event.clientX, event.clientY));
    };
    const onCanvasPointerLeave = () => {
      if (pointerDown) return;
      hidePlacementPreview();
      eraserCursorOnMap = false;
      eraseBrushOutline.visible = false;
      setHoveredMarker(null);
    };
    const onCanvasClick = (event: MouseEvent) => {
      if (editorModeRef.current) {
        dragged = false;
        return;
      }
      if (dragged) {
        dragged = false;
        return;
      }
      const marker = findMarkerAtPointer(event.clientX, event.clientY);
      const stage = marker?.group.userData.stageMarker as
        | { region: "reading" | "math" | "intro"; index: number }
        | undefined;
      if (!stage) return;
      const state = stageMarkersRef.current.find(
        (item) => item.region === stage.region && item.index === stage.index,
      );
      if (state?.unlocked || editorModeRef.current)
        stageClickRef.current(stage.region, stage.index);
    };
    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
    renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
    renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
    renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
    renderer.domElement.addEventListener("pointerleave", onCanvasPointerLeave);
    renderer.domElement.addEventListener("click", onCanvasClick);

    const viewportBounds = {
      centerX: 0,
      centerZ: 0,
      halfWidth: 0,
      halfDepth: 0,
    };
    let previousLayoutSignature = "";
    let previousTerrainSplineSignature = JSON.stringify(splineElements);
    const syncInstance = (
      layer: LazyAssetLayer | undefined,
      index: number,
      placement: AssetPlacement,
    ) => {
      if (!layer) return;
      const previous = layer.placements[index];
      const model = layer.models.get(index);
      if (model && previous) {
        const [x, z, , rotation = 0] = placement;
        const [oldX, oldZ, , oldRotation = 0] = previous;
        const nextOffset =
          layer.url === CLIFF_SPLINE_URL
            ? cliffSplineOffset(rotation)
            : { x: 0, z: 0 };
        const previousOffset =
          layer.url === CLIFF_SPLINE_URL
            ? cliffSplineOffset(oldRotation)
            : { x: 0, z: 0 };
        model.position.x += x - oldX + nextOffset.x - previousOffset.x;
        model.position.z += z - oldZ + nextOffset.z - previousOffset.z;
        const reliefProfile = scene.userData.terrainReliefProfile as
          | readonly TerrainReliefMound[]
          | undefined;
        model.position.y +=
          terrainHeight(x, z, reliefProfile) -
          terrainHeight(oldX, oldZ, reliefProfile);
        model.rotation.y = rotation;
        model.userData.mapX = x;
        model.userData.mapZ = z;
        model.visible =
          !model.userData.mapErasableId ||
          !layoutRef.current.erasedDecorations.includes(
            model.userData.mapErasableId as string,
          );
      }
      layer.placements[index] = placement;
    };
    const syncEditedLayout = () => {
      const current = layoutRef.current;
      const signature = JSON.stringify(current);
      if (signature === previousLayoutSignature) return;
      previousLayoutSignature = signature;
      if (
        JSON.stringify(current.splineElements) !==
        previousTerrainSplineSignature
      ) {
        const terrain = scene.userData.terrainMesh as THREE.Mesh;
        const oldReliefProfile = scene.userData
          .terrainReliefProfile as readonly TerrainReliefMound[];
        const reliefProfile = updateTerrainSplineRelief(
          terrain,
          current.splineElements,
        );
        scene.userData.terrainReliefProfile = reliefProfile;
        for (const layer of assetLayers.values()) {
          for (const model of layer.models.values()) {
            const x = model.userData.mapX as number | undefined;
            const z = model.userData.mapZ as number | undefined;
            if (x === undefined || z === undefined) continue;
            const deltaY =
              terrainHeight(x, z, reliefProfile) -
              terrainHeight(x, z, oldReliefProfile);
            const targets = model.userData.instanceTargets as
              | {
                  mesh: THREE.InstancedMesh;
                  index: number;
                  matrix: THREE.Matrix4;
                }[]
              | undefined;
            if (targets) {
              for (const target of targets) {
                target.matrix.elements[13] += deltaY;
                target.mesh.setMatrixAt(target.index, target.matrix);
                target.mesh.instanceMatrix.needsUpdate = true;
              }
              model.position.y += deltaY;
            } else model.position.y += deltaY;
          }
        }
        const grass = scene.getObjectByName(
          "reading-region-grass-billboards",
        ) as THREE.InstancedMesh | undefined;
        const tufts = grass?.userData.mapGrassTufts as
          | { x: number; y: number; z: number }[]
          | undefined;
        if (tufts)
          for (const tuft of tufts)
            tuft.y = terrainHeight(tuft.x, tuft.z, reliefProfile);
        previousTerrainSplineSignature = JSON.stringify(current.splineElements);
      }
      const reliefProfile = scene.userData
        .terrainReliefProfile as TerrainReliefMound[];
      const assetModels: [
        string,
        keyof typeof MAP_LANDMARKS,
        number,
        number,
      ][] = [
        ["/models/reading-tree.glb", "readingTree", 4.4, 0],
        ["/models/map-blossom-tree.glb", "readingBlossom", 4, 0],
        ["/models/storybook-reading-arch.glb", "readingArch", 3.5, 1],
        ["/models/storybook-tree-library.glb", "readingTreeLibrary", 4.2, 0],
        ["/models/reading-bookstone.glb", "readingBookstone", 2.8, 0],
        ["/models/reading-mushroom-cluster.glb", "readingMushrooms", 4, 0],
        ["/models/math-abacus.glb", "mathAbacus", 3.1, Math.PI / 2],
        ["/models/math-crystals.glb", "mathCrystals", 3.6, 0],
        ["/models/storybook-cottage.glb", "storybookCottage", 3.2, 0],
        ["/models/mountain-observatory.glb", "mountainObservatory", 3.8, 0],
      ];
      for (const [url, key, height, baseRotation] of assetModels) {
        const position = current.landmarks[key];
        const layer = assetLayers.get(url);
        if (!position) {
          const model = layer?.models.get(0);
          if (model) model.visible = false;
          continue;
        }
        const [x, z] = position;
        syncInstance(layer, 0, [
          x,
          z,
          height,
          baseRotation + (current.assetRotations[key] ?? 0),
        ]);
      }
      for (const marker of markerObjects) {
        const data = marker.group.userData.stageMarker as {
          region: "reading" | "math" | "intro";
          index: number;
        };
        marker.group.position.copy(
          markerWorldPosition(
            data.region,
            data.index,
            current.stageLayout,
            current.sharedStart,
            reliefProfile,
          ),
        );
      }
      for (const handle of riverEditHandles) {
        const splineId = handle.userData.mapSplineId as string;
        const pointIndex = handle.userData.mapSplinePointIndex as number;
        const point = current.splineElements.find(
          (element) => element.id === splineId,
        )?.points[pointIndex];
        if (point)
          handle.position.set(
            point[0],
            terrainHeight(point[0], point[1], reliefProfile) + 1.15,
            point[1],
          );
      }
      startEditHandle.position.set(
        current.sharedStart[0],
        terrainHeight(
          current.sharedStart[0],
          current.sharedStart[1],
          reliefProfile,
        ) + 1.3,
        current.sharedStart[1],
      );
      const routeMeshes = scene.userData.routeMeshes as (THREE.Mesh | null)[];
      for (const [routeIndex, region] of (
        ["reading", "math"] as const
      ).entries()) {
        const stages =
          current.stageLayout?.[region] ??
          (region === "reading" ? READING_STOPS : MATH_STOPS).map(([u, v]) => [
            u * WORLD_WIDTH,
            v * WORLD_DEPTH,
          ]);
        const points = [[...current.sharedStart], ...stages].map(
          ([x, z]) =>
            new THREE.Vector3(x, terrainHeight(x, z, reliefProfile), z),
        );
        const oldMesh = routeMeshes[routeIndex];
        if (oldMesh) {
          const routeMaterial = Array.isArray(oldMesh.material)
            ? oldMesh.material[0]
            : oldMesh.material;
          const replacement = makePathRibbon(
            scene,
            points,
            0.9,
            routeMaterial,
            0.09,
            2.0,
          );
          scene.remove(oldMesh);
          oldMesh.geometry.dispose();
          routeMeshes[routeIndex] = replacement;
        }
      }
      const splineTargets = buildSplineSceneryTargets(current.splineElements);
      for (const [url, placements] of Object.entries(splineTargets)) {
        const layer = assetLayers.get(url);
        if (!layer) continue;
        placements.forEach((placement, index) => {
          syncInstance(layer, index, placement);
        });
        for (const [index, model] of layer.models)
          if (index >= placements.length) model.visible = false;
      }
      const erasedIds = new Set(current.erasedDecorations);
      for (const layer of assetLayers.values()) {
        for (const model of layer.models.values()) {
          const erasedId = model.userData.mapErasableId as string | undefined;
          if (erasedId && erasedIds.has(erasedId))
            setInstanceVisible(model, false);
        }
      }
      const decorationIds = new Set(current.decorations.map((item) => item.id));
      for (const [id, model] of placedDecorations) {
        if (decorationIds.has(id)) continue;
        scene.remove(model);
        placedDecorations.delete(id);
      }
      for (const decoration of current.decorations) {
        const existing = placedDecorations.get(decoration.id);
        if (existing) {
          const oldX = existing.userData.mapX as number;
          const oldZ = existing.userData.mapZ as number;
          existing.position.x += decoration.x - oldX;
          existing.position.z += decoration.z - oldZ;
          existing.position.y +=
            terrainHeight(decoration.x, decoration.z, reliefProfile) -
            terrainHeight(oldX, oldZ, reliefProfile);
          existing.rotation.y = decoration.rotation;
          existing.userData.mapX = decoration.x;
          existing.userData.mapZ = decoration.z;
          continue;
        }
        void loadDecorationSource(decoration.modelUrl)
          .then(({ source, bounds }) => {
            if (
              disposed ||
              !layoutRef.current.decorations.some(
                (item) => item.id === decoration.id,
              )
            )
              return;
            const baseHeight =
              decoration.kind === "tree"
                ? 3.4
                : decoration.kind === "flower"
                  ? 1.5
                  : decoration.kind === "rock"
                    ? 1.6
                    : 1.7;
            const model = placeModel(
              scene,
              source,
              bounds,
              decoration.x,
              decoration.z,
              baseHeight * decoration.scale,
              decoration.rotation,
            );
            if (!model) return;
            model.userData.mapDecorationId = decoration.id;
            model.userData.mapX = decoration.x;
            model.userData.mapZ = decoration.z;
            placedDecorations.set(decoration.id, model);
            render();
          })
          .catch((error: unknown) =>
            console.warn(
              `Impossible de charger le décor ${decoration.modelUrl}`,
              error,
            ),
          );
      }
    };
    let cameraPoseInitialized = false;
    let previousCinematic: boolean | null = null;
    let cameraTransitionFrame = 0;
    let dialogueExitFrame = 0;
    const cameraFromPosition = new THREE.Vector3();
    const cameraToPosition = new THREE.Vector3();
    const cameraFromLookAt = new THREE.Vector3();
    const cameraToLookAt = new THREE.Vector3();
    const cameraLookAt = new THREE.Vector3();
    let lastDialogueBubblePosition: { x: number; y: number } | null = null;
    const updateDialogueBubblePosition = () => {
      const activeSpeaker = dialogueSpeakerRef.current;
      const playerSpeaker = heroSceneSpeaker(heroRef.current === "milo");
      const anchor =
        activeSpeaker === playerSpeaker
          ? heroAnchor
          : activeSpeaker
            ? dialogueAnchors.get(activeSpeaker)
            : undefined;
      if (!cinematicRef.current || !anchor?.visible) {
        if (lastDialogueBubblePosition) onDialogueBubblePosition?.(null);
        lastDialogueBubblePosition = null;
        return;
      }
      camera.updateMatrixWorld();
      anchor.updateWorldMatrix(true, false);
      const speakingModel = (anchor.userData.dialogueModel as THREE.Object3D | undefined) ?? anchor;
      speakingModel.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(speakingModel);
      const size = bounds.getSize(new THREE.Vector3());
      const head = bounds.isEmpty()
        ? anchor.localToWorld(new THREE.Vector3(0, 2.2, 0))
        : new THREE.Vector3(
            (bounds.min.x + bounds.max.x) / 2,
            bounds.max.y - size.y * 0.06,
            (bounds.min.z + bounds.max.z) / 2,
          );
      const projected = head.project(camera);
      if (
        projected.z < -1 ||
        projected.z > 1
      ) {
        if (lastDialogueBubblePosition) onDialogueBubblePosition?.(null);
        lastDialogueBubblePosition = null;
        return;
      }
      const rect = host.getBoundingClientRect();
      const position = {
        x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      };
      if (
        lastDialogueBubblePosition &&
        Math.abs(lastDialogueBubblePosition.x - position.x) < 2 &&
        Math.abs(lastDialogueBubblePosition.y - position.y) < 2
      )
        return;
      lastDialogueBubblePosition = position;
      onDialogueBubblePosition?.(position);
    };
    const animateCamera = (now: number) => {
      if (disposed) return;
      const rawProgress = Math.min((now - cameraTransitionStarted) / 1500, 1);
      const eased = rawProgress * rawProgress * (3 - 2 * rawProgress);
      camera.position.lerpVectors(cameraFromPosition, cameraToPosition, eased);
      cameraLookAt.lerpVectors(cameraFromLookAt, cameraToLookAt, eased);
      camera.lookAt(cameraLookAt);
      renderer.render(scene, camera);
      updateDialogueBubblePosition();
      if (rawProgress < 1)
        cameraTransitionFrame = requestAnimationFrame(animateCamera);
      else cameraTransitionFrame = 0;
    };
    const animateDialogueExit = () => {
      dialogueExitFrame = 0;
      if (disposed) return;
      let stillVisible = false;
      for (const anchor of dialogueAnchors.values()) {
        const materials = anchor.userData.dialogueMaterials as
          | { material: THREE.Material }[]
          | undefined;
        for (const entry of materials ?? []) {
          entry.material.transparent = true;
          entry.material.depthWrite = false;
          entry.material.opacity *= 0.78;
          if (entry.material.opacity > 0.035) stillVisible = true;
        }
        const glow = anchor.userData.dialogueGlow as THREE.PointLight | null;
        if (glow) glow.intensity *= 0.78;
        const aura = anchor.userData.dialogueShadowAura as THREE.Mesh<
          THREE.RingGeometry,
          THREE.MeshBasicMaterial
        > | null;
        if (aura) aura.material.opacity *= 0.78;
        const sprite = anchor.userData
          .dialogueAuraSprite as THREE.Sprite | null;
        if (sprite) (sprite.material as THREE.SpriteMaterial).opacity *= 0.78;
        if (!materials?.some((entry) => entry.material.opacity > 0.035))
          anchor.visible = false;
        else stillVisible = true;
      }
      renderer.render(scene, camera);
      if (stillVisible)
        dialogueExitFrame = requestAnimationFrame(animateDialogueExit);
    };
    const render = () => {
      if (disposed) return;
      if (
        !editorModeRef.current ||
        !["brush", "spline"].includes(paintModeRef.current)
      )
        hidePlacementPreview();
      const fogLayout = layoutRef.current;
      const fogProgress = stageMarkersRef.current
        .filter((marker) => marker.region !== "intro")
        .map(
          (marker) =>
            `${marker.region[0]}${marker.index}:${marker.unlocked ? 1 : 0}`,
        )
        .join(",");
      const fogSignature = `${fogProgress}|${JSON.stringify(fogLayout.stageLayout)}|${fogLayout.sharedStart.join(",")}`;
      if (mapFogState.signature !== fogSignature) {
        updateMapFogMask(
          mapFogState,
          stageMarkersRef.current,
          fogLayout.stageLayout,
          fogLayout.sharedStart,
        );
        mapFogState.signature = fogSignature;
      }
      mapFogState.enabled.value = editorModeRef.current ? 0 : 1;
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      syncEditedLayout();
      for (const handle of riverEditHandles)
        handle.visible = editorModeRef.current && !dialogueEditModeRef.current;
      startEditHandle.visible = editorModeRef.current && !dialogueEditModeRef.current;
      if (paintModeRef.current !== "erase" || !editorModeRef.current)
        eraserCursorOnMap = false;
      eraseBrushOutline.visible =
        editorModeRef.current &&
        paintModeRef.current === "erase" &&
        eraserCursorOnMap;
      const current = stageMarkersRef.current.find((marker) => marker.current);
      const isCinematic = cinematicRef.current && Boolean(current);
      const focus = current
        ? markerWorldPosition(
            current.region,
            current.index,
            stageLayout,
            sharedStart,
          )
        : null;
      if (current) {
        const destinationKey = `${current.region}-${current.index}`;
        const heroPosition = markerWorldPosition(
          current.region,
          current.index,
          stageLayout,
          sharedStart,
        );
        heroPosition.y += 0.22;
        heroAnchor.visible = true;
        if (isCinematic) {
          if (heroAnimationFrame) cancelAnimationFrame(heroAnimationFrame);
          heroAnimationFrame = 0;
          heroAnchor.position.copy(heroPosition);
          heroPositionInitialized = true;
          heroDestinationKey = destinationKey;
        } else if (!heroPositionInitialized) {
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
      } else {
        heroAnchor.visible = false;
      }
      loadDialogueCast(
        dialogueCharactersRef.current,
        heroRef.current,
        isCinematic ? focus : null,
      );
      const castReady = dialogueCharactersRef.current
        .filter(
          (speaker) => speaker !== heroSceneSpeaker(heroRef.current === "milo"),
        )
        .every((speaker) => readyDialogueCharacters.has(speaker));
      const centerX =
        isCinematic && focus
          ? focus.x
          : (scroll.scrollLeft + width / 2) / WORLD_SCALE;
      const centerZ =
        isCinematic && focus
          ? focus.z
          : (scroll.scrollTop + height / 2) / (WORLD_SCALE * WORLD_PITCH);
      const mapCameraPosition = new THREE.Vector3(centerX, 21.5, centerZ + 16);
      const mapCameraLookAt = new THREE.Vector3(centerX, 0, centerZ);
      const playerSpeaker = heroSceneSpeaker(heroRef.current === "milo");
      const dialogueCastCount =
        1 +
        new Set(dialogueCharactersRef.current).size -
        (dialogueCharactersRef.current.includes(playerSpeaker) ? 1 : 0);
      const lineupCenterOffset =
        (dialogueSpacing * Math.max(0, dialogueCastCount - 1)) / 2;
      const dialogueLookAt =
        isCinematic && focus
          ? new THREE.Vector3(
              focus.x + dialogueRight.x * lineupCenterOffset,
              focus.y + 1.05,
              focus.z + dialogueRight.z * lineupCenterOffset,
            )
          : mapCameraLookAt;
      const stageCamera = dialogueStageRef.current?.camera;
      const cameraDirection = new THREE.Vector3(-7.6, 3.2, 5)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(stageCamera?.orbit ?? 0));
      const lineupWidth =
        dialogueSpacing * Math.max(0, dialogueCastCount - 1) + 1.8;
      const horizontalFovTangent =
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.max(width / height, 0.25);
      const automaticCameraDistance = Math.max(
        9.7,
        lineupWidth / (2 * horizontalFovTangent),
      );
      const cameraDistance = stageCamera
        ? automaticCameraDistance * (stageCamera.distance / 10)
        : automaticCameraDistance;
      const desiredCameraPosition =
        isCinematic && focus
          ? dialogueLookAt
              .clone()
              .addScaledVector(cameraDirection, cameraDistance)
          : mapCameraPosition;
      const desiredCameraLookAt = dialogueLookAt;
      if (!cameraPoseInitialized) {
        cameraPoseInitialized = true;
        camera.position.copy(mapCameraPosition);
        camera.lookAt(mapCameraLookAt);
        cameraLookAt.copy(mapCameraLookAt);
        previousCinematic = false;
      }
      if (previousCinematic !== isCinematic && (!isCinematic || castReady)) {
        if (cameraTransitionFrame) cancelAnimationFrame(cameraTransitionFrame);
        if (isCinematic && dialogueExitFrame) {
          cancelAnimationFrame(dialogueExitFrame);
          dialogueExitFrame = 0;
        }
        cameraFromPosition.copy(camera.position);
        cameraToPosition.copy(desiredCameraPosition);
        cameraFromLookAt.copy(cameraLookAt);
        cameraToLookAt.copy(desiredCameraLookAt);
        cameraTransitionStarted = performance.now();
        cameraTransitionFrame = requestAnimationFrame(animateCamera);
        previousCinematic = isCinematic;
        if (isCinematic) {
          for (const speaker of dialogueCharactersRef.current) {
            if (speaker === heroSceneSpeaker(heroRef.current === "milo"))
              continue;
            const anchor = dialogueAnchors.get(speaker);
            if (anchor) {
              resetDialogueActor(anchor);
              startDialogueEntrance(anchor, speaker);
            }
          }
        }
      } else if (!cameraTransitionFrame) {
        camera.position.copy(desiredCameraPosition);
        cameraLookAt.copy(desiredCameraLookAt);
        camera.lookAt(cameraLookAt);
      }
      if (isCinematic && focus) {
        // A close lateral camera stages the hero in profile while leaving
        // the surrounding map visible as the story backdrop.
      }
      viewportBounds.centerX = centerX;
      viewportBounds.centerZ = centerZ;
      viewportBounds.halfWidth = isCinematic
        ? 13
        : width / (2 * WORLD_SCALE) + 3.5;
      viewportBounds.halfDepth = isCinematic
        ? 13
        : height / (2 * WORLD_SCALE * WORLD_PITCH) + 4.5;
      const isNearViewport = (x: number, z: number) =>
        Math.abs(x - viewportBounds.centerX) <= viewportBounds.halfWidth &&
        Math.abs(z - viewportBounds.centerZ) <= viewportBounds.halfDepth;
      if (!progressInitialized) {
        for (const layer of assetLayers.values()) {
          if (layer.placements.some(([x, z]) => isNearViewport(x, z)))
            initialLayers.add(layer);
        }
        progressTotal += initialLayers.size;
        progressInitialized = true;
        publishProgress();
        const renderAfterTextureReady = () => {
          render();
          requestAnimationFrame(() =>
            requestAnimationFrame(completeProgressItem),
          );
        };
        void forestGroundReady.then(renderAfterTextureReady);
        void mountainGroundReady.then(renderAfterTextureReady);
      }
      const erasedScenery = new Set(layoutRef.current.erasedDecorations);
      for (const layer of assetLayers.values()) {
        addVisibleLayerAssets(
          scene,
          layer,
          isNearViewport,
          () => {
            if (initialLayers.delete(layer)) completeProgressItem();
          },
          initialLayers.has(layer),
          render,
          () => disposed,
          gltfLoader,
          erasedScenery,
        );
      }
      for (const layer of assetLayers.values()) {
        if (layer.instancedChunks) {
          for (const chunk of layer.instancedChunks.values()) {
            for (const mesh of chunk.meshes) mesh.visible = chunk.indices.some((index) => isNearViewport(layer.placements[index][0], layer.placements[index][1]));
          }
        }
        for (const model of layer.models.values()) {
          setInstanceVisible(model, true);
          const id = model.userData.mapErasableId as string | undefined;
          if (id && erasedScenery.has(id)) setInstanceVisible(model, false);
        }
      }
      for (const marker of markerObjects) {
        const data = stateForMarker(marker);
        if (data)
          updateStageMarker(
            marker,
            data,
            marker === hoveredMarker,
            markerBadges,
          );
        marker.group.visible = !isCinematic;
      }
      if (isCinematic) {
        heroAnchor.rotation.y = Math.atan2(dialogueRight.x, dialogueRight.z);
      } else {
        heroAnchor.rotation.y = 0;
      }
      loadHero(heroRef.current);
      if (dialogueExitingRef.current && dialogueExitFrame === 0)
        dialogueExitFrame = requestAnimationFrame(animateDialogueExit);
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
      updateDialogueBubblePosition();
      if (firstRenderAt === null) firstRenderAt = performance.now();
    };
    let lastGrassFrame = 0;
    const animateReadingGrass = (time: number) => {
      if (disposed) return;
      if (time - lastGrassFrame >= 1000 / 30) {
        lastGrassFrame = time;
        updateReadingGrass(time, camera);
        renderer.render(scene, camera);
      }
      grassAnimationFrame = requestAnimationFrame(animateReadingGrass);
    };
    const refreshMarkerBadges = () => {
      if (disposed) return;
      for (const marker of markerObjects) marker.signature = "";
      render();
    };
    Object.values(markerBadges).forEach((image) => {
      const onBadgeReady = () => {
        refreshMarkerBadges();
        completeProgressItem();
      };
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
    grassAnimationFrame = requestAnimationFrame(animateReadingGrass);
    return () => {
      disposed = true;
      disposePlacementPreview();
      resourceObserver?.disconnect();
      if (heroAnimationFrame) cancelAnimationFrame(heroAnimationFrame);
      if (grassAnimationFrame) cancelAnimationFrame(grassAnimationFrame);
      if (cameraTransitionFrame) cancelAnimationFrame(cameraTransitionFrame);
      if (dialogueExitFrame) cancelAnimationFrame(dialogueExitFrame);
      if (refreshRef.current === render) refreshRef.current = null;
      observer.disconnect();
      window.removeEventListener("resize", render);
      scroll.removeEventListener("scroll", render);
      renderer.domElement.removeEventListener(
        "pointerdown",
        onCanvasPointerDown,
      );
      renderer.domElement.removeEventListener(
        "pointermove",
        onCanvasPointerMove,
      );
      renderer.domElement.removeEventListener("pointerup", onCanvasPointerUp);
      renderer.domElement.removeEventListener(
        "pointercancel",
        onCanvasPointerUp,
      );
      renderer.domElement.removeEventListener(
        "pointerleave",
        onCanvasPointerLeave,
      );
      renderer.domElement.removeEventListener("click", onCanvasClick);
      for (const marker of markerObjects) {
        marker.faceTexture.dispose();
        marker.titleTexture.dispose();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          (
            object.userData.generatedGrassTexture as THREE.Texture | undefined
          )?.dispose();
          object.geometry.dispose();
          if (Array.isArray(object.material))
            object.material.forEach((material) => {
              material.dispose();
            });
          else object.material.dispose();
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      forestGround.dispose();
      mountainGround.dispose();
      mapFogState.texture.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [
    containerRef,
    layoutKey,
    stageLayout,
    sharedStart,
    landmarks,
    assetRotations.mathAbacus,
    assetRotations.mathCrystals,
    assetRotations.mountainObservatory,
    assetRotations.readingArch,
    assetRotations.readingBlossom,
    assetRotations.readingBookstone,
    assetRotations.readingMushrooms,
    assetRotations.readingTree,
    assetRotations.readingTreeLibrary,
    assetRotations.storybookCottage,
    decorations,
    splineElements,
    onDialogueBubblePosition,
    sceneHmrRevision,
  ]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="sticky left-0 top-0 z-0 h-screen w-screen overflow-hidden pointer-events-auto"
    />
  );
}
