import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooksDirectory = path.join(repositoryRoot, ".githooks");

try {
	execFileSync(
		"git",
		["-C", repositoryRoot, "config", "--local", "core.hooksPath", hooksDirectory],
		{ stdio: "inherit" },
	);
	console.log(`Hooks Git installés depuis ${hooksDirectory}`);
} catch (error) {
	if (error?.status !== 128 && error?.code !== "ENOENT") throw error;
	console.log("Installation des hooks ignorée : ce dossier n'est pas un clone Git.");
}
