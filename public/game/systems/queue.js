import { C } from '../common/ecs.js'
import { setGoal, clearGoal } from './locomotion.js'

const ARRIVE = 1.6

export function update(world) {
  const slots = [...world.query(C.QueueSlot, C.Transform)]
    .sort((a, b) => a[1].slotId - b[1].slotId)

  for (const [eid, cust, think, loco, tf] of world.query(C.Customer, C.Thinker, C.Locomotor, C.Transform)) {
    if (think.want !== 'queue' && think.want !== 'enter') continue
    if (think.want === 'enter' && loco.hasGoal && loco.arrivedist > ARRIVE) continue
    if (think.want === 'enter') {
      think.prevWant = think.want
      think.want = (cust.leader === eid) ? 'queue' : 'wander'
      loco.indoor = true
      if (think.want !== 'queue') { clearGoal(loco); continue }
    }
    if (cust.queueSlot < 0) {
      const free = slots.find(row => !row[1].occupiedBy)
      if (!free) {
        think.want = 'wander'
        cust.anger += 5 + Math.random() * 5
        continue
      }
      const slot = free[1]
      const stf = free[2]
      slot.occupiedBy = eid
      cust.queueSlot = slot.slotId
      setGoal(loco, stf.x, stf.z)
    }
    if (cust.queueSlot < 0) continue
    const row = slots.find(s => s[1].slotId === cust.queueSlot)
    if (!row) continue
    const stf = row[2]
    const dist = Math.hypot(tf.x - stf.x, tf.z - stf.z)
    loco.arrivedist = dist
    if (dist < 0.45) {
      tf.x = stf.x
      tf.z = stf.z
      clearGoal(loco)
      if (cust.queueSlot === 1 && think.want === 'queue') {
        think.prevWant = think.want
        think.want = 'order'
      }
    }
  }

  for (let i = 0; i < slots.length - 1; i++) {
    const slot = slots[i][1]
    const next = slots[i + 1][1]
    if (!slot.occupiedBy && next.occupiedBy) {
      const who = next.occupiedBy
      const cust = world.field(who, C.Customer)
      const think = world.field(who, C.Thinker)
      const loco = world.field(who, C.Locomotor)
      const stf = slots[i][2]
      next.occupiedBy = 0
      slot.occupiedBy = who
      if (cust) cust.queueSlot = slot.slotId
      if (think) think.want = 'queue'
      if (loco && stf) setGoal(loco, stf.x, stf.z)
    }
  }
}
