import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BigButton, HERO_INFO, IMAGES, SPEAKER_INFO, SpeakButton, UI_ICONS, playerText } from "../components/ui";
import { MATH_CHAPTERS, MATH_MISSIONS, mathChapterMissions, type MathChapter } from "../data/math";
import { CHAPTERS, MISSIONS, type LetterChapter } from "../data/reading";
import { WORLD_INTRO_LINES } from "../data/story";
import { heroSceneSpeaker } from "../data/dialogue";
import type { Line } from "../data/chapter";
import { configureSpeech, speak, stopSpeech } from "../lib/speech";
import { speakable } from "./Dialog";
import type { Save } from "../lib/storage";
import { HeroCarousel3D, type HeroOption } from "../components/HeroCarousel3D";
import { isMathMissionUnlocked } from "./Math";
import { chapterMissions, isMissionUnlocked } from "./Map";
import { MAP_ERASER_RADIUS, MAP_LANDMARKS, MAP_RIVER_POINTS, MAP_SHARED_START, MAP_WORLD_DEPTH, MAP_WORLD_WIDTH, MATH_STOPS, mountainBlendAt, READING_STOPS, WORLD_PIXEL_HEIGHT, WORLD_PIXEL_WIDTH, type MapLandmarkKey, type MapLandmarkLayout } from "./map-layout";
import {
	IsoWorldScene,
	type MapEditorSelection,
	type MapDecoration,
	type MapPaintMode,
	type MapSplineElement,
	type MapSplineType,
	type MapLoadProgress,
	type StageMarkerData,
} from "./IsoWorldScene";

export type MapRegion = "reading" | "math";
const HEROES: HeroOption[] = [
	{ id: "hana", label: "Hana", color: "#ff4fa3" },
	{ id: "luna", label: "Luna", color: "#34c3ff" },
	{ id: "mia", label: "Mia", color: "#b36bff" },
	{ id: "milo", label: "Milo", color: "#35d5e7" },
	{ id: "zelane", label: "Zélane", color: "#f6c445" },
];
type MapStageRegion = MapRegion | "intro";
export type MapStageSelection = { region: MapRegion; chapter: number } | { region: "intro"; chapter: 0 };

const MAP_SPECIAL_ASSETS: { key: MapLandmarkKey; label: string; icon: string }[] = [
	{ key: "readingTree", label: "Arbre lecteur", icon: "🌳" },
	{ key: "readingBlossom", label: "Arbre fleuri", icon: "🌸" },
	{ key: "readingArch", label: "Arche", icon: "🏛️" },
	{ key: "readingTreeLibrary", label: "Bibliothèque", icon: "📚" },
	{ key: "readingBookstone", label: "Pierre livre", icon: "📖" },
	{ key: "storybookCottage", label: "Maison conte", icon: "🏡" },
	{ key: "readingMushrooms", label: "Champignons", icon: "🍄" },
	{ key: "mathAbacus", label: "Boulier", icon: "🧮" },
	{ key: "mathCrystals", label: "Cristaux", icon: "💎" },
	{ key: "mountainObservatory", label: "Observatoire", icon: "🔭" },
];
const AUTOMATIC_BRUSH_MODEL = "auto";
const MAP_SPLINE_LABELS: Record<MapSplineType, string> = { river: "Rivière", fence: "Clôture", cliff: "Falaise", talus: "Talus" };
const MAP_BRUSH_ASSETS: Record<MapDecoration["kind"], { label: string; modelUrl: string }[]> = {
	tree: [
		{ label: "Arbre de forêt", modelUrl: "/models/forest-tree.glb" },
		{ label: "Arbre de lecture", modelUrl: "/models/reading-tree.glb" },
		{ label: "Sapin de montagne", modelUrl: "/models/mountain-fir.glb" },
	],
	flower: [
		{ label: "Fleurs de forêt", modelUrl: "/models/map-forest-flower-patch.glb" },
		{ label: "Arbre fleuri", modelUrl: "/models/map-blossom-tree.glb" },
		{ label: "Fleurs de montagne", modelUrl: "/models/mountain-wildflowers.glb" },
	],
	rock: [
		{ label: "Rochers moussus", modelUrl: "/models/mossy-boulders.glb" },
		{ label: "Rochers de rivière", modelUrl: "/models/map-riverbank-rock-cluster.glb" },
		{ label: "Rochers de montagne", modelUrl: "/models/mountain-rock-cluster.glb" },
	],
	bush: [
		{ label: "Sous-bois", modelUrl: "/models/forest-understory.glb" },
		{ label: "Arbuste de montagne", modelUrl: "/models/mountain-cushion-shrub.glb" },
	],
};

function stopPoint(region: MapStageRegion, index: number) {
	if (region === "intro") return { x: MAP_SHARED_START[0] / MAP_WORLD_WIDTH * WORLD_PIXEL_WIDTH, y: MAP_SHARED_START[1] / MAP_WORLD_DEPTH * WORLD_PIXEL_HEIGHT };
	const [x, y] = (region === "reading" ? READING_STOPS : MATH_STOPS)[index] ?? [0.5, 0.5];
	return { x: x * WORLD_PIXEL_WIDTH, y: y * WORLD_PIXEL_HEIGHT };
}

export function MapSelectScreen({ save, selection, onHeroChange, onSelectStage, onReading, onMath, onWorldIntro, onSettings, intro, onIntroEnd, backgroundOnly = false }: {
	save: Save; selection: MapStageSelection | null; onSelectStage: (selection: MapStageSelection) => void;
	onHeroChange: (hero: Save["hero"]) => void | Promise<void>;
	onReading: (chapter: number) => void; onMath: (chapter: number) => void;
	onWorldIntro: () => void;
	onSettings: () => void;
	intro?: { title: string; lines: Line[] };
	onIntroEnd?: () => void;
	backgroundOnly?: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
	const preloadedDialogueModels = useRef(new Set<string>());
	const readingStars = MISSIONS.reduce((sum, mission) => sum + (save.stars[mission.id] ?? 0), 0);
	const mathStars = MATH_MISSIONS.reduce((sum, mission) => sum + (save.stars[mission.id] ?? 0), 0);
	const readingMaxStars = MISSIONS.length * 3;
	const mathMaxStars = MATH_MISSIONS.length * 3;
	const totalStars = readingStars + mathStars;
	const totalMaxStars = readingMaxStars + mathMaxStars;
	const overallProgress = totalMaxStars ? Math.round((totalStars / totalMaxStars) * 100) : 0;
	const incompleteReading = CHAPTERS.findIndex((chapter) => !chapterComplete(chapter, save));
	const incompleteMath = MATH_CHAPTERS.findIndex((chapter) => !mathChapterComplete(chapter, save));
	const initialSelection: MapStageSelection = incompleteReading >= 0
		? { region: "reading", chapter: incompleteReading }
		: { region: "math", chapter: incompleteMath < 0 ? MATH_CHAPTERS.length - 1 : incompleteMath };
	const selected = selection ?? initialSelection;
	useEffect(() => {
		const lines = selected.region === "intro"
			? WORLD_INTRO_LINES
			: selected.region === "math"
				? MATH_CHAPTERS[selected.chapter]?.intro ?? []
				: CHAPTERS[selected.chapter]?.intro ?? [];
	const playerSpeaker = heroSceneSpeaker(save.hero === "milo");
	const speakers = new Set(lines.map(({ who }) => who === "hero" ? playerSpeaker : who));
	const models = new Set([...speakers].filter((who) => who !== playerSpeaker).map((who) =>
		who === "mochi" ? "/models/dialogue/mochi.glb?v=map-assets-optimized-1" : who === "king" ? "/models/dialogue/king-chuuut.glb?v=map-assets-optimized-1" : who === "hero_male" ? "/models/heroes/hero-milo.glb?v=map-assets-optimized-1" : who === "hero_female" ? "/models/heroes/hero-hana.glb?v=map-assets-optimized-1" : who === "yuki" ? "/models/dialogue/yuki.glb?v=dialogue-yuki-1" : `/models/heroes/hero-${who}.glb?v=map-assets-optimized-1`,
		));
		for (const url of models) {
			if (preloadedDialogueModels.current.has(url)) continue;
			preloadedDialogueModels.current.add(url);
			void fetch(url, { cache: "force-cache" })
				.then((response) => {
					if (!response.ok) throw new Error(`Unable to preload ${url}`);
					return response.arrayBuffer();
				})
				.catch(() => preloadedDialogueModels.current.delete(url));
		}
	}, [selected.region, selected.chapter, save.hero]);
	const [armed, setArmed] = useState(false);
	const [heroSelectorOpen, setHeroSelectorOpen] = useState(!save.heroChosen);
	const [pendingHero, setPendingHero] = useState(save.hero);
	const [heroSaving, setHeroSaving] = useState(false);
	const [heroSaveError, setHeroSaveError] = useState("");
	const [landmarks, setLandmarks] = useState<MapLandmarkLayout>(MAP_LANDMARKS);
	const [stageLayout, setStageLayout] = useState({ reading: READING_STOPS.map(([x, z]) => [x * MAP_WORLD_WIDTH, z * MAP_WORLD_DEPTH] as [number, number]), math: MATH_STOPS.map(([x, z]) => [x * MAP_WORLD_WIDTH, z * MAP_WORLD_DEPTH] as [number, number]) });
	const [sharedStart, setSharedStart] = useState<[number, number]>([...MAP_SHARED_START]);
	const [splineElements, setSplineElements] = useState<MapSplineElement[]>([{ id: "river-main", type: "river", points: MAP_RIVER_POINTS.map(([x, z]) => [x, z]) }]);
	const [splineType, setSplineType] = useState<MapSplineType>("river");
	const [editorOpen, setEditorOpen] = useState(false);
	const [landmarkKey, setLandmarkKey] = useState<keyof typeof MAP_LANDMARKS>("readingTree");
	const [pendingAssetKey, setPendingAssetKey] = useState<MapLandmarkKey | null>(null);
	const [editorTarget, setEditorTarget] = useState<MapEditorSelection | null>(null);
	const [assetRotations, setAssetRotations] = useState<Record<string, number>>({});
	const [decorations, setDecorations] = useState<MapDecoration[]>([]);
	const [erasedDecorations, setErasedDecorations] = useState<string[]>([]);
	const decorationsRef = useRef(decorations);
	decorationsRef.current = decorations;
	const [paintMode, setPaintMode] = useState<MapPaintMode>("select");
	const [brushKind, setBrushKind] = useState<MapDecoration["kind"]>("tree");
	const [brushModels, setBrushModels] = useState<Record<MapDecoration["kind"], string>>({ tree: AUTOMATIC_BRUSH_MODEL, flower: AUTOMATIC_BRUSH_MODEL, rock: AUTOMATIC_BRUSH_MODEL, bush: AUTOMATIC_BRUSH_MODEL });
	const brushStrokeRef = useRef<{ x: number; z: number; untilNext: number } | null>(null);
	const [editorMessage, setEditorMessage] = useState("");
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		void fetch("/api/dev/map-layout").then((r) => r.ok ? r.json() : null).then((data) => { if (data) { setLandmarks({ ...MAP_LANDMARKS, ...(data.landmarks ?? data) }); if (data.stages) setStageLayout(data.stages); if (Array.isArray(data.splines)) setSplineElements(data.splines); else if (data.river) setSplineElements([{ id: "river-main", type: "river", points: data.river }]); if (data.rotations) setAssetRotations(data.rotations); if (data.sharedStart) setSharedStart(data.sharedStart); if (data.decorations) setDecorations(data.decorations); if (data.erasedDecorations) setErasedDecorations(data.erasedDecorations); } }).catch(() => undefined);
	}, []);
	const saveMapLayout = async () => {
		try {
			const response = await fetch("/api/dev/map-layout", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				// Root landmark coordinates keep an already-running dev server compatible;
				// the nested copy is used by the current API and by the next page load.
				body: JSON.stringify({ ...landmarks, landmarks, stages: stageLayout, river: splineElements.find((element) => element.id === "river-main")?.points ?? [], splines: splineElements, rotations: assetRotations, sharedStart, decorations, erasedDecorations }),
			});
			const result = await response.json().catch(() => null) as { error?: string } | null;
			setEditorMessage(response.ok ? "Enregistré dans src/data/map-layout.json" : `Échec (${response.status}) : ${result?.error ?? response.statusText}`);
		} catch (error) {
			setEditorMessage(`Impossible de joindre le serveur : ${error instanceof Error ? error.message : "erreur inconnue"}`);
		}
	};
	const onEditorMove = (target: MapEditorSelection, x: number, z: number) => {
		if (target.kind === "asset" && target.key) {
			const key = target.key;
			setLandmarks((current) => ({ ...current, [key]: [x, z] }));
		} else if (target.kind === "stage" && target.region) {
			const region = target.region;
			setStageLayout((current) => ({ ...current, [region]: current[region].map((point, index) => index === target.index ? [x, z] : point) }));
		}
		else if (target.kind === "splinePoint" && target.splineId) setSplineElements((current) => current.map((element) => element.id === target.splineId ? { ...element, points: element.points.map((point, index) => index === target.index ? [x, z] : point) } : element));
		else if (target.kind === "start") setSharedStart([x, z]);
	};
	const addSplineEndpoint = (splineId: string, atStart: boolean) => {
		const spline = splineElements.find((element) => element.id === splineId);
		if (!spline || spline.points.length < 2) return;
		const first = atStart ? spline.points[0] : spline.points[spline.points.length - 1];
		const neighbor = atStart ? spline.points[1] : spline.points[spline.points.length - 2];
		let dx = first[0] - neighbor[0];
		let dz = first[1] - neighbor[1];
		const length = Math.hypot(dx, dz) || 1;
		dx = dx / length * 5;
		dz = dz / length * 5;
		const point: [number, number] = [Math.max(-5, Math.min(MAP_WORLD_WIDTH + 5, first[0] + dx)), Math.max(-5, Math.min(MAP_WORLD_DEPTH + 5, first[1] + dz))];
		setSplineElements((current) => current.map((element) => element.id === splineId ? { ...element, points: atStart ? [point, ...element.points] : [...element.points, point] } : element));
		setEditorTarget({ kind: "splinePoint", splineId, index: atStart ? 0 : spline.points.length });
	};
	const removeSplinePoint = (splineId: string, index: number) => {
		const spline = splineElements.find((element) => element.id === splineId);
		if (!spline || spline.points.length <= 2) return;
		setSplineElements((current) => current.map((element) => element.id === splineId ? { ...element, points: element.points.filter((_, pointIndex) => pointIndex !== index) } : element));
		setEditorTarget({ kind: "splinePoint", splineId, index: Math.max(0, Math.min(index, spline.points.length - 2)) });
	};
	const removeSpline = (splineId: string) => {
		setSplineElements((current) => current.filter((element) => element.id !== splineId));
		setEditorTarget(null);
	};
	const onEditorPaint = (x: number, z: number, phase: "start" | "move" | "end", previewModelUrl?: string) => {
		if (phase === "end") { brushStrokeRef.current = null; return; }
		if (paintMode === "spline") {
			if (phase === "start") {
				const left = Math.max(-5, x - 4);
				const right = Math.min(MAP_WORLD_WIDTH + 5, x + 4);
				const element: MapSplineElement = { id: `${splineType}-${crypto.randomUUID()}`, type: splineType, points: [[left, z], [right, z]] };
				setSplineElements((current) => [...current, element]);
				setEditorTarget({ kind: "splinePoint", splineId: element.id, index: 0 });
				setPaintMode("select");
			}
			return;
		}
		if (paintMode === "select" || paintMode === "asset") return;
		if (phase === "start") brushStrokeRef.current = null;
		const makeDecoration = (px: number, pz: number): MapDecoration => {
			const kind = brushKind;
			let modelUrl = previewModelUrl ?? brushModels[kind];
			if (modelUrl === AUTOMATIC_BRUSH_MODEL) {
				const mountain = mountainBlendAt(px, pz) >= 0.5;
				const biomeModels: Record<MapDecoration["kind"], string[]> = {
					tree: mountain ? ["/models/mountain-fir.glb"] : ["/models/forest-tree.glb", "/models/reading-tree.glb"],
					flower: mountain ? ["/models/mountain-wildflowers.glb"] : ["/models/map-forest-flower-patch.glb", "/models/map-blossom-tree.glb"],
					rock: mountain ? ["/models/mountain-rock-cluster.glb"] : ["/models/mossy-boulders.glb", "/models/map-riverbank-rock-cluster.glb"],
					bush: mountain ? ["/models/mountain-cushion-shrub.glb"] : ["/models/forest-understory.glb"],
				};
				const options = biomeModels[kind];
				modelUrl = options[Math.floor(Math.random() * options.length)];
			}
			return { id: crypto.randomUUID(), kind, x: px, z: pz, modelUrl, scale: 0.72 + Math.random() * 0.68, rotation: Math.random() * Math.PI * 2 };
		};
		if (paintMode === "erase") {
			const radius = MAP_ERASER_RADIUS;
			const next = decorationsRef.current.filter((item) => Math.hypot(item.x - x, item.z - z) > radius);
			if (next.length !== decorationsRef.current.length) { decorationsRef.current = next; setDecorations(next); }
			brushStrokeRef.current = { x, z, untilNext: 0 };
			return;
		}
		const stroke = brushStrokeRef.current;
		if (!stroke) {
			const first = makeDecoration(x, z);
			const next = [...decorationsRef.current, first];
			decorationsRef.current = next;
			setDecorations(next);
			brushStrokeRef.current = { x, z, untilNext: 2.4 + Math.random() * 2.8 };
			return;
		}
		const dx = x - stroke.x;
		const dz = z - stroke.z;
		const distance = Math.hypot(dx, dz);
		if (distance < stroke.untilNext) {
			brushStrokeRef.current = { x, z, untilNext: stroke.untilNext - distance };
			return;
		}
		const directionX = dx / (distance || 1);
		const directionZ = dz / (distance || 1);
		let travelled = stroke.untilNext;
		const additions: MapDecoration[] = [];
		while (travelled <= distance) {
			const jitter = (Math.random() - 0.5) * 2.2;
			const px = x - directionX * (distance - travelled) - directionZ * jitter;
			const pz = z - directionZ * (distance - travelled) + directionX * jitter;
			additions.push(makeDecoration(px, pz));
			travelled += 2.4 + Math.random() * 2.8;
		}
		const next = [...decorationsRef.current, ...additions];
		decorationsRef.current = next;
		setDecorations(next);
		brushStrokeRef.current = { x, z, untilNext: travelled - distance };
	};
	const onEditorErase = (ids: string[]) => {
		if (!ids.length) return;
		setErasedDecorations((current) => [...new Set([...current, ...ids])]);
	};
	const [introState, setIntroState] = useState<{ title?: string; index: number }>({ title: intro?.title, index: 0 });
	const [introExiting, setIntroExiting] = useState(false);
	const [dialogueBubblePosition, setDialogueBubblePosition] = useState<{ x: number; y: number } | null>(null);
	const onDialogueBubblePosition = useCallback((position: { x: number; y: number } | null) => {
		setDialogueBubblePosition((current) => {
			if (!position || !current) return position;
			return Math.abs(current.x - position.x) < 3 && Math.abs(current.y - position.y) < 3 ? current : position;
		});
	}, []);
	const exitTimer = useRef<number | null>(null);
	if (introState.title !== intro?.title) setIntroState({ title: intro?.title, index: 0 });
	if (!intro && introExiting) setIntroExiting(false);
	useEffect(() => () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current); }, []);
	const introIndex = introState.index;
	const introLine = intro?.lines[introIndex];
	const introText = introLine ? playerText(introLine.text, save.hero) : undefined;
	useEffect(() => {
		if (introText && save.settings.autoRead) {
			speak(speakable(introText), { recordedText: introText, ...(introLine?.who === "hero" ? { masculine: save.hero === "milo" } : {}) });
		}
		return () => stopSpeech();
	}, [introText, introLine?.who, save.hero, save.settings.autoRead]);
	const advanceIntro = () => {
		stopSpeech();
		if (!intro || !introLine) return;
		if (introIndex + 1 < intro.lines.length) {
			const nextIndex = introIndex + 1;
			setIntroState({ title: intro.title, index: nextIndex });
		} else {
			setIntroExiting(true);
			exitTimer.current = window.setTimeout(() => onIntroEnd?.(), 560);
		}
	};
	const closeIntro = () => {
		if (!intro || introExiting) return;
		stopSpeech();
		setIntroExiting(true);
		exitTimer.current = window.setTimeout(() => onIntroEnd?.(), 560);
	};
	const [mapLoadProgress, setMapLoadProgress] = useState<MapLoadProgress>({ loaded: 0, total: 1, complete: false });
	const [showMapLoading, setShowMapLoading] = useState(true);
	const mapLoadingStarted = useRef(false);
	const onMapLoadProgress = useCallback((progress: MapLoadProgress) => {
		if (!mapLoadingStarted.current) {
			mapLoadingStarted.current = true;
			setShowMapLoading(true);
		}
		setMapLoadProgress(progress);
	}, []);
	useEffect(() => {
		if (!mapLoadProgress.complete) return;
		setShowMapLoading(false);
	}, [mapLoadProgress.complete]);
	const centerOnStage = useCallback((region: MapStageRegion, chapter: number, behavior: ScrollBehavior = "smooth") => {
		const panel = scrollRef.current;
		if (!panel) return;
		const point = stopPoint(region, chapter);
		panel.scrollTo({
			left: Math.max(0, point.x - panel.clientWidth / 2),
			top: Math.max(0, point.y - panel.clientHeight / 2),
			behavior,
		});
	}, []);
	useLayoutEffect(() => {
		centerOnStage(selected.region, selected.chapter, "auto");
	}, [centerOnStage, selected.region, selected.chapter]);

	const chooseStage = (region: MapStageRegion, chapter: number, enter: () => void) => {
		if (armed && selected.region === region && selected.chapter === chapter) {
			enter();
			return;
		}
		onSelectStage(region === "intro" ? { region: "intro", chapter: 0 } : { region, chapter });
		setArmed(true);
		centerOnStage(region, chapter);
	};

	const jumpToRegion = (region: MapRegion) => {
		setArmed(false);
		const chapter = region === "reading"
			? incompleteReading < 0 ? CHAPTERS.length - 1 : incompleteReading
			: incompleteMath < 0 ? MATH_CHAPTERS.length - 1 : incompleteMath;
		onSelectStage({ region, chapter });
		centerOnStage(region, chapter);
	};

	const stageMarkers: StageMarkerData[] = [
		{
			region: "intro",
			index: 0,
			label: "✦",
			title: "Le carrefour des découvertes",
			stars: 0,
			maxStars: 0,
			unlocked: true,
			done: Boolean(save.seenIntro[-1]),
			current: selected.region === "intro",
			confirming: selected.region === "intro" && armed,
		},
		...CHAPTERS.map((chapter, index) => {
			const missions = chapterMissions(chapter.id);
			const first = missions[0];
			return {
				region: "reading" as const,
				index,
				label: chapter.label,
				title: chapter.title,
				stars: missions.reduce((sum, mission) => sum + (save.stars[mission.id] ?? 0), 0),
				maxStars: missions.length * 3,
				unlocked: first ? isMissionUnlocked(save, first) : false,
				done: chapterComplete(chapter, save),
				current: selected.region === "reading" && selected.chapter === chapter.id,
				confirming: selected.region === "reading" && selected.chapter === chapter.id && armed,
			};
		}),
		...MATH_CHAPTERS.map((chapter, index) => {
			const missions = mathChapterMissions(chapter.id);
			const first = missions[0];
			return {
				region: "math" as const,
				index,
				label: chapter.label,
				title: chapter.title,
				stars: missions.reduce((sum, mission) => sum + (save.stars[mission.id] ?? 0), 0),
				maxStars: missions.length * 3,
				unlocked: first ? isMathMissionUnlocked(save, first) : false,
				done: mathChapterComplete(chapter, save),
				current: selected.region === "math" && selected.chapter === chapter.id,
				confirming: selected.region === "math" && selected.chapter === chapter.id && armed,
			};
		}),
	];
	const splineTopology = splineElements.map(({ id, type, points }) => [id, type, points.length]);
	const mapLayoutKey = `${MAP_WORLD_WIDTH}x${MAP_WORLD_DEPTH}:${JSON.stringify(sharedStart)}:${JSON.stringify(stageLayout)}:${JSON.stringify(splineTopology)}:${JSON.stringify(landmarks)}:${JSON.stringify(assetRotations)}:${stageMarkers.map(({ region, index }) => `${region}-${index}`).join(",")}`;
	const selectedMapPosition = editorTarget?.kind === "asset" && editorTarget.key
		? landmarks[editorTarget.key]
		: editorTarget?.kind === "stage" && editorTarget.region
			? stageLayout[editorTarget.region][editorTarget.index]
			: editorTarget?.kind === "splinePoint" && editorTarget.splineId
				? splineElements.find(({ id }) => id === editorTarget.splineId)?.points[editorTarget.index]
				: editorTarget?.kind === "start" ? sharedStart : null;
	const onSceneStageClick = (region: MapStageRegion, index: number) => {
		if (region === "intro") {
			chooseStage("intro", 0, onWorldIntro);
			return;
		}
		if (region === "reading") {
			const chapter = CHAPTERS[index];
			if (chapter) chooseStage(region, chapter.id, () => onReading(chapter.id));
		} else {
			const chapter = MATH_CHAPTERS[index];
			if (chapter) chooseStage(region, chapter.id, () => onMath(chapter.id));
		}
	};

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button, [data-map-scene]")) return;
		const panel = scrollRef.current;
		if (!panel) return;
		dragRef.current = { x: event.clientX, y: event.clientY, left: panel.scrollLeft, top: panel.scrollTop };
		event.currentTarget.setPointerCapture(event.pointerId);
	};
	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		const panel = scrollRef.current;
		if (!drag || !panel) return;
		panel.scrollLeft = drag.left - (event.clientX - drag.x);
		panel.scrollTop = drag.top - (event.clientY - drag.y);
	};

	return (
		<main className="fixed inset-0 z-40 overflow-hidden bg-[#172b37] text-white">
			<section
				ref={scrollRef}
				aria-label="Carte du monde à explorer"
				className={`absolute inset-0 overscroll-contain ${intro ? "overflow-hidden" : "overflow-auto cursor-grab active:cursor-grabbing"}`}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={() => { dragRef.current = null; }}
				onPointerCancel={() => { dragRef.current = null; }}
			>
				<div className="relative" style={{ width: WORLD_PIXEL_WIDTH, height: WORLD_PIXEL_HEIGHT }}>
					<IsoWorldScene containerRef={scrollRef} layoutKey={mapLayoutKey} stageMarkers={stageMarkers} landmarks={landmarks} pendingAssetKey={pendingAssetKey} stageLayout={stageLayout} sharedStart={sharedStart} splineElements={splineElements} splineType={splineType} assetRotations={assetRotations} decorations={decorations} erasedDecorations={erasedDecorations} editorMode={editorOpen} paintMode={paintMode} brushKind={brushKind} brushModel={brushModels[brushKind]} onEditorSelect={(target) => { setEditorTarget(target); if (target?.kind === "asset" && target.key) { setLandmarkKey(target.key); setPendingAssetKey(null); } }} onEditorMove={onEditorMove} onEditorPaint={onEditorPaint} onEditorErase={onEditorErase} hero={save.hero} cinematic={Boolean(intro)} dialogueSpeaker={introLine ? introLine.who === "hero" ? heroSceneSpeaker(save.hero === "milo") : introLine.who : null} dialogueCharacters={intro?.lines.map((line) => line.who === "hero" ? heroSceneSpeaker(save.hero === "milo") : line.who) ?? []} dialogueExiting={introExiting} onDialogueBubblePosition={onDialogueBubblePosition} onStageClick={onSceneStageClick} onLoadProgress={onMapLoadProgress} />
					<nav className="sr-only" aria-label="Étapes accessibles de la carte">
						<button type="button" aria-label={`Le carrefour des découvertes, histoire d’introduction${save.seenIntro[-1] ? ", déjà vue" : ""}`} onClick={() => chooseStage("intro", 0, onWorldIntro)}>Le carrefour des découvertes</button>
					{CHAPTERS.map((chapter) => {
						const first = MISSIONS.find((mission) => mission.chapter === chapter.id);
						const unlocked = first ? isMissionUnlocked(save, first) : false;
						const current = selected.region === "reading" && selected.chapter === chapter.id;
						return <MapStop key={`read-${chapter.id}`} chapter={chapter} region="reading" unlocked={unlocked} done={chapterComplete(chapter, save)} current={current} confirming={current && armed} onClick={() => unlocked && chooseStage("reading", chapter.id, () => onReading(chapter.id))} />;
					})}
					{MATH_CHAPTERS.map((chapter) => {
						const first = mathChapterMissions(chapter.id)[0];
						const unlocked = first ? isMathMissionUnlocked(save, first) : false;
						const current = selected.region === "math" && selected.chapter === chapter.id;
						return <MapStop key={`math-${chapter.id}`} chapter={chapter} region="math" unlocked={unlocked} done={mathChapterComplete(chapter, save)} current={current} confirming={current && armed} onClick={() => unlocked && chooseStage("math", chapter.id, () => onMath(chapter.id))} />;
					})}
					</nav>
				</div>
			</section>

			{!backgroundOnly && <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-2 sm:p-3">
				<div className="pointer-events-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[1.4rem] border border-white/30 bg-slate-950/65 px-3 py-2 shadow-[0_10px_36px_rgba(9,18,29,0.48)] backdrop-blur-xl sm:flex-nowrap sm:px-4">
					<div className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:flex-initial sm:gap-3">
						<button type="button" onClick={() => { setPendingHero(save.hero); setHeroSaveError(""); setHeroSelectorOpen(true); }} aria-label={`Choisir un personnage, actuellement ${HEROES.find((hero) => hero.id === save.hero)?.label ?? save.hero}`} className="btn-pop relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/90 bg-gradient-to-br from-pink-300 via-fuchsia-500 to-violet-700 p-0 shadow-[0_2px_12px_rgba(255,119,211,0.45)] sm:h-[3.25rem] sm:w-[3.25rem]">
							<img src={IMAGES[save.hero]} alt="" className="h-full w-full object-contain object-bottom" />
						</button>
						<span className="min-w-0 flex-1 sm:w-[15rem] sm:flex-none">
							<span className="block truncate text-[10px] font-bold tracking-[0.13em] text-cyan-100 sm:text-[11px]">{save.name ? `À TOI DE JOUER, ${save.name.toLocaleUpperCase()} !` : "À TOI DE JOUER !"}</span>
							<span className="block truncate text-base font-bold leading-tight text-white drop-shadow-[0_2px_5px_rgba(249,96,209,0.8)] sm:text-lg">Le monde des découvertes</span>
							<span className="mt-1 flex items-center gap-2">
								<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20 sm:w-44 sm:flex-none"><span className="block h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-500" style={{ width: `${overallProgress}%` }} /></span>
								<span className="text-[9px] font-semibold tracking-wide text-white/75">PROGRESSION</span>
							</span>
						</span>
					</div>
					<div className="hidden items-center gap-2 border-x border-white/20 px-5 sm:flex">
						<img src={UI_ICONS.star} alt="" className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_rgba(255,207,76,0.6)]" />
						<span className="whitespace-nowrap text-lg font-bold tabular-nums text-white sm:text-xl">{totalStars}<span className="text-white/60">/{totalMaxStars}</span></span>
					</div>
					<div className="ml-auto flex items-center justify-end gap-1.5 sm:ml-0 sm:gap-2">
						<button type="button" onClick={() => jumpToRegion("reading")} aria-label={`Aller à la Forêt de la Lecture, ${readingStars} étoiles sur ${readingMaxStars}`} className="btn-pop flex h-9 items-center gap-1 rounded-full border border-pink-100/75 bg-fuchsia-700/90 px-2 text-[11px] font-bold shadow-inner shadow-white/15 sm:h-10 sm:gap-2 sm:px-3 sm:text-sm">
							<img src={UI_ICONS.book} alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" /><span>Lecture</span><span className="rounded-full bg-black/20 px-1.5 py-0.5 tabular-nums">{readingStars}/{readingMaxStars}</span>
						</button>
						<button type="button" onClick={() => jumpToRegion("math")} aria-label={`Aller aux Montagnes des Nombres, ${mathStars} étoiles sur ${mathMaxStars}`} className="btn-pop flex h-9 items-center gap-1 rounded-full border border-cyan-100/75 bg-cyan-800/90 px-2 text-[11px] font-bold shadow-inner shadow-white/15 sm:h-10 sm:gap-2 sm:px-3 sm:text-sm">
							<img src={UI_ICONS.math} alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" /><span>Maths</span><span className="rounded-full bg-black/20 px-1.5 py-0.5 tabular-nums">{mathStars}/{mathMaxStars}</span>
						</button>
						<button type="button" onClick={onSettings} aria-label="Réglages" className="btn-pop glass flex h-9 w-9 items-center justify-center rounded-full border-white/35 bg-slate-800/70 p-0 sm:h-10 sm:w-10"><img src={UI_ICONS.settings} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" /></button>
					</div>
				</div>
			</header>}
			{!backgroundOnly && heroSelectorOpen && !showMapLoading && !intro && <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="hero-selector-title">
				<section className="glass anim-pop w-full max-w-xl rounded-[2rem] border border-white/35 bg-[#160e2d]/90 px-4 pb-5 pt-4 shadow-[0_20px_70px_rgba(0,0,0,.65)] sm:px-7 sm:pb-7 sm:pt-6">
					<h2 id="hero-selector-title" className="text-center text-lg font-black tracking-wide text-white sm:text-2xl">Choisis ton personnage</h2>
					<div className="mx-auto mt-2 max-w-lg">
						<HeroCarousel3D
							heroes={HEROES}
							selected={pendingHero}
							onSelect={(hero) => {
				const option = HEROES.find((item) => item.id === hero);
				if (!option) return;
								setPendingHero(hero);
								configureSpeech({ masculine: hero === "milo" });
								speak(option.label);
							}}
						/>
					</div>
					{heroSaveError && <p role="alert" className="mt-2 text-center text-sm font-bold text-rose-200">{heroSaveError}</p>}
					<button type="button" disabled={heroSaving} onClick={async () => {
						setHeroSaving(true);
						setHeroSaveError("");
						try {
							await onHeroChange(pendingHero);
							configureSpeech({ masculine: pendingHero === "milo" });
							setHeroSelectorOpen(false);
						} catch {
							setHeroSaveError("Impossible d’enregistrer ce choix. Réessaie.");
						} finally {
							setHeroSaving(false);
						}
					}} className="btn-pop mx-auto mt-3 block rounded-full border-2 border-white/80 bg-gradient-to-r from-yellow-200 via-amber-300 to-pink-300 px-8 py-3 text-lg font-black text-purple-950 shadow-[0_8px_28px_rgba(255,214,91,.4)] disabled:cursor-wait disabled:opacity-60 sm:text-xl">
						{heroSaving ? "Enregistrement…" : `Confirmer ${HEROES.find((hero) => hero.id === pendingHero)?.label}`}
					</button>
				</section>
			</div>}
			{!backgroundOnly && <div className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-full glass bg-[#24163c]/75 px-3 py-1.5 text-[10px] sm:bottom-5 sm:right-5 sm:text-xs">Fais glisser la carte ↔ ↕ pour explorer</div>}
			{import.meta.env.DEV && !backgroundOnly && <div className="pointer-events-auto absolute bottom-3 left-3 z-40">
				{!editorOpen && <button type="button" onClick={() => { setEditorOpen(true); setEditorTarget(null); setPendingAssetKey(null); }} className="rounded-xl border border-white/30 bg-slate-950/85 px-3 py-2 text-sm font-bold shadow-xl">Éditer la carte</button>}
				{editorOpen && <div className="mt-2 max-h-[78vh] w-[min(960px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/20 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
					<div className={`grid grid-cols-1 gap-2 ${paintMode === "select" ? "md:grid-cols-[220px_220px]" : "md:grid-cols-[220px_minmax(220px,1fr)_220px]"}`}>
					<div className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5">
					<p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Outils de carte</p>
					<div className="mt-2 grid grid-cols-4 gap-1.5">
						{([ ["select", "↖", "Sélection"], ["brush", "🖌️", "Pinceau"], ["spline", "〰️", "Spline"], ["asset", "🏛️", "Assets spéciaux"], ["erase", "⌫", "Gomme"] ] as [MapPaintMode, string, string][]).map(([mode, icon, label]) => <button key={mode} type="button" aria-pressed={paintMode === mode} onClick={() => { setPaintMode(mode); setEditorTarget(null); setPendingAssetKey(null); brushStrokeRef.current = null; }} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-bold ${paintMode === mode ? "border-fuchsia-300 bg-fuchsia-600/80 text-white shadow-[0_0_16px_rgba(217,70,239,.25)]" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}><span className="text-base" aria-hidden="true">{icon}</span><span className="text-center leading-tight">{label}</span></button>)}
					</div>
					<div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3">
						<button type="button" onClick={() => { setEditorOpen(false); setEditorTarget(null); setPendingAssetKey(null); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-white/75 hover:bg-white/10">Fermer éditeur</button>
						<button type="button" onClick={() => void saveMapLayout()} className="rounded-lg bg-fuchsia-700 px-2 py-2 text-[10px] font-bold text-white hover:bg-fuchsia-600">Enregistrer dans le dépôt</button>
					</div>
					</div>
					{paintMode !== "select" && <div className="min-h-32 rounded-xl border border-white/10 bg-slate-900/60 p-2.5">
					<p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Éléments à poser</p>
					{paintMode === "brush" && <section className="mt-1">
						<div className="mb-2 grid grid-cols-2 gap-1">{([ ["tree", "🌲 Arbres"], ["flower", "🌼 Fleurs"], ["rock", "🪨 Rochers"], ["bush", "🌿 Buissons"] ] as [MapDecoration["kind"], string][]).map(([kind, label]) => <button key={kind} type="button" aria-pressed={brushKind === kind} onClick={() => setBrushKind(kind)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${brushKind === kind ? "border-cyan-300 bg-cyan-800/50 text-white" : "border-white/10 bg-white/5 text-white/65"}`}>{label}</button>)}</div>
						<p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">Modèles · {brushKind === "tree" ? "arbres" : brushKind === "flower" ? "fleurs" : brushKind === "rock" ? "rochers" : "buissons"}</p>
						<button type="button" aria-pressed={brushModels[brushKind] === AUTOMATIC_BRUSH_MODEL} onClick={() => setBrushModels((current) => ({ ...current, [brushKind]: AUTOMATIC_BRUSH_MODEL }))} className={`mb-1.5 w-full rounded-lg border px-2 py-2 text-left text-[10px] font-bold ${brushModels[brushKind] === AUTOMATIC_BRUSH_MODEL ? "border-emerald-300 bg-emerald-700/30 text-white" : "border-white/10 bg-white/5 text-white/70"}`}>✨ Automatique · aléatoire selon le biome</button>
						<div className="grid grid-cols-2 gap-1.5">{MAP_BRUSH_ASSETS[brushKind].map(({ label, modelUrl }) => <button key={modelUrl} type="button" aria-pressed={brushModels[brushKind] === modelUrl} onClick={() => setBrushModels((current) => ({ ...current, [brushKind]: modelUrl }))} className={`rounded-lg border px-2 py-2 text-left text-[10px] font-semibold ${brushModels[brushKind] === modelUrl ? "border-emerald-300 bg-emerald-700/30 text-white" : "border-white/10 bg-white/5 text-white/70"}`}>{label}</button>)}</div>
						<p className="mt-1.5 text-[10px] text-white/50">Automatique choisit un modèle compatible à chaque élément peint.</p>
					</section>}
					{paintMode === "spline" && <section className="mt-3 border-t border-white/10 pt-3">
						<p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">Type de spline</p>
						<div className="grid grid-cols-2 gap-1.5">{([ ["river", "🌊", "Rivière"], ["fence", "🪵", "Clôture"], ["cliff", "🪨", "Falaise"], ["talus", "⛰️", "Talus"] ] as [MapSplineType, string, string][]).map(([type, icon, label]) => <button key={type} type="button" aria-pressed={splineType === type} onClick={() => setSplineType(type)} className={`rounded-lg border px-2 py-2 text-left text-[10px] font-bold ${splineType === type ? "border-cyan-300 bg-cyan-800/50 text-white" : "border-white/10 bg-white/5 text-white/70"}`}>{icon} {label}</button>)}</div>
						<p className="mt-2 text-[10px] text-white/55">Clique sur la carte pour ajouter un tracé.</p>
					</section>}
					{paintMode === "asset" && <section className="mt-3 border-t border-white/10 pt-3">
						<p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">Assets spéciaux</p>
						<div className="grid grid-cols-3 gap-1">{MAP_SPECIAL_ASSETS.map(({ key, label, icon }) => { const position = landmarks[key]; const isPending = pendingAssetKey === key; return <button key={key} type="button" aria-label={`${label}, ${position ? "placé" : "à placer"}`} title={`${label} · ${position ? "Placé" : isPending ? "À placer" : "Disponible"}`} onClick={() => { setLandmarkKey(key); if (position) { setPaintMode("select"); setPendingAssetKey(null); setEditorTarget({ kind: "asset", key, index: 0 }); const map = scrollRef.current; if (map) map.scrollTo({ left: position[0] * WORLD_PIXEL_WIDTH / MAP_WORLD_WIDTH - map.clientWidth / 2, top: position[1] * WORLD_PIXEL_HEIGHT / MAP_WORLD_DEPTH - map.clientHeight / 2, behavior: "smooth" }); } else { setEditorTarget(null); setPendingAssetKey(key); } }} className={`relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-0.5 text-center ${isPending ? "border-amber-300 bg-amber-500/25" : "border-white/10 bg-white/5 hover:bg-white/10"}`}><span className="text-sm leading-none">{icon}</span><span className="w-full truncate text-[8px] font-semibold leading-tight">{label}</span><span aria-hidden="true" className={`absolute right-1 top-1 text-[7px] leading-none ${position ? "text-emerald-300" : isPending ? "text-amber-200" : "text-white/25"}`}>{position ? "●" : isPending ? "◉" : "○"}</span></button>; })}</div>
						{pendingAssetKey && <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-100">Clique sur la carte pour placer {MAP_SPECIAL_ASSETS.find((asset) => asset.key === pendingAssetKey)?.label}.</p>}
					</section>}
					{paintMode === "erase" && <p className="rounded-lg bg-white/5 px-2 py-2 text-[10px] text-white/55">La gomme retire les éléments peints au passage du curseur.</p>}
					</div>}
					<div className="min-h-32 rounded-xl border border-white/10 bg-slate-900/60 p-2.5">
					<section>
						<p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">Propriétés de la sélection</p>
						{paintMode !== "select" && <p className="rounded-lg bg-white/5 px-2 py-2 text-[10px] text-white/50">Passe en mode sélection pour consulter ou modifier les propriétés.</p>}
						{paintMode === "select" && !editorTarget && <p className="rounded-lg bg-white/5 px-2 py-2 text-[10px] text-white/50">Sélectionne un élément ou une poignée sur la carte.</p>}
						{paintMode === "select" && editorTarget && <><p className="rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-amber-100">{editorTarget.kind === "asset" ? MAP_SPECIAL_ASSETS.find(({ key }) => key === editorTarget.key)?.label ?? landmarkKey : editorTarget.kind === "stage" ? `Étape ${editorTarget.index + 1} · ${editorTarget.region === "reading" ? "lecture" : "maths"}` : editorTarget.kind === "splinePoint" ? `${MAP_SPLINE_LABELS[splineElements.find(({ id }) => id === editorTarget.splineId)?.type ?? "river"]} · point ${editorTarget.index + 1}` : "Départ commun"}</p>
							{selectedMapPosition && <p className="mt-1 px-1 text-[10px] tabular-nums text-white/55">Position · X {selectedMapPosition[0].toFixed(1)} / Z {selectedMapPosition[1].toFixed(1)}</p>}
							{editorTarget.kind === "splinePoint" && editorTarget.splineId && <div className="mt-2 grid grid-cols-2 gap-1.5"><button type="button" onClick={() => addSplineEndpoint(editorTarget.splineId!, true)} className="rounded-lg bg-cyan-900/80 px-2 py-1.5 text-[10px] font-bold">＋ Début de spline</button><button type="button" onClick={() => addSplineEndpoint(editorTarget.splineId!, false)} className="rounded-lg bg-cyan-900/80 px-2 py-1.5 text-[10px] font-bold">＋ Fin de spline</button><button type="button" disabled={(splineElements.find((element) => element.id === editorTarget.splineId)?.points.length ?? 0) <= 2} onClick={() => removeSplinePoint(editorTarget.splineId!, editorTarget.index)} className="rounded-lg bg-rose-900/80 px-2 py-1.5 text-[10px] font-bold disabled:opacity-40">⌫ Supprimer ce point</button><button type="button" onClick={() => removeSpline(editorTarget.splineId!)} className="rounded-lg bg-rose-950 px-2 py-1.5 text-[10px] font-bold">Retirer ce tracé</button></div>}
							{editorTarget.kind === "asset" && editorTarget.key && <div className="mt-2 flex items-center gap-1.5"><button type="button" aria-label="Tourner à gauche" onClick={()=>setAssetRotations(v=>({...v,[editorTarget.key!]: (v[editorTarget.key!]??0)-Math.PI/12}))} className="rounded bg-slate-700 px-3 py-1">↶</button><span className="flex-1 text-center text-xs tabular-nums">{((assetRotations[editorTarget.key]??0)*180/Math.PI).toFixed(0)}°</span><button type="button" aria-label="Tourner à droite" onClick={()=>setAssetRotations(v=>({...v,[editorTarget.key!]: (v[editorTarget.key!]??0)+Math.PI/12}))} className="rounded bg-slate-700 px-3 py-1">↷</button><button type="button" aria-label="Retirer cet asset" onClick={()=>{setLandmarks(current=>({...current,[editorTarget.key!]:null}));setEditorTarget(null);}} className="rounded bg-rose-800 px-2 py-1 text-xs">Retirer</button></div>}
						</>}
					</section>
					</div>
					</div>
					{editorMessage && <p className="mt-2 text-xs text-emerald-200">{editorMessage}</p>}
				</div>}
			</div>}
			{intro && introLine && <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-500 ${introExiting ? "opacity-0" : "opacity-100"}`}>
				{(() => { const speaker = introLine.who === "hero" ? HERO_INFO[save.hero] ?? HERO_INFO.hana : SPEAKER_INFO[introLine.who] ?? SPEAKER_INFO.mochi; return <>
				<div className="absolute inset-x-0 top-[5.5rem] text-center sm:top-24">
					<span className="rounded-full border border-white/30 bg-slate-950/70 px-5 py-2 text-sm font-extrabold text-white shadow-lg backdrop-blur-md sm:text-base">{intro.title}</span>
				</div>
				{(() => {
					const speakers = [...new Set(intro.lines.map(({ who }) => who).filter((who) => who !== "hero"))];
					const participantCount = speakers.length + 1;
					const participantIndex = introLine.who === "hero" ? 0 : speakers.indexOf(introLine.who) + 1;
					const leftSlot = participantCount === 2 ? [0.35, 0.65][participantIndex]
						: participantCount === 3 ? [0.22, 0.5, 0.78][participantIndex]
							: 0.15 + 0.7 * participantIndex / Math.max(1, participantCount - 1);
					const left = window.innerWidth * leftSlot;
					const top = dialogueBubblePosition ? Math.max(150, dialogueBubblePosition.y - 12) : window.innerHeight * 0.3;
					const text = introLine.who === "hero" ? playerText(introLine.text, save.hero) : introLine.text;
					const background = introLine.who === "mochi" ? "#f4edff" : `${speaker.color}e8`;
					const foreground = introLine.who === "mochi" ? "#321b50" : "#ffffff";
					return <div
						key={`${introIndex}-${introLine.who}`}
						className={`absolute w-[min(88vw,34rem)] rounded-3xl border-2 border-white/90 px-4 py-3 text-center text-base font-bold leading-snug shadow-[0_12px_40px_rgba(0,0,0,.55)] backdrop-blur-md transition-opacity sm:px-5 sm:py-4 sm:text-xl ${dialogueBubblePosition ? "opacity-100" : "opacity-0"}`}
						style={{ left, top, transform: "translate(-50%, -100%)", backgroundColor: background, color: foreground }}
					>
						<span className="mb-1 block text-xs font-black uppercase tracking-widest opacity-80">{speaker.name}</span>
						{text}
						<span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white/90" style={{ backgroundColor: background }} />
						<span className="pointer-events-auto absolute -right-3 -top-3"><SpeakButton text={speakable(text)} speechOptions={{ masculine: introLine.who === "hero" ? save.hero === "milo" : undefined, recordedText: text }} size="sm" /></span>
					</div>;
				})()}
				</>; })()}
				<div className="pointer-events-auto absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 sm:bottom-5">
					<span className="rounded-full border border-white/30 bg-slate-950/75 px-3 py-2 text-xs font-bold text-white shadow-lg">{introIndex + 1} / {intro.lines.length}</span>
					<BigButton color="yellow" onClick={advanceIntro} className="!px-5 !py-2.5 !text-base sm:!px-6 sm:!py-3 sm:!text-lg">{introIndex + 1 < intro.lines.length ? "Suivant ▶" : "C'est parti ! ⚡"}</BigButton>
					<button type="button" onClick={closeIntro} className="rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white/80 underline underline-offset-2">Passer</button>
				</div>
			</div>}
			{showMapLoading && !intro && <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#101b22]/90 px-6 backdrop-blur-md" role="status" aria-live="polite">
				<div className="w-full max-w-sm rounded-[1.75rem] border border-white/20 bg-slate-950/75 p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
					<div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber-100/50 bg-gradient-to-br from-fuchsia-500/40 to-cyan-400/30 text-3xl shadow-[0_0_28px_rgba(227,71,168,0.35)]" aria-hidden="true">✦</div>
					<p className="text-xs font-bold tracking-[0.18em] text-cyan-100">LE MONDE DES DÉCOUVERTES</p>
					<p className="mt-2 text-lg font-extrabold text-white">Préparation de la carte…</p>
					<p className="mt-1 text-sm text-white/65">Chargement des éléments autour de toi</p>
					<div className="mt-5 h-3 overflow-hidden rounded-full border border-white/20 bg-black/40" role="progressbar" aria-label="Chargement de la carte" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mapLoadProgress.loaded / Math.max(1, mapLoadProgress.total) * 100)}>
						<div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-pink-300 to-cyan-300 shadow-[0_0_18px_rgba(255,123,218,0.65)] transition-[width] duration-300" style={{ width: `${Math.min(100, Math.round(mapLoadProgress.loaded / Math.max(1, mapLoadProgress.total) * 100))}%` }} />
					</div>
					<p className="mt-2 text-xs font-semibold tabular-nums text-white/60">{Math.min(100, Math.round(mapLoadProgress.loaded / Math.max(1, mapLoadProgress.total) * 100))}%</p>
				</div>
			</div>}
		</main>
	);
}

function chapterComplete(chapter: LetterChapter, save: Save) {
	const missions = MISSIONS.filter((mission) => mission.chapter === chapter.id);
	return missions.length > 0 && missions.every((mission) => (save.stars[mission.id] ?? 0) > 0);
}

function mathChapterComplete(chapter: MathChapter, save: Save) {
	const missions = mathChapterMissions(chapter.id);
	return missions.length > 0 && missions.every((mission) => (save.stars[mission.id] ?? 0) > 0);
}

function MapStop({ chapter, region, unlocked, done, current, confirming, onClick }: {
	chapter: LetterChapter | MathChapter; region: MapRegion; unlocked: boolean;
	done: boolean; current: boolean; confirming: boolean; onClick: () => void;
}) {
	const state = !unlocked ? "verrouillé" : confirming ? "reclique pour lancer l’exercice" : current ? "étape actuelle" : done ? "terminé" : "accessible";
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!unlocked}
			aria-label={`${chapter.title}, ${region === "reading" ? "lecture" : "mathématiques"}, ${state}`}
			className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-24 focus:z-50 focus:rounded-xl focus:bg-violet-950 focus:p-3 focus:text-white focus:ring-2 focus:ring-yellow-200"
		>
			{chapter.title}
		</button>
	);
}
