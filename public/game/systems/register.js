import { C } from '../common/ecs.js'
import { foodWorldPos } from './food.js'

export function update(world, ctx) {
  const foodWorld = ctx.foodWorld
  if (!foodWorld) return
  for (const [, reg, rtf] of world.query(C.Register, C.Transform)) {
    for (const item of foodWorld.items.slice()) {
      if (item.type !== 'tip') continue
      const p = foodWorldPos(item)
      if (Math.hypot(p.x - rtf.x, p.z - rtf.z) > 0.85) continue
      if (p.y > rtf.y + 1.5) continue
      // Held or not, the till takes it on contact: no need to drop it.
      if (item.held) {
        const hands = ctx.hands
        if (hands && hands.releaseItem) hands.releaseItem(item)
        else {
          for (const arm of hands ? [hands.left, hands.right] : []) {
            if (arm && arm.holding === item) arm.holding = null
          }
          item.held = false
        }
      }
      reg.money += 2
      if (foodWorld.sfx && foodWorld.sfx.kaching) foodWorld.sfx.kaching(rtf)
      foodWorld.destroy(item)
      world.emit('TipCollected', { value: 2, money: reg.money })
    }
  }
}
