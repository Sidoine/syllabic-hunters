import { useEffect, useState } from "react";
import { BigButton, IMAGES, Stars, useGame } from "../components/ui";
import type { Mission } from "../data/story";
import { MISSION_INFO } from "../data/story";
import { getFrenchVoices, onVoicesChanged, speak, speechSupported, stopSpeech } from "../lib/speech";
import type { Save, Settings } from "../lib/storage";
import { sfx } from "../lib/sfx";
import { VowelsMission, FusionMission, ListenSylMission, SeeSoundMission } from "../components/missions/SoundMissions";
import { FindImagesMission, MissingMission, BuildMission, ReadWordMission, ListenWordMission } from "../components/missions/WordMissions";
import { MemoryMission, BattleMission } from "../components/missions/GameMissions";
import type { MissionProps } from "../components/missions/helpers";

const COMPONENTS: Record<Mission["type"], (p: MissionProps) => React.ReactElement | null> = {
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

export function MissionScreen({ mission, onDone, onQuit }: { mission: Mission; onDone: (errors: number, rounds: number) => void; onQuit: () => void }) {
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
          className="btn-pop glass rounded-full w-12 h-12 text-2xl shrink-0"
        >
          ✖
        </button>
        <div className="flex-1 text-center font-bold text-xl sm:text-2xl neon-text">
          {mission.icon} {mission.title}
        </div>
        <div className="w-12" />
      </header>
      <Comp key={mission.id} mission={mission} onDone={onDone} />
    </div>
  );
}

export function ResultScreen({ mission, stars, isLastOfChapter, onNext, onMap, onReplay }: { mission: Mission; stars: number; isLastOfChapter: boolean; onNext: () => void; onMap: () => void; onReplay: () => void }) {
  const { hero, name } = useGame();
  useEffect(() => {
    sfx.win();
    const txt = stars === 3 ? `Parfait ${name} ! Trois étoiles !` : stars === 2 ? `Bravo ${name} ! Deux étoiles !` : `Mission réussie ${name} ! Tu peux rejouer pour gagner plus d'étoiles.`;
    const t = setTimeout(() => speak(txt), 400);
    return () => clearTimeout(t);
  }, [stars, name]);
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <div className="text-2xl text-cyan-200 font-bold">{mission.type === "battle" ? "Démon vaincu !" : "Mission accomplie !"}</div>
      <div className="text-4xl sm:text-5xl font-bold neon-text">{MISSION_INFO[mission.type].icon} {mission.title}</div>
      <div className="anim-pop">
        <Stars n={stars} size="text-7xl" />
      </div>
      <div className="flex items-end gap-2">
        <img src={IMAGES[hero]} alt="" className="w-36 anim-float" />
        <img src={IMAGES.mochi} alt="" className="w-20 anim-float" style={{ animationDelay: "0.5s" }} />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <BigButton color="yellow" className="anim-glow text-2xl" onClick={onNext}>
          {isLastOfChapter ? "Fin du chapitre ▶" : "Mission suivante ▶"}
        </BigButton>
        <BigButton color="cyan" onClick={onReplay}>
          Rejouer 🔁
        </BigButton>
        <BigButton color="purple" onClick={onMap}>
          Carte 🗺️
        </BigButton>
      </div>
    </div>
  );
}

export function SettingsModal({ save, onChange, onClose, onReset }: { save: Save; onChange: (s: Settings) => void; onClose: () => void; onReset: () => void }) {
  const [voices, setVoices] = useState(getFrenchVoices());
  useEffect(() => onVoicesChanged(() => setVoices(getFrenchVoices())), []);
  const s = save.settings;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="card-kawaii rounded-3xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-2xl font-bold">⚙️ Espace parents</h2>
          <button type="button" onClick={onClose} className="text-3xl">
            ✖
          </button>
        </div>

        {!speechSupported() && <p className="bg-rose-100 rounded-xl p-2 mb-3">⚠️ Ce navigateur ne propose pas de synthèse vocale. Le jeu reste jouable, mais les sons ne seront pas lus.</p>}
        {speechSupported() && voices.length === 0 && (
          <p className="bg-amber-100 rounded-xl p-2 mb-3">⚠️ Aucune voix française détectée. Installez une voix française dans les réglages de l'appareil (ou utilisez Chrome / Edge / Safari).</p>
        )}

        <label className="block font-bold mt-2">Voix française</label>
        <select value={s.voiceURI ?? ""} onChange={(e) => set({ voiceURI: e.target.value || null })} className="w-full rounded-xl border-2 border-pink-300 p-2 bg-white">
          <option value="">Automatique (meilleure voix)</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>

        <label className="block font-bold mt-3">Vitesse de la voix : {s.rate.toFixed(2)}</label>
        <input type="range" min={0.5} max={1.2} step={0.05} value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="w-full accent-pink-500" />

        <div className="flex flex-wrap gap-2 mt-2">
          {["bas", "beau", "loup", "Bravo, tu lis très bien !"].map((t) => (
            <button key={t} type="button" onClick={() => speak(t)} className="rounded-full bg-sky-100 border-2 border-sky-300 px-3 py-1">
              🔊 {t}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-4 font-semibold">
          <input type="checkbox" checked={s.autoRead} onChange={(e) => set({ autoRead: e.target.checked })} className="w-5 h-5 accent-pink-500" />
          Lire les consignes automatiquement
        </label>
        <label className="flex items-center gap-2 mt-2 font-semibold">
          <input type="checkbox" checked={s.sfx} onChange={(e) => set({ sfx: e.target.checked })} className="w-5 h-5 accent-pink-500" />
          Effets sonores
        </label>
        <label className="flex items-center gap-2 mt-2 font-semibold">
          <input type="checkbox" checked={s.unlockAll} onChange={(e) => set({ unlockAll: e.target.checked })} className="w-5 h-5 accent-pink-500" />
          Mode libre : débloquer toutes les missions
        </label>

        <div className="mt-4 text-sm bg-purple-50 rounded-2xl p-3 leading-relaxed">
          <b>Comment fonctionne le jeu ?</b>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Méthode syllabique : consonne + voyelle (b + a = ba). Voyelles travaillées : a, i, o, u, é, ou.</li>
            <li>Les syllabes en « e » (be, le…) sont écartées : ce son n'est pas stable pour un débutant.</li>
            <li>C et G ne sont travaillés que devant a, o, u, ou (ca, go…), là où ils sont durs.</li>
            <li>Pour éviter que la voix épelle les lettres, chaque syllabe est prononcée via un mot qui se dit pareil (ex. « bo » → « beau », « lou » → « loup »).</li>
            <li>Dans les mots, les syllabes alternent rose/bleu ; les lettres muettes sont en gris.</li>
            <li>La progression est sauvegardée automatiquement sur cet appareil.</li>
          </ul>
        </div>

        <div className="mt-4 flex justify-between items-center">
          {confirm ? (
            <div className="flex gap-2 items-center">
              <span className="font-semibold">Tout effacer ?</span>
              <button type="button" onClick={onReset} className="rounded-full bg-rose-500 text-white px-3 py-1 font-bold">
                Oui
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-full bg-gray-200 px-3 py-1">
                Non
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="text-rose-600 underline">
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
