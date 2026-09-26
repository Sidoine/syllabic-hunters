import { useEffect, useState } from "react";
import { GameContext, StarField } from "./components/ui";
import { CHAPTERS, MISSIONS, type Mission } from "./data/story";
import { setSfxEnabled } from "./lib/sfx";
import { configureSpeech, stopSpeech } from "./lib/speech";
import {
  getCurrentUser,
  loadRemoteSave,
  logout,
  saveRemoteSave,
  type AuthUser,
} from "./lib/api";
import {
  clearSave,
  defaultSave,
  loadSave,
  type Save,
  type Settings,
  writeSave,
} from "./lib/storage";
import { starsFor } from "./lib/utils";
import { DialogScreen } from "./screens/Dialog";
import { ChapterScreen, chapterMissions, MapScreen } from "./screens/Map";
import { MissionScreen, ResultScreen, SettingsModal } from "./screens/Misc";
import { TitleScreen } from "./screens/Title";

type Screen =
  | { name: "title" }
  | { name: "map" }
  | { name: "chapter"; ch: number }
  | { name: "dialog"; ch: number; kind: "intro" | "outro" }
  | { name: "mission"; id: string; run: number }
  | { name: "result"; id: string; stars: number };

function mergeSaves(local: Save, remote: Save): Save {
  const stars = { ...remote.stars };
  for (const [id, value] of Object.entries(local.stars)) {
    stars[id] = Math.max(stars[id] ?? 0, value);
  }
  return {
    ...remote,
    name: local.name || remote.name,
    hero: local.hero,
    stars,
    seenIntro: { ...remote.seenIntro, ...local.seenIntro },
    seenOutro: { ...remote.seenOutro, ...local.seenOutro },
    settings: local.settings,
  };
}

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>({ name: "title" });
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    writeSave(save);
    if (authReady && user) void saveRemoteSave(save).catch(() => undefined);
  }, [save, authReady, user]);

  useEffect(() => {
    getCurrentUser()
      .then(async ({ user: currentUser }) => {
        setUser(currentUser);
        const remote = await loadRemoteSave();
        const remoteSave = remote.save;
        if (remoteSave) {
          setSave((current) => mergeSaves(current, remoteSave));
        }
      })
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
  }, []);

  const authenticate = async (nextUser: AuthUser) => {
    setAuthReady(false);
    const remote = await loadRemoteSave();
    const remoteSave = remote.save;
    if (remoteSave) setSave((current) => mergeSaves(current, remoteSave));
    setUser(nextUser);
    setAuthReady(true);
  };

  useEffect(() => {
    configureSpeech({
      voiceURI: save.settings.voiceURI,
      rate: save.settings.rate,
    });
    setSfxEnabled(save.settings.sfx);
  }, [save.settings]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const go = (s: Screen) => {
    stopSpeech();
    setScreen(s);
  };

  const openChapter = (ch: number) => {
    if (!save.seenIntro[ch]) go({ name: "dialog", ch, kind: "intro" });
    else go({ name: "chapter", ch });
  };

  const startMission = (m: Mission) =>
    go({ name: "mission", id: m.id, run: Date.now() });

  const finishMission = (m: Mission, errors: number, rounds: number) => {
    const stars = starsFor(errors, rounds);
    setSave((s) => ({
      ...s,
      stars: { ...s.stars, [m.id]: Math.max(s.stars[m.id] ?? 0, stars) },
    }));
    go({ name: "result", id: m.id, stars });
  };

  const updateSettings = (settings: Settings) =>
    setSave((s) => ({ ...s, settings }));

  let content: React.ReactNode = null;
  switch (screen.name) {
    case "title":
      content = (
        <TitleScreen
          save={save}
          user={user}
          onAuthenticated={authenticate}
          onLogout={async () => {
            await logout();
            setUser(null);
          }}
          onSettings={() => setShowSettings(true)}
          onStart={(name, hero) => {
            setSave((s) => ({ ...s, name, hero }));
            if (!save.seenIntro[0])
              go({ name: "dialog", ch: 0, kind: "intro" });
            else go({ name: "map" });
          }}
        />
      );
      break;
    case "map":
      content = (
        <MapScreen
          save={save}
          onChapter={openChapter}
          onBack={() => go({ name: "title" })}
          onSettings={() => setShowSettings(true)}
        />
      );
      break;
    case "chapter":
      content = (
        <ChapterScreen
          save={save}
          chapter={CHAPTERS[screen.ch]}
          onMission={startMission}
          onBack={() => go({ name: "map" })}
          onStory={() => go({ name: "dialog", ch: screen.ch, kind: "intro" })}
        />
      );
      break;
    case "dialog": {
      const ch = CHAPTERS[screen.ch];
      const lines = screen.kind === "intro" ? ch.intro : ch.outro;
      content = (
        <DialogScreen
          key={screen.ch + screen.kind}
          lines={lines}
          title={
            screen.kind === "intro" ? `${ch.title} · ${ch.place}` : "Victoire !"
          }
          onEnd={() => {
            if (screen.kind === "intro") {
              setSave((s) => ({
                ...s,
                seenIntro: { ...s.seenIntro, [screen.ch]: true },
              }));
              go({ name: "chapter", ch: screen.ch });
            } else {
              setSave((s) => ({
                ...s,
                seenOutro: { ...s.seenOutro, [screen.ch]: true },
              }));
              const next = screen.ch + 1;
              if (next < CHAPTERS.length) openChapter(next);
              else go({ name: "map" });
            }
          }}
        />
      );
      break;
    }
    case "mission": {
      const m = MISSIONS.find((x) => x.id === screen.id);
      if (!m) break;
      content = (
        <MissionScreen
          key={screen.run}
          mission={m}
          onDone={(e, r) => finishMission(m, e, r)}
          onQuit={() => go({ name: "chapter", ch: m.chapter })}
        />
      );
      break;
    }
    case "result": {
      const m = MISSIONS.find((x) => x.id === screen.id);
      if (!m) break;
      const list = chapterMissions(m.chapter);
      const idx = list.findIndex((x) => x.id === m.id);
      const isLast = idx === list.length - 1;
      content = (
        <ResultScreen
          mission={m}
          stars={screen.stars}
          isLastOfChapter={isLast}
          onMap={() => go({ name: "map" })}
          onReplay={() => startMission(m)}
          onNext={() => {
            if (isLast) go({ name: "dialog", ch: m.chapter, kind: "outro" });
            else startMission(list[idx + 1]);
          }}
        />
      );
      break;
    }
  }

  return (
    <GameContext.Provider
      value={{
        autoRead: save.settings.autoRead,
        hero: save.hero,
        name: save.name,
      }}
    >
      <div className="bg-night min-h-full relative overflow-x-hidden">
        <StarField />
        <div className="relative z-10 min-h-screen">{content}</div>
        {showSettings && (
          <SettingsModal
            save={save}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
            onReset={() => {
              clearSave();
              setSave(defaultSave());
              setShowSettings(false);
              go({ name: "title" });
            }}
          />
        )}
      </div>
    </GameContext.Provider>
  );
}
