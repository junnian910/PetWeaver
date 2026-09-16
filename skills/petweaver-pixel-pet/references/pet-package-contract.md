# PetWeaver role package contract

The first public contract targets PetWeaver `v0.4.0` and keeps role data separate from the Electron runtime.

## Required files

- `pet.json`: role metadata, renderer declaration, action bindings, and fallbacks.
- `references/canonical.png`: approved visual identity reference used during generation.
- `videos/<action-id>.webm`: package-local runtime assets.
- `jobs.json`: generation provenance and completion state. This may be omitted from a consumer-only distribution after the release is reproducible elsewhere.

## Manifest shape

```json
{
  "schemaVersion": 1,
  "id": "momo",
  "displayName": "Momo",
  "version": "0.1.0",
  "description": "A small pixel cat.",
  "runtime": { "minimumVersion": "0.4.0" },
  "style": { "preset": "pixel-art", "chromaKey": "#FF00FF" },
  "renderer": {
    "type": "video-actions",
    "width": 384,
    "height": 416,
    "fallbackAction": "idle_breath"
  },
  "persona": { "prompt": "" },
  "expressions": {
    "neutral": "frames/idle_breath/00.png",
    "happy": "frames/idle_breath/00.png"
  },
  "actions": {
    "idle_breath": {
      "asset": "videos/idle_breath.webm",
      "category": "idle",
      "loop": true,
      "enabled": true,
      "fallback": null
    }
  }
}
```

## Invariants

- `id` matches `[a-z0-9][a-z0-9-]{0,63}`.
- All asset paths are relative to the package root and may not escape it.
- The manifest contains every action ID in the target runtime registry, including disabled and extension entries.
- Every enabled action has a validated asset unless its `fallback` points to another enabled action that eventually resolves to an asset.
- Fallback chains may not contain cycles.
- `idle_breath` is always present and cannot fall back to another action.
- `expressions.neutral` is required and points to a transparent package-local image. Missing expression names fall back to `neutral`; they do not need separately generated art in the first package version.
- Consumer packages do not contain credentials, user data, prompts containing private information, caches, or temporary media.

The role package owns character-specific visuals and persona. The PetWeaver runtime owns scheduling, input, physics, windows, provider interfaces, live-platform adapters, safety, and secrets.
