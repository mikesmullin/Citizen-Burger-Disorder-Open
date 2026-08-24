// Flamable.cs + FireAnimate.cs + FireWatch.cs
// Grill heat chars food until it ignites. Nearby flamables catch.
// A Fire podium copy is holdable; on landing it plants an ungrabbable blaze.
// Spray PutOut. Extinguisher / tools / boxes / tips never burn.

import * as THREE from 'three'
import { hideTriggers } from '../common/unityScene.js'
import { isFood, isTool, cookTick, foodWorldPos } from './food.js'
import { detachFromDish, dishRoot } from './stacking.js'
import { getListener, loadBuffer, safePlay } from '../common/audio.js'
import { createSmoke } from './spray.js'

export const BURN_HEALTH = 8
const IGNITE_OVERCOOK = 0.85
const FIRE_COOK = 2
const ASH_DELAY = 1
const CONSUME_DELAY = 3
const SPREAD_R = 1.7
const SPREAD_R_LARGE = 2.6
const CONTACT_R = 0.8
const MAX_FIRES = 28
const MAX_LARGE = 6
const BIG_NEIGHBORS = 3
const COOLDOWN = 6
const PLAYER_CATCH = 2.4

const _cam = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _other = new THREE.Vector3()

export function isFlammable(item) {
  if (!item) return false
  if (item.planted || item.type === 'fire') return false
  if (item.kind === 'tool' || isTool(item.type)) return false
  if (item.type === 'box' || item.type === 'tip') return false
  if (item.type === 'plate') return true
  if (item.type === 'rat' || item.kind === 'rat') return true
  return isFood(item.type)
}

function styleFire(root) {
  hideTriggers(root)
  const drop = []
  root.traverse(o => { if (o.isLight) drop.push(o) })
  for (const L of drop) { if (L.parent) L.parent.remove(L) }
  root.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = o.receiveShadow = false
    const map = o.material && o.material.map
    o.material = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  })
}

function faceYaw(root, cam) {
  root.getWorldPosition(_pos)
  root.rotation.y = Math.atan2(cam.x - _pos.x, cam.z - _pos.z)
}

export function createFireWatch({
  scene, player, foodWorld, getRats, getHands, fireProto, instancer,
} = {}) {
  const fires = []
  const smoke = createSmoke({ scene, camera: player && player.camera })
  let proto = fireProto || null
  let bigAcc = 0
  let playerBurn = PLAYER_CATCH
  let playerFire = null
  let nextId = 1

  let listener = null
  let pattyBuf = null
  loadBuffer('./assets/audio/sfx/Patty.mp3', (buf, lis) => {
    pattyBuf = buf
    listener = lis
    for (const f of fires) syncSizzle(f)
  }, err => console.warn('[fire] patty sfx', err))

  // Pedestal Fire / a held torch copy is not burning anything — no sfx.
  function shouldSizzle(f) {
    return !!(f && !f.out && hasFuel(f))
  }

  function startSizzle(f) {
    if (!shouldSizzle(f) || f.sizzle || !pattyBuf || !f.root) return
    const lis = listener || getListener()
    if (!lis) return
    listener = lis
    const a = new THREE.PositionalAudio(lis)
    a.setBuffer(pattyBuf)
    a.setLoop(true)
    a.setRefDistance(f.large ? 3.6 : 2.4)
    a.setMaxDistance(f.large ? 24 : 16)
    a.setRolloffFactor(1)
    a.setVolume(f.large ? 1.0 : 0.85)
    if (pattyBuf.duration) a.offset = Math.random() * pattyBuf.duration
    f.root.add(a)
    f.sizzle = a
    safePlay(a)
  }

  function syncSizzle(f) {
    if (shouldSizzle(f)) {
      if (f.sizzle) {
        if (pattyBuf && !f.sizzle.isPlaying) safePlay(f.sizzle)
      } else {
        startSizzle(f)
      }
    } else {
      stopSizzle(f)
    }
  }

  function stopSizzle(f) {
    if (!f?.sizzle) return
    try { if (f.sizzle.isPlaying) f.sizzle.stop() } catch (_) { /* ignore */ }
    if (f.sizzle.parent) f.sizzle.parent.remove(f.sizzle)
    f.sizzle = null
  }

  function setProto(p) {
    proto = p || proto
    if (proto) styleFire(proto)
  }

  function cloneFlame(scale = 1) {
    let root
    if (proto) {
      root = proto.clone(true)
    } else {
      const map = new THREE.TextureLoader().load('./assets/textures/Fire.png')
      map.colorSpace = THREE.SRGBColorSpace
      map.flipY = true
      const mat = new THREE.MeshBasicMaterial({
        map, color: 0xffffff, transparent: true, alphaTest: 0.45,
        depthWrite: false, side: THREE.DoubleSide,
      })
      root = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.95), mat)
      root.name = 'Fire'
    }
    styleFire(root)
    if (scale !== 1) root.scale.multiplyScalar(scale)
    return root
  }

  function addFire({ root, item = null, planted = false, large = false, copy = false, onPlayer = false } = {}) {
    if (!root) return null
    const live = fires.filter(x => !x.out)
    if (live.length >= MAX_FIRES) return null
    if (large && live.filter(x => x.large && !x.out).length >= MAX_LARGE) return null
    const f = {
      id: nextId++,
      root, item, planted, large, copy, onPlayer,
      out: false,
      next: 0.1 + Math.random() * 0.2,
      born: 0,
      hitR: onPlayer ? 1.4 : (large ? 1.5 : (planted || copy ? 0.95 : 0.7)),
    }
    f.putOut = () => extinguish(f)
    if (!copy && root.parent !== scene) scene.add(root)
    fires.push(f)
    if (instancer && root) instancer.attach(root, { fire: f }, 'fire')
    syncSizzle(f)
    return f
  }

  function fireOf(item) {
    return fires.find(f => !f.out && f.item === item) || null
  }

  // Attached to food/rat/plate that is actually burning. A planted podium
  // copy, a cluster blaze, or a leftover sprite with no host is an orphan.
  function hasFuel(f) {
    if (!f || f.out || f.onPlayer) return false
    const item = f.item
    if (!item || item.consumed) return false
    if (item.type === 'fire' || item.planted) return false
    if (item.onFire === false) return false
    return true
  }

  function takeCopy(item) {
    if (!item || !item.object) return null
    styleFire(item.object)
    item.type = 'fire'
    item.kind = 'fire'
    item.onFire = true
    item.planted = false
    const existing = fireOf(item)
    if (existing) return existing
    const f = addFire({ root: item.object, item, planted: false, copy: true })
    item.onLand = () => plantDropped(item)
    return f
  }

  function plantDropped(item) {
    if (!item || item.planted) return fireOf(item)
    item.held = false
    item.planted = true
    item.onFire = true
    item.dropped = true
    if (item.vel) item.vel.set(0, 0, 0)
    item.object.traverse(o => { o.raycast = () => {} })
    let f = fireOf(item)
    if (!f) f = addFire({ root: item.object, item, planted: true, copy: true })
    if (f) {
      f.planted = true
      f.hitR = 0.95
    }
    return f
  }

  function ignite(item) {
    if (!item || item.onFire || item.planted) return fireOf(item)
    if (!isFlammable(item)) return null
    item.onFire = true
    item.wasOnFire = true
    item.burnHealth = -1
    const root = cloneFlame(item.type === 'rat' || item.kind === 'rat' ? 0.85 : 0.7)
    const f = addFire({ root, item, planted: false, copy: false })
    if (f) placeOnItem(f)
    return f
  }

  function plantAt(x, y, z, { large = false } = {}) {
    const root = cloneFlame(large ? 2.6 : 1)
    root.position.set(x, y, z)
    return addFire({ root, item: null, planted: true, large, copy: false })
  }

  function placeOnItem(f) {
    if (!f || !f.item || !f.item.object) return
    const p = foodWorldPos(f.item)
    const h = Math.max(0.08, f.item.height || 0.12)
    f.root.position.set(p.x, p.y + h * 0.35, p.z)
  }

  function extinguish(f) {
    if (!f || f.out) return
    f.out = true
    stopSizzle(f)
    if (instancer && f.root) instancer.detach(f.root)
    const item = f.item
    if (item) {
      item.onFire = false
      item.fireCooldown = COOLDOWN
      item.burnHealth = BURN_HEALTH
      if (item.type === 'fire' || f.planted && f.copy) {
        if (foodWorld && foodWorld.destroy) foodWorld.destroy(item)
        f.item = null
      }
    }
    if (f.root) {
      f.root.visible = false
      if (f.copy && !f.root.parent) { /* foodWorld.destroy already removed it */ }
      else {
        if (f.root.parent) f.root.parent.remove(f.root)
        scene.remove(f.root)
      }
    }
    if (f.onPlayer) {
      playerFire = null
      playerBurn = PLAYER_CATCH
    }
    const i = fires.indexOf(f)
    if (i >= 0) fires.splice(i, 1)
  }

  function putOutItem(item) {
    if (!item) return
    const f = fireOf(item)
    if (f) extinguish(f)
    item.onFire = false
    item.fireCooldown = COOLDOWN
  }

  function consume(item) {
    if (!item || item.consumed) return
    item.consumed = true
    if (item.cookAudio) {
      try { if (item.cookAudio.isPlaying) item.cookAudio.stop() } catch (_) { /* ignore */ }
      item.cookAudio = null
    }
    if (item.type === 'plate') {
      const root = dishRoot(item)
      if (root && root !== item && root.stack) {
        detachFromDish(item)
      } else if (item.stack && item.stack.length) {
        for (const p of item.stack) {
          if (!p) continue
          p.inFood = false
          p.stackedOn = null
          p.held = false
        }
        item.stack = []
      }
    }
    if (item.stack) {
      for (const f of item.stack) {
        if (!f) continue
        f.inFood = false
        f.stackedOn = null
        f.held = false
      }
    }
    if (item.plated) {
      item.plated.inFood = false
      item.plated.onPlate = null
      item.plated.stackedOn = null
    }
    const bun = item.stackedOn && item.stackedOn.type === 'bun' ? item.stackedOn : null
    if (bun && bun.stack) {
      bun.stack = bun.stack.filter(f => f !== item)
      bun.complete = bun.stack.some(f => f.type === 'topBun')
    }
    if (item.onPlate && item.onPlate.plated === item) item.onPlate.plated = null
    item.inFood = false
    item.stackedOn = null
    item.onPlate = null
    item.held = false

    const flame = fireOf(item)
    if (flame) extinguish(flame)

    const hands = getHands && getHands()
    if (hands) {
      for (const arm of [hands.left, hands.right]) {
        if (arm && arm.holding === item) arm.holding = null
      }
    }

    const den = getRats && getRats()
    if ((item.kind === 'rat' || item.type === 'rat') && den && den.remove) {
      if (foodWorld) foodWorld.destroy(item)
      den.remove(item)
    } else if (foodWorld) {
      foodWorld.destroy(item)
    }
  }

  function isSmoking(item) {
    if (!item || item.consumed || item.planted) return false
    if (item.onFire) return true
    return !!(item.onGrill && (item.overcooked || 0) > 0.02)
  }

  function emitSmoke(item, dt) {
    if (!smoke || !isSmoking(item)) {
      if (item) item.smokeAcc = 0
      return
    }
    const p = foodWorldPos(item)
    const rate = item.onFire ? 16 : 11
    item.smokeAcc = (item.smokeAcc || 0) + dt
    const interval = 1 / rate
    const origin = {
      x: p.x,
      y: p.y + Math.max(0.05, (item.height || 0.12) * 0.5),
      z: p.z,
    }
    while (item.smokeAcc >= interval && smoke.count < smoke.max) {
      item.smokeAcc -= interval
      smoke.emit(origin, !!item.onFire)
    }
  }

  function tickBurn(item, dt) {
    if (!item || item.type === 'fire' || item.planted) return
    if (item.fireCooldown > 0) item.fireCooldown = Math.max(0, item.fireCooldown - dt)
    if (!item.onFire && isFlammable(item) && (item.overcooked || 0) >= IGNITE_OVERCOOK) {
      ignite(item)
    }
    if (item.onFire) {
      cookTick(item, dt * FIRE_COOK)
      if ((item.overcooked || 0) >= 1) {
        item.ashTime = (item.ashTime || 0) + dt
        if (item.ashTime >= CONSUME_DELAY) consume(item)
      }
    }
  }

  function list() {
    return fires.filter(f => !f.out && f.root)
  }

  function flamables() {
    const out = []
    for (const item of foodWorld ? foodWorld.items : []) {
      if (isFlammable(item)) out.push(item)
    }
    const den = getRats && getRats()
    for (const rat of den ? den.rats : []) {
      if (isFlammable(rat) && !out.includes(rat)) out.push(rat)
    }
    return out
  }

  function spreadFrom(f, dt) {
    if (!f.root) return
    f.root.getWorldPosition(_pos)
    const radius = f.large ? SPREAD_R_LARGE : SPREAD_R
    for (const item of flamables()) {
      if (item.onFire) continue
      if (item.fireCooldown > 0) continue
      const p = foodWorldPos(item)
      if (!p) continue
      const dx = p.x - _pos.x, dy = (p.y || 0) - _pos.y, dz = p.z - _pos.z
      const d = Math.hypot(dx, dy, dz)
      if (d > radius) continue
      if (item.burnHealth == null) item.burnHealth = BURN_HEALTH
      const rate = f.large ? 5.2 : (d < CONTACT_R ? 6.0 : 2.4)
      item.burnHealth -= dt * rate
      if (item.burnHealth <= 0) ignite(item)
    }
  }

  function maybeBigFire(dt) {
    bigAcc += dt
    if (bigAcc < 1) return
    bigAcc = 0
    const small = fires.filter(f => !f.out && !f.large && !f.onPlayer)
    for (const f of small) {
      if (!f.root) continue
      f.root.getWorldPosition(_pos)
      let n = 0
      let ax = 0, ay = 0, az = 0
      for (const o of small) {
        if (o === f || !o.root) continue
        o.root.getWorldPosition(_other)
        const d = Math.hypot(_pos.x - _other.x, _pos.z - _other.z)
        if (d < SPREAD_R) {
          n++
          ax += _other.x; ay += _other.y; az += _other.z
        }
      }
      if (n < BIG_NEIGHBORS) continue
      if (fires.some(x => !x.out && x.large && Math.hypot(x.root.position.x - _pos.x, x.root.position.z - _pos.z) < 2.2)) {
        continue
      }
      ax = (ax + _pos.x) / (n + 1)
      ay = (ay + _pos.y) / (n + 1)
      az = (az + _pos.z) / (n + 1)
      plantAt(ax, ay + 0.15, az, { large: true })
      break
    }
  }

  function updatePlayer(dt) {
    const pp = player.position
    let near = false
    for (const f of fires) {
      if (f.out || f.onPlayer || !f.root) continue
      f.root.getWorldPosition(_other)
      const d = Math.hypot(pp.x - _other.x, (pp.y + 1.0) - _other.y, pp.z - _other.z)
      const r = f.large ? 1.8 : 1.05
      if (d < r) { near = true; break }
    }
    const holdingFire = !!(player && foodWorld && foodWorld.items.some(i => i.held && i.onFire && i.type !== 'fireExtinguisher'))
    const spraying = !!(foodWorld && foodWorld.items.some(i => i.type === 'fireExtinguisher' && i.spraying))
    if (playerFire) {
      playerFire.root.position.set(pp.x, pp.y + 1.15, pp.z)
      if (spraying) extinguish(playerFire)
      return
    }
    if (near || holdingFire) {
      playerBurn -= dt * (holdingFire && !near ? 0.7 : 1.4)
      if (playerBurn <= 0) {
        const root = cloneFlame(1.05)
        playerFire = addFire({ root, onPlayer: true, planted: false })
        if (playerFire) playerFire.root.position.set(pp.x, pp.y + 1.15, pp.z)
      }
    } else {
      playerBurn = Math.min(PLAYER_CATCH, playerBurn + dt * 0.8)
    }
  }

  function update(dt) {
    dt = Math.min(dt, 0.1)
    player.camera.getWorldPosition(_cam)

    for (const item of [...(foodWorld ? foodWorld.items : [])]) {
      tickBurn(item, dt)
      emitSmoke(item, dt)
    }
    const den = getRats && getRats()
    for (const rat of [...(den ? den.rats : [])]) {
      if (foodWorld && foodWorld.items.includes(rat)) continue
      tickBurn(rat, dt)
      emitSmoke(rat, dt)
    }
    if (smoke) smoke.update(dt)

    for (const f of [...fires]) {
      if (f.out) continue
      f.born += dt
      f.next -= dt
      if (f.next <= 0 && f.root) {
        f.root.scale.x *= -1
        f.next = 0.1 + Math.random() * 0.2
      }
      if (f.copy && f.item && !f.planted && f.item.held) {
        // holdPose already placed the mesh; just billboard
      } else if (f.item && !f.copy && f.item.object) {
        placeOnItem(f)
      } else if (f.onPlayer) {
        const pp = player.position
        f.root.position.set(pp.x, pp.y + 1.15, pp.z)
      }
      if (f.root && f.root.visible !== false) faceYaw(f.root, _cam)
      syncSizzle(f)
      spreadFrom(f, dt)
      if (!f.onPlayer && !hasFuel(f) && !(f.copy && f.item && f.item.held)) {
        f.orphanTime = (f.orphanTime || 0) + dt
        if (f.orphanTime >= ASH_DELAY) extinguish(f)
      } else {
        f.orphanTime = 0
      }
    }

    maybeBigFire(dt)
    updatePlayer(dt)
  }

  function dump() {
    return fires.filter(f => !f.out).map(f => {
      const p = f.root ? f.root.position : { x: 0, y: 0, z: 0 }
      return {
        id: f.id,
        planted: !!f.planted,
        large: !!f.large,
        copy: !!f.copy,
        player: !!f.onPlayer,
        attached: f.item ? (f.item.type || f.item.kind || null) : null,
        orphanTime: +(f.orphanTime || 0).toFixed(2),
        pos: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) },
        smoke: smoke ? smoke.count : 0,
      }
    })
  }

  return {
    update, list, dump, ignite, takeCopy, plantDropped, plantAt,
    putOut: extinguish, putOutItem, setProto, isFlammable,
    get fires() { return fires },
    get playerOnFire() { return !!playerFire && !playerFire.out },
  }
}
