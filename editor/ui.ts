import type { NoiseParams, ErosionParams } from '../engine/index';

export interface UIState {
  noise: NoiseParams;
  erosion: ErosionParams;
  heightScale: number;
  environment: number;
  heightmapSize: number;
  runErosion: boolean;
}

export interface ParameterUI {
  getState(): UIState;
  onChange(callback: () => void): void;
}

interface ParamSpec {
  label: string;
  key: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

function createNumberControl(
  container: HTMLElement,
  spec: ParamSpec,
  onChange: (value: number) => void
): { input: HTMLInputElement; setValue: (value: number) => void } {
  const row = document.createElement('div');
  row.className = 'param-row';

  const label = document.createElement('label');
  label.textContent = spec.label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(spec.min);
  slider.max = String(spec.max);
  slider.step = String(spec.step);
  slider.value = String(spec.value);

  const number = document.createElement('input');
  number.type = 'number';
  number.min = String(spec.min);
  number.max = String(spec.max);
  number.step = String(spec.step);
  number.value = String(spec.value);

  const update = (value: number): void => {
    slider.value = String(value);
    number.value = String(value);
    onChange(value);
  };

  slider.addEventListener('input', () => update(Number(slider.value)));
  number.addEventListener('change', () => update(Number(number.value)));

  row.appendChild(label);
  row.appendChild(slider);
  row.appendChild(number);
  container.appendChild(row);

  return { input: number, setValue: update };
}

export function createUI(container: HTMLElement): ParameterUI {
  const state: UIState = {
    noise: {
      seed: 0,
      frequency: 4,
      octaves: 6,
      amplitude: 1,
      persistence: 0.5,
      lacunarity: 2.0,
      offsetX: 0.0,
      offsetY: 0.0,
      power: 1.0,
      noiseType: 0,
    },
    erosion: {
      rainAmount: 0.01,
      evaporationRate: 0.05,
      sedimentCapacity: 0.1,
      erosionRate: 0.1,
      depositionRate: 0.1,
      iterations: 50,
    },
    heightScale: 0.5,
    environment: 0,
    heightmapSize: 256,
    runErosion: false,
  };

  const listeners: (() => void)[] = [];
  const notify = (): void => listeners.forEach((cb) => cb());

  const panel = document.createElement('div');
  panel.id = 'ui-panel';
  container.appendChild(panel);

  const title = document.createElement('h2');
  title.textContent = 'TerraForge';
  panel.appendChild(title);

  const noiseSection = document.createElement('section');
  const noiseTitle = document.createElement('h3');
  noiseTitle.textContent = 'Noise';
  noiseSection.appendChild(noiseTitle);
  panel.appendChild(noiseSection);

  const seedControl = createNumberControl(
    noiseSection,
    { label: 'Seed', key: 'seed', min: 0, max: 1000000, step: 1, value: state.noise.seed },
    (v) => { state.noise.seed = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Frequency', key: 'frequency', min: 0.1, max: 16, step: 0.1, value: state.noise.frequency },
    (v) => { state.noise.frequency = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Octaves', key: 'octaves', min: 1, max: 12, step: 1, value: state.noise.octaves },
    (v) => { state.noise.octaves = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Amplitude', key: 'amplitude', min: 0.1, max: 4, step: 0.1, value: state.noise.amplitude },
    (v) => { state.noise.amplitude = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Persistence', key: 'persistence', min: 0.0, max: 1.0, step: 0.05, value: state.noise.persistence },
    (v) => { state.noise.persistence = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Lacunarity', key: 'lacunarity', min: 1.0, max: 8.0, step: 0.1, value: state.noise.lacunarity },
    (v) => { state.noise.lacunarity = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Offset X', key: 'offsetX', min: -1.0, max: 1.0, step: 0.01, value: state.noise.offsetX },
    (v) => { state.noise.offsetX = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Offset Y', key: 'offsetY', min: -1.0, max: 1.0, step: 0.01, value: state.noise.offsetY },
    (v) => { state.noise.offsetY = v; notify(); }
  );
  createNumberControl(
    noiseSection,
    { label: 'Power', key: 'power', min: 0.1, max: 4.0, step: 0.1, value: state.noise.power },
    (v) => { state.noise.power = v; notify(); }
  );

  const typeRow = document.createElement('div');
  typeRow.className = 'param-row';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Noise Type';
  const typeSelect = document.createElement('select');
  ['fBm', 'Ridged', 'Billowy'].forEach((name, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = name;
    typeSelect.appendChild(option);
  });
  typeSelect.value = String(state.noise.noiseType);
  typeSelect.addEventListener('change', () => {
    state.noise.noiseType = Number(typeSelect.value);
    notify();
  });
  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);
  noiseSection.appendChild(typeRow);

  const displaySection = document.createElement('section');
  const displayTitle = document.createElement('h3');
  displayTitle.textContent = 'Display';
  displaySection.appendChild(displayTitle);
  panel.appendChild(displaySection);

  createNumberControl(
    displaySection,
    { label: 'Height Scale', key: 'heightScale', min: 0.05, max: 2, step: 0.05, value: state.heightScale },
    (v) => { state.heightScale = v; notify(); }
  );

  const envRow = document.createElement('div');
  envRow.className = 'param-row';
  const envLabel = document.createElement('label');
  envLabel.textContent = 'Environment';
  const envSelect = document.createElement('select');
  ['Temperate', 'Desert', 'Arctic', 'Martian'].forEach((name, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = name;
    envSelect.appendChild(option);
  });
  envSelect.value = String(state.environment);
  envSelect.addEventListener('change', () => {
    state.environment = Number(envSelect.value);
    notify();
  });
  envRow.appendChild(envLabel);
  envRow.appendChild(envSelect);
  displaySection.appendChild(envRow);

  const resRow = document.createElement('div');
  resRow.className = 'param-row';
  const resLabel = document.createElement('label');
  resLabel.textContent = 'Resolution';
  const resSelect = document.createElement('select');
  [64, 128, 256, 512, 1024].forEach((size) => {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = `${size} x ${size}`;
    resSelect.appendChild(option);
  });
  resSelect.value = String(state.heightmapSize);
  resSelect.addEventListener('change', () => {
    state.heightmapSize = Number(resSelect.value);
    notify();
  });
  resRow.appendChild(resLabel);
  resRow.appendChild(resSelect);
  displaySection.appendChild(resRow);

  const erosionSection = document.createElement('section');
  const erosionTitle = document.createElement('h3');
  erosionTitle.textContent = 'Erosion';
  erosionSection.appendChild(erosionTitle);
  panel.appendChild(erosionSection);

  createNumberControl(
    erosionSection,
    { label: 'Rain', key: 'rainAmount', min: 0, max: 0.5, step: 0.001, value: state.erosion.rainAmount },
    (v) => { state.erosion.rainAmount = v; notify(); }
  );
  createNumberControl(
    erosionSection,
    { label: 'Evaporation', key: 'evaporationRate', min: 0, max: 0.5, step: 0.001, value: state.erosion.evaporationRate },
    (v) => { state.erosion.evaporationRate = v; notify(); }
  );
  createNumberControl(
    erosionSection,
    { label: 'Sediment Capacity', key: 'sedimentCapacity', min: 0, max: 1, step: 0.001, value: state.erosion.sedimentCapacity },
    (v) => { state.erosion.sedimentCapacity = v; notify(); }
  );
  createNumberControl(
    erosionSection,
    { label: 'Erosion Rate', key: 'erosionRate', min: 0, max: 1, step: 0.001, value: state.erosion.erosionRate },
    (v) => { state.erosion.erosionRate = v; notify(); }
  );
  createNumberControl(
    erosionSection,
    { label: 'Deposition Rate', key: 'depositionRate', min: 0, max: 1, step: 0.001, value: state.erosion.depositionRate },
    (v) => { state.erosion.depositionRate = v; notify(); }
  );
  createNumberControl(
    erosionSection,
    { label: 'Iterations', key: 'iterations', min: 0, max: 500, step: 1, value: state.erosion.iterations },
    (v) => { state.erosion.iterations = v; notify(); }
  );

  const runRow = document.createElement('div');
  runRow.className = 'param-row';
  const runCheck = document.createElement('input');
  runCheck.type = 'checkbox';
  runCheck.id = 'run-erosion';
  runCheck.checked = state.runErosion;
  const runLabel = document.createElement('label');
  runLabel.htmlFor = 'run-erosion';
  runLabel.textContent = 'Run erosion';
  runCheck.addEventListener('change', () => {
    state.runErosion = runCheck.checked;
    notify();
  });
  runRow.appendChild(runCheck);
  runRow.appendChild(runLabel);
  erosionSection.appendChild(runRow);

  const actions = document.createElement('div');
  actions.className = 'actions';
  panel.appendChild(actions);

  const regenButton = document.createElement('button');
  regenButton.id = 'regenerate';
  regenButton.textContent = 'Random Seed';
  regenButton.addEventListener('click', () => {
    seedControl.setValue(Math.random() * 1000000);
  });
  actions.appendChild(regenButton);

  return {
    getState: () => state,
    onChange: (cb) => listeners.push(cb),
  };
}
