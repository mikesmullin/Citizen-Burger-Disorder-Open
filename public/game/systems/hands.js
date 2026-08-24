// First-person arms + grab/drop, from FirstPersonControl.cs.
// Q / LeftHand, E / RightHand, Fire1 (LMB) / Fire2 (RMB).
// Museum food exhibits spawn a *copy* into the hand; the pedestal stays.
// Held items are kinematic and parented to an unscaled hand socket so they
// stick to the viewmodel (no lag, no grill/world collision fight). A red
// drop reticle marks the gravity landing under each held item.

import * as THREE from 'three'
import { hideTriggers, boundsOf } from '../common/unityScene.js'
import { createInstancePool, visualMesh, hideVisuals } from '../common/instancePool.js'
import { isTool, applyCookState, setPlateDirty } from './food.js'
import { grabStackWith, layoutStack, layoutPlate, layoutDishStack, plateGrabTarget } from './stacking.js'
import { createSpray } from './spray.js'

const ARM_EXTRA = 1.2
const MAX_PITCH = 86
const GRAB_RANGE = 4.75
const ARM_POS_LERP = 25
const ARM_ROT_LERP = 20
const HOLD_PAST_HAND = 0.42
// Viewmodel grip: sit the item on the white hand cube (the original
// "tray" hold). Prefab heldPositionOffset is a small local nudge,
// not Unity's 2× along hand.forward (that lands on the forearm here).
const HOLD_NUDGE = { x: 0.22, y: 0.18, z: 0.10 }
const HOLD_DEFAULT = { x: 0, y: 1, z: 1 }
const HOLD_OFFSET = {
  cheese: { x: 0, y: 0, z: 1 },
  bacon: { x: 0, y: 0, z: 1 },
  lettuce: { x: 0, y: 0, z: 1 },
  patty: { x: 0, y: 0, z: 1 },
  tomato: { x: 0, y: 0, z: 1 },
  bun: { x: 0, y: 0, z: 1 },
  topBun: { x: 0, y: 0, z: 1 },
  plate: { x: 0, y: 0, z: 1 },
  lettuceHead: { x: 0, y: 1, z: 1 },
  lettucePart: { x: 0, y: 1, z: 1 },
  tip: { x: 0, y: 0.2, z: 1 },
  rat: { x: 0, y: 0.5, z: 1 },
  box: { x: 0, y: 1, z: 1 },
  fire: { x: 0, y: 1, z: 1 },
}
// Camera-local rest pose. Forward is −Z. Keep the shoulder close enough
// that looking down does not drive the hands through the floor.
const CAM_X = 0.58
const CAM_Y = -0.48
const CAM_Z = -0.32
const CAM_PITCH = 18
const RETICLE_SPIN = 0.45
const RETICLE_PULSE = 0.05
const RETICLE_PULSE_HZ = 0.575
const RETICLE_TINT = new THREE.Color(0xe31b1b)

const RETICLE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const RETICLE_FRAG = /* glsl */ `
uniform vec3 tint;
uniform sampler2D map;
varying vec2 vUv;
void main() {
  float a = texture2D(map, vUv).a;
  gl_FragColor = vec4(tint, a);
}
`

let reticleGeo = null
let reticleMat = null
function reticleAssets() {
  if (reticleGeo) return
  reticleGeo = new THREE.PlaneGeometry(1, 1)
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  g.clearRect(0, 0, s, s)
  const cx = s / 2, cy = s / 2
  g.strokeStyle = '#000000'
  g.fillStyle = '#000000'
  g.lineWidth = 14
  g.beginPath()
  g.arc(cx, cy, 108, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 8
  g.beginPath()
  g.arc(cx, cy, 64, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(cx, 20)
  g.lineTo(cx, s - 20)
  g.stroke()
  g.beginPath()
  g.moveTo(20, cy)
  g.lineTo(s - 20, cy)
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, 10, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  reticleMat = new THREE.ShaderMaterial({
    name: 'DropReticle',
    uniforms: {
      tint: { value: RETICLE_TINT },
      map: { value: tex },
    },
    vertexShader: RETICLE_VERT,
    fragmentShader: RETICLE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  })
}

function makeReticle() {
  reticleAssets()
  const mesh = new THREE.Mesh(reticleGeo, reticleMat)
  mesh.name = 'DropReticle'
  mesh.rotation.order = 'YXZ'
  mesh.rotation.x = -Math.PI / 2
  mesh.raycast = () => {}
  mesh.visible = false
  mesh.renderOrder = 12
  mesh.frustumCulled = false
  return mesh
}

export function createHands({ scene, player, armProto, armPool, foodWorld, exhibits, foodProtos, getRats, getFires, fireWatch, prepareBox, onDrop, spawnSwatch, spawnPoster } = {}) {
  hideTriggers(armProto)

  const armVis = visualMesh(armProto)
  const pool = armPool || (armVis ? createInstancePool({
    geometry: armVis.geometry,
    material: armVis.material.clone(),
    max: 2,
    scene,
    name: 'FpsArmInst',
  }) : null)

  function makeArm(side) {
    const object = armProto.clone(true)
    object.name = side + '-arm'
    object.visible = false
    object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const shoulderZ = box.max.z
    object.position.set(0, 0, -shoulderZ)
    const pivot = new THREE.Group()
    pivot.name = side + '-shoulder'
    const sign = side === 'left' ? -1 : 1
    pivot.position.set(sign * CAM_X, CAM_Y, CAM_Z)
    pivot.add(object)
    player.camera.add(pivot)
    const hand = object.getObjectByName('hand') || object.children[0]
    const vis = visualMesh(object)
    const slot = pool && vis ? pool.alloc() : -1
    if (slot >= 0) {
      hideVisuals(object)
      pool.hide(slot)
    }
    const downX = THREE.MathUtils.degToRad(CAM_PITCH - 105)
    pivot.rotation.x = downX
    const socket = new THREE.Group()
    socket.name = side + '-hold'
    pivot.add(socket)
    const reticle = makeReticle()
    scene.add(reticle)
    return {
      side, object, pivot, hand, socket, reticle,
      baseScale: object.scale.clone(),
      shoulderZ,
      pitchX: downX,
      holding: null,
      history: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      visual: vis,
      pool,
      slot,
    }
  }

  const left = makeArm('left')
  const right = makeArm('right')
  const spray = createSpray({ scene, camera: player.camera })
  const sprayNozzle = {
    left: { origin: new THREE.Vector3(), dir: new THREE.Vector3() },
    right: { origin: new THREE.Vector3(), dir: new THREE.Vector3() },
  }
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)
  const _pos = new THREE.Vector3()
  const _fwd = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _q = new THREE.Quaternion()
  const _pq = new THREE.Quaternion()
  const _world = new THREE.Vector3()
  const _camFwd = new THREE.Vector3()
  const _hs = new THREE.Vector3()
  const _hitN = new THREE.Vector3()
  const _hitM = new THREE.Matrix4()
  let armScale = 1

  function hitUp(h) {
    if (h.normal) return h.normal.y
    if (!h.face || !h.object) return 0
    _hitN.copy(h.face.normal)
    if (h.object.isInstancedMesh && h.instanceId != null) {
      h.object.getMatrixAt(h.instanceId, _hitM)
      _hitN.transformDirection(_hitM)
    } else {
      _hitN.transformDirection(h.object.matrixWorld)
    }
    _hitN.normalize()
    return _hitN.y
  }

  function setScale(mul) {
    armScale = Math.max(0.05, mul)
    for (const arm of [left, right]) {
      arm.object.scale.copy(arm.baseScale).multiplyScalar(armScale)
      arm.object.position.z = -arm.shoulderZ * armScale
    }
  }

  function camPitch() {
    return player.pitch
  }

  function armReach() {
    return ARM_EXTRA * Math.min(1, Math.abs(camPitch()) / MAX_PITCH)
  }

  function placeArm(arm, dt, active) {
    const sign = arm.side === 'left' ? -1 : 1
    const extra = armReach()
    // Negative pitch is look-down (MouseLook). Pull the shoulder toward the
    // camera so the hands stay above the floor instead of along the look ray.
    const lookDown = Math.max(0, -player.pitch / MAX_PITCH)
    const lookUp = Math.max(0, player.pitch / MAX_PITCH)
    arm.pivot.position.set(
      sign * CAM_X,
      CAM_Y + lookDown * 0.12,
      CAM_Z + lookDown * 0.58 - lookUp * extra * 0.45,
    )
    const upX = THREE.MathUtils.degToRad(CAM_PITCH)
    const downX = THREE.MathUtils.degToRad(CAM_PITCH - 105)
    const want = active ? upX : downX
    arm.pitchX = THREE.MathUtils.lerp(arm.pitchX, want, Math.min(1, ARM_ROT_LERP * dt))
    arm.pivot.rotation.x = arm.pitchX
    if (active) arm.object.visible = true
    if (!active && Math.abs(arm.pitchX - downX) < 0.04) arm.object.visible = false
    if (arm.pool && arm.slot >= 0) {
      if (arm.object.visible && arm.visual) arm.pool.setFromObject(arm.slot, arm.visual)
      else arm.pool.hide(arm.slot)
    }
  }

  function recordHistory(arm) {
    if (!arm.holding || !arm.holding.object) return
    arm.holding.object.getWorldPosition(_world)
    arm.history[0].copy(arm.history[1])
    arm.history[1].copy(arm.history[2])
    arm.history[2].copy(_world)
  }

  function holdSpec(item) {
    return HOLD_OFFSET[item.type] || HOLD_OFFSET[item.kind] || HOLD_DEFAULT
  }

  // Unscaled socket under the arm pivot, posed to the hand's world pos/rot
  // (decomposed, so the hand cube's non-uniform scale does not squash food).
  function syncSocket(arm) {
    const hand = arm.hand || arm.object
    hand.updateWorldMatrix(true, false)
    hand.getWorldPosition(_pos)
    hand.getWorldQuaternion(_q)
    _up.set(0, 1, 0).applyQuaternion(_q)
    hand.getWorldScale(_hs)
    _pos.addScaledVector(_up, 0.5 * Math.abs(_hs.y || 1))
    arm.pivot.updateWorldMatrix(true, false)
    arm.pivot.worldToLocal(_pos)
    arm.socket.position.copy(_pos)
    arm.pivot.getWorldQuaternion(_pq)
    arm.socket.quaternion.copy(_pq).invert().multiply(_q)
  }

  function parentHeld(arm, item) {
    if (!item || !item.object) return
    if (item.object.parent === arm.socket) return
    arm.socket.attach(item.object)
    item.kinematic = true
  }

  function unparentHeld(item) {
    if (!item || !item.object) return
    if (!item.object.parent || item.object.parent === scene) {
      item.kinematic = false
      return
    }
    item.object.updateWorldMatrix(true, true)
    scene.attach(item.object)
    item.kinematic = false
  }

  function holdPose(arm, dt) {
    const item = arm.holding
    if (!item || !item.object) return
    syncSocket(arm)
    parentHeld(arm, item)
    const s = armScale
    const half = (item.height || 0.1) * 0.5
    if (isTool(item.type)) {
      item.object.position.set(0, 0, -HOLD_PAST_HAND * s)
    } else {
      const off = holdSpec(item)
      const sign = arm.side === 'right' ? -1 : 1
      item.object.position.set(
        off.x * sign * HOLD_NUDGE.x * s,
        off.y * HOLD_NUDGE.y * s + half,
        off.z * HOLD_NUDGE.z * s,
      )
    }
    item.object.quaternion.identity()
    if (item.vel) item.vel.set(0, 0, 0)
    if (item.type === 'plate') {
      if (item.plated) layoutPlate(item)
      if (item.stack && item.stack.length) layoutDishStack(item)
    } else if (item.type === 'bun') layoutStack(item)
    recordHistory(arm)
  }

  function grabItem(arm, item) {
    if (!item || item.held || item.opened) return
    if (item.planted || (item.type === 'fire' && item.dropped && !item.held)) return
    // Food a rat is carrying is stolen; the rat itself uses .stolen as its morsel.
    if (item.kind !== 'rat' && item.stolen) return
    const bunch = grabStackWith(item)
    const hold = bunch[0] || item
    hold.held = true
    hold.onFloor = false
    hold.dropped = false
    if (hold.fromSpawner && hold.fromSpawner.item === hold) hold.fromSpawner.item = null
    hold.fromSpawner = null
    for (const f of bunch) {
      f.held = true
      f.onFloor = false
    }
    arm.holding = hold
    holdPose(arm, 0)
    for (const h of arm.history) hold.object.getWorldPosition(h)
  }

  function spawnCopy(arm, rec) {
    player.camera.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    const x = _pos.x + _fwd.x, z = _pos.z + _fwd.z, y = _pos.y
    if (rec.slug === 'mobs/Rat' || rec.pickup === 'rat') {
      const den = getRats && getRats()
      const rat = den && den.spawnAt(x, z)
      if (rat) {
        rat.position.y = y
        rat.onFloor = false
        grabItem(arm, rat)
      }
      return
    }
    const proto = foodProtos[rec.variantOf || rec.slug]
    if (!proto) return
    const type = rec.foodType || rec.pickup || 'other'
    const item = foodWorld.spawn({
      proto, type, slug: rec.variantOf || rec.slug,
      x, z, y, onFloor: false, instanced: false,
    })
    if (rec.cookState) applyCookState(item.object, rec)
    if (rec.slug === 'items/PlateDirty' || rec.cookState === 'dirty') {
      setPlateDirty(item)
    } else if (rec.cookState && String(rec.cookState).startsWith('bacon')) {
      item.instVariant = rec.cookState
    }
    if (foodWorld.watch) foodWorld.watch(item)
    if (type === 'fire' && fireWatch) fireWatch.takeCopy(item)
    if (type === 'box' && prepareBox) prepareBox(item)
    if (rec.display && !isTool(type)) {
      rec.display.updateMatrixWorld(true)
      rec.display.getWorldQuaternion(_q)
      item.object.quaternion.copy(_q)
    }
    grabItem(arm, item)
  }

  function drop(arm) {
    const item = arm.holding
    if (!item) return
    const bunch = grabStackWith(item)
    const d = arm.history[2].distanceTo(arm.history[1])
    unparentHeld(item)
    item.held = false
    for (const f of bunch) f.held = false
    if (!item.vel) item.vel = new THREE.Vector3()
    if (d > 0.12) {
      _fwd.copy(arm.history[2]).sub(arm.history[1])
      if (_fwd.lengthSq() > 1e-6) {
        _fwd.normalize()
        item.vel.copy(_fwd).multiplyScalar(Math.min(14, d * 18))
        item.vel.y += 1.2
      } else {
        item.vel.set(0, 0, 0)
      }
    } else {
      item.vel.set(0, 0, 0)
    }
    item.dropped = true
    item.onFloor = false
    if (item.kind === 'rat' || item.type === 'rat') {
      item.goingHome = false
      const den = getRats && getRats()
      if (den && den.holes && den.holes.length) {
        item.hole = den.holes[(Math.random() * den.holes.length) | 0]
      }
    }
    if (item.spraying) item.spraying = false
    arm.holding = null
    hideReticle(arm)
    if (onDrop) onDrop(item)
  }

  function releaseItem(item) {
    if (!item) return false
    for (const arm of [left, right]) {
      if (arm.holding !== item) continue
      const bunch = grabStackWith(item)
      unparentHeld(item)
      item.held = false
      for (const f of bunch) f.held = false
      if (item.spraying) item.spraying = false
      arm.holding = null
      hideReticle(arm)
      return true
    }
    return false
  }

  function hideReticle(arm) {
    if (arm.reticle) arm.reticle.visible = false
  }

  function surfaceBelow(x, z, fromY) {
    let y = player.floorY || 0
    let mat = 'floor'
    const plats = player.platforms || []
    for (const p of plats) {
      if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue
      let h = p.y
      if (p.z0 != null && p.y1 != null) {
        const span = p.z1 - p.z0
        const t = Math.max(0, Math.min(1, (z - p.z0) / (span || 1e-6)))
        h = p.y0 + (p.y1 - p.y0) * t
      }
      if (h > fromY + 0.35) continue
      if (h >= y) {
        y = h
        mat = p.mat || 'surface'
      }
    }
    return { y, mat }
  }

  function dropLanding(item) {
    if (!item || !item.object) return null
    item.object.updateWorldMatrix(true, true)
    const box = boundsOf(item.object)
    let x, y0, z, rad
    if (!box.isEmpty()) {
      x = (box.min.x + box.max.x) * 0.5
      z = (box.min.z + box.max.z) * 0.5
      y0 = box.min.y
      rad = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5
    } else {
      item.object.getWorldPosition(_world)
      x = _world.x
      z = _world.z
      y0 = _world.y - (item.height || 0.1) * 0.5
      rad = item.radius || 0.2
    }
    const fromY = y0 - 0.002
    const surf = surfaceBelow(x, z, fromY)
    let y = surf.y
    let mat = surf.mat
    for (const other of (foodWorld && foodWorld.items) || []) {
      if (!other || other === item || other.held || other.stolen || other.planted) continue
      if (!other.object) continue
      other.object.getWorldPosition(_pos)
      const dx = _pos.x - x, dz = _pos.z - z
      const reach = (other.radius || 0.2) + rad * 0.25
      if (dx * dx + dz * dz > reach * reach) continue
      const top = _pos.y + (other.height || 0.1) * 0.5
      if (top <= fromY + 0.08 && top > y + 0.008) {
        y = top
        mat = other.type
      }
    }
    return { x, y, z, mat }
  }

  function updateReticle(arm, dt) {
    const mesh = arm.reticle
    const item = arm.holding
    if (!mesh) return
    if (!item || !item.object) {
      mesh.visible = false
      return
    }
    const t = dropLanding(item)
    if (!t) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.position.set(t.x, t.y + 0.03, t.z)
    arm.reticlePulse = (arm.reticlePulse || 0) + dt
    const base = Math.max(0.32, (item.radius || 0.2) * 2.1) * 0.8
    const pulse = 1 + RETICLE_PULSE * Math.sin(arm.reticlePulse * RETICLE_PULSE_HZ * Math.PI * 2)
    mesh.scale.setScalar(base * pulse)
    mesh.rotation.y += dt * RETICLE_SPIN
    arm.dropAim = t
  }

  const knifeCd = { t: 0 }
  const spatulaHit = new Set()

  function playChop(pos) {
    if (foodWorld && foodWorld.sfx && foodWorld.sfx.chop) {
      foodWorld.sfx.chop(pos)
      return
    }
    try { new Audio('./assets/audio/sfx/Chopping.mp3').play() } catch (_) { /* ignore */ }
  }

  function toolOrigin(arm) {
    if (arm.hand) arm.hand.getWorldPosition(_pos)
    else arm.object.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    _pos.addScaledVector(_fwd, 0.55)
    return _pos
  }

  function nearbyFood(origin, range) {
    const out = []
    for (const item of foodWorld.items) {
      if (item.held || item.inFood) continue
      const d = Math.hypot(item.position.x - origin.x, item.position.y - origin.y, item.position.z - origin.z)
      if (d < range) out.push(item)
    }
    return out
  }

  function chopLettuce(item) {
    const pos = item.object.position
    if (item.type === 'lettuceHead') {
      playChop(pos)
      const proto = foodProtos['items/LettucePart']
      if (proto) {
        for (let i = 0; i < 2; i++) {
          const part = foodWorld.spawn({
            proto, type: 'lettucePart', slug: 'items/LettucePart',
            x: pos.x + (i ? 0.08 : -0.08), z: pos.z, y: pos.y + 0.05,
          })
          part.object.rotation.y = i ? Math.PI : 0
          part.vel.y = 1.2
        }
      }
      foodWorld.destroy(item)
      return
    }
    if (item.type === 'lettucePart') {
      playChop(pos)
      const proto = foodProtos['items/Lettuce']
      if (proto) {
        for (let i = 0; i < 3; i++) {
          const leaf = foodWorld.spawn({
            proto, type: 'lettuce', slug: 'items/Lettuce',
            x: pos.x + i * 0.1, z: pos.z, y: pos.y + 0.04,
          })
          leaf.object.rotation.z = -Math.PI / 2
          leaf.vel.y = 0.8
        }
      }
      foodWorld.destroy(item)
    }
  }

  function tryKnife(arm, dt) {
    knifeCd.t -= dt
    if (knifeCd.t > 0) return
    const o = toolOrigin(arm)
    for (const item of nearbyFood(o, 0.85)) {
      if (item.type === 'lettuceHead' || item.type === 'lettucePart') {
        chopLettuce(item)
        knifeCd.t = 0.3
        return
      }
      if (isTool(item.type) || item.type === 'plate') continue
      // KnifeTrigger: PhysicsFood gets a toss.
      item.vel.y += 6
      item.vel.x += _fwd.x * -3.5
      item.vel.z += _fwd.z * -3.5
      knifeCd.t = 0.3
      return
    }
  }

  function trySpatula(arm) {
    const o = toolOrigin(arm)
    for (const item of nearbyFood(o, 0.7)) {
      if (item.type === 'plate' || isTool(item.type)) continue
      const id = item
      if (spatulaHit.has(id)) continue
      spatulaHit.add(id)
      // SpatulaTrigger: up * 900 - forward * 500
      item.vel.y += 7.5
      item.vel.x += _fwd.x * -4
      item.vel.z += _fwd.z * -4
      setTimeout(() => spatulaHit.delete(id), 400)
    }
  }

  function extinguisherNozzle(arm, nozzle) {
    player.camera.getWorldDirection(nozzle.dir)
    if (arm.hand) arm.hand.getWorldPosition(nozzle.origin)
    else if (arm.holding?.object) arm.holding.object.getWorldPosition(nozzle.origin)
    else player.camera.getWorldPosition(nozzle.origin)
    nozzle.origin.addScaledVector(nozzle.dir, 0.35)
    nozzle.origin.y += 0.18
  }

  function toolUse(arm, dt) {
    const item = arm.holding
    if (!item) return
    if (item.type === 'knife') tryKnife(arm, dt)
    if (item.type === 'spatula') trySpatula(arm)
    if (item.type === 'fireExtinguisher') {
      const sprayBtn = arm.side === 'left' ? player.fire2 : player.fire1
      item.spraying = !!sprayBtn
      if (item.spraying) extinguisherNozzle(arm, sprayNozzle[arm.side])
    }
    if (item.type === 'bun') layoutStack(item)
    if (item.type === 'plate') {
      if (item.plated) layoutPlate(item)
      if (item.stack && item.stack.length) layoutDishStack(item)
    }
  }

  function pickTarget() {
    player.object.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObjects(scene.children, true)

    for (const h of hits) {
      if (h.distance > GRAB_RANGE) continue
      const ud = h.object.userData || {}
      const inst = (ud.byInstance && h.instanceId != null) ? ud.byInstance[h.instanceId] : null
      const ratHit = (inst && inst.rat) || ud.rat
      if (ratHit && !ratHit.held) {
        return { kind: 'rat', item: ratHit, dist: h.distance }
      }
      if (inst && inst.exhibit && inst.exhibit.pickup) {
        return { kind: 'exhibit', rec: inst.exhibit, dist: h.distance }
      }
      const food = (inst && inst.food) || h.object.userData.food
      if (food && food.stolen && food.stolen.kind === 'rat' && !food.stolen.held) {
        return { kind: 'rat', item: food.stolen, dist: h.distance }
      }
      if (food && food.type === 'plate' && !food.held && !food.opened) {
        const grab = plateGrabTarget(food, h.point, hitUp(h))
        if (grab && !grab.held) return { kind: 'food', item: grab, dist: h.distance }
      }
      if (food && food.inFood && (food.stackedOn || food.onPlate)) {
        const root = food.onPlate || food.stackedOn
        return { kind: 'food', item: root.onPlate || root, dist: h.distance }
      }
      if (food && !food.held && !food.opened && !food.stolen && !food.inFood
        && !food.planted && food.type !== 'fire') {
        return { kind: 'food', item: food, dist: h.distance }
      }
      const poster = h.object.userData.poster
        || (inst && inst.poster)
      const posterKiosk = h.object.userData.posterKiosk || (inst && inst.posterKiosk)
      if (poster && posterKiosk) {
        return { kind: 'poster', spec: poster, dist: h.distance }
      }
      const bin = h.object.userData.swatchBin
      if (bin) return { kind: 'swatchBin', spec: bin, dist: h.distance }
      const rec = h.object.userData.exhibit
      if (rec && rec.pickup && foodProtos[rec.variantOf || rec.slug]) {
        return { kind: 'exhibit', rec, dist: h.distance }
      }
    }
    // SphereCast equivalent — floor cheese is a thin slab the centre ray often misses.
    player.camera.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    let best = null, bestD = GRAB_RANGE, bestKind = 'food'
    const consider = (item, kind, minD = 0.2) => {
      if (!item || item.held || item.opened || item.planted) return
      if (item.inFood) return
      if (item.type === 'fire') return
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
      if (!rec.pickup || !foodProtos[rec.variantOf || rec.slug]) continue
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
    player.object.updateMatrixWorld(true)
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

    if (left.holding) {
      holdPose(left, dt)
      toolUse(left, dt)
    }
    if (right.holding) {
      holdPose(right, dt)
      toolUse(right, dt)
    }
    updateReticle(left, dt)
    updateReticle(right, dt)

    const emitters = []
    if (left.holding?.type === 'fireExtinguisher' && left.holding.spraying) {
      emitters.push(sprayNozzle.left)
    }
    if (right.holding?.type === 'fireExtinguisher' && right.holding.spraying) {
      emitters.push(sprayNozzle.right)
    }
    spray.update(dt, {
      emitters,
      fires: fireWatch ? fireWatch.list() : (getFires ? getFires() : []),
    })

    if (!lActive && left.holding) left.object.visible = true
    if (!rActive && right.holding) right.object.visible = true
  }

  function grabLook(side = 'left', recOrSlug = null) {
    const arm = side === 'right' ? right : left
    let rec = recOrSlug
    if (typeof recOrSlug === 'string') {
      rec = exhibits.find(e => e.slug === recOrSlug || e.caption === recOrSlug || e.label === recOrSlug)
    }
    if (rec && rec.slug) {
      spawnCopy(arm, rec)
    } else {
      const t = pickTarget()
      if (!t) return { ok: false, reason: 'no target' }
      if (t.kind === 'food' || t.kind === 'rat') grabItem(arm, t.item)
      else if (t.kind === 'exhibit') spawnCopy(arm, t.rec)
      else if (t.kind === 'swatchBin' && spawnSwatch) grabItem(arm, spawnSwatch(t.spec))
      else if (t.kind === 'poster' && spawnPoster) grabItem(arm, spawnPoster(t.spec))
      else return { ok: false, reason: t.kind }
      rec = t.rec || rec
    }
    if (arm.holding) holdPose(arm, 10)
    return {
      ok: !!arm.holding,
      side: arm.side,
      type: arm.holding?.type || arm.holding?.kind || null,
      slug: arm.holding?.slug || rec?.slug || null,
    }
  }

  function dropArm(side = 'left') {
    drop(side === 'right' ? right : left)
  }

  function holdingLabel() {
    const a = left.holding?.type || (left.holding?.kind === 'rat' ? 'rat' : null)
    const b = right.holding?.type || (right.holding?.kind === 'rat' ? 'rat' : null)
    if (a && b) return a + ' + ' + b
    return a || b || ''
  }

  function dumpSpray() {
    const r = v => ({ x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) })
    const leftOn = !!(left.holding && left.holding.type === 'fireExtinguisher' && left.holding.spraying)
    const rightOn = !!(right.holding && right.holding.type === 'fireExtinguisher' && right.holding.spraying)
    return {
      ...spray.dump(),
      left: leftOn,
      right: rightOn,
      origins: {
        left: leftOn ? r(sprayNozzle.left.origin) : null,
        right: rightOn ? r(sprayNozzle.right.origin) : null,
      },
    }
  }

  function dumpDrop() {
    const r = t => t && { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2), mat: t.mat }
    return {
      left: left.holding ? r(left.dropAim || dropLanding(left.holding)) : null,
      right: right.holding ? r(right.dropAim || dropLanding(right.holding)) : null,
    }
  }

  return {
    left, right, update, pickTarget, holdingLabel, dumpSpray, dumpDrop, setScale,
    grabLook, dropArm, releaseItem,
    get armScale() { return armScale },
  }
}
