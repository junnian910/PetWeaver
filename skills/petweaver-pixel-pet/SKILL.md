---
name: petweaver-pixel-pet
description: Batch-generate, extract, encode, validate, and package a complete PetWeaver character action set from text or reference images. Use when creating a bindable desktop-pet role with the project's full action registry; defaults to pixel art. Image generation supplies character and action frames, while deterministic scripts own job planning, frame extraction, VP9-alpha video encoding, runtime bindings, and QA.
---

# PetWeaver Pixel Pet

Create a complete character package for the PetWeaver runtime. Do not reduce the task to a small generic sprite sheet: the authoritative action set comes from the target project's `ACTION_REGISTRY`, which currently contains 40 planned actions plus 4 state/transition extensions.

Image generation is only the visual source. The finished result must also pass deterministic extraction, normalization, encoding, manifest binding, and runtime asset checks.

## Visual generation boundary

Use `$imagegen` for the canonical character image and every generated action sheet. Do not call an image API, image CLI, or hard-coded model ID directly. This lets Codex use the GPT Image capability available in the current environment while keeping the package workflow stable across model upgrades.

Use this skill's scripts for deterministic work only:

- read the project's action registry and build the complete job manifest;
- prepare action-specific prompts from the existing storyboard directions;
- split approved action sheets into normalized pixel frames;
- encode frame sequences into `384x416`, 60 fps, VP9-alpha WebM assets;
- validate coverage, metadata, paths, and package bindings.

Never synthesize missing character art with local raster code. Never mark a generated sheet approved before visual inspection.

Before running Python scripts, call `load_workspace_dependencies` and use the exact Python executable it returns. The scripts require Pillow. Video encoding additionally requires FFmpeg with `libvpx-vp9`; prefer the project's existing Remotion compositor FFmpeg or an explicitly configured path.

## Default result

Default to crisp pixel art unless the user asks for another style. Produce one portable role package containing:

```text
<pet-id>/
  pet.json
  jobs.json
  references/canonical.png
  prompts/<action-id>.md
  sheets/<action-id>.png
  frames/<action-id>/00.png ... 07.png
  frames/<action-id>/preview.gif
  videos/<action-id>.webm
  qa/validation.json
```

`pet.json` binds every action ID to a package-local video and binds runtime fallback expressions to transparent package-local images. The disabled registry entry remains listed with `enabled: false`; it is optional to generate unless the user requests complete archival coverage. Every enabled action must have a validated asset or an explicit fallback recorded in the manifest.

## Workflow

1. Prepare a run from the real project registry:

```text
node <SKILL_DIR>/scripts/prepare_run.mjs \
  --project-root <absolute PetWeaver repository> \
  --output-dir <absolute output parent> \
  --pet-id <lowercase-id> \
  --display-name "<name>" \
  --description "<one sentence>"
```

The script imports `src/main/core/action-registry.js` and `scripts/action-video-prompts.js`. It must fail if an enabled action has neither a storyboard direction nor an explicit fallback direction. Do not hand-maintain a shorter action list inside the skill.

2. Generate `references/canonical.png` with `$imagegen` from the user's concept and references. Require one centered, full-body character with stable proportions, readable features, no text, no scenery, no cast shadow, no detached effects, and a perfectly flat `#FF00FF` chroma background. For pixel art, require hard edges, coherent pixel density, and details readable after normalization to a `128x128` frame.

3. Inspect `jobs.json`. Process every enabled action; process disabled actions only when requested. Generate action sheets in bounded batches so failures can be repaired without losing the entire run. Attach `references/canonical.png` to every action-sheet request and use the corresponding generated prompt file.

4. Each action sheet must contain exactly eight sequential full-body poses arranged four columns by two rows, read left-to-right then top-to-bottom. All poses must preserve the canonical face, silhouette, palette, proportions, markings, clothing, and props. The background must remain flat `#FF00FF`. Reject labels, borders, grid lines, pose overlap, cropping, camera changes, shadows, scenery, detached effects, extra characters, or identity drift.

5. Visually approve the complete sheet before extraction. Then run:

```text
<PYTHON> <SKILL_DIR>/scripts/extract_action_sheet.py \
  --input <run>/sheets/<action-id>.png \
  --output-dir <run>/frames/<action-id> \
  --columns 4 --rows 2 --frame-size 128 \
  --chroma "#FF00FF" --strict
```

If a pose crosses a grid boundary or the background cannot be removed cleanly, regenerate the whole action sheet. Do not patch one final frame by drawing, cloning, or borrowing from another action.

6. Inspect `preview.gif`. Require the requested action to read clearly, consistent bottom-center anchoring, stable scale, and a useful progression across all eight poses. Looping actions must close without a visible jump. One-shot actions must start and end close enough to neutral for the runtime transition.

7. Encode each approved action:

```text
<PYTHON> <SKILL_DIR>/scripts/encode_action_video.py \
  --frames-dir <run>/frames/<action-id> \
  --output <run>/videos/<action-id>.webm \
  --ffmpeg <absolute ffmpeg executable> \
  --input-fps 4
```

This produces a two-second pixel animation at the runtime contract of `384x416`, 60 fps, VP9, `yuva420p`, and `alpha_mode=1`.

8. Validate the entire run:

```text
node <SKILL_DIR>/scripts/validate_run.mjs \
  --project-root <absolute PetWeaver repository> \
  --run-dir <absolute pet package> \
  --ffprobe <absolute ffprobe executable>
```

9. Review `qa/validation.json`, every failed preview, and a sample of passing previews across categories. Repair the smallest failing action sheet, re-extract, re-encode, and revalidate. Package only when all required actions pass.

## Action semantics

The action-specific storyboard generated by `prepare_run.mjs` is authoritative. Preserve these general distinctions:

- idle actions are subtle and loopable;
- emotion actions communicate through pose and expression, without floating symbols;
- command actions show the requested physical act rather than generic waving;
- gift, super-chat, guard, and lottery reactions remain visibly distinct;
- `state_move`, `state_observe`, and `state_talking` are loopable system states;
- `transition_settle` resolves gently into the canonical idle pose;
- movement direction is expressed in screen coordinates;
- no action may invent unrelated props merely to make its meaning obvious.

Read [the package and runtime binding contract](references/pet-package-contract.md) when changing manifest fields, fallbacks, renderer dimensions, or action coverage. Read [the action-sheet QA contract](references/action-sheet-qa.md) before accepting or repairing generated sheets.

## Acceptance criteria

- The prepared manifest contains every ID currently present in `ACTION_REGISTRY`.
- Every enabled action has an approved eight-frame source, a validated WebM, or an explicit fallback allowed by the package.
- `pet.json` uses only package-relative paths that stay inside the role directory.
- `expressions.neutral` exists and can be loaded without exposing the original chroma background.
- All required videos are `384x416`, 60 fps, 1.6-3.2 seconds, VP9 with alpha metadata.
- Generated frames preserve one recognizable character and the requested default pixel style.
- Looping animations return to their starting registration; one-shots return close to neutral.
- The role package contains no API keys, cookies, personal logs, caches, or unrelated generation artifacts.
- `qa/validation.json` reports `ok: true` before the package is bound into a `v0.4+` build.
