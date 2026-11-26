export const CARTOON_STAGES = [
	{ id: "image-prompt", label: "Textes des images", short: "1", description: "Définir chaque image-clé" },
	{ id: "image-review", label: "Images", short: "2", description: "Importer et valider les images ImageGen" },
	{ id: "narration-text", label: "Textes du narrateur", short: "3", description: "Relire et valider la narration" },
	{ id: "narration-audio", label: "Audio du narrateur", short: "4", description: "Générer et valider la voix avant la vidéo" },
	{ id: "motion-prompt", label: "Mouvement du plan", short: "5", description: "Décrire le mouvement du plan avant le clip" },
	{ id: "clip-review", label: "Clips", short: "6", description: "Générer et valider les clips dans ComfyUI" },
	{ id: "music-review", label: "Musique d'ambiance", short: "7", description: "Créer, écouter et valider la musique de fond" },
	{ id: "assembly", label: "Assemblage", short: "8", description: "Mixer et exporter le dessin animé" },
] as const;

export type CartoonStageId = (typeof CARTOON_STAGES)[number]["id"];
export type ReviewStageId = Exclude<CartoonStageId, "assembly" | "music-review">;
export type CartoonAssetKind = "image" | "clip" | "audio";

export interface CartoonScene {
	id: string;
	title: string;
	imagePrompt: string;
	motionPrompt: string;
	narration: string;
	narrationDurationSeconds?: number;
	clipDurationSeconds?: number;
	approved: Partial<Record<ReviewStageId, boolean>>;
	assets: Partial<Record<CartoonAssetKind, string>>;
}

const LOOK = "Dessin animé peint à la main, gouache et aquarelle sur papier texturé, contours doux au crayon, couleurs lumineuses et chaleureuses, animation familiale, expressions lisibles, décor détaillé mais tendre, composition cinématographique 16:9. Respecter les images de référence des personnages Mochi, du Roi Chuuut et des démons lorsqu'elles sont fournies. Aucun texte écrit dans l'image.";

export const INITIAL_CARTOON_SCENES: CartoonScene[] = [
	{
		id: "king-arrival-01",
		title: "Le royaume lointain",
		imagePrompt: `${LOOK} Plan d'ouverture large : un royaume féerique niché entre des collines pastel, des tours fines, des toits colorés et une rivière scintillante. Le soleil se lève derrière les montagnes, quelques oiseaux traversent un ciel doré. L'image doit donner envie d'entrer dans un conte, sans personnage au premier plan.`,
		motionPrompt: "La caméra avance lentement au-dessus des collines vers le royaume. Les nuages glissent doucement, la rivière scintille et quelques oiseaux passent devant l'objectif. Mouvement calme de générique de conte, sans coupe.",
		narration: "Il était une fois dans un lointain royaume…",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-01-kingdom.jpg",
			clip: "/assets/work/cartoon-studio/clips/scene-01-kingdom.mp4",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-opening.wav",
		},
	},
	{
		id: "king-arrival-02",
		title: "Mochi, toujours bavard",
		imagePrompt: `${LOOK} Utiliser la référence peinte à la main de Mochi : petite créature féline blanche et duveteuse, grandes oreilles pointues, grands yeux bleus, joues roses, écharpe lavande et pendentif étoile dorée. Le montrer au centre d'une place de village, enthousiaste et en train de parler, entouré de bulles lumineuses abstraites sans lettres. Des habitants souriants l'écoutent.`,
		motionPrompt: "Mochi parle avec enthousiasme, remue les pattes et les petites ailes. Des bulles lumineuses apparaissent et montent autour de lui. La caméra fait un léger travelling circulaire, l'énergie reste joyeuse et comique.",
		narration: "Dans ce royaume vivait Mochi, une petite créature blanche qui avait toujours une histoire à raconter. Il parlait du matin au soir, sans jamais s'arrêter !",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-02-mochi-talks.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-02-mochi-talks.wav",
			clip: "/assets/work/cartoon-studio/clips/scene-02-mochi-talks.mp4",
		},
	},
	{
		id: "king-arrival-03",
		title: "La menace de ses frères",
		imagePrompt: `${LOOK} Référence peinte à la main de Mochi : petit chat blanc duveteux, yeux bleus, écharpe lavande, pendentif étoile dorée. Dans une petite maison chaleureuse, Mochi raconte encore une histoire avec de grands gestes. Ses deux frères, deux petites créatures blanches de la même famille, échangent un regard amusé et un peu fatigué. L'un montre gentiment la porte et l'autre fait un geste de « chut ». Scène drôle et affectueuse, personne n'est fâché.`,
		motionPrompt: "Les frères se penchent l'un vers l'autre, puis l'un d'eux mime le geste de téléphoner et désigne le ciel comme s'il allait appeler le Roi Chut. Mochi s'arrête net, surpris. Jeu d'expressions léger, caméra fixe avec un petit zoom comique.",
		narration: "Un jour, ses frères lui dirent : « Mochi, si tu ne fais pas une petite pause, nous appellerons le Roi Chut pour te faire taire ! »",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-03-brothers.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-03-brothers.wav",
		},
	},
	{
		id: "king-arrival-04",
		title: "Le Roi Chuuut entend l'invitation",
		imagePrompt: `${LOOK} Référence peinte à la main du Roi Chuuut : petit roi à la carrure ronde, cheveux et barbe bouclés lavande, couronne dorée ornée de gemmes turquoise, robe et grande cape violettes bordées d'or, doigt posé devant les lèvres. Il entend au loin qu'on l'appelle et comprend la phrase comme une invitation. Il sourit et se redresse sur son trône tandis que ses petits démons ailés s'éveillent derrière lui. Atmosphère mystérieuse mais enfantine.`,
		motionPrompt: "Le Roi Chuuut tourne la tête en entendant son nom, retire son doigt de ses lèvres et se lève avec enthousiasme, persuadé d'être invité. Ses démons se réveillent et s'envolent derrière lui. La caméra accompagne son départ du château vers le royaume.",
		narration: "Mais le Roi Chuuut entendit leur phrase. Il crut qu'on l'invitait ! Aussitôt, il enfila sa couronne et partit pour le royaume avec ses démons.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-04-king-hears-call.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-04-king-hears-call.wav",
		},
	},
	{
		id: "king-arrival-05",
		title: "La première vague de silence",
		imagePrompt: `${LOOK} Sur la place du royaume, le Roi Chuuut et ses petits démons commencent à lancer une magie violette. Les habitants discutent encore entre eux, bouche ouverte au milieu d'une phrase, avec des gestes de conversation et des visages détendus. Ils n'ont pas encore remarqué le sort, ne sont pas alarmés et ne portent pas les mains à la gorge. Quelques ondes lumineuses abstraites commencent à peine à s'échapper des maisons. Ne montrer ni instruments ni notes de musique : c'est l'instant juste avant que le silence tombe. Garder des couleurs vives, aucun mot lisible.`,
		motionPrompt: "En un seul plan continu, commencer avec les habitants qui discutent normalement, souriants ou détendus, sans avoir remarqué la magie. Le Roi Chuuut et ses démons ont déjà l'air malicieux : yeux plissés, sourcils arqués et sourire narquois. Les démons tournent autour de la place et aspirent de fines ondes lumineuses qui s'échappent des maisons et des voix. Au début, les habitants poursuivent leurs conversations; dès que leur voix s'éteint, ils deviennent alarmés : yeux écarquillés, mains qui se portent à la gorge, bouche ouverte pour appeler mais aucun son ne sort. Aucun sourire à partir de ce moment. Pendant ce temps, le roi et les démons gardent leurs expressions méchantes et ricanent en regardant les habitants. À la fin du plan, ils rient franchement, avec un sourire cruel et les épaules qui tressautent, tandis que les villageois restent alarmés et silencieux. Le roi et les démons ne sont jamais surpris, tristes ou inquiets. Les ondes se courbent vers un tourbillon violet auprès du Roi Chuuut, rétrécissent puis disparaissent dedans. Les couleurs de la ville s'adoucissent légèrement. Ne montrer ni instruments ni notes de musique; mouvement magique doux, sans violence.",
		narration: "Avec l'aide de ses démons, le Roi Chuuut lança sa magie sur le royaume. Des sons et de petites lumières s'envolèrent dans les airs. Le silence commençait à tomber.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-05-first-sounds.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-05-first-sounds.wav",
		},
	},
	{
		id: "king-arrival-06-melodies",
		title: "Les mélodies s'éteignent",
		imagePrompt: `${LOOK} Référence Roi Chuuut : king-chuuut-peint-main.png. Référence des démons : demon-peint-main.png. Dans une rue colorée, les petits démons recueillent les notes qui sortent d'une flûte, d'un tambour et d'une boîte à musique. Le Roi Chuuut les rassemble dans un tourbillon violet. Les musiciens s'arrêtent, étonnés, et les instruments deviennent silencieux. Garder les instruments visibles, aucune note ni lettre lisible.`,
		motionPrompt: "Plan continu, sans coupe, expressions très lisibles. Les musiciens commencent en train de jouer, puis sursautent quand les notes apparaissent et que les démons les aspirent. Chaque note suit une trajectoire visible en spirale vers les démons puis vers l'orbe violet du Roi Chuuut, accélère, rétrécit et est engloutie une par une; elle disparaît complètement et ne revient pas. Au fil de leur disparition, les musiciens passent de la surprise à la tristesse: sourcils qui retombent, regards déçus vers leurs instruments devenus silencieux, épaules qui s'affaissent. Pendant toute la scène, le Roi Chuuut et ses démons ricanent méchamment, avec des sourires narquois, des yeux plissés et des sourcils arqués; ils sont ravis de voler les notes et ne deviennent jamais tristes, inquiets ou compatissants. Le tambour cesse de vibrer, la flûte se tait et le mécanisme de la boîte à musique s'immobilise. Finir sur les musiciens visiblement tristes auprès de leurs instruments muets, tandis que le roi et les démons rient de leur tourbillon violet chargé des notes volées. Garder les personnages et les instruments stables, émotions lisibles, sans coupe ni nouveau décor.",
		narration: "Puis les démons s'attaquèrent aux mélodies. Ils aspirèrent les notes des flûtes, des tambours et des boîtes à musique. Les musiciens continuèrent leurs gestes, mais plus aucun son ne sortit.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-06-melodies-fade.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-06-melodies.wav",
		},
	},
	{
		id: "king-arrival-07-words",
		title: "Les mots s'effacent",
		imagePrompt: `${LOOK} Référence Mochi : mochi-peint-main.png. Référence Roi Chuuut : king-chuuut-peint-main.png. Sur la place, les habitants essaient de se parler. De petites formes lumineuses sans lettres apparaissent devant leurs bouches puis s'effacent avant d'atteindre leurs voisins. Mochi regarde la scène, inquiet. Au loin, le Roi Chuuut et ses démons recueillent ces lueurs dans un sac magique. Scène tendre, sans peur.`,
		motionPrompt: "Les habitants ouvrent la bouche pour s'appeler; de petits fragments lumineux s'échappent puis se dissipent dans l'air. Mochi se retourne vers eux, puis suit du regard les lueurs qui s'éloignent vers le roi. Ralentir le mouvement à mesure que la place se tait.",
		narration: "Ensuite, les syllabes quittèrent les mots. Les habitants se regardèrent, incapables de s'appeler. Même les histoires commencées s'arrêtaient au milieu d'une phrase.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-07-syllables-fade.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-07-syllables.wav",
		},
	},
	{
		id: "king-arrival-08-silence",
		title: "Le silence envahit la place",
		imagePrompt: `${LOOK} Référence Mochi : mochi-peint-main.png. Une large vue de la place devenue presque silencieuse. Les musiciens tiennent leurs instruments immobiles, les habitants se parlent par gestes, des rubans de couleurs et des notes ne flottent plus dans l'air. Mochi est au premier plan, triste mais courageux, tandis que le Roi Chuuut et ses petits démons s'éloignent avec leur butin sonore. Les couleurs sont plus douces mais l'image reste chaleureuse et pleine d'espoir.`,
		motionPrompt: "Un panoramique lent traverse la place : une cloche ne tinte pas, un instrument reste immobile, les habitants se font signe sans parler. La caméra s'arrête sur Mochi. Il serre son pendentif étoile, lève les yeux vers la route qui quitte le village et retrouve du courage.",
		narration: "Le silence s'étendit sur toute la place. Plus de chansons, plus de rires, plus de petites histoires. Mochi comprit qu'il devait trouver de l'aide.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-08-silent-square.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-08-silent-square.wav",
		},
	},
	{
		id: "king-arrival-06",
		title: "Mochi part chercher un héros",
		imagePrompt: `${LOOK} Référence Mochi : mochi-peint-main.png. Dans le royaume devenu silencieux et aux couleurs adoucies, Mochi regarde les rues sans musique. Il serre son étoile dorée contre lui puis prend une petite sacoche et se met en route sur un chemin qui traverse les collines. À l'horizon, une lueur chaleureuse suggère qu'un héros pourrait se trouver quelque part. Portrait de dos puis profil de Mochi, courageux et déterminé.`,
		motionPrompt: "Mochi prend une inspiration, ajuste sa sacoche et se met à marcher vers les collines. La caméra le suit de derrière puis s'élève doucement pour révéler le long chemin devant lui. Une petite lueur apparaît à l'horizon, fin sur une image qui ouvre la suite de l'aventure.",
		narration: "Alors Mochi partit à la recherche d'un héros. Il espérait trouver quelqu'un capable de rendre au royaume ses syllabes, ses chansons et ses histoires.",
		approved: {},
		assets: {
			image: "/assets/work/cartoon-studio/storyboard/scene-09-mochi-departs.jpg",
			audio: "/assets/work/cartoon-studio/narration/cartoon-narrator-scene-09-mochi-departs.wav",
		},
	},
];
