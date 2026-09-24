import { useState } from "react";
import { BigButton, IMAGES } from "../components/ui";
import type { Save } from "../lib/storage";
import { speak } from "../lib/speech";

export function TitleScreen({ save, onStart, onSettings }: { save: Save; onStart: (name: string, hero: Save["hero"]) => void; onSettings: () => void }) {
  const [name, setName] = useState(save.name);
  const [hero, setHero] = useState<Save["hero"]>(save.hero);
  const hasSave = Object.keys(save.stars).length > 0;
  const heroes: { id: Save["hero"]; label: string; color: string }[] = [
    { id: "hana", label: "Hana", color: "#ff4fa3" },
    { id: "yuki", label: "Yuki", color: "#34c3ff" },
    { id: "momo", label: "Momo", color: "#b36bff" },
  ];
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 gap-5">
      <div className="text-center">
        <div className="text-lg sm:text-xl tracking-[0.3em] text-cyan-200 font-bold">★ LUMI STARS ★</div>
        <h1 className="text-6xl sm:text-8xl font-bold neon-text leading-none">
          <span className="font-read">B-A BA</span>
          <br />
          <span className="bg-gradient-to-r from-pink-300 via-yellow-200 to-cyan-300 bg-clip-text text-transparent">Hunters</span>
        </h1>
        <p className="mt-2 text-lg sm:text-xl text-pink-100">Les chasseuses de syllabes contre le Roi Chuuut !</p>
      </div>

      <div className="flex items-end justify-center -space-x-6">
        <img src={IMAGES.yuki} alt="Yuki" className="w-28 sm:w-40 anim-float" style={{ animationDelay: "0.4s" }} />
        <img src={IMAGES.hana} alt="Hana" className="w-36 sm:w-52 anim-float z-10" />
        <img src={IMAGES.momo} alt="Momo" className="w-28 sm:w-40 anim-float" style={{ animationDelay: "0.8s" }} />
        <img src={IMAGES.mochi} alt="Mochi" className="w-20 sm:w-28 anim-float self-start" style={{ animationDelay: "1.2s" }} />
      </div>

      <div className="glass rounded-3xl p-4 w-full max-w-md flex flex-col gap-3">
        <label className="font-bold text-lg">Ton prénom :</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Écris ton prénom"
          className="rounded-2xl px-4 py-3 text-2xl font-read text-purple-900 bg-white border-4 border-pink-300 outline-none focus:border-yellow-300"
        />
        <div className="font-bold text-lg">Ta chasseuse préférée :</div>
        <div className="flex justify-center gap-3">
          {heroes.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setHero(h.id);
                speak(h.label);
              }}
              className={`btn-pop rounded-2xl p-1 border-4 ${hero === h.id ? "border-yellow-300 scale-110 bg-white/20" : "border-transparent opacity-70"}`}
            >
              <img src={IMAGES[h.id]} alt={h.label} className="w-16 h-20 object-contain" />
              <div className="font-bold" style={{ color: h.color }}>
                {h.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <BigButton color="yellow" className="text-2xl px-10 py-4 anim-glow" onClick={() => onStart(name.trim(), hero)}>
        {hasSave ? "Continuer l'aventure ▶" : "Commencer l'aventure ▶"}
      </BigButton>
      <button type="button" onClick={onSettings} className="text-white/70 underline">
        ⚙️ Espace parents (voix, réglages)
      </button>
    </div>
  );
}
