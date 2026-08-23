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
