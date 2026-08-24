import * as THREE from 'three'
import { C } from '../common/ecs.js'
import { spawnPrefab } from '../gamedata/prefabs.js'
import { setGoal } from './locomotion.js'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { setPlateDirty } from './food.js'

const SKINS = ['Npc1', 'Npc2', 'Npc3', 'Npc4', 'Npc5', 'Npc6']
const EASTER = ['Jorji', 'CookServe']
const MAX = 10
const QUEUE_CAP = 4
const MIN_DELAY = 8
const HEIGHT = 1.85
const RADIUS = 0.42

const _skins = {}

function loadSkin(name) {
  if (_skins[name]) return _skins[name]
  const t = new THREE.TextureLoader().load(`./assets/textures/skins/${name}.png`)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = true
  _skins[name] = t
  return t
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

function makeBadgeBubble() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')
  g.fillStyle = '#f4fff8'
  g.strokeStyle = '#2a2a2a'
  g.lineWidth = 7
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(108, 114)
  g.lineTo(150, 120)
  g.lineTo(118, 176)
  g.closePath()
  g.fill()
  g.stroke()
  g.beginPath()
  g.ellipse(128, 70, 108, 54, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map, transparent: true, depthWrite: false, sizeAttenuation: true,
  }))
  m.scale.set(0.78, 0.58, 1)
  m.visible = false
  m.userData.bubbleCanvas = c
  m.userData.bubbleCtx = g
  m.userData.bubbleMap = map
  m.userData.icon = ''
  return m
}

export function cloneCustomerMesh(proto, skin, bubbles) {
  const object = proto.clone(true)
  applySkin(object, loadSkin(skin))
  sitOnFloor(object)
  const footY = object.position.y
  const bubbleSlot = bubbles ? bubbles.alloc() : -1
  const bubble = bubbleSlot < 0 ? makeBadgeBubble() : null
  object.userData.bubble = bubble
  object.userData.bubbleSlot = bubbleSlot
  object.userData.footY = footY
  object.name = 'FrontNPC:' + skin
  return { object, footY, bubble, bubbleSlot }
}

function freeCapacity(world, size) {
  for (const [, table] of world.query(C.Table)) {
    let used = 0
    for (const [, seat] of world.query(C.Seat)) {
      if (seat.tableId === table.tableId && seat.occupiedBy) used++
    }
    if (table.capacity >= size && used === 0) return true
  }
  return false
}

function groupSize() {
  const r = Math.random()
  if (r > 0.9) return 3
  if (r > 0.7) return 4
  if (r > 0.2) return 2
  return 1
}

function countCustomers(world) {
  let n = 0
  for (const _ of world.query(C.Customer)) n++
  return n
}

function countInQueue(world) {
  let n = 0
  for (const [, cust, think] of world.query(C.Customer, C.Thinker)) {
    if (cust.queueSlot >= 0) n++
    else if (think.want === 'enter' || think.want === 'queue' || think.want === 'order' || think.want === 'getStand') n++
  }
  return n
}

function queueCap(world) {
  let n = 0
  for (const _ of world.query(C.QueueSlot)) n++
  return n || QUEUE_CAP
}

let nextAt = 0
let groupSeq = 1
let special = true

export function resetSpawn() {
  nextAt = 0
  groupSeq = 1
  special = true
}

function despawn(world, eid, ctx) {
  const view = world.field(eid, C.View)
  const cust = world.field(eid, C.Customer)
  if (cust) {
    if (cust.seat) {
      const seat = world.field(cust.seat, C.Seat)
      if (seat) seat.occupiedBy = 0
    }
    if (cust.queueSlot >= 0) {
      for (const [, slot] of world.query(C.QueueSlot)) {
        if (slot.occupiedBy === eid) slot.occupiedBy = 0
      }
    }
    if (cust.holdingFood && ctx.foodWorld) {
      const food = cust.holdingFood
      const wasStand = food.type === 'numberStand'
      ctx.foodWorld.destroy(food)
      if (food.stack) {
        for (const f of food.stack) ctx.foodWorld.destroy(f)
      }
      cust.holdingFood = null
      if (wasStand && ctx.fillStands) ctx.fillStands()
    }
    if (cust.servedPlate) {
      setPlateDirty(cust.servedPlate)
      cust.servedPlate = null
    }
    let others = 0
    for (const [other, c] of world.query(C.Customer)) {
      if (other !== eid && c.groupId === cust.groupId) others++
    }
    if (!others && cust.tableId) {
      for (const [, order] of world.query(C.Order)) {
        if (order.tableId === cust.tableId && order.status === 'hanging') {
          order.status = 'served'
        }
      }
    }
  }
  if (view) {
    if (view.mover && ctx.player?.movers) {
      const i = ctx.player.movers.indexOf(view.mover)
      if (i >= 0) ctx.player.movers.splice(i, 1)
    }
    const bubble = view.object?.userData?.bubble
    if (bubble && bubble.parent) bubble.parent.remove(bubble)
    const slot = view.object?.userData?.bubbleSlot
    if (slot >= 0 && ctx.bubbles) ctx.bubbles.release(slot)
    if (view.object && ctx.bodies) ctx.bodies.detach(view.object)
    if (view.object && view.object.parent) view.object.parent.remove(view.object)
  }
  world.kill(eid)
}

export function spawnGroup(world, {
  size, street, door, proto, scene, player, bubbles, bodies,
} = {}) {
  let n = countCustomers(world)
  size = Math.max(1, Math.min(size || groupSize(), MAX - n))
  if (size < 1) return []
  if (!freeCapacity(world, size)) return []
  const gid = groupSeq++
  let leader = 0
  const eids = []
  for (let i = 0; i < size; i++) {
    let skin = SKINS[(Math.random() * SKINS.length) | 0]
    if (special) {
      skin = EASTER[(Math.random() * EASTER.length) | 0]
      special = false
    }
    const { object, footY, bubble, bubbleSlot } = cloneCustomerMesh(proto, skin, bubbles)
    scene.add(object)
    if (bubble) scene.add(bubble)
    const x = street.x + (i - (size - 1) / 2) * 1.3
    const z = street.z + (Math.random() - 0.5) * 1.2
    const eid = spawnPrefab(world, 'mobs/Npc', {
      x, y: footY, z, object, extra: { footY },
    })
    const cust = world.field(eid, C.Customer)
    const think = world.field(eid, C.Thinker)
    const loco = world.field(eid, C.Locomotor)
    const view = world.field(eid, C.View)
    cust.skin = skin
    cust.groupId = gid
    object.userData.eid = eid
    object.traverse(o => { o.userData.eid = eid; o.userData.frontNpc = true })
    if (bodies) {
      bodies.attach(object, {
        skin,
        map: loadSkin(skin),
        payload: { frontNpc: true, eid, skin, object },
      })
    }
    if (view) {
      view.mover = { position: object.position, radius: RADIUS, eid }
      if (player) player.addMover(view.mover)
    }
    if (i === 0) {
      leader = eid
      cust.leader = eid
      think.want = 'enter'
      if (door) setGoal(loco, door.x, door.z)
    } else {
      cust.leader = leader
      think.want = 'wander'
    }
    eids.push(eid)
  }
  return eids
}

export function update(world, dt, ctx) {
  for (const { payload } of world.drain('CustomerDespawn')) {
    despawn(world, payload.eid, ctx)
  }
  const T = ctx.T || 0
  if (T < nextAt) return
  nextAt = T + MIN_DELAY + Math.random() * 6
  if (countCustomers(world) >= MAX) return
  if (countInQueue(world) >= queueCap(world)) return
  if (!ctx.proto || !ctx.street) return
  spawnGroup(world, {
    size: groupSize(),
    street: ctx.street,
    door: ctx.door,
    bubbles: ctx.bubbles,
    bodies: ctx.bodies,
    proto: ctx.proto,
    scene: ctx.scene,
    player: ctx.player,
  })
}
