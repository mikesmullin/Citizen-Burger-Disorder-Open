// First-person controller ported from FirstPersonControl.cs + MouseLook.cs.
// Grab/throw is deferred — this scene is walk + look only.
//
// Numbers from the Unity prefab / scripts:
//   CharacterController height 2, radius 0.5, center 0
//   moveSpeed 16, runMultiplier 1.333 (Left Shift), crouch/walk 0.25 (Left Ctrl)
//   gravity 9.81, FOV 70 → 80 while running
//   MouseLook clamp ±60° (we open it to ±86° to match the arm-reach window)

import * as THREE from 'three'

const KEYS = {
  left:  new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
  fwd:   new Set(['KeyW', 'ArrowUp']),
  back:  new Set(['KeyS', 'ArrowDown']),
  run:   new Set(['ShiftLeft', 'ShiftRight']),
  walk:  new Set(['ControlLeft', 'ControlRight']),
}

export function createFirstPersonPlayer({
  height = 2,
  radius = 0.5,
  eyeHeight = 1.6,
  moveSpeed = 16,
  runMultiplier = 1.333,
  walkMultiplier = 0.25,
  gravity = 9.81,
  fov = 70,
  runFov = 80,
  // Unity: GetAxis("Mouse X") * 15 with Input sensitivity 0.1 ≈ 1.5 deg/px.
  // That's twitchy in a browser; 0.22 is comfortable and still snappy.
  lookSensitivity = 0.22,
  pitchMin = -86,
  pitchMax = 86,
} = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.08, 400)

  // yawObject sits at the CharacterController centre (1 m above the floor
  // when standing on y=0). pitchObject is the head.
  const yawObject = new THREE.Object3D()
  yawObject.name = 'Player'
  const pitchObject = new THREE.Object3D()
  pitchObject.name = 'Head'
  pitchObject.position.y = eyeHeight - height / 2
  yawObject.add(pitchObject)
  pitchObject.add(camera)

  const wish = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const keys = new Set()
  const mouse = { 0: false, 2: false, 1: false }
  const wasMouse = { 0: false, 2: false, 1: false }
  let fire1Down = false, fire1Up = false, fire1 = false
  let fire2Down = false, fire2Up = false, fire2 = false
  let yaw = 0
  let pitch = 0
  let vy = 0
  let grounded = false
  let locked = false
  let enabled = true

  const colliders = [] // {min:{x,z}, max:{x,z}}  xz AABBs
  const movers = []    // { position, radius } — NPCs, updated each frame
  let floorY = 0
  let bounds = null // {minx, maxx, minz, maxz}

  function onKey(e, down) {
    if (!enabled) return
    if (down) keys.add(e.code)
    else keys.delete(e.code)
  }
  function onMouse(e) {
    if (!enabled || !locked) return
    yaw   -= e.movementX * lookSensitivity
    pitch -= e.movementY * lookSensitivity
    pitch = Math.max(pitchMin, Math.min(pitchMax, pitch))
  }
  function onLockChange() {
    locked = document.pointerLockElement != null
  }

  addEventListener('keydown', e => onKey(e, true))
  addEventListener('keyup',   e => onKey(e, false))
  addEventListener('mousemove', onMouse)
  const onMouseButton = (e, down) => { if (down && !enabled) return; mouse[e.button] = down }
  addEventListener('mousedown', e => onMouseButton(e, true))
  addEventListener('mouseup',   e => onMouseButton(e, false))
  document.addEventListener('mousedown', e => onMouseButton(e, true))
  document.addEventListener('mouseup',   e => onMouseButton(e, false))
  addEventListener('contextmenu', e => { if (enabled) e.preventDefault() })
  document.addEventListener('pointerlockchange', onLockChange)

  function axis(pos, neg) {
    let v = 0
    for (const c of pos) if (keys.has(c)) v += 1
    for (const c of neg) if (keys.has(c)) v -= 1
    return Math.max(-1, Math.min(1, v))
  }

  function collideXZ(px, pz, r = radius, skip = null) {
    if (bounds) {
      px = Math.max(bounds.minx + r, Math.min(bounds.maxx - r, px))
      pz = Math.max(bounds.minz + r, Math.min(bounds.maxz - r, pz))
    }
    for (const c of colliders) {
      const qx = Math.max(c.min.x, Math.min(c.max.x, px))
      const qz = Math.max(c.min.z, Math.min(c.max.z, pz))
      let dx = px - qx, dz = pz - qz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      if (d2 < 1e-8) {
        const left   = px - c.min.x
        const right  = c.max.x - px
        const back   = pz - c.min.z
        const front  = c.max.z - pz
        const m = Math.min(left, right, back, front)
        if (m === left)  px = c.min.x - r
        else if (m === right) px = c.max.x + r
        else if (m === back)  pz = c.min.z - r
        else pz = c.max.z + r
      } else {
        const d = Math.sqrt(d2)
        const f = (r - d) / d
        px += dx * f
        pz += dz * f
      }
    }
    for (const m of movers) {
      if (m === skip) continue
      const mx = m.position.x, mz = m.position.z
      const minR = r + m.radius
      let dx = px - mx, dz = pz - mz
      const d2 = dx * dx + dz * dz
      if (d2 >= minR * minR || d2 < 1e-8) continue
      const d = Math.sqrt(d2)
      const f = (minR - d) / d
      px += dx * f
      pz += dz * f
    }
    return { x: px, z: pz }
  }

  function update(dt) {
    if (!enabled) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 8)
      camera.updateProjectionMatrix()
      return
    }
    dt = Math.min(dt, 0.1)

    fire1 = !!mouse[0]; fire1Down = fire1 && !wasMouse[0]; fire1Up = !fire1 && wasMouse[0]
    fire2 = !!mouse[2]; fire2Down = fire2 && !wasMouse[2]; fire2Up = !fire2 && wasMouse[2]
    wasMouse[0] = fire1
    wasMouse[2] = fire2

    yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    pitchObject.rotation.x = THREE.MathUtils.degToRad(pitch)

    const xMov = axis(KEYS.right, KEYS.left)
    const zMov = axis(KEYS.fwd, KEYS.back)
    const running = [...KEYS.run].some(c => keys.has(c))
    const walking = [...KEYS.walk].some(c => keys.has(c))

    camera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() > 1e-6) fwd.normalize()
    else fwd.set(0, 0, -1)
    right.crossVectors(fwd, up).normalize()
    wish.set(0, 0, 0)
    wish.addScaledVector(fwd, zMov)
    wish.addScaledVector(right, xMov)
    if (wish.lengthSq() > 1) wish.normalize()

    let speed = moveSpeed
    if (running) speed *= runMultiplier
    else if (walking) speed *= walkMultiplier

    const nx = yawObject.position.x + wish.x * speed * dt
    const nz = yawObject.position.z + wish.z * speed * dt
    const hit = collideXZ(nx, nz, radius)
    yawObject.position.x = hit.x
    yawObject.position.z = hit.z

    vy -= gravity * dt
    yawObject.position.y += vy * dt
    const feet = yawObject.position.y - height / 2
    if (feet <= floorY) {
      yawObject.position.y = floorY + height / 2
      vy = 0
      grounded = true
    } else {
      grounded = false
    }

    const targetFov = running && (xMov || zMov) ? runFov : fov
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt / 0.1)
    camera.updateProjectionMatrix()
  }

  function requestLock(el) {
    const t = el || document.body
    try { t.requestPointerLock && t.requestPointerLock() } catch (_) { /* ignore */ }
  }
  function unlock() {
    if (document.exitPointerLock) document.exitPointerLock()
  }

  function spawn(x, y, z, lookYaw = 0) {
    yawObject.position.set(x, y + height / 2, z)
    yaw = lookYaw
    pitch = 0
    vy = 0
    yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    pitchObject.rotation.x = 0
    yawObject.updateMatrixWorld(true)
  }

  function addCollider(min, max) {
    colliders.push({ min, max })
  }

  function addMover(mover) {
    movers.push(mover)
  }

  function setRoomBounds(minx, maxx, minz, maxz, y = 0) {
    bounds = { minx, maxx, minz, maxz }
    floorY = y
  }

  function lookAt(x, y, z) {
    yawObject.updateMatrixWorld(true)
    const origin = new THREE.Vector3()
    pitchObject.getWorldPosition(origin)
    const dx = x - origin.x, dy = y - origin.y, dz = z - origin.z
    yaw = THREE.MathUtils.radToDeg(Math.atan2(-dx, -dz))
    const horiz = Math.sqrt(dx * dx + dz * dz)
    pitch = THREE.MathUtils.radToDeg(-Math.atan2(dy, horiz))
    pitch = Math.max(pitchMin, Math.min(pitchMax, pitch))
    yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    pitchObject.rotation.x = THREE.MathUtils.degToRad(pitch)
    yawObject.updateMatrixWorld(true)
  }

  return {
    camera, object: yawObject,
    update, spawn, lookAt,
    requestLock, unlock,
    addCollider, setRoomBounds,
    get locked() { return locked },
    get grounded() { return grounded },
    get yaw() { return yaw },
    get pitch() { return pitch },
    set yaw(v) { yaw = v },
    set pitch(v) { pitch = v },
    set enabled(v) { enabled = v },
    get enabled() { return enabled },
    get position() { return yawObject.position },
    get keys() { return keys },
    get fire1() { return fire1 },
    get fire1Down() { return fire1Down },
    get fire1Up() { return fire1Up },
    get fire2() { return fire2 },
    get fire2Down() { return fire2Down },
    get fire2Up() { return fire2Up },
    get leftHand() { return keys.has('KeyQ') },
    get rightHand() { return keys.has('KeyE') },
    pitchObject,
    get floorY() { return floorY },
    get height() { return height },
    colliders,
    movers,
    addMover,
    resolveXZ: collideXZ,
    get bounds() { return bounds },
  }
}
