export interface Settings {
	voiceURI: string | null;
	rate: number;
	autoRead: boolean;
	sfx: boolean;
	unlockAll: boolean;
}

export type HeroId = "hana" | "yuki" | "momo" | "milo" | "zelane";

export interface Save {
	name: string;
	hero: HeroId;
	heroChosen: boolean;
	stars: Record<string, number>; // missionId -> meilleures étoiles (1-3)
	rewards?: Record<string, boolean>; // rewardId -> activité terminée
	rewardPages?: Record<string, string>; // rewardId -> coloriage unique attribué
	rewardDrawings?: Record<string, string>; // rewardId -> traits sauvegardés en data URL
	seenIntro: Record<number, boolean>;
	seenOutro: Record<number, boolean>;
	settings: Settings;
}

const KEY = "baba-hunters-save-v1";

export const defaultSave = (): Save => ({
	name: "",
	hero: "hana",
	heroChosen: false,
	stars: {},
	rewards: {},
	rewardPages: {},
	rewardDrawings: {},
	seenIntro: {},
	seenOutro: {},
	settings: {
		voiceURI: null,
		rate: 0.85,
		autoRead: true,
		sfx: true,
		unlockAll: false,
	},
});

export function loadSave(): Save {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return defaultSave();
		const d = JSON.parse(raw);
		const base = defaultSave();
		return {
			...base,
			...d,
			// Saves created before the explicit confirmation flow already passed
			// through the character picker, so preserve that choice.
			heroChosen: d.heroChosen ?? true,
			rewards: { ...base.rewards, ...(d.rewards || {}) },
			rewardPages: { ...base.rewardPages, ...(d.rewardPages || {}) },
			rewardDrawings: { ...base.rewardDrawings, ...(d.rewardDrawings || {}) },
			settings: { ...base.settings, ...(d.settings || {}) },
		};
	} catch {
		return defaultSave();
	}
}

export function writeSave(s: Save) {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		/* stockage indisponible */
	}
}

export function clearSave() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		/* */
	}
}
