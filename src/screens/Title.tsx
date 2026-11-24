import { useState } from "react";
import { login, register, type AuthUser } from "../lib/api";
import type { Save } from "../lib/storage";
import titleAdventure from "../assets/title-adventure.png";

export function TitleScreen({
  save,
  user,
  authReady,
  onAuthenticated,
  onPlay,
}: {
  save: Save;
  user: AuthUser | null;
  authReady: boolean;
  onAuthenticated: (
    user: AuthUser,
    profile: { name: string; hero: Save["hero"] },
  ) => Promise<void>;
  onPlay: () => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [name, setName] = useState(save.name);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  return (
    <main className="relative isolate min-h-screen w-full overflow-hidden bg-[#100a20] text-white">
      <img
        src={titleAdventure}
        alt="Luna, Hana, Mia, Milo et Mochi découvrent un grimoire magique dans la forêt."
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#130a2b]/95 via-[#130a2b]/20 to-slate-950/45" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-5 py-8 sm:px-10 sm:py-10">
        <div className="text-center drop-shadow-[0_3px_12px_rgba(20,8,52,.9)]">
          <div className="text-xs font-black tracking-[0.35em] text-cyan-100 sm:text-base">LUMI STARS</div>
          <h1 className="mt-1 text-4xl font-black leading-none sm:text-6xl">
            <span className="text-white">B-A BA </span>
            <span className="bg-gradient-to-r from-pink-200 via-yellow-100 to-cyan-200 bg-clip-text text-transparent">Hunters</span>
          </h1>
        </div>

        {authMode ? (
          <form
            className="glass anim-pop w-full max-w-md rounded-3xl border border-white/30 bg-[#170d31]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7"
            onSubmit={async (event) => {
              event.preventDefault();
              setAuthBusy(true);
              setAuthError("");
              try {
                const result = authMode === "login"
                  ? await login(email, password)
                  : await register(email, password);
                await onAuthenticated(result.user, {
                  name: authMode === "register" ? name.trim() : save.name,
                  hero: save.hero,
                });
                setAuthMode(null);
              } catch (error) {
                setAuthError(error instanceof Error ? error.message : "Connexion impossible.");
              } finally {
                setAuthBusy(false);
              }
            }}
          >
            <h2 className="mb-4 text-center text-2xl font-black">
              {authMode === "login" ? "Connexion" : "Créer un compte"}
            </h2>
            <div className="flex flex-col gap-3">
              {authMode === "register" && (
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 16))}
                  placeholder="Ton prénom"
                  aria-label="Ton prénom"
                  className="rounded-xl border-2 border-pink-200 bg-white px-4 py-3 text-lg font-bold text-purple-950 outline-none focus:border-cyan-400"
                />
              )}
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="rounded-xl border-2 border-pink-200 bg-white px-4 py-3 text-purple-950 outline-none focus:border-cyan-400"
              />
              <input
                type="password"
                required
                minLength={8}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe"
                className="rounded-xl border-2 border-pink-200 bg-white px-4 py-3 text-purple-950 outline-none focus:border-cyan-400"
              />
            </div>
            {authError && <p role="alert" className="mt-3 text-center text-sm font-bold text-rose-200">{authError}</p>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={authBusy}
                className="btn-pop flex-1 rounded-full border-2 border-white/70 bg-gradient-to-r from-cyan-300 to-blue-400 px-5 py-3 text-lg font-black text-slate-950 shadow-lg disabled:opacity-60"
              >
                {authBusy ? "Patiente…" : authMode === "login" ? "Connexion" : "Créer mon compte"}
              </button>
              <button type="button" onClick={() => { setAuthMode(null); setAuthError(""); }} className="rounded-full border border-white/50 bg-slate-950/45 px-5 py-3 font-bold text-white">
                Retour
              </button>
            </div>
          </form>
        ) : (
          <div className="flex w-full max-w-sm flex-col gap-3 pb-3 sm:pb-8">
            {!authReady ? (
              <button type="button" disabled className="rounded-full border-2 border-white/40 bg-slate-950/50 px-8 py-4 text-lg font-bold text-white/75">
                Chargement…
              </button>
            ) : user ? (
              <button type="button" onClick={onPlay} className="btn-pop rounded-full border-2 border-white/85 bg-gradient-to-r from-yellow-200 via-amber-300 to-pink-300 px-8 py-4 text-2xl font-black text-purple-950 shadow-[0_8px_30px_rgba(255,214,91,.45)]">
                Jouer ▶
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setAuthMode("login")} className="btn-pop rounded-full border-2 border-white/85 bg-gradient-to-r from-cyan-300 to-blue-400 px-8 py-3.5 text-xl font-black text-slate-950 shadow-xl">
                  Connexion
                </button>
                <button type="button" onClick={() => setAuthMode("register")} className="btn-pop rounded-full border-2 border-white/85 bg-gradient-to-r from-pink-300 to-fuchsia-400 px-8 py-3.5 text-xl font-black text-purple-950 shadow-xl">
                  Créer un compte
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
