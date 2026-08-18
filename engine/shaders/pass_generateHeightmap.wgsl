// pass_generateHeightmap.wgsl
// Fills the terrainHeight texture with multi-octave 2D Perlin-style noise.
// Uniforms provide seed, base frequency, octave count and overall amplitude.
// Output is an r32float storage texture; values range ~[-amplitude, amplitude].

struct Params {
  seed: f32,
  frequency: f32,
  octaves: f32,
  amplitude: f32,
  width: f32,
  height: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: Params;
@group(0) @binding(1) var outHeight: texture_storage_2d<r32float, write>;

const gradients: array<vec2<f32>, 8> = array<vec2<f32>, 8>(
  vec2<f32>( 1.0,  0.0),
  vec2<f32>(-1.0,  0.0),
  vec2<f32>( 0.0,  1.0),
  vec2<f32>( 0.0, -1.0),
  vec2<f32>( 0.7071,  0.7071),
  vec2<f32>(-0.7071,  0.7071),
  vec2<f32>( 0.7071, -0.7071),
  vec2<f32>(-0.7071, -0.7071)
);

fn hashU(x: u32, y: u32, s: f32) -> u32 {
  let seedBase = u32(s + 1000000.0);
  var a = x * 374761261u + y * 668265263u + seedBase * 9999999u;
  a = (a ^ (a >> 13u)) * 1274126177u;
  a = a ^ (a >> 16u);
  return a;
}

fn perlin(p: vec2<f32>, s: f32) -> f32 {
  let i = vec2<i32>(floor(p));
  let f = fract(p);
  let sx = f * f * (3.0 - 2.0 * f);

  let n00 = dot(gradients[i32(hashU(u32(i.x),     u32(i.y),     s) % 8u)], f - vec2<f32>(0.0, 0.0));
  let n10 = dot(gradients[i32(hashU(u32(i.x + 1), u32(i.y),     s) % 8u)], f - vec2<f32>(1.0, 0.0));
  let n01 = dot(gradients[i32(hashU(u32(i.x),     u32(i.y + 1), s) % 8u)], f - vec2<f32>(0.0, 1.0));
  let n11 = dot(gradients[i32(hashU(u32(i.x + 1), u32(i.y + 1), s) % 8u)], f - vec2<f32>(1.0, 1.0));

  let ix0 = mix(n00, n10, sx.x);
  let ix1 = mix(n01, n11, sx.x);
  return mix(ix0, ix1, sx.y);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (f32(global_id.x) >= u.width || f32(global_id.y) >= u.height) {
    return;
  }

  let uv = vec2<f32>(f32(global_id.x) / u.width, f32(global_id.y) / u.height);
  var h: f32 = 0.0;
  let octaves = i32(u.octaves);

  for (var o: i32 = 0; o < octaves; o = o + 1i) {
    let freq = u.frequency * pow(2.0, f32(o));
    let amp = pow(0.5, f32(o));
    h = h + perlin(uv * freq, u.seed) * amp;
  }

  h = h * u.amplitude;

  textureStore(
    outHeight,
    vec2<i32>(i32(global_id.x), i32(global_id.y)),
    vec4<f32>(h, 0.0, 0.0, 0.0)
  );
}
