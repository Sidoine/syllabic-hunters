export interface Settings {
  voiceURI: string | null;
  rate: number;
  autoRead: boolean;
  sfx: boolean;
  unlockAll: boolean;
}

export interface Save {
  name: string;
  hero: "hana" | "yuki" | "momo";
  stars: Record<string, number>; // missionId -> meilleures étoiles (1-3)
  seenIntro: Record<number, boolean>;
  seenOutro: Record<number, boolean>;
  settings: Settings;
}

const KEY = "baba-hunters-save-v1";

export const defaultSave = (): Save => ({
  name: "",
  hero: "hana",
  stars: {},
  seenIntro: {},
  seenOutro: {},
  settings: { voiceURI: null, rate: 0.85, autoRead: true, sfx: true, unlockAll: false },
});

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const base = defaultSave();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
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
