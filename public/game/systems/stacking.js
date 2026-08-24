// BurgerStacking.cs + Plate.cs. Bottom bun collects food; top bun closes
// the stack. A closed burger that lands on an empty plate parents to it.
//
// Dirty dishes: original has no PlateStacking.cs — plates were independent
// rigidbodies, so a SphereCast hit the top of a physics pile (a pop) and
// Sink.cs washed each collider in the water. We glue empty plates into a
// LIFO pile so you can carry it; grab the top to pop, grab the root to
// carry the pile; drop a pile in the basin to clean + unstack.

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
  if (plate.stackedOn || (plate.stack && plate.stack.length)) return false
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

// —— Dirty / empty dish LIFO (BurgerStacking shape, plates only) ——

export function dishRoot(item) {
  let p = item
  while (p && p.stackedOn && p.stackedOn.type === 'plate') p = p.stackedOn
  return p && p.type === 'plate' ? p : null
}

function dishStep(plate) {
  return Math.max(0.026, (plate.height || 0.08) * 0.36)
}

export function ensureDishStack(plate) {
  if (!plate.stack) plate.stack = []
  return plate.stack
}

export function layoutDishStack(root) {
  if (!root || root.type !== 'plate' || !root.stack || !root.stack.length) return
  let y = root.position.y
  for (const p of root.stack) {
    if (!p || !p.object) continue
    y += dishStep(p)
    p.object.position.set(root.position.x, y, root.position.z)
    p.object.quaternion.copy(root.object.quaternion)
    if (p.vel) p.vel.set(0, 0, 0)
    p.onFloor = false
  }
}

export function detachFromDish(item) {
  if (!item || item.type !== 'plate') return
  const parent = item.stackedOn && item.stackedOn.type === 'plate' ? item.stackedOn : null
  if (parent && parent.stack) {
    parent.stack = parent.stack.filter(p => p !== item)
  }
  item.stackedOn = null
  if (!item.plated) item.inFood = false
}

export function isStackedDish(item) {
  return !!(item && item.type === 'plate' && item.stackedOn && item.stackedOn.type === 'plate')
}

// Lift `item` and everything above it off the parent pile (LIFO pop / split).
export function popDish(item) {
  if (!item || item.type !== 'plate') return item
  const root = item.stackedOn && item.stackedOn.type === 'plate' ? item.stackedOn : null
  if (!root || !root.stack) return item
  const idx = root.stack.indexOf(item)
  if (idx < 0) {
    detachFromDish(item)
    return item
  }
  const taken = root.stack.splice(idx)
  item.stackedOn = null
  item.inFood = false
  const above = taken.slice(1)
  item.stack = above
  for (const p of above) {
    p.stackedOn = item
    p.inFood = true
  }
  return item
}

// Explode a pile into free plates. Root stays first in the returned list.
export function unstackDish(root) {
  if (!root || root.type !== 'plate') return root ? [root] : []
  const members = (root.stack || []).slice()
  root.stack = []
  for (const p of members) {
    p.stackedOn = null
    p.inFood = !!p.plated
    if (p.stack) p.stack = []
  }
  return [root, ...members]
}

export function addToDishStack(base, item) {
  if (!base || !item || base === item) return false
  if (base.type !== 'plate' || item.type !== 'plate') return false
  if (base.plated || item.plated) return false
  const root = dishRoot(base) || base
  if (root === item || dishRoot(item) === root) return false
  if (root.plated) return false
  detachFromDish(item)
  const stack = ensureDishStack(root)
  stack.push(item)
  item.inFood = true
  item.stackedOn = root
  if (item.stack && item.stack.length) {
    const nested = item.stack.slice()
    item.stack = []
    for (const p of nested) {
      if (!p || p === root || stack.includes(p)) continue
      stack.push(p)
      p.inFood = true
      p.stackedOn = root
    }
  }
  layoutDishStack(root)
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
  const held = []
  const add = x => { if (x && !held.includes(x)) held.push(x) }
  if (isStackedDish(item)) {
    popDish(item)
    add(item)
    for (const p of item.stack || []) add(p)
    return held.length ? held : [item]
  }
  const plate = item.type === 'plate'
    ? dishRoot(item)
    : (item.onPlate ? dishRoot(item.onPlate) : null)
  if (plate) {
    add(plate)
    for (const p of plate.stack || []) add(p)
    add(plate.plated)
    for (const f of plate.plated?.stack || []) add(f)
    for (const p of plate.stack || []) {
      add(p.plated)
      for (const f of p.plated?.stack || []) add(f)
    }
    return held.length ? held : [item]
  }
  const bun = item.type === 'bun' ? item
    : (item.stackedOn && item.stackedOn.type === 'bun' ? item.stackedOn : item.stackedOn)
  if (bun && bun !== item) add(bun)
  else add(item)
  for (const f of bun?.stack || []) add(f)
  if (!held.length) held.push(item)
  return held
}

export function tickStacks(items) {
  for (const plate of items) {
    if (plate.type !== 'plate') continue
    if (plate.plated) layoutPlate(plate)
    if (plate.stack && plate.stack.length && !plate.stackedOn) layoutDishStack(plate)
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
      if (plate.stackedOn || (plate.stack && plate.stack.length)) continue
      if (xzDist(item, plate) < 0.48 && Math.abs(item.position.y - plate.position.y) < 0.7) {
        return plateBurger(plate, item)
      }
    }
  }
  if (item.type === 'plate' && !item.plated) {
    if (item.restingMat === 'sink') return false
    for (const other of items) {
      if (other.type !== 'plate' || other === item || other.held || other.plated || other.inFood) continue
      if (other.restingMat === 'sink') continue
      if (xzDist(item, other) < 0.42 && item.position.y >= other.position.y - 0.12) {
        return addToDishStack(other, item)
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
