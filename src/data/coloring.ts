import { assetUrl } from "../lib/assets";
const forestFox = assetUrl("final/rewards/forest-coloring-page.png");
const libraryDragon = assetUrl("final/rewards/library-dragon-coloring-page.png");
const spaceRaccoon = assetUrl("final/rewards/space-raccoon-coloring-page.png");
const oceanMermaid = assetUrl("final/rewards/ocean-mermaid-coloring-page.png");
const gardenRobot = assetUrl("final/rewards/garden-robot-coloring-page.png");
const castlePony = assetUrl("final/rewards/castle-pony-coloring-page.png");
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
