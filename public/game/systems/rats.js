// Rats from Rat.cs + FloorTrigger.cs.
// Food on the floor → spawn from a mouse hole, steal, run home, despawn.
// No floor food → rats return to the hole.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { ratWillSteal } from './food.js'

const MAX_RATS = 4
const SPAWN_DELAY = 12          // original FloorTrigger is 30s; 12s so you see it
const SPAWN_COOLDOWN = 8
const STEAL_DIST = 1.4
const HOME_DIST = 1.6
const SEE_DIST = 80
const SPEED_MIN = 7
const SPEED_MAX = 11

export function createRatDen({ scene, player, ratProto, foodWorld }) {
  hideTriggers(ratProto)
  const b = player.bounds
  const holes = []
  const rats = []
  let spawnTimer = 0
  let cooldownUntil = 0
  let currentRats = 0

  function makeHole(x, z, facing) {
    const g = new THREE.Group()
    g.position.set(x, 0.35, z)
    g.rotation.y = facing
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 })
    )
    const pit = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0x050403 })
    )
    pit.position.z = 0.01
    g.add(ring, pit)
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

  function sizeRat(root) {
    root.updateMatrixWorld(true)
    const box = boundsOf(root)
    const size = box.getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z, 1e-4)
    root.scale.multiplyScalar(1.05 / longest)
    root.updateMatrixWorld(true)
    const fitted = boundsOf(root)
    const mid = fitted.getCenter(new THREE.Vector3())
    root.position.x -= mid.x
    root.position.z -= mid.z
    root.position.y -= fitted.min.y
  }

  function spawnRat(hole, target) {
    if (currentRats >= MAX_RATS) return null
    const object = ratProto.clone(true)
    sizeRat(object)
    object.position.set(hole.x, object.position.y, hole.z)
    scene.add(object)
    const rat = {
      object, hole,
      position: object.position,
      radius: 0.28,
      speed: THREE.MathUtils.lerp(SPEED_MIN, SPEED_MAX, Math.random()),
      stolen: null,
      targetFood: null,
      target: target ? { x: target.x, z: target.z } : { x: hole.x, z: hole.z },
      defeated: false,
      goingHome: !target,
      born: 0,
    }
    object.userData.rat = rat
    object.traverse(o => { o.userData.rat = rat })
    player.addMover(rat)
    rats.push(rat)
    currentRats++
    return rat
  }

  function seeFood(rat) {
    let best = null, bestD = SEE_DIST
    for (const f of foodWorld.foodOnFloor()) {
      if (!ratWillSteal(f.type)) continue
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

  function goTo(rat, x, z, dt) {
    const dx = x - rat.position.x
    const dz = z - rat.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.15) return dist
    const ux = dx / dist, uz = dz / dist
    const nx = rat.position.x + ux * rat.speed * dt
    const nz = rat.position.z + uz * rat.speed * dt
    const hit = player.resolveXZ(nx, nz, rat.radius, rat)
    rat.position.x = hit.x
    rat.position.z = hit.z
    faceMove(rat, ux, uz)
    return dist
  }

  function steal(rat, food) {
    food.stolen = rat
    food.held = false
    food.vel.set(0, 0, 0)
    rat.stolen = food
    rat.targetFood = null
    rat.goingHome = true
    rat.target = { x: rat.hole.x, z: rat.hole.z }
  }

  function despawn(rat) {
    if (rat.stolen) {
      foodWorld.destroy(rat.stolen)
      rat.stolen = null
    }
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

    for (const rat of [...rats]) {
      rat.born += dt
      if (rat.stolen) {
        rat.stolen.object.position.set(
          rat.position.x, rat.stolen.height * 0.5 + 0.08, rat.position.z)
        const d = goTo(rat, rat.hole.x, rat.hole.z, dt)
        if (d < HOME_DIST && rat.born > 0.4) despawn(rat)
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

      if (rat.targetFood && !rat.targetFood.held && !rat.targetFood.stolen) {
        const f = rat.targetFood
        const d = goTo(rat, f.position.x, f.position.z, dt)
        if (d < STEAL_DIST) steal(rat, f)
      } else if (!rat.goingHome && rat.target) {
        goTo(rat, rat.target.x, rat.target.z, dt)
      } else {
        const d = goTo(rat, rat.hole.x, rat.hole.z, dt)
        if (d < HOME_DIST && rat.born > 0.4) despawn(rat)
      }
    }
  }

  return { rats, holes, update, get count() { return currentRats } }
}
