# PROMPTS — Devin.ai / Windsurf Task Prompts

Use these in order. Each is meant to be pasted as a single task/session
prompt. They assume the agent has already read `AGENTS.md`, `PRD.md`,
and `TECH_SPEC.md` in this repo (reference them explicitly — Devin and
Windsurf both support repo-context reading, so confirm the agent has
ingested these files before starting Phase 0).

## Where to Run Each Phase

| Phase | Recommended | Why |
|-------|-------------|-----|
| 0 — Scaffold | **Devin Cloud** | Boilerplate, no visual feedback needed, can run autonomously |
| 1 — Heightmap + Static Mesh | **Local (Windsurf)** | Needs real browser + real GPU to visually judge terrain/rendering output |
| 2 — Erosion Simulation | **Local (Windsurf)** | Tuning erosion params requires live visual iteration — this is the core "does it look right" phase |
| 3 — Editor Polish (brushes, undo, export) | **Local (Windsurf)** | Brush feel and undo behavior need hands-on interaction testing |
| 4 — Engine Packaging (SDK) | **Devin Cloud** | Documentation/packaging work, low visual-feedback need, good for autonomous runs |

Rule of thumb: anything where you need to *look at the terrain* to judge
if it's right stays local. Anything that's structural/boilerplate/docs
can go to Devin Cloud to run in parallel while you do other work.

---

## Phase 0 — Project Scaffold
**Run in: Devin Cloud**

```
Read AGENTS.md, PRD.md, and TECH_SPEC.md in this repo before starting.

Set up the project scaffold exactly as described in AGENTS.md's
"Repository Structure" section:
- Vite + TypeScript (strict mode) project
- pnpm as package manager
- /engine and /editor directories as described, with placeholder
  index.ts files
- WebGPU type definitions installed (@webgpu/types)
- A minimal main.ts in /editor that requests a WebGPU adapter/device,
  clears the canvas to a solid color, and confirms the WebGPU context
  initializes without errors — this is just a smoke test, no rendering
  logic yet
- Vitest configured and running (even with zero real tests yet, one
  trivial passing test to confirm the pipeline works)

Do not implement any terrain or erosion logic yet. This phase is
scaffolding only. Definition of done: `pnpm dev` opens a page that
successfully logs "WebGPU device acquired" with no console errors.
```

---

## Phase 1 — Heightmap Generation + Static Mesh Rendering
**Run in: Local (Windsurf)**

```
Read TECH_SPEC.md's GPU Resource Layout and Rendering sections before
starting.

Implement, inside /engine:
- A compute shader (shaders/pass_generateHeightmap.wgsl) that writes
  Perlin or Simplex noise into a terrainHeight r32float texture, given
  a seed and basic noise parameters (frequency, octaves, amplitude)
  as uniforms
- The TS orchestration in /engine/terrain to run this pass and expose
  it via the public API shape defined in TECH_SPEC.md
  (generateHeightmap)

Implement, inside /editor:
- A grid mesh (start with 256x256 or configurable) whose vertices are
  displaced in the vertex shader by sampling the terrainHeight texture
- Flat height-based color ramp fragment shader (low = dark, high =
  light, simple lerp is fine for now)
- An orbit camera so the terrain can be inspected from any angle
- One UI control: a "regenerate" button that re-runs generateHeightmap
  with a new random seed

Do not implement erosion yet. Definition of done: visually inspect a
generated terrain mesh in the browser, regenerate button produces a
new terrain shape each click.
```

---

## Phase 2 — Erosion Simulation
**Run in: Local (Windsurf)**

```
Read TECH_SPEC.md's Compute Pass Order section closely — follow the
five-pass pipeline exactly as specified (addRain, flowSimulation,
updateWaterAndHeight, sedimentAdvection, evaporation), each as its own
named WGSL file with ping-pong texture pairs as specified.

Implement stepErosion(params: ErosionParams) in /engine per the public
API in TECH_SPEC.md. Each call should run one full pass of the five
sub-passes described.

In /editor, add:
- Sliders for all ErosionParams fields (rainAmount, evaporationRate,
  sedimentCapacity, erosionRate, depositionRate)
- A "run erosion" toggle that calls stepErosion every frame while
  active, and updates the rendered mesh live
- A "reset terrain" button

Definition of done: toggling erosion on visibly carves realistic
valley/channel patterns into the generated terrain within a few
seconds, and adjusting sliders visibly changes the erosion behavior in
real time.
```

---

## Phase 3 — Editor Polish (brushes, undo, export)
**Run in: Local (Windsurf)**

```
Read PRD.md's Phase 2 scope before starting.

Implement in /editor:
- Brush tools as compute shaders: raise, lower, smooth, flatten —
  each takes a brush center (UV or texel coords), radius, and
  strength as uniforms, and modifies terrainHeight directly
- Mouse/pointer interaction to paint with the active brush on the
  viewport
- Undo stack: store terrainHeight snapshots as diffs (not full
  texture copies) at each discrete brush stroke or erosion batch;
  cap history depth at a sane default (e.g. 50) and document the
  memory tradeoff in a code comment
- Export button: read terrainHeight back to CPU
  (getHeightmapAsFloatArray) and encode as a 16-bit grayscale PNG
  download

Definition of done: user can paint on the terrain with each brush
type, undo/redo works reliably, and export produces a valid heightmap
PNG that opens correctly in an image viewer.
```

---

## Phase 4 — Engine Packaging (SDK deliverable)
**Run in: Devin Cloud**

```
Read PRD.md's Phase 2/3 scope and TECH_SPEC.md's public API section.

Package /engine as a standalone, publishable npm module:
- Verify zero imports from /editor or any DOM-specific code inside
  /engine (add a lint rule or CI check for this if feasible)
- Write a README for the engine package documenting the public API
  (TerrainEngine interface, ErosionParams, usage example)
- Add a minimal example (examples/headless-usage.ts) showing a
  from-scratch consumer using only the public API to generate and
  erode a terrain, with no editor code involved

This is the deliverable that proves the B2B/SDK licensing model is
technically viable — treat the public API stability and documentation
quality as the primary success criteria for this phase, not new
features.
```

---

## Notes for Handoff Between Windsurf and Devin

- Keep `AGENTS.md` as the single source of truth both tools read —
  don't let tool-specific instructions drift into separate files.
- After each phase, commit with a message referencing the phase number
  (e.g. `Phase 1: heightmap generation + static mesh render`) so
  progress is traceable regardless of which agent did the work.
- If Devin and Windsurf disagree on an implementation detail not
  covered here, the tie-break rule is: whatever TECH_SPEC.md says wins;
  if TECH_SPEC.md is silent, default to whichever choice keeps
  `/engine` more headless/portable.
