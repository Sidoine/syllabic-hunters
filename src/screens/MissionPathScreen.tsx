import { useEffect, useState } from "react";
import { BackIcon, IMAGES, StarIcon, UI_ICONS } from "../components/ui";
import { assetUrl } from "../lib/assets";
const readingMarkerBadge = assetUrl("final/ui/map-marker-reading.webp");
const mathMarkerBadge = assetUrl("final/ui/map-marker-math.webp");
const lockedMarkerBadge = assetUrl("final/ui/map-marker-locked.webp");
const rewardColoringBadge = assetUrl("final/ui/reward-coloring-badge.png");

export type MissionPathItem = {
	id: string;
	title: string;
	help: string;
	icon: string;
	stars: number;
	unlocked: boolean;
};

const PATH_STOPS = [
	{ x: 13, y: 68 },
	{ x: 29, y: 53 },
	{ x: 45, y: 65 },
	{ x: 59, y: 44 },
	{ x: 75, y: 55 },
	{ x: 88, y: 31 },
	{ x: 67, y: 23 },
];

function pathThroughStops(stops: { x: number; y: number }[], height: number) {
	if (stops.length < 2) return "";
	const points = stops.map((stop) => ({ x: stop.x * 10, y: (stop.y / 100) * height }));
	return points.reduce((path, point, index) => {
		if (index === 0) return `M ${point.x} ${point.y}`;
		const previous = points[index - 1];
		const middleY = (previous.y + point.y) / 2;
		return `${path} C ${previous.x} ${middleY}, ${point.x} ${middleY}, ${point.x} ${point.y}`;
	}, "");
}

export function MissionPathScreen({
	title,
	place,
	hero,
	name,
	region,
	missions,
	award,
	stars,
	maxStars,
	chapterNote,
	onBack,
	onStory,
	onSettings,
	rewardComplete,
	rewardUnlocked,
	rewardAvailable,
	onReward,
	onStart,
}: {
	title: string;
	place: string;
	hero: keyof typeof IMAGES;
	name: string;
	region: "reading" | "math";
	missions: MissionPathItem[];
	award?: { id: string; stars: number };
	stars: number;
	maxStars: number;
	chapterNote?: string;
	onBack: () => void;
	onStory?: () => void;
	onSettings: () => void;
	rewardComplete: boolean;
	rewardUnlocked: boolean;
	rewardAvailable: boolean;
	onReward: () => void;
	onStart: (id: string) => void;
}) {
	const [selectedId] = useState(() => missions.find((mission) => mission.unlocked && mission.stars < 3)?.id ?? missions.find((mission) => mission.unlocked)?.id ?? missions[0]?.id ?? "");
	const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
	const [awardAnimating, setAwardAnimating] = useState(Boolean(award));
	const awardId = award?.id;
	const awardStars = award?.stars;
	useEffect(() => {
		const updateHeight = () => setViewportHeight(window.innerHeight);
		window.addEventListener("resize", updateHeight);
		return () => window.removeEventListener("resize", updateHeight);
	}, []);
	useEffect(() => {
		if (awardId === undefined || !awardStars) return;
		setAwardAnimating(true);
		const timer = window.setTimeout(() => setAwardAnimating(false), 1900);
		return () => window.clearTimeout(timer);
	}, [awardId, awardStars]);
	const selected = missions.find((mission) => mission.id === selectedId) ?? missions.find((mission) => mission.unlocked) ?? missions[0];
	const rewardReady = rewardUnlocked && rewardAvailable && !rewardComplete;
	const mapHeight = Math.max(viewportHeight, 820);
	const stops = missions.map((_, index) => PATH_STOPS[index % PATH_STOPS.length]);
	const path = pathThroughStops(stops, mapHeight);
	const rewardPoint = { x: 68, y: 78 };
	const rewardPath = stops.length > 0
		? pathThroughStops([stops[Math.min(stops.length - 1, 4)], rewardPoint], mapHeight)
		: "";
	const accent = region === "reading" ? "#f05ab0" : "#42c8e7";

	return (
		<main
			className="fixed inset-0 z-40 overflow-hidden bg-transparent text-white"
		>

			<div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain">
				<div className="relative w-full" style={{ height: mapHeight }}>
					<svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 1000 ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
						<path d={path} fill="none" stroke="#50351e" strokeWidth="23" strokeLinecap="round" opacity="0.56" />
						<path d={path} fill="none" stroke="#bf9460" strokeWidth="17" strokeLinecap="round" opacity="0.85" />
						<path d={path} fill="none" stroke="#ffe2a4" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 24" opacity="0.9" />
						{rewardPath && <path d={rewardPath} fill="none" stroke="#694485" strokeWidth="19" strokeLinecap="round" opacity="0.95" />}
						{rewardPath && <path d={rewardPath} fill="none" stroke="#d3a5ef" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 18" opacity="0.9" />}
					</svg>

					{missions.map((mission, index) => {
						const point = PATH_STOPS[index % PATH_STOPS.length];
						const isSelected = selected?.id === mission.id;
						const completed = mission.stars >= 3;
						const progress = Math.min(100, Math.max(0, (mission.stars / 3) * 100));
						const ringColor = completed ? "#9ee463" : accent;
						return (
							<div key={mission.id} className="absolute z-10" style={{ left: `${point.x}%`, top: `${(point.y / 100) * mapHeight}px`, transform: "translate(-50%, -50%)" }}>
								<button
									type="button"
									disabled={!mission.unlocked || awardAnimating}
									aria-label={`${mission.title}, ${mission.stars} étoile${mission.stars === 1 ? "" : "s"} sur 3${mission.unlocked ? "" : ", verrouillée"}${awardAnimating ? ", étoiles en cours d’animation" : ""}`}
									aria-pressed={isSelected}
									onClick={() => mission.unlocked && onStart(mission.id)}
									className={`mission-map-step group btn-pop flex w-32 cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-1 text-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-yellow-100 disabled:cursor-not-allowed sm:w-36 ${isSelected ? "z-20 scale-110" : ""} ${!mission.unlocked ? "opacity-75 grayscale-[0.3]" : ""}`}
								>
									<span className="relative flex h-[5.45rem] w-[5.45rem] items-center justify-center rounded-full p-[5px] shadow-[0_8px_20px_rgba(23,15,13,0.42)] sm:h-24 sm:w-24" style={{ background: mission.unlocked ? `conic-gradient(from -90deg, ${ringColor} 0 ${progress}%, rgba(255,241,207,0.55) ${progress}% 100%)` : "conic-gradient(#b68b52, #e8cb8b, #805b37, #b68b52)" }}>
										<img src={mission.unlocked ? (region === "reading" ? readingMarkerBadge : mathMarkerBadge) : lockedMarkerBadge} alt="" className="h-full w-full rounded-full object-contain drop-shadow-[0_2px_3px_rgba(32,17,10,0.45)]" />
						{award?.id === mission.id && award.stars > 0 && <span aria-hidden="true" className="pointer-events-none absolute inset-0">{["left", "center", "right"].slice(0, Math.min(3, award.stars)).map((star, index) => <StarIcon key={`${award.id}-${star}`} className="mission-award-star absolute left-1/2 top-1/2 h-8 w-8 drop-shadow-[0_2px_5px_rgba(40,20,0,0.9)]" style={{ animationDelay: `${index * 0.18}s`, ["--star-dx" as string]: `${(index - 1) * 32}px`, ["--star-dy" as string]: "-58px" }} />)}</span>}
										{completed && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#fff5d8] bg-[#75c93e] text-lg font-black leading-none text-white shadow-md">✓</span>}
										{isSelected && <span aria-hidden="true" className="mission-next-orbit pointer-events-none absolute -inset-3 rounded-full"><span className="mission-next-coin">✦</span></span>}
									</span>
									<span className="mission-nameplate max-w-full rounded-xl px-2.5 py-1 text-[12px] font-bold leading-tight text-white shadow-lg sm:text-sm">{mission.title}</span>
									<span aria-hidden="true" className="-mt-1 flex min-h-4 items-center gap-0.5 text-[13px] leading-none">
										{[0, 1, 2].map((star) => <StarIcon key={star} className={`h-4 w-4 ${star < mission.stars ? "drop-shadow" : "opacity-35 grayscale"}`} />)}
									</span>
								</button>
							</div>
						);
					})}
					<div className="absolute z-10" style={{ left: `${rewardPoint.x}%`, top: `${(rewardPoint.y / 100) * mapHeight}px`, transform: "translate(-50%, -50%)" }}>
						<button type="button" disabled={!rewardReady || awardAnimating} onClick={onReward} aria-label={`Pause coloriage${rewardComplete ? ", terminée" : !rewardUnlocked ? ", verrouillée, avance sur le chemin" : rewardAvailable ? ", à faire" : ", aucun nouveau coloriage disponible"}${awardAnimating ? ", étoiles en cours d’animation" : ""}`} className={`mission-map-step group btn-pop flex w-32 flex-col items-center gap-1.5 rounded-2xl p-1 text-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-yellow-100 disabled:cursor-not-allowed sm:w-36 ${!rewardReady && !rewardComplete ? "opacity-55 grayscale" : ""}`}>
							<span className="relative flex h-[5.45rem] w-[5.45rem] items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-500 to-violet-700 p-[5px] shadow-[0_8px_20px_rgba(23,15,13,0.48)] sm:h-24 sm:w-24">
								<img src={rewardColoringBadge} alt="" className="h-full w-full rounded-full object-contain drop-shadow-[0_2px_3px_rgba(32,17,10,0.45)]" />
								{!rewardUnlocked && !rewardComplete && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#fff5d8] bg-slate-700 shadow-md"><img src={UI_ICONS.lock} alt="" className="h-4 w-4 object-contain" /></span>}
								{rewardComplete && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#fff5d8] bg-[#75c93e] text-lg font-black leading-none text-white shadow-md">✓</span>}
							</span>
							<span className="mission-nameplate max-w-full rounded-xl px-2.5 py-1 text-[12px] font-bold leading-tight text-white shadow-lg sm:text-sm">{rewardComplete ? "Coloriage terminé" : !rewardUnlocked ? "À atteindre" : rewardAvailable ? "Pause coloriage" : "Tous découverts"}</span>
							<span className="-mt-1 flex min-h-4 items-center gap-0.5 text-[13px] leading-none text-yellow-100">{rewardComplete ? "✓ terminé" : !rewardUnlocked ? "avance sur le chemin" : rewardAvailable ? "activité bonus" : "aucun doublon"}</span>
						</button>
					</div>
				</div>
			</div>

			<header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-2 sm:p-3">
				<div className="pointer-events-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 rounded-[1.35rem] border border-white/35 bg-slate-950/65 px-2.5 py-2 shadow-[0_10px_36px_rgba(9,18,29,0.48)] backdrop-blur-xl sm:flex-nowrap sm:px-4">
					<button type="button" onClick={onBack} className="btn-pop flex h-10 shrink-0 items-center gap-1 rounded-full border border-white/30 bg-slate-800/65 px-2.5 text-xs font-bold sm:h-12 sm:gap-2 sm:px-4 sm:text-sm" aria-label="Retour à la carte">
						<BackIcon className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" /><span className="hidden sm:inline">Retour à la carte</span>
					</button>
					<div className="flex min-w-0 flex-1 items-center gap-2 sm:ml-2 sm:gap-3">
						<span className="hidden h-11 w-11 shrink-0 overflow-hidden rounded-full border-[3px] border-white/90 bg-gradient-to-br from-pink-300 to-violet-700 shadow-[0_2px_12px_rgba(255,119,211,0.45)] sm:block"><img src={IMAGES[hero]} alt="" className="h-full w-full scale-125 object-cover object-top" /></span>
						<span className="min-w-0">
							<span className="block truncate text-[10px] font-bold tracking-wider text-white/70 sm:text-[11px]">{place}{name ? ` · ${name}` : ""}</span>
							<span className="block truncate text-base font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(249,96,209,0.8)] sm:text-xl">{title}</span>
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-100/50 bg-slate-800/60 px-2.5 py-1.5 text-xs font-bold shadow-inner shadow-white/10 sm:gap-2 sm:px-4 sm:py-2 sm:text-base">
						<StarIcon className="h-6 w-6 shrink-0 drop-shadow-[0_2px_3px_rgba(120,65,0,0.65)] sm:h-8 sm:w-8" />{stars}<span className="text-white/60">/{maxStars}</span>
					</div>
					{onStory && <button type="button" onClick={onStory} aria-label="Lire l’histoire du chapitre" className="btn-pop glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 sm:h-12 sm:w-auto sm:gap-2 sm:px-3"><img src={UI_ICONS.book} alt="" className="h-8 w-8 object-contain" /><span className="hidden text-sm font-bold sm:inline">Histoire</span></button>}
					<button type="button" onClick={onSettings} aria-label="Réglages" className="btn-pop glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 sm:h-12 sm:w-12"><img src={UI_ICONS.settings} alt="" className="h-8 w-8 object-contain" /></button>
				</div>
			</header>

			{chapterNote && <div className="pointer-events-none absolute bottom-5 left-4 z-20 hidden max-w-[min(32rem,42vw)] rounded-2xl border border-yellow-100/45 bg-slate-950/65 px-4 py-2 text-sm font-semibold text-yellow-50 shadow-xl backdrop-blur-lg sm:block">{chapterNote}</div>}
			<div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/25 bg-slate-950/55 px-3 py-1.5 text-[11px] font-semibold text-white/90 shadow-lg backdrop-blur-md sm:bottom-5 sm:text-xs">{awardAnimating ? "Tes étoiles rejoignent ta mission !" : "Touche une étape pour commencer"}</div>

			{selected && <aside className="pointer-events-auto absolute bottom-3 right-3 z-30 w-[min(340px,calc(100vw-24px))] rounded-[1.6rem] border border-white/45 bg-slate-950/80 p-3.5 shadow-[0_16px_48px_rgba(8,17,27,0.6)] backdrop-blur-xl sm:bottom-5 sm:right-5 sm:p-5">
				<div className="flex items-start gap-3">
					<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-100/50 bg-gradient-to-br from-[#392b23] to-[#151d28] shadow-inner shadow-white/10"><img src={selected.icon} alt="" className="h-10 w-10 object-contain" /></span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-lg font-bold leading-tight sm:text-xl">{selected.title}</span>
						<span className="mt-0.5 block text-sm leading-snug text-white/80">{selected.help}</span>
					</span>
				</div>
				<div className="mt-2 flex items-center justify-between gap-3 border-t border-white/15 pt-2 sm:mt-3 sm:pt-3">
					<span className="flex items-center gap-1.5 text-xs font-semibold text-white/75 sm:text-sm"><span className="flex items-center gap-1 text-amber-200"><StarIcon className="h-4 w-4" />{selected.stars}/3</span>{selected.unlocked ? "· accessible" : "· verrouillée"}</span>
				</div>
			</aside>}
		</main>
	);
}
