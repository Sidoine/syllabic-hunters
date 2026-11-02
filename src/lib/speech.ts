// Synthèse vocale française avec choix de voix et fallback.
const audioFiles = import.meta.glob("../assets/voice/*.wav", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const RECORDED_LINES: Record<string, string> = {
  "bravo !": "cheer-bravo.wav",
  "super !": "cheer-super.wav",
  "génial !": "cheer-genial.wav",
  "oui, c'est ça !": "cheer-oui-cest-ca.wav",
  "trop forte !": "cheer-trop-forte.wav",
  "écoute et touche le démon qui porte la bonne syllabe !": "battle-instruction-touch-demon.wav",
  "magnifique !": "cheer-magnifique.wav",
  "bravo, tu lis très bien !": "read-praise.wav",
  "bravo, bien joué !": "cheer-bien-joue.wav",
  "essaie encore !": "try-essaie-encore.wav",
  "presque ! réessaie.": "try-presque-reessaie.wav",
  "oups ! encore une fois.": "try-oups-encore.wav",
  "hihihi ! raté !": "playful-rate.wav",
  "au secours! le roi chuuut a volé tous les sons du monde!": "story-mochi-au-secours-le-roi-chuuut-a-vole-tous-les-sons-du.wav",
  "chuuut! plus de chansons, plus de mots! le silence pour toujours! mouahaha!": "story-king-chuuut-plus-de-chansons-plus-de-mots-le-silence-.wav",
  "bonjour alix! je suis hana, des lumi stars. nous chassons les démons avec la musique!": "story-hana-bonjour-alix-je-suis-hana-des-lumi-stars-nous-ch.wav",
  "pour les battre, il faut apprendre les sons. on commence par les voyelles : a, i, oh, u, é et où!": "story-yuki-pour-les-battre-il-faut-apprendre-les-sons-on-co.wav",
  "bravo alix! les voyelles chantent à nouveau!": "story-momo-bravo-alix-les-voyelles-chantent-a-nouveau.wav",
  "maintenant, on va coller des lettres aux voyelles pour faire des syllabes. c'est ça, le b-a bas!": "story-hana-maintenant-on-va-coller-des-lettres-aux-voyelles.wav",
  "alix, tu connais maintenant plein de syllabes. chantons ensemble pour battre le roi chuuut!": "story-hana-alix-tu-connais-maintenant-plein-de-syllabes-cha.wav",
  "nooon! toute cette musique... c'est... trop joli! bon d'accord, j'arrête de faire chuuut!": "story-king-nooon-toute-cette-musique-c-est-trop-joli-bon-d-.wav",
  "alix, tu es une vraie star de la lecture! les lumi stars sont fières de toi!": "story-hana-alix-tu-es-une-vraie-star-de-la-lecture-les-lumi.wav",
  "grrr! tu as libéré toutes les lettres! mais tu ne gagneras pas le grand concert!": "story-king-grrr-tu-as-libere-toutes-les-lettres.wav",
  "tu peux rejouer toutes les missions pour gagner encore plus d'étoiles!": "story-mochi-tu-peux-rejouer-toutes-les-missions.wav",
  "touche chaque voyelle pour écouter sa chanson. attention, o et u ensemble font le son ou : deux lettres, un seul son !": "mission-vowels.wav",
  "écoute bien. quelle voyelle faut-il coller ?": "mission-fusion-quiz.wav",
  "écoute bien, et touche la syllabe que tu entends.": "mission-listen-syllable.wav",
  "regarde la syllabe. touche les bulles pour les écouter, puis choisis celle qui chante la bonne syllabe.": "mission-see-sound.wav",
  "retourne deux cartes. trouve une syllabe et l'image qui commence par ce son !": "mission-memory.wav",
  "un démon a cassé le mot ! écoute le mot, et trouve la syllabe qui manque.": "mission-missing.wav",
  "écris le mot ! touche les syllabes dans le bon ordre.": "mission-build.wav",
  "lis le mot secret toute seule, syllabe par syllabe. puis touche la bonne image.": "mission-read-word.wav",
  "écoute le mot mystère, et trouve comment il s'écrit.": "mission-listen-word.wav",
  "un démon lézard a caché la lettre l dans le parc!": "story-mochi-un-demon-lezard-a-cache-la-lettre-l-dans-le-parc-a78351.wav",
  "la lettre l chante avec sa langue. avec a, elle fait la. avec i, elle fait lit!": "story-yuki-la-lettre-l-chante-avec-sa-langue-avec-a-elle-fait-la-a-2e72f2.wav",
  "lézardo est battu! la, lit, lot, lu, les, loup : tu connais la lettre l!": "story-hana-lezardo-est-battu-la-lit-lot-lu-les-loup-tu-connais-la-af9bd7.wav",
  "mmmm... ça sent bon au marché! mais maître moustache a volé la lettre m!": "story-momo-mmmm-ca-sent-bon-au-marche-mais-maitre-moustache-a-vole-0c128a.wav",
  "m fait comme quand c'est délicieux. avec a : ma!": "story-hana-m-fait-comme-quand-c-est-delicieux-avec-a-ma-47e620.wav",
  "miam! ma, mie, mot, mue, mes, mou : la lettre m est libérée!": "story-momo-miam-ma-mie-mot-mue-mes-mou-la-lettre-m-est-liberee-cec98f.wav",
  "rrrr! tu entends? c'est rakoro qui grogne près de la rivière!": "story-yuki-rrrr-tu-entends-c-est-rakoro-qui-grogne-pres-de-la-rivi-1475fc.wav",
  "r roule dans la gorge. avec a, ça fait rat!": "story-mochi-r-roule-dans-la-gorge-avec-a-ca-fait-rat-df8e1c.wav",
  "rakoro s'est enfui! rat, riz, rot, rue, ré, roue : super!": "story-yuki-rakoro-s-est-enfui-rat-riz-rot-rue-re-roue-super-31cfa3.wav",
  "ssss... serpentine le serpent siffle dans notre studio!": "story-hana-ssss-serpentine-le-serpent-siffle-dans-notre-studio-a962b1.wav",
  "s siffle comme un serpent. avec a : sa!": "story-momo-s-siffle-comme-un-serpent-avec-a-sa-306c4a.wav",
  "serpentine ne siffle plus! sa, si, seau, su, ses, sou : bravo!": "story-hana-serpentine-ne-siffle-plus-sa-si-seau-su-ses-sou-bravo-8c010f.wav",
  "un pirate-poulpe a volé la lettre p dans son bateau!": "story-mochi-un-pirate-poulpe-a-vole-la-lettre-p-dans-son-bateau-56d1ac.wav",
  "p fait un petit bruit qui éclate comme une bulle. avec a : pas!": "story-yuki-p-fait-un-petit-bruit-qui-eclate-comme-une-bulle-avec-a-9773dc.wav",
  "plouf! pirata poulpe tombe à l'eau! pas, pie, pot, pu, pé, pou!": "story-momo-plouf-pirata-poulpe-tombe-a-l-eau-pas-pie-pot-pu-pe-pou-35b257.wav",
  "tornado toto fait tourner la tour de la télé!": "story-hana-tornado-toto-fait-tourner-la-tour-de-la-tele-265a08.wav",
  "t tape comme un tambour. avec a : ta!": "story-mochi-t-tape-comme-un-tambour-avec-a-ta-55f489.wav",
  "la tornade s'arrête! ta, ti, tôt, tu, thé, tout : génial!": "story-yuki-la-tornade-s-arrete-ta-ti-tot-tu-the-tout-genial-2a47f4.wav",
  "un ninja se cache dans les nuages! il a volé la lettre n!": "story-momo-un-ninja-se-cache-dans-les-nuages-il-a-vole-la-lettre-n-392ba6.wav",
  "n chante dans le nez. avec a : na!": "story-yuki-n-chante-dans-le-nez-avec-a-na-f033c4.wav",
  "le ninja est démasqué! na, nid, nos, nu, né, nous!": "story-hana-le-ninja-est-demasque-na-nid-nos-nu-ne-nous-fccfa0.wav",
  "dragonito crache du feu sur les diamants!": "story-mochi-dragonito-crache-du-feu-sur-les-diamants-5fd957.wav",
  "d tape avec la langue derrière les dents. avec a : da!": "story-hana-d-tape-avec-la-langue-derriere-les-dents-avec-a-da-bf5110.wav",
  "dragonito fait dodo! da, dit, dos, du, dé, doux : bien joué!": "story-momo-dragonito-fait-dodo-da-dit-dos-du-de-doux-bien-joue-2a9dc3.wav",
  "baba boubou enferme la musique dans des bulles!": "story-yuki-baba-boubou-enferme-la-musique-dans-des-bulles-58cc91.wav",
  "b fait avec les lèvres qui se collent. avec a : bas! comme b-a bas!": "story-mochi-b-fait-avec-les-levres-qui-se-collent-avec-a-bas-comme-11b201.wav",
  "les bulles éclatent! bas, bi, beau, bu, bé, bout : tu es une championne!": "story-hana-les-bulles-eclatent-bas-bi-beau-bu-be-bout-tu-es-une-ch-cbc790.wav",
  "fifi fantôme fait peur aux fées de la forêt!": "story-momo-fifi-fantome-fait-peur-aux-fees-de-la-foret-648abc.wav",
  "f souffle comme le vent. avec a : fa!": "story-yuki-f-souffle-comme-le-vent-avec-a-fa-abbfbb.wav",
  "pfiou! fifi s'envole! fa, fi, faux, fut, fée, fou!": "story-yuki-pfiou-fifi-s-envole-fa-fi-faux-fut-fee-fou-2564ec.wav",
  "vampirou s'est installé dans le volcan violet!": "story-hana-vampirou-s-est-installe-dans-le-volcan-violet-b9ae43.wav",
  "v vibre comme une abeille. avec a : va!": "story-mochi-v-vibre-comme-une-abeille-avec-a-va-df8ed7.wav",
  "vampirou va se coucher! va, vie, veau, vu, vé, vous : bravo!": "story-momo-vampirou-va-se-coucher-va-vie-veau-vu-ve-vous-bravo-d22161.wav",
  "attention : c et h ensemble chantent, comme pour dire chut!": "story-yuki-attention-c-et-h-ensemble-chantent-comme-pour-dire-chut-67551a.wav",
  "deux lettres, un seul son! avec a : chat, comme chat!": "story-momo-deux-lettres-un-seul-son-avec-a-chat-comme-chat-161ba4.wav",
  "chachat noir ronronne maintenant! chat, chi, chaud, chu, chez, chou!": "story-hana-chachat-noir-ronronne-maintenant-chat-chi-chaud-chu-che-6dca04.wav",
  "jojo le jongleur a volé tous les jouets de la jungle!": "story-mochi-jojo-le-jongleur-a-vole-tous-les-jouets-de-la-jungle-54058f.wav",
  "j fait comme un moteur doux. avec a : ja!": "story-hana-j-fait-comme-un-moteur-doux-avec-a-ja-2595e1.wav",
  "les jouets sont sauvés! ja, j'y, jo, jus, j'ai, joue!": "story-yuki-les-jouets-sont-sauves-ja-j-y-jo-jus-j-ai-joue-8ab385.wav",
  "attention, c'est la grotte aux pièges! c et g sont des lettres farceuses!": "story-yuki-attention-c-est-la-grotte-aux-pieges-c-et-g-sont-des-le-2681b9.wav",
  "devant a, oh, u et où, c chante comme dans cadeau, et g chante comme dans gâteau. cas, co, cu, cou... gars, go, goût!": "story-hana-devant-a-oh-u-et-ou-c-chante-comme-dans-cadeau-et-g-cha-1591c2.wav",
  "mais devant i et e, ils changent de voix! alors ici, on reste avec a, oh, u et où.": "story-momo-mais-devant-i-et-e-ils-changent-de-voix-alors-ici-on-re-2c0da6.wav",
  "capitaine gorgo est vaincu! tu as déjoué les pièges!": "story-mochi-capitaine-gorgo-est-vaincu-tu-as-dejoue-les-pieges-8ba05e.wav",
  "zéro": "math-number-00-zero.wav",
  "un": "math-number-01-un.wav",
  "deux": "math-number-02-deux.wav",
  "trois": "math-number-03-trois.wav",
  "quatre": "math-number-04-quatre.wav",
  "cinq": "math-number-05-cinq.wav",
  "six": "math-number-06-six.wav",
  "sept": "math-number-07-sept.wav",
  "huit": "math-number-08-huit.wav",
  "neuf": "math-number-09-neuf.wav",
  "dix": "math-number-10-dix.wav",
  "onze": "math-number-11-onze.wav",
  "douze": "math-number-12-douze.wav",
  "treize": "math-number-13-treize.wav",
  "quatorze": "math-number-14-quatorze.wav",
  "quinze": "math-number-15-quinze.wav",
  "seize": "math-number-16-seize.wav",
  "dix-sept": "math-number-17-dix-sept.wav",
  "dix-huit": "math-number-18-dix-huit.wav",
  "dix-neuf": "math-number-19-dix-neuf.wav",
  "vingt": "math-number-20-vingt.wav",
  "plus": "math-op-plus.wav",
  "moins": "math-op-moins.wav",
  "font combien ?": "math-prompt-result.wav",
  "quel nombre manque ?": "math-prompt-missing.wav",
  "plus combien font": "math-prompt-plus-missing.wav",
  "moins combien font": "math-prompt-minus-missing.wav",
  "calculs-éclairs": "math-title-calculs-eclairs.wav",
  "le nombre mystère": "math-title-nombre-mystere.wav",
  "petites histoires de calcul": "math-title-histoires.wav",
  "luna gagne": "math-story-luna-gagne.wav",
  "étoiles, puis": "math-story-etoiles-puis.wav",
  "étoiles. combien en gagne-t-elle en tout ?": "math-story-addition-end.wav",
  "mia a": "math-story-mia-a.wav",
  "étoiles. elle en offre": "math-story-mia-offre.wav",
  "étoiles. combien lui en reste-t-il ?": "math-story-subtraction-end.wav",
  "hana a": "math-story-hana-a.wav",
  "étoiles. combien lui en manque-t-il pour en avoir dix ?": "math-story-complement-end.wav",
  "parfait !": "math-praise-perfect.wav",
  "trois étoiles !": "math-praise-three-stars.wav",
  "deux étoiles !": "math-praise-two-stars.wav",
  "mission réussie !": "math-praise-complete.wav",
  "tu peux rejouer pour gagner plus d'étoiles.": "math-praise-replay.wav",

};

function normalizeLine(text: string) {
  return text
    .trim()
    .normalize("NFC")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function prerecordedLine(text: string) {
  const file = RECORDED_LINES[normalizeLine(text)];
  return file ? audioFiles[`../assets/voice/${file}`] : undefined;
}

let voices: SpeechSynthesisVoice[] = [];
let preferredURI: string | null = null;
let rate = 0.85;
let listeners: (() => void)[] = [];

const synth: SpeechSynthesis | null =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

function loadVoices() {
  if (!synth) return;
  voices = synth
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("fr"));
  listeners.forEach((l) => {
    l();
  });
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export const speechSupported = () => !!synth || Object.keys(audioFiles).length > 0;
export const getFrenchVoices = () => voices;
export const onVoicesChanged = (fn: () => void) => {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
};

export function configureSpeech(opts: {
  voiceURI?: string | null;
  rate?: number;
}) {
  if (opts.voiceURI !== undefined) preferredURI = opts.voiceURI;
  if (opts.rate !== undefined) rate = opts.rate;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (v.lang === "fr-FR") s += 10;
    if (/google/i.test(v.name)) s += 5;
    if (/(amélie|amelie|audrey|marie|denise|hortense|julie|céline|celine)/i.test(v.name))
      s += 7;
    if (/(thomas|paul|male)/i.test(v.name)) s -= 8;
    if (/natural|online|premium|enhanced/i.test(v.name)) s += 6;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

let speakToken = 0;
let seqToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let stopActiveAudio: (() => void) | null = null;

/** Parle (interrompt toute séquence en cours). */
export function speak(
  text: string,
  opts: { rate?: number; pitch?: number } = {},
) {
  seqToken++;
  return rawSpeak(text, opts);
}

/** Parle et résout quand c'est fini (ou après un délai de sécurité). */
function rawSpeak(
  text: string,
  opts: { rate?: number; pitch?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    if (!text) return resolve();
    const token = ++speakToken;
    stopActiveAudio?.();
    synth?.cancel();
    let done = false;
    let audio: HTMLAudioElement | null = null;
    let stopAudio: (() => void) | null = null;
    let audioFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackStarted = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
      if (activeAudio === audio) activeAudio = null;
      if (stopActiveAudio === stopAudio) stopActiveAudio = null;
      resolve();
    };
    const fallbackToSynthesis = () => {
      if (done || fallbackStarted) return;
      fallbackStarted = true;
      if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (activeAudio === audio) activeAudio = null;
      if (stopActiveAudio === stopAudio) stopActiveAudio = null;
      if (!synth || token !== speakToken) return finish();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = opts.rate ?? rate;
      u.pitch = opts.pitch ?? 1.1;
      u.onend = finish;
      u.onerror = finish;
      setTimeout(finish, 1200 + text.length * 110);
      // petit délai : évite un bug de Chrome quand cancel() et speak() s'enchaînent
      setTimeout(() => {
        if (token === speakToken) synth.speak(u);
        else finish();
      }, 60);
    };

    const src = prerecordedLine(text);
    if (src && typeof Audio !== "undefined") {
      audio = new Audio(src);
      activeAudio = audio;
      stopAudio = () => {
        audio?.pause();
        if (audio) audio.currentTime = 0;
        finish();
      };
      stopActiveAudio = stopAudio;
      audio.onended = finish;
      audio.onerror = fallbackToSynthesis;
      // Laisse finir les répliques longues avant d'utiliser la synthèse de secours.
      audioFallbackTimer = setTimeout(fallbackToSynthesis, 30000);
      audio.play().catch(fallbackToSynthesis);
    } else {
      fallbackToSynthesis();
    }
  });
}

/** Dit plusieurs textes à la suite, avec une petite pause (annulable). */
export async function speakSeq(texts: string[], pause = 250) {
  const my = ++seqToken;
  for (const t of texts) {
    if (my !== seqToken) return;
    await rawSpeak(t);
    await new Promise((r) => setTimeout(r, pause));
  }
}

export function stopSpeech() {
  seqToken++;
  speakToken++;
  stopActiveAudio?.();
  synth?.cancel();
}
