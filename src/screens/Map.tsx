import { CHAPTERS, MISSIONS, type Chapter, type Mission } from "../data/story";
import { BigButton, IMAGES, Stars } from "../components/ui";
import type { Save } from "../lib/storage";
import { syllablesOf, VOWELS } from "../data/syllables";

export function isMissionUnlocked(save: Save, m: Mission) {
  if (save.settings.unlockAll) return true;
  const idx = MISSIONS.findIndex((x) => x.id === m.id);
  return idx === 0 || (save.stars[MISSIONS[idx - 1].id] ?? 0) > 0;
}

export const chapterMissions = (ch: number) => MISSIONS.filter((m) => m.chapter === ch);

export function chapterStars(save: Save, ch: number) {
  const ms = chapterMissions(ch);
  return { got: ms.reduce((a, m) => a + (save.stars[m.id] ?? 0), 0), max: ms.length * 3, done: ms.every((m) => (save.stars[m.id] ?? 0) > 0) };
}

export function MapScreen({ save, onChapter, onBack, onSettings }: { save: Save; onChapter: (ch: number) => void; onBack: () => void; onSettings: () => void }) {
  const total = MISSIONS.reduce((a, m) => a + (save.stars[m.id] ?? 0), 0);
  const doneCount = MISSIONS.filter((m) => (save.stars[m.id] ?? 0) > 0).length;
  return (
    <div className="min-h-full px-3 py-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-2 mb-4 sticky top-0 z-20 py-2 bg-[#1f0c48]/80 backdrop-blur rounded-b-3xl px-3">
        <button type="button" onClick={onBack} className="btn-pop glass rounded-full w-12 h-12 text-2xl">
          🏠
        </button>
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold neon-text">Carte des concerts</div>
          <div className="text-sm text-pink-100">
            {save.name ? `${save.name} · ` : ""}⭐ {total} · 🎤 {doneCount}/{MISSIONS.length} missions
          </div>
        </div>
        <button type="button" onClick={onSettings} className="btn-pop glass rounded-full w-12 h-12 text-2xl">
          ⚙️
        </button>
      </header>

      <div className="relative flex flex-col items-center gap-2 pb-10">
        {CHAPTERS.map((c, i) => {
          const unlocked = isMissionUnlocked(save, chapterMissions(c.id)[0]);
          const st = chapterStars(save, c.id);
          const offset = [0, 28, 44, 28, 0, -28, -44, -28][i % 8];
          return (
            <div key={c.id} className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
              {i > 0 && <div className="w-1 h-6 border-l-4 border-dotted border-white/40" />}
              <ChapterNode chapter={c} unlocked={unlocked} stars={st} onClick={() => unlocked && onChapter(c.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterNode({ chapter, unlocked, stars, onClick }: { chapter: Chapter; unlocked: boolean; stars: { got: number; max: number; done: boolean }; onClick: () => void }) {
  const isFinal = chapter.id === CHAPTERS.length - 1;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!unlocked}
      className={`btn-pop flex items-center gap-3 rounded-full pr-5 pl-2 py-2 border-4 w-[17rem] sm:w-80 text-left ${
        unlocked ? "border-white shadow-[0_6px_0_rgba(0,0,0,0.3)]" : "border-white/20 opacity-50 grayscale"
      } ${unlocked && !stars.done ? "anim-glow" : ""}`}
      style={{ background: unlocked ? `linear-gradient(135deg, ${chapter.color}, #6b2bd9)` : "#3a2a5a" }}
    >
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center font-read font-bold text-3xl text-purple-800 shrink-0 relative">
        {unlocked ? (isFinal ? "👑" : chapter.label) : "🔒"}
        {stars.done && <span className="absolute -top-2 -right-2 text-xl">🏆</span>}
      </div>
      <div className="flex-1">
        <div className="font-bold text-lg leading-tight">{chapter.title}</div>
        <div className="text-xs text-white/80">{chapter.place}</div>
        <div className="text-sm">
          ⭐ {stars.got}/{stars.max}
        </div>
      </div>
      {unlocked && <img src={IMAGES.demon} alt="" className="w-10 h-10 object-contain" style={{ filter: `hue-rotate(${chapter.hue}deg)`, opacity: stars.done ? 0.25 : 1 }} />}
    </button>
  );
}

export function ChapterScreen({
  save,
  chapter,
  onMission,
  onBack,
  onStory,
}: {
  save: Save;
  chapter: Chapter;
  onMission: (m: Mission) => void;
  onBack: () => void;
  onStory: () => void;
}) {
  const ms = chapterMissions(chapter.id);
  const syl = chapter.letters.length ? chapter.letters.flatMap(syllablesOf) : chapter.id === 0 ? VOWELS.map((v) => v.id) : [];
  return (
    <div className="min-h-full px-3 py-4 max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn-pop glass rounded-full w-12 h-12 text-2xl shrink-0">
          ◀
        </button>
        <div className="flex-1">
          <div className="text-2xl sm:text-3xl font-bold neon-text">{chapter.title}</div>
          <div className="text-pink-100">{chapter.place}</div>
        </div>
        <button type="button" onClick={onStory} className="btn-pop glass rounded-full px-3 h-12 text-sm font-bold">
          📖 Histoire
        </button>
      </header>

      {syl.length > 0 && (
        <div className="glass rounded-3xl p-3 flex flex-wrap gap-2 justify-center">
          {syl.map((s) => (
            <span key={s} className="card-kawaii rounded-2xl px-3 py-1 font-read font-bold text-3xl">
              {s}
            </span>
          ))}
        </div>
      )}
      {chapter.tip && (
        <div className="rounded-3xl p-3 bg-yellow-200 text-purple-900 font-semibold border-4 border-white">💡 {chapter.tip}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ms.map((m, i) => {
          const unlocked = isMissionUnlocked(save, m);
          const stars = save.stars[m.id] ?? 0;
          const isBoss = m.type === "battle";
          return (
            <button
              key={m.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onMission(m)}
              className={`btn-pop flex items-center gap-3 rounded-3xl p-3 border-4 text-left ${
                unlocked ? (isBoss ? "bg-gradient-to-r from-rose-500 to-purple-700 border-yellow-200" : "bg-white/15 border-white/60") : "bg-white/5 border-white/10 opacity-50"
              } ${unlocked && !stars ? "anim-glow" : ""}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shrink-0">{unlocked ? m.icon : "🔒"}</div>
              <div className="flex-1">
                <div className="text-xs text-white/70">Mission {i + 1}</div>
                <div className="font-bold text-lg leading-tight">{isBoss ? `${m.title} : ${chapter.boss}` : m.title}</div>
                <Stars n={stars} size="text-lg" />
              </div>
            </button>
          );
        })}
      </div>
      <BigButton color="purple" onClick={onBack} className="self-center mt-2">
        Retour à la carte 🗺️
      </BigButton>
    </div>
  );
}
