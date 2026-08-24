// Cmp* factories. Data only — no methods. Defaults match Game9 / FRONT_PLAN.

export function Transform(o = {}) {
  return {
    x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0,
    sx: o.sx ?? 1, sy: o.sy ?? 1, sz: o.sz ?? 1,
    rx: o.rx ?? 0, ry: o.ry ?? 0, rz: o.rz ?? 0,
  }
}

export function Rigidbody(o = {}) {
  return {
    mass: o.mass ?? 1,
    vx: 0, vy: 0, vz: 0,
    restitution: o.restitution ?? 0.4,
    friction: o.friction ?? 1,
  }
}

export function Locomotor(o = {}) {
  return {
    walkspeed: o.walkspeed ?? 4.2,
    runspeed: o.runspeed ?? 5.6,
    maxspeed: o.maxspeed ?? 6,
    indoor: false,
    goalx: 0, goalz: 0, hasGoal: false,
    dirx: 0, dirz: 1,
    arrivedist: 0,
  }
}

export function Thinker(o = {}) {
  return {
    want: o.want ?? 'wander',
    prevWant: o.want ?? 'wander',
    waitUntil: 0,
    angerTickAt: 0,
    restRy: o.restRy ?? null,
  }
}

export function Customer(o = {}) {
  return {
    groupId: o.groupId ?? 0,
    leader: o.leader ?? 0,
    desiredFood: o.desiredFood ?? '',
    anger: 0,
    holding: 0,
    holdingFood: null,
    servedPlate: null,
    queueSlot: -1,
    seat: 0,
    tableId: 0,
    skin: o.skin ?? 'Npc1',
  }
}

export function View(object, o = {}) {
  return { object, footY: o.footY ?? 0, mover: null }
}

export function QueueSlot(o = {}) {
  return { slotId: o.slotId ?? 0, occupiedBy: 0 }
}

export function Table(o = {}) {
  return { tableId: o.tableId ?? 1, capacity: o.capacity ?? 2 }
}

export function Seat(o = {}) {
  return { tableId: o.tableId ?? 1, occupiedBy: 0 }
}

export function Order(o = {}) {
  return {
    tableId: o.tableId ?? 0,
    items: o.items ?? [],
    status: o.status ?? 'drafting',
    leaderEid: o.leaderEid ?? 0,
  }
}

export function Speech(o = {}) {
  return { icon: o.icon ?? '', nearOnly: o.nearOnly ?? false }
}

export function Tip(o = {}) {
  return { value: o.value ?? 2 }
}

export function Register(o = {}) {
  return { money: o.money ?? 100 }
}

export function NumberStand(o = {}) {
  return { number: o.number ?? 0 }
}

export function Food(o = {}) {
  return {
    type: o.type ?? 'other',
    cooked: o.cooked ?? 0,
    overcooked: o.overcooked ?? 0,
    stack: o.stack ?? [],
    complete: false,
    onFloor: false,
    held: false,
  }
}

export function Plate(o = {}) {
  return { food: o.food ?? 0 }
}

export function Grabbable(o = {}) {
  return { pickup: o.pickup !== false, held: false }
}
