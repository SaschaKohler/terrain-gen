// render_terrainTextured.wgsl
// World-Machine-style coverage texturing: blend water, sand, grass, rock and snow
// layers based on normalized terrain height and surface slope. Four color palettes
// (environments) are baked into a constant lookup table.

struct Uniforms {
  mvp: mat4x4<f32>,
  settings: vec4<f32>,      // x = heightScale, y = envIndex, zw unused
  thresholds: vec4<f32>,    // x = water, y = grassStart, z = rockSlope, w = snow
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var hmap: texture_2d<f32>;

struct VSIn {
  @location(0) pos: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) raw: f32,
};

// 4 palettes x 5 layers: water, sand, grass, rock, snow
const colors: array<vec3<f32>, 20> = array<vec3<f32>, 20>(
  // Temperate
  vec3<f32>(0.12, 0.22, 0.38),
  vec3<f32>(0.78, 0.72, 0.45),
  vec3<f32>(0.20, 0.52, 0.18),
  vec3<f32>(0.48, 0.43, 0.38),
  vec3<f32>(0.95, 0.95, 0.98),
  // Desert
  vec3<f32>(0.20, 0.30, 0.42),
  vec3<f32>(0.88, 0.78, 0.48),
  vec3<f32>(0.72, 0.55, 0.25),
  vec3<f32>(0.62, 0.40, 0.22),
  vec3<f32>(0.94, 0.90, 0.82),
  // Arctic
  vec3<f32>(0.22, 0.30, 0.40),
  vec3<f32>(0.85, 0.88, 0.90),
  vec3<f32>(0.25, 0.45, 0.22),
  vec3<f32>(0.58, 0.58, 0.62),
  vec3<f32>(0.98, 0.98, 1.00),
  // Martian
  vec3<f32>(0.45, 0.20, 0.15),
  vec3<f32>(0.78, 0.48, 0.28),
  vec3<f32>(0.60, 0.30, 0.12),
  vec3<f32>(0.78, 0.35, 0.20),
  vec3<f32>(0.92, 0.82, 0.70)
);

@vertex
fn vs(in: VSIn) -> VSOut {
  let dims = vec2<i32>(textureDimensions(hmap, 0));
  let tc = min(vec2<i32>(in.uv * vec2<f32>(dims)), dims - vec2<i32>(1, 1));
  let raw = textureLoad(hmap, tc, 0).r;
  let y = raw * u.settings.x;
  let world = vec3<f32>(in.pos.x, y, in.pos.y);
  return VSOut(u.mvp * vec4<f32>(world, 1.0), in.uv, raw);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(hmap, 0));
  let tc = vec2<i32>(in.uv * vec2<f32>(dims));

  let hC = in.raw;
  let hL = textureLoad(hmap, clamp(tc - vec2<i32>(1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hR = textureLoad(hmap, clamp(tc + vec2<i32>(1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hD = textureLoad(hmap, clamp(tc - vec2<i32>(0, 1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hU = textureLoad(hmap, clamp(tc + vec2<i32>(0, 1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;

  let dx = 2.0 / f32(dims.x);
  let dy = 2.0 / f32(dims.y);
  let dfdx = (hR - hL) * u.settings.x / (2.0 * dx);
  let dfdy = (hU - hD) * u.settings.x / (2.0 * dy);
  let n = normalize(vec3<f32>(-dfdx, 1.0, -dfdy));

  let slope = degrees(acos(clamp(n.y, 0.0, 1.0)));
  let t = clamp(hC * 0.5 + 0.5, 0.0, 1.0);

  let th = u.thresholds;
  let blend = 0.06;

  var wWater = 1.0 - smoothstep(th.x - blend, th.x + blend, t);
  var wSand  = smoothstep(th.x - blend, th.x + blend, t) * (1.0 - smoothstep(th.y - blend, th.y + blend, t));
  var wGrass = smoothstep(th.y - blend, th.y + blend, t) * (1.0 - smoothstep(th.w - blend, th.w + blend, t)) * (1.0 - smoothstep(th.z - blend, th.z + blend, slope));
  var wRock  = smoothstep(th.y - blend, th.y + blend, t) * (1.0 - smoothstep(th.w - blend, th.w + blend, t)) * smoothstep(th.z - blend, th.z + blend, slope);
  var wSnow  = smoothstep(th.w - blend, th.w + blend, t);

  let sum = wWater + wSand + wGrass + wRock + wSnow;
  wWater /= sum;
  wSand  /= sum;
  wGrass /= sum;
  wRock  /= sum;
  wSnow  /= sum;

  let env = u32(clamp(u.settings.y, 0.0, 3.0));
  let base =
    colors[env * 5u + 0u] * wWater +
    colors[env * 5u + 1u] * wSand  +
    colors[env * 5u + 2u] * wGrass +
    colors[env * 5u + 3u] * wRock  +
    colors[env * 5u + 4u] * wSnow;

  let sunDir = normalize(vec3<f32>(0.5, 0.8, 0.3));
  let diff = max(dot(n, sunDir), 0.0);
  let lit = base * (0.25 + 0.75 * diff);

  return vec4<f32>(lit, 1.0);
}
