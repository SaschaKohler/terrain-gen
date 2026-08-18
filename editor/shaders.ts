export const terrainShader = `
struct Uniforms {
  mvp: mat4x4<f32>,
  heightScale: f32,
  pad: vec3<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var hmap: texture_2d<f32>;

struct VSIn {
  @location(0) pos: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) height: f32,
};

@vertex
fn vs(in: VSIn) -> VSOut {
  let dims = vec2<i32>(textureDimensions(hmap, 0));
  let t = vec2<i32>(in.uv * vec2<f32>(dims));
  let tc = min(t, dims - vec2<i32>(1, 1));
  let raw = textureLoad(hmap, tc, 0).r;
  let y = raw * u.heightScale;
  let world = vec3<f32>(in.pos.x, y, in.pos.y);
  return VSOut(u.mvp * vec4<f32>(world, 1.0), y);
}

@fragment
fn fs(@location(0) height: f32) -> @location(0) vec4<f32> {
  let raw = height / u.heightScale;
  let t = clamp(raw * 0.5 + 0.5, 0.0, 1.0);
  let low = vec3<f32>(0.1, 0.08, 0.05);
  let high = vec3<f32>(0.95, 0.95, 0.9);
  return vec4<f32>(mix(low, high, t), 1.0);
}
`;
