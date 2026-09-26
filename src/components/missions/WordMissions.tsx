import { useMemo, useState } from "react";
import { SAY, sayOf } from "../../data/syllables";
import { cleanPart, WORDS, type Word } from "../../data/words";
import { sfx } from "../../lib/sfx";
import { speak } from "../../lib/speech";
import { cycle, sample, shuffle, uniq } from "../../lib/utils";
import {
  BigButton,
  FeedbackLayer,
  MissionFrame,
  SpeakButton,
  SyllableWord,
  SylTile,
  useFeedback,
} from "../ui";
import {
  confusables,
  type MissionProps,
  missingCandidates,
  poolOf,
  soundWords,
  wordsForTargets,
} from "./helpers";

// ======================= Images ensorcelées =======================
export function FindImagesMission({ mission, onDone }: MissionProps) {
  const start = !!mission.startMode;
  const rounds = useMemo(() => {
    const scored = shuffle(mission.targets)
      .map((t) => ({ t, pos: soundWords(t, start) }))
      .filter((x) => x.pos.length > 0)
      .sort((a, b) => Math.min(b.pos.length, 2) - Math.min(a.pos.length, 2));
    let chosen = scored.slice(0, 3);
    if (chosen.length < 2) {
      const extra = shuffle(mission.review)
        .map((t) => ({ t, pos: soundWords(t, start) }))
        .filter((x) => x.pos.length > 1);
      chosen = [...chosen, ...extra].slice(0, 3);
    }
    return chosen.map(({ t, pos }) => {
      const good = sample(pos, Math.min(3, pos.length));
      const firstLetter = t[0];
      const others = WORDS.filter(
        (w) =>
          !w.sounds.includes(t) &&
          !w.parts.some((p) => cleanPart(p).includes(t)) &&
          (!start || !cleanPart(w.parts[0]).startsWith(firstLetter)),
      );
      const cards = shuffle([...good, ...sample(others, 6 - good.length)]);
      return { t, cards, good: good.map((g) => g.word) };
    });
  }, [mission, start]);

  const [ri, setRi] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const fb = useFeedback();
  const r = rounds[ri];
  if (!r) {
    return (
      <BigButton color="yellow" onClick={() => onDone(0, 1)}>
        Continuer ✨
      </BigButton>
    );
  }

  const tapCard = async (w: Word) => {
    if (found.includes(w.word) || bad.includes(w.word)) return;
    if (r.good.includes(w.word)) {
      const nf = [...found, w.word];
      setFound(nf);
      sfx.good();
      await speak(w.say);
      if (nf.length === r.good.length) {
        await fb.good();
        if (ri + 1 >= rounds.length) onDone(errors, rounds.length * 2);
        else {
          setRi(ri + 1);
          setFound([]);
          setBad([]);
        }
      }
    } else {
      setErrors((e) => e + 1);
      setBad((b) => [...b, w.word]);
      sfx.bad();
      await speak(`${w.say}... Non, ce n'est pas le bon son !`);
    }
  };

  const verb = start ? "commence par le son" : "on entend le son";
  return (
    <MissionFrame
      instruction={
        <>
          Trouve les <b>{r.good.length}</b> images où {verb}{" "}
          <b className="font-read text-3xl text-yellow-200">{r.t}</b>. Touche 🔊
          pour écouter le nom.
        </>
      }
      speakText={[`Trouve les ${r.good.length} images où ${verb}`, sayOf(r.t)]}
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div className="flex items-center gap-3 mb-3">
        <div className="card-kawaii rounded-3xl px-6 py-1 font-read font-bold text-6xl">
          {r.t}
        </div>
        <SpeakButton text={sayOf(r.t)} size="md" />
        <div className="text-2xl font-bold">
          {found.length} / {r.good.length} 💎
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
        {r.cards.map((w) => {
          const isFound = found.includes(w.word);
          const isBad = bad.includes(w.word);
          return (
            // biome-ignore lint/a11y/useSemanticElements: Ce conteneur inclut le bouton vocal imbriqué.
            <div
              key={ri + w.word}
              role="button"
              tabIndex={0}
              onClick={() => tapCard(w)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") tapCard(w);
              }}
              className={`btn-pop relative card-kawaii rounded-3xl h-36 sm:h-40 flex flex-col items-center justify-center cursor-pointer ${
                isFound ? "!bg-lime-100 !border-lime-400 anim-pop" : ""
              } ${isBad ? "opacity-40 grayscale anim-shake" : ""}`}
            >
              <span className="text-6xl sm:text-7xl">{w.emoji}</span>
              {isFound && <SyllableWord word={w} className="text-2xl mt-1" />}
              {isFound && (
                <span className="absolute top-1 left-2 text-2xl">✅</span>
              )}
              <SpeakButton
                text={w.say}
                size="sm"
                className="!absolute top-1 right-1"
              />
            </div>
          );
        })}
      </div>
    </MissionFrame>
  );
}

// ======================= Le mot brisé =======================
export function MissingMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    let cands = missingCandidates(mission.targets);
    if (uniq(cands.map((c) => c.word.word)).length < 3)
      cands = [...cands, ...missingCandidates(mission.review.slice(-12))];
    const byWord = shuffle(cands).filter(
      (c, i, arr) => arr.findIndex((x) => x.word.word === c.word.word) === i,
    );
    const chosen = cycle(byWord, 5);
    const pool = poolOf(mission);
    return chosen.map((c) => ({
      ...c,
      choices: shuffle([c.syl, ...confusables(c.syl, pool, 2)]),
    }));
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [states, setStates] = useState<Record<string, "good" | "bad">>({});
  const [errors, setErrors] = useState(0);
  const fb = useFeedback();
  const r = rounds[ri];
  const solved = Object.values(states).includes("good");
  const badCount = Object.values(states).filter((s) => s === "bad").length;

  const choose = async (s: string) => {
    if (states[s] || solved) return;
    if (s === r.syl) {
      setStates({ ...states, [s]: "good" });
      sfx.good();
      await speak(r.word.say);
      await fb.good();
      if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
      else {
        setRi(ri + 1);
        setStates({});
      }
    } else {
      setErrors((e) => e + 1);
      setStates({ ...states, [s]: "bad" });
      fb.bad();
    }
  };

  return (
    <MissionFrame
      instruction="Un démon a cassé le mot ! Quelle syllabe manque ?"
      speakText={[
        "Un démon a cassé le mot ! Écoute le mot, et trouve la syllabe qui manque.",
        r.word.say,
      ]}
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div
        key={ri}
        className="anim-pop card-kawaii rounded-[2rem] px-6 py-4 flex flex-col items-center gap-2 my-2"
      >
        <div className="flex items-center gap-4">
          <span className="text-8xl">{r.word.emoji}</span>
          <SpeakButton text={r.word.say} size="md" />
        </div>
        <SyllableWord
          word={r.word}
          className="text-6xl"
          hideIndex={solved ? undefined : r.index}
          hideContent={
            <span className="inline-block min-w-20 mx-1 border-b-8 border-dashed border-fuchsia-400 text-transparent">
              __
            </span>
          }
        />
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-3">
        {r.choices.map((s) => (
          <SylTile
            key={ri + s}
            syl={s}
            state={states[s]}
            hint={badCount >= 2 && s === r.syl}
            onClick={() => choose(s)}
            size="md"
          />
        ))}
      </div>
    </MissionFrame>
  );
}

// ======================= La forge des mots =======================
export function BuildMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    let words = wordsForTargets(mission.targets, 3).filter(
      (w) => w.parts.length >= 2,
    );
    if (words.length < 4)
      words = [
        ...words,
        ...wordsForTargets(mission.review.slice(-12), 3).filter(
          (w) => w.parts.length >= 2,
        ),
      ];
    const chosen = sample(uniq(words), 4);
    const pool = poolOf(mission);
    return chosen.map((w) => {
      const t =
        w.sounds.find((s) => mission.targets.includes(s)) ??
        w.sounds.find((s) => s !== "_") ??
        pool[0];
      const distract = confusables(t, pool, 3).filter(
        (d) => !w.parts.map(cleanPart).includes(d),
      )[0];
      const tiles = shuffle([
        ...w.parts.map((p, i) => ({ id: `p${i}`, part: p })),
        ...(distract ? [{ id: "d", part: distract }] : []),
      ]);
      return { w, tiles };
    });
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [badTile, setBadTile] = useState<string | null>(null);
  const [errors, setErrors] = useState(0);
  const fb = useFeedback();
  const r = rounds[ri];

  const tap = async (tile: { id: string; part: string }) => {
    if (placed.includes(tile.id)) return;
    const expected = r.w.parts[placed.length];
    if (tile.part === expected) {
      const np = [...placed, tile.id];
      // si deux tuiles identiques, peu importe laquelle
      setPlaced(np);
      sfx.tap();
      if (np.length === r.w.parts.length) {
        await speak(r.w.say);
        await fb.good();
        if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
        else {
          setRi(ri + 1);
          setPlaced([]);
        }
      } else {
        const c = cleanPart(tile.part);
        if (SAY[c]) speak(SAY[c]);
      }
    } else {
      setErrors((e) => e + 1);
      setBadTile(tile.id);
      setTimeout(() => setBadTile(null), 500);
      fb.bad(false);
    }
  };

  const placedParts = placed.map(
    (id) => r.tiles.find((t) => t.id === id)?.part,
  );

  return (
    <MissionFrame
      instruction="Écris le mot ! Touche les syllabes dans le bon ordre."
      speakText={[
        "Écris le mot ! Touche les syllabes dans le bon ordre.",
        r.w.say,
      ]}
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div className="flex items-center gap-4 my-2">
        <span key={ri} className="text-8xl anim-pop">
          {r.w.emoji}
        </span>
        <SpeakButton text={r.w.say} size="lg" />
      </div>
      <div className="flex gap-2 my-3">
        {r.w.parts.map((_part, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Les emplacements de syllabes sont positionnels.
            key={i}
            className={`min-w-24 h-24 px-3 rounded-2xl border-4 flex items-center justify-center font-read font-bold text-5xl ${
              placedParts[i]
                ? `card-kawaii ${i % 2 ? "!text-sky-600" : "!text-pink-600"}`
                : "border-dashed border-white/60"
            }`}
          >
            {placedParts[i] ? <PartText part={placedParts[i]} /> : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {r.tiles.map((t) => (
          <button
            key={ri + t.id}
            type="button"
            disabled={placed.includes(t.id)}
            onClick={() => tap(t)}
            className={`btn-pop card-kawaii rounded-2xl min-w-24 h-20 px-3 font-read font-bold text-4xl disabled:opacity-0 ${badTile === t.id ? "anim-shake !bg-rose-200" : ""}`}
          >
            <PartText part={t.part} />
          </button>
        ))}
      </div>
    </MissionFrame>
  );
}

function PartText({ part }: { part: string }) {
  const segs = part.split(/(\[[^\]]+\])/).filter(Boolean);
  return (
    <span>
      {segs.map((s) =>
        s.startsWith("[") ? (
          <span key={`${part}-${s}`} className="syl-muet">
            {cleanPart(s)}
          </span>
        ) : (
          <span key={`${part}-${s}`}>{s}</span>
        ),
      )}
    </span>
  );
}

// ======================= Lecture secrète =======================
function similarWords(w: Word, pool: Word[], n: number): Word[] {
  const others = pool.filter((x) => x.word !== w.word && x.emoji !== w.emoji);
  const share = others.filter(
    (x) =>
      x.sounds.some((s) => s !== "_" && w.sounds.includes(s)) ||
      x.parts[0][0] === w.parts[0][0],
  );
  const out = sample(share, n);
  for (const x of shuffle(others))
    if (out.length < n && !out.includes(x)) out.push(x);
  return out;
}

export function ReadWordMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    let words = wordsForTargets(mission.targets);
    if (words.length < 5)
      words = uniq([...words, ...wordsForTargets(mission.review.slice(-12))]);
    return cycle(sample(words, 5), 5).map((w) => ({
      w,
      choices: shuffle([w, ...similarWords(w, WORDS, 2)]),
    }));
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [bad, setBad] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const [helped, setHelped] = useState(false);
  const fb = useFeedback();
  const r = rounds[ri];

  const choose = async (w: Word) => {
    if (bad.includes(w.word)) return;
    if (w.word === r.w.word) {
      await speak(w.say);
      await fb.good();
      if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
      else {
        setRi(ri + 1);
        setBad([]);
        setHelped(false);
      }
    } else {
      setErrors((e) => e + 1);
      setBad((b) => [...b, w.word]);
      fb.bad();
    }
  };

  return (
    <MissionFrame
      instruction="Lis le mot secret tout seul, syllabe par syllabe, puis touche la bonne image."
      speakText="Lis le mot secret tout seul, syllabe par syllabe. Puis touche la bonne image."
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div
        key={ri}
        className="anim-pop card-kawaii rounded-[2rem] px-8 py-4 my-2 flex items-center gap-4"
      >
        <span className="text-4xl">📜</span>
        <SyllableWord word={r.w} className="text-6xl sm:text-7xl" />
      </div>
      <div className="flex gap-2 mb-2 items-center text-white/80">
        {r.w.parts.map((p) =>
          SAY[p] ? (
            <button
              key={p}
              type="button"
              onClick={() => speak(SAY[p])}
              className="glass rounded-full px-3 py-1 font-read text-xl"
            >
              {p} 🔈
            </button>
          ) : (
            <span
              key={p}
              className="rounded-full px-3 py-1 font-read text-xl bg-white/5"
            >
              <PartText part={p} />
            </span>
          ),
        )}
        {(bad.length > 0 || helped) && (
          <SpeakButton
            text={r.w.say}
            size="sm"
            onSpoken={() => setHelped(true)}
            label="Écouter le mot"
          />
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {r.choices.map((w) => (
          <button
            key={ri + w.word}
            type="button"
            onClick={() => choose(w)}
            className={`btn-pop card-kawaii rounded-3xl w-32 h-32 sm:w-40 sm:h-40 text-7xl sm:text-8xl ${bad.includes(w.word) ? "opacity-30 grayscale anim-shake" : ""}`}
          >
            {w.emoji}
          </button>
        ))}
      </div>
    </MissionFrame>
  );
}

// ======================= Le mot mystère =======================
export function ListenWordMission({ mission, onDone }: MissionProps) {
  const rounds = useMemo(() => {
    let words = wordsForTargets(mission.targets);
    if (words.length < 5)
      words = uniq([...words, ...wordsForTargets(mission.review.slice(-12))]);
    return cycle(sample(words, 5), 5).map((w) => ({
      w,
      choices: shuffle([w, ...similarWords(w, WORDS, 2)]),
    }));
  }, [mission]);
  const [ri, setRi] = useState(0);
  const [bad, setBad] = useState<string[]>([]);
  const [good, setGood] = useState(false);
  const [errors, setErrors] = useState(0);
  const fb = useFeedback();
  const r = rounds[ri];

  const choose = async (w: Word) => {
    if (bad.includes(w.word) || good) return;
    if (w.word === r.w.word) {
      setGood(true);
      await fb.good();
      if (ri + 1 >= rounds.length) onDone(errors, rounds.length);
      else {
        setRi(ri + 1);
        setBad([]);
        setGood(false);
      }
    } else {
      setErrors((e) => e + 1);
      setBad((b) => [...b, w.word]);
      await fb.bad();
      speak(r.w.say);
    }
  };

  return (
    <MissionFrame
      instruction="Écoute le mot mystère et trouve comment il s'écrit."
      speakText={[
        "Écoute le mot mystère, et trouve comment il s'écrit.",
        r.w.say,
      ]}
      round={ri}
      total={rounds.length}
    >
      <FeedbackLayer fb={fb} />
      <div className="flex items-center gap-4 my-3">
        <SpeakButton text={r.w.say} size="xl" className="anim-glow" />
        {good && <span className="text-8xl anim-pop">{r.w.emoji}</span>}
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mt-2">
        {r.choices.map((w) => (
          <button
            key={ri + w.word}
            type="button"
            onClick={() => choose(w)}
            className={`btn-pop card-kawaii rounded-3xl px-6 py-4 ${bad.includes(w.word) ? "opacity-30 anim-shake" : ""} ${
              good && w.word === r.w.word ? "!bg-lime-100 !border-lime-400" : ""
            } ${bad.length >= 2 && w.word === r.w.word ? "anim-glow" : ""}`}
          >
            <SyllableWord word={w} className="text-5xl" />
          </button>
        ))}
      </div>
      <p className="text-white/60 mt-4 text-sm">
        Les couleurs montrent les syllabes. Les lettres grises ne se prononcent
        pas.
      </p>
    </MissionFrame>
  );
}
