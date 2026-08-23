import { C } from '../common/ecs.js'
import { clearGoal } from './locomotion.js'

export function update(world) {
  for (const [, cust, think, loco, speech] of world.query(C.Customer, C.Thinker, C.Locomotor, C.Speech)) {
    if (think.want !== 'goToSeat') continue
    if (loco.hasGoal && loco.arrivedist > 1) continue
    clearGoal(loco)
    think.prevWant = think.want
    think.want = 'waitFood'
    think.angerTickAt = 0
    speech.icon = cust.desiredFood
    speech.nearOnly = true
  }
}
