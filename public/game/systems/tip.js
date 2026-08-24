import { C } from '../common/ecs.js'
import { tipCount } from '../gamedata/menu.js'

// After the diner takes the burger: watch the chew + falling plate, then
// the cash pops (~1 s) and they walk out right after.
const TIP_DELAY = 1.0
const pending = []

export function update(world, ctx) {
  const T = ctx.T || 0
  for (const { payload } of world.drain('FoodServed')) {
    pending.push({ at: T + TIP_DELAY, payload })
  }
  const foodWorld = ctx.foodWorld
  const proto = ctx.tipProto
  if (!foodWorld || !proto) return
  for (let i = 0; i < pending.length; ) {
    if (T < pending[i].at) {
      i++
      continue
    }
    const payload = pending[i].payload
    pending.splice(i, 1)
    const tf = payload.customer && world.field(payload.customer, C.Transform)
    const x = tf ? tf.x : payload.x
    const y = tf ? tf.y + 1.5 : payload.y
    const z = tf ? tf.z : payload.z
    const n = tipCount(payload.score)
    if (n > 0 && foodWorld.sfx && foodWorld.sfx.slurp) {
      foodWorld.sfx.slurp({ x, y, z })
    }
    for (let k = 0; k < n; k++) {
      const item = foodWorld.spawn({
        proto, type: 'tip', slug: 'items/Tip',
        x: x + (Math.random() - 0.5) * 0.5,
        y,
        z: z + (Math.random() - 0.5) * 0.5,
      })
      item.vel.y = 4 + Math.random() * 2
      item.vel.x = (Math.random() - 0.5) * 2
      item.vel.z = 1.2 + Math.random()
      item.dropped = true
    }
  }
}
