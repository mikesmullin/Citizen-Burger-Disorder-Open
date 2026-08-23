// World food: gravity, floor registry (FloorTrigger.foodDropPosition),
// and cheese spawners. Rats read `foodOnFloor()`.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { tryLandStack, tickStacks, layoutStack, layoutPlate } from './stacking.js'

export function inferFoodType(slug = '', label = '') {
  const s = (slug + ' ' + label).toLowerCase()
  if (s.includes('cheese')) return 'cheese'
  if (s.includes('patty')) return 'patty'
  if (s.includes('bacon')) return 'bacon'
  if (s.includes('tomato')) return 'tomato'
  if (s.includes('lettucehead') || s.includes('lettuce-head') || s.includes('lettuce_head')) return 'lettuceHead'
  if (s.includes('lettucepart') || s.includes('lettuce-part') || s.includes('lettuce_part')) return 'lettucePart'
  if (s.includes('lettuce')) return 'lettuce'
  if (s.includes('bun-top') || s.includes('bun_top') || s.includes('topbun') || s.includes('buntop')) return 'topBun'
  if (s.includes('bun')) return 'bun'
  if (s.includes('rat')) return 'rat'
  return 'other'
}

export function isTool(type) {
  return type === 'knife' || type === 'spatula' || type === 'fireExtinguisher'
}

export function isFood(type) {
  return type && type !== 'other' && type !== 'plate' && type !== 'tip' && type !== 'box'
    && type !== 'fire' && type !== 'numberStand' && !isTool(type)
}

// Pedestal copies you can grab. Plate / tip / box are items, not edible food.
export function inferPickup(slug = '', label = '') {
  const s = (slug + ' ' + label).toLowerCase()
  if (s.includes('fireextinguisher') || s.includes('extinguisher')) return 'fireExtinguisher'
  if (s.includes('spatula')) return 'spatula'
  if (s.includes('knife')) return 'knife'
  if (/\bfire\b/.test(s) || s.endsWith('/fire') || s === 'fire') return 'fire'
  const food = inferFoodType(slug, label)
  if (food !== 'other') return food
  if (s.includes('plate')) return 'plate'
  if (s.includes('tip')) return 'tip'
  if (s.includes('numberstand') || s.includes('number-stand') || s.includes('number stand')) {
    return 'numberStand'
  }
  if (s.includes('boxopen')) return null
  if (s.includes('box')) return 'box'
  return null
}

export function ratWillSteal(type) {
  return type === 'cheese' || type === 'patty' || type === 'bacon' || type === 'tomato'
    || type === 'tip'
}

// Longest-edge in meters — same numbers as the museum pedestals (scale-gun pass).
export const FOOD_SIZE_BY_SLUG = {
  'items/Patty': 0.371,
  'items/Cheese': 0.326,
  'items/Lettuce': 0.446,
  'items/LettuceHead': 0.417,
  'items/Bacon': 0.449,
  'items/Tomato': 0.324,
  'items/BunTop': 0.369,
  'items/BunBottom': 0.369,
  'items/Box': 0.856,
  'items/Plate': 0.714,
  'items/PlateDirty': 0.714,
  'items/Tip': 0.511,
  'items/NumberStand': 1.011,
  'items/Knife': 0.888,
  'items/Spatula': 1.021,
  'items/FireExtinguisher': 0.771,
  'items/Fire': 0.828,
  'items/LettucePart': 0.32,
}

export const FOOD_SIZE = {
  patty: FOOD_SIZE_BY_SLUG['items/Patty'],
  cheese: FOOD_SIZE_BY_SLUG['items/Cheese'],
  lettuce: FOOD_SIZE_BY_SLUG['items/Lettuce'],
  bacon: FOOD_SIZE_BY_SLUG['items/Bacon'],
  tomato: FOOD_SIZE_BY_SLUG['items/Tomato'],
  topBun: FOOD_SIZE_BY_SLUG['items/BunTop'],
  bun: FOOD_SIZE_BY_SLUG['items/BunBottom'],
  box: FOOD_SIZE_BY_SLUG['items/Box'],
  plate: FOOD_SIZE_BY_SLUG['items/Plate'],
  tip: FOOD_SIZE_BY_SLUG['items/Tip'],
  lettuceHead: FOOD_SIZE_BY_SLUG['items/LettuceHead'],
  lettucePart: FOOD_SIZE_BY_SLUG['items/LettucePart'],
  knife: FOOD_SIZE_BY_SLUG['items/Knife'],
  spatula: FOOD_SIZE_BY_SLUG['items/Spatula'],
  fireExtinguisher: FOOD_SIZE_BY_SLUG['items/FireExtinguisher'],
  fire: FOOD_SIZE_BY_SLUG['items/Fire'],
}

export function foodLongest(type, slug) {
  if (slug && FOOD_SIZE_BY_SLUG[slug] != null) return FOOD_SIZE_BY_SLUG[slug]
  return FOOD_SIZE[type]
}

// Food.cs: Color.Lerp(original, (cookedRed, cookedGreen, cookedBlue), cooked)
// then toward (0.005, 0, 0) as overcooked. Bacon uses TextureBlend cooked PNGs.
export const COOK_RGB = {
  default: { r: 0.2, g: 0, b: 0 },
  bun: { r: 0.5, g: 0.3, b: 0 },
  topBun: { r: 0.5, g: 0.3, b: 0 },
}

const _cookMaps = {}
function cookMap(url) {
  if (_cookMaps[url]) return _cookMaps[url]
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = true
  t.anisotropy = 4
  _cookMaps[url] = t
  return t
}

export function applyCookLook(root, {
  cooked = 0,
  overcooked = 0,
  cookedRGB = COOK_RGB.default,
  mapUrl = null,
} = {}) {
  const map = mapUrl ? cookMap(mapUrl) : null
  const tgt = new THREE.Color(cookedRGB.r, cookedRGB.g, cookedRGB.b)
  const burn = new THREE.Color(0.005, 0, 0)
  root.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.trigger) return
    if (!o.userData.cookOrig) {
      o.material = o.material.clone()
      o.userData.cookOrig = o.material.color.clone()
    }
    if (map) {
      o.material.map = map
      o.material.color.setRGB(1, 1, 1)
    } else {
      o.material.color.copy(o.userData.cookOrig)
      if (cooked > 0) o.material.color.lerp(tgt, cooked)
    }
    if (overcooked > 0) {
      o.material.color.lerp(burn, Math.min(1, overcooked * 0.82))
    }
    o.material.needsUpdate = true
  })
}

// Food.cs cook(): 10s to cooked, 10s hold, 10s to burned.
export function cookTick(item, dt) {
  if (!item) return
  item.cooked = item.cooked || 0
  item.cookedDelay = item.cookedDelay || 0
  item.overcooked = item.overcooked || 0
  if (item.cooked < 1) item.cooked = Math.min(1, item.cooked + dt / 10)
  else if (item.cookedDelay < 1) item.cookedDelay = Math.min(1, item.cookedDelay + dt / 10)
  else item.overcooked = Math.min(1, item.overcooked + dt / 10)
  // ~1.5 s on the grill (cookTimeIdeal 10 → cooked 0.15) before a rat dies.
  if (item.type === 'rat' && item.cooked >= 0.15) {
    item.dead = true
    item.defeated = true
  }
  const rgb = COOK_RGB[item.type] || COOK_RGB.default
  const mapUrl = item.type === 'bacon'
    ? (item.overcooked > 0.4
      ? './assets/textures/BaconCooked.png'
      : './assets/textures/BaconCooked2.png')
    : null
  const root = item.object
  if (root) applyCookLook(root, {
    cooked: Math.min(1, item.cooked),
    overcooked: Math.min(1, item.overcooked),
    cookedRGB: rgb,
    mapUrl,
  })
}

export function layoutFood(root, { maxSize, sit = false, type, slug } = {}) {
  hideTriggers(root)
  if (type === 'patty') {
    root.traverse(o => {
      if (o.isMesh && Math.abs(o.scale.z) < Math.abs(o.scale.x) * 0.4) o.scale.z = o.scale.x
    })
  }
  root.updateMatrixWorld(true)
  const box = boundsOf(root)
  if (box.isEmpty()) return { height: 0.1 }
  const size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z, 1e-4)
  const cap = maxSize ?? foodLongest(type, slug) ?? 0.16
  const s = longest > cap ? cap / longest : (longest < cap * 0.4 ? cap / longest : 1)
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true)
  const fitted = boundsOf(root)
  const mid = fitted.getCenter(new THREE.Vector3())
  const sz = fitted.getSize(new THREE.Vector3())
  root.position.x -= mid.x
  root.position.z -= mid.z
  if (sit) root.position.y -= fitted.min.y
  else root.position.y -= mid.y
  return { height: sz.y, size: sz }
}

export function createFoodWorld({ scene, player }) {
  const items = []
  const spawners = []
  const SPAWN_EVERY = 5 * 60

  function spawn({ proto, type, slug, x, z, y = null, onFloor = false, fromSpawner = null, maxSize }) {
    const object = proto.clone(true)
    const { height, size } = layoutFood(object, { maxSize, sit: true, type, slug })
    object.position.x = x
    object.position.z = z
    object.position.y = y != null && !onFloor ? y : height * 0.5
    scene.add(object)
    const item = {
      object, type, slug: slug || null,
      kind: isTool(type) ? 'tool' : (type === 'plate' ? 'plate' : (type === 'fire' ? 'fire' : (type === 'box' ? 'box' : 'food'))),
      position: object.position,
      radius: Math.max(0.22, (size?.x || height) * 0.45),
      height,
      foodBeenOnFloor: !!onFloor,
      held: false,
      stolen: null,
      vel: new THREE.Vector3(),
      onFloor: !!onFloor,
      fromSpawner,
      cooked: 0,
      cookedDelay: 0,
      overcooked: 0,
      inFood: false,
      soakTime: 0,
    }
    object.userData.food = item
    object.traverse(o => { o.userData.food = item })
    items.push(item)
    if (fromSpawner) fromSpawner.item = item
    return item
  }

  function destroy(item) {
    if (!item) return
    scene.remove(item.object)
    const i = items.indexOf(item)
    if (i >= 0) items.splice(i, 1)
    if (item.fromSpawner && item.fromSpawner.item === item) item.fromSpawner.item = null
  }

  function addSpawner(x, z, proto) {
    const sp = { x, z, proto, item: null, next: 0, mesh: null }
    spawners.push(sp)
    return sp
  }

  function foodOnFloor() {
    return items.filter(i => i.foodBeenOnFloor && !i.held && !i.stolen && ratWillSteal(i.type))
  }

  function update(dt, time) {
    dt = Math.min(dt, 0.1)
    for (const sp of spawners) {
      if (sp.item && items.includes(sp.item)) continue
      sp.item = null
      if (time >= sp.next) {
        spawn({ proto: sp.proto, type: 'cheese', x: sp.x, z: sp.z, onFloor: true, fromSpawner: sp })
        sp.next = time + SPAWN_EVERY
      }
    }

    const landed = []
    for (const item of items) {
      if (item.held || item.stolen || item.inFood || item.planted) continue
      item.vel.y -= 9.81 * dt
      item.object.position.addScaledVector(item.vel, dt)
      const half = item.height * 0.5
      const gy = player.groundY ? player.groundY(item.object.position.x, item.object.position.z) : 0
      if (item.object.position.y - half <= gy) {
        item.object.position.y = gy + half
        if (item.vel.y < 0) item.vel.y *= -0.15
        if (Math.abs(item.vel.y) < 0.4) item.vel.y = 0
        item.vel.x *= Math.max(0, 1 - 6 * dt)
        item.vel.z *= Math.max(0, 1 - 6 * dt)
        if (item.vel.lengthSq() < 0.04) item.vel.set(0, 0, 0)
        const wasAir = !item.onFloor
        item.onFloor = true
        // Only the museum floor counts as "the floor" for rats. Food on a
        // counter, grill, or trailer bed is resting, not dropped.
        if (gy <= 0.08) item.foodBeenOnFloor = true
        if (wasAir && item.dropped) landed.push(item)
        // Only player-dropped items assemble burgers on landing. Box-spilled
        // food (no `dropped` flag) just rests on the floor.
        if (wasAir && item.dropped) tryLandStack(item, items)
      } else {
        item.onFloor = false
      }
      // Parked cargo on the trailer bed must not get shoved out by wall AABBs
      // (that dropped a box under the chassis). Same for food sitting on a
      // raised kitchen surface — the station collider would shove it off.
      const onRaised = gy > 0.12
      if (!(item.kind === 'box' && item.onFloor && !item.dropped) && !onRaised) {
        const hit = player.resolveXZ(item.object.position.x, item.object.position.z, item.radius, null)
        item.object.position.x = hit.x
        item.object.position.z = hit.z
      }
    }
    for (const item of landed) {
      tryLandStack(item, items)
      if (item.onLand) item.onLand(item)
    }
    for (const item of items) {
      if (item.held && item.type === 'bun') layoutStack(item)
      if (item.held && item.type === 'plate' && item.plated) layoutPlate(item)
    }
    tickStacks(items)
  }

  return { items, spawners, spawn, destroy, addSpawner, foodOnFloor, update, SPAWN_EVERY }
}
