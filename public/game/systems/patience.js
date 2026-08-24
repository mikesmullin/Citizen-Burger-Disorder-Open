import { C } from '../common/ecs.js'
import { setGoal } from './locomotion.js'

export function update(world, dt, ctx) {
  const T = ctx.T || 0
  for (const [eid, cust, think, loco] of world.query(C.Customer, C.Thinker, C.Locomotor)) {
    if (think.want !== 'waitFood' && think.want !== 'getStand') continue
    if (!think.angerTickAt) think.angerTickAt = T + 15 + Math.random() * 15
    if (T < think.angerTickAt) continue
    think.angerTickAt = T + 15 + Math.random() * 15
    cust.anger += 10 + Math.random() * 15
    if (cust.anger > 100) {
      const leftFrom = think.want
      think.prevWant = think.want
      think.want = 'leave'
      const seat = world.field(cust.seat, C.Seat)
      if (seat) seat.occupiedBy = 0
      cust.seat = 0
      if (cust.queueSlot >= 0) {
        for (const [, slot] of world.query(C.QueueSlot)) {
          if (slot.occupiedBy === eid) slot.occupiedBy = 0
        }
        cust.queueSlot = -1
      }
      if (leftFrom === 'getStand' && cust.tableId) {
        for (const [, order] of world.query(C.Order)) {
          if (order.tableId === cust.tableId && order.status === 'hanging') {
            order.status = 'abandoned'
          }
        }
      }
      if (ctx.door) setGoal(loco, ctx.door.x, ctx.door.z)
      world.emit('CustomerLeft', { eid, reason: 'angry' })
    }
  }
}
