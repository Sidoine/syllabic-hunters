import { useRef, useState } from "react";
import { UI_ICONS } from "../components/ui";
import { COLORING_PAGES, type ColoringPageId } from "../data/coloring";

const COLORS = ["#f43f5e", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#818cf8", "#c084fc", "#a16207", "#334155"];

export function ColoringActivity({ title, pageId, drawingData, completed, onBack, onComplete, onDrawingChange }: {
	title: string;
	pageId: ColoringPageId;
	drawingData?: string;
	completed: boolean;
	onBack: () => void;
	onComplete: () => void;
	onDrawingChange: (drawing: string) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawing = useRef(false);
	const savedDrawing = useRef(drawingData);
	const [color, setColor] = useState(COLORS[0]);
	const [brushSize, setBrushSize] = useState(28);
	const page = COLORING_PAGES[pageId];

	const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = event.currentTarget;
		const rect = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * canvas.width,
			y: ((event.clientY - rect.top) / rect.height) * canvas.height,
		};
	};
	const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = event.currentTarget;
		const context = canvas.getContext("2d");
		if (!context) return;
		canvas.setPointerCapture(event.pointerId);
		drawing.current = true;
		const at = point(event);
		context.beginPath();
		context.moveTo(at.x, at.y);
		context.lineCap = "round";
		context.lineJoin = "round";
		context.lineWidth = brushSize;
		context.strokeStyle = color;
		// Opaque strokes replace earlier strokes, so brushing the same spot again
		// never compounds opacity or darkens the selected color.
		context.globalCompositeOperation = "source-over";
		context.lineTo(at.x + 0.1, at.y + 0.1);
		context.stroke();
	};
	const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (!drawing.current) return;
		const context = event.currentTarget.getContext("2d");
		if (!context) return;
		const at = point(event);
		context.lineTo(at.x, at.y);
		context.stroke();
	};
	const stopDrawing = () => {
		if (!drawing.current) return;
		drawing.current = false;
		const canvas = canvasRef.current;
		canvas?.getContext("2d")?.closePath();
		if (canvas) onDrawingChange(canvas.toDataURL("image/webp", 0.82));
	};
	const clearPage = () => {
		const canvas = canvasRef.current;
		canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
		onDrawingChange("");
	};
	const restoreDrawing = (event: React.SyntheticEvent<HTMLImageElement>) => {
		const image = event.currentTarget;
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		if (!savedDrawing.current) return;
		const saved = new Image();
		saved.onload = () => canvas.getContext("2d")?.drawImage(saved, 0, 0, canvas.width, canvas.height);
		saved.src = savedDrawing.current;
		savedDrawing.current = undefined;
	};

	return (
		<main className="fixed inset-0 z-50 flex flex-col overflow-auto bg-[radial-gradient(ellipse_at_top,#49306c_0%,#211332_55%,#111827_100%)] text-white">
			<header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/15 bg-slate-950/75 px-3 py-2.5 shadow-lg backdrop-blur-xl sm:px-6">
				<button type="button" onClick={onBack} className="btn-pop rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold">← Retour</button>
				<div className="min-w-0 flex-1">
					<div className="truncate text-xs font-semibold text-pink-100">Étape bonus · activité facultative</div>
					<h1 className="truncate text-lg font-extrabold sm:text-xl">{title}</h1>
				</div>
				<img src={UI_ICONS.star} alt="" className="h-9 w-9 object-contain" />
			</header>
			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-5 lg:flex-row">
				<section className="flex min-h-0 flex-1 flex-col items-center gap-3 rounded-[1.7rem] border border-white/15 bg-white/[0.07] p-3 shadow-2xl backdrop-blur sm:p-4">
					<div className="flex w-full flex-wrap items-center justify-between gap-2 px-1">
						<p className="text-sm font-semibold text-white/85">Choisis une couleur, puis dessine sur la feuille.</p>
						<button type="button" onClick={clearPage} className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-bold text-white/75 hover:bg-white/10">Effacer le coloriage</button>
					</div>
					<div className="relative w-fit max-w-full shrink-0 overflow-hidden rounded-xl border-[5px] border-white bg-white shadow-[0_14px_50px_rgba(0,0,0,.45)]" style={{ touchAction: "none" }}>
						<canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} aria-label="Zone de coloriage interactive" />
						<img src={page.src} alt={page.title} onLoad={restoreDrawing} className="pointer-events-none block max-h-[78vh] max-w-full w-auto select-none mix-blend-multiply" draggable={false} />
					</div>
				</section>
				<aside className="flex shrink-0 flex-col gap-4 rounded-[1.7rem] border border-white/15 bg-slate-950/50 p-4 shadow-xl backdrop-blur sm:p-5 lg:w-72">
					<div>
						<h2 className="text-base font-extrabold">Ta palette</h2>
						<div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Couleurs">
							{COLORS.map((swatch) => <button key={swatch} type="button" aria-label={`Choisir la couleur ${swatch}`} aria-pressed={color === swatch} onClick={() => setColor(swatch)} className={`h-10 w-10 rounded-full border-2 shadow-md transition-transform hover:scale-110 ${color === swatch ? "scale-110 border-white ring-2 ring-yellow-200" : "border-white/40"}`} style={{ backgroundColor: swatch }} />)}
						</div>
					</div>
					<div>
						<label htmlFor="brush-size" className="flex items-center justify-between text-sm font-bold"><span>Taille du pinceau</span><span>{brushSize}</span></label>
						<input id="brush-size" type="range" min="10" max="70" step="4" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="mt-2 w-full accent-pink-400" />
					</div>
					<div className="rounded-2xl border border-cyan-100/20 bg-cyan-950/40 p-3 text-sm leading-relaxed text-cyan-50/90">Ce coloriage est une petite pause bonus. Tu peux le terminer plus tard : il ne bloque aucune mission.</div>
					<div className="mt-auto flex flex-col gap-2">
						{completed && <p className="text-center text-sm font-bold text-emerald-200">✓ Coloriage déjà terminé</p>}
						<button type="button" onClick={onComplete} className="btn-pop rounded-2xl border-2 border-emerald-100/70 bg-gradient-to-b from-emerald-400 to-emerald-700 px-5 py-3 font-extrabold text-white shadow-[0_4px_0_#22543a]">{completed ? "Terminer et revenir" : "Terminer le coloriage ✓"}</button>
						<button type="button" onClick={onBack} className="rounded-xl py-2 text-sm font-bold text-white/70 hover:bg-white/10">Je le finirai plus tard</button>
					</div>
				</aside>
			</div>
		</main>
	);
}
