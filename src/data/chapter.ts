import type { DialogueLine, SceneSpeaker } from "./dialogue";

export type Speaker = SceneSpeaker;
export type Line = DialogueLine;

export interface ChapterStage {
	camera: { orbit: number; distance: number };
	actors: Record<string, { x: number; z: number; rotation?: number }>;
}

export interface Chapter {
	id: number;
	title: string;
	label: string;
	color: string;
	boss: string;
	hue: number;
	tip?: string;
	intro: Line[];
	outro: Line[];
	introVideo?: string;
	victoryVideo?: string;
	stage?: ChapterStage;
}
