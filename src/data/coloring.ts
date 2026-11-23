import forestFox from "../assets/rewards/forest-coloring-page.png";
import libraryDragon from "../assets/rewards/library-dragon-coloring-page.png";
import spaceRaccoon from "../assets/rewards/space-raccoon-coloring-page.png";
import oceanMermaid from "../assets/rewards/ocean-mermaid-coloring-page.png";
import gardenRobot from "../assets/rewards/garden-robot-coloring-page.png";
import castlePony from "../assets/rewards/castle-pony-coloring-page.png";
import type { Save } from "../lib/storage";

export const COLORING_PAGES = {
	"forest-fox": { src: forestFox, title: "Le renard dans la clairière" },
	"library-dragon": { src: libraryDragon, title: "Le dragon de la bibliothèque" },
	"space-raccoon": { src: spaceRaccoon, title: "Le raton laveur astronaute" },
	"ocean-mermaid": { src: oceanMermaid, title: "La sirène et les trésors marins" },
	"garden-robot": { src: gardenRobot, title: "Le robot au jardin" },
	"castle-pony": { src: castlePony, title: "Le poney du château" },
} as const;

export type ColoringPageId = keyof typeof COLORING_PAGES;

export function coloringPageForReward(save: Save, rewardId: string): ColoringPageId | null {
	const assigned = save.rewardPages?.[rewardId] as ColoringPageId | undefined;
	if (assigned && assigned in COLORING_PAGES) return assigned;
	const used = new Set(Object.values(save.rewardPages ?? {}));
	return (Object.keys(COLORING_PAGES) as ColoringPageId[]).find((pageId) => !used.has(pageId)) ?? null;
}
