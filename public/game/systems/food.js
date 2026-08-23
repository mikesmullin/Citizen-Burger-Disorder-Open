// World food: gravity, floor registry (FloorTrigger.foodDropPosition),
// and cheese spawners. Rats read `foodOnFloor()`.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { tryLandStack, tickStacks, layoutStack, layoutPlate } from './stacking.js'
import { createImpactSfx } from './sfx.js'
import { createVisualInstancer } from '../common/instancePool.js'

// Friction per surface material. Kritz's original: Food mat = 0.5 (friction
// Combine=Maximum), Frictiony mat = 1.0. We split the world by material and
// let the item's own material combine with it (Maximum), so cast-iron grill
// and wooden board grip hard, stainless sink and glossy tile let things skid.
const SURFACE_FRICTION = {
  floor: 0.35,     // glossy museum tile
  counter: 0.55,   // laminate counter
  grill: 1.15,     // cast-iron cooktop — a patty parked here stays put
  board: 0.95,     // wooden cutting board
  sink: 0.18,      // stainless steel — a plate skids
  truck: 0.4,      // metal trailer bed
  surface: 0.4,    // generic raised surface
}
// Item's own material friction (organic food grips, porcelain skids).
const ITEM_FRICTION = {
  plate: 0.16,
  box: 0.4,
}
function itemFriction(item) {
  if (item.type === 'plate') return ITEM_FRICTION.plate
  if (item.type === 'box' || item.kind === 'box') return ITEM_FRICTION.box
  return 0.55   // organic food (Kritz Food mat ≈ 0.5)
}
// Combined = max of the two, Unity frictionCombine=Maximum.
function combinedFriction(item, mat) {
  return Math.max(SURFACE_FRICTION[mat] ?? SURFACE_FRICTION.surface, itemFriction(item))
}

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

// Cooked-stage albedo (lerped from the item's original color). Kritz's
// Food.cs defaulted every type to (0.2, 0, 0) — cheese went red, and a
// one-shot burn lerp of 0.82 toward (0.005, 0, 0) left items dark-red
// instead of charcoal. Per-type targets + a real black burn fix that.
export const COOK_RGB = {
  patty: { r: 0.28, g: 0.11, b: 0.045 },
  cheese: { r: 0.78, g: 0.42, b: 0.08 },
  tomato: { r: 0.52, g: 0.13, b: 0.05 },
  lettuce: { r: 0.36, g: 0.38, b: 0.11 },
  lettuceHead: { r: 0.36, g: 0.38, b: 0.11 },
  lettucePart: { r: 0.36, g: 0.38, b: 0.11 },
  bun: { r: 0.50, g: 0.28, b: 0.08 },
  topBun: { r: 0.50, g: 0.28, b: 0.08 },
  bacon: { r: 0.42, g: 0.16, b: 0.08 },
  rat: { r: 0.22, g: 0.08, b: 0.04 },
  default: { r: 0.32, g: 0.14, b: 0.05 },
}

export const BURN_RGB = { r: 0.04, g: 0.035, b: 0.03 }

// Raw item then its cook / dirty stages. Used by the food kiosk (and
// formerly by one-pedestal-per-stage hall layout).
export const COOK_FOLLOW = {
  'items/Plate': [
    { slug: 'items/PlateDirty', caption: 'Plate · dirty', state: 'dirty' },
  ],
  'items/Bacon': [
    { slug: 'items/BaconCooked', caption: 'Bacon · cooked', state: 'baconCooked' },
    { slug: 'items/BaconCooked2', caption: 'Bacon · cooked 2', state: 'baconCooked2' },
    { slug: 'items/BaconBurned', caption: 'Bacon · burned', state: 'burned' },
  ],
  'items/Patty': [
    { slug: 'items/PattyCooked', caption: 'Patty · cooked', state: 'cooked' },
    { slug: 'items/PattyBurned', caption: 'Patty · burned', state: 'burned' },
  ],
  'items/Cheese': [
    { slug: 'items/CheeseCooked', caption: 'Cheese · cooked', state: 'cooked' },
    { slug: 'items/CheeseBurned', caption: 'Cheese · burned', state: 'burned' },
  ],
  'items/Tomato': [
    { slug: 'items/TomatoCooked', caption: 'Tomato · cooked', state: 'cooked' },
    { slug: 'items/TomatoBurned', caption: 'Tomato · burned', state: 'burned' },
  ],
  'items/Lettuce': [
    { slug: 'items/LettuceCooked', caption: 'Lettuce · cooked', state: 'cooked' },
    { slug: 'items/LettuceBurned', caption: 'Lettuce · burned', state: 'burned' },
  ],
  'items/LettuceHead': [
    { slug: 'items/LettuceHeadCooked', caption: 'Lettuce Head · cooked', state: 'cooked' },
    { slug: 'items/LettuceHeadBurned', caption: 'Lettuce Head · burned', state: 'burned' },
  ],
  'items/BunTop': [
    { slug: 'items/BunTopCooked', caption: 'Bun Top · cooked', state: 'cooked' },
    { slug: 'items/BunTopBurned', caption: 'Bun Top · burned', state: 'burned' },
  ],
  'items/BunBottom': [
    { slug: 'items/BunBottomCooked', caption: 'Bun Bottom · cooked', state: 'cooked' },
    { slug: 'items/BunBottomBurned', caption: 'Bun Bottom · burned', state: 'burned' },
  ],
}

export function applyCookState(root, item) {
  const type = inferFoodType(item.variantOf || item.slug)
  const rgb = COOK_RGB[type] || COOK_RGB.default
  if (item.cookState === 'dirty') {
    applyCookLook(root, { mapUrl: './assets/textures/PlateDirty.png' })
    return
  }
  if (item.cookState === 'baconCooked') {
    applyCookLook(root, { cooked: 1, cookedRGB: rgb, mapUrl: './assets/textures/BaconCooked.png' })
    return
  }
  if (item.cookState === 'baconCooked2') {
    applyCookLook(root, { cooked: 1, cookedRGB: rgb, mapUrl: './assets/textures/BaconCooked2.png' })
    return
  }
  if (item.cookState === 'cooked') {
    applyCookLook(root, { cooked: 1, overcooked: 0, cookedRGB: rgb })
    return
  }
  if (item.cookState === 'burned') {
    const mapUrl = (item.variantOf || item.slug) === 'items/Bacon'
      || item.slug === 'items/BaconBurned'
      ? './assets/textures/BaconCooked.png'
      : null
    applyCookLook(root, { cooked: 1, overcooked: 1, cookedRGB: rgb, mapUrl })
  }
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
  const burn = new THREE.Color(BURN_RGB.r, BURN_RGB.g, BURN_RGB.b)
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
      o.material.color.lerp(burn, Math.min(1, overcooked))
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
    : (item.dirty ? './assets/textures/PlateDirty.png' : null)
  const root = item.object
  const variant = mapUrl || ''
  if (root && item.watchVisual && item.instVariant !== variant) {
    applyCookLook(root, {
      cooked: Math.min(1, item.cooked),
      overcooked: Math.min(1, item.overcooked),
      cookedRGB: rgb,
      mapUrl,
    })
    item.instVariant = variant
    item.watchVisual(item)
    return
  }
  if (root && root.userData && root.userData.instSlots) {
    const tgt = new THREE.Color(rgb.r, rgb.g, rgb.b)
    const burn = new THREE.Color(BURN_RGB.r, BURN_RGB.g, BURN_RGB.b)
    const c = (item.cookOrig || new THREE.Color(1, 1, 1)).clone()
    if (item.cooked > 0) c.lerp(tgt, Math.min(1, item.cooked))
    if (item.overcooked > 0) c.lerp(burn, Math.min(1, item.overcooked))
    const slots = root.userData.instSlots
    for (const s of slots.slots) s.pool.setColor(s.i, c)
    return
  }
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

export function createFoodWorld({ scene, player, instancer: given } = {}) {
  const items = []
  const spawners = []
  const SPAWN_EVERY = 5 * 60
  const sfx = createImpactSfx({ scene, player })
  const instancer = given || createVisualInstancer({ scene, max: 96, prefix: 'Pick' })

  function captureOrig(item) {
    if (!item || !item.object || item.cookOrig) return
    item.object.traverse(o => {
      if (item.cookOrig || !o.isMesh || !o.material || o.userData.trigger) return
      item.cookOrig = o.material.color.clone()
    })
    if (!item.cookOrig) item.cookOrig = new THREE.Color(1, 1, 1)
  }

  function watch(item) {
    if (!item || !item.object) return item
    captureOrig(item)
    item.watchVisual = watch
    instancer.attach(item.object, { food: item }, item.instVariant || '')
    return item
  }

  function forget(item) {
    if (!item) return
    if (item.object) instancer.detach(item.object)
    const i = items.indexOf(item)
    if (i >= 0) items.splice(i, 1)
    if (item.fromSpawner && item.fromSpawner.item === item) item.fromSpawner.item = null
  }

  function spawn({ proto, type, slug, x, z, y = null, onFloor = false, fromSpawner = null, maxSize, instanced = true }) {
    const object = proto.clone(true)
    const { height, size } = layoutFood(object, { maxSize, sit: true, type, slug })
    object.position.x = x
    object.position.z = z
    const gy = player.groundY ? player.groundY(x, z) : 0
    object.position.y = y != null && !onFloor ? y : gy + height * 0.5
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
      restingOn: null,   // surface mat the item is parked on (set on land)
    }
    object.userData.food = item
    object.traverse(o => { o.userData.food = item })
    items.push(item)
    if (fromSpawner) fromSpawner.item = item
    if (instanced) watch(item)
    return item
  }

  function destroy(item) {
    if (!item) return
    forget(item)
    if (item.object && item.object.parent) item.object.parent.remove(item.object)
    scene.remove(item.object)
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
      const half = item.height * 0.5
      const px = item.object.position.x
      const py = item.object.position.y
      const pz = item.object.position.z
      const prevFeet = py - half

      item.vel.y -= 9.81 * dt
      const nx = px + item.vel.x * dt
      const ny = py + item.vel.y * dt
      const nz = pz + item.vel.z * dt

      // Highest surface directly under the item whose top is at or below its
      // feet — the thing it would land on. Not a height band: a falling item
      // finds the cooktop / counter / trailer bed it is dropping onto, while an
      // item sitting on the open floor is not mistaken for a nearby counter.
      const surf = player.surfaceAt
        ? player.surfaceAt(nx, nz, prevFeet, item.restingOn)
        : { y: player.groundY ? player.groundY(nx, nz) : 0, mat: 'floor', plat: null }

      if (item.vel.y <= 0 && ny - half <= surf.y + 0.02) {
        // Land: snap the feet to the top of the surface and kill the fall.
        const impact = -item.vel.y
        item.object.position.x = nx
        item.object.position.z = nz
        item.object.position.y = surf.y + half
        const rest = surf.mat === 'floor' ? 0.12 : 0.07
        item.vel.y = impact > 0.5 ? impact * rest : 0
        if (impact > 0.5) sfx.impact(item, impact, time)
        const wasAir = !item.onFloor
        item.onFloor = true
        item.restingOn = surf.plat
        item.restingY = surf.y
        item.restingMat = surf.mat
        // Only the museum floor counts as "the floor" for rats. Food on a
        // counter, grill, or trailer bed is resting, not dropped.
        if (surf.y <= 0.08) item.foodBeenOnFloor = true
        if (wasAir && item.dropped) landed.push(item)
        if (wasAir && item.dropped) tryLandStack(item, items)
      } else {
        // Airborne: free projectile (no drag — it should fly).
        item.object.position.x = nx
        item.object.position.z = nz
        item.object.position.y = ny
        item.onFloor = false
        item.restingOn = null
        item.restingY = 0
        // Keep a falling item out of the kitchen / truck walls, but only when
        // it is heading for the open floor — over a cooktop or counter let it
        // drop straight on.
        if (surf.plat === null && ny - half < 1.3) {
          const hit = player.resolveXZ(nx, nz, item.radius, null)
          item.object.position.x = hit.x
          item.object.position.z = hit.z
        }
      }

      // Resting: stay on the surface it landed on.
      if (item.onFloor) {
        const p = item.restingOn
        if (p) {
          // Confined to the surface footprint — a patty parked on the grill
          // cannot slide off the edge and clip through the wall behind it, and
          // cargo stays on the trailer bed instead of being shoved out.
          item.object.position.x = Math.max(p.minx, Math.min(p.maxx, item.object.position.x))
          item.object.position.z = Math.max(p.minz, Math.min(p.maxz, item.object.position.z))
          item.object.position.y = item.restingY + half
        } else {
          const hit = player.resolveXZ(item.object.position.x, item.object.position.z, item.radius, null)
          item.object.position.x = hit.x
          item.object.position.z = hit.z
          item.object.position.y = item.restingY + half
        }
        // Per-frame friction, combined per surface material. Cast iron and
        // wood grip hard; stainless and glossy tile let a plate skid.
        const fr = combinedFriction(item, item.restingMat || 'floor')
        const damp = Math.max(0, 1 - fr * 9 * dt)
        item.vel.x *= damp
        item.vel.z *= damp
        if (item.vel.lengthSq() < 0.02) item.vel.set(0, 0, 0)
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
    instancer.syncAll()
  }

  return {
    items, spawners, spawn, destroy, forget, watch, addSpawner, foodOnFloor, update,
    instancer, SPAWN_EVERY,
  }
}
