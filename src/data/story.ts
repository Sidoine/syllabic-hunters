import { syllablesOf, VOWELS } from "./syllables";

export type Speaker = "hero" | "hana" | "yuki" | "momo" | "milo" | "zelane" | "mochi" | "king" | "boss";

export interface Line {
	who: Speaker;
	text: string;
}

export const WORLD_INTRO_LINES: Line[] = [
	{ who: "hero", text: "Deux chemins s’ouvrent devant nous !" },
	{ who: "mochi", text: "À l’ouest, la forêt de la lecture. À l’est, la montagne des nombres !" },
	{ who: "hero", text: "Allons explorer ! On pourra toujours revenir pour découvrir l’autre région." },
];

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

export interface Chapter {
	id: number;
	title: string;
	place: string;
	letters: string[]; // consonnes (vide = voyelles)
	label: string; // affichage
	boss: string;
	bossEmoji: string;
	hue: number; // teinte du démon
	color: string;
	tip?: string; // règle spéciale pour les parents / enfants
	intro: Line[];
	outro: Line[];
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

const C = (
	letters: string[],
	title: string,
	place: string,
	boss: string,
	bossEmoji: string,
	hue: number,
	color: string,
	intro: Line[],
	outro: Line[],
	tip?: string,
) => ({
	letters,
	title,
	place,
	boss,
	bossEmoji,
	hue,
	color,
	intro,
	outro,
	tip,
});

const RAW_CHAPTERS = [
	C(
		[],
		"Le réveil des voyelles",
		"Scène Néon de Séoul-sur-Mer",
		"Grignoton",
		"👾",
		0,
		"#ff4fa3",
		[
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
		[
			{ who: "mochi", text: "Bravo ! Les voyelles brillent à nouveau !" },
			{
				who: "hero",
				text: "Maintenant, collons des lettres aux voyelles pour former des syllabes !",
			},
		],
	),
	C(
		["l"],
		"La lettre L",
		"Le Parc aux Lampions",
		"Lézardo le Lugubre",
		"🦎",
		90,
		"#7ddc4a",
		[
			{
				who: "mochi",
				text: "Un démon lézard a caché la lettre L dans le parc !",
			},
			{
				who: "mochi",
				text: "La lettre L fait « llll » avec sa langue. Avec a, elle fait la. Avec i, elle fait li !",
			},
		],
		[
			{
				who: "hero",
				text: "Lézardo est battu ! La, li, lo, lu, lé, lou : tu connais la lettre L !",
			},
		],
	),
	C(
		["m"],
		"La lettre M",
		"Le Marché de Minuit",
		"Maître Moustache",
		"🥸",
		300,
		"#ff7ad9",
		[
			{
				who: "mochi",
				text: "Mmmm... ça sent bon au marché ! Mais Maître Moustache a volé la lettre M !",
			},
			{
				who: "hero",
				text: "M fait « mmmm » comme quand c'est délicieux. Avec a : ma !",
			},
		],
		[
			{
				who: "mochi",
				text: "Miam ! Ma, mi, mo, mu, mé, mou : la lettre M est libérée !",
			},
		],
	),
	C(
		["r"],
		"La lettre R",
		"La Rivière Arc-en-ciel",
		"Rakoro le Rat-Démon",
		"🐀",
		30,
		"#ff9a2e",
		[
			{
				who: "mochi",
				text: "Rrrr ! Tu entends ? C'est Rakoro qui grogne près de la rivière !",
			},
			{
				who: "mochi",
				text: "R roule « rrrr » dans la gorge. Avec a, ça fait ra !",
			},
		],
		[
			{
				who: "mochi",
				text: "Rakoro s'est enfui ! Ra, ri, ro, ru, ré, rou : super !",
			},
		],
	),
	C(
		["s"],
		"La lettre S",
		"Le Studio des Stars",
		"Serpentine",
		"🐍",
		150,
		"#34c3ff",
		[
			{
				who: "hero",
				text: "Ssss... Serpentine le serpent siffle dans notre studio !",
			},
			{
				who: "mochi",
				text: "S siffle « ssss » comme un serpent. Avec a : sa !",
			},
		],
		[
			{
				who: "hero",
				text: "Serpentine ne siffle plus ! Sa, si, so, su, sé, sou : bravo !",
			},
		],
	),
	C(
		["p"],
		"La lettre P",
		"Le Port des Paillettes",
		"Pirata Poulpe",
		"🐙",
		200,
		"#b36bff",
		[
			{
				who: "mochi",
				text: "Un pirate-poulpe a volé la lettre P dans son bateau !",
			},
			{
				who: "mochi",
				text: "P fait un petit bruit « p » qui éclate comme une bulle. Avec a : pa !",
			},
		],
		[
			{
				who: "mochi",
				text: "Plouf ! Pirata Poulpe tombe à l'eau ! Pa, pi, po, pu, pé, pou !",
			},
		],
	),
	C(
		["t"],
		"La lettre T",
		"La Tour de la Télé",
		"Tornado Toto",
		"🌪️",
		60,
		"#ffd23f",
		[
			{ who: "hero", text: "Tornado Toto fait tourner la Tour de la Télé !" },
			{
				who: "mochi",
				text: "T tape « t, t, t » comme de petits pas. Avec a : ta !",
			},
		],
		[
			{
				who: "mochi",
				text: "La tornade s'arrête ! Ta, ti, to, tu, té, tou : génial !",
			},
		],
	),
	C(
		["n"],
		"La lettre N",
		"Le Nuage Ninja",
		"Ninja Nuit-Noire",
		"🥷",
		260,
		"#8f7bff",
		[
			{
				who: "mochi",
				text: "Un ninja se cache dans les nuages ! Il a volé la lettre N !",
			},
			{ who: "mochi", text: "N fait « nnnn » dans le nez. Avec a : na !" },
		],
		[
			{
				who: "hero",
				text: "Le ninja est démasqué ! Na, ni, no, nu, né, nou !",
			},
		],
	),
	C(
		["d"],
		"La lettre D",
		"Le Désert des Diamants",
		"Dragonito",
		"🐉",
		120,
		"#2ee0a0",
		[
			{ who: "mochi", text: "Dragonito crache du feu sur les diamants !" },
			{
				who: "hero",
				text: "D tape « d » avec la langue derrière les dents. Avec a : da !",
			},
		],
		[
			{
				who: "mochi",
				text: "Dragonito fait dodo ! Da, di, do, du, dé, dou : bien joué !",
			},
		],
	),
	C(
		["b"],
		"La lettre B",
		"La Boîte à Bulles",
		"Baba Boubou",
		"🫧",
		180,
		"#ff4fa3",
		[
			{ who: "mochi", text: "Baba Boubou enferme les sons dans des bulles !" },
			{
				who: "mochi",
				text: "B fait « b » avec les lèvres qui se collent. Avec a : ba ! Comme B-A BA !",
			},
		],
		[
			{
				who: "hero",
				text: "Les bulles éclatent ! Ba, bi, bo, bu, bé, bou : tu es une championne !",
			},
		],
	),
	C(
		["f"],
		"La lettre F",
		"La Forêt des Fées",
		"Fifi Fantôme",
		"👻",
		220,
		"#7ddc4a",
		[
			{ who: "mochi", text: "Fifi Fantôme fait peur aux fées de la forêt !" },
			{ who: "mochi", text: "F souffle « ffff » comme le vent. Avec a : fa !" },
		],
		[
			{
				who: "mochi",
				text: "Pfiou ! Fifi s'envole ! Fa, fi, fo, fu, fé, fou !",
			},
		],
	),
	C(
		["v"],
		"La lettre V",
		"Le Volcan Violet",
		"Vampirou",
		"🧛",
		330,
		"#b36bff",
		[
			{ who: "hero", text: "Vampirou s'est installé dans le volcan violet !" },
			{
				who: "mochi",
				text: "V vibre « vvvv » comme une abeille. Avec a : va !",
			},
		],
		[
			{
				who: "mochi",
				text: "Vampirou va se coucher ! Va, vi, vo, vu, vé, vou : bravo !",
			},
		],
	),
	C(
		["ch"],
		"Le son CH",
		"Le Château des Chats",
		"Chachat Noir",
		"🐈‍⬛",
		280,
		"#ff7ad9",
		[
			{
				who: "mochi",
				text: "Attention : C et H ensemble font « chhhh », comme pour dire chut !",
			},
			{
				who: "mochi",
				text: "Deux lettres, un seul son ! Avec a : cha, comme chat !",
			},
		],
		[
			{
				who: "hero",
				text: "Chachat Noir ronronne maintenant ! Cha, chi, cho, chu, ché, chou !",
			},
		],
		"C + H = un seul son : « ch ».",
	),
	C(
		["j"],
		"La lettre J",
		"La Jungle des Jouets",
		"Jojo le Jongleur",
		"🤹",
		40,
		"#ffd23f",
		[
			{
				who: "mochi",
				text: "Jojo le Jongleur a volé tous les jouets de la jungle !",
			},
			{
				who: "hero",
				text: "J fait « jjjj » comme un moteur doux. Avec a : ja !",
			},
		],
		[
			{
				who: "mochi",
				text: "Les jouets sont sauvés ! Ja, ji, jo, ju, jé, jou !",
			},
		],
	),
	C(
		["c", "g"],
		"Les pièges C et G",
		"La Grotte aux Runes",
		"Capitaine Gorgo",
		"🦍",
		100,
		"#34c3ff",
		[
			{
				who: "mochi",
				text: "Attention, c'est la grotte aux pièges ! C et G sont des lettres farceuses !",
			},
			{
				who: "hero",
				text: "Devant a, o, u et ou, C fait le son de cadeau, et G celui de gâteau. Ca, co, cu, cou... ga, go, gou !",
			},
			{
				who: "mochi",
				text: "Mais devant i et e, ils changent de voix ! Alors ici, on reste avec a, o, u et ou.",
			},
		],
		[
			{
				who: "mochi",
				text: "Capitaine Gorgo est vaincu ! Tu as déjoué les pièges !",
			},
		],
		"C et G sont durs devant a, o, u, ou (ca, go). Devant e et i, C se lit « s » et G se lit « j » : on les verra plus tard.",
	),
	C(
		[],
		"Le Grand Défi",
		"Le Stade des Étoiles",
		"Le Roi Chuuut",
		"👑",
		0,
		"#ffd23f",
		[
			{
				who: "king",
				text: "Grrr ! Tu as libéré toutes les lettres ! Mais tu ne gagneras pas le Grand Défi !",
			},
			{
				who: "mochi",
				text: "Tu connais maintenant plein de syllabes. Ensemble, nous pouvons battre le Roi Chuuut !",
			},
		],
		[
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
	),
];

export const CHAPTERS: Chapter[] = RAW_CHAPTERS.map((c, i) => ({
	...c,
	id: i,
	label: c.letters.length
		? c.letters.map((l) => l.toUpperCase()).join(" · ")
		: i === 0
			? "A I O"
			: "★",
}));

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
