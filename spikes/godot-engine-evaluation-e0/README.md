# ENGINE_EVALUATION_E0 — Disposable Technical Fixture

This project answers one question only: can the pinned Godot 4.7.1 Mono toolchain reliably
parse, import, load, render, accept OS-injected input, sample performance, export, launch, and
terminate a synthetic `TileMapLayer` fixture on this Mac?

It is disposable evaluation code, not a product foundation. It contains no gameplay rules,
product map, product UI, plugins, navigation, combat, persistence, networking, or production
assets. The TypeScript simulation remains the only gameplay-rule authority.

Run the scene-load contract with:

```bash
/Volumes/Leo_LLM/Toolchains/NewEra/godot-4.7.1/Godot_mono.app/Contents/MacOS/Godot \
  --headless --path "$PWD" --script res://tests/e0_runner.gd -- \
  --fixture=nominal --output=/private/tmp/e0-scene-manifest.json
```

The project must be archived with its evidence and then discarded or retained only as an
evaluation ref according to the Owner decision.
