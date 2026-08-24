import { C } from '../common/ecs.js'
import { setGoal, clearGoal } from '../systems/locomotion.js'
import { setPlateDirty } from '../systems/food.js'

export function Npc__think(world, eid, ctx) {
  const think = world.field(eid, C.Thinker)
  const loco = world.field(eid, C.Locomotor)
  const cust = world.field(eid, C.Customer)
  const tf = world.field(eid, C.Transform)
  const T = ctx.T || 0
  if (!think || !loco || !cust || !tf) return

  if (think.want === 'wander') {
    if (!loco.hasGoal) {
      const nodes = ctx.indoorNodes || []
      if (nodes.length) {
        const n = nodes[(Math.random() * nodes.length) | 0]
        setGoal(loco, n.x, n.z)
      }
    } else if (loco.arrivedist < 1.6) {
      clearGoal(loco)
      think.prevWant = 'wander'
      think.want = 'idle'
      think.waitUntil = T + 1 + Math.random() * 5
    }
  }

  if (think.want === 'idle' && T > think.waitUntil) {
    think.want = think.prevWant === 'queue' ? 'queue' : 'wander'
  }

  if (think.want === 'eat') {
    const food = cust.holdingFood
    if (food && food.object) {
      food.held = true
      if (food.vel) food.vel.set(0, 0, 0)
      const mx = tf.x
      const my = tf.y + 1.45
      const mz = tf.z
      const p = food.object.position
      p.x += (mx - p.x) * Math.min(1, 8 * (ctx.dt || 0.016))
      p.y += (my - p.y) * Math.min(1, 8 * (ctx.dt || 0.016))
      p.z += (mz - p.z) * Math.min(1, 8 * (ctx.dt || 0.016))
      if (food.stack) {
        for (const f of food.stack) {
          if (f && f.object) {
            f.held = true
            f.object.position.y = p.y + 0.08
            f.object.position.x = p.x
            f.object.position.z = p.z
          }
        }
      }
      const pulse = 1 + Math.sin(T * 10) * 0.07
      if (!food._eatScale) food._eatScale = food.object.scale.x || 1
      food.object.scale.setScalar(food._eatScale * pulse)
    }
    if (!think.waitUntil) think.waitUntil = T + 4
    if (T >= think.waitUntil) {
      if (food && ctx.foodWorld) ctx.foodWorld.destroy(food)
      if (food && food.stack && ctx.foodWorld) {
        for (const f of food.stack) ctx.foodWorld.destroy(f)
      }
      cust.holdingFood = null
      cust.holding = 0
      if (cust.servedPlate) {
        setPlateDirty(cust.servedPlate)
        cust.servedPlate = null
      }
      think.prevWant = think.want
      think.want = 'leave'
      const seat = world.field(cust.seat, C.Seat)
      if (seat) seat.occupiedBy = 0
      cust.seat = 0
      if (ctx.door) setGoal(loco, ctx.door.x, ctx.door.z)
      world.emit('CustomerLeft', { eid, reason: 'served' })
    }
  }

  if (think.want === 'leave') {
    if (ctx.door && (!loco.hasGoal || loco.arrivedist < 1.6)) {
      think.prevWant = think.want
      think.want = 'exit'
      if (ctx.street) setGoal(loco, ctx.street.x, ctx.street.z)
    }
  }

  if (think.want === 'exit') {
    if (!loco.hasGoal || loco.arrivedist < 1.2) {
      world.emit('CustomerDespawn', { eid })
    }
  }
}

export const BRAINS = { 'mobs/Npc': Npc__think }
