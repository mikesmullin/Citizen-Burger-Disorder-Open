// Rats from Rat.cs + FloorTrigger.cs.
// Food on the floor → spawn from a mouse hole, steal, run home, despawn.
// No floor food → rats return to the hole.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { ratWillSteal } from './food.js'
import { createInstancePool, visualMesh, hideVisuals } from '../common/instancePool.js'
import { mergeGeometries, setVertexColor } from '../common/geom.js'

export const RAT_SIZE = 1.05

const MAX_RATS = 4
const SPAWN_DELAY = 12          // original FloorTrigger is 30s; 12s so you see it
const SPAWN_COOLDOWN = 8
const STEAL_DIST = 1.4
const STEAL_Y = 0.55
const HOME_DIST = 1.6
const SEE_DIST = 80
const SPEED_MIN = 7
const SPEED_MAX = 11
const _mouth = new THREE.Vector3()
const _hs = new THREE.Vector3()

export function createRatDen({ scene, player, ratProto, foodWorld }) {
  hideTriggers(ratProto)
  const floorY = () => (player && player.floorY != null ? player.floorY : 0)
  const b = player.bounds
  const holes = []
  const rats = []
  const vis0 = visualMesh(ratProto)
  const ratPool = vis0 ? createInstancePool({
    geometry: vis0.geometry,
    material: vis0.material.clone(),
    max: MAX_RATS,
    scene,
    name: 'RatInst',
  }) : null
  let spawnTimer = 0
  let cooldownUntil = 0
  let currentRats = 0

  const holeSpecs = []
  function makeHole(x, z, facing) {
    holeSpecs.push({ x, z, facing })
    const g = new THREE.Group()
    g.position.set(x, 0.35, z)
    g.rotation.y = facing
    scene.add(g)
    const hole = { object: g, x, z, facing, position: g.position }
    holes.push(hole)
    return hole
  }

  // Holes in the side walls, a bit above the floor — the "Despawner" / RATSPAWN.
  if (b) {
    makeHole(b.minx + 0.22, 2.5, Math.PI / 2)
    makeHole(b.maxx - 0.22, -18, -Math.PI / 2)
    makeHole(b.minx + 0.22, -40, Math.PI / 2)
  }
  if (holeSpecs.length) {
    const ring = new THREE.CircleGeometry(0.42, 20)
    setVertexColor(ring, 0x1a120c)
    const pit = new THREE.CircleGeometry(0.28, 16)
    pit.translate(0, 0, 0.01)
    setVertexColor(pit, 0x050403)
    const geo = mergeGeometries([ring, pit])
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    const holeMesh = new THREE.InstancedMesh(geo, mat, holeSpecs.length)
    holeMesh.name = 'HoleInst'
    holeMesh.count = holeSpecs.length
    holeMesh.frustumCulled = false
    holeMesh.receiveShadow = true
    scene.add(holeMesh)
    const dummy = new THREE.Object3D()
    holeSpecs.forEach((h, i) => {
      dummy.position.set(h.x, 0.35, h.z)
      dummy.rotation.set(0, h.facing, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      holeMesh.setMatrixAt(i, dummy.matrix)
    })
    holeMesh.instanceMatrix.needsUpdate = true
  }

  function sizeRat(root) {
    root.updateMatrixWorld(true)
    const box = boundsOf(root)
    const size = box.getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z, 1e-4)
    root.scale.multiplyScalar(RAT_SIZE / longest)
    root.updateMatrixWorld(true)
    const fitted = boundsOf(root)
    const mid = fitted.getCenter(new THREE.Vector3())
    root.position.x -= mid.x
    root.position.z -= mid.z
    root.position.y -= fitted.min.y
    return root.position.y
  }

  function spawnRat(hole, target) {
    if (currentRats >= MAX_RATS) return null
    const object = ratProto.clone(true)
    const padY = sizeRat(object) + 0.04
    object.position.set(hole.x, 0, hole.z)
    scene.add(object)
    // Mouth is a local node so stolen food tracks the snout (Rat.cs
    // `transform.position + transform.forward`). Don't reparent the food
    // mesh — the rat's baked scale would shrink it.
    const s = object.scale.x || 1
    const mouth = new THREE.Object3D()
    mouth.name = 'Mouth'
    // Local Y is a world-metre offset divided by scale. Origin used to sit
    // on the floor; padY lifted the mesh so feet clear — subtract it here
    // or stolen food floats above the head.
    mouth.position.set(0, (0.12 - padY) / s, -0.42 / s)
    object.add(mouth)
    object.position.y = floorY() + padY
    const rat = {
      kind: 'rat',
      type: 'rat',
      object, hole, mouth,
      position: object.position,
      radius: 0.28,
      height: 0.35,
      speed: THREE.MathUtils.lerp(SPEED_MIN, SPEED_MAX, Math.random()),
      stolen: null,
      targetFood: null,
      target: target ? { x: target.x, z: target.z } : { x: hole.x, z: hole.z },
      defeated: false,
      dead: false,
      cooked: 0,
      goingHome: !target,
      born: 0,
      padY,
      held: false,
      onFloor: true,
      dropped: false,
      vel: new THREE.Vector3(),
      blockedTime: 0,
      maneuverUntil: 0,
      maneuverDir: null,
      maneuverRepickUntil: 0,
    }
    object.userData.rat = rat
    object.traverse(o => { o.userData.rat = rat })
    const vis = visualMesh(object)
    hideVisuals(object)
    if (ratPool && vis) {
      rat.visual = vis
      rat.pool = ratPool
      rat.slot = ratPool.alloc({ rat })
      ratPool.setFromObject(rat.slot, vis)
      rat.cookOrig = vis.material && vis.material.color
        ? vis.material.color.clone()
        : new THREE.Color(1, 1, 1)
      ratPool.setColor(rat.slot, rat.cookOrig)
    }
    player.addMover(rat)
    rats.push(rat)
    currentRats++
    return rat
  }

  function placeStolen(rat) {
    const food = rat.stolen
    if (!food || !food.object) return
    if (food.object.parent === rat.carry) return
    rat.mouth.updateMatrixWorld(true)
    rat.mouth.getWorldPosition(_mouth)
    food.object.position.copy(_mouth)
    food.object.position.y += (food.height || 0.1) * 0.2
    food.object.quaternion.copy(rat.object.quaternion)
  }

  // Unscaled socket on the mouth so stolen food can parent without the rat's
  // baked scale shrinking it. Used only while the rat is held (same idea as
  // the hand grip socket).
  function ensureCarry(rat) {
    if (rat.carry && rat.carry.parent === rat.mouth) return rat.carry
    const carry = new THREE.Group()
    carry.name = 'RatCarry'
    rat.mouth.add(carry)
    rat.carry = carry
    return carry
  }

  function syncCarryScale(rat) {
    const carry = ensureCarry(rat)
    rat.mouth.updateWorldMatrix(true, false)
    rat.mouth.getWorldScale(_hs)
    carry.scale.set(
      Math.abs(_hs.x) > 1e-6 ? 1 / _hs.x : 1,
      Math.abs(_hs.y) > 1e-6 ? 1 / _hs.y : 1,
      Math.abs(_hs.z) > 1e-6 ? 1 / _hs.z : 1,
    )
  }

  function attachMouthFood(rat) {
    const food = rat.stolen
    if (!food || !food.object) return
    const carry = ensureCarry(rat)
    syncCarryScale(rat)
    if (food.object.parent !== carry) {
      carry.attach(food.object)
      food.kinematic = true
    }
    food.object.position.set(0, (food.height || 0.1) * 0.2, 0)
    food.object.quaternion.identity()
  }

  function detachMouthFood(rat) {
    const food = rat.stolen
    const obj = food && food.object
    if (obj && rat.carry && obj.parent === rat.carry) {
      obj.updateWorldMatrix(true, true)
      scene.attach(obj)
      food.kinematic = false
    }
  }

  function withinReach(rat, food) {
    if (!rat || !food || food.held || food.stolen || food.inFood) return false
    if (!ratWillSteal(food.type)) return false
    const fy = food.position ? food.position.y : 0
    return Math.abs(fy - rat.position.y) < STEAL_Y
  }

  function seeFood(rat) {
    let best = null, bestD = SEE_DIST
    for (const f of foodWorld.foodOnFloor()) {
      if (!withinReach(rat, f)) continue
      const d = Math.hypot(f.position.x - rat.position.x, f.position.z - rat.position.z)
      if (d < bestD) { best = f; bestD = d }
    }
    return best
  }

  function faceMove(rat, dx, dz) {
    if (dx * dx + dz * dz < 1e-6) return
    // Mesh snout is -Z in three.js; add π so the head leads, not the tail.
    rat.object.rotation.set(0, Math.atan2(dx, dz) + Math.PI, 0)
  }

  // Short dodge direction: roughly perpendicular to the course, on a random
  // side, with jitter so it does not read as a scripted shuffle. Used to
  // escape a collision the rat has been stuck against for over a second.
  function ratDodge(rat, cx, cz) {
    const side = Math.random() < 0.5 ? 1 : -1
    const px = -cz * side
    const pz = cx * side
    const a = Math.atan2(pz, px) + (Math.random() - 0.5) * 1.2
    rat.maneuverDir = { x: Math.cos(a), z: Math.sin(a) }
  }

  function goTo(rat, x, z, dt, time) {
    const dx = x - rat.position.x
    const dz = z - rat.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.15) return dist

    // Course is toward (x, z); while dodging we steer a random direction.
    const cx = dx / dist, cz = dz / dist
    let ux = cx, uz = cz
    const maneuvering = rat.maneuverUntil > time
    if (maneuvering) { ux = rat.maneuverDir.x; uz = rat.maneuverDir.z }

    const sx = rat.position.x, sz = rat.position.z
    const want = rat.speed * dt
    const nx = sx + ux * want
    const nz = sz + uz * want
    const hit = player.resolveXZ(nx, nz, rat.radius, rat)
    rat.position.x = hit.x
    rat.position.z = hit.z
    const moved = Math.hypot(hit.x - sx, hit.z - sz)

    // Wanted to move but barely did: pressed against a collider. Track how
    // long that persists; after 1 s dodge sideways for a moment, then resume.
    const blocked = want > 1e-4 && moved < want * 0.3
    if (blocked) {
      rat.blockedTime += dt
      if (maneuvering && rat.maneuverRepickUntil <= time) {
        ratDodge(rat, cx, cz)
        rat.maneuverRepickUntil = time + 0.25
      } else if (!maneuvering && rat.blockedTime > 1.0) {
        rat.maneuverUntil = time + 0.5 + Math.random() * 0.5
        ratDodge(rat, cx, cz)
        rat.maneuverRepickUntil = time
        rat.blockedTime = 0
      }
    } else {
      rat.blockedTime = 0
    }

    faceMove(rat, ux, uz)
    return dist
  }

  function steal(rat, food) {
    if (!withinReach(rat, food)) return false
    food.stolen = rat
    food.held = false
    food.vel.set(0, 0, 0)
    rat.stolen = food
    rat.targetFood = null
    rat.goingHome = true
    rat.target = { x: rat.hole.x, z: rat.hole.z }
    return true
  }

  function despawn(rat) {
    if (rat.stolen) {
      detachMouthFood(rat)
      foodWorld.destroy(rat.stolen)
      rat.stolen = null
    }
    if (rat.pool && rat.slot != null) rat.pool.release(rat.slot)
    scene.remove(rat.object)
    const i = rats.indexOf(rat)
    if (i >= 0) rats.splice(i, 1)
    const m = player.movers.indexOf(rat)
    if (m >= 0) player.movers.splice(m, 1)
    currentRats = Math.max(0, currentRats - 1)
  }

  function update(dt, time) {
    dt = Math.min(dt, 0.1)
    const floor = foodWorld.foodOnFloor()

    if (floor.length === 0) spawnTimer = time
    if (floor.length > 0 && currentRats < MAX_RATS && time > cooldownUntil
        && time > spawnTimer + SPAWN_DELAY) {
      const n = Math.min(floor.length, 3, MAX_RATS - currentRats)
      for (let i = 0; i < n; i++) {
        const hole = holes[i % holes.length]
        const food = floor[(Math.random() * floor.length) | 0]
        spawnRat(hole, food.position)
      }
      cooldownUntil = time + SPAWN_COOLDOWN
    }

    const sync = rat => {
      if (rat.pool && rat.visual) rat.pool.setFromObject(rat.slot, rat.visual)
    }

    for (const rat of [...rats]) {
      rat.born += dt
      if (rat.dead || (rat.cooked > 0.12)) {
        rat.dead = true
        rat.defeated = true
        if (rat.stolen) {
          detachMouthFood(rat)
          rat.stolen.stolen = null
          rat.stolen = null
        }
        if (!foodWorld.items.includes(rat)) {
          foodWorld.items.push(rat)
          rat.object.userData.food = rat
        }
        sync(rat)
        continue
      }
      if (rat.held) {
        if (rat.stolen) attachMouthFood(rat)
        else detachMouthFood(rat)
        sync(rat)
        continue
      }
      detachMouthFood(rat)

      const gy = floorY()
      const feet = gy + (rat.padY || 0)
      if (rat.onFloor && rat.position.y > feet + 0.35) rat.onFloor = false

      if (!rat.onFloor) {
        rat.vel.y -= 9.81 * dt
        rat.object.position.addScaledVector(rat.vel, dt)
        if (rat.position.y <= feet) {
          rat.position.y = feet
          rat.vel.set(0, 0, 0)
          rat.onFloor = true
        } else {
          const hit = player.slideXZ
            ? player.slideXZ(rat.position.x, rat.position.z, rat.position.x, rat.position.z, rat.radius, rat)
            : player.resolveXZ(rat.position.x, rat.position.z, rat.radius, rat)
          rat.position.x = hit.x
          rat.position.z = hit.z
        }
        placeStolen(rat)
        sync(rat)
        continue
      }

      rat.position.y = feet

      if (rat.stolen) {
        placeStolen(rat)
        const d = goTo(rat, rat.hole.x, rat.hole.z, dt, time)
        if (d < HOME_DIST && rat.born > 0.4) despawn(rat)
        else sync(rat)
        continue
      }

      const seen = seeFood(rat)
      if (seen && !rat.defeated) {
        rat.targetFood = seen
        rat.goingHome = false
        rat.target = { x: seen.position.x, z: seen.position.z }
      } else if (floor.length === 0) {
        rat.targetFood = null
        rat.goingHome = true
        rat.target = { x: rat.hole.x, z: rat.hole.z }
      }

      if (rat.targetFood && withinReach(rat, rat.targetFood)) {
        const f = rat.targetFood
        const d = goTo(rat, f.position.x, f.position.z, dt, time)
        if (d < STEAL_DIST) steal(rat, f)
      } else if (!rat.goingHome && rat.target) {
        goTo(rat, rat.target.x, rat.target.z, dt, time)
      } else {
        const d = goTo(rat, rat.hole.x, rat.hole.z, dt, time)
        if (d < HOME_DIST && rat.born > 0.4) despawn(rat)
      }
      if (rats.includes(rat)) sync(rat)
    }
  }

  function spawnAt(x, z) {
    const hole = holes.length ? holes[(Math.random() * holes.length) | 0] : { x, z }
    const rat = spawnRat(hole, { x, z })
    if (rat) {
      rat.position.set(x, floorY() + (rat.padY || 0), z)
      rat.goingHome = false
      rat.target = { x, z }
    }
    return rat
  }

  return { rats, holes, update, spawnAt, remove: despawn, get count() { return currentRats } } // pickup + mouth follow
}
