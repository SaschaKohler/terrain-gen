import { createEngine, type NoiseParams } from '../engine/index';
import { createRenderer, type Renderer } from './renderer';
import { createDefaultCamera, updateCamera } from './camera';
import { createMat4 } from './math';
import { createUI } from './ui';



function createDepthTexture(device: GPUDevice, width: number, height: number): GPUTexture {
  return device.createTexture({
    size: { width, height, depthOrArrayLayers: 1 },
    dimension: '2d',
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    mipLevelCount: 1,
    sampleCount: 1,
  });
}

async function init(): Promise<void> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No WebGPU adapter found.');
  }

  const device = await adapter.requestDevice();
  console.log('WebGPU device acquired');

  const canvas = document.querySelector<HTMLCanvasElement>('#viewport');
  if (!canvas) {
    throw new Error('Viewport canvas not found.');
  }

  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to create WebGPU canvas context.');
  }

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: 'premultiplied',
  });

  const camera = createDefaultCamera();
  const mvp = createMat4();

  const uiContainer = document.querySelector<HTMLElement>('#ui');
  if (!uiContainer) {
    throw new Error('UI container not found.');
  }
  const ui = createUI(uiContainer);

  let engine = createEngine();
  let renderer: Renderer | undefined;
  let currentSize = 0;
  let noiseParams: NoiseParams = { ...ui.getState().noise };

  const regenerate = (): void => {
    const state = ui.getState();
    noiseParams = { ...state.noise };
    engine.generateHeightmap(noiseParams.seed, noiseParams);
  };

  const setupTerrain = (size: number): void => {
    currentSize = size;
    engine.destroy();
    renderer?.destroy();
    engine = createEngine();
    engine.init(device, { width: size, height: size });
    renderer = createRenderer(
      device,
      size - 1,
      canvasFormat,
      ui.getState().heightScale,
      engine.getHeightmapTexture()
    );
    regenerate();
  };

  setupTerrain(ui.getState().heightmapSize);

  let depthTexture = createDepthTexture(device, canvas.clientWidth, canvas.clientHeight);

  const resize = (): void => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    depthTexture.destroy();
    depthTexture = createDepthTexture(device, canvas.clientWidth, canvas.clientHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    camera.theta -= dx * 0.005;
    camera.phi -= dy * 0.005;
    camera.phi = Math.max(0.1, Math.min(Math.PI - 0.1, camera.phi));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.radius *= Math.exp(e.deltaY * 0.001);
      camera.radius = Math.max(0.5, Math.min(10, camera.radius));
    },
    { passive: false }
  );

  ui.onChange(() => {
    const state = ui.getState();
    if (state.heightmapSize !== currentSize) {
      setupTerrain(state.heightmapSize);
      return;
    }
    if (
      state.noise.frequency !== noiseParams.frequency ||
      state.noise.octaves !== noiseParams.octaves ||
      state.noise.amplitude !== noiseParams.amplitude ||
      state.noise.seed !== noiseParams.seed
    ) {
      regenerate();
    }
  });

  function frame(): void {
    const currentTexture = context!.getCurrentTexture();
    const colorView = currentTexture.createView();

    const aspect = canvas!.width / canvas!.height;
    updateCamera(camera, aspect, mvp);
    renderer!.updateMvp(mvp, ui.getState().heightScale, ui.getState().environment);

    const state = ui.getState();
    if (state.runErosion) {
      engine.stepErosion(state.erosion);
    }

    const encoder = device.createCommandEncoder();
    renderer!.render(encoder, colorView, depthTexture.createView());
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init().catch((error: unknown) => {
  console.error('TerraForge initialization failed:', error);
});
