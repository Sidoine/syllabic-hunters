import { useEffect, useState } from "react";
import type { Line } from "../data/story";
import { SAY } from "../data/syllables";
import { speak, stopSpeech } from "../lib/speech";

/** Texte pour la voix : retire les sons écrits « ssss » et remplace les syllabes isolées par un homophone fiable. */
export function speakable(text: string) {
	return text
		.replace(/\s*«[^»]*»\s*/g, " ")
		.replace(/[A-Za-zÀ-ÿ]+/g, (w) => {
			const k = w.toLowerCase();
			return SAY[k] ?? w;
		})
		.replace(/\s+([,.!?])/g, "$1")
		.replace(/\s{2,}/g, " ");
}

import {
	BigButton,
	SPEAKER_INFO,
	SpeakButton,
	useGame,
} from "../components/ui";

export function DialogScreen({
	lines,
	title,
	onEnd,
	bossImgStyle,
}: {
	lines: Line[];
	title: string;
	onEnd: () => void;
	bossImgStyle?: React.CSSProperties;
}) {
	const [i, setI] = useState(0);
	const { name, autoRead } = useGame();
	const line = lines[i];
	const text = line.text.replace(/\{nom\}/g, name || "petite star");
	const info = SPEAKER_INFO[line.who];
	const left = line.who !== "king" && line.who !== "boss";

	useEffect(() => {
		if (autoRead) speak(speakable(text));
	}, [text, autoRead]);

	const next = () => {
		stopSpeech();
		if (i + 1 < lines.length) setI(i + 1);
		else onEnd();
	};

	return (
		<div className="min-h-full flex flex-col items-center justify-center px-4 py-8 gap-6">
			<h2 className="text-3xl sm:text-4xl font-bold neon-text text-center">
				{title}
			</h2>
			<div
				key={i}
				className={`flex items-end gap-3 w-full max-w-3xl ${left ? "flex-row" : "flex-row-reverse"}`}
			>
				<img
					src={info.img}
					alt={info.name}
					className={`w-32 h-40 sm:w-48 sm:h-60 object-contain anim-float drop-shadow-[0_0_20px_rgba(255,120,230,0.6)] ${left ? "anim-slideL" : "anim-slideR"}`}
					style={line.who === "boss" ? bossImgStyle : undefined}
				/>
				<div className="flex-1 anim-pop">
					<div
						className="inline-block rounded-full px-4 py-1 mb-2 font-bold text-lg border-2 border-white"
						style={{
							background: info.color,
							color: line.who === "mochi" ? "#3b1a66" : "#fff",
						}}
					>
						{info.name}
					</div>
					<div className="card-kawaii rounded-3xl p-5 text-xl sm:text-2xl font-semibold leading-relaxed relative">
						{text}
						<div className="absolute -bottom-3 -right-3">
							<SpeakButton text={speakable(text)} size="sm" />
						</div>
					</div>
				</div>
			</div>
			<div className="flex gap-3 items-center">
				<span className="text-white/60">
					{i + 1} / {lines.length}
				</span>
				<BigButton color="yellow" onClick={next} className="anim-glow">
					{i + 1 < lines.length ? "Suivant ▶" : "C'est parti ! ⚡"}
				</BigButton>
			</div>
			<button
				type="button"
				onClick={() => {
					stopSpeech();
					onEnd();
				}}
				className="text-white/50 underline text-sm"
			>
				Passer
			</button>
		</div>
	);
}
