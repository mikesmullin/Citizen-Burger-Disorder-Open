// Number-stand seating. Kritz used a 4 s trigger on the queue; we hit-test
// a dropped stand near the slot-1 leader in getStand. Confirm does not seat.

import { C } from '../common/ecs.js'
import { foodWorldPos } from './food.js'

const RANGE = 1.2
const DEBOUNCE = 4
const lastHit = new Map()

export function fillPiles(ctx) {
  const { foodWorld, standProto, standPiles } = ctx
  if (!foodWorld || !standProto || !standPiles) return
  const free = foodWorld.items.filter(i => i.type === 'numberStand' && !i.held)
  for (const home of standPiles) {
    const occupied = free.some(i => {
      const p = foodWorldPos(i)
      return Math.hypot(p.x - home.x, p.z - home.z) < 0.22
    })
    if (occupied) continue
    foodWorld.spawn({
      proto: standProto, type: 'numberStand', slug: 'items/NumberStand',
      x: home.x, z: home.z, y: home.y, maxSize: 0.28,
    })
  }
}

export function attachStand(world, leaderEid, item, ctx) {
  if (!item || !item.object) return
  const view = world.field(leaderEid, C.View)
  const cust = world.field(leaderEid, C.Customer)
  if (!cust) return
  if (item.held && ctx && ctx.hands && ctx.hands.releaseItem) ctx.hands.releaseItem(item)
  item.held = true
  item.kinematic = true
  item.dropped = false
  if (item.vel) item.vel.set(0, 0, 0)
  if (view && view.object) {
    view.object.attach(item.object)
    item.object.position.set(0.28, 1.05, 0.18)
    item.object.rotation.set(0, 0, 0)
  }
  cust.holdingFood = item
}

export function releaseStand(cust, ctx) {
  const item = cust && cust.holdingFood
  if (!item || item.type !== 'numberStand') return
  cust.holdingFood = null
  if (ctx && ctx.foodWorld) ctx.foodWorld.destroy(item)
  fillPiles(ctx)
}

export function update(world, ctx) {
  const T = ctx.T || 0
  const foodWorld = ctx.foodWorld
  if (!foodWorld) return

  for (const [, cust, think] of world.query(C.Customer, C.Thinker)) {
    if (!cust.holdingFood || cust.holdingFood.type !== 'numberStand') continue
    if (think.want !== 'goToSeat' && think.want !== 'getStand') {
      releaseStand(cust, ctx)
    }
  }

  let leaderEid = 0
  let leaderTf = null
  for (const [eid, cust, think, tf] of world.query(C.Customer, C.Thinker, C.Transform)) {
    if (think.want === 'getStand' && cust.leader === eid) {
      leaderEid = eid
      leaderTf = tf
      break
    }
  }
  if (!leaderEid || !leaderTf) return
  const last = lastHit.get(leaderEid) || -999
  if (T - last < DEBOUNCE) return
  for (const item of foodWorld.items) {
    if (item.type !== 'numberStand') continue
    if (item.held || item.kinematic) continue
    if (!item.dropped) continue
    const p = foodWorldPos(item)
    if (Math.hypot(p.x - leaderTf.x, p.z - leaderTf.z) > RANGE) continue
    lastHit.set(leaderEid, T)
    world.emit('StandThrown', { leaderEid, standItem: item })
    return
  }
}
