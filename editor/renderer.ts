import terrainShader from '../engine/shaders/render_terrainTextured.wgsl?raw';

export interface Renderer {
  updateMvp(
    mvp: Float32Array,
    heightScale: number,
    envIndex?: number,
    thresholds?: [number, number, number, number]
  ): void;
  render(encoder: GPUCommandEncoder, colorView: GPUTextureView, depthView: GPUTextureView): void;
}

export function createRenderer(
  device: GPUDevice,
  meshSize: number,
  colorFormat: GPUTextureFormat,
  heightScale: number,
  heightmapTexture: GPUTexture
): Renderer {
  const vertexCount = (meshSize + 1) * (meshSize + 1);
  const positions = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(meshSize * meshSize * 6);

  let p = 0;
  for (let y = 0; y <= meshSize; y++) {
    const v = y / meshSize;
    for (let x = 0; x <= meshSize; x++) {
      const u = x / meshSize;
      positions[p++] = (u - 0.5) * 2.0; // world x
      positions[p++] = (v - 0.5) * 2.0; // world z
      positions[p++] = u;
      positions[p++] = v;
    }
  }

  let i = 0;
  for (let y = 0; y < meshSize; y++) {
    for (let x = 0; x < meshSize; x++) {
      const a = y * (meshSize + 1) + x;
      const b = a + 1;
      const c = (y + 1) * (meshSize + 1) + x;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }

  const vertexBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(positions);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(indices);
  indexBuffer.unmap();

  const uniformBuffer = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const defaultThresholds: [number, number, number, number] = [0.22, 0.35, 35.0, 0.75];

  const shaderModule = device.createShaderModule({
    code: terrainShader,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float' },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format: colorFormat }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: heightmapTexture.createView() },
    ],
  });

  const mvpData = new Float32Array(24);

  return {
    updateMvp(mvp: Float32Array, hs: number, envIndex = 0, thresholds = defaultThresholds) {
      mvpData.set(mvp, 0);
      mvpData[16] = hs;
      mvpData[17] = envIndex;
      mvpData[20] = thresholds[0];
      mvpData[21] = thresholds[1];
      mvpData[22] = thresholds[2];
      mvpData[23] = thresholds[3];
      device.queue.writeBuffer(uniformBuffer, 0, mvpData);
    },
    render(encoder: GPUCommandEncoder, colorView: GPUTextureView, depthView: GPUTextureView) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorView,
            clearValue: [0.0, 0.05, 0.1, 1.0],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, 'uint32');
      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(indices.length);
      pass.end();
    },
  };
}
