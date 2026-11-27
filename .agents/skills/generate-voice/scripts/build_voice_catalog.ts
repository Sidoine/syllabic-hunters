import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { RECORDED_LINES, RECORDED_TTS_OVERRIDES } from "../../../../src/data/recordedVoiceLines.ts";
import { WORLD_INTRO_LINES } from "../../../../src/data/story.ts";

type Speaker = "king" | "demon" | "mochi" | "yuki" | "hero";
type ChapterLine = { who: Speaker; text: string; audio_files?: Record<string, string> };
type VoiceJob = {
	name: string;
	text: string;
	speaker: string;
	file: string;
	prompt_hash: string;
	lookup_text?: string;
	seed?: number;
	tone?: string;
	tts_text?: string;
	voice_text?: string;
	tone_text?: string;
	clone_profile?: string;
	[key: string]: unknown;
};
type RuntimeVoice = { phrase: string; character: string; file: string; prompt_hash: string; available: boolean };

const scriptDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const skillManifestPath = resolve(scriptDir, "voices.json");
const runtimeManifestPath = resolve(repoRoot, "src/data/voices.json");
const profiles = JSON.parse(await readFile(resolve(scriptDir, "voice_profiles.json"), "utf8")) as Record<string, {
	reference_file: string; reference_text: string; voice_text: string; tone_text?: string; seed?: number;
}>;
const normalize = (text: string) => text.trim().normalize("NFC").replace(/[’]/g, "'").replace(/\s+/g, " ").toLowerCase();
const slug = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "voice";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
const sha256File = async (file: string) => createHash("sha256").update(await readFile(resolve(scriptDir, file))).digest("hex");

const [oldJobs, readingChapters, mathChapters] = await Promise.all([
	readFile(skillManifestPath, "utf8").then((text) => JSON.parse(text) as VoiceJob[]),
	readFile(resolve(repoRoot, "src/data/reading-chapters.json"), "utf8").then((text) => JSON.parse(text) as Array<{ intro?: ChapterLine[]; outro?: ChapterLine[] }>),
	readFile(resolve(repoRoot, "src/data/math-chapters.json"), "utf8").then((text) => JSON.parse(text) as Array<{ intro?: ChapterLine[]; outro?: ChapterLine[] }>),
]);
const oldByName = new Map(oldJobs.map((job) => [job.name, job]));
const jobs = new Map<string, VoiceJob>();
const runtimeVoices = new Map<string, RuntimeVoice>();
const knownChapterLines = new Map<string, ChapterLine>();
const chapterLines = [
	...readingChapters.flatMap((chapter) => [...(chapter.intro ?? []), ...(chapter.outro ?? [])]),
	...mathChapters.flatMap((chapter) => [...(chapter.intro ?? []), ...(chapter.outro ?? [])]),
];
const dialogueLines = [...WORLD_INTRO_LINES.map((line) => ({ who: line.who as Speaker, text: line.text })), ...chapterLines];
for (const line of dialogueLines) knownChapterLines.set(normalize(line.text), line);

function cloneProfileFor(speaker: string, name: string, voiceText?: string) {
	if (speaker === "hero_male") return "hero-masculine";
	if (speaker === "hero_female") return "hero-feminine";
	if (["king", "mochi", "yuki", "demon", "narrator"].includes(speaker)) return speaker;
	if (name.startsWith("story-king-") || name.startsWith("king-")) return "king";
	if (name.startsWith("story-yuki-") || name.startsWith("math-")) return "yuki";
	if (name.startsWith("image-") || name.startsWith("syllable-") || name.startsWith("vowel-") || name.startsWith("letter-")) return "mochi";
	if (/^(story-mochi-|mochi-|mission-|battle-|cheer-|try-)/.test(name) || ["read-praise", "playful-rate"].includes(name)) return "mochi";
	const voice = (voiceText ?? "").toLowerCase();
	if (voice.includes("petite créature")) return "mochi";
	return profiles[speaker] ? speaker : "default";
}

async function addVoice(name: string, text: string, character: string, options: Partial<VoiceJob> = {}, includeRuntime = true) {
	const prior = oldByName.get(name) ?? oldByName.get(name.replace(/-(masculine|feminine)$/, ""));
	const speaker = options.speaker ?? character;
	const cloneProfile = options.clone_profile ?? cloneProfileFor(speaker, name, options.voice_text ?? prior?.voice_text);
	const profile = profiles[cloneProfile] ?? profiles.default;
	const ttsText = options.tts_text ?? prior?.tts_text ?? text;
	const seed = options.seed ?? prior?.seed ?? profile.seed ?? 3;
	const prompt = {
		model: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
		text: ttsText,
		language: "French",
		clone_profile: cloneProfile,
		reference_text: profile.reference_text,
		reference_audio_sha256: await sha256File(profile.reference_file),
		seed,
		temperature: 0.35,
		top_p: 0.8,
		top_k: 20,
	};
	const promptHash = hash(prompt);
	const file = `${name}-${promptHash}.wav`;
	const job: VoiceJob = {
		...prior,
		...options,
		name,
		text,
		tts_text: ttsText !== text ? ttsText : undefined,
		speaker,
		clone_profile: cloneProfile,
		seed,
		file,
		prompt_hash: promptHash,
	};
	jobs.set(name, job);
	const runtimeKey = `${character}|${normalize(text)}`;
	const legacyAudio = resolve(repoRoot, "assets/final/voice", `${name}.wav`);
	const currentAudio = resolve(repoRoot, "assets/final/voice", file);
	const oldPromptText = prior?.tts_text ?? prior?.text ?? "";
	const priorTextMatches = oldPromptText.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_match, male: string, female: string) => name.endsWith("-masculine") ? male : name.endsWith("-feminine") ? female : male) === ttsText;
	const priorProfile = prior?.speaker === "hero"
		? name.endsWith("-masculine") ? "hero-masculine" : name.endsWith("-feminine") ? "hero-feminine" : "hero"
		: prior ? cloneProfileFor(prior.speaker, prior.name, prior.voice_text) : undefined;
	if (prior && priorTextMatches && prior.seed === seed && priorProfile === cloneProfile) {
		try {
			await access(currentAudio);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			try {
				await mkdir(resolve(repoRoot, "assets/final/voice"), { recursive: true });
				await copyFile(legacyAudio, currentAudio);
			} catch (copyError) {
				if ((copyError as NodeJS.ErrnoException).code !== "ENOENT") throw copyError;
			}
		}
	}
	let available = false;
	try { await access(currentAudio); available = true; } catch { /* Audio à générer. */ }
	if (includeRuntime) runtimeVoices.set(runtimeKey, { phrase: text, character, file, prompt_hash: promptHash, available });
	return file;
}

for (const line of dialogueLines) {
	const includeRuntime = !chapterLines.includes(line);
	const mappedName = RECORDED_LINES[normalize(line.text)]?.replace(/\.wav$/i, "");
	const mappedJob = mappedName ? oldByName.get(mappedName) : undefined;
	const base = mappedJob?.source === "dialogue" && mappedJob.speaker === line.who
		? mappedName!
		: `dialogue-${line.who}-${slug(line.text)}`;
	const audioFiles: Record<string, string> = {};
	if (line.who === "hero") {
		for (const [character, profile] of [["hero_male", "hero-masculine"], ["hero_female", "hero-feminine"]] as const) {
			const resolvedText = line.text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_match, male: string, female: string) => character === "hero_male" ? male : female);
			const name = `${base}-${character === "hero_male" ? "masculine" : "feminine"}`;
			audioFiles[character] = await addVoice(name, resolvedText, character, {
				speaker: character,
				clone_profile: profile,
				lookup_text: line.text,
				tone: "calm",
				source: "dialogue",
			}, includeRuntime);
		}
	} else {
		audioFiles[line.who] = await addVoice(base, line.text, line.who, {
			speaker: line.who,
			lookup_text: line.text,
			tts_text: line.text.replace(/Roi Chuuut/g, "Roi Chute").replace(/^Chuuut/g, "Chute"),
			tone: "calm",
			source: "dialogue",
		}, includeRuntime);
	}
	if (chapterLines.includes(line)) (line as ChapterLine).audio_files = audioFiles;
}

for (const [lookupText, filename] of Object.entries(RECORDED_LINES)) {
	const key = normalize(lookupText);
	const sourceLine = knownChapterLines.get(key);
	const legacyName = filename.replace(/\.wav$/i, "");
	if (sourceLine) continue;
	const old = oldByName.get(legacyName);
	let character = old?.speaker;
	if (!character) {
		if (/^(story-yuki-|math-)/.test(legacyName)) character = "yuki";
		else if (/^(image-|syllable-|vowel-|letter-|story-mochi-|mochi-|mission-|battle-|cheer-|try-)/.test(legacyName) || ["read-praise", "playful-rate"].includes(legacyName)) character = "mochi";
		else character = "default";
	}
	const ttsText = RECORDED_TTS_OVERRIDES[filename];
	await addVoice(legacyName, lookupText, character, {
		speaker: character,
		lookup_text: lookupText,
		...(ttsText ? { tts_text: ttsText } : {}),
		...(old?.tone ? { tone: old.tone } : {}),
		source: "recorded-line",
	});
}

for (const phrase of ["Hana", "Luna", "Mia", "Milo", "Zélane", "Mochi", "Yuki", "Roi Chuuut"]) {
	const name = `character-name-${slug(phrase)}`;
	await addVoice(name, phrase, "mochi", {
		speaker: "mochi",
		...(phrase === "Roi Chuuut" ? { tts_text: "Roi Chute" } : {}),
		tone: "calm",
		source: "character-name",
	});
}

const readingText = `${JSON.stringify(readingChapters, null, 2)}\n`;
const mathText = `${JSON.stringify(mathChapters, null, 2)}\n`;
const result = [...jobs.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
const runtimeResult = [...runtimeVoices.values()].sort((a, b) => a.phrase.localeCompare(b.phrase, "fr") || a.character.localeCompare(b.character, "en"));
await Promise.all([
	writeFile(skillManifestPath, `${JSON.stringify(result, null, 2)}\n`, "utf8"),
	writeFile(runtimeManifestPath, `${JSON.stringify(runtimeResult, null, 2)}\n`, "utf8"),
	writeFile(resolve(repoRoot, "src/data/reading-chapters.json"), readingText, "utf8"),
	writeFile(resolve(repoRoot, "src/data/math-chapters.json"), mathText, "utf8"),
]);
	console.log(`Generated ${result.length} hashed voice jobs, ${runtimeResult.length} runtime sound entries, and added audio_files to ${chapterLines.length} reading/math dialogue lines.`);
