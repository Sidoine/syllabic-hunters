import { useEffect, useState } from "react";
import { BackIcon, FeedbackLayer, BigButton, IMAGES, MissionFrame, StarIcon, Stars, UI_ICONS, useFeedback, useGame } from "../components/ui";
import {
	createMathQuestions,
	mathChapterMissions,
	MATH_CHAPTERS,
	MATH_MISSIONS,
	type MathChapter,
	type MathMission,
} from "../data/math";
import type { Save } from "../lib/storage";
import { speakSeq } from "../lib/speech";
import { MissionPathScreen } from "./MissionPathScreen";
import { coloringPageForReward } from "../data/coloring";
import { dialogue } from "../data/dialogue";

export function isMathMissionUnlocked(save: Save, mission: MathMission) {
	if (save.settings.unlockAll) return true;
	const index = MATH_MISSIONS.findIndex((item) => item.id === mission.id);
	return index === 0 || (save.stars[MATH_MISSIONS[index - 1].id] ?? 0) > 0;
}

function chapterProgress(save: Save, chapter: number) {
	const missions = mathChapterMissions(chapter);
	return {
		stars: missions.reduce((total, mission) => total + (save.stars[mission.id] ?? 0), 0),
		max: missions.length * 3,
		done: missions.every((mission) => (save.stars[mission.id] ?? 0) > 0),
	};
}

export function MathMapScreen({
	save,
	onChapter,
	onBack,
}: {
	save: Save;
	onChapter: (chapter: number) => void;
	onBack: () => void;
}) {
	const total = MATH_MISSIONS.reduce((sum, mission) => sum + (save.stars[mission.id] ?? 0), 0);
	const completed = MATH_MISSIONS.filter((mission) => (save.stars[mission.id] ?? 0) > 0).length;
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
				<div className="text-center">
					<div className="text-xl sm:text-2xl font-bold neon-text">Carte des batailles</div>
					<div className="text-sm text-pink-100">
						{save.name ? `${save.name} · ` : ""}
						<StarIcon className="h-5 w-5 align-[-3px]" /> {total} · {completed}/{MATH_MISSIONS.length} missions
					</div>
				</div>
				<img src={UI_ICONS.math} alt="" className="w-12 h-12 object-contain shrink-0" />
			</header>

			<div className="relative flex flex-col items-center gap-2 pb-10">
				{MATH_CHAPTERS.map((chapter, index) => {
					const firstMission = mathChapterMissions(chapter.id)[0];
					const unlocked = firstMission ? isMathMissionUnlocked(save, firstMission) : false;
					const progress = chapterProgress(save, chapter.id);
					const offset = [0, 28, 44, 28, 0, -28, -44, -28][index % 8];
					return (
						<div key={chapter.id} className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
							{index > 0 && <div className="w-1 h-6 border-l-4 border-dotted border-white/40" />}
							<MathChapterNode
								chapter={chapter}
								unlocked={unlocked}
								progress={progress}
								onClick={() => unlocked && onChapter(chapter.id)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function MathChapterNode({
	chapter,
	unlocked,
	progress,
	onClick,
}: {
	chapter: MathChapter;
	unlocked: boolean;
	progress: { stars: number; max: number; done: boolean };
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!unlocked}
			className={`btn-pop flex items-center gap-3 rounded-full pr-5 pl-2 py-2 border-4 w-[17rem] sm:w-80 text-left ${
				unlocked ? "border-white shadow-[0_6px_0_rgba(0,0,0,0.3)]" : "border-white/20 opacity-50 grayscale"
			} ${unlocked && !progress.done ? "anim-glow" : ""}`}
			style={{ background: unlocked ? `linear-gradient(135deg, ${chapter.color}, #6b2bd9)` : "#3a2a5a" }}
		>
			<div className="relative w-16 h-16 rounded-full bg-white flex items-center justify-center font-read font-bold text-2xl text-purple-800 shrink-0">
				{unlocked ? chapter.label === "★" ? <StarIcon className="h-8 w-8" /> : chapter.label : <img src={UI_ICONS.lock} alt="Verrouillé" className="w-8 h-8 object-contain" />}
				{progress.done && <img src={UI_ICONS.crown} alt="Étape terminée" className="absolute -top-2 -right-2 w-7 h-7 object-contain" />}
			</div>
			<div className="flex-1">
				<div className="font-bold text-lg leading-tight">{chapter.title}</div>
				<div className="text-xs text-white/80">{chapter.title}</div>
				<div className="flex items-center gap-1 text-sm"><StarIcon className="h-4 w-4" /> {progress.stars}/{progress.max}</div>
			</div>
			{unlocked && <img src={UI_ICONS.math} alt="" className="w-10 h-10 object-contain" />}
		</button>
	);
}

export function MathChapterScreen({
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
	chapter: MathChapter;
	award?: { id: string; stars: number };
	onMission: (mission: MathMission) => void;
	onBack: () => void;
	onStory: () => void;
	onSettings: () => void;
	onReward: () => void;
}) {
	const missions = mathChapterMissions(chapter.id);
	const instruction =
		chapter.skill === "complement"
			? "Trouve le nombre qui manque pour faire 10."
			: chapter.skill === "subtraction"
				? `Enlève un nombre sans dépasser ${chapter.limit}.`
				: chapter.skill === "mixed"
					? "Additionne ou soustrais pour trouver la bonne réponse."
					: `Additionne sans dépasser ${chapter.limit}.`;
	const stars = missions.reduce((total, mission) => total + (save.stars[mission.id] ?? 0), 0);
	const rewardGateIndex = Math.min(missions.length - 1, 4);
	const rewardUnlocked = rewardGateIndex >= 0 && (save.stars[missions[rewardGateIndex].id] ?? 0) > 0;
	return (
		<MissionPathScreen
			title={chapter.title}
			place={chapter.title}
			hero={save.hero}
			name={save.name}
			region="math"
			award={award}
			onStory={onStory}
			onSettings={onSettings}
			rewardComplete={Boolean(save.rewards?.[`math-coloring-${chapter.id}`])}
			rewardUnlocked={rewardUnlocked}
			rewardAvailable={!save.rewards?.[`math-coloring-${chapter.id}`] && coloringPageForReward(save, `math-coloring-${chapter.id}`) !== null}
			onReward={onReward}
			stars={stars}
			maxStars={missions.length * 3}
			chapterNote={instruction}
			missions={missions.map((mission) => ({
				id: mission.id,
				title: mission.title,
				help: mission.mode === "missing"
					? "Trouve le nombre qui manque."
					: mission.mode === "story"
						? "Résous le calcul dans cette petite histoire."
						: `Résous des calculs jusqu’à ${chapter.limit}.`,
				icon: UI_ICONS.math,
				stars: save.stars[mission.id] ?? 0,
				unlocked: isMathMissionUnlocked(save, mission),
			}))}
			onBack={onBack}
			onStart={(id) => {
				const mission = missions.find((item) => item.id === id);
				if (mission) onMission(mission);
			}}
		/>
	);
}

export function MathMissionExercise({
	mission,
	onDone,
	onQuit,
}: {
	mission: MathMission;
	onDone: (errors: number, rounds: number) => void;
	onQuit: () => void;
}) {
	const questionsPerMission = 8;
	const [questions] = useState(() => createMathQuestions(mission, questionsPerMission));
	const [round, setRound] = useState(0);
	const [errors, setErrors] = useState(0);
	const [locked, setLocked] = useState(false);
	const feedback = useFeedback();
	const question = questions[round];
	return (
		<div className="min-h-full py-3 flex flex-col gap-3">
			<header className="flex items-center gap-3 px-3 max-w-4xl mx-auto w-full">
				<button type="button" onClick={onQuit} aria-label="Quitter la mission" className="btn-pop glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0">
					<img src={UI_ICONS.close} alt="" className="w-9 h-9 object-contain" />
				</button>
				<div className="flex-1 text-center font-bold text-xl sm:text-2xl neon-text">{mission.title}</div>
				<img src={UI_ICONS.math} alt="" className="w-12 h-12 object-contain" />
			</header>
			<MissionFrame
				instruction={question.display}
				dialogue={[...dialogue("yuki", mission.title), ...question.dialogue]}
				round={round}
				total={questionsPerMission}
				speakPause={120}
			>
				<FeedbackLayer fb={feedback} />
				<div className="card-kawaii rounded-[2rem] px-5 py-7 my-2 flex items-center justify-center min-h-36 w-full text-center">
					<div className={`font-bold text-purple-950 ${mission.mode === "story" ? "text-2xl sm:text-3xl max-w-2xl" : "text-5xl sm:text-7xl"}`}>
						{question.display}
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3 max-w-lg w-full">
					{question.choices.map((choice) => (
						<button
							key={choice}
							type="button"
							disabled={locked}
							onClick={() => {
								if (locked) return;
								if (choice !== question.answer) {
									setErrors((count) => count + 1);
									void feedback.bad();
									return;
								}
								setLocked(true);
								void feedback.good(false);
								window.setTimeout(() => {
									if (round + 1 === questionsPerMission) onDone(errors, questionsPerMission);
									else {
										setRound((current) => current + 1);
										setLocked(false);
									}
								}, 650);
							}}
							className="btn-pop card-kawaii rounded-3xl h-20 sm:h-24 text-4xl sm:text-5xl font-bold text-purple-950 disabled:opacity-70"
						>
							{choice}
						</button>
					))}
				</div>
			</MissionFrame>
		</div>
	);
}

export function MathResultScreen({
	mission,
	stars,
	isLastOfChapter,
	onNext,
	onMap,
	onReplay,
}: {
	mission: MathMission;
	stars: number;
	isLastOfChapter: boolean;
	onNext: () => void;
	onMap: () => void;
	onReplay: () => void;
}) {
	const { hero } = useGame();
	useEffect(() => {
		const phrases = stars === 3
			? ["Parfait !", "Trois étoiles !"]
			: stars === 2
				? ["Parfait !", "Deux étoiles !"]
				: ["Mission réussie !", "Tu peux rejouer pour gagner plus d'étoiles."];
		const resultDialogue = dialogue("yuki", phrases);
		const timer = window.setTimeout(
			() => void speakSeq(resultDialogue.map((line) => line.text)),
			400,
		);
		return () => window.clearTimeout(timer);
	}, [stars]);
	return (
		<div className="min-h-full flex flex-col items-center justify-center gap-5 px-4 py-8 text-center">
			<div className="text-2xl text-cyan-200 font-bold">Calcul réussi !</div>
			<div className="flex items-center justify-center gap-3 text-3xl sm:text-5xl font-bold neon-text">
				<img src={UI_ICONS.math} alt="" className="w-14 h-14 object-contain" />
				{mission.title}
			</div>
			<Stars n={stars} size="text-7xl" />
			<div className="flex items-end gap-2">
				<img src={IMAGES[hero]} alt="" className="w-36 anim-float" />
				<img src={IMAGES.yuki} alt="" className="w-20 anim-float" style={{ animationDelay: "0.5s" }} />
			</div>
			<div className="flex flex-wrap justify-center gap-3">
				<BigButton color="yellow" className="anim-glow text-2xl" onClick={onNext}>
					{isLastOfChapter ? "Carte suivante ▶" : "Mission suivante ▶"}
				</BigButton>
				<BigButton color="cyan" onClick={onReplay}>
					<span className="flex items-center gap-2"><img src={UI_ICONS.replay} alt="" className="w-9 h-9 object-contain" /> Rejouer</span>
				</BigButton>
				<BigButton color="purple" onClick={onMap}>
					<span className="flex items-center gap-2"><img src={UI_ICONS.map} alt="" className="w-9 h-9 object-contain" /> Carte des batailles</span>
				</BigButton>
			</div>
		</div>
	);
}
