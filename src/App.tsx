import { useEffect, useState } from "react";
import { GameContext, StarField } from "./components/ui";
import { CHAPTERS, MISSIONS, WORLD_INTRO_LINES, type Mission } from "./data/story";
import { MATH_CHAPTERS, MATH_MISSIONS, mathChapterMissions, type MathMission } from "./data/math";
import { setSfxEnabled } from "./lib/sfx";
import { configureSpeech, stopSpeech } from "./lib/speech";
import {
  getCurrentUser,
  loadRemoteSave,
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
import { ChapterScreen, chapterMissions } from "./screens/Map";
import { MissionScreen, ResultScreen, SettingsModal } from "./screens/Misc";
import { MapSelectScreen, type MapStageSelection } from "./screens/MapSelect";
import { MathChapterScreen, MathMissionExercise, MathResultScreen } from "./screens/Math";
import { TitleScreen } from "./screens/Title";
import { VoiceReview } from "./screens/VoiceReview";
import { ColoringActivity } from "./screens/ColoringActivity";
import { coloringPageForReward, type ColoringPageId } from "./data/coloring";

type Screen =
  | { name: "title" }
  | { name: "maps" }
  | { name: "map-intro-world" }
  | { name: "map-intro-chapter"; ch: number }
  | { name: "math-chapter"; ch: number; award?: { id: string; stars: number } }
  | { name: "math-mission"; id: string; run: number }
  | { name: "math-result"; id: string; stars: number }
  | { name: "coloring"; id: string; pageId: ColoringPageId; title: string; returnTo: { name: "chapter" | "math-chapter"; ch: number } }
  | { name: "chapter"; ch: number; award?: { id: string; stars: number } }
  | { name: "world-intro" }
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
    // The account save owns the player's identity. Local progress can still
    // add stars and story flags without replacing its name or character.
    name: remote.name || local.name,
    hero: remote.hero,
    // A legacy remote save was created after the old character picker, so
    // treat it as an existing choice when the new flag is absent.
    heroChosen: remote.heroChosen ?? true,
    stars,
    rewards: { ...remote.rewards, ...local.rewards },
    rewardPages: { ...remote.rewardPages, ...local.rewardPages },
    rewardDrawings: { ...remote.rewardDrawings, ...local.rewardDrawings },
    seenIntro: { ...remote.seenIntro, ...local.seenIntro },
    seenOutro: { ...remote.seenOutro, ...local.seenOutro },
    settings: local.settings,
  };
}

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>({ name: "title" });
  const [showSettings, setShowSettings] = useState(false);
  const [mapStage, setMapStage] = useState<MapStageSelection | null>(null);
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

  const authenticate = async (
    nextUser: AuthUser,
    profile: { name: string; hero: Save["hero"] },
  ) => {
    setAuthReady(false);
    const remote = await loadRemoteSave();
    const remoteSave = remote.save;
    setSave((current) =>
      remoteSave
        ? mergeSaves(current, remoteSave)
        : { ...current, name: profile.name, hero: profile.hero },
    );
    setUser(nextUser);
    setAuthReady(true);
    setScreen({ name: "title" });
  };

  useEffect(() => {
    configureSpeech({
      voiceURI: save.settings.voiceURI,
      rate: save.settings.rate,
      masculine: save.hero === "milo",
    });
    setSfxEnabled(save.settings.sfx);
  }, [save.settings, save.hero]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const go = (s: Screen) => {
    stopSpeech();
    setScreen(s);
  };

  const openChapter = (ch: number) => {
    if (!save.seenIntro[ch]) {
      setMapStage({ region: "reading", chapter: ch });
      go({ name: "map-intro-chapter", ch });
    }
    else go({ name: "chapter", ch });
  };

  const renderMap = (intro?: { title: string; lines: typeof WORLD_INTRO_LINES; onEnd: () => void }, backgroundOnly = false) => (
    <MapSelectScreen
      save={save}
      selection={mapStage}
      onHeroChange={async (hero) => {
        const nextSave = { ...save, hero, heroChosen: true };
        setSave(nextSave);
        if (user) await saveRemoteSave(nextSave);
        configureSpeech({ masculine: hero === "milo" });
      }}
      onSelectStage={setMapStage}
      onReading={openChapter}
      onMath={(chapter) => go({ name: "math-chapter", ch: chapter })}
      onWorldIntro={() => go({ name: "map-intro-world" })}
      onSettings={() => setShowSettings(true)}
      intro={intro ? { title: intro.title, lines: intro.lines } : undefined}
      onIntroEnd={intro?.onEnd}
      backgroundOnly={backgroundOnly}
    />
  );

  const startMission = (m: Mission) =>
    go({ name: "mission", id: m.id, run: Date.now() });

  const finishMission = (m: Mission, errors: number, rounds: number) => {
    const stars = starsFor(errors, rounds);
    const earnedStars = Math.max(0, stars - (save.stars[m.id] ?? 0));
    setSave((s) => ({
      ...s,
      stars: { ...s.stars, [m.id]: Math.max(s.stars[m.id] ?? 0, stars) },
    }));
    go({ name: "chapter", ch: m.chapter, award: earnedStars > 0 ? { id: m.id, stars: earnedStars } : undefined });
  };

  const startMathMission = (mission: MathMission) =>
    go({ name: "math-mission", id: mission.id, run: Date.now() });

  const startColoring = (id: string, title: string, returnTo: { name: "chapter" | "math-chapter"; ch: number }) => {
    const pageId = coloringPageForReward(save, id);
    if (!pageId || save.rewards?.[id]) return;
    setSave((current) => ({ ...current, rewardPages: { ...current.rewardPages, [id]: pageId } }));
    go({ name: "coloring", id, pageId, title, returnTo });
  };

  const finishMathMission = (mission: MathMission, errors: number, rounds: number) => {
    const stars = starsFor(errors, rounds);
    const earnedStars = Math.max(0, stars - (save.stars[mission.id] ?? 0));
    setSave((current) => ({
      ...current,
      stars: { ...current.stars, [mission.id]: Math.max(current.stars[mission.id] ?? 0, stars) },
    }));
    go({ name: "math-chapter", ch: mission.chapter, award: earnedStars > 0 ? { id: mission.id, stars: earnedStars } : undefined });
  };

  const updateSettings = (settings: Settings) =>
    setSave((s) => ({ ...s, settings }));

  if (new URLSearchParams(window.location.search).has("voice-review")) {
    return <VoiceReview />;
  }

  let content: React.ReactNode = null;
  let mapIntro: { title: string; lines: typeof WORLD_INTRO_LINES; onEnd: () => void } | undefined;
  switch (screen.name) {
    case "title":
      content = (
        <TitleScreen
          save={save}
          user={user}
          authReady={authReady}
          onAuthenticated={authenticate}
          onPlay={() => go({ name: "maps" })}
        />
      );
      break;
    case "maps":
      break;
    case "map-intro-chapter": {
      const ch = CHAPTERS[screen.ch];
      mapIntro = {
        title: `${ch.title} · ${ch.place}`,
        lines: ch.intro,
        onEnd: () => {
          setSave((current) => ({ ...current, seenIntro: { ...current.seenIntro, [screen.ch]: true } }));
          go({ name: "chapter", ch: screen.ch });
        },
      };
      break;
    }
    case "map-intro-world":
      mapIntro = {
        title: "Le carrefour des découvertes",
        lines: WORLD_INTRO_LINES,
        onEnd: () => {
          setSave((current) => ({ ...current, seenIntro: { ...current.seenIntro, [-1]: true } }));
          go({ name: "maps" });
        },
      };
      break;
    case "chapter":
      content = (
        <ChapterScreen
          save={save}
          chapter={CHAPTERS[screen.ch]}
          award={screen.award}
          onMission={startMission}
          onBack={() => go({ name: "maps" })}
          onStory={() => {
            setMapStage({ region: "reading", chapter: screen.ch });
            go({ name: "map-intro-chapter", ch: screen.ch });
          }}
          onSettings={() => setShowSettings(true)}
          onReward={() => startColoring(`reading-coloring-${screen.ch}`, `Coloriage · ${CHAPTERS[screen.ch].place}`, { name: "chapter", ch: screen.ch })}
        />
      );
      break;
    case "math-chapter":
      content = (
        <MathChapterScreen
          save={save}
          chapter={MATH_CHAPTERS[screen.ch]}
          award={screen.award}
          onMission={startMathMission}
          onBack={() => go({ name: "maps" })}
          onSettings={() => setShowSettings(true)}
          onReward={() => startColoring(`math-coloring-${screen.ch}`, `Coloriage · ${MATH_CHAPTERS[screen.ch].place}`, { name: "math-chapter", ch: screen.ch })}
        />
      );
      break;
    case "coloring":
      content = (
        <ColoringActivity
          title={screen.title}
          pageId={screen.pageId}
          drawingData={save.rewardDrawings?.[screen.id]}
          completed={Boolean(save.rewards?.[screen.id])}
          onBack={() => go(screen.returnTo)}
          onDrawingChange={(drawing) => setSave((current) => ({ ...current, rewardDrawings: { ...current.rewardDrawings, [screen.id]: drawing } }))}
          onComplete={() => {
            setSave((current) => ({ ...current, rewards: { ...current.rewards, [screen.id]: true } }));
            go(screen.returnTo);
          }}
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
              else go({ name: "maps" });
            }
          }}
        />
      );
      break;
    }
    case "world-intro": {
      content = (
        <DialogScreen
          key="world-intro"
          lines={WORLD_INTRO_LINES}
          title="Le carrefour des découvertes"
          onEnd={() => {
            setSave((current) => ({
              ...current,
              seenIntro: { ...current.seenIntro, [-1]: true },
            }));
            go({ name: "maps" });
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
    case "math-mission": {
      const mission = MATH_MISSIONS.find((item) => item.id === screen.id);
      if (!mission) break;
      content = (
        <MathMissionExercise
          key={screen.run}
          mission={mission}
          onDone={(errors, rounds) => finishMathMission(mission, errors, rounds)}
          onQuit={() => go({ name: "math-chapter", ch: mission.chapter })}
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
          onMap={() => go({ name: "maps" })}
          onReplay={() => startMission(m)}
          onNext={() => {
            if (isLast) go({ name: "dialog", ch: m.chapter, kind: "outro" });
            else startMission(list[idx + 1]);
          }}
        />
      );
      break;
    }
    case "math-result": {
      const mission = MATH_MISSIONS.find((item) => item.id === screen.id);
      if (!mission) break;
      const list = mathChapterMissions(mission.chapter);
      const idx = list.findIndex((item) => item.id === mission.id);
      const isLastOfChapter = idx === list.length - 1;
      content = (
        <MathResultScreen
          mission={mission}
          stars={screen.stars}
          isLastOfChapter={isLastOfChapter}
          onMap={() => go({ name: "maps" })}
          onReplay={() => startMathMission(mission)}
          onNext={() => {
            const next = list[idx + 1];
            if (next) startMathMission(next);
            else go({ name: "maps" });
          }}
        />
      );
      break;
    }
  }

  const mapPrimaryScreens = ["maps", "map-intro-world", "map-intro-chapter"];
  const mapOverlayScreens = ["chapter", "math-chapter", "mission", "math-mission", "coloring", "result", "math-result"];
  const mapIsPrimary = mapPrimaryScreens.includes(screen.name);
  const showMapBackdrop = mapOverlayScreens.includes(screen.name);

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
        <div className="relative z-10 min-h-screen">
          {screen.name !== "title" && renderMap(mapIntro, !mapIsPrimary)}
          {showMapBackdrop ? <div className="fixed inset-0 z-[60] overflow-auto overscroll-contain">
            <div className="pointer-events-none fixed inset-0 bg-slate-950/55 backdrop-blur-[3px]" aria-hidden="true" />
            <div className="relative z-10 min-h-full">{content}</div>
          </div> : content}
        </div>
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
