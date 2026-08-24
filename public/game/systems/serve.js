import { C } from '../common/ecs.js'
import { scoreFood } from '../gamedata/menu.js'

const MAT_R = 1.2

function detachPlate(plate) {
  const bun = plate.plated
  if (!bun) return null
  plate.plated = null
  bun.onPlate = null
  bun.inFood = false
  bun.stackedOn = null
  return bun
}

export function update(world, ctx) {
  const foodWorld = ctx.foodWorld
  if (!foodWorld) return
  for (const plate of foodWorld.items) {
    if (plate.type !== 'plate' || plate.held) continue
    if (!plate.plated || !plate.plated.complete) continue
    if (plate.plated.held) continue
    const ptf = plate.position
    for (const [custEid, cust, think, tf] of world.query(C.Customer, C.Thinker, C.Transform)) {
      if (think.want !== 'waitFood') continue
      if (Math.hypot(ptf.x - tf.x, ptf.z - tf.z) > MAT_R) continue
      const bun = detachPlate(plate)
      if (!bun) continue
      const score = scoreFood(cust.desiredFood || 'Citizen', bun)
      think.prevWant = think.want
      think.want = 'eat'
      think.waitUntil = 0
      bun.held = true
      if (bun.vel) bun.vel.set(0, 0, 0)
      cust.holding = 1
      cust.holdingFood = bun
      cust.servedPlate = plate
      const speech = world.field(custEid, C.Speech)
      if (speech) speech.icon = ''
      world.emit('FoodServed', {
        customer: custEid, score,
        x: tf.x, y: tf.y + 1.5, z: tf.z,
      })
      break
    }
  }
}
