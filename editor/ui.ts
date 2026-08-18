import type { NoiseParams, ErosionParams } from '../engine/index';

export interface UIState {
  noise: NoiseParams;
  erosion: ErosionParams;
  heightScale: number;
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
): HTMLInputElement {
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

  return number;
}

export function createUI(container: HTMLElement): ParameterUI {
  const state: UIState = {
    noise: {
      seed: 0,
      frequency: 4,
      octaves: 6,
      amplitude: 1,
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
  regenButton.textContent = 'Regenerate';
  regenButton.addEventListener('click', () => {
    state.noise.seed = Math.random() * 1000000;
    notify();
  });
  actions.appendChild(regenButton);

  return {
    getState: () => state,
    onChange: (cb) => listeners.push(cb),
  };
}
