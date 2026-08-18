/**
 * Public engine API surface.
 * This file will grow into the SDK boundary; for Phase 0 it is a stub.
 */

export interface NoiseParams {
  seed: number;
  frequency: number;
  octaves: number;
  amplitude: number;
  persistence: number;
  lacunarity: number;
  offsetX: number;
  offsetY: number;
  power: number;
  noiseType: number;
}

export interface ErosionParams {
  rainAmount: number;
  evaporationRate: number;
  sedimentCapacity: number;
  erosionRate: number;
  depositionRate: number;
  iterations: number;
}

export interface TerrainEngine {
  init(device: GPUDevice, size: { width: number; height: number }): void;
  generateHeightmap(seed: number, params: NoiseParams): void;
  stepErosion(params: ErosionParams): void;
  getHeightmapTexture(): GPUTexture;
  getHeightmapAsFloatArray(): Promise<Float32Array>;
  reset(): void;
  destroy(): void;
}

import { createTerrainEngine } from './terrain/terrainEngine';

export function createEngine(): TerrainEngine {
  return createTerrainEngine();
}
