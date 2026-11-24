import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BigButton, IMAGES, SPEAKER_INFO, SpeakButton, UI_ICONS, playerText } from "../components/ui";
import { MATH_CHAPTERS, MATH_MISSIONS, mathChapterMissions, type MathChapter } from "../data/math";
import { CHAPTERS, MISSIONS, WORLD_INTRO_LINES, type Chapter, type Line } from "../data/story";
import { configureSpeech, speak, stopSpeech } from "../lib/speech";
import { speakable } from "./Dialog";
import type { Save } from "../lib/storage";
import { HeroCarousel3D, type HeroOption } from "../components/HeroCarousel3D";
import { isMathMissionUnlocked } from "./Math";
import { chapterMissions, isMissionUnlocked } from "./Map";
import { MAP_LANDMARKS, MAP_SHARED_START, MAP_WORLD_DEPTH, MAP_WORLD_WIDTH, MATH_STOPS, mountainBlendAt, READING_STOPS } from "./map-layout";
import {
	IsoWorldScene,
	MAP_ERASER_RADIUS,
	type MapEditorSelection,
	type MapDecoration,
	type MapPaintMode,
	type MapLoadProgress,
	type StageMarkerData,
	WORLD_PIXEL_HEIGHT,
	WORLD_PIXEL_WIDTH,
} from "./IsoWorldScene";

export type MapRegion = "reading" | "math";
const HEROES: HeroOption[] = [
	{ id: "hana", label: "Hana", color: "#ff4fa3" },
	{ id: "yuki", label: "Luna", color: "#34c3ff" },
	{ id: "momo", label: "Mia", color: "#b36bff" },
	{ id: "milo", label: "Milo", color: "#35d5e7" },
	{ id: "zelane", label: "Zélane", color: "#f6c445" },
];
type MapStageRegion = MapRegion | "intro";
export type MapStageSelection = { region: MapRegion; chapter: number } | { region: "intro"; chapter: 0 };

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
		const lines = selected.region === "intro" ? WORLD_INTRO_LINES : CHAPTERS[selected.chapter]?.intro ?? [];
		const models = new Set(lines.map(({ who }) => who).filter((who) => who !== save.hero).map((who) =>
			who === "mochi" ? "/models/dialogue/mochi.glb?v=map-assets-optimized-1" : who === "king" ? "/models/dialogue/king-chuuut.glb?v=map-assets-optimized-1" : who === "zelane" ? "/models/heroes/hero-zelane-compressed.glb?v=map-assets-optimized-1" : `/models/heroes/hero-${who}.glb?v=map-assets-optimized-1`,
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
	const [landmarks, setLandmarks] = useState<typeof MAP_LANDMARKS>(MAP_LANDMARKS);
	const [stageLayout, setStageLayout] = useState({ reading: READING_STOPS.map(([x, z]) => [x * MAP_WORLD_WIDTH, z * MAP_WORLD_DEPTH] as [number, number]), math: MATH_STOPS.map(([x, z]) => [x * MAP_WORLD_WIDTH, z * MAP_WORLD_DEPTH] as [number, number]) });
	const [sharedStart, setSharedStart] = useState<[number, number]>([...MAP_SHARED_START]);
	const [riverPoints, setRiverPoints] = useState<[number, number][]>([[ -5,37 ],[4,37],[14,37],[21,32],[28,28],[38,21.5],[48,17.5],[58,8.5],[68,5.5],[78,-2]]);
	const [editorOpen, setEditorOpen] = useState(false);
	const [landmarkKey, setLandmarkKey] = useState<keyof typeof MAP_LANDMARKS>("readingTree");
	const [editorTarget, setEditorTarget] = useState<MapEditorSelection | null>(null);
	const [assetRotations, setAssetRotations] = useState<Record<string, number>>({});
	const [decorations, setDecorations] = useState<MapDecoration[]>([]);
	const [erasedDecorations, setErasedDecorations] = useState<string[]>([]);
	const decorationsRef = useRef(decorations);
	decorationsRef.current = decorations;
	const [paintMode, setPaintMode] = useState<MapPaintMode>("select");
	const brushStrokeRef = useRef<{ x: number; z: number; untilNext: number } | null>(null);
	const [editorMessage, setEditorMessage] = useState("");
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		void fetch("/api/dev/map-layout").then((r) => r.ok ? r.json() : null).then((data) => { if (data) { setLandmarks(data.landmarks ?? data); if (data.stages) setStageLayout(data.stages); if (data.river) setRiverPoints(data.river); if (data.rotations) setAssetRotations(data.rotations); if (data.sharedStart) setSharedStart(data.sharedStart); if (data.decorations) setDecorations(data.decorations); if (data.erasedDecorations) setErasedDecorations(data.erasedDecorations); } }).catch(() => undefined);
	}, []);
	const saveMapLayout = async () => {
		try {
			const response = await fetch("/api/dev/map-layout", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				// Root landmark coordinates keep an already-running dev server compatible;
				// the nested copy is used by the current API and by the next page load.
				body: JSON.stringify({ ...landmarks, landmarks, stages: stageLayout, river: riverPoints, rotations: assetRotations, sharedStart, decorations, erasedDecorations }),
			});
			const result = await response.json().catch(() => null) as { error?: string } | null;
			setEditorMessage(response.ok ? "Enregistré dans src/data/map-layout.json" : `Échec (${response.status}) : ${result?.error ?? response.statusText}`);
		} catch (error) {
			setEditorMessage(`Impossible de joindre le serveur : ${error instanceof Error ? error.message : "erreur inconnue"}`);
		}
	};
	const onEditorMove = (target: MapEditorSelection, x: number, z: number) => {
		if (target.kind === "asset" && target.key) setLandmarks((current) => ({ ...current, [target.key!]: [x, z] }));
		else if (target.kind === "stage" && target.region) setStageLayout((current) => ({ ...current, [target.region!]: current[target.region!].map((point, index) => index === target.index ? [x, z] : point) }));
		else if (target.kind === "river") setRiverPoints((current) => current.map((point, index) => index === target.index ? [x, z] : point));
		else if (target.kind === "start") setSharedStart([x, z]);
	};
	const onEditorPaint = (x: number, z: number, phase: "start" | "move" | "end") => {
		if (phase === "end") { brushStrokeRef.current = null; return; }
		if (paintMode === "select") return;
		if (phase === "start") brushStrokeRef.current = null;
		const makeDecoration = (px: number, pz: number): MapDecoration => {
			const mountain = mountainBlendAt(px, pz) >= 0.5;
			const options: Record<Exclude<MapPaintMode, "select" | "erase">, string[]> = {
				tree: mountain ? ["/models/mountain-fir.glb"] : ["/models/forest-tree.glb", "/models/reading-tree.glb"],
				flower: mountain ? ["/models/map-forest-flower-patch.glb"] : ["/models/map-forest-flower-patch.glb", "/models/map-blossom-tree.glb"],
				rock: ["/models/mossy-boulders.glb", "/models/map-riverbank-rock-cluster.glb"],
				bush: ["/models/forest-understory.glb"],
			};
			const kind = paintMode as Exclude<MapPaintMode, "select" | "erase">;
			const modelUrl = options[kind][Math.floor(Math.random() * options[kind].length)];
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
		let dx = x - stroke.x;
		let dz = z - stroke.z;
		let distance = Math.hypot(dx, dz);
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
	const exitTimer = useRef<number | null>(null);
	if (introState.title !== intro?.title) setIntroState({ title: intro?.title, index: 0 });
	if (!intro && introExiting) setIntroExiting(false);
	useEffect(() => () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current); }, []);
	const introIndex = introState.index;
	const introLine = intro?.lines[introIndex];
	const introText = introLine ? playerText(introLine.text, save.hero) : undefined;
	useEffect(() => {
		if (introText && save.settings.autoRead) speak(speakable(introText));
		return () => stopSpeech();
	}, [introText, save.settings.autoRead]);
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
	const mapLayoutKey = `${MAP_WORLD_WIDTH}x${MAP_WORLD_DEPTH}:${JSON.stringify(sharedStart)}:${JSON.stringify(stageLayout)}:${JSON.stringify(riverPoints)}:${JSON.stringify(landmarks)}:${JSON.stringify(assetRotations)}:${stageMarkers.map(({ region, index }) => `${region}-${index}`).join(",")}`;
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
					<IsoWorldScene containerRef={scrollRef} layoutKey={mapLayoutKey} stageMarkers={stageMarkers} landmarks={landmarks} stageLayout={stageLayout} sharedStart={sharedStart} riverPoints={riverPoints} assetRotations={assetRotations} decorations={decorations} erasedDecorations={erasedDecorations} editorMode={editorOpen} paintMode={paintMode} onEditorSelect={(target) => { setEditorTarget(target); if (target?.kind === "asset" && target.key) setLandmarkKey(target.key); }} onEditorMove={onEditorMove} onEditorPaint={onEditorPaint} onEditorErase={onEditorErase} hero={save.hero} cinematic={Boolean(intro)} dialogueSpeaker={introLine?.who ?? null} dialogueCharacters={intro?.lines.map((line) => line.who) ?? []} dialogueExiting={introExiting} onStageClick={onSceneStageClick} onLoadProgress={onMapLoadProgress} />
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
								const option = HEROES.find((item) => item.id === hero)!;
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
				<button type="button" onClick={() => { setEditorOpen((open) => !open); setEditorTarget(null); }} className="rounded-xl border border-white/30 bg-slate-950/85 px-3 py-2 text-sm font-bold shadow-xl">{editorOpen ? "Fermer éditeur" : "Éditer la carte"}</button>
				{editorOpen && <div className="mt-2 w-64 rounded-2xl border border-white/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
					<p className="text-xs font-bold text-white">Clique et fais glisser un élément sur la carte.</p>
					<div className="mt-2 grid grid-cols-3 gap-1.5">
						{([ ["select", "Sélection"], ["tree", "🌲 Arbres"], ["flower", "🌼 Fleurs"], ["rock", "🪨 Rochers"], ["bush", "🌿 Buissons"], ["erase", "⌫ Gomme"] ] as [MapPaintMode, string][]).map(([mode, label]) => <button key={mode} type="button" onClick={() => { setPaintMode(mode); setEditorTarget(null); brushStrokeRef.current = null; }} className={`rounded-lg px-2 py-1.5 text-[11px] font-bold ${paintMode === mode ? "bg-fuchsia-600 text-white" : "bg-white/10 text-white/75"}`}>{label}</button>)}
					</div>
					<p className="mt-1 text-[11px] text-white/65">Clique/glisse sur la carte pour peindre ou gommer. En sélection, déplace les éléments et les poignées.</p>
					{editorTarget && <p className="mt-2 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-amber-100">{editorTarget.kind === "asset" ? landmarkKey : editorTarget.kind === "stage" ? `Étape ${editorTarget.index + 1} · ${editorTarget.region === "reading" ? "lecture" : "maths"}` : editorTarget.kind === "river" ? `Rivière · poignée ${editorTarget.index + 1}` : "Départ commun"}</p>}
					{editorTarget?.kind === "asset" && <div className="mt-2 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{landmarkKey}</span><button type="button" aria-label="Tourner à gauche" onClick={()=>setAssetRotations(v=>({...v,[landmarkKey]:(v[landmarkKey]??0)-Math.PI/12}))} className="rounded bg-slate-700 px-3 py-1">↶</button><span className="text-xs tabular-nums">{((assetRotations[landmarkKey]??0)*180/Math.PI).toFixed(0)}°</span><button type="button" aria-label="Tourner à droite" onClick={()=>setAssetRotations(v=>({...v,[landmarkKey]:(v[landmarkKey]??0)+Math.PI/12}))} className="rounded bg-slate-700 px-3 py-1">↷</button></div>}
					<button type="button" onClick={() => void saveMapLayout()} className="mt-3 w-full rounded-lg bg-fuchsia-700 px-3 py-2 text-sm font-bold">Enregistrer dans le dépôt</button>
					{editorMessage && <p className="mt-2 text-xs text-emerald-200">{editorMessage}</p>}
				</div>}
			</div>}
			{intro && introLine && <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-500 ${introExiting ? "opacity-0" : "opacity-100"}`}>
				<div className="absolute inset-x-0 top-[5.5rem] text-center sm:top-24">
					<span className="rounded-full border border-white/30 bg-slate-950/70 px-5 py-2 text-sm font-extrabold text-white shadow-lg backdrop-blur-md sm:text-base">{intro.title}</span>
				</div>
				{introLine.who === save.hero ? <div key={`${introIndex}-hero`} className="anim-pop absolute left-1/2 top-[22%] w-[min(88vw,34rem)] -translate-x-1/2 rounded-3xl border-2 border-white/90 bg-slate-950/85 px-5 py-4 text-center text-base font-bold leading-snug text-white shadow-[0_12px_40px_rgba(0,0,0,.55)] backdrop-blur-md sm:text-xl">
						<span className="mb-1 block text-xs font-black uppercase tracking-widest text-pink-200">{SPEAKER_INFO[introLine.who].name}</span>
						{playerText(introLine.text, save.hero)}<span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white/90 bg-slate-950/85" />
						<span className="pointer-events-auto absolute -right-3 -top-3"><SpeakButton text={speakable(playerText(introLine.text, save.hero))} size="sm" /></span>
					</div> : <div key={`${introIndex}-npc`} className={`absolute left-[3%] ${introLine.who === "mochi" ? "top-[23%] sm:top-[32%]" : "top-[19%] sm:top-[20%]"} w-[min(78vw,29rem)] rounded-3xl border-2 border-white/90 px-4 py-3 text-base font-bold leading-snug shadow-[0_12px_40px_rgba(0,0,0,.55)] backdrop-blur-md anim-pop sm:left-[8%] sm:px-5 sm:py-4 sm:text-xl`} style={{ backgroundColor: introLine.who === "mochi" ? "#f4edff" : `${SPEAKER_INFO[introLine.who].color}e8`, color: introLine.who === "mochi" ? "#321b50" : "#ffffff" }}>
						<span className="mb-1 block text-xs font-black uppercase tracking-widest opacity-80">{SPEAKER_INFO[introLine.who].name}</span>
						{introLine.text}<span className="absolute -bottom-2 left-[58%] h-4 w-4 rotate-45 border-b-2 border-r-2 border-white/90" style={{ backgroundColor: SPEAKER_INFO[introLine.who].color }} />
						<span className="pointer-events-auto absolute -right-3 -top-3"><SpeakButton text={speakable(introLine.text)} size="sm" /></span>
					</div>}
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

function chapterComplete(chapter: Chapter, save: Save) {
	const missions = MISSIONS.filter((mission) => mission.chapter === chapter.id);
	return missions.length > 0 && missions.every((mission) => (save.stars[mission.id] ?? 0) > 0);
}

function mathChapterComplete(chapter: MathChapter, save: Save) {
	const missions = mathChapterMissions(chapter.id);
	return missions.length > 0 && missions.every((mission) => (save.stars[mission.id] ?? 0) > 0);
}

function MapStop({ chapter, region, unlocked, done, current, confirming, onClick }: {
	chapter: Chapter | MathChapter; region: MapRegion; unlocked: boolean;
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
