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
  jump:  new Set(['Space']),
}

export function createFirstPersonPlayer({
  height = 2,
  radius = 0.5,
  eyeHeight = 1.6,
  moveSpeed = 16,
  runMultiplier = 1.333,
  walkMultiplier = 0.25,
  gravity = 9.81,
  // Demo-player hop is 0.62 m over 0.7 s → v = √(2gh).
  jumpSpeed = 3.49,
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

  // Shadow-only stand-in for the first-person body. heroes/Player is the
  // same Unity Capsule as the demo lineup (r=0.5,h=2 × prefab scale 2,3,2
  // then sitPlayer to height 2 → xz radius 1/3). three.js' shadow pass
  // tests the *view* camera's layers, so a shadow-only layer would also
  // drop the caster. colorWrite/depthWrite hide it instead — the camera
  // sits inside this capsule, and looking down would otherwise fill the
  // view with the bottom cap.
  const shadowRadius = 0.5 * 2 * (2 / 6)
  const shadowMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(shadowRadius, height - 2 * shadowRadius, 8, 16),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  )
  shadowMesh.name = 'PlayerShadow'
  shadowMesh.castShadow = true
  shadowMesh.receiveShadow = false
  shadowMesh.raycast = () => {}
  yawObject.add(shadowMesh)

  const wish = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const keys = new Set()
  const mouse = { 0: false, 2: false, 1: false }
  const wasMouse = { 0: false, 2: false, 1: false }
  let fire1Down = false, fire1Up = false, fire1 = false
  let fire2Down = false, fire2Up = false, fire2 = false
  let wheelAcc = 0
  let wheelDir = 0
  let yaw = 0
  let pitch = 0
  let vy = 0
  let grounded = false
  let jumpHeld = false
  let locked = false
  let touchLock = false
  let enabled = true
  const analog = { x: 0, z: 0 }
  const tap = { 0: false, 1: false, 2: false }
  // When true, pointer-lock mousemove is not applied to yaw/pitch. The scale
  // gun (and anything else that wants a drag gesture) reads pullDragDelta().
  let lookFrozen = false
  let dragDX = 0
  let dragDY = 0

  const colliders = [] // {min:{x,z}, max:{x,z}}  xz AABBs
  const hulls = []     // solid AABB with an interior and a door slot
  const movers = []    // { position, radius } — NPCs, updated each frame
  const platforms = [] // { minx, maxx, minz, maxz, y } or ramp { …, y0, y1, z0, z1 }
  let floorY = 0
  let bounds = null // {minx, maxx, minz, maxz}

  function onKey(e, down) {
    if (!enabled) return
    if (down) keys.add(e.code)
    else keys.delete(e.code)
  }
  function onMouse(e) {
    if (!enabled || !locked) return
    if (lookFrozen) {
      dragDX += e.movementX
      dragDY += e.movementY
      return
    }
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
  addEventListener('wheel', e => {
    if (!enabled || !locked) return
    e.preventDefault()
    wheelAcc += e.deltaY
  }, { passive: false })
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
    for (const h of hulls) {
      const hit = resolveHull(h, px, pz, r)
      px = hit.x
      pz = hit.z
    }
    for (const m of movers) {
      if (m === skip || m.held) continue
      if (skip && (m.position === skip.position || (skip.eid && m.eid === skip.eid))) continue
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
      wheelDir = 0
      wheelAcc = 0
      return
    }
    dt = Math.min(dt, 0.1)

    fire1 = !!(mouse[0] || tap[0]); fire1Down = fire1 && !wasMouse[0]; fire1Up = !fire1 && wasMouse[0]
    fire2 = !!(mouse[2] || tap[2]); fire2Down = fire2 && !wasMouse[2]; fire2Up = !fire2 && wasMouse[2]
    wasMouse[0] = fire1
    wasMouse[2] = fire2
    tap[0] = tap[1] = tap[2] = false
    wheelDir = wheelAcc > 0 ? 1 : wheelAcc < 0 ? -1 : 0
    wheelAcc = 0

    yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    pitchObject.rotation.x = THREE.MathUtils.degToRad(pitch)

    const analogMag = Math.hypot(analog.x, analog.z)
    const xMov = Math.max(-1, Math.min(1, axis(KEYS.right, KEYS.left) + analog.x))
    const zMov = Math.max(-1, Math.min(1, axis(KEYS.fwd, KEYS.back) + analog.z))
    const running = [...KEYS.run].some(c => keys.has(c)) || analogMag >= 0.78
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
    const hit = slideXZ(yawObject.position.x, yawObject.position.z, nx, nz, radius)
    yawObject.position.x = hit.x
    yawObject.position.z = hit.z

    const wantJump = [...KEYS.jump].some(c => keys.has(c))
    if (grounded && wantJump && !jumpHeld) {
      vy = jumpSpeed
      grounded = false
    }
    jumpHeld = wantJump

    vy -= gravity * dt
    yawObject.position.y += vy * dt
    const feet = yawObject.position.y - height / 2
    const gy = groundY(hit.x, hit.z)
    // Don't glue to the floor while the hop is going up (demo peak 0.62 m).
    if (vy > 0) {
      grounded = false
    } else if (feet <= gy) {
      yawObject.position.y = gy + height / 2
      vy = 0
      grounded = true
    } else if (grounded && gy >= feet - 0.22) {
      yawObject.position.y = gy + height / 2
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
    const gy = Math.max(y, floorY)
    yawObject.position.set(x, gy + height / 2, z)
    yaw = lookYaw
    pitch = 0
    vy = 0
    grounded = true
    jumpHeld = false
    yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    pitchObject.rotation.x = 0
    yawObject.updateMatrixWorld(true)
  }

  function groundY(x, z) {
    let y = floorY
    for (const p of platforms) {
      if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue
      let h
      if (p.z0 != null && p.y1 != null) {
        const span = p.z1 - p.z0
        const t = Math.max(0, Math.min(1, (z - p.z0) / (span || 1e-6)))
        h = p.y0 + (p.y1 - p.y0) * t
      } else {
        h = p.y
      }
      if (h > y) y = h
    }
    return y
  }

  // Surface an item should land on at (x, z) given its feet height. If the
  // item is already resting on `prefer` and is still within that footprint,
  // keep it there (don't snap onto a nearby counter it is falling in front
  // of). Otherwise take the highest platform whose top is at/below the feet.
  // Returns { y, mat, plat } — plat is null on the plain floor.
  function surfaceAt(x, z, feetY, prefer = null) {
    let best = null
    let bestY = -Infinity
    for (const p of platforms) {
      if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue
      let h
      if (p.z0 != null && p.y1 != null) {
        const span = p.z1 - p.z0
        const t = Math.max(0, Math.min(1, (z - p.z0) / (span || 1e-6)))
        h = p.y0 + (p.y1 - p.y0) * t
      } else {
        h = p.y
      }
      if (h > feetY + 0.18) continue
      if (prefer && p === prefer && h >= feetY - 0.6 && h > bestY + 1e-4) {
        return { y: h, mat: prefer.mat || 'surface', plat: prefer }
      }
      if (h > bestY + 1e-4) { bestY = h; best = p }
    }
    if (!best) return { y: floorY, mat: 'floor', plat: null }
    return { y: bestY, mat: best.mat || 'surface', plat: best }
  }

  function addPlatform(p) {
    platforms.push(p)
    return p
  }

  // Hollow AABB with a +Z door. Thin side walls used to tunnel: 16 m/s at
  // 60 fps is 27 cm/frame, thicker than a 18 cm AABB, and min-penetration
  // then shoved the center the wrong way (into the bed). Inside vs outside
  // is decided by the cargo volume, never by shortest-axis.
  function resolveHull(h, px, pz, r) {
    const inDoor = Math.abs(px - h.doorX) <= h.doorHalf && pz >= h.doorZ - r * 0.35
    if (inDoor) return { x: px, z: pz }

    const ox0 = h.outer.minx, ox1 = h.outer.maxx, oz0 = h.outer.minz, oz1 = h.outer.maxz
    const ix0 = h.inner.minx, ix1 = h.inner.maxx, iz0 = h.inner.minz, iz1 = h.inner.maxz
    const inCargo = px >= ix0 && px <= ix1 && pz >= iz0 && pz <= iz1
    if (inCargo) {
      return {
        x: Math.max(ix0 + r, Math.min(ix1 - r, px)),
        z: Math.max(iz0 + r, Math.min(iz1, pz)),
      }
    }

    const qx = Math.max(ox0, Math.min(ox1, px))
    const qz = Math.max(oz0, Math.min(oz1, pz))
    const dx = px - qx, dz = pz - qz
    const d2 = dx * dx + dz * dz
    const centerInside = px > ox0 && px < ox1 && pz > oz0 && pz < oz1
    if (!centerInside && d2 >= r * r) return { x: px, z: pz }

    if (centerInside) {
      const left = px - ox0, right = ox1 - px, back = pz - oz0, front = oz1 - pz
      const m = Math.min(left, right, back, front)
      if (m === left) return { x: ox0 - r, z: pz }
      if (m === right) return { x: ox1 + r, z: pz }
      if (m === back) return { x: px, z: oz0 - r }
      return { x: px, z: oz1 + r }
    }
    const d = Math.sqrt(d2) || 1e-6
    const f = (r - d) / d
    return { x: px + dx * f, z: pz + dz * f }
  }

  function slideXZ(x0, z0, x1, z1, r = radius, skip = null) {
    const dx = x1 - x0, dz = z1 - z0
    const dist = Math.hypot(dx, dz)
    const maxStep = r * 0.4
    const steps = Math.max(1, Math.min(16, Math.ceil(dist / Math.max(maxStep, 1e-6))))
    let px = x0, pz = z0
    const sx = dx / steps, sz = dz / steps
    for (let i = 0; i < steps; i++) {
      const hit = collideXZ(px + sx, pz + sz, r, skip)
      px = hit.x
      pz = hit.z
    }
    return { x: px, z: pz }
  }

  function addCollider(min, max) {
    colliders.push({ min, max })
  }

  function addHull(h) {
    hulls.push(h)
    return h
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
    camera, object: yawObject, shadowMesh,
    update, spawn, lookAt,
    requestLock, unlock,
    addCollider, setRoomBounds,
    get locked() { return locked || touchLock },
    get pointerLocked() { return locked },
    get touchLock() { return touchLock },
    setTouchLock(v) { touchLock = !!v },
    setAnalog(x = 0, z = 0) {
      let ax = +x || 0, az = +z || 0
      const mag = Math.hypot(ax, az)
      if (mag > 1) { ax /= mag; az /= mag }
      analog.x = ax
      analog.z = az
    },
    get analog() { return analog },
    pulseFire(button = 0) {
      tap[button] = true
    },
    get grounded() { return grounded },
    get jumping() { return !grounded && vy > 0 },
    get yaw() { return yaw },
    get pitch() { return pitch },
    set yaw(v) {
      yaw = v
      yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
    },
    set pitch(v) {
      pitch = Math.max(pitchMin, Math.min(pitchMax, v))
      pitchObject.rotation.x = THREE.MathUtils.degToRad(pitch)
    },
    setMouse(button, down) { mouse[button] = !!down },
    getMouse(button) { return !!mouse[button] },
    set lookFrozen(v) {
      if (!!v === lookFrozen) return
      lookFrozen = !!v
      dragDX = 0
      dragDY = 0
    },
    get lookFrozen() { return lookFrozen },
    pullDragDelta() {
      const d = { x: dragDX, y: dragDY }
      dragDX = 0
      dragDY = 0
      return d
    },
    injectMouse(dx = 0, dy = 0) {
      if (lookFrozen) {
        dragDX += dx
        dragDY += dy
        return { lookFrozen, dx: dragDX, dy: dragDY }
      }
      yaw -= dx * lookSensitivity
      pitch -= dy * lookSensitivity
      pitch = Math.max(pitchMin, Math.min(pitchMax, pitch))
      yawObject.rotation.y = THREE.MathUtils.degToRad(yaw)
      pitchObject.rotation.x = THREE.MathUtils.degToRad(pitch)
      return { lookFrozen, yaw, pitch }
    },
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
    get wheelDir() { return wheelDir },
    get leftHand() { return keys.has('KeyQ') },
    get rightHand() { return keys.has('KeyE') },
    pitchObject,
    get floorY() { return floorY },
    get height() { return height },
    colliders,
    hulls,
    movers,
    addMover,
    addPlatform,
    addHull,
    groundY,
    surfaceAt,
    resolveXZ: collideXZ,
    slideXZ,
    get bounds() { return bounds },
    platforms,
  }
}
