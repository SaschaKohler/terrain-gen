import { createMat4, lookAt, perspective, multiply } from './math';

export interface OrbitCamera {
  theta: number;
  phi: number;
  radius: number;
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export function createDefaultCamera(): OrbitCamera {
  return {
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 2.5,
    target: [0, 0, 0],
    fov: Math.PI / 4,
    near: 0.1,
    far: 100,
  };
}

const view = createMat4();
const proj = createMat4();
const up: [number, number, number] = [0, 1, 0];

export function updateCamera(camera: OrbitCamera, aspect: number, outMvp: Float32Array): void {
  const { theta, phi, radius, target } = camera;

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const eye: [number, number, number] = [x + target[0], y + target[1], z + target[2]];

  lookAt(view, eye, target, up);
  perspective(proj, camera.fov, aspect, camera.near, camera.far);
  multiply(outMvp, proj, view);
}
