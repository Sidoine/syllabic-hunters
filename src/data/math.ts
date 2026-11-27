import { shuffle } from "../lib/utils";
import { dialogue, type DialogueLine } from "./dialogue";
import type { Chapter } from "./chapter";
import chapterData from "./math-chapters.json";

export type MathSkill = "addition" | "subtraction" | "complement" | "mixed";
export type MathMode = "result" | "missing" | "story";

export interface MathChapter extends Chapter {
	skill: MathSkill;
	limit: number;
}

export interface MathMission {
	id: string;
	chapter: number;
	title: string;
	mode: MathMode;
}

export interface MathQuestion {
	display: string;
	dialogue: DialogueLine[];
	answer: number;
	choices: number[];
}

export const MATH_CHAPTERS: MathChapter[] = chapterData as MathChapter[];


const MODES: { title: string; mode: MathMode }[] = [
	{ title: "Calculs-éclairs", mode: "result" },
	{ title: "Le nombre mystère", mode: "missing" },
	{ title: "Petites histoires de calcul", mode: "story" },
];

const NUMBER_WORDS = [
	"zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
	"dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
	"dix-huit", "dix-neuf", "vingt",
];

function numberWord(value: number) {
	return NUMBER_WORDS[value] ?? String(value);
}

export const MATH_MISSIONS: MathMission[] = MATH_CHAPTERS.flatMap((chapter) =>
	MODES.map(({ title, mode }, index) => ({
		id: `math-c${chapter.id}-m${index + 1}`,
		chapter: chapter.id,
		title,
		mode,
	})),
);

export const mathChapterMissions = (chapter: number) =>
	MATH_MISSIONS.filter((mission) => mission.chapter === chapter);

function randomInt(max: number) {
	return Math.floor(Math.random() * (max + 1));
}

function makeEquation(chapter: MathChapter, nonZeroAddends = false) {
	const skill =
		chapter.skill === "mixed"
			? Math.random() < 0.5
				? "addition"
				: "subtraction"
			: chapter.skill;
	if (skill === "complement") {
		const first = randomInt(10);
		return { first, second: 10 - first, answer: 10, operator: "+", limit: 10 };
	}
	if (skill === "subtraction") {
		const first = randomInt(chapter.limit);
		const second = randomInt(first);
		return {
			first,
			second,
			answer: first - second,
			operator: "−",
			limit: chapter.limit,
		};
	}
	const first = nonZeroAddends
		? randomInt(chapter.limit - 2) + 1
		: randomInt(chapter.limit);
	const second = nonZeroAddends
		? randomInt(chapter.limit - first - 1) + 1
		: randomInt(chapter.limit - first);
	return {
		first,
		second,
		answer: first + second,
		operator: "+",
		limit: chapter.limit,
	};
}

function choicesFor(answer: number, limit: number) {
	const distractors = new Set<number>();
	for (const delta of [1, -1, 2, -2, 3, -3, 4, -4]) {
		const choice = answer + delta;
		if (choice >= 0 && choice <= limit) distractors.add(choice);
		if (distractors.size === 3) break;
	}
	const remaining = Array.from({ length: limit + 1 }, (_, n) => n).filter(
		(choice) => choice !== answer && !distractors.has(choice),
	);
	while (distractors.size < 3 && remaining.length > 0) {
		const index = randomInt(remaining.length - 1);
		distractors.add(remaining.splice(index, 1)[0]);
	}
	return shuffle([answer, ...distractors]);
}

function questionFor(mission: MathMission): MathQuestion {
	const chapter = MATH_CHAPTERS[mission.chapter];
	const { first, second, answer, operator, limit } = makeEquation(chapter, mission.mode === "story");
	let display: string;
	let speechParts: string[];
	if (mission.mode === "story") {
		if (chapter.skill === "complement") {
			display = `Hana a ${first} étoiles. Combien lui en manque-t-il pour en avoir 10 ?`;
			speechParts = ["Hana a", numberWord(first), "étoiles. Combien lui en manque-t-il pour en avoir dix ?"];
		} else if (operator === "−") {
			display = `Mia a ${first} étoiles. Elle en offre ${second}. Combien lui en reste-t-il ?`;
			speechParts = ["Mia a", numberWord(first), "étoiles. Elle en offre", numberWord(second), "étoiles. Combien lui en reste-t-il ?"];
		} else {
			display = `Luna gagne ${first} étoiles, puis ${second}. Combien en gagne-t-elle en tout ?`;
			speechParts = ["Luna gagne", numberWord(first), "étoiles, puis", numberWord(second), "étoiles. Combien en gagne-t-elle en tout ?"];
		}
	} else if (mission.mode === "missing") {
		if (operator === "−") {
			display = `${first} − ? = ${answer}`;
			speechParts = ["Quel nombre manque ?", numberWord(first), "moins combien font", numberWord(answer)];
		} else {
			display = `${first} + ? = ${answer}`;
			speechParts = ["Quel nombre manque ?", numberWord(first), "plus combien font", numberWord(answer)];
		}
	} else {
		display = `${first} ${operator} ${second} = ?`;
		speechParts = [numberWord(first), operator === "+" ? "plus" : "moins", numberWord(second), "font combien ?"];
	}
	const correct =
		mission.mode === "missing" ||
		(mission.mode === "story" && chapter.skill === "complement")
			? second
			: answer;
	return {
		display,
		dialogue: dialogue("yuki", speechParts),
		answer: correct,
		choices: choicesFor(correct, limit),
	};
}

export function createMathQuestions(mission: MathMission, count = 8) {
	return Array.from({ length: count }, () => questionFor(mission));
}
