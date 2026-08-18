# AGENTS.md — TerraForge (WebGPU Terrain Editor with Erosion)

This file defines how AI coding agents (Windsurf, Devin.ai, or any other
agentic tool) should work in this repository. Read this fully before
making changes.

## Project Summary

TerraForge is a browser-based, GPU-accelerated terrain editor. Core
differentiator: real-time hydraulic erosion simulation running entirely
on the GPU via WebGPU compute shaders. Target users are game studios,
technical artists, and (longer-term) other tool vendors who license the
engine as an SDK. This is NOT a consumer content-creation product first —
it is infrastructure/tooling.

Commercial framing to keep in mind while building: the codebase should
stay cleanly separable into (1) a headless erosion/terrain **engine**
(WGSL compute shaders + a thin TS API) and (2) an **editor UI** that
consumes that engine. This separation is what makes B2B/SDK licensing
possible later — never let editor UI code leak into the engine layer.

## Tech Stack (fixed — do not swap without explicit approval)

- **Language:** TypeScript (strict mode)
- **GPU API:** WebGPU (raw `@webgpu/types`, no third-party WebGPU
  wrapper/engine — we own the render/compute pipeline directly)
- **Shaders:** WGSL
- **Bundler/Dev server:** Vite
- **UI layer:** plain TS + minimal DOM, OR React if UI complexity grows
  (decide in Phase 2, not before)
- **Package manager:** pnpm
- **Testing:** Vitest for logic, manual/visual QA for shader output
  (screenshot diffing is a nice-to-have, not required for MVP)

## Repository Structure (target)

```
/engine
  /shaders          → .wgsl files, one concern per file
  /erosion           → erosion simulation passes (TS orchestration)
  /terrain           → heightmap generation, mesh generation
  /gpu               → device/context setup, pipeline caching, buffer utils
  index.ts           → public engine API surface (this is the SDK boundary)
/editor
  /ui                → brushes, panels, undo stack, export
  /viewport          → camera, render loop, mesh display
  main.ts
/docs
  AGENTS.md
  PRD.md
  TECH_SPEC.md
  PROMPTS.md
```

## Core Simulation Approach (do not re-derive from scratch — follow this)

Use **grid-based shallow-water erosion**, not particle/droplet erosion.
Reason: droplet erosion is inherently sequential per-particle and does
not parallelize cleanly on GPU. Grid-based erosion is fully parallel
across all texels per pass.

Pipeline, per simulation step, each its own compute pass with ping-pong
textures (never read and write the same texture in one pass):

1. **Water increment** — add rain/water source term to water-height field
2. **Flow simulation** — compute outflow to 4 (or 8) neighbor cells based
   on height difference, update velocity field
3. **Water/height update** — apply flow to update water height and
   terrain height via erosion/deposition based on sediment capacity
4. **Sediment transport** — advect sediment field along velocity
5. **Evaporation** — reduce water field by evaporation constant

Textures needed (all `r32float` or packed where sensible):
`terrainHeight`, `waterHeight`, `sediment`, `flow` (vec4 for 4-dir or two
r32float for x/y), `velocity`.

## Non-Negotiable Engineering Rules

- Never do CPU-side per-vertex terrain updates for anything that runs
  every frame or every simulation step — GPU compute only.
- Every compute shader pass must be a separate, named `.wgsl` file. No
  giant mega-shaders.
- Ping-pong buffer/texture pairs must be explicit and named (`*_A`,
  `*_B`), never implicit double-buffering hidden inside a class.
- All simulation parameters (erosion rate, deposition rate, evaporation,
  rain amount, iteration count) must be runtime-tunable uniforms, not
  compile-time constants — the editor needs live sliders for these.
- No WebGL fallback. This project is WebGPU-only by design; do not add
  compatibility shims unless explicitly asked.
- Keep the `/engine` directory free of any DOM/UI code. If you find
  yourself importing UI code into `/engine`, stop and flag it.

## Workflow Expectations for the Agent

- Work in small, reviewable commits. One compute pass or one feature per
  commit, not sweeping multi-file rewrites.
- Before implementing a new erosion pass, write the WGSL shader first as
  a standalone file with a comment header explaining the math, then wire
  it into the TS orchestration.
- Do not invent new dependencies without checking `package.json` first.
- If a task is ambiguous (e.g. brush shape, UI layout), make a
  reasonable default choice, note the assumption in the commit message,
  and move on — do not block on clarifying questions for cosmetic
  details. DO stop and ask if the ambiguity is about the simulation
  math or the engine/editor boundary.
- Follow `TECH_SPEC.md` for architecture decisions and `PRD.md` for
  scope/priority. `PROMPTS.md` contains the phase-by-phase task
  breakdown — work through it in order unless told otherwise.

## Definition of Done (per phase)

A phase is done when:
1. It runs in a browser with WebGPU enabled (Chrome/Edge current stable)
2. There is a visible, working demo of the feature (not just code)
3. No console errors/warnings
4. Simulation parameters are exposed as tunable uniforms where relevant
