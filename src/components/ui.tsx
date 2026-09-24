import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import hana from "../assets/hana.png";
import yuki from "../assets/yuki.png";
import momo from "../assets/momo.png";
import mochi from "../assets/mochi.png";
import king from "../assets/king.png";
import demon from "../assets/demon.png";
import { speak, speakSeq } from "../lib/speech";
import { sfx } from "../lib/sfx";
import { cleanPart, type Word } from "../data/words";
import type { Speaker } from "../data/story";
import { pick } from "../lib/utils";

export const IMAGES = { hana, yuki, momo, mochi, king, demon };

export const SPEAKER_INFO: Record<
  Speaker,
  { name: string; img: string; color: string }
> = {
  hana: { name: "Hana", img: hana, color: "#ff4fa3" },
  yuki: { name: "Yuki", img: yuki, color: "#34c3ff" },
  momo: { name: "Momo", img: momo, color: "#b36bff" },
  mochi: { name: "Mochi", img: mochi, color: "#ffffff" },
  king: { name: "Roi Chuuut", img: king, color: "#6b3cff" },
  boss: { name: "Démon", img: demon, color: "#6b3cff" },
};

// ---------- Contexte de jeu ----------
export interface GameCtx {
  autoRead: boolean;
  hero: "hana" | "yuki" | "momo";
  name: string;
}
export const GameContext = createContext<GameCtx>({
  autoRead: true,
  hero: "hana",
  name: "",
});
export const useGame = () => useContext(GameContext);

// ---------- Boutons ----------
export function SpeakButton({
  text,
  size = "md",
  className = "",
  label,
  onSpoken,
}: {
  text: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  onSpoken?: () => void;
}) {
  const [active, setActive] = useState(false);
  const sizes = {
    sm: "w-10 h-10 text-lg",
    md: "w-14 h-14 text-2xl",
    lg: "w-20 h-20 text-4xl",
    xl: "w-28 h-28 text-6xl",
  };
  return (
    <button
      type="button"
      aria-label={label ?? "Écouter"}
      onClick={async (e) => {
        e.stopPropagation();
        setActive(true);
        await speak(text);
        setActive(false);
        onSpoken?.();
      }}
      className={`btn-pop rounded-full bg-gradient-to-b from-cyan-300 to-sky-500 border-4 border-white shadow-[0_5px_0_#1b6fa8] flex items-center justify-center shrink-0 ${sizes[size]} ${active ? "anim-wobble ring-4 ring-yellow-300" : ""} ${className}`}
    >
      <span>{active ? "🎶" : "🔊"}</span>
      {label && size !== "sm" && <span className="sr-only">{label}</span>}
    </button>
  );
}

export function BigButton({
  children,
  onClick,
  color = "pink",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: "pink" | "cyan" | "yellow" | "purple" | "green";
  className?: string;
  disabled?: boolean;
}) {
  const colors = {
    pink: "from-pink-400 to-fuchsia-500 shadow-[0_6px_0_#a3237f]",
    cyan: "from-cyan-300 to-sky-500 shadow-[0_6px_0_#1b6fa8]",
    yellow:
      "from-yellow-200 to-amber-400 shadow-[0_6px_0_#b77a0c] text-purple-900",
    purple: "from-violet-400 to-purple-600 shadow-[0_6px_0_#4b1d8f]",
    green:
      "from-lime-300 to-emerald-500 shadow-[0_6px_0_#1c7a4a] text-emerald-950",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        sfx.tap();
        onClick?.();
      }}
      className={`btn-pop bg-gradient-to-b ${colors[color]} rounded-full px-6 py-3 font-bold text-xl border-4 border-white/80 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Mot découpé en syllabes (couleurs alternées + lettres muettes) ----------
export function SyllableWord({
  word,
  hideIndex,
  hideContent,
  className = "",
  plain = false,
}: {
  word: Word;
  hideIndex?: number;
  hideContent?: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <span
      className={`font-read font-bold inline-flex items-baseline ${className}`}
    >
      {word.parts.map((p, i) => {
        if (i === hideIndex) return <span key={i}>{hideContent}</span>;
        const cls = plain ? "text-purple-900" : i % 2 === 0 ? "syl-a" : "syl-b";
        const segs = p.split(/(\[[^\]]+\])/).filter(Boolean);
        return (
          <span key={i} className={cls}>
            {segs.map((s, j) =>
              s.startsWith("[") ? (
                <span key={j} className="syl-muet">
                  {cleanPart(s)}
                </span>
              ) : (
                <span key={j}>{s}</span>
              ),
            )}
          </span>
        );
      })}
    </span>
  );
}

// ---------- Étoiles ----------
export function Stars({ n, size = "text-2xl" }: { n: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "" : "opacity-25 grayscale"}>
          ⭐
        </span>
      ))}
    </span>
  );
}

// ---------- Fond étoilé ----------
export function StarField() {
  const stars = useRef(
    Array.from({ length: 40 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 4 + Math.random() * 10,
      d: Math.random() * 3,
      c: pick(["✦", "✧", "⋆", "♡", "✦"]),
    })),
  ).current;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {stars.map((st, i) => (
        <span
          key={i}
          className="star-twinkle absolute text-white/70"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            fontSize: st.s,
            animationDelay: `${st.d}s`,
          }}
        >
          {st.c}
        </span>
      ))}
    </div>
  );
}

// ---------- Explosion de particules ----------
export function Burst({
  x = 50,
  y = 50,
  trigger,
}: {
  x?: number;
  y?: number;
  trigger: number;
}) {
  const [parts, setParts] = useState<
    { id: number; dx: number; dy: number; c: string }[]
  >([]);
  useEffect(() => {
    if (!trigger) return;
    const p = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const r = 80 + Math.random() * 80;
      return {
        id: trigger * 100 + i,
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r,
        c: pick(["⭐", "💖", "✨", "🌸", "💫"]),
      };
    });
    setParts(p);
    const t = setTimeout(() => setParts([]), 1000);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {parts.map((p) => (
        <span
          key={p.id}
          className="particle absolute text-3xl"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
          }}
        >
          {p.c}
        </span>
      ))}
    </div>
  );
}

// ---------- Retour (bravo / essaie encore) ----------
const CHEERS = [
  "Bravo !",
  "Super !",
  "Génial !",
  "Oui, c'est ça !",
  "Trop fort !",
  "Magnifique !",
];
const TRY = [
  "Essaie encore !",
  "Presque ! Réessaie.",
  "Oups ! Encore une fois.",
];

export function useFeedback() {
  const [burst, setBurst] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (text: string, good: boolean) => {
    setMsg({ text, good });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 1100);
  };
  return {
    burst,
    shakeKey,
    msg,
    good: async (say = true) => {
      sfx.good();
      setBurst((b) => b + 1);
      const t = pick(CHEERS);
      show(t, true);
      if (say) await speak(t);
    },
    bad: async (say = true) => {
      sfx.bad();
      setShakeKey((k) => k + 1);
      const t = pick(TRY);
      show(t, false);
      if (say) await speak(t);
    },
  };
}

export function FeedbackLayer({ fb }: { fb: ReturnType<typeof useFeedback> }) {
  return (
    <>
      <Burst trigger={fb.burst} />
      {fb.msg && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
          <div
            key={fb.msg.text + fb.burst + fb.shakeKey}
            className={`anim-pop rounded-full px-6 py-2 text-2xl font-bold border-4 border-white shadow-xl ${
              fb.msg.good
                ? "bg-gradient-to-r from-pink-400 to-yellow-300 text-purple-900"
                : "bg-gradient-to-r from-violet-500 to-indigo-500"
            }`}
          >
            {fb.msg.good ? "💖 " : "🌀 "}
            {fb.msg.text}
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Cadre de mission ----------
export function MissionFrame({
  instruction,
  speakText,
  round,
  total,
  children,
  hero,
  readKey,
}: {
  instruction: ReactNode;
  speakText: string | string[];
  round: number;
  total: number;
  children: ReactNode;
  hero?: Speaker;
  readKey?: string | number;
}) {
  const { autoRead, hero: h } = useGame();
  const who = hero ?? h;
  const seq = Array.isArray(speakText) ? speakText : [speakText];
  const key = seq.join("|");
  useEffect(() => {
    const t = setTimeout(() => {
      if (autoRead) speakSeq(seq);
      else if (seq.length > 1) speakSeq(seq.slice(1));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readKey ?? round, key]);
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto px-3">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-white transition-all ${
              i < round
                ? "bg-yellow-300"
                : i === round
                  ? "bg-pink-400 scale-125"
                  : "bg-white/20"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 w-full glass rounded-3xl p-2 pr-4">
        <img
          src={SPEAKER_INFO[who].img}
          alt=""
          className="w-14 h-14 object-contain anim-float"
        />
        <div className="flex-1 text-lg sm:text-xl font-semibold leading-snug">
          {instruction}
        </div>
        <button
          type="button"
          aria-label="Réécouter la consigne"
          onClick={() => speakSeq(seq)}
          className="btn-pop rounded-full bg-gradient-to-b from-cyan-300 to-sky-500 border-4 border-white shadow-[0_5px_0_#1b6fa8] w-12 h-12 text-xl shrink-0"
        >
          🔊
        </button>
      </div>
      <div className="w-full flex flex-col items-center">{children}</div>
    </div>
  );
}

/** Tuile de syllabe écrite */
export function SylTile({
  syl,
  onClick,
  state,
  size = "lg",
  hint,
}: {
  syl: string;
  onClick?: () => void;
  state?: "good" | "bad" | null;
  size?: "md" | "lg";
  hint?: boolean;
}) {
  const sz =
    size === "lg" ? "min-w-28 h-28 text-6xl" : "min-w-20 h-20 text-4xl";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-pop card-kawaii rounded-3xl px-4 font-read font-bold ${sz} ${
        state === "good"
          ? "!bg-lime-200 !border-lime-400 anim-pop"
          : state === "bad"
            ? "!bg-rose-200 !border-rose-400 anim-shake opacity-60"
            : ""
      } ${hint ? "anim-glow" : ""}`}
    >
      {syl}
    </button>
  );
}
