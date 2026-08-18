# TECH_SPEC — TerraForge Engine

## Engine/Editor Boundary (critical — see AGENTS.md)

`/engine/index.ts` is the only file the editor (or any external
consumer) is allowed to import from. Everything else in `/engine` is
private implementation detail and can be refactored freely as long as
the public API surface stays stable.

Public API (initial shape — refine as needed, keep documented):

```ts
export interface TerrainEngine {
  init(device: GPUDevice, size: { width: number; height: number }): void;
  generateHeightmap(seed: number, params: NoiseParams): void;
  stepErosion(params: ErosionParams): void; // one simulation step
  getHeightmapTexture(): GPUTexture;
  getHeightmapAsFloatArray(): Promise<Float32Array>;
  reset(): void;
  destroy(): void;
}

export interface ErosionParams {
  rainAmount: number;
  evaporationRate: number;
  sedimentCapacity: number;
  erosionRate: number;
  depositionRate: number;
  iterations: number;
}
```

## GPU Resource Layout

| Texture         | Format     | Purpose                              |
|-----------------|-----------|----------------------------------------|
| terrainHeight_A/B | r32float | terrain elevation (ping-pong)          |
| waterHeight_A/B   | r32float | standing water depth (ping-pong)       |
| sediment_A/B      | r32float | suspended sediment amount (ping-pong)  |
| flow              | rgba32float | outflow to 4 neighbors (or 2x r32float for 8-dir) |
| velocity           | rg32float | water velocity field (for sediment advection) |

All textures sized to heightmap resolution. Bind groups should be
pre-built once per ping-pong pair and swapped by index, not rebuilt
per-frame.

## Compute Pass Order (per simulation step)

1. `pass_addRain.wgsl` — waterHeight += rainAmount
2. `pass_flowSimulation.wgsl` — compute flow field from height gradients
   (terrain + water), update velocity
3. `pass_updateWaterAndHeight.wgsl` — apply flow to waterHeight, compute
   erosion/deposition against terrainHeight based on sediment capacity
   (function of velocity magnitude and local slope)
4. `pass_sedimentAdvection.wgsl` — move sediment field along velocity
5. `pass_evaporation.wgsl` — waterHeight *= (1 - evaporationRate)

Each pass reads from the "current" ping-pong index and writes to the
"next" index; swap indices after each pass completes.

## Rendering (editor-side, not engine-side)

- Vertex shader samples `terrainHeight` texture to displace a flat grid
  mesh (grid resolution can be lower than sim resolution — decouple
  these two from the start)
- Fragment shader: flat shading with a simple height-based color ramp
  for MVP (real materials are Phase 2+)

## Open Technical Questions (resolve during Phase 1, not before)

- Exact neighbor scheme: 4-direction vs 8-direction flow (start with 4,
  it's simpler and the visual difference is usually acceptable)
- Boundary conditions at heightmap edges (clamp vs wrap — clamp is the
  sane default for a terrain editor)
- Whether erosion runs continuously (every render frame) or as discrete
  stepped batches the user triggers — MVP should support both via the
  `iterations` param in `stepErosion`
