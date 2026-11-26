// Synthèse vocale française avec choix de voix et fallback.
import generatedVoices from "../../.agents/skills/generate-voice/voices.json";
import { assetUrl } from "./assets";

export type RecordedVoice = {
  file: string;
  url: string;
  text: string;
  context: string;
  linked: boolean;
  speaker?: string;
  available: boolean;
};

export const SPEECH_FALLBACK_EVENT = "game:speech-fallback";
export type SpeechFallbackNotice = { text: string; reason: string; file?: string };

function reportSpeechFallback(notice: SpeechFallbackNotice, error?: unknown) {
	const details = { ...notice, error };
	console.error("[voix] Repli vers la synthèse vocale du navigateur", details);
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent<SpeechFallbackNotice>(SPEECH_FALLBACK_EVENT, { detail: notice }));
	}
}

const GENDER_VARIANT_RE = /\[([^\]|]+)\|([^\]]+)\]/g;
const resolveGenderVariant = (text: string, masculine: boolean) =>
	text.replace(GENDER_VARIANT_RE, (_match, male: string, female: string) => masculine ? male : female);
const generatedText = new Map<string, string>();
const generatedSpeaker = new Map<string, string>();
const textByFile = new Map<string, string>();
for (const voice of generatedVoices) {
	const speaker = "speaker" in voice && typeof voice.speaker === "string" ? voice.speaker : undefined;
	if (GENDER_VARIANT_RE.test(voice.text)) {
		GENDER_VARIANT_RE.lastIndex = 0;
		const maleFile = `${voice.name}-masculine.wav`;
		const femaleFile = `${voice.name}-feminine.wav`;
		generatedText.set(maleFile, resolveGenderVariant(voice.text, true));
		generatedText.set(femaleFile, resolveGenderVariant(voice.text, false));
		if (speaker) {
			generatedSpeaker.set(maleFile, speaker === "hero" ? "hero-masculine" : speaker);
			generatedSpeaker.set(femaleFile, speaker === "hero" ? "hero-feminine" : speaker);
		}
		if ("lookup_text" in voice && typeof voice.lookup_text === "string") {
			textByFile.set(maleFile, resolveGenderVariant(voice.text, true));
			textByFile.set(femaleFile, resolveGenderVariant(voice.text, false));
		}
	} else {
		generatedText.set(`${voice.name}.wav`, voice.text);
		if (speaker) generatedSpeaker.set(`${voice.name}.wav`, speaker);
		if ("lookup_text" in voice && typeof voice.lookup_text === "string") textByFile.set(`${voice.name}.wav`, voice.lookup_text);
	}
}
const recordedLines = new Map<string, string>();
for (const voice of generatedVoices) {
	if ("lookup_text" in voice && typeof voice.lookup_text === "string" && !GENDER_VARIANT_RE.test(voice.text)) {
		recordedLines.set(voice.lookup_text.trim().normalize("NFC").replace(/[’]/g, "'").replace(/\s+/g, " ").toLowerCase(), `${voice.name}.wav`);
	}
	GENDER_VARIANT_RE.lastIndex = 0;
}

function voiceContext(file: string) {
  const speaker = generatedSpeaker.get(file);
  if (speaker?.startsWith("hero-")) return "Dialogue du héros sélectionné";
  if (speaker && ["king", "mochi", "yuki"].includes(speaker)) return `Dialogue · ${speaker}`;
  if (file.startsWith("hero-")) return "Réplique du héros choisi";
  if (file.startsWith("story-")) {
    const character = file.split("-")[1];
    return `Scène d’introduction ou de victoire · ${speaker ?? character}`;
  }
  if (file.startsWith("mission-")) return `Instruction d’un exercice de lecture${speaker ? ` · ${speaker}` : ""}`;
  if (file.startsWith("battle-")) return `Instruction de Combat de démons${speaker ? ` · ${speaker}` : ""}`;
  if (file.startsWith("math-")) return `Carte des batailles · exercice de mathématiques${speaker ? ` · ${speaker}` : ""}`;
  if (file.startsWith("cheer-") || file.startsWith("try-") || file === "playful-rate.wav")
    return "Retour pendant un exercice";
  if (file === "read-praise.wav") return "Félicitations après une lecture";
  return "Autre son préenregistré";
}

export const recordedVoiceCatalog: RecordedVoice[] = generatedVoices.flatMap((voice) => {
  const variants = GENDER_VARIANT_RE.test(voice.text);
  GENDER_VARIANT_RE.lastIndex = 0;
  const files = variants
    ? [
        { file: `${voice.name}-masculine.wav`, text: resolveGenderVariant(voice.text, true), speaker: voice.speaker === "hero" ? "hero-masculine" : voice.speaker },
        { file: `${voice.name}-feminine.wav`, text: resolveGenderVariant(voice.text, false), speaker: voice.speaker === "hero" ? "hero-feminine" : voice.speaker },
      ]
    : [{ file: `${voice.name}.wav`, text: voice.text, speaker: voice.speaker }];
  return files.map(({ file, text, speaker }) => {
    const url = assetUrl(`final/voice/${file}`);
    return { file, url, text: text ?? textByFile.get(file) ?? file, context: voiceContext(file), linked: true, speaker, available: true };
  });
}).sort((a, b) => a.context.localeCompare(b.context, "fr") || a.file.localeCompare(b.file, "fr"));

function normalizeLine(text: string) {
  return text
    .trim()
    .normalize("NFC")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const generatedGenderFiles = new Map<string, { masculine: string; feminine: string }>();
for (const voice of generatedVoices) {
	if (!GENDER_VARIANT_RE.test(voice.text)) continue;
	GENDER_VARIANT_RE.lastIndex = 0;
	generatedGenderFiles.set(normalizeLine(resolveGenderVariant(voice.text, true)), {
		masculine: `${voice.name}-masculine.wav`,
		feminine: `${voice.name}-feminine.wav`,
	});
	generatedGenderFiles.set(normalizeLine(resolveGenderVariant(voice.text, false)), {
		masculine: `${voice.name}-masculine.wav`,
		feminine: `${voice.name}-feminine.wav`,
	});
}

function prerecordedLine(text: string, masculine: boolean) {
	const key = normalizeLine(text);
	const genderFiles = generatedGenderFiles.get(key);
	const variantFile = genderFiles?.[masculine ? "masculine" : "feminine"];
	if (genderFiles) return variantFile ? assetUrl(`final/voice/${variantFile}`) : undefined;
	const file = recordedLines.get(key);
	return file ? assetUrl(`final/voice/${file}`) : undefined;
}

let voices: SpeechSynthesisVoice[] = [];
let preferredURI: string | null = null;
let rate = 0.85;
let masculineVoice = false;
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

export const speechSupported = () => !!synth || generatedVoices.length > 0;
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
  masculine?: boolean;
}) {
  if (opts.voiceURI !== undefined) preferredURI = opts.voiceURI;
  if (opts.rate !== undefined) rate = opts.rate;
  if (opts.masculine !== undefined) masculineVoice = opts.masculine;
}

function pickVoice(masculine = masculineVoice): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredURI && !masculine) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (v.lang === "fr-FR") s += 10;
    if (/google/i.test(v.name)) s += 5;
    if (masculine) {
      if (/(thomas|paul|male|homme|antoine|hervé|herve|nicolas|henri)/i.test(v.name)) s += 10;
      if (/(amélie|amelie|audrey|marie|denise|hortense|julie|céline|celine)/i.test(v.name)) s -= 8;
    } else {
      if (/(amélie|amelie|audrey|marie|denise|hortense|julie|céline|celine)/i.test(v.name)) s += 7;
      if (/(thomas|paul|male|homme)/i.test(v.name)) s -= 8;
    }
    if (/natural|online|premium|enhanced/i.test(v.name)) s += 6;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

let speakToken = 0;
let seqToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let stopActiveAudio: (() => void) | null = null;

export type SpeechOptions = { rate?: number; pitch?: number; masculine?: boolean; recordedText?: string };

/** Parle (interrompt toute séquence en cours). */
export function speak(
  text: string,
  opts: SpeechOptions = {},
) {
  seqToken++;
  return rawSpeak(text, opts);
}

/** Parle et résout quand c'est fini (ou après un délai de sécurité). */
function rawSpeak(
  text: string,
  opts: SpeechOptions = {},
): Promise<void> {
  return new Promise((resolve) => {
    if (!text) return resolve();
    const token = ++speakToken;
    const speakMasculine = opts.masculine ?? masculineVoice;
    stopActiveAudio?.();
    synth?.cancel();
    let done = false;
    let audio: HTMLAudioElement | null = null;
    let stopAudio: (() => void) | null = null;
    let audioFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackStarted = false;
    const lookupText = opts.recordedText ?? text;
    const src = prerecordedLine(lookupText, speakMasculine);
    const finish = () => {
      if (done) return;
      done = true;
      if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
      if (activeAudio === audio) activeAudio = null;
      if (stopActiveAudio === stopAudio) stopActiveAudio = null;
      resolve();
    };
    const fallbackToSynthesis = (reason: string, error?: unknown) => {
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

      const file = src?.split("/").pop();
      reportSpeechFallback({ text, reason, file }, error);

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      const v = pickVoice(speakMasculine);
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
      audio.onerror = () => fallbackToSynthesis(
        "Le fichier audio généré n’a pas pu être chargé ou décodé.",
        { mediaErrorCode: audio?.error?.code, networkState: audio?.networkState, readyState: audio?.readyState, src: audio?.currentSrc || src },
      );
      // Laisse finir les répliques longues avant d'utiliser la synthèse de secours.
      audioFallbackTimer = setTimeout(() => fallbackToSynthesis(
        "Le fichier audio généré ne s’est pas terminé dans les 30 secondes.",
        { src },
      ), 30000);
      audio.play().catch((error: unknown) => fallbackToSynthesis(
        "Le navigateur a refusé de lire le fichier audio généré.",
        error,
      ));
    } else {
      fallbackToSynthesis(src
        ? "L’API Audio est indisponible dans ce navigateur."
        : "Aucun fichier audio généré ne correspond exactement au texte.");
    }
  });
}

/** Dit plusieurs textes à la suite, avec une petite pause (annulable). */
export async function speakSeq(texts: string[], pause = 250, opts: SpeechOptions = {}) {
  const my = ++seqToken;
  for (const t of texts) {
    if (my !== seqToken) return;
    await rawSpeak(t, opts);
    await new Promise((r) => setTimeout(r, pause));
  }
}

export function stopSpeech() {
  seqToken++;
  speakToken++;
  stopActiveAudio?.();
  synth?.cancel();
}
