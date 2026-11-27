import sourceVoices from "../data/voices.json";
import readingChapters from "../data/reading-chapters.json";
import mathChapters from "../data/math-chapters.json";
import { assetUrl } from "./assets";

type Character = string;
type VoiceSource = { phrase: string; character: Character; file: string; prompt_hash: string; available: boolean };
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

const voices = sourceVoices as VoiceSource[];
const chapterLines = [
	...(readingChapters as Array<{ intro?: Array<{ who: string; text: string; audio_files?: Record<string, string> }>; outro?: Array<{ who: string; text: string; audio_files?: Record<string, string> }> }>).flatMap((chapter) => [...(chapter.intro ?? []), ...(chapter.outro ?? [])]),
	...(mathChapters as Array<{ intro?: Array<{ who: string; text: string; audio_files?: Record<string, string> }>; outro?: Array<{ who: string; text: string; audio_files?: Record<string, string> }> }>).flatMap((chapter) => [...(chapter.intro ?? []), ...(chapter.outro ?? [])]),
];
const chapterVoices: VoiceSource[] = chapterLines.flatMap((line) => Object.entries(line.audio_files ?? {}).map(([character, file]) => ({
	phrase: line.text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_match, male: string, female: string) => character === "hero_male" ? male : female),
	character,
	file,
	prompt_hash: file.match(/-([0-9a-f]{12})\.wav$/)?.[1] ?? "",
	available: true,
})));
const allVoices = [...voices, ...chapterVoices];
const voiceByFile = new Map(allVoices.map((voice) => [voice.file, voice]));
const normalizeLine = (text: string) => text.trim().normalize("NFC").replace(/[’]/g, "'").replace(/\s+/g, " ").toLowerCase();
const generatedByText = new Map<string, VoiceSource[]>();
for (const voice of allVoices) {
	const key = normalizeLine(voice.phrase);
	const entries = generatedByText.get(key) ?? [];
	entries.push(voice);
	generatedByText.set(key, entries);
}

function voiceContext(voice: VoiceSource) {
	if (voice.character.startsWith("hero_")) return "Dialogue du héros sélectionné";
	if (["demon", "king", "mochi", "yuki"].includes(voice.character)) return `Dialogue · ${voice.character}`;
	if (voice.file.startsWith("story-") || voice.file.startsWith("dialogue-")) return `Scène · ${voice.character}`;
	if (voice.file.startsWith("mission-") || voice.file.startsWith("battle-")) return `Consigne · ${voice.character}`;
	if (voice.file.startsWith("math-")) return `Mathématiques · ${voice.character}`;
	if (voice.file.startsWith("cheer-") || voice.file.startsWith("try-") || voice.file === "playful-rate.wav") return "Retour pendant un exercice";
	if (voice.file === "read-praise.wav") return "Félicitations après une lecture";
	return `Son enregistré · ${voice.character}`;
}

export const recordedVoiceCatalog: RecordedVoice[] = voices.map((voice) => ({
	file: voice.file,
	url: assetUrl(`final/voice/${voice.file}`),
	text: voice.phrase,
	context: voiceContext(voice),
	linked: true,
	speaker: voice.character,
	available: voice.available,
})).sort((a, b) => a.context.localeCompare(b.context, "fr") || a.file.localeCompare(b.file, "fr"));

export const speechSupported = () => voices.length > 0;
export const getFrenchVoices = () => [] as SpeechSynthesisVoice[];
export const onVoicesChanged = (_fn: () => void) => () => {};

let masculineVoice = false;
export function configureSpeech(opts: { voiceURI?: string | null; rate?: number; masculine?: boolean }) {
	if (opts.masculine !== undefined) masculineVoice = opts.masculine;
}

export type SpeechOptions = {
	masculine?: boolean;
	recordedText?: string;
	character?: Character;
	file?: string;
	rate?: number;
	pitch?: number;
};
export type SpokenLine = { text: string; character?: Character; file?: string };

let sequenceId = 0;
let currentAudio: HTMLAudioElement | null = null;

function sourceFor(text: string, opts: SpeechOptions) {
	if (opts.file) return voiceByFile.has(opts.file) ? assetUrl(`final/voice/${opts.file}`) : undefined;
	const entries = generatedByText.get(normalizeLine(opts.recordedText ?? text));
	if (!entries?.length) return undefined;
	const preferredCharacter = opts.character ?? (opts.masculine ?? masculineVoice ? "hero_male" : undefined);
	const preferred = preferredCharacter && entries.find((voice) => voice.character === preferredCharacter);
	const heroVariant = entries.find((voice) => voice.character === ((opts.masculine ?? masculineVoice) ? "hero_male" : "hero_female"));
	return assetUrl(`final/voice/${(preferred ?? heroVariant ?? entries[0]).file}`);
}

function reportMissing(text: string, reason: string, src?: string) {
	const file = src?.split("/").pop();
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent<SpeechFallbackNotice>(SPEECH_FALLBACK_EVENT, { detail: { text, reason, file } }));
	}
}

function rawSpeak(text: string, opts: SpeechOptions = {}) {
	return new Promise<void>((resolve) => {
		currentAudio?.pause();
		if (currentAudio) currentAudio.currentTime = 0;
		currentAudio = null;
		if (!text) return resolve();
		const src = sourceFor(text, opts);
		if (!src || typeof Audio === "undefined") {
			reportMissing(text, src ? "La lecture audio est indisponible dans ce navigateur." : "Aucun enregistrement de voices.json ne correspond à cette phrase.", src);
			return resolve();
		}
		const audio = new Audio(src);
		currentAudio = audio;
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			if (currentAudio === audio) currentAudio = null;
			resolve();
		};
		audio.onended = finish;
		audio.onerror = () => {
			reportMissing(text, "Le fichier audio enregistré n’a pas pu être chargé.", src);
			finish();
		};
		audio.play().catch(() => {
			reportMissing(text, "Le navigateur a refusé de lire le fichier audio enregistré.", src);
			finish();
		});
	});
}

export function speak(text: string, opts: SpeechOptions = {}) {
	sequenceId++;
	return rawSpeak(text, opts);
}

export async function speakSeq(lines: Array<string | SpokenLine>, pause = 250, opts: SpeechOptions = {}) {
	const currentSequence = ++sequenceId;
	for (const item of lines) {
		if (currentSequence !== sequenceId) return;
		const line = typeof item === "string" ? { text: item } : item;
		await rawSpeak(line.text, { ...opts, character: line.character ?? opts.character, file: line.file ?? opts.file });
		if (currentSequence !== sequenceId) return;
		await new Promise((resolve) => setTimeout(resolve, pause));
	}
}

export function stopSpeech() {
	sequenceId++;
	currentAudio?.pause();
	if (currentAudio) currentAudio.currentTime = 0;
	currentAudio = null;
}
