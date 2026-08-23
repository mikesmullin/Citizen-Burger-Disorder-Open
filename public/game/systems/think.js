import { C } from '../common/ecs.js'
import { BRAINS } from '../gamedata/brains.js'

export function update(world, dt, ctx) {
  for (const [eid] of world.query(C.Thinker, C.Customer)) {
    const fn = BRAINS['mobs/Npc']
    if (fn) fn(world, eid, { ...ctx, dt })
  }
}
