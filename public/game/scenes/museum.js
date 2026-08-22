// Scene 01 — first-person walk through a museum of converted prefabs.
// Demonstrates: player controller (move / look / run / walk) + NPC assets
// standing in the space. Grab, cooking, and netcode come in later scenes.

import * as THREE from 'three'
import { createUnityLoader, fitOnFloor, fitLongest, restorePattyDisc, hideTriggers, boundsOf } from '../common/unityScene.js'
import { createFirstPersonPlayer } from '../systems/player.js'
import { createCrowd } from '../systems/npc.js'
import { createFoodWorld, inferFoodType, FOOD_SIZE, FOOD_SIZE_BY_SLUG, applyCookLook, COOK_RGB } from '../systems/food.js'
import { createHands } from '../systems/hands.js'
import { createRatDen } from '../systems/rats.js'
import { createDemoPlayers } from '../entities/demoPlayers.js'
import { createSoundboard } from '../systems/soundboard.js'
import { createDelivery, makeOpenNet, BOX_SIZE } from '../systems/delivery.js'
import { createScaler } from '../systems/scaler.js'
import { createSwatches } from '../systems/swatches.js'
import { createPosters } from '../systems/posters.js'
import { createPosKiosk } from '../systems/posKiosk.js'
import { installHarness } from '../common/harness.js'

const FEATURED = [
  { slug: 'heroes/Player', caption: 'Player' },
  { slug: 'mobs/Rat',      caption: 'Rat' },
]

// Pedestals we skip: live in the hall already (Arm, NPC), unused Kritz
// leftovers, or a light we will add natively later.
const SKIP_EXHIBITS = new Set([
  'mobs/Npc',
  'items/Notepad',
  'items/Paper',
  'items/PointLight',
  'items/LettucePart',   // nested inside LettuceHead
  'items/MonitorPickup', // same slab as Monitor, pickup-sized
  'ui/BunBottom',
  'ui/BunTop',
  'ui/Cheese',
  'ui/Lettuce',
  'ui/Patty',
  'ui/CustomerMenu',
])

// Player-facing plaque names when the Unity slug is a misnomer.
const EXHIBIT_CAPTION = {
  'items/Whiteboard': 'Wainscoting',
}

const GROUP_ORDER = ['heroes', 'mobs', 'items', 'ui']

// Extra podiums seated next to the raw / clean item (Food.cs cook + dirty plate).
const COOK_FOLLOW = {
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

function withCookVariants(items) {
  const out = []
  for (const item of items) {
    out.push(item)
    const extra = COOK_FOLLOW[item.slug]
    if (!extra) continue
    for (const v of extra) {
      out.push({
        ...item,
        slug: v.slug,
        label: v.caption,
        caption: v.caption,
        variantOf: item.slug,
        cookState: v.state,
      })
    }
  }
  return out
}

function applyCookState(root, item) {
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
    const mapUrl = item.variantOf === 'items/Bacon'
      ? './assets/textures/BaconCooked.png'
      : null
    applyCookLook(root, { cooked: 1, overcooked: 1, cookedRGB: rgb, mapUrl })
  }
}

// Prefabs authored facing -Z (away from spawn). Turn them to face the aisle.
const FACE_AISLE = new Set([
  'items/Cupboard',
  'items/NumberStand',
  'items/Whiteboard',
])

// Flat cards / world-space UI. Yaw so +Z tracks the camera (SpeechBubble.cs
// LookRotation; NpcSpeechBubble is a canvas; Fire is a Quad).
const FACE_PLAYER = new Set([
  'ui/SpeechBubble',
  'ui/NpcSpeechBubble',
])

const SPACING_X = 4.6
const SPACING_Z = 7.8
const PEDESTAL_H = 0.88
const PEDESTAL_W = 1.25

// Longest-edge targets in meters. Pedestal sizes from the in-museum scale-gun
// pass. Player / Rat / Wainscoting / Monitor stay on the 0.4–2.35 m clamp.
const EXHIBIT_LONGEST = {
  'items/Spatula': 1.021,
  'items/Cupboard': 1.381,
  'items/NumberStand': 1.011,
  'items/Knife': 0.888,
  'items/LightSwitch': 0.437,
  'items/Pencil': 0.524,
  'items/Fire': 0.828,
  'items/Plate': 0.714,
  'items/Cheese': FOOD_SIZE.cheese,
  'items/Tip': 0.511,
  'items/Box': BOX_SIZE,
  'items/BoxOpen': 3.157,
  'items/FireExtinguisher': 0.771,
  'items/Bacon': FOOD_SIZE.bacon,
  'items/BunTop': FOOD_SIZE.topBun,
  'items/BunBottom': FOOD_SIZE.bun,
  'items/Lettuce': FOOD_SIZE.lettuce,
  'items/LettuceHead': FOOD_SIZE_BY_SLUG['items/LettuceHead'],
  'items/Patty': FOOD_SIZE.patty,
  'items/Tomato': FOOD_SIZE.tomato,
  'items/PlateDirty': 0.714,
  'items/BaconCooked': FOOD_SIZE.bacon,
  'items/BaconCooked2': FOOD_SIZE.bacon,
  'items/BaconBurned': FOOD_SIZE.bacon,
  'items/PattyCooked': FOOD_SIZE.patty,
  'items/PattyBurned': FOOD_SIZE.patty,
  'items/CheeseCooked': FOOD_SIZE.cheese,
  'items/CheeseBurned': FOOD_SIZE.cheese,
  'items/TomatoCooked': FOOD_SIZE.tomato,
  'items/TomatoBurned': FOOD_SIZE.tomato,
  'items/LettuceCooked': FOOD_SIZE.lettuce,
  'items/LettuceBurned': FOOD_SIZE.lettuce,
  'items/LettuceHeadCooked': FOOD_SIZE_BY_SLUG['items/LettuceHead'],
  'items/LettuceHeadBurned': FOOD_SIZE_BY_SLUG['items/LettuceHead'],
  'items/BunTopCooked': FOOD_SIZE.topBun,
  'items/BunTopBurned': FOOD_SIZE.topBun,
  'items/BunBottomCooked': FOOD_SIZE.bun,
  'items/BunBottomBurned': FOOD_SIZE.bun,
  'ui/SpeechBubble': 1.238,
  'ui/NpcSpeechBubble': 1.048,
  'ui/StaffMenu': 0.937,
}

const $ = id => document.getElementById(id)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x2a261f)
scene.fog = new THREE.Fog(0x2a261f, 60, 150)

const loader = createUnityLoader({ base: './assets' })
const player = createFirstPersonPlayer()
scene.add(player.object)

const exhibits = []
const foodProtos = {}
let crowd = null
let foodWorld = null
let hands = null
let rats = null
let demoPlayers = null
let soundboard = null
let delivery = null
let swatches = null
let posters = null
let posKiosk = null
const fireSprites = []
const facePlayer = []
const scaler = createScaler({
  scene, player, exhibits, pedestalH: PEDESTAL_H,
  onScale(rec) {
    if (rec.slug !== 'heroes/Arm') return
    if (hands && hands.setScale) hands.setScale(rec.editMul)
    if (demoPlayers && demoPlayers.setScale) demoPlayers.setScale(rec.editMul)
  },
})
const _fireCam = new THREE.Vector3()
const _firePos = new THREE.Vector3()
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2(0, 0)

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

function makePlaqueStand(title, sub) {
  const face = makePlaque(title, sub)
  const g = new THREE.Group()
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.48, 0.05),
    // Same mocha as makePedestal() — not the lighter Wood.png.
    new THREE.MeshStandardMaterial({
      color: 0x3a322c, roughness: 0.72, metalness: 0.04,
    }),
  )
  board.position.z = -0.028
  board.castShadow = board.receiveShadow = true
  face.position.z = 0.027
  g.add(board, face)
  return g
}

function makePlaque(title, sub) {
  const map = canvasTexture(768, 220, (g, w, h) => {
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#6b5a45'
    g.lineWidth = 6
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f0e6d4'
    g.font = '600 52px ui-sans-serif, system-ui, sans-serif'
    g.fillText(title, 36, 92)
    g.fillStyle = '#b5a48a'
    g.font = '28px ui-sans-serif, system-ui, sans-serif'
    g.fillText(sub, 36, 156)
  })
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.41),
    new THREE.MeshBasicMaterial({ map, transparent: true })
  )
}

function makeBanner(text) {
  const map = canvasTexture(1024, 192, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.font = '700 92px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(text.toUpperCase(), w / 2, 120)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 1.2),
    new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide })
  )
  return m
}

function makeTitleWall() {
  const map = canvasTexture(2048, 768, (g, w, h) => {
    g.fillStyle = '#cfc6b8'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#5a4634'
    g.font = '600 72px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('SCENE 01', w / 2, 220)
    g.fillStyle = '#1c1610'
    g.font = '700 120px ui-sans-serif, system-ui, sans-serif'
    g.fillText('PLAYER & NPCS', w / 2, 380)
    g.fillStyle = '#6b5a45'
    g.font = '36px ui-sans-serif, system-ui, sans-serif'
    g.fillText('Walk the hall. Every converted prefab is on a pedestal.', w / 2, 500)
    g.fillText('WASD  ·  Shift run  ·  Ctrl walk  ·  mouse look', w / 2, 570)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5.25),
    new THREE.MeshBasicMaterial({ map })
  )
  return m
}

function makePedestal() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.72, metalness: 0.04 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.55, metalness: 0.06 })
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(PEDESTAL_W, PEDESTAL_H, PEDESTAL_W), mat)
  base.position.y = PEDESTAL_H / 2
  base.castShadow = base.receiveShadow = true
  const cap = new THREE.Mesh(new THREE.BoxGeometry(PEDESTAL_W + 0.12, 0.06, PEDESTAL_W + 0.12), capMat)
  cap.position.y = PEDESTAL_H + 0.03
  cap.receiveShadow = true
  g.add(base, cap)
  return g
}

function tiledFloor(w, d) {
  const map = new THREE.TextureLoader().load('./assets/entities/tiles/MuseumFloor.png')
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(w / 3.2, d / 3.2)
  map.anisotropy = 4
  return map
}

function buildRoom(minx, maxx, minz, maxz, height) {
  const w = maxx - minx, d = maxz - minz
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tiledFloor(w, d), roughness: 0.88 })
  const wallMat  = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.88 })
  const ceilMat  = new THREE.MeshBasicMaterial({ color: 0x3a3530, side: THREE.DoubleSide })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, 0, cz)
  floor.receiveShadow = true
  scene.add(floor)

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(cx, height, cz)
  scene.add(ceil)

  const thick = 0.4
  const walls = [
    { x: cx, z: minz - thick / 2, w,  h: height, d: thick },
    { x: cx, z: maxz + thick / 2, w,  h: height, d: thick },
    { x: minx - thick / 2, z: cz, w: thick, h: height, d },
    { x: maxx + thick / 2, z: cz, w: thick, h: height, d },
  ]
  for (const s of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), wallMat)
    m.position.set(s.x, s.h / 2, s.z)
    m.receiveShadow = true
    scene.add(m)
  }

  const title = makeTitleWall()
  title.position.set(cx, 3.4, maxz - 0.22)
  title.rotation.y = Math.PI
  scene.add(title)

  player.setRoomBounds(minx, maxx, minz, maxz, 0)
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a3228, 1.05))
  const key = new THREE.DirectionalLight(0xfff4e6, 1.9)
  key.position.set(10, 24, 18)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 90 })
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xb9d4ff, 0.45)
  fill.position.set(-12, 10, -8)
  scene.add(fill)
  for (let z = 8; z >= -48; z -= 16) {
    const p = new THREE.PointLight(0xffe6c4, 18, 22, 2)
    p.position.set(0, 6.5, z)
    scene.add(p)
  }
}

function isExhibit(item) {
  if (item.kind !== 'prefab') return false
  if (!item.meshes && !item.ui) return false
  if (SKIP_EXHIBITS.has(item.slug)) return false
  // Script hosts / trigger volumes / nav gizmos — behavior lives in JS, not these JSON poses.
  if (/Particles|Pathfinding|triggers|GameManagement\/Spawn/.test(item.slug)) return false
  if (/\/(ServerBox|PhysCube|3rd_Person_Controller|First_Person_Controller|GTextEras|Text3D|PlayerMenu|Bubbles)$/.test(item.slug)) return false
  if (/\/NPC\/Node$/.test(item.slug)) return false
  if (/Scripts\/Computer\/Graphics\//.test(item.slug)) return false
  if (item.slug === 'Resources/Skins/Cheese') return false
  return true
}

function flipStaffMenuUVs(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.uv) return
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    const uv = g.attributes.uv
    const nrm = g.attributes.normal
    if (!uv || !nrm) return
    for (let i = 0; i < uv.count; i += 3) {
      const nz = (nrm.getZ(i) + nrm.getZ(i + 1) + nrm.getZ(i + 2)) / 3
      if (nz <= 0.35) continue
      for (let k = 0; k < 3; k++) {
        const vi = i + k
        uv.setX(vi, 1 - uv.getX(vi))
      }
    }
    uv.needsUpdate = true
    o.geometry = g
  })
}

// !Whiteboard is diner wainscoting: wood chair-rail on the top edge, paintable
// panel below (medium gray in the original kitchen). Prefab "base" was authored
// at local -Y; flip it up so the rail reads as the waist-height trim.
function setupWainscot(root) {
  root.traverse(o => {
    if (o.name === 'base' && o.position.y < 0) o.position.y *= -1
    if (!o.isMesh) return
    if (o.name && o.name.indexOf('Whiteboard') !== -1) {
      o.material = o.material.clone()
      o.material.color.set(0x6e6e70)
    }
  })
}

// Lettuce-Head-Full is a hollow leaf shell; Lettuce-Head-Part is a solid
// hemisphere (KnifeTrigger chops Full → two Parts at 180°). Seat the half
// inside the shell so the head reads as one vegetable — pedestal and box spill.
async function nestLettuceHead(headRoot, loader) {
  const part = await loader.load('items/LettucePart')
  hideTriggers(part.root)
  part.root.rotation.y = Math.PI
  headRoot.add(part.root)
  return headRoot
}

function addStaffMenuWhiteBack(root) {
  let mesh = null
  root.traverse(o => { if (!mesh && o.isMesh) mesh = o })
  if (!mesh || !mesh.geometry) return
  mesh.geometry.computeBoundingBox()
  const bb = mesh.geometry.boundingBox
  const w = bb.max.x - bb.min.x
  const h = bb.max.y - bb.min.y
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.02, h * 1.02),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  back.rotation.y = Math.PI
  back.position.set(
    (bb.min.x + bb.max.x) * 0.5,
    (bb.min.y + bb.max.y) * 0.5,
    bb.min.z - 0.002,
  )
  mesh.add(back)
}

function layoutRows(items, featuredSlugs) {
  const used = new Set(featuredSlugs)
  const rows = [{ name: 'People', items: items.filter(i => featuredSlugs.includes(i.slug)) }]
  rows[0].items.sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug))

  const rest = items.filter(i => !used.has(i.slug))
  const byGroup = new Map()
  for (const i of rest) {
    if (!byGroup.has(i.group)) byGroup.set(i.group, [])
    byGroup.get(i.group).push(i)
  }
  for (const g of GROUP_ORDER) {
    if (byGroup.has(g)) {
      rows.push({ name: g, items: byGroup.get(g) })
      byGroup.delete(g)
    }
  }
  for (const [g, list] of byGroup) rows.push({ name: g, items: list })
  return rows.filter(r => r.items.length)
}

function placeOnPedestal(asset, x, z, meta) {
  hideTriggers(asset)
  // Rotate before centering — FACE_AISLE around a non-centered pivot
  // walked the Cupboard off the back of its podium.
  if (FACE_AISLE.has(meta.slug)) asset.rotation.y += Math.PI
  if (meta.slug === 'items/Patty') restorePattyDisc(asset)
  const target = EXHIBIT_LONGEST[meta.slug] ?? EXHIBIT_LONGEST[meta.variantOf]
  const { size, scale, native } = target != null
    ? fitLongest(asset, target)
    : fitOnFloor(asset, { maxSize: 2.35, minSize: 0.4 })
  if (meta.slug === 'items/Cupboard') {
    // Sit the aisle-facing face at the front of the plinth, not AABB-centered
    // (the cabinet body is deeper than the podium).
    asset.updateMatrixWorld(true)
    const box = boundsOf(asset)
    asset.position.z += (PEDESTAL_W * 0.5 - 0.05) - box.max.z
  }
  asset.position.y += PEDESTAL_H + 0.06

  const caption = FEATURED.find(f => f.slug === meta.slug)?.caption
    || EXHIBIT_CAPTION[meta.slug]
    || meta.caption
    || meta.label
  const nativeStr = native
    ? `native ${native.x.toFixed(2)} × ${native.y.toFixed(2)} × ${native.z.toFixed(2)}`
    : meta.group
  const plaque = makePlaque(caption, `${meta.group}  ·  ${nativeStr}`)
  plaque.position.set(0, 0.55, PEDESTAL_W * 0.52 + 0.02)

  const wrap = new THREE.Group()
  wrap.position.set(x, 0, z)
  wrap.add(makePedestal())
  wrap.add(asset)
  wrap.add(plaque)
  scene.add(wrap)

  const hw = Math.max(PEDESTAL_W / 2, size.x * 0.4)
  const hd = Math.max(PEDESTAL_W / 2, size.z * 0.4)
  player.addCollider({ x: x - hw, z: z - hd }, { x: x + hw, z: z + hd })

  const rec = {
    ...meta, object: wrap, display: asset, x, z, size, scale, caption,
    editMul: 1,
    native: native ? { x: native.x, y: native.y, z: native.z } : null,
  }
  const foodType = inferFoodType(meta.slug, meta.label)
  if (foodType !== 'other') rec.foodType = foodType
  exhibits.push(rec)
  wrap.traverse(o => { o.userData.exhibit = rec })
  return rec
}

// FireAnimate.cs: one PNG, not a sheet. Flicker = periodic localScale.x flip.
function setupFireSprite(root) {
  root.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = o.receiveShadow = false
    const map = o.material && o.material.map
    o.material = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  })
  fireSprites.push({ root, next: 0.1 + Math.random() * 0.2 })
}

function faceYaw(root) {
  root.getWorldPosition(_firePos)
  root.rotation.y = Math.atan2(_fireCam.x - _firePos.x, _fireCam.z - _firePos.z)
}

function updateFireSprites(dt) {
  player.camera.getWorldPosition(_fireCam)
  for (const f of fireSprites) {
    f.next -= dt
    if (f.next <= 0) {
      f.root.scale.x *= -1
      f.next = 0.1 + Math.random() * 0.2
    }
    faceYaw(f.root)
  }
  for (const root of facePlayer) faceYaw(root)
}

function setStatus(msg) { $('load-msg').textContent = msg }

async function boot() {
  addLights()
  setStatus('Reading manifest…')
  const manifest = await fetch('./assets/manifest.json').then(r => r.json())
  const featuredSlugs = FEATURED.map(f => f.slug)
  const items = withCookVariants(manifest.filter(isExhibit).filter(i => i.slug !== 'items/Truck'))
  // make sure featured slugs are present even if the filter missed them
  for (const s of featuredSlugs) {
    if (!items.some(i => i.slug === s)) {
      const m = manifest.find(i => i.slug === s)
      if (m) items.unshift(m)
    }
  }
  const rows = layoutRows(items, featuredSlugs)

  const nCols = Math.max(...rows.map(r => r.items.length), 1)
  const hallW = Math.max((nCols - 1) * SPACING_X + 10, 24)
  let z = 0
  const positions = []
  let audioZ = -SPACING_Z
  let texturesZ = -SPACING_Z * 2
  let postersZ = -SPACING_Z * 3
  let posZ = -SPACING_Z * 4
  let deliveryZ = -SPACING_Z * 5

  for (const row of rows) {
    const n = row.items.length
    const rowW = (n - 1) * SPACING_X
    const x0 = -rowW / 2
    positions.push({ row, z, x0 })
    z -= SPACING_Z
    if (row.name === 'People') {
      audioZ = z
      z -= SPACING_Z
      texturesZ = z
      z -= 14
      postersZ = z
      z -= SPACING_Z + 1.4
      posZ = z
      z -= SPACING_Z
      deliveryZ = z - 16
      z -= 32
    }
  }

  const minz = z - 6
  const maxz = 16
  const minx = -hallW / 2
  const maxx = hallW / 2
  buildRoom(minx, maxx, minz, maxz, 9.5)

  try {
    setStatus('Loading soundboard…')
    soundboard = await createSoundboard({
      scene, player,
      x: 0,
      z: audioZ,
      facingY: 0,
    })
    const banner = makeBanner('Audio')
    banner.position.set(0, 4.4, audioZ + 1.6)
    scene.add(banner)
    exhibits.push({
      slug: 'audio/Soundboard',
      label: 'Soundboard',
      caption: 'Soundboard',
      group: 'audio',
      x: 0,
      z: audioZ,
      size: { x: soundboard.width, y: soundboard.height, z: soundboard.depth },
    })
  } catch (err) {
    console.warn('[museum] soundboard skipped', err)
  }

  let loaded = 0
  const total = rows.reduce((n, r) => n + r.items.length, 0)

  for (const { row, z: rz, x0 } of positions) {
    const banner = makeBanner(row.name)
    banner.position.set(0, 4.4, rz + 1.6)
    scene.add(banner)

    for (let i = 0; i < row.items.length; i++) {
      const item = row.items[i]
      setStatus(`Loading ${++loaded} / ${total}  —  ${item.label}`)
      try {
        const loadSlug = item.variantOf || item.slug
        const { root } = await loader.load(loadSlug)
        const box = boundsOf(root)
        if (box.isEmpty()) continue
        let display = root
        if (loadSlug === 'ui/StaffMenu') {
          flipStaffMenuUVs(root)
          addStaffMenuWhiteBack(root)
        }
        if (loadSlug === 'items/Whiteboard') setupWainscot(root)
        if (loadSlug === 'ui/NpcSpeechBubble') {
          // Arrow.png is a small down-triangle in a 100×100 empty square,
          // parented on the bubble at the same size — the tail sat inside
          // the circle. Shrink it and park it under the oval.
          root.traverse(o => {
            if (o.name !== 'Background') return
            for (const ch of o.children) {
              if (!ch.isMesh) continue
              ch.scale.setScalar(0.28)
              ch.position.y = -42
            }
          })
        }
        if (loadSlug === 'items/BoxOpen') {
          let boxTex = null
          root.traverse(o => {
            if (o.isMesh && o.material && o.material.map) boxTex = o.material.map
          })
          display = makeOpenNet(boxTex, BOX_SIZE)
        }
        if (loadSlug === 'items/LettuceHead') {
          try {
            await nestLettuceHead(root, loader)
          } catch (err) {
            console.warn('[museum] LettucePart nest skipped', err)
          }
        }
        if (item.cookState) applyCookState(root, item)
        if (inferFoodType(item.slug, item.label) !== 'other') {
          foodProtos[item.slug] = root.clone(true)
          if (loadSlug === 'items/Patty') restorePattyDisc(foodProtos[item.slug])
        }
        const rec = placeOnPedestal(display, x0 + i * SPACING_X, rz, item)
        if (loadSlug === 'items/Fire') setupFireSprite(display)
        if (FACE_PLAYER.has(loadSlug)) facePlayer.push(display)
      } catch (err) {
        console.warn('[museum] skip', item.slug, err)
      }
    }
  }

  try {
    const npc = await loader.load('mobs/Npc')
    hideTriggers(npc.root)
    crowd = createCrowd({ scene, player, proto: npc.root, exhibits, count: 12 })
  } catch (err) {
    console.warn('[museum] NPC crowd skipped', err)
  }

  foodWorld = createFoodWorld({ scene, player })

  try {
    setStatus('Loading texture samples…')
    const banner = makeBanner('Textures')
    banner.position.set(0, 4.4, texturesZ + 2.8)
    scene.add(banner)
    swatches = createSwatches({
      scene, player, foodWorld,
      x: 0, z: texturesZ, facingY: 0,
    })
    exhibits.push({
      slug: 'textures/Swatches',
      label: 'Textures',
      caption: 'Textures',
      group: 'textures',
      x: 0,
      z: texturesZ,
      size: { x: swatches.width, y: swatches.height, z: swatches.depth },
    })
  } catch (err) {
    console.warn('[museum] texture swatches skipped', err)
  }

  try {
    setStatus('Loading poster kiosk…')
    const banner = makeBanner('Posters')
    banner.position.set(0, 4.4, postersZ + 2.4)
    scene.add(banner)
    posters = createPosters({
      scene, player, foodWorld,
      x: 0, z: postersZ,
    })
    exhibits.push({
      slug: 'ui/Posters',
      label: 'Posters',
      caption: 'Posters',
      group: 'ui',
      x: 0,
      z: postersZ,
      size: { x: posters.width, y: posters.height, z: posters.depth },
    })
  } catch (err) {
    console.warn('[museum] posters skipped', err)
  }

  try {
    setStatus('Loading order computer…')
    const banner = makeBanner('POS')
    banner.position.set(0, 4.4, posZ + 1.8)
    scene.add(banner)
    posKiosk = createPosKiosk({
      scene, player,
      x: 0, z: posZ,
      onOpen: () => { player.unlock() },
      onClose: () => {},
    })
    exhibits.push({
      slug: 'ui/POS',
      label: 'POS',
      caption: 'POS',
      group: 'ui',
      x: 0,
      z: posZ,
      size: { x: posKiosk.width, y: posKiosk.height, z: posKiosk.depth },
    })
  } catch (err) {
    console.warn('[museum] POS kiosk skipped', err)
  }

  let cheeseProto = foodProtos['items/Cheese']
  if (!cheeseProto) {
    try {
      const c = await loader.load('items/Cheese')
      cheeseProto = c.root
      foodProtos['items/Cheese'] = cheeseProto
    } catch (err) {
      console.warn('[museum] cheese proto missing', err)
    }
  }
  if (cheeseProto) {
    const b = player.bounds
    const zs = []
    for (let z = 6; z > b.minz + 8; z -= 16) zs.push(z)
    zs.slice(0, 6).forEach((z, i) => {
      const x = (i % 2 === 0 ? -1 : 1) * (2.1 + (i % 3) * 0.4)
      foodWorld.addSpawner(x, z, cheeseProto)
    })
  }

  const needFood = [
    'items/Patty', 'items/Bacon', 'items/BunTop', 'items/BunBottom',
    'items/LettuceHead', 'items/Cheese', 'items/Tomato',
  ]
  for (const slug of needFood) {
    if (foodProtos[slug]) continue
    try {
      const extra = await loader.load(slug)
      if (slug === 'items/LettuceHead') {
        try { await nestLettuceHead(extra.root, loader) }
        catch (err) { console.warn('[museum] LettucePart nest skipped', err) }
      }
      foodProtos[slug] = extra.root
    } catch (err) {
      console.warn('[museum] food proto missing', slug, err)
    }
  }

  try {
    setStatus('Loading delivery truck…')
    const banner = makeBanner('Delivery')
    banner.position.set(0, 4.4, deliveryZ + 8.5)
    scene.add(banner)
    delivery = await createDelivery({
      scene, player, loader, foodWorld, foodProtos,
      x: 0, z: deliveryZ,
    })
    const rec = {
      slug: 'items/Truck',
      label: 'Truck',
      caption: 'Truck',
      group: 'items',
      x: 0,
      z: deliveryZ,
      size: delivery.size,
    }
    exhibits.push(rec)
    const ns = delivery.size
    const nativeStr = `native ${ns.x.toFixed(2)} × ${ns.y.toFixed(2)} × ${ns.z.toFixed(2)}`
    const plaque = makePlaqueStand(rec.caption, `${rec.group}  ·  ${nativeStr}`)
    // Same card as the pedestals, leaned 45° (label up) at the foot of the ramp.
    const lean = Math.PI / 4
    const plaqueH = 0.48
    plaque.rotation.x = -lean
    plaque.position.set(
      delivery.ramp.width * 0.5 + 0.82,
      Math.sin(lean) * plaqueH * 0.5 + 0.01,
      delivery.ramp.z1 + 0.35,
    )
    plaque.traverse(o => { o.userData.exhibit = rec })
    scene.add(plaque)
  } catch (err) {
    console.warn('[museum] delivery truck skipped', err)
  }

  let armRoot = null
  try {
    const arm = await loader.load('heroes/Arm')
    armRoot = arm.root
    hands = createHands({
      scene, player, armProto: armRoot, foodWorld, exhibits, foodProtos,
      getRats: () => rats,
      spawnSwatch: spec => swatches && swatches.take(spec),
      spawnPoster: spec => posters && posters.take(spec),
    })
  } catch (err) {
    console.warn('[museum] arms skipped', err)
  }

  try {
    const pl = await loader.load('heroes/Player')
    hideTriggers(pl.root)
    if (armRoot) {
      demoPlayers = createDemoPlayers({
        scene, player, playerProto: pl.root, armProto: armRoot,
      })
    }
  } catch (err) {
    console.warn('[museum] demo players skipped', err)
  }

  try {
    const rat = await loader.load('mobs/Rat')
    hideTriggers(rat.root)
    rats = createRatDen({ scene, player, ratProto: rat.root, foodWorld })
  } catch (err) {
    console.warn('[museum] rats skipped', err)
  }

  player.spawn(0, 0, 11, 0)
  $('s-exhibits').textContent = String(exhibits.length)
  $('s-visitors').textContent = String(crowd ? crowd.npcs.length : 0)
  setStatus('')
  $('loader').dataset.ready = '1'
  $('loader').querySelector('h1').textContent = 'Asset museum'
  $('loader').querySelector('.sub').textContent =
    `${exhibits.length} exhibits  ·  click to walk`
  $('hint').textContent = 'click to capture mouse'

  window.__museum = {
    scene, camera: player.camera, renderer, player, exhibits, crowd,
    foodWorld, hands, rats, demoPlayers, soundboard, delivery, scaler, swatches,
    posters, posKiosk,
    teleport, enter, pause,
    dbg: harness.dbg,
    pose: harness.pose,
  }
  window.dbg = harness.dbg
  window.pose = harness.pose
  console.log('[museum] ready', exhibits.length, 'exhibits — dbg.help() / pose.help()')
}

let frames = 0, lastFps = performance.now()
let playing = false
let lookName = ''

function teleport(slug) {
  if (soundboard && /^(Soundboard|Audio|audio\/Soundboard)$/i.test(slug)) {
    const v = soundboard.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'Soundboard'
  }
  if (delivery && /^(Truck|Delivery|items\/Truck)$/i.test(slug)) {
    const v = delivery.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'Truck'
  }
  if (swatches && /^(Textures|Swatches|KitchenFloor|textures\/Swatches)$/i.test(slug)) {
    const v = swatches.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'Textures'
  }
  if (posters && /^(Posters|ui\/Posters)$/i.test(slug)) {
    const v = posters.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'Posters'
  }
  if (posKiosk && /^(POS|Pos|Order computer|ui\/POS)$/i.test(slug)) {
    const v = posKiosk.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'POS'
  }
  const e = exhibits.find(x => x.slug === slug || x.label === slug || x.caption === slug)
  if (!e) return null
  const longest = Math.max(e.size?.x || 0, e.size?.y || 0, e.size?.z || 0, 0.4)
  const back = Math.min(4.2, Math.max(1.55, longest * 1.7 + 1.15))
  player.spawn(e.x, 0, e.z + back, 0)
  player.lookAt(e.x, PEDESTAL_H + Math.min((e.size?.y || 2) * 0.45, 1.5), e.z)
  return e.caption || e.label
}

function dumpExtras() {
  return {
    playing,
    holding: hands?.holdingLabel() || '',
    food: (foodWorld?.items || []).map(i => ({
      type: i.type, kind: i.kind || 'food', contents: i.contents || null, opened: !!i.opened,
      pos: { x: +i.position.x.toFixed(2), y: +i.position.y.toFixed(2), z: +i.position.z.toFixed(2) },
      held: !!i.held, onFloor: !!i.onFloor, stolen: !!i.stolen,
    })),
    rats: (rats?.rats || []).map(r => ({
      pos: { x: +r.position.x.toFixed(2), y: +r.position.y.toFixed(2), z: +r.position.z.toFixed(2) },
      stolen: r.stolen?.type || null, goingHome: !!r.goingHome,
      held: !!r.held, onFloor: !!r.onFloor,
    })),
    npcs: (crowd?.npcs || []).map(n => ({
      skin: n.skin, want: n.want, notice: !!n.notice,
      pos: { x: +n.position.x.toFixed(2), z: +n.position.z.toFixed(2) },
    })),
    exhibits: exhibits.map(e => e.slug),
    tool: scaler.tool,
    scales: scaler.dump(),
    armScale: hands?.armScale ?? 1,
  }
}

const harness = installHarness({
  scene, renderer, loader, player,
  getExhibits: () => exhibits,
  teleport,
  dumpExtras,
  extraDbg: { scaler },
})

function tick(dt) {
  player.update(dt)
  if (soundboard) {
    soundboard.update(dt)
    if (scaler.tool === 'hand' && (player.fire1Down || player.fire2Down)) {
      const handsUp = player.leftHand || player.rightHand
      if (!handsUp && posters) posters.tryTurn()
      soundboard.tryPress()
      if (posKiosk && !posKiosk.isOpen) posKiosk.tryPress()
    }
  } else if (scaler.tool === 'hand' && (player.fire1Down || player.fire2Down)) {
    const handsUp = player.leftHand || player.rightHand
    if (!handsUp && posters) posters.tryTurn()
    if (posKiosk && !posKiosk.isOpen) posKiosk.tryPress()
  }
  if (hands && !posKiosk?.isOpen) hands.update(dt, { grab: scaler.tool === 'hand', right: scaler.tool === 'hand' })
  if (foodWorld) foodWorld.update(dt, harness.time.T)
  if (rats) rats.update(dt, harness.time.T)
  if (crowd) crowd.update(dt, harness.time.T)
  if (demoPlayers) demoPlayers.update(dt)
  if (fireSprites.length || facePlayer.length) updateFireSprites(dt)
}

function fitRenderer() {
  const w = innerWidth, h = innerHeight
  if (w < 2 || h < 2) return false
  const el = renderer.domElement
  if (el.clientWidth !== w || el.clientHeight !== h) {
    player.camera.aspect = w / h
    player.camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    harness.poser.resize()
  }
  return true
}

function render() {
  if (!fitRenderer()) return
  if (harness.poser.active) harness.poser.render()
  else renderer.render(scene, player.camera)
}

harness.bind({ tick, render })

function currentLook() {
  const scaleLook = scaler.lookLabel()
  if (scaleLook) return scaleLook
  const audioLook = soundboard?.lookLabel()
  if (audioLook) return audioLook
  const posterLook = posters?.lookLabel()
  if (posterLook) return posterLook
  const posLook = posKiosk?.lookLabel()
  if (posLook) return posLook
  raycaster.setFromCamera(ndc, player.camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    const npc = h.object.userData.npc
    if (npc) return npc.notice ? `${npc.skin} · looking at you` : `${npc.skin} · ${npc.want}`
    if (h.object.userData.demoPlayer) {
      const d = h.object.userData.demoPlayer
      return d.spec.name + ' · ' + d.spec.skin
    }
    if (h.object.userData.rat) {
      const rat = h.object.userData.rat
      return rat.held ? 'rat (held)' : 'rat · pick up'
    }
    const food = h.object.userData.food
    if (food) {
      if (food.kind === 'box') {
        return (food.opened ? 'open box' : 'box · ' + (food.contents || 'closed')) + (food.held ? ' (held)' : '')
      }
      return food.type + (food.held ? ' (held)' : food.onFloor ? ' (floor)' : '')
    }
    const rec = h.object.userData.exhibit
    if (rec) return rec.foodType ? (rec.caption || rec.label) + ' · take a copy' : (rec.caption || rec.label)
    const bin = h.object.userData.swatchBin
    if (bin) return bin.caption + ' · take a swatch'
  }
  return ''
}

renderer.setAnimationLoop(() => {
  if (!harness.poser.active) {
    const dt = harness.time.advance()
    if (dt > 0) tick(dt)
    scaler.update()
  }

  const look = currentLook()
  if (look !== lookName) {
    lookName = look
    $('look').textContent = look
    $('look').style.opacity = look ? '1' : '0'
  }

  const p = player.position
  $('s-pos').textContent = `${p.x.toFixed(1)}  ${p.y.toFixed(1)}  ${p.z.toFixed(1)}`
  const k = player.keys
  $('s-speed').textContent = (k.has('ShiftLeft') || k.has('ShiftRight'))
    ? 'run' : ((k.has('ControlLeft') || k.has('ControlRight')) ? 'walk' : 'move')
  if ($('s-hold')) $('s-hold').textContent = hands?.holdingLabel() || '—'
  if ($('s-rats')) $('s-rats').textContent = String(rats ? rats.count : 0)
  if ($('s-tool')) $('s-tool').textContent = scaler.tool === 'scale' ? 'scale gun' : 'hand'
  if ($('help')) {
    $('help').textContent = scaler.tool === 'scale'
      ? 'SCALE GUN  ·  aim at an exhibit  ·  hold LMB, drag right = bigger / left = smaller  ·  0 empty hands'
      : 'WASD move · Space jump · Q/E hands · 0 empty · 1 scale gun · click grab/drop · Shift run · Esc release mouse'
  }

  render()
  if (++frames >= 20) {
    const now = performance.now()
    $('s-fps').textContent = String(Math.round(frames * 1000 / (now - lastFps)))
    lastFps = now
    frames = 0
    harness.refreshPanel()
  }
})

function enter() {
  if ($('loader').dataset.ready !== '1') return
  playing = true
  player.enabled = true
  $('loader').style.display = 'none'
  $('hud').style.display = 'block'
  $('cross').style.display = 'block'
  $('look').style.display = 'block'
  player.requestLock(renderer.domElement)
  soundboard?.resume()
}

function pause() {
  // No game pause (this will be multiplayer). Esc / this helper only
  // drops pointer lock; WASD and the sim keep running. LMB recaptures.
  player.unlock()
}

$('loader').addEventListener('click', enter)
renderer.domElement.addEventListener('click', () => {
  if (playing && !player.locked) player.requestLock(renderer.domElement)
})
addEventListener('keydown', e => {
  if (e.target && e.target.closest('input, textarea, [contenteditable]')) return
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault()
  }
})
addEventListener('resize', () => {
  player.camera.aspect = innerWidth / innerHeight
  player.camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  harness.poser.resize()
})

player.camera.aspect = innerWidth / innerHeight
player.camera.updateProjectionMatrix()
player.enabled = false

boot().catch(err => {
  console.error(err)
  setStatus('Failed: ' + err.message)
})
