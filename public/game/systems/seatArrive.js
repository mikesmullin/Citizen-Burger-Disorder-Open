import { C } from '../common/ecs.js'
import { clearGoal } from './locomotion.js'
import { facingTo } from './waitLook.js'

export function update(world) {
  for (const [, cust, think, loco, speech, tf] of world.query(
    C.Customer, C.Thinker, C.Locomotor, C.Speech, C.Transform,
  )) {
    if (think.want !== 'goToSeat') continue
    if (loco.hasGoal && loco.arrivedist > 1) continue
    clearGoal(loco)
    think.prevWant = think.want
    think.want = 'waitFood'
    think.angerTickAt = 0
    speech.icon = cust.desiredFood
    speech.nearOnly = true
    let restRy = tf.ry
    const seatTf = world.field(cust.seat, C.Transform)
    const fromX = seatTf ? seatTf.x : tf.x
    const fromZ = seatTf ? seatTf.z : tf.z
    if (cust.tableId) {
      for (const [, table, ttf] of world.query(C.Table, C.Transform)) {
        if (table.tableId !== cust.tableId) continue
        restRy = facingTo(fromX, fromZ, ttf.x, ttf.z)
        break
      }
    }
    think.restRy = restRy
    tf.ry = restRy
  }
}
