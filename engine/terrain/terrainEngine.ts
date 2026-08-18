/// <reference path="../wgsl.d.ts" />

import type { NoiseParams, ErosionParams, TerrainEngine } from '../index';
import generateHeightmapWGSL from '../shaders/pass_generateHeightmap.wgsl?raw';

const PARAMS_SIZE = 64;

export function createTerrainEngine(): TerrainEngine {
  return new TerrainEngineImpl();
}

class TerrainEngineImpl implements TerrainEngine {
  private device: GPUDevice | null = null;
  private width = 0;
  private height = 0;
  private heightA: GPUTexture | null = null;
  private heightB: GPUTexture | null = null;
  private paramsBuffer: GPUBuffer | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private bindGroupA: GPUBindGroup | null = null;
  private bindGroupB: GPUBindGroup | null = null;

  init(device: GPUDevice, size: { width: number; height: number }): void {
    this.device = device;
    this.width = size.width;
    this.height = size.height;

    this.heightA = this.createHeightTexture();
    this.heightB = this.createHeightTexture();

    this.paramsBuffer = device.createBuffer({
      size: PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '2d' },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({ code: generateHeightmapWGSL }),
        entryPoint: 'main',
      },
    });

    this.bindGroupA = this.createBindGroup(this.heightA);
    this.bindGroupB = this.createBindGroup(this.heightB);
  }

  private createHeightTexture(): GPUTexture {
    if (!this.device) {
      throw new Error('TerrainEngine not initialized');
    }
    return this.device.createTexture({
      size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
      dimension: '2d',
      format: 'r32float',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
      sampleCount: 1,
    });
  }

  private createBindGroup(texture: GPUTexture): GPUBindGroup {
    if (!this.device || !this.paramsBuffer || !this.bindGroupLayout) {
      throw new Error('TerrainEngine not initialized');
    }
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: texture.createView() },
      ],
    });
  }

  generateHeightmap(seed: number, params: NoiseParams): void {
    if (!this.device || !this.paramsBuffer || !this.pipeline || !this.bindGroupA) {
      throw new Error('TerrainEngine not initialized');
    }

    const data = new Float32Array([
      seed,
      params.frequency,
      params.octaves,
      params.amplitude,
      this.width,
      this.height,
      params.persistence,
      params.lacunarity,
      params.offsetX,
      params.offsetY,
      params.power,
      params.noiseType,
      0.0,
      0.0,
      0.0,
      0.0,
    ]);
    this.device.queue.writeBuffer(this.paramsBuffer, 0, data);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroupA);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8), 1);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  stepErosion(_params: ErosionParams): void {
    // Erosion passes will be implemented in Phase 2.
  }

  getHeightmapTexture(): GPUTexture {
    if (!this.heightA) {
      throw new Error('TerrainEngine not initialized');
    }
    return this.heightA;
  }

  async getHeightmapAsFloatArray(): Promise<Float32Array> {
    if (!this.device || !this.heightA) {
      throw new Error('TerrainEngine not initialized');
    }

    const byteSize = this.width * this.height * 4;
    const buffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture: this.heightA, mipLevel: 0, origin: { x: 0, y: 0 } },
      { buffer, bytesPerRow: this.width * 4, rowsPerImage: this.height },
      { width: this.width, height: this.height, depthOrArrayLayers: 1 }
    );
    this.device.queue.submit([encoder.finish()]);

    await buffer.mapAsync(GPUMapMode.READ);
    const source = new Float32Array(buffer.getMappedRange());
    const result = new Float32Array(source.length);
    result.set(source);
    buffer.unmap();
    return result;
  }

  reset(): void {
    // Explicit reset not required for Phase 1.
  }

  destroy(): void {
    this.heightA?.destroy();
    this.heightB?.destroy();
    this.paramsBuffer?.destroy();
  }
}
