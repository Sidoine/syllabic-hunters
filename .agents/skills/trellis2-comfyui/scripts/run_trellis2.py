#!/usr/bin/env python3
"""Upload a reference, configure a TRELLIS.2 UI workflow, run it, and copy its GLB."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


NODE_SPECS = {
    122: ("LoadImage", "image"),
    316: ("PrimitiveBoolean", "value"),
    186: ("DecimateMesh", "target_face_count"),
    147: ("BakeTextureFromVoxel", "texture_size"),
    94: ("Trellis2UpsampleStage", "target_resolution"),
    241: ("RemeshMesh", "resolution"),
    322: ("Save3DAdvanced", "filename_prefix"),
}


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if result.returncode:
        details = "\n".join(part for part in (result.stdout, result.stderr) if part)
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{details}")
    return result.stdout or ""


def node_by_id(workflow: dict[str, Any], node_id: int, expected_type: str) -> dict[str, Any]:
    node = next((item for item in workflow.get("nodes", []) if item.get("id") == node_id), None)
    if node is None or node.get("type") != expected_type:
        raise ValueError(f"Expected node {node_id} to be {expected_type}; template structure changed.")
    return node


def set_widget(workflow: dict[str, Any], node_id: int, expected_type: str, name: str, value: Any) -> None:
    node = node_by_id(workflow, node_id, expected_type)
    node.setdefault("widgets_values_named", {})[name] = value
    # Keep the frontend's positional widget array in sync with its named values.
    values = node.setdefault("widgets_values", [])
    positions = {
        122: {"image": 0},
        316: {"value": 0},
        186: {"target_face_count": 0},
        147: {"texture_size": 0},
        94: {"target_resolution": 0},
        241: {"resolution": 0},
        322: {"filename_prefix": 0},
    }
    index = positions[node_id][name]
    while len(values) <= index:
        values.append(None)
    values[index] = value


def find_prompt_id(payload: Any) -> str | None:
    if isinstance(payload, dict):
        value = payload.get("prompt_id")
        if isinstance(value, str) and value:
            return value
        for child in payload.values():
            found = find_prompt_id(child)
            if found:
                return found
    elif isinstance(payload, list):
        for child in payload:
            found = find_prompt_id(child)
            if found:
                return found
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workflow", required=True, type=Path, help="Pixal3D & TRELLIS.2 UI workflow JSON")
    parser.add_argument("--image", required=True, type=Path, help="ImageGen reference to upload")
    parser.add_argument("--output", required=True, type=Path, help="Destination GLB path")
    parser.add_argument("--prefix", default="3d/game-prop", help="ComfyUI output filename prefix")
    parser.add_argument("--faces", type=int, default=150_000)
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--shape-resolution", type=int, default=1024, help="TRELLIS.2 upsample resolution before remeshing")
    parser.add_argument("--remesh-resolution", type=int, default=384, help="Mesh remesh resolution before decimation")
    parser.add_argument("--timeout", type=int, default=900, help="Maximum quiet time in seconds while waiting for ComfyUI")
    args = parser.parse_args()

    comfy = shutil.which("comfy")
    if not comfy:
        parser.error("The ComfyUI comfy-cli executable was not found on PATH.")
    workflow_path = args.workflow.resolve(strict=True)
    image_path = args.image.resolve(strict=True)
    if not args.output.parent.exists():
        args.output.parent.mkdir(parents=True)

    image_name = image_path.name
    run([comfy, "--json", "upload", "--where", "local", "--overwrite", str(image_path)])

    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    set_widget(workflow, 122, "LoadImage", "image", image_name)
    set_widget(workflow, 316, "PrimitiveBoolean", "value", True)
    set_widget(workflow, 186, "DecimateMesh", "target_face_count", args.faces)
    set_widget(workflow, 147, "BakeTextureFromVoxel", "texture_size", args.texture_size)
    set_widget(workflow, 94, "Trellis2UpsampleStage", "target_resolution", args.shape_resolution)
    set_widget(workflow, 241, "RemeshMesh", "resolution", args.remesh_resolution)
    set_widget(workflow, 322, "Save3DAdvanced", "filename_prefix", args.prefix)

    # Confirm the exact reference and essential settings survived into the file.
    assert workflow["nodes"]
    if node_by_id(workflow, 122, "LoadImage")["widgets_values_named"]["image"] != image_name:
        raise ValueError("The uploaded reference image is not selected in the workflow.")
    with tempfile.TemporaryDirectory(prefix="trellis2-comfy-") as temp_dir:
        configured_workflow = Path(temp_dir) / "workflow.json"
        configured_workflow.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")
        validation = json.loads(
            run([comfy, "--json", "workflow", "validate", "--workflow", str(configured_workflow)], capture=True)
        )
        if validation.get("ok") is not True or validation.get("data", {}).get("valid") is not True:
            raise RuntimeError(f"ComfyUI rejected the configured workflow: {validation}")
        run_output = run([comfy, "--json", "run", "--workflow", str(configured_workflow), "--wait", "--timeout", str(args.timeout)], capture=True)
        prompt_id = find_prompt_id(json.loads(run_output))
        if not prompt_id:
            raise RuntimeError(f"ComfyUI completed but returned no prompt_id: {run_output}")
        downloaded = Path(temp_dir) / "outputs"
        run([comfy, "--json", "download", prompt_id, "--where", "local", "--out-dir", str(downloaded)])
        glbs = list(downloaded.rglob("*.glb"))
        if not glbs:
            raise RuntimeError(f"No GLB was downloaded for prompt {prompt_id}.")
        source_glb = max(glbs, key=lambda path: path.stat().st_mtime)
        optimized_glb = Path(temp_dir) / "optimized.glb"
        npx = shutil.which("npx")
        if not npx:
            raise RuntimeError("npx is required to convert textures to WebP and compress the game mesh with Meshopt.")
        run([npx, "--yes", "@gltf-transform/cli", "optimize", str(source_glb), str(optimized_glb),
             "--texture-compress", "webp", "--texture-size", str(args.texture_size),
             "--compress", "meshopt", "--simplify", "false", "--instance", "false", "--join", "false"])
        shutil.copy2(optimized_glb, args.output)

    print(json.dumps({"prompt_id": prompt_id, "output": str(args.output.resolve())}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Trellis.2 run failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
