import { C } from '../common/ecs.js'

export function update(world, ctx) {
  const foodWorld = ctx.foodWorld
  if (!foodWorld) return
  for (const [, reg, rtf] of world.query(C.Register, C.Transform)) {
    for (const item of foodWorld.items.slice()) {
      if (item.type !== 'tip') continue
      if (Math.hypot(item.position.x - rtf.x, item.position.z - rtf.z) > 0.85) continue
      if (item.position.y > rtf.y + 1.5) continue
      // Held or not, the till takes it on contact: no need to drop it.
      if (item.held) {
        const hands = ctx.hands
        for (const arm of hands ? [hands.left, hands.right] : []) {
          if (arm && arm.holding === item) arm.holding = null
        }
        item.held = false
      }
      reg.money += 2
      foodWorld.destroy(item)
      world.emit('TipCollected', { value: 2, money: reg.money })
    }
  }
}
