# PRD — TerraForge

## Problem

Existing terrain/erosion tools (World Machine, Gaea) are desktop-only,
expensive, and closed. There is no lightweight, embeddable, browser-based
terrain + erosion engine that other tools or studios can integrate
directly (via SDK/API) rather than adopting as a full standalone app.

## Target Users (in priority order)

1. **B2B / SDK licensees** — other gamedev tool vendors, indie
   level-editor projects, no-code game platforms who want erosion-quality
   terrain generation without building it themselves.
2. **Game studios / technical artists** — direct users of the editor UI
   for prototyping and asset generation.
3. (Later, optional) Architecture/landscape visualization, VFX previz.

## Commercial Model (decided direction)

Primary: **B2B SDK/engine licensing** — sell access to `/engine` as a
package (npm package + WGSL shaders), documented API, usage-based or
flat license fee. Studios/tool vendors build their own UI on top.

Secondary: **Editor as demo/lead-gen**, and potentially an Asset
Store-style plugin (Unity/Unreal bridge) as a separate downstream
product once the core engine is proven.

This shapes scope: the `/engine` package must be usable **headlessly**,
with zero editor dependencies, documented with a clean public API
(`index.ts`), from Phase 1 onward — not bolted on later.

## MVP Scope (Phase 1)

- Heightmap generation (noise-based)
- Grid-based hydraulic erosion simulation (see AGENTS.md for the
  algorithm), running as WebGPU compute passes, tunable in real time
- Basic mesh rendering of the terrain (vertex-displacement, single
  material, no texturing yet)
- Minimal editor UI: start/stop/step simulation, sliders for erosion
  parameters, orbit camera
- Export heightmap as PNG

## Phase 2 (post-MVP)

- Brush tools (raise/lower/smooth/flatten) as compute shaders
- Undo stack via heightmap diff snapshots
- Mesh export (glTF)
- Engine packaged as standalone npm module with documented public API
  (this is the SDK deliverable)

## Phase 3 (commercialization-ready)

- API documentation site
- Licensing/auth layer if offered as hosted API rather than npm package
- Example integration ("reference implementation") showing a third
  party embedding the engine

## Explicit Non-Goals (for now)

- No mobile/touch support in MVP
- No multiplayer/collaborative editing
- No texturing/materials system beyond flat shading
- No WebGL fallback

## Success Criteria for MVP

- Erosion simulation runs at interactive rates (target: 512x512
  heightmap, real-time or near-real-time preview) on a mid-range GPU
- Engine code has zero UI/DOM imports (verifiable by a simple lint rule
  or manual check)
- A third party (hypothetically) could import `/engine` and get usable
  terrain output without reading editor code
