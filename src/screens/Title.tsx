import { useState } from "react";
import { BigButton, IMAGES } from "../components/ui";
import { login, register, type AuthUser } from "../lib/api";
import { speak } from "../lib/speech";
import type { Save } from "../lib/storage";

export function TitleScreen({
  save,
  user,
  onAuthenticated,
  onLogout,
  onStart,
  onSettings,
}: {
  save: Save;
  user: AuthUser | null;
  onAuthenticated: (user: AuthUser) => Promise<void>;
  onLogout: () => Promise<void>;
  onStart: (name: string, hero: Save["hero"]) => void;
  onSettings: () => void;
}) {
  const [name, setName] = useState(save.name);
  const [hero, setHero] = useState<Save["hero"]>(save.hero);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const hasSave = Object.keys(save.stars).length > 0;
  const heroes: { id: Save["hero"]; label: string; color: string }[] = [
    { id: "hana", label: "Hana", color: "#ff4fa3" },
    { id: "yuki", label: "Luna", color: "#34c3ff" },
    { id: "momo", label: "Mia", color: "#b36bff" },
  ];
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 gap-5">
      <div className="text-center">
        <div className="text-lg sm:text-xl tracking-[0.3em] text-cyan-200 font-bold">
          ★ LUMI STARS ★
        </div>
        <h1 className="text-6xl sm:text-8xl font-bold neon-text leading-none">
          <span className="font-read">B-A BA</span>
          <br />
          <span className="bg-gradient-to-r from-pink-300 via-yellow-200 to-cyan-300 bg-clip-text text-transparent">
            Hunters
          </span>
        </h1>
        <p className="mt-2 text-lg sm:text-xl text-pink-100">
          Les chasseuses de syllabes contre le Roi Chuuut !
        </p>
      </div>

      <div className="flex items-end justify-center -space-x-6">
        <img
          src={IMAGES.yuki}
          alt="Luna"
          className="w-28 sm:w-40 anim-float"
          style={{ animationDelay: "0.4s" }}
        />
        <img
          src={IMAGES.hana}
          alt="Hana"
          className="w-36 sm:w-52 anim-float z-10"
        />
        <img
          src={IMAGES.momo}
          alt="Mia"
          className="w-28 sm:w-40 anim-float"
          style={{ animationDelay: "0.8s" }}
        />
        <img
          src={IMAGES.mochi}
          alt="Mochi"
          className="w-20 sm:w-28 anim-float self-start"
          style={{ animationDelay: "1.2s" }}
        />
      </div>

      <div className="glass rounded-3xl p-4 w-full max-w-md flex flex-col gap-3">
        <label htmlFor="player-name" className="font-bold text-lg">
          Ton prénom :
        </label>
        <input
          id="player-name"
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
              <img
                src={IMAGES[h.id]}
                alt={h.label}
                className="w-16 h-20 object-contain"
              />
              <div className="font-bold" style={{ color: h.color }}>
                {h.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <BigButton
        color="yellow"
        className="text-2xl px-10 py-4 anim-glow"
        onClick={() => onStart(name.trim(), hero)}
      >
        {hasSave ? "Continuer l'aventure ▶" : "Commencer l'aventure ▶"}
      </BigButton>

      <div className="glass rounded-3xl p-4 w-full max-w-md">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">Sauvegarde synchronisée</div>
              <div className="text-sm text-white/70">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-xl border-2 border-white/40 px-3 py-2 font-bold"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setAuthBusy(true);
              setAuthError("");
              try {
                const result =
                  authMode === "login"
                    ? await login(email, password)
                    : await register(email, password);
                await onAuthenticated(result.user);
              } catch (error) {
                setAuthError(
                  error instanceof Error
                    ? error.message
                    : "Connexion impossible.",
                );
              } finally {
                setAuthBusy(false);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <strong>
                {authMode === "login"
                  ? "Retrouver ma sauvegarde"
                  : "Créer un compte"}
              </strong>
              <button
                type="button"
                className="text-sm underline"
                onClick={() =>
                  setAuthMode(authMode === "login" ? "register" : "login")
                }
              >
                {authMode === "login"
                  ? "Créer un compte"
                  : "J'ai déjà un compte"}
              </button>
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded-xl border-2 border-pink-200 bg-white px-3 py-2 text-purple-900 placeholder:text-slate-500 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/50"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe (8 caractères minimum)"
              className="rounded-xl border-2 border-pink-200 bg-white px-3 py-2 text-purple-900 placeholder:text-slate-500 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/50"
            />
            {authError && <p className="text-rose-200 text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={authBusy}
              className="rounded-xl bg-cyan-300 text-purple-950 px-4 py-2 font-bold disabled:opacity-50"
            >
              {authBusy
                ? "Connexion..."
                : authMode === "login"
                  ? "Se connecter"
                  : "S'inscrire"}
            </button>
          </form>
        )}
      </div>
      <button
        type="button"
        onClick={onSettings}
        className="text-white/70 underline"
      >
        ⚙️ Espace parents (voix, réglages)
      </button>
    </div>
  );
}
