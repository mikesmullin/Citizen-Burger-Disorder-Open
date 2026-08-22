// First-person arms + grab/drop, from FirstPersonControl.cs.
// Q / LeftHand, E / RightHand, Fire1 (LMB) / Fire2 (RMB).
// Museum food exhibits spawn a *copy* into the hand; the pedestal stays.

import * as THREE from 'three'
import { hideTriggers } from '../common/unityScene.js'

const ARM_EXTRA = 1.2
const MAX_PITCH = 86
const GRAB_RANGE = 4.75
const HOLD_LERP = 30
const ARM_POS_LERP = 25
const ARM_ROT_LERP = 20
// Held item sits in front of the white cube, toward view center (PickupObject
// default: hand.position + hand.forward * 2). Tuned to the FPS screenshot.
const HOLD_FWD = 0.42
const HOLD_IN = 0.10
const HOLD_UP = 0.06
const HAND_FLOOR = 0.12

export function createHands({ scene, player, armProto, foodWorld, exhibits, foodProtos, getRats, onDrop, spawnSwatch, spawnPoster } = {}) {
  hideTriggers(armProto)

  function makeArm(side) {
    const object = armProto.clone(true)
    object.name = side + '-arm'
    object.visible = false
    // Viewmodel: parent to the camera so they stay in the bottom of the
    // frame like the original FPS shot (orange beams, white cube hands).
    player.camera.add(object)
    const sign = side === 'left' ? -1 : 1
    object.position.set(sign * 0.70, -0.62, -0.82)
    object.rotation.set(THREE.MathUtils.degToRad(22), 0, 0)
    object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    const hand = object.getObjectByName('hand') || object.children[0]
    return {
      side, object, hand,
      holding: null,
      history: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    }
  }

  const left = makeArm('left')
  const right = makeArm('right')
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)
  const _pos = new THREE.Vector3()
  const _fwd = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _goal = new THREE.Vector3()
  const _q = new THREE.Quaternion()
  const _eul = new THREE.Euler()
  const _world = new THREE.Vector3()
  let armScale = 1

  function setScale(mul) {
    armScale = Math.max(0.05, mul)
    left.object.scale.setScalar(armScale)
    right.object.scale.setScalar(armScale)
  }

  function camPitch() {
    return player.pitch
  }

  function armReach() {
    return ARM_EXTRA * Math.min(1, Math.abs(camPitch()) / MAX_PITCH)
  }

  function placeArm(arm, dt, active) {
    const sign = arm.side === 'left' ? -1 : 1
    const extra = armReach() * 0.35
    // Raised = original FPS pose. Hidden = below the frustum, then we lerp
    // up (FirstPersonControl Vector3.Lerp(..., 25*dt)). Invisible only once parked.
    const raised = _goal.set(sign * 0.70, -0.62, -0.82 - extra).clone()
    const hidden = new THREE.Vector3(sign * 0.70, -2.4, -0.50)
    const target = active ? raised : hidden
    if (active && !arm.object.visible) {
      arm.object.position.copy(hidden)
      arm.object.visible = true
    }
    arm.object.position.lerp(target, Math.min(1, ARM_POS_LERP * dt))
    _eul.set(THREE.MathUtils.degToRad(22), 0, 0)
    _q.setFromEuler(_eul)
    arm.object.quaternion.slerp(_q, Math.min(1, ARM_ROT_LERP * dt))
    // Keep the white cube above the floor when looking down (viewmodel is
    // camera-parented, so pitch would otherwise drive it through the ground).
    if (active && arm.hand) {
      arm.object.updateMatrixWorld(true)
      arm.hand.getWorldPosition(_world)
      const gy = player.groundY ? player.groundY(_world.x, _world.z) : 0
      const minY = gy + HAND_FLOOR * armScale
      if (_world.y < minY) {
        arm.object.getWorldPosition(_pos)
        _pos.y += minY - _world.y
        player.camera.worldToLocal(_pos)
        arm.object.position.copy(_pos)
      }
    }
    if (!active && arm.object.position.distanceTo(hidden) < 0.15) {
      arm.object.visible = false
    }
  }

  function recordHistory(arm) {
    if (!arm.holding) return
    const p = arm.holding.object.position
    arm.history[0].copy(arm.history[1])
    arm.history[1].copy(arm.history[2])
    arm.history[2].copy(p)
  }

  function holdPose(arm, dt) {
    const item = arm.holding
    if (!item) return
    if (arm.hand) arm.hand.getWorldPosition(_pos)
    else arm.object.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    _pos.addScaledVector(_fwd, HOLD_FWD * armScale)
    _right.set(1, 0, 0).transformDirection(player.camera.matrixWorld)
    const inward = arm.side === 'left' ? 1 : -1
    _pos.addScaledVector(_right, inward * HOLD_IN * armScale)
    _pos.y += HOLD_UP * armScale
    const gy = player.groundY ? player.groundY(_pos.x, _pos.z) : 0
    const half = (item.height || 0.1) * 0.5
    if (_pos.y < gy + half + 0.02) _pos.y = gy + half + 0.02
    item.object.position.lerp(_pos, Math.min(1, HOLD_LERP * dt))
    item.object.quaternion.slerp(arm.object.getWorldQuaternion(_q), Math.min(1, HOLD_LERP * dt))
    item.vel.set(0, 0, 0)
    recordHistory(arm)
  }

  function grabItem(arm, item) {
    if (!item || item.held || item.opened) return
    // Food a rat is carrying is stolen; the rat itself uses .stolen as its morsel.
    if (item.kind !== 'rat' && item.stolen) return
    item.held = true
    item.onFloor = false
    item.dropped = false
    if (item.fromSpawner && item.fromSpawner.item === item) item.fromSpawner.item = null
    item.fromSpawner = null
    arm.holding = item
    for (const h of arm.history) h.copy(item.object.position)
  }

  function spawnCopy(arm, rec) {
    const proto = foodProtos[rec.slug]
    if (!proto) return
    player.camera.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    const item = foodWorld.spawn({
      proto, type: rec.foodType || 'other', slug: rec.slug,
      x: _pos.x + _fwd.x, z: _pos.z + _fwd.z,
      y: _pos.y, onFloor: false,
    })
    grabItem(arm, item)
  }

  function drop(arm) {
    const item = arm.holding
    if (!item) return
    item.held = false
    if (arm.hand) {
      arm.hand.getWorldPosition(_pos)
      arm.hand.getWorldDirection(_fwd)
      item.object.position.copy(_pos).addScaledVector(_fwd, 0.8)
    }
    const d = arm.history[2].distanceTo(arm.history[1])
    if (d > 0.12) {
      _fwd.copy(arm.history[2]).sub(arm.history[1])
      if (_fwd.lengthSq() > 1e-6) {
        _fwd.normalize()
        item.vel.copy(_fwd).multiplyScalar(Math.min(14, d * 18))
        item.vel.y += 1.2
      }
    } else {
      player.camera.getWorldDirection(_fwd)
      item.vel.copy(_fwd).multiplyScalar(2.5)
      item.vel.y = 0.4
    }
    item.dropped = true
    arm.holding = null
    if (onDrop) onDrop(item)
  }

  function pickTarget() {
    player.object.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObjects(scene.children, true)

    for (const h of hits) {
      if (h.distance > GRAB_RANGE) continue
      const ratHit = h.object.userData.rat
      if (ratHit && !ratHit.held) {
        return { kind: 'rat', item: ratHit, dist: h.distance }
      }
      const food = h.object.userData.food
      if (food && food.stolen && food.stolen.kind === 'rat' && !food.stolen.held) {
        return { kind: 'rat', item: food.stolen, dist: h.distance }
      }
      if (food && !food.held && !food.opened && !food.stolen) {
        return { kind: 'food', item: food, dist: h.distance }
      }
      const poster = h.object.userData.poster
      if (poster && h.object.userData.posterKiosk) {
        return { kind: 'poster', spec: poster, dist: h.distance }
      }
      const bin = h.object.userData.swatchBin
      if (bin) return { kind: 'swatchBin', spec: bin, dist: h.distance }
      const rec = h.object.userData.exhibit
      if (rec && rec.foodType && foodProtos[rec.slug]) {
        return { kind: 'exhibit', rec, dist: h.distance }
      }
    }
    // SphereCast equivalent — floor cheese is a thin slab the centre ray often misses.
    player.camera.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    let best = null, bestD = GRAB_RANGE, bestKind = 'food'
    const consider = (item, kind, minD = 0.2) => {
      if (!item || item.held || item.opened) return
      if (kind !== 'rat' && item.stolen) return
      const dx = item.position.x - _pos.x
      const dy = item.position.y - _pos.y
      const dz = item.position.z - _pos.z
      const d = Math.hypot(dx, dy, dz)
      if (d > bestD || d < minD) return
      const nd = 1 / d
      if (_fwd.x * dx * nd + _fwd.y * dy * nd + _fwd.z * dz * nd < 0.65) return
      best = item
      bestD = d
      bestKind = kind
    }
    for (const item of foodWorld.items) consider(item, 'food')
    const den = getRats && getRats()
    for (const rat of den ? den.rats : []) consider(rat, 'rat')
    if (best) return { kind: bestKind, item: best, dist: bestD }
    let bestEx = null
    bestD = GRAB_RANGE
    for (const rec of exhibits) {
      if (!rec.foodType || !foodProtos[rec.slug]) continue
      const dx = rec.x - _pos.x, dy = 1.1 - _pos.y, dz = rec.z - _pos.z
      const d = Math.hypot(dx, dy, dz)
      if (d > bestD || d < 0.4) continue
      const nd = 1 / d
      if (_fwd.x * dx * nd + _fwd.y * dy * nd + _fwd.z * dz * nd < 0.72) continue
      bestEx = rec
      bestD = d
    }
    if (bestEx) return { kind: 'exhibit', rec: bestEx, dist: bestD }
    return null
  }

  function update(dt, opts = {}) {
    dt = Math.min(dt, 0.1)
    const grab = opts.grab !== false
    const rightOk = opts.right !== false
    const lActive = player.leftHand
    const rActive = player.rightHand && rightOk
    placeArm(left, dt, lActive || !!left.holding)
    placeArm(right, dt, rActive || !!right.holding)

    if (player.locked && grab) {
      if (player.fire1Down && lActive && !left.holding) {
        const t = pickTarget()
        if (t?.kind === 'food' || t?.kind === 'rat') grabItem(left, t.item)
        else if (t?.kind === 'exhibit') spawnCopy(left, t.rec)
        else if (t?.kind === 'swatchBin' && spawnSwatch) grabItem(left, spawnSwatch(t.spec))
        else if (t?.kind === 'poster' && spawnPoster) grabItem(left, spawnPoster(t.spec))
      }
      if (player.fire2Down && rActive && !right.holding) {
        const t = pickTarget()
        if (t?.kind === 'food' || t?.kind === 'rat') grabItem(right, t.item)
        else if (t?.kind === 'exhibit') spawnCopy(right, t.rec)
        else if (t?.kind === 'swatchBin' && spawnSwatch) grabItem(right, spawnSwatch(t.spec))
        else if (t?.kind === 'poster' && spawnPoster) grabItem(right, spawnPoster(t.spec))
      }
    }
    if (player.locked) {
      if (player.fire1Up && left.holding) drop(left)
      if (player.fire2Up && right.holding) drop(right)
    }

    if (left.holding) holdPose(left, dt)
    if (right.holding) holdPose(right, dt)

    if (!lActive && left.holding) { /* keep showing arm while holding */ }
    if (!lActive && !left.holding) left.object.visible = false
    if (!rActive && !right.holding) right.object.visible = false
  }

  function holdingLabel() {
    const a = left.holding?.type || (left.holding?.kind === 'rat' ? 'rat' : null)
    const b = right.holding?.type || (right.holding?.kind === 'rat' ? 'rat' : null)
    if (a && b) return a + ' + ' + b
    return a || b || ''
  }

  return {
    left, right, update, pickTarget, holdingLabel, setScale,
    get armScale() { return armScale },
  }
}
