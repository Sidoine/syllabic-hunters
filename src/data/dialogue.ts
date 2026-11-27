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
}

export function dialogue(
	who: DialogueCharacter,
	texts: string | string[],
): DialogueLine[] {
	return (Array.isArray(texts) ? texts : [texts]).map((text) => ({ who, text }));
}
