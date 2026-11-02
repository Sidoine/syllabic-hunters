import { shuffle } from "../lib/utils";

export type MathSkill = "addition" | "subtraction" | "complement" | "mixed";
export type MathMode = "result" | "missing" | "story";

export interface MathChapter {
	id: number;
	title: string;
	place: string;
	label: string;
	color: string;
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
	spokenParts: string[];
	answer: number;
	choices: number[];
}

export const MATH_CHAPTERS: MathChapter[] = [
	{
		id: 0,
		title: "Les étoiles jusqu'à 5",
		place: "Le Jardin des petites étoiles",
		label: "1–5",
		color: "#ff4fa3",
		skill: "addition",
		limit: 5,
	},
	{
		id: 1,
		title: "Les additions jusqu'à 10",
		place: "Le Parc des Lumières",
		label: "+10",
		color: "#34c3ff",
		skill: "addition",
		limit: 10,
	},
	{
		id: 2,
		title: "Les soustractions jusqu'à 10",
		place: "La Grotte des Échos",
		label: "−10",
		color: "#b36bff",
		skill: "subtraction",
		limit: 10,
	},
	{
		id: 3,
		title: "Les compléments à 10",
		place: "Le Temple des Dix",
		label: "10",
		color: "#ffd23f",
		skill: "complement",
		limit: 10,
	},
	{
		id: 4,
		title: "Les additions jusqu'à 20",
		place: "Le Pont des Vingtaines",
		label: "+20",
		color: "#2ee0a0",
		skill: "addition",
		limit: 20,
	},
	{
		id: 5,
		title: "Les calculs mélangés",
		place: "Le Grand Stade des Nombres",
		label: "±20",
		color: "#ff7ad9",
		skill: "mixed",
		limit: 20,
	},
];

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

function makeEquation(chapter: MathChapter) {
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
	const first = randomInt(chapter.limit);
	const second = randomInt(chapter.limit - first);
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
	const { first, second, answer, operator, limit } = makeEquation(chapter);
	let display: string;
	let spokenParts: string[];
	if (mission.mode === "story") {
		if (chapter.skill === "complement") {
			display = `Hana a ${first} étoiles. Combien lui en manque-t-il pour en avoir 10 ?`;
			spokenParts = ["Hana a", numberWord(first), "étoiles. Combien lui en manque-t-il pour en avoir dix ?"];
		} else if (operator === "−") {
			display = `Mia a ${first} étoiles. Elle en offre ${second}. Combien lui en reste-t-il ?`;
			spokenParts = ["Mia a", numberWord(first), "étoiles. Elle en offre", numberWord(second), "étoiles. Combien lui en reste-t-il ?"];
		} else {
			display = `Luna gagne ${first} étoiles, puis ${second}. Combien en gagne-t-elle en tout ?`;
			spokenParts = ["Luna gagne", numberWord(first), "étoiles, puis", numberWord(second), "étoiles. Combien en gagne-t-elle en tout ?"];
		}
	} else if (mission.mode === "missing") {
		if (operator === "−") {
			display = `${first} − ? = ${answer}`;
			spokenParts = ["Quel nombre manque ?", numberWord(first), "moins combien font", numberWord(answer)];
		} else {
			display = `${first} + ? = ${answer}`;
			spokenParts = ["Quel nombre manque ?", numberWord(first), "plus combien font", numberWord(answer)];
		}
	} else {
		display = `${first} ${operator} ${second} = ?`;
		spokenParts = [numberWord(first), operator === "+" ? "plus" : "moins", numberWord(second), "font combien ?"];
	}
	const correct =
		mission.mode === "missing" ||
		(mission.mode === "story" && chapter.skill === "complement")
			? second
			: answer;
	return {
		display,
		spokenParts,
		answer: correct,
		choices: choicesFor(correct, limit),
	};
}

export function createMathQuestions(mission: MathMission, count = 8) {
	return Array.from({ length: count }, () => questionFor(mission));
}
