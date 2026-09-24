import { useMemo, useRef, useState } from "react";
import { CHAPTERS } from "../../data/story";
import { sayOf } from "../../data/syllables";
import { cleanPart, type Word } from "../../data/words";
import { speak } from "../../lib/speech";
import { sfx } from "../../lib/sfx";
import { cycle, sample, shuffle } from "../../lib/utils";
import { FeedbackLayer, IMAGES, MissionFrame, useFeedback } from "../ui";
import { confusables, isVowel, poolOf, soundWords, type MissionProps } from "./helpers";

// ======================= Cartes jumelles =======================
interface MemCard {
  id: string;
  kind: "syl" | "img";
  key: string;
  word?: Word;
}

export function MemoryMission({ mission, onDone }: MissionProps) {
  const cards = useMemo(() => {
    const pickWord = (s: string): Word | undefined => {
      const ws = soundWords(s, true);
      const written = ws.filter((w) => cleanPart(w.parts[0]).startsWith(s) || isVowel(s));
      return sample(written.length ? written : ws, 1)[0];
    };
    const wanted = mission.targets.length > 8 ? 6 : Math.min(6, Math.max(4, mission.targets.length));
    const pairs: { s: string; w: Word }[] = [];
    for (const s of shuffle(mission.targets)) {
      const w = pickWord(s);
      if (w && pairs.length < wanted) pairs.push({ s, w });
    }
    for (const s of shuffle(mission.review)) {
      if (pairs.length >= 4) break;
      const w = pickWord(s);
      if (w && !pairs.some((p) => p.s === s)) pairs.push({ s, w });
    }
    return shuffle(
      pairs.flatMap((p) => [
        { id: "s" + p.s, kind: "syl" as const, key: p.s },
        { id: "i" + p.s, kind: "img" as const, key: p.s, word: p.w },
      ])
    );
  }, [mission]);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const busy = useRef(false);
  const fb = useFeedback();
  const pairsCount = cards.length / 2;

  const flip = async (c: MemCard) => {
    if (busy.current || open.includes(c.id) || matched.includes(c.key)) return;
    sfx.flip();
    const no = [...open, c.id];
    setOpen(no);
    speak(c.kind === "syl" ? sayOf(c.key) : c.word!.say);
    if (no.length === 2) {
      busy.current = true;
      const [a, b] = no.map((id) => cards.find((x) => x.id === id)!);
      await new Promise((r) => setTimeout(r, 1100));
      if (a.key === b.key && a.kind !== b.kind) {
        const nm = [...matched, a.key];
        setMatched(nm);
        await fb.good(false);
        if (nm.length === pairsCount) {
          busy.current = false;
          setOpen([]);
          onDone(Math.max(0, misses - pairsCount), pairsCount);
          return;
        }
      } else {
        setMisses((m) => m + 1);
        sfx.bad();
      }
      setOpen([]);
      busy.current = false;
    }
  };

  return (
    <MissionFrame
      instruction="Retourne deux cartes : une syllabe et l'image qui commence par ce son !"
      speakText="Retourne deux cartes. Trouve une syllabe et l'image qui commence par ce son !"
      round={matched.length}
      total={pairsCount}
      readKey="memory"
    >
      <FeedbackLayer fb={fb} />
      <div className={`grid gap-3 ${cards.length > 8 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4"}`}>
        {cards.map((c) => {
          const visible = open.includes(c.id) || matched.includes(c.key);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(c)}
              className={`btn-pop w-24 h-28 sm:w-28 sm:h-32 rounded-3xl border-4 flex items-center justify-center transition-all duration-300 ${
                visible
                  ? `card-kawaii ${matched.includes(c.key) ? "!bg-lime-100 !border-lime-400" : ""}`
                  : "bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 border-white/80 shadow-[0_6px_0_#3b1a66]"
              }`}
              style={{ transform: visible ? "rotateY(0deg)" : "rotateY(180deg)" }}
            >
              {visible ? (
                c.kind === "syl" ? (
                  <span className="font-read font-bold text-5xl" style={{ transform: "rotateY(0)" }}>
                    {c.key}
                  </span>
                ) : (
                  <span className="text-6xl">{c.word!.emoji}</span>
                )
              ) : (
                <span className="text-4xl" style={{ transform: "rotateY(180deg)" }}>
                  ⭐
                </span>
              )}
            </button>
          );
        })}
      </div>
    </MissionFrame>
  );
}

// ======================= Combat de démons =======================
export function BattleMission({ mission, onDone }: MissionProps) {
  const chapter = CHAPTERS[mission.chapter];
  const isFinal = mission.chapter === CHAPTERS.length - 1;
  const HP = isFinal ? 10 : 8;
  const waves = useMemo(() => {
    const pool = poolOf(mission);
    const n = isVowel(mission.targets[0]) ? 3 : 3;
    return cycle(mission.targets, HP + 4).map((t) => ({ t, demons: shuffle([t, ...confusables(t, pool, n)]) }));
  }, [mission, HP]);
  const [wi, setWi] = useState(0);
  const [hp, setHp] = useState(HP);
  const [errors, setErrors] = useState(0);
  const [poofed, setPoofed] = useState<string | null>(null);
  const [laugh, setLaugh] = useState<string | null>(null);
  const [bossHit, setBossHit] = useState(0);
  const busy = useRef(false);
  const fb = useFeedback();
  const w = waves[wi % waves.length];

  const hit = async (s: string) => {
    if (busy.current) return;
    if (s === w.t) {
      busy.current = true;
      setPoofed(s);
      sfx.hit();
      setBossHit((b) => b + 1);
      const nhp = hp - 1;
      setHp(nhp);
      await fb.good(false);
      await new Promise((r) => setTimeout(r, 500));
      if (nhp <= 0) {
        onDone(errors, HP);
        return;
      }
      setPoofed(null);
      setWi(wi + 1);
      busy.current = false;
    } else {
      setErrors((e) => e + 1);
      setLaugh(s);
      sfx.bad();
      setTimeout(() => setLaugh(null), 700);
      await speak("Hihihi ! Raté !", { pitch: 1.6 });
      speak(sayOf(w.t));
    }
  };

  const hue = chapter.hue;
  const positions = ["left-[4%] top-[10%]", "right-[4%] top-[6%]", "left-[18%] bottom-[4%]", "right-[16%] bottom-[8%]"];

  return (
    <MissionFrame
      instruction={<>Écoute et touche le démon qui porte la bonne syllabe ! 🔊</>}
      speakText={["Touche le démon", sayOf(w.t)]}
      round={HP - hp}
      total={HP}
      readKey={wi}
    >
      <FeedbackLayer fb={fb} />
      {/* Boss */}
      <div className="flex items-center gap-3 w-full max-w-xl">
        <div key={bossHit} className={`relative ${bossHit ? "anim-shake" : ""}`}>
          <img
            src={isFinal ? IMAGES.king : IMAGES.demon}
            alt=""
            className="w-24 h-24 object-contain anim-float"
            style={isFinal ? {} : { filter: `hue-rotate(${hue}deg) saturate(1.3)` }}
          />
          <span className="absolute -top-2 -right-2 text-4xl">{chapter.bossEmoji}</span>
        </div>
        <div className="flex-1">
          <div className="font-bold text-lg neon-text">{chapter.boss}</div>
          <div className="h-6 rounded-full bg-black/40 border-2 border-white overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 transition-all duration-500"
              style={{ width: `${(hp / HP) * 100}%` }}
            />
          </div>
          <div className="text-sm text-white/80 mt-1">
            {"💜".repeat(hp)}
            <span className="opacity-30">{"🖤".repeat(HP - hp)}</span>
          </div>
        </div>
      </div>

      {/* Arène */}
      <div className="relative w-full max-w-xl h-80 sm:h-96 mt-3 rounded-[2rem] glass overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/20 to-transparent" />
        <button
          type="button"
          onClick={() => speak(sayOf(w.t))}
          className="btn-pop absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-b from-yellow-200 to-amber-400 border-4 border-white text-5xl shadow-[0_6px_0_#b77a0c] z-10 anim-glow"
        >
          🔊
        </button>
        {w.demons.map((s, i) => (
          <button
            key={wi + s}
            type="button"
            onClick={() => hit(s)}
            className={`absolute ${positions[i]} ${poofed === s ? "anim-poof" : "anim-drift"}`}
            style={{ animationDelay: poofed === s ? "0s" : `${i * 0.7}s` }}
          >
            <div className={`relative ${laugh === s ? "anim-wobble" : ""}`}>
              <img src={IMAGES.demon} alt="" className="w-28 h-28 sm:w-32 sm:h-32 object-contain" style={{ filter: `hue-rotate(${(hue + i * 70) % 360}deg)` }} />
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-3 card-kawaii rounded-2xl px-3 font-read font-bold text-4xl whitespace-nowrap">
                {s}
              </span>
              {laugh === s && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl font-bold text-yellow-200">hihi !</span>}
            </div>
          </button>
        ))}
      </div>
    </MissionFrame>
  );
}
