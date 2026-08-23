import { C } from '../common/ecs.js'
import { setGoal } from './locomotion.js'

export function assignGroup(world, leaderEid, tableId) {
  const leader = world.field(leaderEid, C.Customer)
  if (!leader) return
  const seats = [...world.query(C.Seat, C.Transform)]
    .filter(([, s]) => s.tableId === tableId && !s.occupiedBy)
  const members = [...world.query(C.Customer, C.Thinker, C.Locomotor)]
    .filter(([, c]) => c.groupId === leader.groupId)
  members.forEach(([eid, cust, think, loco], i) => {
    const row = seats[i]
    if (!row) return
    const [seatEid, seat, stf] = row
    seat.occupiedBy = eid
    cust.seat = seatEid
    cust.tableId = tableId
    think.prevWant = think.want
    think.want = 'goToSeat'
    setGoal(loco, stf.x, stf.z)
    loco.indoor = true
    if (cust.queueSlot >= 0) {
      for (const [, slot] of world.query(C.QueueSlot)) {
        if (slot.occupiedBy === eid) slot.occupiedBy = 0
      }
      cust.queueSlot = -1
    }
  })
  world.emit('SeatAssigned', { groupId: leader.groupId, tableId, leaderEid })
}

export function update(world) {
  for (const { payload } of world.drain('OrderConfirmed')) {
    assignGroup(world, payload.leaderEid, payload.tableId)
  }
}
