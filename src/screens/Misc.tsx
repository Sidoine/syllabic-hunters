import { useEffect, useState } from "react";
import {
  BattleMission,
  MemoryMission,
} from "../components/missions/GameMissions";
import type { MissionProps } from "../components/missions/helpers";
import {
  FusionMission,
  ListenSylMission,
  SeeSoundMission,
  VowelsMission,
} from "../components/missions/SoundMissions";
import {
  BuildMission,
  FindImagesMission,
  ListenWordMission,
  MissingMission,
  ReadWordMission,
} from "../components/missions/WordMissions";
import { BigButton, IMAGES, MISSION_ICONS, Stars, UI_ICONS, useGame } from "../components/ui";
import type { Mission } from "../data/reading";
import { sfx } from "../lib/sfx";
import {
	recordedVoiceCatalog,
  speak,
  speechSupported,
  stopSpeech,
} from "../lib/speech";
import type { Save, Settings } from "../lib/storage";

const COMPONENTS: Record<
  Mission["type"],
  (p: MissionProps) => React.ReactElement | null
> = {
  vowels: VowelsMission,
  fusion: FusionMission,
  "listen-syl": ListenSylMission,
  "see-sound": SeeSoundMission,
  "find-images": FindImagesMission,
  missing: MissingMission,
  build: BuildMission,
  "read-word": ReadWordMission,
  "listen-word": ListenWordMission,
  memory: MemoryMission,
  battle: BattleMission,
};

export function MissionScreen({
  mission,
  onDone,
  onQuit,
}: {
  mission: Mission;
  onDone: (errors: number, rounds: number) => void;
  onQuit: () => void;
}) {
  const Comp = COMPONENTS[mission.type];
  return (
    <div className="min-h-full py-3 flex flex-col gap-2">
      <header className="flex items-center gap-3 px-3 max-w-4xl mx-auto w-full">
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onQuit();
          }}
          aria-label="Quitter la mission"
          className="btn-pop glass rounded-full w-12 h-12 text-2xl shrink-0"
        >
          <img src={UI_ICONS.close} alt="" className="w-9 h-9 object-contain" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 text-center font-bold text-xl sm:text-2xl neon-text">
          <img src={MISSION_ICONS[mission.type]} alt="" className="w-10 h-10 object-contain shrink-0" />
          {mission.title}
        </div>
        <div className="w-12" />
      </header>
      <Comp key={mission.id} mission={mission} onDone={onDone} />
    </div>
  );
}

export function ResultScreen({
  mission,
  stars,
  isLastOfChapter,
  onNext,
  onMap,
  onReplay,
}: {
  mission: Mission;
  stars: number;
  isLastOfChapter: boolean;
  onNext: () => void;
  onMap: () => void;
  onReplay: () => void;
}) {
  const { hero, name } = useGame();
  useEffect(() => {
    sfx.win();
    const txt =
      stars === 3
        ? `Parfait ${name} ! Trois étoiles !`
        : stars === 2
          ? `Bravo ${name} ! Deux étoiles !`
          : `Mission réussie ${name} ! Tu peux rejouer pour gagner plus d'étoiles.`;
    const t = setTimeout(() => speak(txt), 400);
    return () => clearTimeout(t);
  }, [stars, name]);
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <div className="text-2xl text-cyan-200 font-bold">
        {mission.type === "battle" ? "Démon vaincu !" : "Mission accomplie !"}
      </div>
      <div className="flex items-center justify-center gap-2 text-4xl sm:text-5xl font-bold neon-text">
        <img src={MISSION_ICONS[mission.type]} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0" />
        {mission.title}
      </div>
      <div className="anim-pop">
        <Stars n={stars} size="text-7xl" />
      </div>
      <div className="flex items-end gap-2">
        <img src={IMAGES[hero]} alt="" className="w-36 anim-float" />
        <img
          src={IMAGES.mochi}
          alt=""
          className="w-20 anim-float"
          style={{ animationDelay: "0.5s" }}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <BigButton
          color="yellow"
          className="anim-glow text-2xl"
          onClick={onNext}
        >
          {isLastOfChapter ? "Fin du chapitre ▶" : "Mission suivante ▶"}
        </BigButton>
        <BigButton color="cyan" onClick={onReplay}>
          <span className="flex items-center gap-2"><img src={UI_ICONS.replay} alt="" className="w-9 h-9 object-contain" /> Rejouer</span>
        </BigButton>
        <BigButton color="purple" onClick={onMap}>
          <span className="flex items-center gap-2"><img src={UI_ICONS.map} alt="" className="w-9 h-9 object-contain" /> Carte</span>
        </BigButton>
      </div>
    </div>
  );
}

export function SettingsModal({
  save,
  onChange,
  onClose,
  onReset,
}: {
  save: Save;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const s = save.settings;
  const missingVoiceCount = recordedVoiceCatalog.filter((voice) => !voice.available).length;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="card-kawaii rounded-3xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><img src={UI_ICONS.settings} alt="" className="w-10 h-10 object-contain" /> Espace parents</h2>
          <button type="button" onClick={onClose} aria-label="Fermer les réglages" className="btn-pop rounded-full w-11 h-11">
            <img src={UI_ICONS.close} alt="" className="w-9 h-9 object-contain" />
          </button>
        </div>

        <p className={`rounded-xl p-2 mb-3 ${speechSupported() ? "bg-emerald-100" : "bg-rose-100"}`}>
          {speechSupported()
            ? `Les répliques et consignes utilisent uniquement le catalogue du jeu.${missingVoiceCount ? ` ${missingVoiceCount} enregistrements restent à générer.` : ""}`
            : "Aucun enregistrement n’est déclaré dans le catalogue vocal du jeu."}
        </p>

        <div className="flex flex-wrap gap-2 mt-2">
          {["bas", "beau", "loup", "Bravo, tu lis très bien !"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => speak(t)}
              className="rounded-full bg-sky-100 border-2 border-sky-300 px-3 py-1"
            >
              🔊 {t}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-4 font-semibold">
          <input
            type="checkbox"
            checked={s.autoRead}
            onChange={(e) => set({ autoRead: e.target.checked })}
            className="w-5 h-5 accent-pink-500"
          />
          Lire les consignes automatiquement
        </label>
        <label className="flex items-center gap-2 mt-2 font-semibold">
          <input
            type="checkbox"
            checked={s.sfx}
            onChange={(e) => set({ sfx: e.target.checked })}
            className="w-5 h-5 accent-pink-500"
          />
          Effets sonores
        </label>
        <label className="flex items-center gap-2 mt-2 font-semibold">
          <input
            type="checkbox"
            checked={s.unlockAll}
            onChange={(e) => set({ unlockAll: e.target.checked })}
            className="w-5 h-5 accent-pink-500"
          />
          Mode libre : débloquer toutes les missions
        </label>

        <div className="mt-4 text-sm bg-purple-50 rounded-2xl p-3 leading-relaxed">
          <b>Comment fonctionne le jeu ?</b>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              Méthode syllabique : consonne + voyelle (b + a = ba). Voyelles
              travaillées : a, i, o, u, é, ou.
            </li>
            <li>
              Les syllabes en « e » (be, le…) sont écartées : ce son n'est pas
              stable pour un débutant.
            </li>
            <li>
              C et G ne sont travaillés que devant a, o, u, ou (ca, go…), là où
              ils sont durs.
            </li>
            <li>
              Pour éviter que la voix épelle les lettres, chaque syllabe est
              prononcée via un mot qui se dit pareil (ex. « bo » → « beau », «
              lou » → « loup »).
            </li>
            <li>
              Dans les mots, les syllabes alternent rose/bleu ; les lettres
              muettes sont en gris.
            </li>
            <li>
              La progression est sauvegardée automatiquement sur cet appareil.
            </li>
          </ul>
        </div>

        <div className="mt-4 flex justify-between items-center">
          {confirm ? (
            <div className="flex gap-2 items-center">
              <span className="font-semibold">Tout effacer ?</span>
              <button
                type="button"
                onClick={onReset}
                className="rounded-full bg-rose-500 text-white px-3 py-1 font-bold"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="rounded-full bg-gray-200 px-3 py-1"
              >
                Non
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="text-rose-600 underline"
            >
              Réinitialiser la progression
            </button>
          )}
          <BigButton color="pink" onClick={onClose}>
            OK
          </BigButton>
        </div>
      </div>
    </div>
  );
}
