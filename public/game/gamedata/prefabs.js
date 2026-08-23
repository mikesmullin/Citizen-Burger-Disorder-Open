import { C } from '../common/ecs.js'
import {
  Transform, Rigidbody, Food, Thinker, Customer, Locomotor, View, Speech,
  Tip, Grabbable, NumberStand, Register, QueueSlot, Seat, Table,
} from '../components/index.js'

export const Prefabs = {
  'mobs/Npc': {
    [C.Transform]: () => Transform(),
    [C.Locomotor]: () => Locomotor({ walkspeed: 4.2, runspeed: 5.6 }),
    [C.Thinker]:   () => Thinker({ want: 'enter' }),
    [C.Customer]:  () => Customer(),
    [C.Speech]:    () => Speech(),
    [C.View]:      null,
  },
  'front/QueueNode': {
    [C.Transform]: () => Transform(),
    [C.QueueSlot]: o => QueueSlot(o),
  },
  'front/Seat': {
    [C.Transform]: () => Transform(),
    [C.Seat]:      o => Seat(o),
  },
  'front/Table': {
    [C.Transform]: () => Transform(),
    [C.Table]:     o => Table(o),
  },
  'items/Tip': {
    [C.Transform]: () => Transform(),
    [C.Rigidbody]: () => Rigidbody({ mass: 0.05 }),
    [C.Tip]:       () => Tip({ value: 2 }),
    [C.Grabbable]: () => Grabbable(),
    [C.View]:      null,
  },
  'items/NumberStand': {
    [C.Transform]: () => Transform(),
    [C.Rigidbody]: () => Rigidbody({ mass: 0.4 }),
    [C.NumberStand]: o => NumberStand(o),
    [C.Grabbable]: () => Grabbable(),
    [C.View]:      null,
  },
  'front/Register': {
    [C.Transform]: () => Transform(),
    [C.Register]:  () => Register({ money: 100 }),
    [C.View]:      null,
  },
}

export function spawnPrefab(world, slug, {
  x = 0, y = 0, z = 0, object = null, extra = {},
} = {}) {
  const row = Prefabs[slug]
  if (!row) throw new Error('unknown prefab ' + slug)
  const comps = new Map()
  let mask = 0
  for (const [bit, make] of Object.entries(row)) {
    const kind = Number(bit)
    if (kind === C.View) {
      if (!object) continue
      comps.set(C.View, View(object, extra))
      mask |= C.View
      continue
    }
    if (!make) continue
    const c = make(extra)
    if (kind === C.Transform) { c.x = x; c.y = y; c.z = z }
    comps.set(kind, c)
    mask |= kind
  }
  const eid = world.spawn(mask, comps, slug)
  if (object) object.userData.eid = eid
  return eid
}
