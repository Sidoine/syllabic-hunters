import { BackIcon, IMAGES, MISSION_ICONS, StarIcon, UI_ICONS } from "../components/ui";
import { CHAPTERS, MISSION_INFO, type LetterChapter, MISSIONS, type Mission } from "../data/reading";
import { syllablesOf, VOWELS } from "../data/syllables";
import type { Save } from "../lib/storage";
import { MissionPathScreen } from "./MissionPathScreen";
import { coloringPageForReward } from "../data/coloring";

export function isMissionUnlocked(save: Save, m: Mission) {
	if (save.settings.unlockAll) return true;
	const idx = MISSIONS.findIndex((x) => x.id === m.id);
	return idx === 0 || (save.stars[MISSIONS[idx - 1].id] ?? 0) > 0;
}

export const chapterMissions = (ch: number) =>
	MISSIONS.filter((m) => m.chapter === ch);

export function chapterStars(save: Save, ch: number) {
	const ms = chapterMissions(ch);
	return {
		got: ms.reduce((a, m) => a + (save.stars[m.id] ?? 0), 0),
		max: ms.length * 3,
		done: ms.every((m) => (save.stars[m.id] ?? 0) > 0),
	};
}

export function MapScreen({
	save,
	onChapter,
	onBack,
	onSettings,
}: {
	save: Save;
	onChapter: (ch: number) => void;
	onBack: () => void;
	onSettings: () => void;
}) {
	const total = MISSIONS.reduce((a, m) => a + (save.stars[m.id] ?? 0), 0);
	const doneCount = MISSIONS.filter((m) => (save.stars[m.id] ?? 0) > 0).length;
	return (
		<div className="min-h-full px-3 py-4 max-w-4xl mx-auto">
			<header className="flex items-center justify-between gap-2 mb-4 sticky top-0 z-20 py-2 bg-[#1f0c48]/80 backdrop-blur rounded-b-3xl px-3">
				<button
					type="button"
					onClick={onBack}
					aria-label="Choisir une carte"
					className="btn-pop glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0"
				>
					<BackIcon className="h-7 w-7" />
				</button>
				<div className="flex min-w-0 items-center justify-center gap-2 text-center">
					<img src={IMAGES[save.hero]} alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-white/80 bg-white/10 object-cover object-top sm:h-12 sm:w-12" />
					<div>
					<div className="text-xl sm:text-2xl font-bold neon-text">
						Carte des aventures
					</div>
					<div className="text-sm text-pink-100">
						{save.name ? `${save.name} · ` : ""}
							<StarIcon className="h-5 w-5 align-[-3px]" /> {total} ·
						<img src={MISSION_ICONS["see-sound"]} alt="" className="inline-block align-[-3px] w-5 h-5" /> {doneCount}/{MISSIONS.length} missions
					</div>
					</div>
				</div>
				<button
					type="button"
					onClick={onSettings}
					aria-label="Réglages"
					className="btn-pop glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0"
				>
					<img src={UI_ICONS.settings} alt="" className="w-9 h-9 object-contain" />
				</button>
			</header>

			<div className="relative flex flex-col items-center gap-2 pb-10">
				{CHAPTERS.map((c, i) => {
					const unlocked = isMissionUnlocked(save, chapterMissions(c.id)[0]);
					const st = chapterStars(save, c.id);
					const offset = [0, 28, 44, 28, 0, -28, -44, -28][i % 8];
					return (
						<div
							key={c.id}
							className="flex flex-col items-center"
							style={{ transform: `translateX(${offset}px)` }}
						>
							{i > 0 && (
								<div className="w-1 h-6 border-l-4 border-dotted border-white/40" />
							)}
							<ChapterNode
								chapter={c}
								unlocked={unlocked}
								stars={st}
								onClick={() => unlocked && onChapter(c.id)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ChapterNode({
	chapter,
	unlocked,
	stars,
	onClick,
}: {
	chapter: LetterChapter;
	unlocked: boolean;
	stars: { got: number; max: number; done: boolean };
	onClick: () => void;
}) {
	const isFinal = chapter.id === CHAPTERS.length - 1;
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!unlocked}
			className={`btn-pop flex items-center gap-3 rounded-full pr-5 pl-2 py-2 border-4 w-[17rem] sm:w-80 text-left ${
				unlocked
					? "border-white shadow-[0_6px_0_rgba(0,0,0,0.3)]"
					: "border-white/20 opacity-50 grayscale"
			} ${unlocked && !stars.done ? "anim-glow" : ""}`}
			style={{
				background: unlocked
					? `linear-gradient(135deg, ${chapter.color}, #6b2bd9)`
					: "#3a2a5a",
			}}
		>
			<div className="w-16 h-16 rounded-full bg-white flex items-center justify-center font-read font-bold text-3xl text-purple-800 shrink-0 relative">
				{unlocked ? (
					isFinal ? (
						<img src={UI_ICONS.crown} alt="Dernier chapitre" className="w-12 h-12 object-contain" />
					) : (
						<span className={chapter.id === 0 ? "whitespace-nowrap text-xl tracking-tight" : ""}>
							{chapter.label === "★" ? <StarIcon className="h-8 w-8" /> : chapter.label}
						</span>
					)
				) : (
					<img src={UI_ICONS.lock} alt="Verrouillé" className="w-8 h-8 object-contain" />
				)}
				{stars.done && (
					<span className="absolute -top-2 -right-2"><img src={UI_ICONS.crown} alt="Chapitre terminé" className="w-7 h-7 object-contain" /></span>
				)}
			</div>
			<div className="flex-1">
				<div className="font-bold text-lg leading-tight">{chapter.title}</div>
				<div className="text-xs text-white/80">{chapter.title}</div>
				<div className="text-sm">
					<StarIcon className="mr-1 h-4 w-4 align-[-3px]" /> {stars.got}/{stars.max}
				</div>
			</div>
			{unlocked && (
				<img
					src={IMAGES.demon}
					alt=""
					className="w-10 h-10 object-contain"
					style={{
						filter: `hue-rotate(${chapter.hue}deg)`,
						opacity: stars.done ? 0.25 : 1,
					}}
				/>
			)}
		</button>
	);
}

export function ChapterScreen({
	save,
	chapter,
	award,
	onMission,
	onBack,
	onStory,
	onSettings,
	onReward,
}: {
	save: Save;
	chapter: LetterChapter;
	award?: { id: string; stars: number };
	onMission: (m: Mission) => void;
	onBack: () => void;
	onStory: () => void;
	onSettings: () => void;
	onReward: () => void;
}) {
	const ms = chapterMissions(chapter.id);
	const syl = chapter.letters.length
		? chapter.letters.flatMap(syllablesOf)
		: chapter.id === 0
			? VOWELS.map((v) => v.id)
			: [];
	const stars = ms.reduce((total, mission) => total + (save.stars[mission.id] ?? 0), 0);
	const rewardGateIndex = Math.min(ms.length - 1, 4);
	const rewardUnlocked = rewardGateIndex >= 0 && (save.stars[ms[rewardGateIndex].id] ?? 0) > 0;
	return (
		<MissionPathScreen
			title={chapter.title}
			hero={save.hero}
			region="reading"
			award={award}
			rewardComplete={Boolean(save.rewards?.[`reading-coloring-${chapter.id}`])}
			rewardUnlocked={rewardUnlocked}
			rewardAvailable={!save.rewards?.[`reading-coloring-${chapter.id}`] && coloringPageForReward(save, `reading-coloring-${chapter.id}`) !== null}
			onReward={onReward}
			stars={stars}
			maxStars={ms.length * 3}
			chapterNote={chapter.tip ?? (syl.length > 0 ? `Sons à explorer : ${syl.join(" · ")}` : undefined)}
			missions={ms.map((mission) => ({
				id: mission.id,
				title: mission.type === "battle" ? `${mission.title} · ${chapter.boss}` : mission.title,
				help: MISSION_INFO[mission.type].help,
				icon: MISSION_ICONS[mission.type],
				stars: save.stars[mission.id] ?? 0,
				unlocked: isMissionUnlocked(save, mission),
			}))}
			onBack={onBack}
			onStory={onStory}
			onSettings={onSettings}
			onStart={(id) => {
				const mission = ms.find((item) => item.id === id);
				if (mission) onMission(mission);
			}}
		/>
	);
}
