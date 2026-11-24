---
name: trellis2-comfyui
description: Generate and integrate lightweight textured 3D GLB props from ImageGen references with local ComfyUI TRELLIS.2. Use for map assets, signs, vegetation, buildings, and similar game props.
metadata:
  short-description: Generate game props with TRELLIS.2
---

# TRELLIS.2 game props

Create a clean ImageGen reference for one isolated, readable prop, then generate a textured GLB with the local Pixal3D & TRELLIS.2 workflow. Favor simple silhouettes and clear painted details; keep map props inexpensive to render.

## Workflow

1. Call `mcp__comfy_local__server_info` first and confirm the local ComfyUI server is running. Check available VRAM with `system_stats` before a heavy generation.
2. Find the Pixal3D & TRELLIS.2 workflow with `search_templates`, fetch it with `fetch_template`, and verify `local_check.checked` and `local_check.runnable`. If `checked` is false, run `validate_workflow`; do not run a known-unrunnable workflow.
3. Use ImageGen for the reference. Upload that exact image through ComfyUI MCP. Set the workflow input image explicitly and set **Switch to Trellis2** to `true`. Never assume a template slot edit worked: inspect the resulting workflow or prompt preview and confirm the submitted image filename and settings before generation.
4. Use a modest runtime target for game props (typically 50k–150k faces and a 1k texture). Validate the edited workflow, submit with `run_workflow(wait:false)`, poll with `job`, then retrieve the completed outputs with `fetch_outputs`.
5. Inspect the generated 3D preview and GLB before integrating. Keep the original ImageGen reference and record provenance in `public/models/ASSET_PROVENANCE.md`. Use stable, descriptive filenames under `public/models/`.

The helper script `scripts/run_trellis2.py` uploads a reference, edits the known UI-workflow nodes, validates the workflow, runs it, downloads the result, and resizes its baked textures for runtime. It uses the installed `comfy` CLI, which exposes the same local workflow, job, and download operations as the ComfyUI MCP. The Codex MCP connector is injected into the agent session and has no standalone process endpoint; in Codex sessions where `mcp__comfy_local` is available, use those MCP tools for submission and polling, and use the script for repeatable end-to-end local runs.

Example:

```powershell
python .agents/skills/trellis2-comfyui/scripts/run_trellis2.py `
  --workflow .tmp/trellis2-workflow.json `
  --image src/assets/3d/references/direction-signpost-pictograms.png `
  --output public/models/direction-signpost.glb `
  --prefix 3d/direction-signpost
```
