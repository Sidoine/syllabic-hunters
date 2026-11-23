import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IMAGES, UI_ICONS } from "../components/ui";
import { MATH_CHAPTERS, MATH_MISSIONS, mathChapterMissions, type MathChapter } from "../data/math";
import { CHAPTERS, MISSIONS, type Chapter } from "../data/story";
import type { Save } from "../lib/storage";
import { isMathMissionUnlocked } from "./Math";
import { chapterMissions, isMissionUnlocked } from "./Map";
import { MATH_STOPS, READING_STOPS } from "./map-layout";
import {
	IsoWorldScene,
	type MapLoadProgress,
	type StageMarkerData,
	WORLD_PIXEL_HEIGHT,
	WORLD_PIXEL_WIDTH,
} from "./IsoWorldScene";

export type MapRegion = "reading" | "math";
export type MapStageSelection = { region: MapRegion; chapter: number };

function stopPoint(region: MapRegion, index: number) {
	const [x, y] = (region === "reading" ? READING_STOPS : MATH_STOPS)[index] ?? [0.5, 0.5];
	return { x: x * WORLD_PIXEL_WIDTH, y: y * WORLD_PIXEL_HEIGHT };
}

export function MapSelectScreen({ save, selection, onSelectStage, onReading, onMath, onProfile, onSettings }: {
	save: Save; selection: MapStageSelection | null; onSelectStage: (selection: MapStageSelection) => void;
	onReading: (chapter: number) => void; onMath: (chapter: number) => void;
	onProfile: () => void; onSettings: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
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
	const [armed, setArmed] = useState(false);
	const [mapLoadProgress, setMapLoadProgress] = useState<MapLoadProgress>({ loaded: 0, total: 1, complete: false });
	const [showMapLoading, setShowMapLoading] = useState(true);
	const mapLoadingStartedAt = useRef<number | null>(null);
	const onMapLoadProgress = useCallback((progress: MapLoadProgress) => {
		if (mapLoadingStartedAt.current === null) {
			mapLoadingStartedAt.current = Date.now();
			setShowMapLoading(true);
		}
		setMapLoadProgress(progress);
	}, []);
	useEffect(() => {
		if (!mapLoadProgress.complete) return;
		const minimumVisibleMs = 1800;
		const startedAt = mapLoadingStartedAt.current ?? Date.now();
		const remainingMs = Math.max(0, minimumVisibleMs - (Date.now() - startedAt));
		const timer = window.setTimeout(() => setShowMapLoading(false), remainingMs);
		return () => window.clearTimeout(timer);
	}, [mapLoadProgress.complete]);
	const centerOnStage = useCallback((region: MapRegion, chapter: number, behavior: ScrollBehavior = "smooth") => {
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

	const chooseStage = (region: MapRegion, chapter: number, enter: () => void) => {
		if (armed && selected.region === region && selected.chapter === chapter) {
			enter();
			return;
		}
		onSelectStage({ region, chapter });
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
	const onSceneStageClick = (region: MapRegion, index: number) => {
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
				className="absolute inset-0 overflow-auto overscroll-contain cursor-grab active:cursor-grabbing"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={() => { dragRef.current = null; }}
				onPointerCancel={() => { dragRef.current = null; }}
			>
				<div className="relative" style={{ width: WORLD_PIXEL_WIDTH, height: WORLD_PIXEL_HEIGHT }}>
					<IsoWorldScene containerRef={scrollRef} stageMarkers={stageMarkers} hero={save.hero} onStageClick={onSceneStageClick} onLoadProgress={onMapLoadProgress} />
					<nav className="sr-only" aria-label="Étapes accessibles de la carte">
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

			<header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-2 sm:p-3">
				<div className="pointer-events-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[1.4rem] border border-white/30 bg-slate-950/65 px-3 py-2 shadow-[0_10px_36px_rgba(9,18,29,0.48)] backdrop-blur-xl sm:flex-nowrap sm:px-4">
					<button type="button" onClick={onProfile} aria-label="Modifier le prénom et l'avatar" className="btn-pop flex min-w-0 flex-1 items-center gap-2.5 rounded-full text-left sm:flex-initial sm:gap-3">
						<span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/90 bg-gradient-to-br from-pink-300 via-fuchsia-500 to-violet-700 shadow-[0_2px_12px_rgba(255,119,211,0.45)] sm:h-[3.25rem] sm:w-[3.25rem]">
							<img src={IMAGES[save.hero]} alt="" className="h-full w-full object-contain object-bottom" />
						</span>
						<span className="min-w-0 flex-1 sm:w-[15rem] sm:flex-none">
							<span className="block truncate text-[10px] font-bold tracking-[0.13em] text-cyan-100 sm:text-[11px]">{save.name ? `À TOI DE JOUER, ${save.name.toLocaleUpperCase()} !` : "À TOI DE JOUER !"}</span>
							<span className="block truncate text-base font-bold leading-tight text-white drop-shadow-[0_2px_5px_rgba(249,96,209,0.8)] sm:text-lg">Le monde des découvertes</span>
							<span className="mt-1 flex items-center gap-2">
								<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20 sm:w-44 sm:flex-none"><span className="block h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-500" style={{ width: `${overallProgress}%` }} /></span>
								<span className="text-[9px] font-semibold tracking-wide text-white/75">PROGRESSION</span>
							</span>
						</span>
					</button>
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
			</header>
			<div className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-full glass bg-[#24163c]/75 px-3 py-1.5 text-[10px] sm:bottom-5 sm:right-5 sm:text-xs">Fais glisser la carte ↔ ↕ pour explorer</div>
			{showMapLoading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#101b22]/90 px-6 backdrop-blur-md" role="status" aria-live="polite">
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
