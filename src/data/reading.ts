import { syllablesOf, VOWELS } from "./syllables";
import type { Chapter } from "./chapter";

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

export const CHAPTERS: LetterChapter[] = [
	{
		id: 0,
		label: "A I O",
		letters: [],
		title: "Le réveil des voyelles",
		boss: "Grignoton",
		hue: 0,
		color: "#ff4fa3",
		introVideo: "/videos/king-chuuut-arrival.webm",
		intro: [
			{
				who: "mochi",
				text: "Au secours ! Le Roi Chuuut a volé tous les sons du monde ! Aide-moi à les retrouver !",
			},
			{
				who: "king",
				text: "Chuuut ! Plus de sons, plus de mots ! Le silence pour toujours ! Mouahaha !",
			},
			{
				who: "hero",
				text: "On va retrouver les sons et rendre les mots au monde !",
			},
			{
				who: "mochi",
				text: "Pour déjouer ses démons, apprenons les sons. On commence par les voyelles : a, i, o, u, é et ou !",
			},
		],
		outro: [
			{ who: "mochi", text: "Bravo ! Les voyelles brillent à nouveau !" },
			{
				who: "hero",
				text: "Maintenant, collons des lettres aux voyelles pour former des syllabes !",
			},
		],
	},
	{
		id: 1,
		label: "L",
		letters: ["l"],
		title: "La lettre L",
		boss: "Lézardo le Lugubre",
		hue: 90,
		color: "#7ddc4a",
		intro: [
			{
				who: "mochi",
				text: "Un démon lézard a caché la lettre L dans le parc !",
			},
			{
				who: "mochi",
				text: "La lettre L fait « llll » avec sa langue. Avec a, elle fait la. Avec i, elle fait li !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Lézardo est battu ! La, li, lo, lu, lé, lou : tu connais la lettre L !",
			},
		],
	},
	{
		id: 2,
		label: "M",
		letters: ["m"],
		title: "La lettre M",
		boss: "Maître Moustache",
		hue: 300,
		color: "#ff7ad9",
		intro: [
			{
				who: "mochi",
				text: "Mmmm... ça sent bon au marché ! Mais Maître Moustache a volé la lettre M !",
			},
			{
				who: "mochi",
				text: "M fait « mmmm » comme quand c'est délicieux. Avec a : ma !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Miam ! Ma, mi, mo, mu, mé, mou : la lettre M est libérée !",
			},
		],
	},
	{
		id: 3,
		label: "R",
		letters: ["r"],
		title: "La lettre R",
		boss: "Rakoro le Rat-Démon",
		hue: 30,
		color: "#ff9a2e",
		intro: [
			{
				who: "mochi",
				text: "Rrrr ! Tu entends ? C'est Rakoro qui grogne près de la rivière !",
			},
			{
				who: "mochi",
				text: "R roule « rrrr » dans la gorge. Avec a, ça fait ra !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Rakoro s'est enfui ! Ra, ri, ro, ru, ré, rou : super !",
			},
		],
	},
	{
		id: 4,
		label: "S",
		letters: ["s"],
		title: "La lettre S",
		boss: "Serpentine",
		hue: 150,
		color: "#34c3ff",
		intro: [
			{
				who: "mochi",
				text: "Ssss... Serpentine le serpent siffle dans notre studio !",
			},
			{
				who: "mochi",
				text: "S siffle « ssss » comme un serpent. Avec a : sa !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Serpentine ne siffle plus ! Sa, si, so, su, sé, sou : bravo !",
			},
		],
	},
	{
		id: 5,
		label: "P",
		letters: ["p"],
		title: "La lettre P",
		boss: "Pirata Poulpe",
		hue: 200,
		color: "#b36bff",
		intro: [
			{
				who: "mochi",
				text: "Un pirate-poulpe a volé la lettre P dans son bateau !",
			},
			{
				who: "mochi",
				text: "P fait un petit bruit « p » qui éclate comme une bulle. Avec a : pa !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Plouf ! Pirata Poulpe tombe à l'eau ! Pa, pi, po, pu, pé, pou !",
			},
		],
	},
	{
		id: 6,
		label: "T",
		letters: ["t"],
		title: "La lettre T",
		boss: "Tornado Toto",
		hue: 60,
		color: "#ffd23f",
		intro: [
			{ who: "mochi", text: "Tornado Toto fait tourner la Tour de la Télé !" },
			{
				who: "mochi",
				text: "T tape « t, t, t » comme de petits pas. Avec a : ta !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "La tornade s'arrête ! Ta, ti, to, tu, té, tou : génial !",
			},
		],
	},
	{
		id: 7,
		label: "N",
		letters: ["n"],
		title: "La lettre N",
		boss: "Ninja Nuit-Noire",
		hue: 260,
		color: "#8f7bff",
		intro: [
			{
				who: "mochi",
				text: "Un ninja se cache dans les nuages ! Il a volé la lettre N !",
			},
			{ who: "mochi", text: "N fait « nnnn » dans le nez. Avec a : na !" },
		],
		outro: [
			{
				who: "mochi",
				text: "Le ninja est démasqué ! Na, ni, no, nu, né, nou !",
			},
		],
	},
	{
		id: 8,
		label: "D",
		letters: ["d"],
		title: "La lettre D",
		boss: "Dragonito",
		hue: 120,
		color: "#2ee0a0",
		intro: [
			{ who: "mochi", text: "Dragonito crache du feu sur les diamants !" },
			{
				who: "mochi",
				text: "D tape « d » avec la langue derrière les dents. Avec a : da !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Dragonito fait dodo ! Da, di, do, du, dé, dou : bien joué !",
			},
		],
	},
	{
		id: 9,
		label: "B",
		letters: ["b"],
		title: "La lettre B",
		boss: "Baba Boubou",
		hue: 180,
		color: "#ff4fa3",
		intro: [
			{ who: "mochi", text: "Baba Boubou enferme les sons dans des bulles !" },
			{
				who: "mochi",
				text: "B fait « b » avec les lèvres qui se collent. Avec a : ba ! Comme B-A BA !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Les bulles éclatent ! Ba, bi, bo, bu, bé, bou : tu es [un champion|une championne] !",
			},
		],
	},
	{
		id: 10,
		label: "F",
		letters: ["f"],
		title: "La lettre F",
		boss: "Fifi Fantôme",
		hue: 220,
		color: "#7ddc4a",
		intro: [
			{ who: "mochi", text: "Fifi Fantôme fait peur aux fées de la forêt !" },
			{ who: "mochi", text: "F souffle « ffff » comme le vent. Avec a : fa !" },
		],
		outro: [
			{
				who: "mochi",
				text: "Pfiou ! Fifi s'envole ! Fa, fi, fo, fu, fé, fou !",
			},
		],
	},
	{
		id: 11,
		label: "V",
		letters: ["v"],
		title: "La lettre V",
		boss: "Vampirou",
		hue: 330,
		color: "#b36bff",
		intro: [
			{ who: "mochi", text: "Vampirou s'est installé dans le volcan violet !" },
			{
				who: "mochi",
				text: "V vibre « vvvv » comme une abeille. Avec a : va !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Vampirou va se coucher ! Va, vi, vo, vu, vé, vou : bravo !",
			},
		],
	},
	{
		id: 12,
		label: "CH",
		letters: ["ch"],
		title: "Le son CH",
		boss: "Chachat Noir",
		hue: 280,
		color: "#ff7ad9",
		intro: [
			{
				who: "mochi",
				text: "Attention : C et H ensemble font « chhhh », comme pour dire chut !",
			},
			{
				who: "mochi",
				text: "Deux lettres, un seul son ! Avec a : cha, comme chat !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Chachat Noir ronronne maintenant ! Cha, chi, cho, chu, ché, chou !",
			},
		],
		tip: "C + H = un seul son : « ch ».",
	},
	{
		id: 13,
		label: "J",
		letters: ["j"],
		title: "La lettre J",
		boss: "Jojo le Jongleur",
		hue: 40,
		color: "#ffd23f",
		intro: [
			{
				who: "mochi",
				text: "Jojo le Jongleur a volé tous les jouets de la jungle !",
			},
			{
				who: "mochi",
				text: "J fait « jjjj » comme un moteur doux. Avec a : ja !",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Les jouets sont sauvés ! Ja, ji, jo, ju, jé, jou !",
			},
		],
	},
	{
		id: 14,
		label: "C · G",
		letters: ["c", "g"],
		title: "Les pièges C et G",
		boss: "Capitaine Gorgo",
		hue: 100,
		color: "#34c3ff",
		intro: [
			{
				who: "mochi",
				text: "Attention, c'est la grotte aux pièges ! C et G sont des lettres farceuses !",
			},
			{
				who: "mochi",
				text: "Devant a, o, u et ou, C fait le son de cadeau, et G celui de gâteau. Ca, co, cu, cou... ga, go, gou !",
			},
			{
				who: "mochi",
				text: "Mais devant i et e, ils changent de voix ! Alors ici, on reste avec a, o, u et ou.",
			},
		],
		outro: [
			{
				who: "mochi",
				text: "Capitaine Gorgo est vaincu ! Tu as déjoué les pièges !",
			},
		],
		tip: "C et G sont durs devant a, o, u, ou (ca, go). Devant e et i, C se lit « s » et G se lit « j » : on les verra plus tard.",
	},
	{
		id: 15,
		label: "★",
		letters: [],
		title: "Le Grand Défi",
		boss: "Le Roi Chuuut",
		hue: 0,
		color: "#ffd23f",
		intro: [
			{
				who: "king",
				text: "Grrr ! Tu as libéré toutes les lettres ! Mais tu ne gagneras pas le Grand Défi !",
			},
			{
				who: "mochi",
				text: "Tu connais maintenant plein de syllabes. Ensemble, nous pouvons battre le Roi Chuuut !",
			},
		],
		outro: [
			{
				who: "king",
				text: "Nooon ! Tous ces mots... c'est... trop joli ! Bon d'accord, j'arrête de faire chuuut !",
			},
			{
				who: "hero",
				text: "Les sons sont libres et les mots résonnent de nouveau !",
			},
			{
				who: "mochi",
				text: "On a réussi ensemble ! Tu peux rejouer les missions pour gagner encore plus d'étoiles !",
			},
		],
	},
];

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
