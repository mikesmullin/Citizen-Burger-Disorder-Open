// Extinguisher spray: Game9 Particle.c (pool, rate emit, swap-last GC)
// + Unity WaterEmitter (blue) / Foam (white) squares.
// FireAnimate.OnParticleCollision(WaterEmitter) → PutOut → Destroy.

import * as THREE from 'three'

const MAX = 240
const RATE = 72
const HIT_R = 0.55

function rand(a, b) {
  return a + Math.random() * (b - a)
}

export function createSpray({ scene, camera }) {
  const particles = []
  const sprites = []
  let emitAcc = 0

  const blueMat = new THREE.SpriteMaterial({
    color: 0x3a8adf, depthWrite: false, sizeAttenuation: true,
  })
  const whiteMat = new THREE.SpriteMaterial({
    color: 0xf4f7fb, depthWrite: false, sizeAttenuation: true,
  })

  for (let i = 0; i < MAX; i++) {
    const s = new THREE.Sprite(blueMat)
    s.visible = false
    s.raycast = () => {}
    scene.add(s)
    sprites.push(s)
  }

  function add(origin, dir) {
    if (particles.length >= MAX) return
    const white = Math.random() < 0.32
    const spread = new THREE.Vector3(rand(-1, 1), rand(-0.35, 1.1), rand(-1, 1)).normalize()
    const speed = rand(3.4, 6.2)
    const vx = dir.x * speed + spread.x * rand(0.6, 1.8)
    const vy = dir.y * speed + spread.y * rand(0.8, 2.2) + 1.1
    const vz = dir.z * speed + spread.z * rand(0.6, 1.8)
    particles.push({
      born: 0,
      life: rand(0.55, 1.15),
      x: origin.x + rand(-0.04, 0.04),
      y: origin.y + rand(-0.02, 0.06),
      z: origin.z + rand(-0.04, 0.04),
      vx, vy, vz,
      size: white ? rand(0.09, 0.15) : rand(0.16, 0.28),
      white,
    })
  }

  function putOut(fire) {
    if (!fire || fire.out) return
    if (typeof fire.putOut === 'function') {
      fire.putOut()
      return
    }
    fire.out = true
    const root = fire.root
    if (!root) return
    root.visible = false
    if (root.parent) root.parent.remove(root)
    scene.remove(root)
  }

  const _firePos = new THREE.Vector3()
  function hitFires(fires) {
    if (!fires || !fires.length) return
    for (const p of particles) {
      for (const f of fires) {
        if (!f || f.out || !f.root || !f.root.visible) continue
        f.root.getWorldPosition(_firePos)
        const r = (f.hitR || HIT_R) + p.size
        const dx = p.x - _firePos.x, dy = p.y - _firePos.y, dz = p.z - _firePos.z
        if (dx * dx + dy * dy + dz * dz < r * r) {
          putOut(f)
        }
      }
    }
  }

  function update(dt, { emitting, origin, dir, emitters, fires } = {}) {
    dt = Math.min(dt, 0.08)
    const list = Array.isArray(emitters)
      ? emitters.filter(e => e && e.origin && e.dir)
      : (emitting && origin && dir ? [{ origin, dir }] : [])
    if (list.length) {
      emitAcc += dt
      const interval = 1 / RATE
      while (emitAcc >= interval && particles.length < MAX) {
        emitAcc -= interval
        for (const e of list) {
          if (particles.length >= MAX) break
          add(e.origin, e.dir)
        }
      }
      if (particles.length >= MAX) emitAcc = 0
    } else {
      emitAcc = 0
    }

    let i = 0
    while (i < particles.length) {
      const p = particles[i]
      p.born += dt
      if (p.born >= p.life) {
        particles[i] = particles[particles.length - 1]
        particles.pop()
        continue
      }
      p.vy -= 2.4 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      i++
    }

    hitFires(fires)

    for (let s = 0; s < MAX; s++) {
      const spr = sprites[s]
      const p = particles[s]
      if (!p) {
        spr.visible = false
        continue
      }
      spr.visible = true
      spr.position.set(p.x, p.y, p.z)
      spr.scale.set(p.size, p.size, 1)
      spr.material = p.white ? whiteMat : blueMat
    }
  }

  function clear() {
    particles.length = 0
    emitAcc = 0
    for (const s of sprites) s.visible = false
  }

  function dump() {
    let xMin = Infinity, xMax = -Infinity
    for (const p of particles) {
      if (p.x < xMin) xMin = p.x
      if (p.x > xMax) xMax = p.x
    }
    return {
      count: particles.length,
      xMin: particles.length ? +xMin.toFixed(2) : null,
      xMax: particles.length ? +xMax.toFixed(2) : null,
    }
  }

  return { update, clear, dump, get count() { return particles.length } }
}

// Smoke: same Game9 pool / rate-emit / swap-last GC as the extinguisher,
// with a FrontSide quad (circle alpha, runtime tint) billboarded at the camera.
const SMOKE_MAX = 180
const SMOKE_CHAR = new THREE.Color(0x3a3a3a)
const SMOKE_FIRE = new THREE.Color(0x1a1a1a)

const SMOKE_VERT = /* glsl */ `
#ifndef USE_INSTANCING_COLOR
attribute vec3 instanceColor;
#endif
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTint = instanceColor;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`
const SMOKE_FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float a = texture2D(map, vUv).a;
  gl_FragColor = vec4(vTint, a);
}
`

let smokeTex = null
function smokeCircleTexture() {
  if (smokeTex) return smokeTex
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  g.clearRect(0, 0, s, s)
  const cx = s / 2, cy = s / 2, r = s / 2 - 0.5
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r)
  grd.addColorStop(0, 'rgba(0,0,0,1)')
  grd.addColorStop(0.72, 'rgba(0,0,0,1)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()
  smokeTex = new THREE.CanvasTexture(c)
  smokeTex.colorSpace = THREE.NoColorSpace
  return smokeTex
}

export function createSmoke({ scene, camera } = {}) {
  const particles = []
  const dummy = new THREE.Object3D()
  const _cam = new THREE.Vector3()
  const _col = new THREE.Color()

  const geo = new THREE.PlaneGeometry(1, 1)
  const mat = new THREE.ShaderMaterial({
    name: 'SmokePuff',
    uniforms: { map: { value: smokeCircleTexture() } },
    vertexShader: SMOKE_VERT,
    fragmentShader: SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, SMOKE_MAX)
  mesh.name = 'SmokeInst'
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_MAX * 3), 3)
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
  scene.add(mesh)

  function add(origin, onFire) {
    if (particles.length >= SMOKE_MAX) return
    const vigor = onFire ? 1.25 : 0.85
    particles.push({
      born: 0,
      life: rand(0.9, 1.85),
      x: origin.x + rand(-0.07, 0.07),
      y: origin.y + rand(0.02, 0.1),
      z: origin.z + rand(-0.07, 0.07),
      vx: rand(-0.22, 0.22),
      vy: rand(0.38, 0.92) * vigor,
      vz: rand(-0.22, 0.22),
      size0: rand(0.1, 0.2),
      size1: rand(0.32, 0.58) * vigor,
      onFire: !!onFire,
    })
  }

  function emit(origin, onFire) {
    add(origin, onFire)
  }

  function update(dt) {
    dt = Math.min(dt, 0.08)

    let i = 0
    while (i < particles.length) {
      const p = particles[i]
      p.born += dt
      if (p.born >= p.life) {
        particles[i] = particles[particles.length - 1]
        particles.pop()
        continue
      }
      p.vy += 0.12 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.vx *= 1 - 0.35 * dt
      p.vz *= 1 - 0.35 * dt
      i++
    }

    if (camera) camera.getWorldPosition(_cam)
    mesh.count = particles.length
    for (let s = 0; s < particles.length; s++) {
      const p = particles[s]
      const t = Math.min(1, p.born / p.life)
      const size = p.size0 + (p.size1 - p.size0) * t
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.set(size, size, 1)
      dummy.lookAt(_cam)
      dummy.updateMatrix()
      mesh.setMatrixAt(s, dummy.matrix)
      _col.copy(p.onFire ? SMOKE_FIRE : SMOKE_CHAR)
      mesh.setColorAt(s, _col)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.visible = particles.length > 0
  }

  function dump() {
    return { count: particles.length }
  }

  return { emit, update, dump, get count() { return particles.length }, max: SMOKE_MAX }
}
