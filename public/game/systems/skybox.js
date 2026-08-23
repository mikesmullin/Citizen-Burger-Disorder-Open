// Procedural dome. Cheap on purpose: one cube, no textures, one fragment
// shader. Clouds are domain-warped FBM on a sky plane so they flatten at
// the horizon instead of tiling as sine blobs on the sphere.
//
// Sun direction should match the hall key light so shadows agree.

import * as THREE from 'three'

export const SKY_FOG_DAY = 0xb8d0e4
export const SKY_FOG_DUSK = 0xc46a48
export const SKY_FOG_NIGHT = 0x0a101c

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function smooth01(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

// Same envelope the fragment shader uses for the orange/purple wash.
export function duskEnvelope(t) {
  return smooth01(0.04, 0.22, t) * (1 - smooth01(0.40, 0.78, t))
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uDay;
uniform float uDusk;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  v += a * noise2(p); p = m * p; a *= 0.5;
  v += a * noise2(p); p = m * p; a *= 0.5;
  v += a * noise2(p); p = m * p; a *= 0.5;
  v += a * noise2(p); p = m * p; a *= 0.5;
  v += a * noise2(p);
  return v;
}

float starLayer(vec3 dir, float scale, float thresh, float size) {
  vec3 p = dir * scale;
  vec3 f = fract(p) - 0.5;
  float h = hash13(floor(p));
  float br = smoothstep(thresh, 1.0, h);
  float tw = 0.62 + 0.38 * sin(uTime * (1.1 + h * 2.8) + h * 40.0);
  return br * tw * (1.0 - smoothstep(0.0, size * (0.55 + 0.9 * h), length(f)));
}

void main() {
  vec3 dir = normalize(vDir);
  float y = dir.y;
  vec3 sunDir = normalize(uSunDir);
  vec3 moonDir = normalize(uMoonDir);
  float mu = max(dot(dir, sunDir), 0.0);
  float dusk = uDusk;
  float hz = exp(-max(y, 0.0) * 7.0);

  // Day: zenith cobalt, horizon almost white, warm band from the sun.
  vec3 dayZenith = vec3(0.23, 0.48, 0.86);
  vec3 dayMid    = vec3(0.48, 0.72, 0.94);
  vec3 dayHoriz  = vec3(0.82, 0.90, 0.97);
  float yt = clamp(y * 1.15 + 0.08, 0.0, 1.0);
  vec3 dayCol = mix(dayHoriz, mix(dayMid, dayZenith, pow(yt, 0.85)), smoothstep(0.0, 0.55, yt));
  dayCol += vec3(1.00, 0.72, 0.38) * pow(mu, 4.0) * 0.18 * hz;
  dayCol += vec3(1.00, 0.88, 0.62) * pow(mu, 18.0) * 0.28;

  // Night: deep navy, slightly brighter toward the horizon.
  vec3 nightZenith = vec3(0.012, 0.018, 0.055);
  vec3 nightHoriz  = vec3(0.05, 0.07, 0.14);
  vec3 nightCol = mix(nightHoriz, nightZenith, pow(clamp(y + 0.05, 0.0, 1.0), 0.65));
  nightCol += vec3(0.12, 0.16, 0.28) * pow(max(dot(dir, moonDir), 0.0), 6.0) * 0.22;

  vec3 col = mix(nightCol, dayCol, uDay);

  // Twilight wash along the horizon while day amount is in the middle.
  col = mix(col, vec3(0.98, 0.36, 0.12), dusk * hz * 0.90);
  col = mix(col, vec3(0.42, 0.14, 0.38), dusk * pow(hz, 0.42) * 0.38);
  col = mix(col, vec3(1.00, 0.70, 0.28), dusk * pow(mu, 8.0) * 0.55);

  // Clouds — sky-plane mapping so they recede at the horizon.
  float cloud = 0.0;
  vec3 cloudCol = vec3(1.0);
  if (y > 0.012) {
    vec2 uv = dir.xz / (y + 0.10);
    uv += vec2(uTime * 0.0065, uTime * 0.0024);
    vec2 q = uv * 0.72;
    vec2 warp = vec2(fbm(q), fbm(q + vec2(5.2, 1.3)));
    float n = fbm(q + warp * 0.42);
    float n2 = fbm(q * 1.55 + vec2(13.1, 7.7));
    float dens = pow(smoothstep(0.36, 0.74, n * 0.62 + n2 * 0.38), 1.15);
    float fade = smoothstep(0.012, 0.11, y) * (1.0 - 0.30 * smoothstep(0.58, 1.0, y));
    cloud = dens * fade;
    float lining = pow(mu, 10.0);
    vec3 shade = mix(vec3(0.76, 0.81, 0.90), vec3(1.00, 0.995, 0.98), clamp(n2 + lining * 0.35, 0.0, 1.0));
    cloudCol = shade + vec3(1.0, 0.93, 0.75) * lining * (1.0 - dens) * 0.40;
  }
  float cloudAmt = mix(0.22, 0.95, uDay);
  col = mix(col, cloudCol, cloud * cloudAmt);

  // Sun disc + corona (day / dusk). Drawn after clouds so it can peek through.
  float sunAmt = smoothstep(0.12, 0.55, uDay);
  vec3 sun = vec3(1.00, 0.96, 0.82) * smoothstep(0.99962, 0.99988, mu) * 2.4;
  sun += vec3(1.00, 0.84, 0.48) * pow(mu, 64.0) * 0.70;
  sun += vec3(1.00, 0.90, 0.70) * pow(mu, 10.0) * 0.18;
  col += sun * sunAmt * (1.0 - cloud * 0.55);

  // Stars + moon (night / dusk).
  float nightAmt = 1.0 - smoothstep(0.18, 0.62, uDay);
  if (nightAmt > 0.01 && y > -0.04) {
    float stars = starLayer(dir, 72.0, 0.955, 0.07);
    stars += starLayer(dir, 128.0, 0.972, 0.04) * 0.85;
    stars += starLayer(dir, 210.0, 0.984, 0.025) * 0.55;
    col += vec3(0.90, 0.94, 1.0) * stars * nightAmt * 1.15 * smoothstep(-0.02, 0.16, y);

    float md = max(dot(dir, moonDir), 0.0);
    float disc = smoothstep(0.99935, 0.99962, md);
    float halo = pow(md, 14.0) * 0.16 + pow(md, 4.0) * 0.04;
    col += (vec3(0.86, 0.90, 0.98) * disc * 1.4 + vec3(0.40, 0.48, 0.70) * halo) * nightAmt;
  }

  // Below the horizon: dirt, so a missed wall top doesn't flash inverted sky.
  if (y < 0.0) {
    vec3 ground = mix(vec3(0.05, 0.055, 0.07), vec3(0.20, 0.18, 0.16), uDay);
    col = mix(col, ground, smoothstep(0.0, -0.14, y));
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export function createSkybox(scene, {
  sunDir = new THREE.Vector3(10, 24, 18),
  moonDir = new THREE.Vector3(-0.52, 0.58, -0.62),
  onDay = null,
} = {}) {
  const sun = sunDir.clone().normalize()
  const moon = moonDir.clone().normalize()
  const uniforms = {
    uDay: { value: 1 },
    uDusk: { value: duskEnvelope(1) },
    uTime: { value: 0 },
    uSunDir: { value: sun },
    uMoonDir: { value: moon },
  }
  const mat = new THREE.ShaderMaterial({
    name: 'Skybox',
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat)
  mesh.name = 'Skybox'
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.matrixWorld.copyPosition(camera.matrixWorld)
  }
  scene.add(mesh)

  let targetDay = 1
  const DUSK_S = 1.35

  function syncDusk() {
    uniforms.uDusk.value = duskEnvelope(uniforms.uDay.value)
  }

  function fogHex(day = targetDay > 0.5) {
    return day ? SKY_FOG_DAY : SKY_FOG_NIGHT
  }

  return {
    mesh,
    mat,
    fogHex,
    get day() { return uniforms.uDay.value },
    get dusk() { return uniforms.uDusk.value },
    get target() { return targetDay },
    setDay(day, immediate = false) {
      targetDay = day ? 1 : 0
      if (immediate) {
        uniforms.uDay.value = targetDay
        syncDusk()
      }
      if (onDay) onDay(uniforms.uDay.value)
    },
    update(dt) {
      uniforms.uTime.value += dt
      const cur = uniforms.uDay.value
      if (cur !== targetDay) {
        const step = dt / DUSK_S
        uniforms.uDay.value = cur < targetDay
          ? Math.min(targetDay, cur + step)
          : Math.max(targetDay, cur - step)
        syncDusk()
        if (onDay) onDay(uniforms.uDay.value)
      }
    },
    dump() {
      return {
        day: +uniforms.uDay.value.toFixed(3),
        dusk: +uniforms.uDusk.value.toFixed(3),
        target: targetDay,
        time: +uniforms.uTime.value.toFixed(2),
      }
    },
  }
}
