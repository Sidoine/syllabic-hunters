import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHAPTERS } from "../../../../src/data/reading.ts";
import { MATH_CHAPTERS } from "../../../../src/data/math.ts";
import { WORLD_INTRO_LINES } from "../../../../src/data/story.ts";
import { RECORDED_LINES, RECORDED_TTS_OVERRIDES } from "../../../../src/data/recordedVoiceLines.ts";

type VoiceJob = {
	name: string;
	text: string;
	speaker: string;
	lookup_text?: string;
	seed?: number;
	tone?: string;
	voice_text?: string;
	voice_texts?: Record<string, string>;
	tone_text?: string;
	[key: string]: unknown;
};

const scriptDir = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = `${scriptDir}/voices.json`;
const normalize = (text: string) => text.trim().normalize("NFC").replace(/[’]/g, "'").replace(/\s+/g, " ").toLowerCase();
const slug = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const oldJobs = JSON.parse(await readFile(manifestPath, "utf8")) as VoiceJob[];
const oldByName = new Map(oldJobs.map((job) => [job.name, job]));
const jobs = new Map<string, VoiceJob>();
const lineByText = new Map<string, { speaker: string; text: string }>();
const dialogueLines = [
	...WORLD_INTRO_LINES,
	...CHAPTERS.flatMap((chapter) => [...chapter.intro, ...chapter.outro]),
	...MATH_CHAPTERS.flatMap((chapter) => [...chapter.intro, ...chapter.outro]),
];
for (const line of dialogueLines) lineByText.set(normalize(line.text), line);

const speakerFromFilename = (name: string, text: string) => {
	const oldSpeaker = oldByName.get(name)?.speaker;
	if (["king", "mochi", "yuki", "narrator", "default"].includes(oldSpeaker ?? "")) return oldSpeaker!;
	if (name.startsWith("story-king-") || name.startsWith("king-")) return "king";
	if (name.startsWith("story-yuki-") || name.startsWith("math-")) return "yuki";
	if (name.startsWith("story-mochi-") || name.startsWith("mochi-") || name.startsWith("mission-") || name.startsWith("battle-") || name.startsWith("cheer-") || name.startsWith("try-") || name === "read-praise" || name === "playful-rate") return "mochi";
	return oldSpeaker ?? "default";
};

for (const [lookupText, filename] of Object.entries(RECORDED_LINES)) {
	const name = filename.replace(/\.wav$/i, "");
	const sourceLine = lineByText.get(normalize(lookupText));
	// Keep pre-recorded scene lines only when they still exactly match a current dialogue.
	if (name.startsWith("story-") && !sourceLine) continue;
	const old = oldByName.get(name);
	const speaker = sourceLine?.speaker ?? speakerFromFilename(name, lookupText);
	const ttsText = RECORDED_TTS_OVERRIDES[filename];
	jobs.set(name, {
		...old,
		name,
		text: lookupText,
		tts_text: ttsText,
		speaker,
		lookup_text: lookupText,
		source: sourceLine ? "dialogue" : "recorded-line",
	});
}

for (const line of dialogueLines) {
	const lookupText = normalize(line.text);
	const mappedName = RECORDED_LINES[lookupText];
	const name = mappedName?.replace(/\.wav$/i, "") ?? `dialogue-${line.who}-${slug(line.text)}`;
	const prior = jobs.get(name) ?? oldByName.get(name);
	const text = line.who === "hero" ? `[${line.text}|${line.text}]` : line.text;
	const ttsText = line.text.replace(/Roi Chuuut/g, "Roi Chute").replace(/^Chuuut/g, "Chute");
	jobs.set(name, {
		...prior,
		name,
		text,
		...(ttsText !== line.text ? { tts_text: ttsText } : {}),
		speaker: line.who,
		lookup_text: line.text,
		seed: prior?.seed ?? 2,
		tone: prior?.tone ?? "calm",
		source: "dialogue",
	});
}

const result = [...jobs.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
await writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Generated ${result.length} voice jobs from ${dialogueLines.length} source dialogue lines and ${Object.keys(RECORDED_LINES).length} recorded-line mappings.`);
