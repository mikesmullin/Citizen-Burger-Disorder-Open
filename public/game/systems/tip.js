import { tipCount } from '../gamedata/menu.js'

export function update(world, ctx) {
  const foodWorld = ctx.foodWorld
  const proto = ctx.tipProto
  if (!foodWorld || !proto) {
    world.drain('FoodServed')
    return
  }
  for (const { payload } of world.drain('FoodServed')) {
    const n = tipCount(payload.score)
    for (let i = 0; i < n; i++) {
      const item = foodWorld.spawn({
        proto, type: 'tip', slug: 'items/Tip',
        x: payload.x + (Math.random() - 0.5) * 0.5,
        y: payload.y,
        z: payload.z + (Math.random() - 0.5) * 0.5,
      })
      item.vel.y = 4 + Math.random() * 2
      item.vel.x = (Math.random() - 0.5) * 2
      item.vel.z = 1.2 + Math.random()
      item.dropped = true
    }
  }
}
