// Life-size delivery truck bay: walkable ramp, closed boxes in the trailer.
// Box.cs: contents PattMcRat / SeedyCedric / GreenGrace. Original opened on
// hand collision; the museum carries a closed box and unpacks on first set-down
// (the YouTube loop — haul a cube, drop it, cardboard net + food spill).
// The converted TruckRamp transform is a detached slab; we hide it and build
// a ramp that actually meets the trailer floor at player scale.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { layoutFood } from './food.js'

export const Contents = {
  meat: 'PattMcRat',
  bread: 'SeedyCedric',
  produce: 'GreenGrace',
}

const CONTENTS_CYCLE = [Contents.meat, Contents.bread, Contents.produce]

export const BOX_SIZE = 0.50
const SPILL = {
  [Contents.meat]: [
    { slug: 'items/Patty', type: 'patty', n: [4, 7] },
    { slug: 'items/Bacon', type: 'bacon', n: [4, 7] },
  ],
  [Contents.bread]: [
    { slug: 'items/BunTop', type: 'topBun', n: [4, 7] },
    { slug: 'items/BunBottom', type: 'bun', n: [4, 7] },
  ],
  [Contents.produce]: [
    { slug: 'items/LettuceHead', type: 'lettuce', n: [1, 2] },
    { slug: 'items/Cheese', type: 'cheese', n: [4, 7] },
    { slug: 'items/Tomato', type: 'tomato', n: [2, 5] },
  ],
}

function randInt(a, b) {
  return a + ((Math.random() * (b - a + 1)) | 0)
}

function cardboardMat(tex) {
  return new THREE.MeshStandardMaterial({
    map: tex || null,
    color: tex ? 0xffffff : 0xc4a56a,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
  })
}

// Unrolled cube net, `f` on the ground:
//         [_]
//       [_][f][_]
//         [_]
//         [_]
export function makeOpenNet(tex, S = BOX_SIZE) {
  const thick = 0.018
  const mat = cardboardMat(tex)
  const g = new THREE.Group()
  g.name = 'BoxOpen'
  const face = (x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(S, thick, S), mat)
    m.position.set(x, thick * 0.5, z)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    return m
  }
  face(0, 0)           // floor
  face(-S, 0)          // left
  face(S, 0)           // right
  face(0, S)           // lid
  face(0, -S)          // front
  face(0, -2 * S)      // back
  return g
}

function detachNamed(root, re) {
  const dump = []
  root.traverse(o => dump.push(o))
  for (const o of dump) {
    if (re.test(o.name) && o.parent) o.parent.remove(o)
  }
}

function worldVerts(root, visit) {
  root.updateMatrixWorld(true)
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return
    const a = o.geometry.attributes.position.array
    const e = o.matrixWorld.elements
    for (let i = 0; i < a.length; i += 3) {
      visit(
        e[0] * a[i] + e[4] * a[i + 1] + e[8] * a[i + 2] + e[12],
        e[1] * a[i] + e[5] * a[i + 1] + e[9] * a[i + 2] + e[13],
        e[2] * a[i] + e[6] * a[i + 1] + e[10] * a[i + 2] + e[14],
      )
    }
  })
}

// Trailer side panels only (skip the cab, which is often wider — mirrors).
function sampleTrailerX(root, zLo, zHi, yLo, yHi) {
  let minx = Infinity, maxx = -Infinity
  worldVerts(root, (wx, wy, wz) => {
    if (wz < zLo || wz > zHi || wy < yLo || wy > yHi) return
    if (wx < minx) minx = wx
    if (wx > maxx) maxx = wx
  })
  if (!Number.isFinite(minx)) return null
  return { minx, maxx }
}

// Walk from the cargo mid-line to the first dense X-bin — inner wall faces.
function sampleCargoInnerX(root, x0, x1, zLo, zHi, yLo, yHi) {
  const step = 0.04
  const n = Math.max(8, Math.round((x1 - x0) / step) + 1)
  const counts = new Array(n).fill(0)
  worldVerts(root, (wx, wy, wz) => {
    if (wz < zLo || wz > zHi || wy < yLo || wy > yHi) return
    const i = Math.round((wx - x0) / step)
    if (i >= 0 && i < n) counts[i]++
  })
  const peak = counts.reduce((a, b) => Math.max(a, b), 0)
  if (peak < 8) return null
  const thresh = Math.max(8, peak * 0.1)
  const mid = (n / 2) | 0
  let iL = 0, iR = n - 1
  for (let i = mid; i >= 0; i--) {
    if (counts[i] >= thresh) { iL = i; break }
  }
  for (let i = mid; i < n; i++) {
    if (counts[i] >= thresh) { iR = i; break }
  }
  if (iR - iL < 8) return null
  return { minx: x0 + iL * step, maxx: x0 + iR * step }
}

// Inner cargo floor at the open end: the opening has a bumper lip and a
// higher interior floor. Take the highest Y-band in the lower half.
function sampleCargoFloor(root, openZ, x0, x1, bodyMinY, bodyMaxY) {
  const counts = new Map()
  worldVerts(root, (wx, wy, wz) => {
    if (wz < openZ - 0.55) return
    if (wx < x0 + 0.12 || wx > x1 - 0.12) return
    const k = Math.round(wy * 20) / 20
    counts.set(k, (counts.get(k) || 0) + 1)
  })
  const mid = (bodyMinY + bodyMaxY) * 0.5
  const low = [...counts.entries()]
    .filter(([y, n]) => n >= 8 && y < mid)
    .sort((a, b) => a[0] - b[0])
  if (low.length >= 2) return low[low.length - 1][0]
  if (low.length === 1) return low[0][0]
  return null
}

function makeWheel(radius, width) {
  const g = new THREE.Group()
  g.name = 'Tire'
  const rubber = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92, metalness: 0.05 }),
  )
  rubber.rotation.z = Math.PI / 2
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, width + 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.45, metalness: 0.35 }),
  )
  hub.rotation.z = Math.PI / 2
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width + 0.08, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.4 }),
  )
  cap.rotation.z = Math.PI / 2
  g.add(rubber, hub, cap)
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

export async function createDelivery({
  scene, player, loader, foodWorld, foodProtos = {},
  x = 0, z = 0,
} = {}) {
  const { root } = await loader.load('items/Truck')
  hideTriggers(root)

  // Converted extras: TruckRamp is a detached slab; the five Cylinder*
  // "wheels" bake in at roof height as 10cm slivers (local Y became world
  // up after the body quat). They inflated the AABB and launched boxes.
  detachNamed(root, /^(TruckRamp|TruckContentsTrigger|Cylinder)/i)

  const TIRE_R = 0.46
  const TIRE_W = 0.28
  const CLEARANCE = TIRE_R * 1.28

  // Native cab sits at +X. +90° yaw puts the open trailer toward +Z (the aisle).
  root.rotation.y = Math.PI / 2
  root.updateMatrixWorld(true)
  let box = boundsOf(root)
  const mid = box.getCenter(new THREE.Vector3())
  root.position.x += x - mid.x
  root.position.z += z - mid.z
  root.position.y -= box.min.y
  root.position.y += CLEARANCE
  root.updateMatrixWorld(true)
  box = boundsOf(root)
  const size = box.getSize(new THREE.Vector3())

  scene.add(root)
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })

  const openZ = box.max.z
  const cabZ = box.min.z
  const x0 = box.min.x
  const x1 = box.max.x
  const cx = (x0 + x1) / 2
  const width = x1 - x0
  const z0 = box.min.z
  const z1 = box.max.z

  // Axle stations along the body (0 = cab / z0, 1 = trailer door / z1).
  // Captured from pose.markAxle() clicks on the ortho side view.
  const AXLE_FROM_CAB = [0.215, 0.743]
  const axleX = [x0 - TIRE_W * 0.15, x1 + TIRE_W * 0.15]
  const axleZ = AXLE_FROM_CAB.map(t => z0 + size.z * t)
  for (const ax of axleX) {
    for (const az of axleZ) {
      const w = makeWheel(TIRE_R, TIRE_W)
      w.position.set(ax, TIRE_R, az)
      scene.add(w)
      root.attach(w)
    }
  }

  // Cargo floor sits above the tires so you cannot step in without the ramp.
  const sampled = sampleCargoFloor(root, openZ, x0, x1, box.min.y, box.max.y)
  const bedY = sampled != null
    ? sampled
    : Math.max(CLEARANCE + 0.35, box.min.y + size.y * 0.18)
  const rampW = Math.max(1.6, width * 0.72)
  const rampLen = Math.max(3.6, bedY / Math.tan(THREE.MathUtils.degToRad(16)))
  const rampZ0 = openZ - 0.35
  const rampZ1 = openZ + rampLen

  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x + 4.5, size.z + rampLen + 5),
    new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.95 }),
  )
  dock.rotation.x = -Math.PI / 2
  dock.position.set(x, 0.008, z)
  dock.receiveShadow = true
  scene.add(dock)

  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x8d8880, roughness: 0.82, metalness: 0.08,
  })
  const rampMesh = new THREE.Mesh(
    new THREE.BoxGeometry(rampW, 0.07, Math.hypot(rampLen, bedY)),
    rampMat,
  )
  // +X pitch puts the +Z (aisle) end on the ground and the −Z end at bed height.
  const rampAngle = Math.atan2(bedY, rampLen)
  rampMesh.rotation.x = rampAngle
  rampMesh.position.set(cx, bedY / 2, (rampZ0 + rampZ1) / 2)
  rampMesh.castShadow = rampMesh.receiveShadow = true
  scene.add(rampMesh)

  // Cab is solid. Trailer hull is a hollow AABB with a +Z door at the ramp —
  // thin 18 cm side AABBs tunneled (player moves 27 cm/frame at 16 m/s).
  const cabDepth = Math.min(size.z * 0.42, 2.4)
  const cargoZ0 = cabZ + cabDepth
  const cargoZ1 = openZ
  const trailX = sampleTrailerX(root, cargoZ0 + 0.2, cargoZ1 - 0.15, bedY + 0.2, bedY + 1.15)
    || { minx: x0, maxx: x1 }
  const sampledInner = sampleCargoInnerX(
    root, trailX.minx, trailX.maxx,
    cargoZ0 + 0.25, cargoZ1 - 0.35,
    bedY + 0.28, bedY + 0.95,
  )
  // People use a modest wall shell so the bed stays walkable. Boxes use
  // the sampled inner faces (wheel wells, ribs) so they cannot poke out.
  const WALL = 0.14
  const outerX0 = trailX.minx
  const outerX1 = trailX.maxx
  const innerX0 = outerX0 + WALL
  const innerX1 = outerX1 - WALL

  player.addCollider(
    { x: x0, z: cabZ },
    { x: x1, z: cargoZ0 },
  )
  const doorHalf = Math.min(rampW, innerX1 - innerX0) * 0.5 - 0.02
  player.addHull({
    outer: { minx: outerX0, maxx: outerX1, minz: cargoZ0, maxz: cargoZ1 },
    inner: { minx: innerX0, maxx: innerX1, minz: cargoZ0 + 0.08, maxz: cargoZ1 },
    doorX: cx,
    doorHalf: Math.max(0.55, doorHalf),
    doorZ: cargoZ1,
  })

  // Walkable surfaces. Bed matches the cargo inner so a side approach
  // cannot ride groundY up onto the floor through the wall.
  player.addPlatform({
    minx: cx - rampW / 2, maxx: cx + rampW / 2,
    minz: rampZ0, maxz: rampZ1,
    z0: rampZ1, z1: rampZ0, y0: 0, y1: bedY,
  })
  player.addPlatform({
    minx: innerX0, maxx: innerX1,
    minz: cargoZ0 + 0.12, maxz: openZ + 0.08,
    y: bedY,
  })

  let boxTex = null
  const boxProto = (await loader.load('items/Box')).root
  hideTriggers(boxProto)
  boxProto.traverse(o => {
    if (o.isMesh && o.material && o.material.map) boxTex = o.material.map
  })

  const boxes = []

  function stamp(object, item) {
    object.userData.food = item
    object.userData.box = item
    object.traverse(o => { o.userData.food = item; o.userData.box = item })
  }

  function spawnClosed(px, pz, contents) {
    const object = boxProto.clone(true)
    // layoutFood recenters via position; add the slot instead of overwriting
    // (the native Box pivot is a corner — set() was shoving the right column
    // through the trailer wall).
    const { height } = layoutFood(object, { maxSize: BOX_SIZE, sit: true, type: 'box' })
    object.position.x += px
    object.position.z += pz
    object.position.y += bedY
    object.rotation.y = (Math.random() - 0.5) * 0.12
    scene.add(object)
    const item = {
      kind: 'box',
      type: 'box',
      contents,
      opened: false,
      dropped: false,
      object,
      position: object.position,
      radius: BOX_SIZE * 0.55,
      height,
      foodBeenOnFloor: false,
      held: false,
      stolen: null,
      vel: new THREE.Vector3(),
      onFloor: true,
      fromSpawner: null,
      onLand: openBox,
    }
    stamp(object, item)
    foodWorld.items.push(item)
    boxes.push(item)
    return item
  }

  function spillFood(origin, contents) {
    const spec = SPILL[contents] || SPILL[Contents.meat]
    const gy = player.groundY(origin.x, origin.z)
    for (const row of spec) {
      const proto = foodProtos[row.slug]
      if (!proto) continue
      const n = randInt(row.n[0], row.n[1])
      for (let i = 0; i < n; i++) {
        const ox = (Math.random() - 0.5) * 0.35
        const oz = (Math.random() - 0.5) * 0.35
        const food = foodWorld.spawn({
          proto, type: row.type,
          x: origin.x + ox,
          z: origin.z + oz,
          y: gy + 0.25 + i * 0.08,
          onFloor: false,
          maxSize: 0.15,
        })
        food.vel.set(
          (Math.random() - 0.5) * 3.4,
          1.2 + Math.random() * 2.2,
          (Math.random() - 0.5) * 3.4,
        )
        food.foodBeenOnFloor = false
        food.onFloor = false
      }
    }
  }

  function openBox(item) {
    if (!item || item.opened || item.kind !== 'box') return
    item.opened = true
    item.held = false
    const pos = item.object.position.clone()
    const gy = player.groundY(pos.x, pos.z)
    if (item.object.parent) item.object.parent.remove(item.object)
    const i = foodWorld.items.indexOf(item)
    if (i >= 0) foodWorld.items.splice(i, 1)

    const net = makeOpenNet(boxTex, BOX_SIZE)
    net.position.set(pos.x, gy, pos.z)
    net.rotation.y = item.object.rotation.y
    scene.add(net)

    spillFood(pos, item.contents)
    return net
  }

  // Two rows in the trailer, mixed contents. Original spawned 4–9.
  // Inset by half the cube plus a skin of wall so rotation cannot poke out.
  const boxInnerX0 = sampledInner ? Math.max(innerX0, sampledInner.minx) : innerX0
  const boxInnerX1 = sampledInner ? Math.min(innerX1, sampledInner.maxx) : innerX1
  const boxPad = BOX_SIZE * 0.5 + 0.12
  const packX0 = boxInnerX0 + boxPad
  const packX1 = boxInnerX1 - boxPad
  const packZ0 = cargoZ0 + 0.55
  const packZ1 = openZ - 0.7
  const cols = packX1 - packX0 > BOX_SIZE + 0.16 ? 2 : 1
  const rows = 2
  let n = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = packX0 + (packX1 - packX0) * (cols === 1 ? 0.5 : c / (cols - 1))
      const pz = packZ0 + (packZ1 - packZ0) * (rows === 1 ? 0.5 : r / (rows - 1))
      spawnClosed(px, pz, CONTENTS_CYCLE[n % CONTENTS_CYCLE.length])
      n++
    }
  }

  return {
    object: root,
    boxes,
    openBox,
    x, z,
    bedY,
    size,
    ramp: { z0: rampZ0, z1: rampZ1, width: rampW, length: rampLen },
    viewSpot() {
      return {
        stand: { x: cx, z: rampZ1 + 2.4 },
        look: { x: cx, y: bedY + 0.55, z: openZ + 0.4 },
      }
    },
    cargo: {
      outer: { minx: outerX0, maxx: outerX1, minz: cargoZ0, maxz: cargoZ1 },
      inner: { minx: innerX0, maxx: innerX1 },
      bedY,
    },
    width: size.x + 2,
    depth: size.z + rampLen + 4,
    height: size.y,
  }
}
