// render_terrainTextured.wgsl
// World-Machine-style coverage texturing: blend water, sand, grass, rock and snow
// layers based on normalized terrain height and surface slope. Normals are computed
// in the vertex stage and smoothly interpolated, giving a much less faceted look.
// A small procedural noise overlay and slope darkening add colour variation.

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
  @location(2) normal: vec3<f32>,
};

// 4 palettes x 5 layers: water, sand, grass, rock, snow
// Muted, naturalistic base tones.
const colors: array<vec3<f32>, 20> = array<vec3<f32>, 20>(
  // Temperate
  vec3<f32>(0.08, 0.16, 0.24),
  vec3<f32>(0.62, 0.58, 0.42),
  vec3<f32>(0.24, 0.42, 0.18),
  vec3<f32>(0.40, 0.36, 0.32),
  vec3<f32>(0.86, 0.86, 0.88),
  // Desert
  vec3<f32>(0.16, 0.24, 0.30),
  vec3<f32>(0.78, 0.66, 0.40),
  vec3<f32>(0.58, 0.44, 0.22),
  vec3<f32>(0.58, 0.36, 0.22),
  vec3<f32>(0.88, 0.84, 0.76),
  // Arctic
  vec3<f32>(0.12, 0.18, 0.26),
  vec3<f32>(0.72, 0.74, 0.76),
  vec3<f32>(0.28, 0.44, 0.26),
  vec3<f32>(0.52, 0.52, 0.55),
  vec3<f32>(0.92, 0.92, 0.94),
  // Martian
  vec3<f32>(0.38, 0.14, 0.10),
  vec3<f32>(0.70, 0.42, 0.24),
  vec3<f32>(0.52, 0.26, 0.12),
  vec3<f32>(0.62, 0.28, 0.16),
  vec3<f32>(0.82, 0.72, 0.62)
);

fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash2(i);
  let b = hash2(i + vec2<f32>(1.0, 0.0));
  let c = hash2(i + vec2<f32>(0.0, 1.0));
  let d = hash2(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var v: f32 = 0.0;
  var amp: f32 = 0.5;
  var freq: f32 = 1.0;
  for (var o: i32 = 0; o < 4; o = o + 1) {
    v = v + noise(p * freq) * amp;
    amp = amp * 0.5;
    freq = freq * 2.0;
  }
  return v;
}

fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<i32>(textureDimensions(hmap, 0));
  let tc = min(vec2<i32>(uv * vec2<f32>(dims)), dims - vec2<i32>(1, 1));
  return textureLoad(hmap, tc, 0).r;
}

fn computeNormal(uv: vec2<f32>) -> vec3<f32> {
  let dims = vec2<i32>(textureDimensions(hmap, 0));
  let tc = min(vec2<i32>(uv * vec2<f32>(dims)), dims - vec2<i32>(1, 1));

  let hC = textureLoad(hmap, tc, 0).r;
  let hL = textureLoad(hmap, clamp(tc - vec2<i32>(1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hR = textureLoad(hmap, clamp(tc + vec2<i32>(1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hD = textureLoad(hmap, clamp(tc - vec2<i32>(0, 1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;
  let hU = textureLoad(hmap, clamp(tc + vec2<i32>(0, 1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).r;

  let dx = 2.0 / f32(dims.x);
  let dy = 2.0 / f32(dims.y);
  let dfdx = (hR - hL) * u.settings.x / (2.0 * dx);
  let dfdy = (hU - hD) * u.settings.x / (2.0 * dy);
  return normalize(vec3<f32>(-dfdx, 1.0, -dfdy));
}

@vertex
fn vs(in: VSIn) -> VSOut {
  let raw = sampleHeight(in.uv);
  let y = raw * u.settings.x;
  let world = vec3<f32>(in.pos.x, y, in.pos.y);
  let n = computeNormal(in.uv);
  return VSOut(u.mvp * vec4<f32>(world, 1.0), in.uv, raw, n);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let n = normalize(in.normal);
  let raw = in.raw;

  let slope = degrees(acos(clamp(n.y, 0.0, 1.0)));
  let t = clamp(raw * 0.5 + 0.5, 0.0, 1.0);

  let th = u.thresholds;
  let hBlend = 0.10;
  let sBlend = 6.0;

  var wWater = 1.0 - smoothstep(th.x - hBlend, th.x + hBlend, t);
  var wSand  = smoothstep(th.x - hBlend, th.x + hBlend, t) * (1.0 - smoothstep(th.y - hBlend, th.y + hBlend, t));
  var wGrass = smoothstep(th.y - hBlend, th.y + hBlend, t) * (1.0 - smoothstep(th.w - hBlend, th.w + hBlend, t)) * (1.0 - smoothstep(th.z - sBlend, th.z + sBlend, slope));
  var wRock  = smoothstep(th.y - hBlend, th.y + hBlend, t) * (1.0 - smoothstep(th.w - hBlend, th.w + hBlend, t)) * smoothstep(th.z - sBlend, th.z + sBlend, slope);
  var wSnow  = smoothstep(th.w - hBlend, th.w + hBlend, t);

  let sum = wWater + wSand + wGrass + wRock + wSnow;
  wWater /= sum;
  wSand  /= sum;
  wGrass /= sum;
  wRock  /= sum;
  wSnow  /= sum;

  let env = u32(clamp(u.settings.y, 0.0, 3.0));
  var base =
    colors[env * 5u + 0u] * wWater +
    colors[env * 5u + 1u] * wSand  +
    colors[env * 5u + 2u] * wGrass +
    colors[env * 5u + 3u] * wRock  +
    colors[env * 5u + 4u] * wSnow;

  // Procedural albedo variation and slope darkening
  let detail = 0.78 + 0.22 * fbm(in.uv * 32.0);
  base = base * detail;
  base = base * (0.55 + 0.45 * pow(max(n.y, 0.0), 0.5));

  // Diffuse lighting
  let sunDir = normalize(vec3<f32>(0.45, 0.85, 0.25));
  let diff = max(dot(n, sunDir), 0.0);
  let lit = base * (0.35 + 0.65 * diff);

  return vec4<f32>(lit, 1.0);
}
