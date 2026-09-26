import { useMemo, useState } from "react";
import {
  sayOf,
  syllablesOf,
  VOWELS,
  type VowelId,
  vowelColor,
  vowelOf,
} from "../../data/syllables";
import { WORD_MAP } from "../../data/words";
import { sfx } from "../../lib/sfx";
import { speak, speakSeq } from "../../lib/speech";
import { cycle, shuffle } from "../../lib/utils";
import {
  BigButton,
  FeedbackLayer,
  MissionFrame,
  SyllableWord,
  SylTile,
  useFeedback,
} from "../ui";
import {
  confusables,
  consonantSpoken,
  isVowel,
  type MissionProps,
  poolOf,
} from "./helpers";

// ======================= Les voyelles =======================
export function VowelsMission({ onDone }: MissionProps) {
  const [seen, setSeen] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const fb = useFeedback();
  const tap = async (v: (typeof VOWELS)[number]) => {
    sfx.tap();
    setCurrent(v.id);
    if (!seen.includes(v.id)) setSeen((s) => [...s, v.id]);
    const w = WORD_MAP[v.example];
    await speakSeq([v.say, `${v.say}, comme ${w.say}`]);
  };
  const cur = VOWELS.find((v) => v.id === current);
  const w = cur ? WORD_MAP[cur.example] : null;
  const all = seen.length === VOWELS.length;
  return (
    <MissionFrame
      instruction={
        <>
          Touche chaque voyelle pour écouter sa chanson. <b>ou</b> : deux
          lettres, un seul son !
        </>
      }
      speakText="Touche chaque voyelle pour écouter sa chanson. Attention, o et u ensemble font le son ou : deux lettres, un seul son !"
      round={seen.length}
      total={VOWELS.length}
      readKey="vowels"
    >
      <FeedbackLayer fb={fb} />
      <div className="grid grid-cols-3 gap-4 my-4">
        {VOWELS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => tap(v)}
            className={`btn-pop relative w-24 h-24 sm:w-32 sm:h-32 rounded-full font-read font-bold text-6xl border-4 border-white shadow-xl ${
              current === v.id ? "anim-wobble scale-110" : ""
            }`}
            style={{
              background: `radial-gradient(circle at 30% 30%, #fff, ${v.color})`,
              color: "#3b1a66",
            }}
          >
            {v.id}
            {seen.includes(v.id) && (
              <span className="absolute -top-1 -right-1 text-2xl">⭐</span>
            )}
          </button>
        ))}
      </div>
      <div className="h-32 flex items-center">
        {cur && w && (
          <div
            key={cur.id}
            className="anim-pop card-kawaii rounded-3xl px-6 py-3 flex items-center gap-4"
          >
            <span className="text-6xl">{w.emoji}</span>
            <SyllableWord word={w} className="text-5xl" />
          </div>
        )}
      </div>
      {all && (
        <BigButton
          color="yellow"
          className="anim-glow"
          onClick={() => onDone(0, VOWELS.length)}
        >
          J'ai tout écouté ! ✨
        </BigButton>
      )}
    </MissionFrame>
  );
}

// ======================= Fusion magique =======================
export function FusionMission({ mission, onDone }: MissionProps) {
  const consonants = mission.consonants;
  const [ci, setCi] = useState(0);
  const cons = consonants[ci];
  const allSyl = mission.targets;
  const [found, setFound] = useState<string[]>([]);
  const [fusing, setFusing] = useState<string | null>(null);
  const [phase, setPhase] = useState<"learn" | "quiz">("learn");
  const quiz = useMemo(() => cycle(allSyl, 4), [allSyl]);
  const [qi, setQi] = useState(0);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const fb = useFeedback();

  const vowelsFor = (c: string) => syllablesOf(c).map((s) => vowelOf(s));

  const fuse = async (v: VowelId) => {
    const syl = cons + v;
    sfx.fuse();
    setFusing(syl);
    if (!found.includes(syl)) setFound((f) => [...f, syl]);
    await new Promise((r) => setTimeout(r, 550));
    await speak(sayOf(syl));
    await new Promise((r) => setTimeout(r, 1200));
    setFusing((current) => (current === syl ? null : current));
  };

  if (phase === "learn") {
    const allFound = allSyl.every((s) => found.includes(s));
    const v = fusing ? vowelOf(fusing) : null;
    return (
      <MissionFrame
        instruction={
          <>
            Touche une voyelle pour la coller à la lettre{" "}
            <b className="font-read text-2xl">{cons}</b> !
          </>
        }
        speakText={`Touche une voyelle pour la coller à la lettre ${consonantSpoken(cons)}, et écoute la syllabe magique !`}
        round={found.length}
        total={allSyl.length}
        readKey={`learn${cons}`}
      >
        {consonants.length > 1 && (
          <div className="flex gap-3 mb-2">
            {consonants.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCi(i);
                  setFusing(null);
                }}
                className={`btn-pop rounded-2xl px-5 py-2 font-read text-3xl font-bold border-4 ${i === ci ? "bg-pink-400 border-white" : "bg-white/10 border-white/30"}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-center gap-2 sm:gap-6 my-4 h-40">
          {fusing ? (
            <button
              key={fusing}
              type="button"
              onClick={() => speak(sayOf(fusing))}
              className="anim-pop card-kawaii rounded-[2rem] px-8 py-4 font-read font-bold text-8xl"
            >
              <span className="text-purple-800">{cons}</span>
              <span style={{ color: v ? vowelColor(v) : undefined }}>{v}</span>
            </button>
          ) : (
            <>
              <div className="card-kawaii rounded-[2rem] w-32 h-32 flex items-center justify-center font-read font-bold text-8xl text-purple-800 anim-float">
                {cons}
              </div>
              <span className="text-5xl">➕</span>
              <div className="rounded-[2rem] w-32 h-32 border-4 border-dashed border-white/60 flex items-center justify-center text-5xl">
                ❔
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {vowelsFor(cons).map((vv) => (
            <button
              key={vv}
              type="button"
              onClick={() => fuse(vv)}
              className="btn-pop relative w-20 h-20 rounded-full font-read font-bold text-5xl border-4 border-white shadow-lg"
              style={{
                background: `radial-gradient(circle at 30% 30%, #fff, ${vowelColor(vv)})`,
                color: "#3b1a66",
              }}
            >
              {vv}
              {found.includes(cons + vv) && (
                <span className="absolute -top-2 -right-2 text-xl">⭐</span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 min-h-12">
          {found.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => speak(sayOf(s))}
              className="glass rounded-full px-4 py-1 font-read text-2xl font-bold"
            >
              {s}
            </button>
          ))}
        </div>
        {allFound && (
          <BigButton
            color="yellow"
            className="mt-4 anim-glow"
            onClick={() => setPhase("quiz")}
          >
            Je suis prêt pour le test ! ⚡
          </BigButton>
        )}
      </MissionFrame>
    );
  }

  // Quiz : j'entends la syllabe, quelle voyelle coller ?
  const target = quiz[qi];
  const tc = target.slice(0, target.length - vowelOf(target).length);
  const tv = vowelOf(target);
  const choose = async (vv: VowelId) => {
    if (vv === tv) {
      setFusing(target);
      await fb.good(false);
      await speak(sayOf(target));
      if (qi + 1 >= quiz.length) onDone(errors, quiz.length);
      else {
        setQi(qi + 1);
        setWrong([]);
        setFusing(null);
      }
    } else {
      setErrors((e) => e + 1);
      setWrong((w) => [...w, vv]);
      fb.bad(false);
      speak(sayOf(tc + vv));
    }
  };
  return (
    <MissionFrame
      instruction={
        <>
          Écoute. Quelle voyelle faut-il coller à{" "}
          <b className="font-read text-2xl">{tc}</b> ?
        </>
      }
      speakText={[
        "Écoute bien. Quelle voyelle faut-il coller ?",
        sayOf(target),
      ]}
      round={qi}
      total={quiz.length}
    >
      <FeedbackLayer fb={fb} />
      <button
        type="button"
        onClick={() => speak(sayOf(target))}
        className="btn-pop text-6xl w-28 h-28 rounded-full bg-gradient-to-b from-cyan-300 to-sky-500 border-4 border-white shadow-[0_6px_0_#1b6fa8] my-3 anim-glow"
      >
        🔊
      </button>
      <div
        key={fb.shakeKey}
        className={`flex items-center gap-4 my-2 ${fb.shakeKey ? "anim-shake" : ""}`}
      >
        <div className="card-kawaii rounded-3xl w-28 h-28 flex items-center justify-center font-read font-bold text-7xl text-purple-800">
          {tc}
        </div>
        <span className="text-4xl">➕</span>
        <div className="rounded-3xl w-28 h-28 border-4 border-dashed border-white/70 flex items-center justify-center font-read font-bold text-7xl">
          {fusing ? <span style={{ color: vowelColor(tv) }}>{tv}</span> : "?"}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {vowelsFor(tc).map((vv) => (
          <button
            key={vv}
            type="button"
            disabled={wrong.includes(vv)}
            onClick={() => choose(vv)}
            className={`btn-pop w-20 h-20 rounded-full font-read font-bold text-5xl border-4 border-white shadow-lg disabled:opacity-30 ${
              wrong.length >= 2 && vv === tv ? "anim-glow" : ""
            }`}
            style={{
              background: `radial-gradient(circle at 30% 30%, #fff, ${vowelColor(vv)})`,
              color: "#3b1a66",
            }}
          >
            {vv}
          </button>
        ))}
      </div>
    </MissionFrame>
  );
}

// ======================= L'oreille d'or =======================
export function ListenSylMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    const pool = poolOf(mission);
    return cycle(mission.targets, 6).map((t) => ({
      t,
      choices: shuffle([t, ...confusables(t, pool, isVowel(t) ? 3 : 2)]),
    }));
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [errors, setErrors] = useState(0);
  const [states, setStates] = useState<Record<string, "good" | "bad">>({});
  const fb = useFeedback();
  const r = rounds[ri];
  const badCount = Object.values(states).filter((s) => s === "bad").length;

  const choose = async (s: string) => {
    if (states[s]) return;
    if (s === r.t) {
      setStates({ ...states, [s]: "good" });
      await fb.good();
      if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
      else {
        setRi(ri + 1);
        setStates({});
      }
    } else {
      setErrors((e) => e + 1);
      setStates({ ...states, [s]: "bad" });
      await fb.bad();
      speak(sayOf(r.t));
    }
  };

  return (
    <MissionFrame
      instruction="Écoute bien, puis touche la syllabe que tu entends."
      speakText={[
        "Écoute bien, et touche la syllabe que tu entends.",
        sayOf(r.t),
      ]}
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <button
        type="button"
        onClick={() => speak(sayOf(r.t))}
        className="btn-pop text-6xl w-32 h-32 rounded-full bg-gradient-to-b from-cyan-300 to-sky-500 border-4 border-white shadow-[0_6px_0_#1b6fa8] my-4 anim-glow"
      >
        🔊
      </button>
      <div className="flex flex-wrap justify-center gap-4">
        {r.choices.map((s) => (
          <SylTile
            key={ri + s}
            syl={s}
            state={states[s]}
            hint={badCount >= 2 && s === r.t}
            onClick={() => choose(s)}
          />
        ))}
      </div>
    </MissionFrame>
  );
}

// ======================= Le micro magique =======================
const BUBBLES = [
  { icon: "⭐", color: "from-yellow-200 to-amber-400" },
  { icon: "💖", color: "from-pink-300 to-fuchsia-500" },
  { icon: "🌙", color: "from-cyan-200 to-sky-500" },
  { icon: "🍀", color: "from-lime-200 to-emerald-500" },
];

export function SeeSoundMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    const pool = poolOf(mission);
    return cycle(mission.targets, 5).map((t) => ({
      t,
      choices: shuffle([t, ...confusables(t, pool, 2)]),
    }));
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [bad, setBad] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const fb = useFeedback();
  const r = rounds[ri];

  const listen = (i: number) => {
    setSel(i);
    speak(sayOf(r.choices[i]));
  };
  const validate = async () => {
    if (sel === null) return;
    if (r.choices[sel] === r.t) {
      await fb.good();
      if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
      else {
        setRi(ri + 1);
        setSel(null);
        setBad([]);
      }
    } else {
      setErrors((e) => e + 1);
      setBad((b) => [...b, sel]);
      setSel(null);
      fb.bad();
    }
  };

  return (
    <MissionFrame
      instruction="Lis la syllabe. Écoute les bulles et choisis celle qui chante la syllabe !"
      speakText="Regarde la syllabe. Touche les bulles pour les écouter, puis choisis celle qui chante la bonne syllabe."
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div
        key={ri}
        className="anim-pop card-kawaii rounded-[2rem] px-10 py-4 font-read font-bold text-8xl my-3"
      >
        {r.t}
      </div>
      <div className="flex flex-wrap justify-center gap-5 my-3">
        {r.choices.map((choice, i) => (
          <button
            key={`${ri}-${choice}`}
            type="button"
            disabled={bad.includes(i)}
            onClick={() => listen(i)}
            className={`btn-pop w-24 h-24 rounded-full bg-gradient-to-b ${BUBBLES[i].color} border-4 flex flex-col items-center justify-center shadow-xl disabled:opacity-25 disabled:grayscale ${
              sel === i
                ? "border-yellow-200 ring-8 ring-yellow-300/60 scale-110"
                : "border-white"
            }`}
          >
            <span className="text-4xl">{BUBBLES[i].icon}</span>
            <span className="text-xl">🔊</span>
          </button>
        ))}
      </div>
      <BigButton
        color="green"
        disabled={sel === null}
        onClick={validate}
        className="mt-2"
      >
        C'est cette bulle ! ✔️
      </BigButton>
      <p className="mt-3 text-white/70 text-sm">
        Astuce : écoute toutes les bulles avant de choisir !
      </p>
    </MissionFrame>
  );
}
