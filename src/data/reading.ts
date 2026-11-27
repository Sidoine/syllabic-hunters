import { syllablesOf, VOWELS } from "./syllables";
import type { Chapter } from "./chapter";
import chapterData from "./reading-chapters.json";

export type MissionType =
	| "vowels"
	| "fusion"
	| "listen-syl"
	| "see-sound"
	| "find-images"
	| "missing"
	| "build"
	| "read-word"
	| "listen-word"
	| "memory"
	| "battle";

export interface Mission {
	id: string;
	chapter: number;
	type: MissionType;
	title: string;
	targets: string[]; // syllabes travaillées
	review: string[]; // syllabes déjà vues (distracteurs)
	consonants: string[];
	startMode?: boolean; // « commence par » (voyelles)
}

export interface LetterChapter extends Chapter {
	letters: string[]; // consonnes (vide = voyelles)
}

export const MISSION_INFO: Record<
	MissionType,
	{ title: string; help: string }
> = {
	vowels: {
		title: "Les voyelles magiques",
		help: "Touche chaque voyelle pour découvrir son son.",
	},
	fusion: {
		title: "Fusion magique",
		help: "Colle la lettre et la voyelle pour créer une syllabe !",
	},
	"listen-syl": {
		title: "L'oreille d'or",
		help: "Écoute le son et trouve la bonne syllabe.",
	},
	"see-sound": {
		title: "Les bulles d’écoute",
		help: "Regarde la syllabe et trouve le bon son.",
	},
	"find-images": {
		title: "Images ensorcelées",
		help: "Trouve toutes les images où l'on entend le son.",
	},
	missing: {
		title: "Le mot brisé",
		help: "Il manque un morceau ! Trouve la syllabe perdue.",
	},
	build: {
		title: "La forge des mots",
		help: "Remets les syllabes dans l'ordre pour écrire le mot.",
	},
	"read-word": {
		title: "Lecture secrète",
		help: "Lis le mot et trouve la bonne image.",
	},
	"listen-word": {
		title: "Le mot mystère",
		help: "Écoute le mot et trouve comment il s'écrit.",
	},
	memory: {
		title: "Cartes jumelles",
		help: "Retrouve les paires : une syllabe et une image qui commence par ce son.",
	},
	battle: {
		title: "Combat de démons",
		help: "Écoute le son et touche le démon qui porte la bonne syllabe !",
	},
};

export const CHAPTERS: LetterChapter[] = chapterData as LetterChapter[];

/* chapter definitions live in reading-chapters.json so the dialogue editor
 * and runtime share the same source of truth. */

const ALL_VOWELS = VOWELS.map((v) => v.id as string);

function buildMissions(): Mission[] {
	const list: Mission[] = [];
	const learned: string[] = [...ALL_VOWELS];
	const add = (
		ch: number,
		type: MissionType,
		targets: string[],
		review: string[],
		consonants: string[],
		extra: Partial<Mission> = {},
	) => {
		const info = MISSION_INFO[type];
		list.push({
			id: `c${ch}-${list.filter((m) => m.chapter === ch).length}`,
			chapter: ch,
			type,
			title: info.title,
			targets,
			review,
			consonants,
			...extra,
		});
	};

	// Chapitre 0 : voyelles
	add(0, "vowels", ALL_VOWELS, [], []);
	add(0, "listen-syl", ALL_VOWELS, [], []);
	add(0, "see-sound", ALL_VOWELS, [], []);
	add(0, "find-images", ALL_VOWELS, [], [], { startMode: true });
	add(0, "memory", ALL_VOWELS, [], [], { startMode: true });
	add(0, "battle", ALL_VOWELS, [], []);

	const finalCh = CHAPTERS.length - 1;
	for (let ch = 1; ch < finalCh; ch++) {
		const chapter = CHAPTERS[ch];
		const targets = chapter.letters.flatMap((l) => syllablesOf(l));
		const review = learned.filter((s) => !ALL_VOWELS.includes(s));
		const k = chapter.letters;
		add(ch, "fusion", targets, review, k);
		add(ch, "listen-syl", targets, review, k);
		add(ch, "find-images", targets, review, k);
		add(ch, "see-sound", targets, review, k);
		add(ch, ch % 2 ? "missing" : "build", targets, review, k);
		add(
			ch,
			ch % 3 === 0 ? "memory" : ch % 3 === 1 ? "read-word" : "listen-word",
			targets,
			review,
			k,
		);
		add(ch, "battle", targets, review, k);
		learned.push(...targets);
	}

	const all = learned.filter((s) => !ALL_VOWELS.includes(s));
	const allK = CHAPTERS.flatMap((c) => c.letters);
	add(finalCh, "listen-word", all, all, allK);
	add(finalCh, "missing", all, all, allK);
	add(finalCh, "read-word", all, all, allK);
	add(finalCh, "build", all, all, allK);
	add(finalCh, "memory", all, all, allK);
	add(finalCh, "battle", all, all, allK, {
		title: "Duel final contre le Roi Chuuut",
	});
	return list;
}

export const MISSIONS: Mission[] = buildMissions();
