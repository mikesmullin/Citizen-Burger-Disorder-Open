// BurgerStacking.cs + Plate.cs. Bottom bun collects food; top bun closes
// the stack. A closed burger that lands on an empty plate parents to it.

const STACKABLE = new Set([
  'patty', 'cheese', 'lettuce', 'lettuceHead', 'lettucePart',
  'bacon', 'tomato', 'topBun', 'bun', 'rat',
])

function xzDist(a, b) {
  const dx = a.position.x - b.position.x
  const dz = a.position.z - b.position.z
  return Math.hypot(dx, dz)
}

function stackHeight(item) {
  return Math.max(0.04, (item.height || 0.12) * 0.48)
}

export function isStackable(type) {
  return STACKABLE.has(type)
}

export function ensureStack(bun) {
  if (!bun.stack) bun.stack = []
  bun.complete = bun.stack.some(f => f.type === 'topBun')
  return bun.stack
}

export function layoutStack(bun) {
  if (!bun || !bun.stack || !bun.stack.length) return
  let y = bun.position.y + (bun.height || 0.12) * 0.45
  for (const f of bun.stack) {
    if (!f || !f.object) continue
    const h = stackHeight(f)
    f.object.position.set(bun.position.x, y + h * 0.5, bun.position.z)
    f.object.quaternion.copy(bun.object.quaternion)
    if (f.vel) f.vel.set(0, 0, 0)
    f.onFloor = false
    y += h
  }
}

export function addToBurger(bun, item) {
  if (!bun || !item || bun === item) return false
  if (bun.type !== 'bun') return false
  if (item.held || bun.held) return false
  if (item.inFood || item.kind === 'box' || item.kind === 'tool') return false
  if (!isStackable(item.type)) return false
  const stack = ensureStack(bun)
  if (bun.complete) return false
  if (item.type === 'bun' && item.stack && item.stack.length) {
    for (const f of item.stack) addToBurger(bun, f)
    return true
  }
  if (item.type === 'bun') return false
  if (stack.includes(item)) return false
  stack.push(item)
  item.inFood = true
  item.stackedOn = bun
  if (item.kind === 'rat' || item.type === 'rat') {
    item.dead = true
    item.defeated = true
  }
  bun.complete = item.type === 'topBun' || stack.some(f => f.type === 'topBun')
  layoutStack(bun)
  return true
}

export function plateBurger(plate, bun) {
  if (!plate || !bun) return false
  if (plate.type !== 'plate' || bun.type !== 'bun') return false
  if (plate.plated || !bun.complete) return false
  if (plate.held || bun.held) return false
  plate.plated = bun
  bun.onPlate = plate
  bun.inFood = true
  bun.stackedOn = plate
  for (const f of bun.stack || []) {
    f.inFood = true
    f.stackedOn = bun
  }
  return true
}

export function layoutPlate(plate) {
  const bun = plate.plated
  if (!bun) return
  bun.object.position.set(
    plate.position.x,
    plate.position.y + (plate.height || 0.08) * 0.5 + (bun.height || 0.12) * 0.5,
    plate.position.z,
  )
  bun.object.quaternion.copy(plate.object.quaternion)
  if (bun.vel) bun.vel.set(0, 0, 0)
  layoutStack(bun)
}

export function grabStackWith(item) {
  const plate = item.type === 'plate' ? item : item.onPlate
  const bun = plate ? plate.plated
    : (item.type === 'bun' ? item : item.stackedOn)
  const held = []
  if (plate) held.push(plate)
  if (bun && bun !== plate) held.push(bun)
  for (const f of bun?.stack || []) {
    if (!held.includes(f)) held.push(f)
  }
  if (!held.length) held.push(item)
  return held
}

export function tickStacks(items) {
  for (const plate of items) {
    if (plate.type === 'plate' && plate.plated) layoutPlate(plate)
  }
  for (const bun of items) {
    if (bun.type !== 'bun' || bun.onPlate) continue
    if (bun.stack && bun.stack.length) layoutStack(bun)
  }
}

export function tryLandStack(item, items) {
  if (!item || item.held || item.inFood) return false
  if (item.type === 'bun' && item.complete) {
    for (const plate of items) {
      if (plate.type !== 'plate' || plate.held || plate.plated) continue
      if (xzDist(item, plate) < 0.48 && Math.abs(item.position.y - plate.position.y) < 0.7) {
        return plateBurger(plate, item)
      }
    }
  }
  if (!isStackable(item.type)) return false
  for (const bun of items) {
    if (bun.type !== 'bun' || bun === item || bun.held || bun.complete) continue
    const reach = 0.42 + (bun.height || 0.1) * 0.3
    if (xzDist(item, bun) < reach && item.position.y >= bun.position.y - 0.15) {
      return addToBurger(bun, item)
    }
  }
  return false
}
