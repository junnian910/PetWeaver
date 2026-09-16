# PetWeaver Pet Packages

> Schema status: v0.4 draft · [简体中文](pet-packages.zh-CN.md)

A pet package defines **who the character is and which assets it owns**. PetWeaver owns the window, action scheduler, live events, AI, speech, physics, security boundary, and renderer.

ImageGen may produce character references and action poses, but it does not replace action registration, frame processing, video encoding, runtime binding, or validation.

## Action contract

The source of truth is [`src/main/core/action-registry.js`](../src/main/core/action-registry.js). It contains 44 entries:

- 40 planned character actions.
- Four system extensions: `state_move`, `state_observe`, `state_talking`, and `transition_settle`.
- 43 actions enabled by default.
- `act_intro` retained as a disabled compatibility identifier.

An enabled action should have its own video. If an action genuinely does not apply to a character, the package may declare an explicit fallback. Validators must not silently redirect every missing action to idle.

## Directory layout

```text
my-pet/
  pet.json
  references/
    canonical.png
  frames/
    idle_breath/
      00.png
  videos/
    idle_breath.webm
    <action-id>.webm
  qa/
    validation.json
```

The package directory name must match the manifest `id`.

## Minimal manifest

```json
{
  "schemaVersion": 1,
  "id": "my-pet",
  "displayName": "My Pet",
  "version": "0.1.0",
  "runtime": { "minimumVersion": "0.4.0" },
  "renderer": {
    "type": "video-actions",
    "width": 384,
    "height": 416,
    "fallbackAction": "idle_breath"
  },
  "persona": {
    "prompt": "You are a cheerful desktop companion."
  },
  "expressions": {
    "neutral": "frames/idle_breath/00.png",
    "happy": "frames/emo_happy/00.png"
  },
  "actions": {
    "idle_breath": {
      "asset": "videos/idle_breath.webm",
      "enabled": true,
      "loop": true,
      "fallback": null
    }
  }
}
```

## Required fields

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Manifest schema version. The current draft uses `1`. |
| `id` | Lowercase package identifier and directory name. |
| `displayName` | User-visible character name. |
| `version` | Package version. |
| `runtime.minimumVersion` | Earliest compatible PetWeaver runtime. |
| `renderer` | Renderer type, canvas, and fallback action. |
| `persona.prompt` | Optional character instructions used by the configured LLM. |
| `expressions.neutral` | Required fallback expression image. |
| `actions` | Action asset, loop, enablement, and fallback declarations. |

## Path and resource rules

All `asset` and `expressions` values must be package-relative paths.

The runtime rejects:

- Absolute paths.
- `..` traversal.
- Directory-name and package-ID mismatches.
- Missing enabled-action assets without a valid fallback.
- Fallback cycles.
- Undeclared resources.
- Symlink paths that escape the real package directory.

The renderer accesses package media only through `pet-resource://<pet-id>/...`. The main process resolves that URL against the validated manifest and real package directory. An invalid selected package falls back to the built-in Fafa package and returns a user-visible warning.

## Expression behavior

`expressions.neutral` is required. Missing optional expressions fall back to `neutral`.

Current runtime expression slots include neutral, happy, sad, angry, sleep, and toss-state images. Packages may map multiple slots to the same source image, but the referenced file must exist.

## Video contract

The current video-action renderer expects:

- Canvas: 384 × 416.
- Frame rate: 60 fps.
- Typical duration: 1.6–3.2 seconds.
- Codec/container: VP9 WebM.
- Transparent background / alpha metadata.
- Character placement consistent with the canonical reference.

## Install and switch

1. Open **Settings → Avatar and Motion Capture**.
2. In **PetWeaver pet packages**, select **Open pet package directory**.
3. Copy the package to `<package-root>/<pet-id>/pet.json`.
4. Select **Rescan**.
5. Choose a valid package from the list.

The selected package ID is persisted in public configuration. Invalid or missing packages never prevent startup; the runtime falls back to Fafa.

## Produce a package with Codex

[`skills/petweaver-pixel-pet`](../skills/petweaver-pixel-pet/SKILL.md) reads the real action registry and prepares all 44 production tasks.

The workflow is:

1. Generate or approve one canonical reference.
2. Use `$imagegen` for an eight-pose action sheet per action.
3. Review identity, semantics, 4×2 layout, and background consistency.
4. Extract eight frames and normalize them to the expected working size.
5. Produce preview GIFs for review.
6. Encode transparent VP9 WebM media.
7. Validate action coverage, paths, dimensions, frame rate, duration, and alpha metadata.
8. Load the resulting directory with the real `PetPackageService`.

ImageGen output does not enter the application directly. Only assets that pass deterministic processing and QA are bound to the runtime.

## Current v0.4 implementation

- Manifest validation: `src/main/core/pet-package.js`.
- Discovery and resource isolation: `src/main/pet-package-service.js`.
- Built-in default package: `src/main/pets/fafa.js`.
- Renderer action and expression binding: implemented.
- Active-package persona binding for LLM calls: implemented.
- Settings discovery and selection UI: implemented.

Still planned:

- ZIP install and uninstall.
- Package source/signature warnings.
- Package-version upgrade policy.
- Persona override rules.
- Automated compatibility fixtures for third-party packages.
