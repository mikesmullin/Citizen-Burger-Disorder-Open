// Bitmask world. Game9 GI_alive / ECS__field / ECS__query without archetypes.
// Inclusive queries: Transform+Rigidbody also matches Transform+Rigidbody+Customer.
// Stable signatures — flip Thinker.want, do not add/remove components at runtime.

export const C = Object.freeze({
  Transform:   1 << 0,
  Rigidbody:   1 << 1,
  View:        1 << 2,
  Grabbable:   1 << 3,
  Food:        1 << 4,
  Plate:       1 << 5,
  Thinker:     1 << 6,
  Locomotor:   1 << 7,
  Customer:    1 << 8,
  Seat:        1 << 9,
  QueueSlot:   1 << 10,
  Table:       1 << 11,
  Order:       1 << 12,
  Tip:         1 << 13,
  Speech:      1 << 14,
  Register:    1 << 15,
  NumberStand: 1 << 16,
})

const SLOT_BITS = 16
const SLOT_MASK = (1 << SLOT_BITS) - 1

export function createWorld() {
  const slots = []
  const free = []
  const events = []
  let gen = 1

  function spawn(mask, comps, name = '') {
    const i = free.length ? free.pop() : slots.length
    const g = gen++
    slots[i] = { gen: g, mask, alive: true, comps, name }
    return (g << SLOT_BITS) | i
  }

  function unpack(eid) {
    return { i: eid & SLOT_MASK, g: eid >>> SLOT_BITS }
  }

  function alive(eid) {
    const { i, g } = unpack(eid)
    const s = slots[i]
    return !!(s && s.alive && s.gen === g)
  }

  function kill(eid) {
    const { i, g } = unpack(eid)
    const s = slots[i]
    if (!s || s.gen !== g || !s.alive) return
    s.alive = false
    free.push(i)
  }

  function field(eid, kind) {
    if (!alive(eid)) return null
    const s = slots[eid & SLOT_MASK]
    return (s.mask & kind) ? s.comps.get(kind) : null
  }

  function nameOf(eid) {
    if (!alive(eid)) return ''
    return slots[eid & SLOT_MASK].name || ''
  }

  function* query(...kinds) {
    const need = kinds.reduce((a, b) => a | b, 0)
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (!s || !s.alive || (s.mask & need) !== need) continue
      const eid = (s.gen << SLOT_BITS) | i
      const row = [eid]
      for (const k of kinds) row.push(s.comps.get(k))
      yield row
    }
  }

  function emit(type, payload) {
    events.push({ type, payload })
  }

  function drain(type) {
    if (!type) {
      const all = events.slice()
      events.length = 0
      return all
    }
    const out = []
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === type) out.push(events.splice(i, 1)[0])
    }
    return out.reverse()
  }

  return { spawn, kill, alive, field, query, emit, drain, nameOf, slots }
}
