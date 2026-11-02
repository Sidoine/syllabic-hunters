import { UI_ICONS } from "../components/ui";
import { MATH_MISSIONS } from "../data/math";
import { MISSIONS } from "../data/story";
import type { Save } from "../lib/storage";

export function MapSelectScreen({
	save,
	onReading,
	onMath,
	onSettings,
}: {
	save: Save;
	onReading: () => void;
	onMath: () => void;
	onSettings: () => void;
}) {
	const readingStars = MISSIONS.reduce(
		(total, mission) => total + (save.stars[mission.id] ?? 0),
		0,
	);
	const readingDone = MISSIONS.filter((mission) => (save.stars[mission.id] ?? 0) > 0).length;
	const mathStars = MATH_MISSIONS.reduce(
		(total, mission) => total + (save.stars[mission.id] ?? 0),
		0,
	);
	const mathDone = MATH_MISSIONS.filter((mission) => (save.stars[mission.id] ?? 0) > 0).length;

	return (
		<div className="min-h-full px-4 py-8 max-w-4xl mx-auto flex flex-col gap-6">
			<header className="flex items-center justify-between">
				<div>
					<div className="text-sm sm:text-base tracking-[0.2em] text-cyan-200 font-bold">
						{save.name ? `À TOI DE JOUER, ${save.name.toLocaleUpperCase()} !` : "À TOI DE JOUER !"}
					</div>
					<h1 className="text-3xl sm:text-4xl font-bold neon-text">Choisis ta carte</h1>
				</div>
				<button
					type="button"
					onClick={onSettings}
					aria-label="Réglages"
					className="btn-pop glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0"
				>
					<img src={UI_ICONS.settings} alt="" className="w-9 h-9 object-contain" />
				</button>
			</header>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<button
					type="button"
					onClick={onReading}
					className="btn-pop card-kawaii rounded-[2rem] p-5 sm:p-6 flex flex-col items-center text-center gap-3 min-h-72"
				>
					<img src={UI_ICONS.book} alt="" className="w-28 h-28 object-contain" />
					<div>
						<h2 className="text-2xl font-bold text-purple-950">Carte des concerts</h2>
						<p className="text-purple-900/80">Chasse aux syllabes et aux mots</p>
					</div>
					<Progress stars={readingStars} done={readingDone} total={MISSIONS.length} />
					<span className="font-bold text-fuchsia-700">Continuer la lecture →</span>
				</button>

				<button
					type="button"
					onClick={onMath}
					className="btn-pop card-kawaii rounded-[2rem] p-5 sm:p-6 flex flex-col items-center text-center gap-3 min-h-72"
				>
					<img src={UI_ICONS.math} alt="" className="w-28 h-28 object-contain" />
					<div>
						<h2 className="text-2xl font-bold text-purple-950">Carte des batailles</h2>
						<p className="text-purple-900/80">Additions, soustractions et compléments à 10</p>
						<p className="text-sm text-purple-900/70">Des défis adaptés au CP, jusqu'à 20</p>
					</div>
					<Progress stars={mathStars} done={mathDone} total={MATH_MISSIONS.length} />
					<span className="font-bold text-fuchsia-700">Partir à la bataille →</span>
				</button>
			</div>
		</div>
	);
}

function Progress({ stars, done, total }: { stars: number; done: number; total: number }) {
	return (
		<div className="flex items-center justify-center gap-1 text-purple-900 font-bold">
			<img src={UI_ICONS.star} alt="" className="w-5 h-5 object-contain" />
			{stars} étoiles · {done}/{total} missions
		</div>
	);
}
