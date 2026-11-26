import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const staticAssetRoots = [
  { urlPrefix: "/models/", directory: path.resolve(__dirname, "assets/final/models") },
  { urlPrefix: "/textures/", directory: path.resolve(__dirname, "assets/final/textures") },
  { urlPrefix: "/videos/", directory: path.resolve(__dirname, "assets/final/videos") },
  { urlPrefix: "/assets/final/", directory: path.resolve(__dirname, "assets/final") },
  { urlPrefix: "/assets/input/references/", directory: path.resolve(__dirname, "assets/input/references") },
  { urlPrefix: "/assets/work/cartoon-studio/", directory: path.resolve(__dirname, "assets/work/cartoon-studio") },
  { urlPrefix: "/favicon.png", directory: path.resolve(__dirname, "assets/final"), singleFile: true },
];

const contentTypes: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

function repositoryStaticAssets(): Plugin {
  return {
    name: "repository-static-assets",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const root = staticAssetRoots.find(({ urlPrefix, singleFile }) =>
          singleFile ? pathname === urlPrefix : pathname.startsWith(urlPrefix),
        );
        if (!root) return next();

        const relativePath = root.singleFile ? "favicon.png" : decodeURIComponent(pathname.slice(root.urlPrefix.length));
        const filePath = path.resolve(root.directory, relativePath);
        if (!filePath.startsWith(`${root.directory}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        const { size } = fs.statSync(filePath);
        response.setHeader("Content-Type", contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Accept-Ranges", "bytes");
        const range = request.headers.range;
        if (range) {
          const [startText, endText] = range.replace(/^bytes=/, "").split("-");
          const start = Number(startText);
          const end = endText ? Number(endText) : size - 1;
          if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end < size && start <= end) {
            response.statusCode = 206;
            response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
            response.setHeader("Content-Length", end - start + 1);
            fs.createReadStream(filePath, { start, end }).pipe(response);
            return;
          }
        }
        response.setHeader("Content-Length", size);
        fs.createReadStream(filePath).pipe(response);
      });
    },
    generateBundle() {
      const emittedFiles = new Set<string>();
      for (const { urlPrefix, directory, singleFile } of staticAssetRoots) {
        const addFile = (filePath: string, outputPath: string) => {
          const normalizedPath = path.resolve(filePath).toLocaleLowerCase("en-US");
          if (emittedFiles.has(normalizedPath)) return;
          emittedFiles.add(normalizedPath);
          this.emitFile({ type: "asset", fileName: outputPath, source: fs.readFileSync(filePath) });
        };
        if (singleFile) {
          const faviconPath = path.join(directory, "favicon.png");
          if (fs.existsSync(faviconPath)) addFile(faviconPath, "favicon.png");
          continue;
        }
        if (!fs.existsSync(directory)) continue;
        const walk = (currentDirectory: string, relativeDirectory = "") => {
          for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
            const relativePath = path.join(relativeDirectory, entry.name);
            const filePath = path.join(currentDirectory, entry.name);
            if (entry.isDirectory()) walk(filePath, relativePath);
            else addFile(filePath, `${urlPrefix.slice(1)}${relativePath.split(path.sep).join("/")}`);
          }
        };
        walk(directory);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss(), repositoryStaticAssets(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 64786,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
