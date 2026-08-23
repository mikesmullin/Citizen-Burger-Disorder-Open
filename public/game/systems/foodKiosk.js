// Compound food pedestal: one stand cycles every ingredient and its cook
// stages (LMB next / RMB prev). Grab still clones the current item.

import * as THREE from 'three'
import { hideTriggers, fitLongest, fitLongestNative, restorePattyDisc } from '../common/unityScene.js'
import {
  COOK_FOLLOW, applyCookState, inferFoodType, inferPickup, isFood,
  FOOD_SIZE, FOOD_SIZE_BY_SLUG,
} from './food.js'
import { PEDESTAL_W, PEDESTAL_H, makePedestalHit } from './pedestals.js'

const PRESS_RANGE = 6.5
const TAG_GEO = new THREE.PlaneGeometry(0.92, 0.22)

// Kitchen-assembly order: bread, protein, cheese, veg, bacon, plate.
const FOOD_BASES = [
  { slug: 'items/BunBottom', caption: 'Bun Bottom' },
  { slug: 'items/BunTop', caption: 'Bun Top' },
  { slug: 'items/Patty', caption: 'Patty' },
  { slug: 'items/Cheese', caption: 'Cheese' },
  { slug: 'items/Lettuce', caption: 'Lettuce' },
  { slug: 'items/LettuceHead', caption: 'Lettuce Head' },
  { slug: 'items/Tomato', caption: 'Tomato' },
  { slug: 'items/Bacon', caption: 'Bacon' },
  { slug: 'items/Plate', caption: 'Plate' },
]

export const FOOD_HALL_SKIP = new Set(FOOD_BASES.map(b => b.slug))

export function foodCatalog() {
  const out = []
  for (const base of FOOD_BASES) {
    out.push({
      slug: base.slug,
      caption: base.caption,
      variantOf: base.slug,
      cookState: null,
    })
    const extra = COOK_FOLLOW[base.slug] || []
    for (const v of extra) {
      out.push({
        slug: v.slug,
        caption: v.caption,
        variantOf: base.slug,
        cookState: v.state,
      })
    }
  }
  return out
}

function longestFor(entry) {
  const slug = entry.variantOf || entry.slug
  if (FOOD_SIZE_BY_SLUG[slug] != null) return FOOD_SIZE_BY_SLUG[slug]
  const type = inferFoodType(slug)
  if (FOOD_SIZE[type] != null) return FOOD_SIZE[type]
  return 0.4
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function labelTex(text) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#6b5a45'
    g.lineWidth = 6
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f0e6d4'
    g.font = '600 32px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const t = text.length > 22 ? text.slice(0, 20) + '…' : text
    g.fillText(t, w / 2, h / 2 + 2)
  })
}

export async function createFoodKiosk({
  scene, player, foodProtos, pedestals, loader, nestLettuceHead,
  x = 0, z = 0, yaw = 0,
} = {}) {
  const catalog = foodCatalog()
  const n = catalog.length
  const bases = new Map()

  for (const entry of catalog) {
    const base = entry.variantOf
    if (bases.has(base)) continue
    const loaded = await loader.load(base)
    hideTriggers(loaded.root)
    if (base === 'items/LettuceHead' && nestLettuceHead) {
      try { await nestLettuceHead(loaded.root) }
      catch (err) { console.warn('[foodKiosk] LettucePart nest skipped', err) }
    }
    if (base === 'items/Patty') restorePattyDisc(loaded.root)
    bases.set(base, loaded)
    if (foodProtos && !foodProtos[base]) foodProtos[base] = loaded.root.clone(true)
  }

  const object = new THREE.Group()
  object.name = 'FoodKiosk'
  object.position.set(x, 0, z)
  object.rotation.y = yaw
  scene.add(object)
  object.updateMatrixWorld(true)

  if (pedestals) pedestals.place(x, z, yaw)
  makePedestalHit(object)
  const half = PEDESTAL_W / 2 + 0.08
  player.addCollider(
    { x: x - half, z: z - half },
    { x: x + half, z: z + half },
  )

  const holder = new THREE.Group()
  holder.name = 'FoodKioskItem'
  object.add(holder)

  const tagMat = new THREE.MeshBasicMaterial({ map: labelTex(catalog[0].caption), side: THREE.FrontSide })
  const tag = new THREE.Mesh(TAG_GEO, tagMat)
  tag.position.set(0, 0.55, PEDESTAL_W * 0.52 + 0.02)
  object.add(tag)

  let index = 0
  let shown = null
  const shownCache = new Map()

  const rec = {
    slug: catalog[0].slug,
    caption: catalog[0].caption,
    label: catalog[0].caption,
    group: 'items',
    variantOf: catalog[0].variantOf,
    cookState: catalog[0].cookState,
    x, z, yaw,
    size: { x: PEDESTAL_W, y: PEDESTAL_H + 0.4, z: PEDESTAL_W },
    display: null,
    pickup: inferPickup(catalog[0].slug, catalog[0].caption),
    foodType: null,
    object,
  }
  rec.foodType = isFood(rec.pickup) ? rec.pickup : rec.pickup

  function stamp() {
    object.userData.exhibit = rec
    object.traverse(o => { o.userData.exhibit = rec })
  }

  function bind() {
    const entry = catalog[index]
    if (shown && shown.parent) shown.parent.remove(shown)
    let root = shownCache.get(entry.slug)
    if (!root) {
      const src = bases.get(entry.variantOf)
      root = src.root.clone(true)
      hideTriggers(root)
      if (entry.variantOf === 'items/Patty') restorePattyDisc(root)
      if (entry.cookState) applyCookState(root, entry)
      const target = longestFor(entry)
      if (src.data && src.data.nativeBounds) fitLongestNative(root, src.data, target)
      else fitLongest(root, target)
      root.position.y += PEDESTAL_H + 0.06
      shownCache.set(entry.slug, root)
    }
    holder.add(root)
    shown = root

    rec.slug = entry.slug
    rec.caption = entry.caption
    rec.label = entry.caption
    rec.variantOf = entry.variantOf
    rec.cookState = entry.cookState
    rec.display = root
    rec.pickup = inferPickup(entry.variantOf, entry.caption)
    rec.foodType = isFood(rec.pickup) ? rec.pickup : rec.pickup
    const prevMap = tagMat.map
    tagMat.map = labelTex(entry.caption)
    tagMat.needsUpdate = true
    if (prevMap && prevMap !== tagMat.map) prevMap.dispose()
    stamp()
  }

  bind()

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  function tryTurn(dir = 1) {
    if (!player.locked) return false
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return false
    index = (index + (dir < 0 ? -1 : 1) + n) % n
    bind()
    return true
  }

  function select(q) {
    if (q == null || q === '') return false
    const s = String(q)
    const i = catalog.findIndex(e =>
      e.slug === s || e.caption === s
      || e.slug === 'items/' + s || e.caption.toLowerCase() === s.toLowerCase()
      || (e.variantOf === 'items/' + s && !e.cookState)
    )
    if (i < 0) return false
    if (i !== index) {
      index = i
      bind()
    }
    return true
  }

  function current() {
    return catalog[index]
  }

  function lookLabel() {
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return ''
    return current().caption + '  ·  LMB / wheel↓ next  ·  RMB / wheel↑ prev  ·  grab a copy'
  }

  function viewSpot() {
    const back = 2.2
    return {
      stand: {
        x: x + Math.sin(yaw) * back,
        z: z + Math.cos(yaw) * back,
      },
      look: { x, y: PEDESTAL_H + 0.25, z },
    }
  }

  return {
    object, rec, catalog, tryTurn, select, current, lookLabel, viewSpot,
    width: PEDESTAL_W + 0.4,
    depth: PEDESTAL_W + 0.4,
    height: PEDESTAL_H + 0.5,
  }
}
