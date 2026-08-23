// Museum crowd, ported from NPC.cs + LocalObjectDetection.cs + SpawnNPC.cs.
//
// Original restaurant loop (queue → order → seat → eat) needs tables and the
// lost testArea01 nav graph, so this scene runs the subset that still works
// in an open hall:
//
//   wants.toWanderRestaurant  pick a nearby spot, walk there
//   wants.toIdle              wait 1–6 s, then wander again
//   Movement()                Seek + AvoidLocal + AvoidNPCs, look along velocity
//   idle look                 slight sway when standing
//
// Not in the original wander/idle: NPCs only looked at the player while
// queued / placing an order. The museum adds that as a proximity reaction.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'

export const Wants = { wander: 'wander', idle: 'idle' }

const SKINS = ['Npc1', 'Npc2', 'Npc3', 'Npc4', 'Npc5', 'Npc6']
const EASTER = ['Jorji', 'CookServe']

const SEEK = 1
const AVOID_LOCAL = 1.2
const AVOID_NPC = 0.5
const AVOID_DIST = 2.3          // NPC.cs indoor
const AVOID_GROUP = 0.6
const NOTICE_IN = 8
const NOTICE_OUT = 12
const NOTICE_STOP = 3.8         // stand still and look when this close
const NEAR_GOAL = 1.6
// Angular speed (rad/s). A 180° notice-turn takes ~1 s; a 45° glance ~0.25 s.
const TURN_NOTICE = 2.8
const TURN_WALK = 5.2
const TURN_IDLE = 7
const HEIGHT = 1.85
const RADIUS = 0.42

const _steer = new THREE.Vector3()
const _seek = new THREE.Vector3()
const _avoid = new THREE.Vector3()
const _look = new THREE.Vector3()
const _face = new THREE.Vector3()

function loadSkin(name) {
  const t = new THREE.TextureLoader().load(`./assets/textures/skins/${name}.png`)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = true
  return t
}

function makeNoticeBubble() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')
  g.fillStyle = '#f4fff8'
  g.strokeStyle = '#2a2a2a'
  g.lineWidth = 7
  g.lineJoin = 'round'
  g.lineCap = 'round'
  // Tail first, then the oval covers the join so it hangs off like a chat bubble.
  g.beginPath()
  g.moveTo(108, 114)
  g.lineTo(150, 120)
  g.lineTo(118, 176)
  g.closePath()
  g.fill()
  g.beginPath()
  g.moveTo(108, 114)
  g.lineTo(118, 176)
  g.lineTo(150, 120)
  g.stroke()
  g.beginPath()
  g.ellipse(128, 70, 108, 54, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.fillStyle = '#1a1a1a'
  g.font = '700 72px ui-sans-serif, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('···', 128, 74)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  // Sprite always faces the camera (true billboard). A Plane + lookAt aims
  // the plane's -Z, which is the back face, so it reads edge-on or reversed.
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map, transparent: true, depthWrite: false, sizeAttenuation: true,
  }))
  m.scale.set(0.68, 0.51, 1)
  m.visible = false
  return m
}

function applySkin(root, texture) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.trigger || o.userData.ui) return
    o.material = o.material.clone()
    o.material.map = texture
    o.material.color.set(0xffffff)
    o.material.needsUpdate = true
  })
}

function sitOnFloor(root) {
  hideTriggers(root)
  const box = boundsOf(root)
  const h = box.max.y - box.min.y || 1
  root.scale.multiplyScalar(HEIGHT / h)
  root.updateMatrixWorld(true)
  const fitted = boundsOf(root)
  const mid = fitted.getCenter(new THREE.Vector3())
  root.position.x -= mid.x
  root.position.z -= mid.z
  root.position.y -= fitted.min.y
}

export function createCrowd({ scene, player, proto, exhibits, count = 12 }) {
  const skins = {}
  for (const n of [...SKINS, ...EASTER]) skins[n] = loadSkin(n)

  const npcs = []
  const groups = []

  function inBox(x, z) {
    const pad = RADIUS + 0.15
    for (const c of player.colliders) {
      if (x > c.min.x - pad && x < c.max.x + pad && z > c.min.z - pad && z < c.max.z + pad) return true
    }
    for (const h of player.hulls || []) {
      const o = h.outer
      if (x > o.minx - pad && x < o.maxx + pad && z > o.minz - pad && z < o.maxz + pad) return true
    }
    return false
  }

  function randomGoal(near = null) {
    const b = player.bounds
    for (let n = 0; n < 18; n++) {
      let x, z
      if (near && Math.random() < 0.7) {
        x = near.x + (Math.random() - 0.5) * 6
        z = near.z + (Math.random() - 0.5) * 6
      } else if (exhibits.length && Math.random() < 0.65) {
        const e = exhibits[(Math.random() * exhibits.length) | 0]
        const side = Math.random() < 0.5 ? 1 : -1
        x = e.x + (Math.random() - 0.5) * 1.8
        z = e.z + side * (2.15 + Math.random() * 0.8)
      } else {
        x = THREE.MathUtils.lerp(b.minx + 2.5, b.maxx - 2.5, Math.random())
        z = THREE.MathUtils.lerp(b.minz + 2.5, b.maxz - 2.5, Math.random())
      }
      if (inBox(x, z)) continue
      const resolved = player.resolveXZ(x, z, RADIUS + 0.2, null)
      if (Math.abs(resolved.x - x) + Math.abs(resolved.z - z) > 0.6) continue
      return { x: resolved.x, z: resolved.z }
    }
    return { x: 0, z: 4 }
  }

  function spawnOne(skin, group, x, z) {
    const object = proto.clone(true)
    applySkin(object, skins[skin])
    sitOnFloor(object)
    const footY = object.position.y
    object.position.x = x
    object.position.z = z
    object.name = 'NPC:' + skin
    const bubble = makeNoticeBubble()
    scene.add(object)
    scene.add(bubble)

    const npc = {
      object, skin, group,
      radius: RADIUS,
      position: object.position,
      want: Wants.wander,
      prevWant: Wants.wander,
      goal: null,
      speed: THREE.MathUtils.lerp(4.2, 5.6, Math.random()),
      notice: false,
      waitUntil: 0,
      blendFrom: null,
      blendT0: 0,
      phase: Math.random() * Math.PI * 2,
      turnMul: 0.85 + Math.random() * 0.3,
      bubble,
      footY,
      blockedTime: 0,
      maneuverUntil: 0,
      maneuverDir: null,
      maneuverRepickUntil: 0,
    }
    object.userData.npc = npc
    object.traverse(o => { o.userData.npc = npc })
    player.addMover(npc)
    npcs.push(npc)
    return npc
  }

  // SpawnNPC.cs group sizes: mostly pairs, some solos and trios.
  // Spread groups down the center aisle so the first thing you see is people.
  const b0 = player.bounds
  let left = count
  let special = true
  const planned = []
  while (left > 0) {
    const r = Math.random()
    let size = 1
    if (r > 0.88 && left >= 3) size = 3
    else if (r > 0.25 && left >= 2) size = 2
    size = Math.min(size, left)
    planned.push(size)
    left -= size
  }
  planned.forEach((size, gi) => {
    const g = { members: [] }
    groups.push(g)
    const z = THREE.MathUtils.lerp(b0.maxz - 5, b0.minz + 6, (gi + 0.35) / planned.length)
    const x = (Math.random() - 0.5) * 5
    for (let i = 0; i < size; i++) {
      let skin = SKINS[(Math.random() * SKINS.length) | 0]
      if (special) { skin = EASTER[(Math.random() * EASTER.length) | 0]; special = false }
      const pos = {
        x: x + (i - (size - 1) / 2) * 1.3,
        z: z + (Math.random() - 0.5) * 1.2,
      }
      const hit = player.resolveXZ(pos.x, pos.z, RADIUS, null)
      g.members.push(spawnOne(skin, g, hit.x, hit.z))
    }
  })

  function seek(npc, target) {
    _seek.set(target.x - npc.position.x, 0, target.z - npc.position.z)
    if (_seek.lengthSq() < 1e-6) return _seek.set(0, 0, 0)
    return _seek.normalize().multiplyScalar(npc.speed)
  }

  function avoidLocal(npc) {
    _avoid.set(0, 0, 0)
    let n = 0
    const consider = (cx, cz) => {
      const dx = npc.position.x - cx, dz = npc.position.z - cz
      const dist = Math.hypot(dx, dz)
      if (dist < 3.2) { _avoid.x += cx; _avoid.z += cz; n++ }
    }
    for (const c of player.colliders) {
      consider((c.min.x + c.max.x) * 0.5, (c.min.z + c.max.z) * 0.5)
    }
    for (const h of player.hulls || []) {
      consider((h.outer.minx + h.outer.maxx) * 0.5, (h.outer.minz + h.outer.maxz) * 0.5)
    }
    if (!n) return _avoid.set(0, 0, 0)
    _avoid.x /= n
    _avoid.z /= n
    _avoid.set(npc.position.x - _avoid.x, 0, npc.position.z - _avoid.z)
    if (_avoid.lengthSq() < 1e-6) return _avoid.set(0, 0, 0)
    return _avoid.normalize().multiplyScalar(npc.speed)
  }

  function avoidNPCs(npc) {
    _avoid.set(0, 0, 0)
    let n = 0
    for (const other of npcs) {
      if (other === npc) continue
      const dist = Math.hypot(other.position.x - npc.position.x, other.position.z - npc.position.z)
      let limit = AVOID_DIST
      if (other.group === npc.group) limit = AVOID_GROUP
      if (dist < limit) { _avoid.x += other.position.x; _avoid.z += other.position.z; n++ }
    }
    const px = player.position.x, pz = player.position.z
    const pd = Math.hypot(px - npc.position.x, pz - npc.position.z)
    if (pd < AVOID_DIST + 0.5) { _avoid.x += px; _avoid.z += pz; n++ }
    if (!n) return _avoid.set(0, 0, 0)
    _avoid.x /= n
    _avoid.z /= n
    _avoid.set(npc.position.x - _avoid.x, 0, npc.position.z - _avoid.z)
    if (_avoid.lengthSq() < 1e-6) return _avoid.set(0, 0, 0)
    return _avoid.normalize().multiplyScalar(npc.speed)
  }

  function wrapPi(a) {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }

  function setLook(npc, dir, dt, speed) {
    if (dir.lengthSq() < 1e-6) return
    _look.copy(dir)
    _look.y = 0
    if (_look.lengthSq() < 1e-6) return
    _look.normalize()
    // +X is the painted face (CapsuleGeometry u=0.5).
    const target = Math.atan2(-_look.z, _look.x)
    faceDir(npc, _face)
    const current = Math.atan2(-_face.z, _face.x)
    const d = wrapPi(target - current)
    const maxStep = speed * npc.turnMul * dt
    const step = Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep
    npc.object.rotation.set(0, current + step, 0)
  }

  function faceDir(npc, out) {
    return out.set(1, 0, 0).applyQuaternion(npc.object.quaternion).setY(0).normalize()
  }

  // Short dodge direction: roughly perpendicular to the course, on a random
  // side, with jitter so it does not read as a scripted shuffle. Used to
  // escape a collider the NPC has been stuck against for over a second.
  function dodgeDir(npc, cx, cz) {
    const side = Math.random() < 0.5 ? 1 : -1
    const px = -cz * side
    const pz = cx * side
    const a = Math.atan2(pz, px) + (Math.random() - 0.5) * 1.2
    npc.maneuverDir = { x: Math.cos(a), z: Math.sin(a) }
  }

  function pickGoal(npc) {
    const leader = npc.group.members[0]
    const near = (leader !== npc && leader.goal) ? leader.goal : npc.position
    npc.goal = randomGoal(near)
    // Fresh goal: clear any in-flight dodge so we head straight for the spot.
    npc.blockedTime = 0
    npc.maneuverUntil = 0
    npc.maneuverDir = null
    npc.maneuverRepickUntil = 0
  }

  function update(dt, time) {
    dt = Math.min(dt, 0.1)
    for (const npc of npcs) {
      const pd = Math.hypot(player.position.x - npc.position.x, player.position.z - npc.position.z)
      if (pd < NOTICE_IN) npc.notice = true
      else if (pd > NOTICE_OUT) npc.notice = false
      npc.bubble.visible = npc.notice && pd < NOTICE_IN + 0.5
      const gy = player.groundY ? player.groundY(npc.position.x, npc.position.z) : 0
      npc.position.y = gy + npc.footY
      if (npc.bubble.visible) {
        npc.bubble.position.set(npc.position.x, gy + HEIGHT + 0.38, npc.position.z)
      }

      if (npc.want === Wants.wander) {
        if (!npc.goal) pickGoal(npc)
        const gx = npc.goal.x - npc.position.x
        const gz = npc.goal.z - npc.position.z
        if (Math.hypot(gx, gz) < NEAR_GOAL) {
          npc.goal = null
          npc.prevWant = Wants.wander
          npc.want = Wants.idle
          npc.waitUntil = time + 1 + Math.random() * 5
          npc.idleFwd = faceDir(npc, new THREE.Vector3())
        }
      } else if (npc.want === Wants.idle) {
        if (time >= npc.waitUntil) {
          npc.want = npc.prevWant || Wants.wander
          npc.waitUntil = 0
        }
      }

      const standAndLook = npc.notice && pd < NOTICE_STOP
      let moving = false
      _steer.set(0, 0, 0)

      if (npc.want === Wants.wander && npc.goal && !standAndLook) {
        const goalDir = seek(npc, npc.goal).multiplyScalar(SEEK)
        const loc = avoidLocal(npc).multiplyScalar(AVOID_LOCAL)
        const others = avoidNPCs(npc).multiplyScalar(AVOID_NPC)
        let parts = 1
        _steer.copy(goalDir)
        if (loc.lengthSq() > 0) { _steer.add(loc); parts++ }
        if (others.lengthSq() > 0) { _steer.add(others); parts++ }
        _steer.multiplyScalar(1 / parts)

        const ang = goalDir.lengthSq() && _steer.lengthSq()
          ? THREE.MathUtils.radToDeg(goalDir.angleTo(_steer)) : 0
        if (npc.blendFrom == null && ang > 20) {
          npc.blendFrom = _steer.clone().normalize()
          npc.blendT0 = time
        }
        let move = _steer
        if (npc.blendFrom) {
          const k = Math.min(1, (time - npc.blendT0) / 0.5)
          move = npc.blendFrom.clone().lerp(_steer.clone().normalize(), k)
          if (k >= 1) npc.blendFrom = null
        }
        if (move.lengthSq() > 1e-6) {
          move.y = 0
          move.normalize()
          // Steer along the computed course, unless we are in the middle of
          // dodging a collision we have been stuck against for a while.
          let mx = move.x, mz = move.z
          const maneuvering = npc.maneuverUntil > time
          if (maneuvering) { mx = npc.maneuverDir.x; mz = npc.maneuverDir.z }
          const ox = npc.position.x, oz = npc.position.z
          const want = npc.speed * dt
          const nx = ox + mx * want
          const nz = oz + mz * want
          const hit = player.slideXZ
            ? player.slideXZ(ox, oz, nx, nz, RADIUS, npc)
            : player.resolveXZ(nx, nz, RADIUS, npc)
          // player circle (player is not a mover)
          let hx = hit.x, hz = hit.z
          const pr = RADIUS + 0.5
          let dx = hx - player.position.x, dz = hz - player.position.z
          const d2 = dx * dx + dz * dz
          if (d2 < pr * pr && d2 > 1e-8) {
            const d = Math.sqrt(d2), f = (pr - d) / d
            hx += dx * f
            hz += dz * f
          }
          const moved = Math.hypot(hx - ox, hz - oz)
          npc.position.x = hx
          npc.position.z = hz
          moving = Math.hypot(mx, mz) > 0.05
          _steer.set(mx, 0, mz)

          // Wanted to move but barely did: pressed against a collider. Track
          // how long that persists; after 1 s dodge sideways for a moment,
          // then resume the course.
          const blocked = want > 1e-4 && moved < want * 0.3
          if (blocked) {
            npc.blockedTime += dt
            if (maneuvering && npc.maneuverRepickUntil <= time) {
              dodgeDir(npc, move.x, move.z)
              npc.maneuverRepickUntil = time + 0.3
            } else if (!maneuvering && npc.blockedTime > 1.0) {
              npc.maneuverUntil = time + 0.6 + Math.random() * 0.6
              dodgeDir(npc, move.x, move.z)
              npc.maneuverRepickUntil = time
              npc.blockedTime = 0
            }
          } else {
            npc.blockedTime = 0
          }
        }
      }

      if (npc.notice) {
        setLook(npc, _look.set(
          player.position.x - npc.position.x, 0,
          player.position.z - npc.position.z), dt, TURN_NOTICE)
      } else if (moving) {
        setLook(npc, _steer, dt, TURN_WALK)
      } else {
        if (!npc.idleFwd) npc.idleFwd = faceDir(npc, new THREE.Vector3())
        const f = npc.idleFwd
        const sway = Math.sin(time + npc.phase) * 0.35
        setLook(npc, _look.set(f.x + f.z * sway, 0, f.z - f.x * sway), dt, TURN_IDLE)
      }
    }
  }

  function facingErrorDeg(npc, targetX, targetZ) {
    const face = faceDir(npc, new THREE.Vector3())
    const to = new THREE.Vector3(targetX - npc.position.x, 0, targetZ - npc.position.z).normalize()
    const cross = face.x * to.z - face.z * to.x
    const deg = THREE.MathUtils.radToDeg(Math.atan2(cross, face.dot(to)))
    return deg
  }

  return { npcs, groups, update, faceDir, facingErrorDeg, skins }
}
