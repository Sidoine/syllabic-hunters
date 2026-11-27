export type DialogueCharacter = "king" | "demon" | "mochi" | "yuki" | "hero";

/** Runtime actors use a gendered hero key; authored dialogue keeps the generic `hero`. */
export type SceneSpeaker =
	| Exclude<DialogueCharacter, "hero">
	| "hero_male"
	| "hero_female";

export const heroSceneSpeaker = (masculine: boolean): SceneSpeaker =>
	masculine ? "hero_male" : "hero_female";

export interface DialogueLine {
	who: DialogueCharacter;
	text: string;
	audio_files?: Partial<Record<"hero_male" | "hero_female" | Exclude<DialogueCharacter, "hero">, string>>;
}

export function dialogueAudioFile(line: DialogueLine, masculine: boolean) {
	const character = line.who === "hero" ? (masculine ? "hero_male" : "hero_female") : line.who;
	return line.audio_files?.[character];
}

export function dialogue(
	who: DialogueCharacter,
	texts: string | string[],
): DialogueLine[] {
	return (Array.isArray(texts) ? texts : [texts]).map((text) => ({ who, text }));
}
