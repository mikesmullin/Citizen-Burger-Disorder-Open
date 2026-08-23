import { C } from '../common/ecs.js'
import { setGoal } from './locomotion.js'

export function update(world, dt, ctx) {
  const T = ctx.T || 0
  for (const [eid, cust, think, loco] of world.query(C.Customer, C.Thinker, C.Locomotor)) {
    if (think.want !== 'waitFood') continue
    if (!think.angerTickAt) think.angerTickAt = T + 15 + Math.random() * 15
    if (T < think.angerTickAt) continue
    think.angerTickAt = T + 15 + Math.random() * 15
    cust.anger += 10 + Math.random() * 15
    if (cust.anger > 100) {
      think.prevWant = think.want
      think.want = 'leave'
      const seat = world.field(cust.seat, C.Seat)
      if (seat) seat.occupiedBy = 0
      cust.seat = 0
      if (ctx.door) setGoal(loco, ctx.door.x, ctx.door.z)
      world.emit('CustomerLeft', { eid, reason: 'angry' })
    }
  }
}
