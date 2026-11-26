import { useMemo, useState } from "react";
import { recordedVoiceCatalog } from "../lib/speech";
import { assetUrl } from "../lib/assets";
import voiceProfiles from "../../.agents/skills/generate-voice/voice_profiles.json";

const STORAGE_KEY = "voice-review-english-accent-v1";

type VoiceReport = { accent: boolean; other: boolean; note: string };
type VoiceReports = Record<string, VoiceReport>;
type VoiceTabId = "narrator" | "heroine" | "hero" | "king" | "mochi" | "yuki";

const VOICE_TABS: { id: VoiceTabId; label: string }[] = [
  { id: "narrator", label: "Narrateur" },
  { id: "heroine", label: "Héroïne" },
  { id: "hero", label: "Héros" },
  { id: "king", label: "Roi Chuuut" },
  { id: "mochi", label: "Mochi" },
  { id: "yuki", label: "Yuki" },
];
const PROFILE_BY_TAB: Record<VoiceTabId, keyof typeof voiceProfiles> = {
  narrator: "narrator",
  heroine: "hero-feminine",
  hero: "hero-masculine",
  king: "king",
  mochi: "mochi",
  yuki: "yuki",
};
const referenceAudioByName = Object.fromEntries(Object.values(voiceProfiles).map((profile) => {
	const file = profile.reference_file.split("/").pop() ?? "";
	return [file, assetUrl(`input/references/voice/${file}`)];
}));

function captionTrackUrl(text: string) {
	const cue = text.trim().replace(/-->/g, "→").replace(/\n/g, " ");
	return `data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00:00.000 --> 00:00:20.000\n${cue}\n`)}`;
}

function voiceTabFor(file: string, speaker?: string): VoiceTabId {
  const name = file.toLocaleLowerCase("fr");
  const startsWithAny = (...prefixes: string[]) => prefixes.some((prefix) => name.startsWith(prefix));
  if (speaker === "hero-feminine") return "heroine";
  if (speaker === "hero-masculine") return "hero";
  if (speaker === "king" || speaker === "mochi" || speaker === "yuki") return speaker;
  if (speaker === "narrator" || speaker === "default") return "narrator";
  if (startsWithAny("story-king-", "king-")) return "king";
  if (name.endsWith("-feminine.wav") || startsWithAny("hero-feminine-", "hero-female-")) return "heroine";
  if (
    startsWithAny("story-mochi-", "mochi-", "mission-", "cheer-", "try-", "battle-")
    || name === "playful-rate.wav"
    || name === "read-praise.wav"
  ) return "mochi";
  if (startsWithAny("story-yuki-", "math-")) return "yuki";
  if (name.endsWith("-masculine.wav") || startsWithAny("hero-masculine-", "hero-male-", "hero-")) return "hero";
  return "narrator";
}

function readReports(): VoiceReports {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(value)) {
      return Object.fromEntries(value.filter((item): item is string => typeof item === "string")
        .map((file) => [file, { accent: true, other: false, note: "" }]));
    }
    if (value && typeof value === "object") return value as VoiceReports;
    return {};
  } catch {
    return {};
  }
}

export function VoiceReview() {
  const [reports, setReports] = useState<VoiceReports>(readReports);
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<VoiceTabId>("narrator");
  const reportCount = Object.values(reports).filter((report) => report.accent || report.other).length;
  const referenceProfile = voiceProfiles[PROFILE_BY_TAB[activeTab]];
  const referenceFile = referenceProfile.reference_file.split("/").pop() ?? "";
  const referenceAudioUrl = referenceAudioByName[referenceFile];
  const voiceCounts = useMemo(() => Object.fromEntries(
    VOICE_TABS.map(({ id }) => [id, recordedVoiceCatalog.filter((voice) => voiceTabFor(voice.file, voice.speaker) === id).length]),
  ) as Record<VoiceTabId, number>, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return recordedVoiceCatalog.filter((voice) => voiceTabFor(voice.file, voice.speaker) === activeTab).filter((voice) => {
      const report = reports[voice.file];
      if (flaggedOnly && !report?.accent && !report?.other) return false;
      return !needle || `${voice.file} ${voice.text} ${voice.context}`.toLocaleLowerCase("fr").includes(needle);
    });
  }, [activeTab, reports, flaggedOnly, query]);
  const missingCount = filtered.filter((voice) => !voice.available).length;

  const updateReport = (file: string, update: Partial<VoiceReport>) => {
    setReports((current) => {
	  const existing = current[file];
	  const next = { ...current, [file]: { accent: existing?.accent ?? false, other: existing?.other ?? false, note: existing?.note ?? "", ...update } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const exportFlags = () => {
    const report = recordedVoiceCatalog
      .filter((voice) => voice.available && (reports[voice.file]?.accent || reports[voice.file]?.other))
      .map(({ file, text, context, linked }) => {
        const entry = reports[file];
        return { file, text, context, linked, issues: [entry.accent && "accent anglais", entry.other && "autre souci"].filter(Boolean), note: entry.note };
      });
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "voix-a-corriger.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#160d31] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-fuchsia-300">Outil de vérification</p>
            <h1 className="mt-1 text-3xl font-bold">Revue des voix</h1>
            <p className="mt-2 max-w-2xl text-sm text-purple-100/75">Écoute le repère vocal de chaque onglet, puis les sons à vérifier. Les textes sans WAV indiquent ce qu’il reste à générer.</p>
          </div>
          <button type="button" onClick={exportFlags} disabled={!reportCount} className="rounded-xl bg-fuchsia-600 px-4 py-2 font-semibold hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40">Exporter les sons signalés ({reportCount})</button>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un texte, un contexte ou un fichier…" className="min-w-64 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-white outline-none placeholder:text-purple-100/40 focus:border-fuchsia-400" />
          <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} /> Signalés seulement</label>
          <span className="text-sm text-purple-100/60">{filtered.length} / {voiceCounts[activeTab]} textes · {missingCount} à générer</span>
        </div>

        <div role="tablist" aria-label="Voix à vérifier" className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
          {VOICE_TABS.map(({ id, label }) => <button
            key={id}
            type="button"
            role="tab"
            id={`voice-tab-${id}`}
            aria-controls="voice-review-panel"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === id ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/30" : "text-purple-100/70 hover:bg-white/10 hover:text-white"}`}
          >{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeTab === id ? "bg-white/20" : "bg-black/20"}`}>{voiceCounts[id]}</span></button>)}
        </div>

        <section id="voice-review-panel" role="tabpanel" aria-labelledby={`voice-tab-${activeTab}`} className="space-y-3">
          <article className="grid gap-3 rounded-2xl border border-cyan-200/25 bg-cyan-300/5 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
            {referenceAudioUrl
              ? <audio controls preload="none" src={referenceAudioUrl} className="h-10 w-full sm:w-56"><track kind="captions" srcLang="fr" label="Français" src={captionTrackUrl(referenceProfile.reference_text)} /></audio>
              : <p className="text-sm text-amber-200">Échantillon de référence manquant : {referenceFile}</p>}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-100/70">Voix de référence · clonage</p>
              <p className="mt-1 text-sm text-cyan-50">{referenceProfile.reference_text}</p>
              <p className="mt-1 truncate font-mono text-xs text-cyan-100/40">{referenceFile}</p>
            </div>
          </article>
          {filtered.map((voice) => {
            const report = reports[voice.file] ?? { accent: false, other: false, note: "" };
            const flagged = report.accent || report.other;
            return <article key={voice.file} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center ${flagged ? "border-rose-300/70 bg-rose-500/10" : "border-white/10 bg-white/5"}`}>
              {voice.available
                ? <audio controls preload="none" src={voice.url} className="h-10 w-full sm:w-56"><track kind="captions" srcLang="fr" label="Français" src={captionTrackUrl(voice.text)} /></audio>
                : <span className="rounded-lg border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-center text-xs font-bold uppercase text-amber-200">À générer</span>}
              <div className="min-w-0">
                <p className="font-semibold">{voice.text}</p>
                <p className="mt-1 text-sm text-purple-100/70">{voice.context}{!voice.linked && <span className="ml-2 text-amber-200">· texte issu de l’inventaire audio</span>}</p>
                <p className="mt-1 truncate font-mono text-xs text-purple-100/40" title={voice.file}>{voice.file}</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-start">
                <label className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1 text-sm font-semibold ${voice.available ? "cursor-pointer hover:bg-white/10" : "cursor-not-allowed opacity-40"}`}>
                  <input type="checkbox" disabled={!voice.available} checked={report.accent} onChange={(event) => updateReport(voice.file, { accent: event.target.checked })} /> Accent anglais
                </label>
                <label className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1 text-sm font-semibold ${voice.available ? "cursor-pointer hover:bg-white/10" : "cursor-not-allowed opacity-40"}`}>
                  <input type="checkbox" disabled={!voice.available} checked={report.other} onChange={(event) => updateReport(voice.file, { other: event.target.checked })} /> Autre souci
                </label>
                {voice.available && report.other && <textarea value={report.note} onChange={(event) => updateReport(voice.file, { note: event.target.value })} placeholder="Décris le souci (ex. mot incompréhensible au début)…" rows={2} className="w-full min-w-56 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white outline-none placeholder:text-purple-100/40 focus:border-fuchsia-400 sm:w-64" />}
              </div>
            </article>;
          })}
          {!filtered.length && <p className="rounded-2xl bg-white/5 p-8 text-center text-purple-100/70">{voiceCounts[activeTab] ? "Aucun son ne correspond à cette recherche." : "Aucun son enregistré pour cette voix pour le moment."}</p>}
        </section>
      </div>
    </main>
  );
}
