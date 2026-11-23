import { useMemo, useState } from "react";
import { recordedVoiceCatalog } from "../lib/speech";

const STORAGE_KEY = "voice-review-english-accent-v1";

type VoiceReport = { accent: boolean; other: boolean; note: string };
type VoiceReports = Record<string, VoiceReport>;

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
  const reportCount = Object.values(reports).filter((report) => report.accent || report.other).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return recordedVoiceCatalog.filter((voice) => {
      const report = reports[voice.file];
      if (flaggedOnly && !report?.accent && !report?.other) return false;
      return !needle || `${voice.file} ${voice.text} ${voice.context}`.toLocaleLowerCase("fr").includes(needle);
    });
  }, [reports, flaggedOnly, query]);

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
      .filter((voice) => reports[voice.file]?.accent || reports[voice.file]?.other)
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
            <p className="mt-2 max-w-2xl text-sm text-purple-100/75">Écoute chaque son et coche ceux où tu entends un accent anglais. Les coches sont gardées sur cet appareil.</p>
          </div>
          <button type="button" onClick={exportFlags} disabled={!reportCount} className="rounded-xl bg-fuchsia-600 px-4 py-2 font-semibold hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40">Exporter les sons signalés ({reportCount})</button>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un texte, un contexte ou un fichier…" className="min-w-64 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-white outline-none placeholder:text-purple-100/40 focus:border-fuchsia-400" />
          <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} /> Signalés seulement</label>
          <span className="text-sm text-purple-100/60">{filtered.length} / {recordedVoiceCatalog.length} sons</span>
        </div>

        <section className="space-y-3">
          {filtered.map((voice) => {
            const report = reports[voice.file] ?? { accent: false, other: false, note: "" };
            const flagged = report.accent || report.other;
            return <article key={voice.file} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center ${flagged ? "border-rose-300/70 bg-rose-500/10" : "border-white/10 bg-white/5"}`}>
              {/* biome-ignore lint/a11y/useMediaCaption: The exact spoken text is rendered alongside each short voice clip. */}
              <audio controls preload="none" src={voice.url} className="h-10 w-full sm:w-56" />
              <div className="min-w-0">
                <p className="font-semibold">{voice.text}</p>
                <p className="mt-1 text-sm text-purple-100/70">{voice.context}{!voice.linked && <span className="ml-2 text-amber-200">· texte issu de l’inventaire audio</span>}</p>
                <p className="mt-1 truncate font-mono text-xs text-purple-100/40" title={voice.file}>{voice.file}</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-start">
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1 text-sm font-semibold hover:bg-white/10">
                  <input type="checkbox" checked={report.accent} onChange={(event) => updateReport(voice.file, { accent: event.target.checked })} /> Accent anglais
                </label>
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1 text-sm font-semibold hover:bg-white/10">
                  <input type="checkbox" checked={report.other} onChange={(event) => updateReport(voice.file, { other: event.target.checked })} /> Autre souci
                </label>
                {report.other && <textarea value={report.note} onChange={(event) => updateReport(voice.file, { note: event.target.value })} placeholder="Décris le souci (ex. mot incompréhensible au début)…" rows={2} className="w-full min-w-56 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white outline-none placeholder:text-purple-100/40 focus:border-fuchsia-400 sm:w-64" />}
              </div>
            </article>;
          })}
          {!filtered.length && <p className="rounded-2xl bg-white/5 p-8 text-center text-purple-100/70">Aucun son ne correspond à cette recherche.</p>}
        </section>
      </div>
    </main>
  );
}
