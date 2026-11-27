import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const baseUrl = (process.env.SEAFILE_URL ?? "https://seafile.sidoine.net").replace(/\/$/, "");
const libraryName = process.env.SEAFILE_LIBRARY_NAME ?? "Hunters";
const requestedCommand = process.argv[2];
const finalOnly = ["status-final", "pull-final", "push-final"].includes(requestedCommand);
const localRoot = path.resolve("assets", finalOnly ? "final" : "");
const remoteRootBase = (process.env.SEAFILE_ASSET_PATH ?? "/assets").replace(/\/$/, "") || "/";
const remoteRoot = `${remoteRootBase}${finalOnly ? "/final" : ""}`;
const token = (process.env.SEAFILE_TOKEN ?? "").trim().replace(/^(?:Bearer|Token)\s+/i, "");
const force = process.argv.includes("--force");
const onlyPath = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length).replaceAll("\\", "/");
const command = requestedCommand === "pull-final" ? "pull" : requestedCommand === "push-final" ? "push" : requestedCommand === "status-final" ? "status" : requestedCommand;

function requireConfig() {
	if (!token) throw new Error("SEAFILE_TOKEN est absent. Ajoute-le au fichier .env local.");
}

function apiUrl(endpoint, query = {}) {
	const url = new URL(`/api/v2.1/via-repo-token/${endpoint.replace(/^\//, "")}`, baseUrl);
	for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
	return url;
}

async function api(endpoint, { method = "GET", query, form } = {}) {
	const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
	let body;
	if (form) {
		headers["Content-Type"] = "application/x-www-form-urlencoded";
		body = new URLSearchParams(form);
	}
	let response;
	for (let attempt = 0; ; attempt++) {
		try {
			response = await fetch(apiUrl(endpoint, query), { method, headers, body, redirect: "follow" });
			if ((response.status === 429 || response.status >= 500) && attempt < 3) {
				await response.arrayBuffer();
				await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
				continue;
			}
			break;
		} catch (error) {
			if (attempt >= 3) throw new Error(`Seafile API ${endpoint}: réseau indisponible (${error instanceof Error ? error.message : error}).`);
			await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
		}
	}
	const text = await response.text();
	if (!response.ok) throw new Error(`Seafile API ${method} ${endpoint}: HTTP ${response.status} ${text.slice(0, 300)}`);
	if (!text) return null;
	try { return JSON.parse(text); } catch { return text; }
}

async function listDirectory(remotePath) {
	const result = await api("dir/", { query: { path: remotePath } });
	const items = Array.isArray(result) ? result : result?.dirent_list ?? result?.entries;
	if (!Array.isArray(items)) throw new Error(`Réponse inattendue en listant ${remotePath}.`);
	return items;
}

async function verifyLibrary() {
	const info = await api("repo-info/");
	if (info?.repo_name !== libraryName) {
		throw new Error(`Le jeton pointe vers la bibliothèque « ${info?.repo_name ?? "inconnue"} », attendue : « ${libraryName} ».`);
	}
}

async function listRemoteFiles(remotePath = remoteRoot, relativePath = "") {
	const files = [];
	for (const entry of await listDirectory(remotePath)) {
		const childPath = `${remotePath}/${entry.name}`.replaceAll("//", "/");
		const childRelative = path.posix.join(relativePath, entry.name);
		if (entry.type === "dir" || entry.type === "directory") {
			files.push(...await listRemoteFiles(childPath, childRelative));
		} else if (entry.type === "file") {
			files.push({ path: childRelative, remotePath: childPath, size: Number(entry.size ?? 0) });
		}
	}
	return files;
}

async function listLocalFiles(directory = localRoot, relativePath = "") {
	const files = [];
	let entries;
	try { entries = await readdir(directory, { withFileTypes: true }); }
	catch (error) { if (error?.code === "ENOENT") return files; throw error; }
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		const childRelative = path.join(relativePath, entry.name);
		if (entry.isDirectory()) files.push(...await listLocalFiles(fullPath, childRelative));
		else if (entry.isFile()) files.push({ path: childRelative.split(path.sep).join("/"), fullPath, size: (await stat(fullPath)).size });
	}
	return files;
}

async function ensureRemoteDirectory(remotePath) {
	const parts = remotePath.split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		const parent = current || "/";
		current = `${current}/${part}`;
		try { await listDirectory(current); }
		catch (error) {
			if (!(error instanceof Error) || !/HTTP 404/.test(error.message)) throw error;
			await api("dir/", { method: "POST", query: { path: current }, form: { operation: "mkdir" } });
		}
	}
}

async function downloadFile(file) {
	const result = await api("download-link/", { query: { path: file.remotePath } });
	const downloadUrl = typeof result === "string" ? result : result?.download_link;
	if (!downloadUrl) throw new Error(`Seafile n'a pas renvoyé de lien de téléchargement pour ${file.path}.`);
	const response = await fetch(new URL(downloadUrl, baseUrl));
	if (!response.ok || !response.body) throw new Error(`Téléchargement de ${file.path}: HTTP ${response.status}.`);
	const target = path.join(localRoot, file.path);
	await mkdir(path.dirname(target), { recursive: true });
	await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

async function pushFile(file, uploadLinks) {
	const relativeDirectory = path.posix.dirname(file.path);
	const remoteDirectory = `${remoteRoot}/${relativeDirectory === "." ? "" : `${relativeDirectory}/`}`.replaceAll("//", "/");
	const curl = process.platform === "win32" ? "curl.exe" : "curl";
	for (let attempt = 0; attempt < 4; attempt++) {
		if (!uploadLinks.has(remoteDirectory)) {
			const result = await api("upload-link/", { query: { path: remoteDirectory } });
			uploadLinks.set(remoteDirectory, typeof result === "string" ? result : result?.upload_link);
		}
		const uploadUrl = uploadLinks.get(remoteDirectory);
		if (!uploadUrl) throw new Error(`Lien d'envoi manquant pour ${remoteDirectory}.`);
		const result = spawnSync(curl, [
			"--fail-with-body", "--silent", "--show-error",
			"-F", `file=@${file.fullPath}`,
			"-F", `parent_dir=${remoteDirectory}`,
			"-F", "replace=1",
			uploadUrl,
		], { encoding: "utf8", maxBuffer: 1024 * 1024 });
		if (result.error) throw result.error;
		if (result.status === 0) return;
		uploadLinks.delete(remoteDirectory);
		if (attempt === 3) throw new Error(`Envoi échoué pour ${file.path}: ${result.stderr || result.stdout}`);
		await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
	}
}

async function main() {
	requireConfig();
	if (!["status", "status-final", "push", "push-final", "pull", "pull-final"].includes(requestedCommand)) {
		throw new Error("Usage: npm run assets:seafile -- status|status-final|push|push-final|pull|pull-final [--force]");
	}
	await verifyLibrary();
	let localFiles = await listLocalFiles();
	const localByPath = new Map(localFiles.map((file) => [file.path, file]));
	let remoteFiles = [];
	try { remoteFiles = await listRemoteFiles(); }
	catch (error) {
		if (!(error instanceof Error) || !/HTTP 404/.test(error.message)) throw error;
	}
	if (onlyPath) {
		localFiles = localFiles.filter((file) => file.path === onlyPath);
		remoteFiles = remoteFiles.filter((file) => file.path === onlyPath);
	}
	const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file]));

	if (command === "status") {
		const missingRemote = localFiles.filter((file) => !remoteByPath.has(file.path) || remoteByPath.get(file.path).size !== file.size);
		const missingLocal = remoteFiles.filter((file) => !localByPath.has(file.path) || localByPath.get(file.path).size !== file.size);
		console.log(`Local : ${localFiles.length} fichiers. Seafile : ${remoteFiles.length} fichiers.`);
		console.log(`À envoyer : ${missingRemote.length}. À récupérer ou mettre à jour : ${missingLocal.length}.`);
		for (const file of missingRemote.slice(0, 15)) console.log(`  → ${file.path}`);
		return;
	}

	if (command === "push") {
		const queue = localFiles.filter((file) => force || !remoteByPath.has(file.path) || remoteByPath.get(file.path).size !== file.size);
		const directories = new Set(queue.map((file) => path.posix.dirname(file.path)));
		for (const directory of directories) await ensureRemoteDirectory(`${remoteRoot}/${directory === "." ? "" : directory}`);
		const uploadLinks = new Map();
		for (let index = 0; index < queue.length; index++) {
			const file = queue[index];
			console.log(`[${index + 1}/${queue.length}] ${file.path} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
			await pushFile(file, uploadLinks);
		}
		console.log(`Transfert terminé : ${queue.length} fichiers envoyés vers ${remoteRoot}.`);
		return;
	}

	const queue = remoteFiles.filter((file) => force || !localByPath.has(file.path) || localByPath.get(file.path).size !== file.size);
	for (let index = 0; index < queue.length; index++) {
		const file = queue[index];
		console.log(`[${index + 1}/${queue.length}] ${file.path} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
		await downloadFile(file);
	}
	console.log(`Synchronisation terminée : ${queue.length} fichiers récupérés dans ${localRoot}.`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
