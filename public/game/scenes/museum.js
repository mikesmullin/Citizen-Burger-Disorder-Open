// Scene 01 — first-person walk through a museum of converted prefabs.
// Demonstrates: player controller (move / look / run / walk) + NPC assets
// standing in the space. Grab, cooking, and netcode come in later scenes.

import * as THREE from 'three'
import { createUnityLoader, fitOnFloor, fitLongest, fitOnFloorNative, fitLongestNative, restorePattyDisc, hideTriggers, boundsOf } from '../common/unityScene.js'

import { createFirstPersonPlayer } from '../systems/player.js'
import { createCrowd } from '../systems/npc.js'
import { createFoodWorld, inferFoodType, inferPickup, isFood, FOOD_SIZE, FOOD_SIZE_BY_SLUG } from '../systems/food.js'
import { createFoodKiosk, FOOD_HALL_SKIP } from '../systems/foodKiosk.js'
import { createHands } from '../systems/hands.js'
import { createRatDen, RAT_SIZE } from '../systems/rats.js'
import { createDemoPlayers } from '../entities/demoPlayers.js'
import { createSoundboard } from '../systems/soundboard.js'
import { createFireWatch } from '../systems/fire.js'
import { createDelivery, BOX_SIZE, prepareClosedBox } from '../systems/delivery.js'
import { createScaler } from '../systems/scaler.js'
import { createSwatches } from '../systems/swatches.js'
import { createPedestalField, PEDESTAL_H, PEDESTAL_W } from '../systems/pedestals.js'
import { createPosters } from '../systems/posters.js'
import { createKitchen } from '../systems/kitchen.js'
import { createFront } from '../systems/front.js'
import { createSwitchSet, SWITCH_Y } from '../systems/lightSwitch.js'
import { createSkybox, SKY_FOG_DAY, SKY_FOG_DUSK, SKY_FOG_NIGHT } from '../systems/skybox.js'
import { createWorld } from '../common/ecs.js'
import { installHarness } from '../common/harness.js'
import { createFpsOverlay } from '../common/fpsOverlay.js'
import { createInstancePool, visualMesh, createVisualInstancer } from '../common/instancePool.js'
import { createBodyInstancer } from '../common/bodyInstancer.js'
import { createKit, makeFloor, FLOOR_PHYSICS } from '../common/kit.js'
import { flags, applyFlags } from '../common/flags.js'
import { bindAudio } from '../common/audio.js'
import { createLabelField } from '../common/labelField.js'
import { createBubbleField } from '../common/bubbleField.js'

const FEATURED = [
  { slug: 'mobs/Rat', caption: 'Rat' },
]

// Pedestals we skip: live in the hall already (Arm, NPC, Player lineup), unused Kritz
// leftovers, or a light we will add natively later.
const SKIP_EXHIBITS = new Set([
  'heroes/Player',
  'mobs/Npc',
  'items/Notepad',
  'items/Paper',
  'items/Pencil',
  'items/PointLight',
  'items/LettucePart',   // nested inside LettuceHead
  'items/Monitor',       // unused Computer leftover — nComputer is the POS overlay
  'items/MonitorPickup', // unused Computer leftover
  'items/NumberStand',   // live on the front checkout, next to the order computer
  'items/BoxOpen',       // live on the delivery truck when a crate unpacks
  'ui/StaffMenu',        // glued to the front counter wall, below the POS
  'ui/BunBottom',
  'ui/BunTop',
  'ui/Cheese',
  'ui/Lettuce',
  'ui/Patty',
  'ui/CustomerMenu',
  'items/Whiteboard',    // diner wainscot is a kit strip on the Front walls
])

// Player-facing plaque names when the Unity slug is a misnomer.
const EXHIBIT_CAPTION = {
}

// Show-floor clusters — grouped by how systems work together, not by asset folder.
const CLUSTER_ORDER = ['people', 'line', 'ingredients', 'chaos', 'service', 'storage', 'back']
const CLUSTER_BANNER = {
  people: 'People',
  line: 'On the line',
  ingredients: 'Ingredients',
  chaos: 'Chaos',
  service: 'Service',
  storage: 'Storage',
  back: 'Back of house',
}

// Prefabs authored facing -Z (away from spawn). Turn them to face the aisle.
const FACE_AISLE = new Set([
  'items/NumberStand',
])

// Flat cards / world-space UI. Yaw so +Z tracks the camera (SpeechBubble.cs
// LookRotation; NpcSpeechBubble is a canvas; Fire is a Quad).
const FACE_PLAYER = new Set([
  'ui/SpeechBubble',
  'ui/NpcSpeechBubble',
])

const SPACING_X = 4.6
const SPACING_Z = 7.8

// Longest-edge targets in meters. Pedestal sizes from the in-museum scale-gun
// pass. Player / Rat / Wainscoting stay on the 0.4–2.35 m clamp.
const EXHIBIT_LONGEST = {
  'mobs/Rat': RAT_SIZE,
  'items/Spatula': 1.021,
  'items/NumberStand': 1.011,
  'items/Knife': 0.888,
  'items/LightSwitch': 0.437,
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
  'heroes/Arm': 0.674,
  'ui/SpeechBubble': 1.238,
  'ui/NpcSpeechBubble': 1.048,
  'ui/StaffMenu': 0.937,
}

// Scale-gun pass. Arm podium mul → FPS viewmodel; DemoArm mul → 3p arms.
const ARM_SCALE = 0.287
const FPS_ARM_SCALE = 0.475
const DEMO_ARM_MUL = 0.656
const DEMO_ARM_SCALE = 0.361

const $ = id => document.getElementById(id)

// Firefox/Zen: no MSAA (resolve is another full-size blit into WebRender)
// and no preserveDrawingBuffer (that copies ~6 MB into the compositor
// every frame and stalls every tab).
const gecko = /Firefox\//.test(navigator.userAgent)
const renderer = new THREE.WebGLRenderer({ antialias: !gecko })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
document.body.appendChild(renderer.domElement)
const fpsOverlay = createFpsOverlay()

const scene = new THREE.Scene()
scene.background = new THREE.Color(SKY_FOG_DAY)
scene.fog = new THREE.Fog(SKY_FOG_DAY, 70, 170)

let skybox = null
let hallLit = null
const _illumA = new THREE.Color()
const _illumB = new THREE.Color()

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixIllumColor(target, nightHex, dayHex, duskHex, t, dusk) {
  _illumA.setHex(nightHex)
  _illumB.setHex(dayHex)
  target.copy(_illumA).lerp(_illumB, t)
  if (dusk > 0) target.lerp(_illumA.setHex(duskHex), dusk)
}

function applyHallIllum(t) {
  if (!hallLit) return
  const dusk = skybox ? skybox.dusk : 0
  const day = hallLit.day
  const night = hallLit.night
  const twi = hallLit.dusk
  hallLit.hemi.intensity = lerp(lerp(night.hemi, day.hemi, t), twi.hemi, dusk)
  hallLit.key.intensity = lerp(lerp(night.key, day.key, t), twi.key, dusk)
  hallLit.fill.intensity = lerp(lerp(night.fill, day.fill, t), twi.fill, dusk)
  const pi = lerp(lerp(night.point, day.point, t), twi.point, dusk)
  for (const p of hallLit.points) p.intensity = pi
  mixIllumColor(hallLit.key.color, night.keyColor, day.keyColor, twi.keyColor, t, dusk)
  mixIllumColor(hallLit.hemi.color, night.hemiSky, day.hemiSky, twi.hemiSky, t, dusk)
  mixIllumColor(hallLit.hemi.groundColor, night.hemiGround, day.hemiGround, twi.hemiGround, t, dusk)
  mixIllumColor(hallLit.fill.color, night.fillColor, day.fillColor, twi.fillColor, t, dusk)
  mixIllumColor(scene.background, SKY_FOG_NIGHT, SKY_FOG_DAY, SKY_FOG_DUSK, t, dusk)
  if (scene.fog) mixIllumColor(scene.fog.color, SKY_FOG_NIGHT, SKY_FOG_DAY, SKY_FOG_DUSK, t, dusk)
}

const loader = createUnityLoader({ base: './assets' })
const player = createFirstPersonPlayer()
scene.add(player.object)
player.spawn(0, 0, 11, 0)
bindAudio(player.camera)

const HALL = { minx: -34, maxx: 34, minz: -64, maxz: 16, height: 9.5 }

function setHallDay(day) {
  if (skybox) skybox.setDay(day)
}

const exhibits = []
const foodProtos = {}
const labels = createLabelField({ scene })
const bubbles = createBubbleField({ scene })
const pickInst = createVisualInstancer({ scene, max: 96, prefix: 'Pick' })
const bodies = createBodyInstancer({ scene, maxPerSkin: 32, prefix: 'BodyInst:' })
let crowd = null
let foodWorld = null
let hands = null
let rats = null
let demoPlayers = null
let soundboard = null
let delivery = null
let swatches = null
let pedestals = null
let posters = null
let foodKiosk = null
let posKiosk = null
let kitchen = null
let front = null
let world = null
let npcProto = null
let exhibitSwitches = null
let daySwitchSpot = null
let fires = null
const fireSprites = []
const facePlayer = []
const scaler = createScaler({
  scene, player, exhibits, pedestalH: PEDESTAL_H,
  onScale(rec) {
    if (rec.slug === 'heroes/Arm') {
      const live = FPS_ARM_SCALE * rec.editMul / ARM_SCALE
      if (hands && hands.setScale) hands.setScale(live)
      return
    }
    if (rec.slug === 'heroes/DemoArm') {
      const live = DEMO_ARM_SCALE * rec.editMul / DEMO_ARM_MUL
      if (demoPlayers && demoPlayers.setScale) demoPlayers.setScale(live)
    }
  },
})
const _fireCam = new THREE.Vector3()
const _firePos = new THREE.Vector3()
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2(0, 0)

buildRoom(HALL.minx, HALL.maxx, HALL.minz, HALL.maxz, HALL.height)
pedestals = createPedestalField({ scene })
skybox = createSkybox(scene, {
  sunDir: new THREE.Vector3(10, 24, 18),
  onDay: applyHallIllum,
})
hallLit = addLights(HALL.minx, HALL.maxx, HALL.minz, HALL.maxz)
hallLit.day = {
  hemi: 1.05,
  key: 1.9,
  fill: 0.45,
  point: 16,
  hemiSky: 0xfff3e0,
  hemiGround: 0x3a3228,
  keyColor: 0xfff4e6,
  fillColor: 0xb9d4ff,
}
hallLit.night = {
  hemi: 0.15,
  key: 0.22,
  fill: 0.06,
  point: 2.2,
  hemiSky: 0x9aa8c4,
  hemiGround: 0x1a1c22,
  keyColor: 0x8a9bb8,
  fillColor: 0x5a6a88,
}
hallLit.dusk = {
  hemi: 0.52,
  key: 0.95,
  fill: 0.28,
  point: 6.5,
  hemiSky: 0xff9a68,
  hemiGround: 0x4a2418,
  keyColor: 0xff7a32,
  fillColor: 0x6a48a0,
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
    g.fillText('THE SHOW FLOOR', w / 2, 380)
    g.fillStyle = '#6b5a45'
    g.font = '36px ui-sans-serif, system-ui, sans-serif'
    g.fillText('Kitchen, prep, and every converted prefab — grouped by how they work.', w / 2, 500)
    g.fillText('WASD  ·  Shift run  ·  Ctrl walk  ·  mouse look  ·  Q/E hands', w / 2, 570)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5.25),
    new THREE.MeshBasicMaterial({ map })
  )
  return m
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
  const map = tiledFloor(w, d)
  scene.add(makeFloor({ map, w, d, x: cx, z: cz, layer: 0, tile: 3.2, roughness: 0.88 }))
  // Open to sky — the hall has no ceiling; skybox is the dome.

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.88 })
  const kit = createKit({ parent: scene, max: 8 })
  const thick = 0.4
  kit.box(wallMat, w, height, thick, cx, height / 2, minz - thick / 2)
  kit.box(wallMat, w, height, thick, cx, height / 2, maxz + thick / 2)
  kit.box(wallMat, thick, height, d, minx - thick / 2, height / 2, cz)
  kit.box(wallMat, thick, height, d, maxx + thick / 2, height / 2, cz)
  kit.finalize()

  const title = makeTitleWall()
  title.position.set(cx, 3.4, maxz - 0.22)
  title.rotation.y = Math.PI
  scene.add(title)

  player.setRoomBounds(minx, maxx, minz, maxz, FLOOR_PHYSICS)
}

function addLights(minx, maxx, minz, maxz) {
  const hemi = new THREE.HemisphereLight(0xfff3e0, 0x3a3228, 1.05)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff4e6, 1.9)
  key.position.set(10, 24, 18)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0008
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 120 })
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xb9d4ff, 0.45)
  fill.position.set(-12, 10, -8)
  scene.add(fill)
  const points = []
  const xs = [minx * 0.55, 0, maxx * 0.55]
  for (let z = maxz - 8; z >= minz + 8; z -= 16) {
    for (const x of xs) {
      const p = new THREE.PointLight(0xffe6c4, 16, 20, 2)
      p.position.set(x, 6.5, z)
      scene.add(p)
      points.push(p)
    }
  }
  return { hemi, key, fill, points }
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

function clusterOf(item) {
  const s = item.variantOf || item.slug
  if (s === 'heroes/Player' || s === 'heroes/Arm' || s === 'mobs/Rat') return 'people'
  if (s === 'items/Spatula' || s === 'items/Knife' || s === 'items/Plate') return 'line'
  const food = inferFoodType(s, item.label)
  if (food !== 'other') return 'ingredients'
  if (s === 'items/Fire' || s === 'items/FireExtinguisher') return 'chaos'
  if (
    s === 'items/NumberStand' || s === 'items/Tip'
    || s === 'ui/SpeechBubble' || s === 'ui/NpcSpeechBubble' || s === 'ui/StaffMenu'
  ) return 'service'
  if (s === 'items/Box' || s === 'items/BoxOpen') return 'storage'
  return 'back'
}

function layoutClusters(items, featuredSlugs) {
  const by = new Map()
  for (const id of CLUSTER_ORDER) by.set(id, [])
  for (const item of items) {
    const id = clusterOf(item)
    if (!by.has(id)) by.set(id, [])
    by.get(id).push(item)
  }
  const people = by.get('people') || []
  people.sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug))
  return CLUSTER_ORDER
    .map(id => ({ id, name: CLUSTER_BANNER[id] || id, items: by.get(id) || [] }))
    .filter(c => c.items.length)
}

function clusterSlots(n, cx, cz, yaw, { cols, spacing = 3.5, rowZ = 3.6 } = {}) {
  const c = cols || n
  const slots = []
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  for (let i = 0; i < n; i++) {
    const col = i % c
    const row = (i / c) | 0
    const nThis = Math.min(c, n - row * c)
    const lx = (col - (nThis - 1) / 2) * spacing
    const lz = -row * rowZ
    slots.push({
      x: cx + lx * cos + lz * sin,
      z: cz - lx * sin + lz * cos,
      yaw,
    })
  }
  return slots
}

function placeOnPedestal(asset, x, z, meta, yaw = 0, data = null) {
  hideTriggers(asset)
  // Rotate before centering — FACE_AISLE around a non-centered pivot
  // walked aisle-facing props off the back of their podium.
  if (FACE_AISLE.has(meta.slug)) asset.rotation.y += Math.PI
  if (meta.slug === 'items/Patty' || meta.variantOf === 'items/Patty') restorePattyDisc(asset)
  const target = EXHIBIT_LONGEST[meta.slug] ?? EXHIBIT_LONGEST[meta.variantOf]
  const useNative = !!(data && data.nativeBounds)
  const { size, scale, native } = target != null
    ? (useNative ? fitLongestNative(asset, data, target) : fitLongest(asset, target))
    : (useNative ? fitOnFloorNative(asset, data, { maxSize: 2.35, minSize: 0.4 }) : fitOnFloor(asset, { maxSize: 2.35, minSize: 0.4 }))
  asset.position.y += PEDESTAL_H + 0.06

  const caption = FEATURED.find(f => f.slug === meta.slug)?.caption
    || EXHIBIT_CAPTION[meta.slug]
    || meta.caption
    || meta.label
  const nativeStr = native
    ? `native ${native.x.toFixed(2)} × ${native.y.toFixed(2)} × ${native.z.toFixed(2)}`
    : meta.group
  const wrap = new THREE.Group()
  wrap.position.set(x, 0, z)
  wrap.rotation.y = yaw
  wrap.add(asset)
  labels.place({
    text: caption,
    sub: `${meta.group}  ·  ${nativeStr}`,
    kind: 'plaque',
    x: 0, y: 0.55, z: PEDESTAL_W * 0.52 + 0.02,
    parent: wrap,
  })
  scene.add(wrap)
  if (pedestals) pedestals.place(x, z, yaw)

  const c = Math.abs(Math.cos(yaw))
  const s = Math.abs(Math.sin(yaw))
  const half = Math.max(PEDESTAL_W / 2, (size.x || 0) * 0.4, (size.z || 0) * 0.4)
  const hw = half * (c + s)
  const hd = half * (s + c)
  player.addCollider({ x: x - hw, z: z - hd }, { x: x + hw, z: z + hd })

  const rec = {
    ...meta, object: wrap, display: asset, x, z, yaw, size, scale, caption,
    editMul: meta.slug === 'heroes/Arm' ? ARM_SCALE : 1,
    native: native ? { x: native.x, y: native.y, z: native.z } : null,
  }
  const pickup = inferPickup(meta.slug, meta.label)
  if (pickup) {
    rec.pickup = pickup
    if (isFood(pickup)) rec.foodType = pickup
  }
  exhibits.push(rec)
  wrap.traverse(o => { o.userData.exhibit = rec })
  if (rec.pickup && rec.slug !== 'items/Fire' && rec.slug !== 'items/LightSwitch') {
    const variant = rec.cookState === 'dirty' ? 'dirty'
      : (rec.cookState && String(rec.cookState).startsWith('bacon') ? rec.cookState : '')
    pickInst.attach(asset, { exhibit: rec }, variant)
  }
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
  const drop = []
  root.traverse(o => { if (o.isLight) drop.push(o) })
  for (const L of drop) { if (L.parent) L.parent.remove(L) }
  fireSprites.push({ root, next: 0.1 + Math.random() * 0.2 })
}

function faceYaw(root) {
  root.getWorldPosition(_firePos)
  root.rotation.y = Math.atan2(_fireCam.x - _firePos.x, _fireCam.z - _firePos.z)
}

function updateFireSprites(dt) {
  player.camera.getWorldPosition(_fireCam)
  for (const f of fireSprites) {
    if (f.out || (f.root && f.root.visible === false)) continue
    f.next -= dt
    if (f.next <= 0) {
      f.root.scale.x *= -1
      f.next = 0.1 + Math.random() * 0.2
    }
    faceYaw(f.root)
    pickInst.sync(f.root)
  }
  for (const root of facePlayer) faceYaw(root)
}

function setStatus(msg) { $('load-msg').textContent = msg }

function placeBannerAt(text, x, z, yaw = 0, dist = 1.7) {
  const banner = makeBanner(text)
  banner.position.set(
    x + Math.sin(yaw) * dist,
    4.4,
    z + Math.cos(yaw) * dist,
  )
  banner.rotation.y = yaw
  scene.add(banner)
  return banner
}

async function boot() {
  setStatus('Reading manifest…')
  const manifest = await fetch('./assets/manifest.json').then(r => r.json())
  const featuredSlugs = FEATURED.map(f => f.slug)
  const items = manifest.filter(isExhibit).filter(i => i.slug !== 'items/Truck' && !FOOD_HALL_SKIP.has(i.slug))
  // make sure featured slugs are present even if the filter missed them
  for (const s of featuredSlugs) {
    if (!items.some(i => i.slug === s)) {
      const m = manifest.find(i => i.slug === s)
      if (m) items.unshift(m)
    }
  }
  const clusters = layoutClusters(items, featuredSlugs)

  const FLOOR = {
    people: { x: 0, z: 2.8, yaw: 0, cols: 3, spacing: 4.2 },
    line: { x: -12.2, z: -3.8, yaw: Math.PI / 4, cols: 6, spacing: 3.3 },
    ingredients: { x: 12, z: 8, yaw: -Math.PI / 4, cols: 6, spacing: 3.8, rowZ: 3.8 },
    chaos: { x: -17, z: -26, yaw: Math.PI / 4, cols: 2, spacing: 3.8 },
    service: { x: 4, z: -29, yaw: 0, cols: 3, spacing: 4.0, rowZ: 4.2 },
    storage: { x: -12, z: -34, yaw: Math.PI / 5, cols: 2, spacing: 5.4 },
    back: { x: 16, z: -31, yaw: 0, cols: 2, spacing: 4.5, rowZ: 4.6 },
  }
  const BOOTHS = {
    kitchen: { x: 0, z: -13 },
    front: { x: 22, z: -13 },
    textures: { x: -19.8, z: -12 },
    audio: { x: -16, z: -40 },
    posters: { x: -22.4, z: -12 },
    delivery: { x: 0, z: -52 },
  }

  const { minx, maxx, minz, maxz } = HALL

  try {
    setStatus('Loading soundboard…')
    soundboard = await createSoundboard({
      scene, player,
      x: BOOTHS.audio.x,
      z: BOOTHS.audio.z,
      facingY: Math.PI / 5,
    })
    placeBannerAt('Audio', BOOTHS.audio.x, BOOTHS.audio.z, Math.PI / 5)
    exhibits.push({
      slug: 'audio/Soundboard',
      label: 'Soundboard',
      caption: 'Soundboard',
      group: 'audio',
      x: BOOTHS.audio.x,
      z: BOOTHS.audio.z,
      size: { x: soundboard.width, y: soundboard.height, z: soundboard.depth },
    })
  } catch (err) {
    console.warn('[museum] soundboard skipped', err)
  }

  let loaded = 0
  const total = clusters.reduce((n, c) => n + c.items.length, 0)

  for (const cluster of clusters) {
    const plan = FLOOR[cluster.id] || { x: 0, z: 0, yaw: 0, cols: cluster.items.length, spacing: SPACING_X }
    const slots = clusterSlots(cluster.items.length, plan.x, plan.z, plan.yaw, plan)
    placeBannerAt(cluster.name, plan.x, plan.z, plan.yaw)

    for (let i = 0; i < cluster.items.length; i++) {
      const item = cluster.items[i]
      const slot = slots[i]
      setStatus(`Loading ${++loaded} / ${total}  —  ${item.label}`)
      try {
        const loadSlug = item.variantOf || item.slug
        const { root, data: loaderData } = await loader.load(loadSlug)
        const box = boundsOf(root)
        if (box.isEmpty()) continue
        let display = root
        if (loadSlug === 'ui/StaffMenu') {
          flipStaffMenuUVs(root)
          addStaffMenuWhiteBack(root)
        }
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
        if (loadSlug === 'items/LettuceHead') {
          try {
            await nestLettuceHead(root, loader)
          } catch (err) {
            console.warn('[museum] LettucePart nest skipped', err)
          }
        }
        if (loadSlug === 'items/Patty') restorePattyDisc(root)
        if (inferPickup(item.slug, item.label)) {
          foodProtos[item.slug] = root.clone(true)
          if (loadSlug === 'items/Patty') restorePattyDisc(foodProtos[item.slug])
        }
        const rec = placeOnPedestal(display, slot.x, slot.z, item, slot.yaw, loaderData)
        if (loadSlug === 'items/Fire') {
          setupFireSprite(display)
          pickInst.attach(display, { exhibit: rec }, 'fire')
        }
        if (FACE_PLAYER.has(loadSlug)) facePlayer.push(display)
      } catch (err) {
        console.warn('[museum] skip', item.slug, err)
      }
    }
  }

  exhibitSwitches = createSwitchSet({ player, instancer: pickInst })
  const switchRec = exhibits.find(e => e.slug === 'items/LightSwitch')
  if (switchRec) {
    exhibitSwitches.bind(switchRec.display, { label: 'Light switch', startOn: false })
  }

  try {
    const npc = await loader.load('mobs/Npc')
    hideTriggers(npc.root)
    npcProto = npc.root
    crowd = createCrowd({ scene, player, proto: npc.root, exhibits, count: 12, bubbles, bodies })
  } catch (err) {
    console.warn('[museum] NPC crowd skipped', err)
  }

  foodWorld = createFoodWorld({ scene, player, instancer: pickInst })

  try {
    setStatus('Loading texture samples…')
    placeBannerAt('Textures', (BOOTHS.textures.x + BOOTHS.posters.x) / 2, BOOTHS.posters.z, 0, 3.4)
    swatches = createSwatches({
      scene, player, foodWorld, pedestals,
      x: BOOTHS.textures.x, z: BOOTHS.textures.z, facingY: 0,
    })
    exhibits.push({
      slug: 'textures/Swatches',
      label: 'Textures',
      caption: 'Textures',
      group: 'textures',
      x: BOOTHS.textures.x,
      z: BOOTHS.textures.z,
      size: { x: swatches.width, y: swatches.height, z: swatches.depth },
    })
  } catch (err) {
    console.warn('[museum] texture swatches skipped', err)
  }

  try {
    setStatus('Loading poster kiosk…')
    posters = createPosters({
      scene, player, foodWorld,
      x: BOOTHS.posters.x, z: BOOTHS.posters.z,
    })
    exhibits.push({
      slug: 'ui/Posters',
      label: 'Posters',
      caption: 'Posters',
      group: 'textures',
      x: BOOTHS.posters.x,
      z: BOOTHS.posters.z,
      size: { x: posters.width, y: posters.height, z: posters.depth },
    })
  } catch (err) {
    console.warn('[museum] posters skipped', err)
  }

  try {
    setStatus('Loading food kiosk…')
    const knife = exhibits.find(e => e.slug === 'items/Knife')
    const yaw = knife ? knife.yaw : Math.PI / 4
    const along = 3.3
    const kx = knife ? knife.x + Math.cos(yaw) * along : -9.2
    const kz = knife ? knife.z - Math.sin(yaw) * along : -6.5
    foodKiosk = await createFoodKiosk({
      scene, player, foodProtos, pedestals, loader,
      nestLettuceHead: root => nestLettuceHead(root, loader),
      x: kx, z: kz, yaw,
    })
    placeBannerAt('Food', kx, kz, yaw)
    exhibits.push(foodKiosk.rec)
  } catch (err) {
    console.warn('[museum] food kiosk skipped', err)
  }

  const needFood = [
    'items/Patty', 'items/Bacon', 'items/BunTop', 'items/BunBottom',
    'items/LettuceHead', 'items/Lettuce', 'items/LettucePart',
    'items/Cheese', 'items/Tomato', 'items/Plate',
    'items/Knife', 'items/Spatula', 'items/FireExtinguisher', 'items/Fire',
    'items/Tip', 'items/NumberStand', 'ui/StaffMenu',
  ]
  let switchProto = null
  try {
    const sw = await loader.load('items/LightSwitch')
    hideTriggers(sw.root)
    switchProto = sw.root
  } catch (err) {
    console.warn('[museum] LightSwitch proto missing', err)
  }
  if (soundboard && switchProto && soundboard.mountLightSwitch) {
    soundboard.mountLightSwitch(switchProto)
  }
  if (exhibitSwitches && switchProto) {
    const hallCx = (minx + maxx) / 2
    daySwitchSpot = { x: hallCx - 7.45, z: maxz - 0.22 }
    exhibitSwitches.add({
      parent: scene,
      proto: switchProto,
      x: daySwitchSpot.x,
      y: SWITCH_Y,
      z: daySwitchSpot.z,
      inwardX: 0,
      inwardZ: -1,
      label: 'Day / night',
      startOn: true,
      invertPaddle: true,
      lookOn: 'Day · click for night',
      lookOff: 'Night · click for day',
      onToggle: setHallDay,
    })
  }
  for (const slug of needFood) {
    if (foodProtos[slug]) continue
    try {
      const extra = await loader.load(slug)
      if (slug === 'items/LettuceHead') {
        try { await nestLettuceHead(extra.root, loader) }
        catch (err) { console.warn('[museum] LettucePart nest skipped', err) }
      }
      if (slug === 'ui/StaffMenu') {
        // Same prep the pedestal pass did: the menu was authored mirrored.
        flipStaffMenuUVs(extra.root)
        addStaffMenuWhiteBack(extra.root)
      }
      foodProtos[slug] = extra.root
    } catch (err) {
      console.warn('[museum] food proto missing', slug, err)
    }
  }

  try {
    setStatus('Loading kitchen…')
    kitchen = await createKitchen({
      scene, player, foodWorld, foodProtos,
      getRats: () => rats,
      getFireWatch: () => fires,
      switchProto, labels, pickInst,
      x: BOOTHS.kitchen.x, z: BOOTHS.kitchen.z, facingY: 0,
    })
    exhibits.push({
      slug: 'kitchen/Kitchen',
      label: 'Kitchen',
      caption: 'Kitchen',
      group: 'kitchen',
      x: BOOTHS.kitchen.x,
      z: BOOTHS.kitchen.z,
      size: { x: kitchen.width, y: kitchen.height, z: kitchen.depth },
    })
    const kitchenSpots = [
      ['kitchen/Range', 'Range'],
      ['kitchen/Sink', 'Sink'],
      ['kitchen/Counter', 'Counter'],
      ['kitchen/Orders', 'Orders'],
      ['kitchen/Lights', 'KitchenLights'],
      ['kitchen/DishLights', 'DishLights'],
    ]
    for (const [slug, caption] of kitchenSpots) {
      const v = kitchen.viewSpot(caption)
      exhibits.push({
        slug, label: caption, caption, group: 'kitchen',
        x: v.look.x, z: v.look.z,
        size: { x: 2, y: 2, z: 2 },
      })
    }
  } catch (err) {
    console.warn('[museum] kitchen skipped', err)
  }

  try {
    setStatus('Loading front of house…')
    world = createWorld()
    front = await createFront({
      scene, player, foodWorld, foodProtos,
      npcProto, world, kitchen, switchProto, labels, bubbles, pickInst, bodies,
      getHands: () => hands,
      onPosOpen: () => { player.unlock() },
      x: BOOTHS.front.x, z: BOOTHS.front.z, facingY: 0,
    })
    posKiosk = front.posKiosk || null
    exhibits.push({
      slug: 'front/Front',
      label: 'Front',
      caption: 'Front',
      group: 'front',
      x: BOOTHS.front.x,
      z: BOOTHS.front.z,
      size: { x: front.width, y: front.height, z: front.depth },
    })
    const frontSpots = [
      ['front/Street', 'Street'],
      ['front/Door', 'Door'],
      ['front/Queue', 'Queue'],
      ['front/POS', 'Checkout'],
      ['front/Register', 'Register'],
      ['front/StaffMenu', 'StaffMenu'],
      ['front/NumberStand', 'NumberStand'],
      ['front/Staff', 'Staff'],
      ['front/Lights', 'Lights'],
      ['front/Window', 'Window'],
      ['front/Pass', 'Pass'],
      ['front/Back', 'Back'],
      ['front/Seat1', 'Seat1'],
      ['front/Seat2', 'Seat2'],
      ['front/Seat3', 'Seat3'],
      ['front/Seat4', 'Seat4'],
    ]
    for (const [slug, caption] of frontSpots) {
      const v = front.viewSpot(caption)
      exhibits.push({
        slug, label: caption, caption, group: 'front',
        x: v.look.x, z: v.look.z,
        size: { x: 2, y: 2, z: 2 },
      })
    }
  } catch (err) {
    console.warn('[museum] front of house skipped', err)
  }

  try {
    setStatus('Loading delivery truck…')
    placeBannerAt('Delivery', BOOTHS.delivery.x, BOOTHS.delivery.z, 0, 8.5)
    delivery = await createDelivery({
      scene, player, loader, foodWorld, foodProtos,
      x: BOOTHS.delivery.x, z: BOOTHS.delivery.z,
    })
    const rec = {
      slug: 'items/Truck',
      label: 'Truck',
      caption: 'Truck',
      group: 'items',
      x: BOOTHS.delivery.x,
      z: BOOTHS.delivery.z,
      size: delivery.size,
    }
    exhibits.push(rec)
    const ns = delivery.size
    const nativeStr = `native ${ns.x.toFixed(2)} × ${ns.y.toFixed(2)} × ${ns.z.toFixed(2)}`
    const lean = Math.PI / 4
    labels.place({
      text: rec.caption,
      sub: `${rec.group}  ·  ${nativeStr}`,
      kind: 'plaque',
      x: delivery.ramp.width * 0.5 + 0.82,
      y: Math.sin(lean) * 0.48 * 0.5 + 0.22,
      z: delivery.ramp.z1 + 0.35,
      pitch: -lean,
      parent: scene,
    })
  } catch (err) {
    console.warn('[museum] delivery truck skipped', err)
  }

  fires = createFireWatch({
    scene, player, foodWorld,
    getRats: () => rats,
    getHands: () => hands,
    fireProto: foodProtos['items/Fire'] || null,
    instancer: pickInst,
  })

  let armRoot = null
  let armPool = null
  try {
    const arm = await loader.load('heroes/Arm')
    armRoot = arm.root
    const vis = visualMesh(armRoot)
    armPool = vis ? createInstancePool({
      geometry: vis.geometry,
      material: vis.material.clone(),
      max: 24,
      scene,
      name: 'ArmInst',
    }) : null
    hands = createHands({
      scene, player, armProto: armRoot, armPool, foodWorld, exhibits, foodProtos,
      getRats: () => rats,
      fireWatch: fires,
      prepareBox: item => prepareClosedBox(item, {
        scene, player, foodWorld, foodProtos,
        boxTex: delivery?.boxTex || null,
      }),
      spawnSwatch: spec => swatches && swatches.take(spec),
      spawnPoster: spec => posters && posters.take(spec),
    })
    hands.setScale(FPS_ARM_SCALE)
  } catch (err) {
    console.warn('[museum] arms skipped', err)
  }

  try {
    const pl = await loader.load('heroes/Player')
    hideTriggers(pl.root)
    if (armRoot) {
      demoPlayers = createDemoPlayers({
        scene, player, playerProto: pl.root, armProto: armRoot, armPool, bodies,
        x: 0, z: 7.5, yaw: -Math.PI / 2,
      })
      demoPlayers.setScale(DEMO_ARM_SCALE)
      const lead = demoPlayers.players[0]
      exhibits.push({
        slug: 'heroes/Player',
        caption: 'Player',
        label: 'Player',
        group: 'heroes',
        virtual: true,
        x: lead.body.position.x,
        z: lead.body.position.z,
        display: lead.body,
        size: { x: 1, y: 2, z: 1 },
      })
      const demoArmsRec = {
        slug: 'heroes/DemoArm',
        caption: 'Player arms',
        label: 'Player arms',
        group: 'heroes',
        virtual: true,
        editMul: DEMO_ARM_MUL,
        x: lead.body.position.x,
        z: lead.body.position.z,
        display: lead.left.object,
        size: { x: 1, y: 1, z: 1 },
      }
      exhibits.push(demoArmsRec)
      for (const d of demoPlayers.players) {
        for (const arm of [d.left, d.right]) {
          arm.object.userData.exhibit = demoArmsRec
          arm.object.userData.demoPlayer = d
          arm.object.traverse(o => {
            o.userData.exhibit = demoArmsRec
            o.userData.demoPlayer = d
          })
        }
      }
      if (lead.badge) {
        const badgeRec = {
          slug: 'heroes/NameTag',
          caption: 'Name badge',
          label: 'Name badge',
          group: 'heroes',
          virtual: true,
          kind: 'badge',
          editMul: 1,
          x: lead.body.position.x,
          z: lead.body.position.z,
          display: lead.badge,
          size: { x: 0.2, y: 0.12, z: 0.04 },
          targets: () => demoPlayers.players.map(d => d.badge).filter(Boolean),
        }
        exhibits.push(badgeRec)
        for (const d of demoPlayers.players) {
          if (!d.badge) continue
          d.badge.traverse(o => {
            o.userData.exhibit = badgeRec
            o.userData.editRoot = d.badge
            o.userData.demoPlayer = d
          })
        }
        const field = demoPlayers.badgeField
        if (field && field.mesh) {
          field.mesh.userData.exhibit = badgeRec
          for (const row of field.byInstance) {
            if (!row) continue
            row.exhibit = badgeRec
            row.editRoot = row.demo && row.demo.badge
          }
        }
      }
    }
  } catch (err) {
    console.warn('[museum] demo players skipped', err)
  }

  const armRec = exhibits.find(e => e.slug === 'heroes/Arm')
  if (armRec) armRec.editMul = ARM_SCALE

  try {
    const rat = await loader.load('mobs/Rat')
    hideTriggers(rat.root)
    rats = createRatDen({ scene, player, ratProto: rat.root, foodWorld })
    const lean = Math.PI / 4
    const plaqueY = Math.sin(lean) * 0.48 * 0.5 + 0.22
    ;(rats.holes || []).forEach((h, i) => {
      const yaw = h.facing
      // Into the hall a little, then to the viewer's right so the opening stays clear.
      const out = 0.72
      const side = 1.28
      const x = h.x + Math.sin(yaw) * out + Math.cos(yaw) * side
      const z = h.z + Math.cos(yaw) * out - Math.sin(yaw) * side
      labels.place({
        text: 'Rat hole',
        sub: 'mobs · steal dropped food',
        kind: 'plaque',
        x, y: plaqueY, z, yaw, pitch: -lean,
        parent: scene,
      })
      exhibits.push({
        slug: i ? `mobs/RatHole${i + 1}` : 'mobs/RatHole',
        label: 'Rat hole',
        caption: 'Rat hole',
        group: 'mobs',
        x, z, yaw,
        size: { x: 1.45, y: 0.4, z: 0.4 },
      })
    })
  } catch (err) {
    console.warn('[museum] rats skipped', err)
  }

  if (pedestals) pedestals.finalize()
  labels.finalize()

  setStatus('')
  $('loader').dataset.ready = '1'
  $('loader').style.display = 'none'

  window.__museum = {
    scene, camera: player.camera, renderer, player, exhibits, crowd, skybox,
    foodWorld, hands, rats, demoPlayers, soundboard, delivery, scaler, swatches,
    posters, foodKiosk, posKiosk, kitchen, front, world, fires, fpsOverlay,
    teleport, enter, pause, flags,
    dbg: harness.dbg,
    pose: harness.pose,
  }
  window.dbg = harness.dbg
  window.pose = harness.pose
  window.flags = flags
  console.log('[museum] ready', exhibits.length, 'exhibits — dbg.help() / pose.help() / flags.help()')
}

let frames = 0
let lastRaf = 0
let playing = false
let lookName = ''

function teleport(slug) {
  if (daySwitchSpot && /^(DayNight|Day\/night|hall\/Day)$/i.test(slug)) {
    player.spawn(daySwitchSpot.x, 0, daySwitchSpot.z - 1.8, 180)
    return 'DayNight'
  }
  if (soundboard && /^(Soundboard|Audio|AudioLights|audio\/(Soundboard|Lights))$/i.test(slug)) {
    const wantLights = /light/i.test(slug)
    const v = soundboard.viewSpot(wantLights ? 'Lights' : undefined)
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return wantLights ? 'AudioLights' : 'Soundboard'
  }
  if (rats && /^(RatHole|MouseHole|Hole|mobs\/RatHole)/i.test(String(slug))) {
    const holes = rats.holes || []
    const n = parseInt(String(slug).replace(/\D/g, ''), 10)
    const h = holes[Math.max(0, (n || 1) - 1)] || holes[0]
    if (!h) return null
    const yaw = h.facing
    player.spawn(h.x + Math.sin(yaw) * 2.2, 0, h.z + Math.cos(yaw) * 2.2, 0)
    player.lookAt(h.x, 0.4, h.z)
    return 'Rat hole'
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
  if (foodKiosk) {
    const q = String(slug)
    const picked = foodKiosk.select(q)
    if (picked || /^(Food|Ingredients|items\/FoodKiosk)$/i.test(q)) {
      const v = foodKiosk.viewSpot()
      player.spawn(v.stand.x, 0, v.stand.z, 0)
      player.lookAt(v.look.x, v.look.y, v.look.z)
      return foodKiosk.current().caption
    }
  }
  if (posKiosk && /^(POS|Pos|Order computer|ui\/POS)$/i.test(slug)) {
    const v = posKiosk.viewSpot()
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return 'POS'
  }
  if (kitchen && /^(Kitchen|Range|Grill|Cooktop|Sink|Dish|Counter|Prep|Orders|Board|KitchenLights|DishLights|kitchen\/)/i.test(slug)) {
    const name = String(slug).split('/').pop()
    const v = kitchen.viewSpot(name)
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return v.label
  }
  if (front && /^(Front|Street|Door|Queue|Register|Checkout|Staff|Window|Pass|Back|NumberStand|Lights|Switch|Seat\d|Table\d|front\/)/i.test(slug)) {
    const name = String(slug).split('/').pop()
    const v = front.viewSpot(name)
    player.spawn(v.stand.x, 0, v.stand.z, 0)
    player.lookAt(v.look.x, v.look.y, v.look.z)
    return v.label
  }
  const e = exhibits.find(x => x.slug === slug || x.label === slug || x.caption === slug)
  if (!e) return null
  const longest = Math.max(e.size?.x || 0, e.size?.y || 0, e.size?.z || 0, 0.4)
  const back = Math.min(4.2, Math.max(1.55, longest * 1.7 + 1.15))
  const yaw = e.yaw || 0
  player.spawn(e.x + Math.sin(yaw) * back, 0, e.z + Math.cos(yaw) * back, 0)
  player.lookAt(e.x, PEDESTAL_H + Math.min((e.size?.y || 2) * 0.45, 1.5), e.z)
  return e.caption || e.label
}

function dumpExtras() {
  return {
    playing,
    holding: hands?.holdingLabel() || '',
    spray: hands?.dumpSpray?.() || null,
    fires: fires?.dump?.() || [],
    playerOnFire: !!fires?.playerOnFire,
    food: (foodWorld?.items || []).map(i => ({
      type: i.type, kind: i.kind || 'food', contents: i.contents || null, opened: !!i.opened,
      pos: { x: +i.position.x.toFixed(2), y: +i.position.y.toFixed(2), z: +i.position.z.toFixed(2) },
      held: !!i.held, onFloor: !!i.onFloor, stolen: !!i.stolen,
      onFire: !!i.onFire, planted: !!i.planted,
      overcooked: +(i.overcooked || 0).toFixed(2),
      ashTime: +(i.ashTime || 0).toFixed(2),
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
    axes: scaler.axes,
    scales: scaler.dump(),
    badges: demoPlayers?.badgeDump?.() || [],
    armScale: hands?.armScale ?? 1,
    front: front?.dump() || null,
    sky: skybox ? {
      ...skybox.dump(),
      hemi: hallLit ? +hallLit.hemi.intensity.toFixed(3) : 0,
      key: hallLit ? +hallLit.key.intensity.toFixed(3) : 0,
      fill: hallLit ? +hallLit.fill.intensity.toFixed(3) : 0,
    } : null,
  }
}

const harness = installHarness({
  scene, renderer, loader, player,
  getExhibits: () => exhibits,
  teleport,
  dumpExtras,
  extraDbg: { scaler, requestDrawCensus, get lastDrawCensus() { return lastDrawCensus } },
  hudSelectors: ['#hud', '#fpsHud', '#look', '#cross', '#help', '#loader', '#dbgPanel', '#dbgToggle'],
})

function pageKiosks(dir) {
  if (posters) posters.tryTurn(dir)
  if (swatches && swatches.tryTurn) swatches.tryTurn(dir)
  if (foodKiosk && foodKiosk.tryTurn) foodKiosk.tryTurn(dir)
}

function tick(dt) {
  player.update(dt)
  const handsUp = player.leftHand || player.rightHand
  if (scaler.tool === 'hand' && !handsUp) {
    const dir = player.fire2Down ? -1 : player.fire1Down ? 1 : (player.wheelDir || 0)
    if (dir) pageKiosks(dir)
  }
  if (soundboard) {
    soundboard.update(dt)
    if (scaler.tool === 'hand' && (player.fire1Down || player.fire2Down)) {
      soundboard.tryPress()
      if (posKiosk && !posKiosk.isOpen) posKiosk.tryPress()
      if (front && !front.overlayOpen) front.tryPress()
      if (kitchen) kitchen.tryPress()
      if (exhibitSwitches) exhibitSwitches.tryPress()
    }
  } else if (scaler.tool === 'hand' && (player.fire1Down || player.fire2Down)) {
    if (posKiosk && !posKiosk.isOpen) posKiosk.tryPress()
    if (front && !front.overlayOpen) front.tryPress()
    if (kitchen) kitchen.tryPress()
    if (exhibitSwitches) exhibitSwitches.tryPress()
  }
  if (hands && !posKiosk?.isOpen && !front?.overlayOpen) {
    hands.update(dt, { grab: scaler.tool === 'hand', right: scaler.tool === 'hand' })
  }
  if (foodWorld) foodWorld.update(dt, harness.time.T)
  if (rats) rats.update(dt, harness.time.T)
  if (crowd) crowd.update(dt, harness.time.T)
  if (demoPlayers) demoPlayers.update(dt)
  if (kitchen) kitchen.update(dt)
  if (front) front.update(dt, harness.time.T)
  if (exhibitSwitches) exhibitSwitches.update(dt)
  if (fires) fires.update(dt)
  if (fireSprites.length || facePlayer.length) updateFireSprites(dt)
  if (bubbles) bubbles.billboard(player.camera)
  pickInst.syncAll()
  bodies.syncAll()
  if (skybox) skybox.update(dt)
}

function applySize() {
  const w = innerWidth, h = innerHeight
  if (w < 2 || h < 2) return false
  player.camera.aspect = w / h
  player.camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  harness.poser.resize()
  return true
}

const _drawFrustum = new THREE.Frustum()
const _drawProj = new THREE.Matrix4()
let drawCensusWanted = false
let drawCensusResolve = null
let lastDrawCensus = null

function meshDrawLabel(o) {
  if (o.name) return o.name
  let p = o.parent
  while (p && p !== scene) {
    if (p.name) return p.name + '/' + o.type
    p = p.parent
  }
  return (o.geometry && o.geometry.type) || o.type || '(unnamed)'
}

function censusDrawn(root, camera, useFrustum) {
  if (useFrustum && camera) {
    _drawProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    _drawFrustum.setFromProjectionMatrix(_drawProj)
  }
  const byName = new Map()
  function add(o) {
    const name = meshDrawLabel(o)
    let g = byName.get(name)
    if (!g) {
      g = { name, count: 0, instances: 0, type: o.type }
      byName.set(name, g)
    }
    g.count++
    g.instances += o.isInstancedMesh ? (o.count | 0) : 1
  }
  function walk(o, vis) {
    const on = vis && o.visible !== false
    if (!on) return
    if (o.isMesh || o.isInstancedMesh || o.isSprite || o.isLine || o.isPoints) {
      const drawn = !useFrustum || o.frustumCulled === false || _drawFrustum.intersectsObject(o)
      if (drawn) add(o)
    }
    const kids = o.children
    for (let i = 0; i < kids.length; i++) walk(kids[i], on)
  }
  walk(root, true)
  const groups = [...byName.values()].sort((a, b) =>
    b.count - a.count || b.instances - a.instances || a.name.localeCompare(b.name))
  const info = renderer.info.render
  return {
    calls: info.calls,
    triangles: info.triangles,
    meshes: groups.reduce((n, g) => n + g.count, 0),
    groups,
  }
}

function requestDrawCensus() {
  drawCensusWanted = true
  return new Promise(resolve => { drawCensusResolve = resolve })
}

function render() {
  applyFlags(scene)
  if (harness.poser.active) harness.poser.render()
  else renderer.render(scene, player.camera)
  if (!drawCensusWanted) return
  drawCensusWanted = false
  const posing = !!(harness.poser && harness.poser.active)
  lastDrawCensus = censusDrawn(scene, player.camera, !posing)
  console.table(lastDrawCensus.groups)
  console.log('[dbg.draws]', lastDrawCensus.calls, 'calls ·', lastDrawCensus.meshes, 'meshes')
  if (drawCensusResolve) {
    drawCensusResolve(lastDrawCensus)
    drawCensusResolve = null
  }
}

harness.bind({ tick, render })

function currentLook() {
  const scaleLook = scaler.lookLabel()
  if (scaleLook) return scaleLook
  const audioLook = soundboard?.lookLabel()
  if (audioLook) return audioLook
  const posterLook = posters?.lookLabel()
  if (posterLook) return posterLook
  const swatchLook = swatches?.lookLabel()
  if (swatchLook) return swatchLook
  const foodLook = foodKiosk?.lookLabel()
  if (foodLook) return foodLook
  const posLook = posKiosk?.lookLabel()
  if (posLook) return posLook
  const kitchenLook = kitchen?.lookLabel()
  if (kitchenLook) return kitchenLook
  const frontLook = front?.lookLabel()
  if (frontLook) return frontLook
  const switchLook = exhibitSwitches?.lookLabel()
  if (switchLook) return switchLook
  raycaster.setFromCamera(ndc, player.camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    const inst = (h.object.userData.byInstance && h.instanceId != null)
      ? h.object.userData.byInstance[h.instanceId] : null
    const npc = h.object.userData.npc || (inst && inst.npc)
    if (npc) return npc.notice ? `${npc.skin} · looking at you` : `${npc.skin} · ${npc.want}`
    if (h.object.userData.frontNpc || (inst && inst.frontNpc)) {
      const obj = h.object.userData.frontNpc ? h.object : (inst && inst.object)
      return (obj && obj.userData.want) || (inst && inst.skin) || 'customer'
    }
    const demo = h.object.userData.demoPlayer || (inst && inst.demo)
    if (demo) {
      return demo.spec.skin ? demo.spec.name + ' · ' + demo.spec.skin : demo.spec.name
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
    if (rec) return rec.pickup ? (rec.caption || rec.label) + ' · take a copy' : (rec.caption || rec.label)
    const bin = h.object.userData.swatchBin
    if (bin) return bin.caption + ' · take a swatch'
  }
  return ''
}

renderer.setAnimationLoop(() => {
  const now = performance.now()
  const dtMs = lastRaf ? now - lastRaf : 16.7
  lastRaf = now
  fpsOverlay.sample(Math.max(1, dtMs))

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
  if ($('s-tool')) {
    $('s-tool').textContent = scaler.tool === 'scale'
      ? 'scale gun'
      : scaler.tool === 'transform' ? 'transform gun' : 'hand'
  }
  if ($('help')) {
    $('help').textContent = scaler.tool === 'scale'
      ? 'SCALE GUN  ·  aim at an exhibit (or a player badge)  ·  hold LMB, drag right = bigger / left = smaller  ·  0 empty hands'
      : scaler.tool === 'transform'
        ? `TRANSFORM GUN  ·  axes ${['x', 'y', 'z'].filter(k => scaler.axes[k]).map(k => k.toUpperCase()).join(' ') || 'none'}  ·  tap X/Y/Z to lock  ·  aim, hold LMB, drag  ·  0 empty`
        : 'WASD move · Space jump · Q/E hands · 0 empty · 1 scale gun · 2 transform gun · click grab/drop · Shift run · Esc release mouse'
  }

  render()
  const draws = renderer.info.render.calls
  if ($('s-draws') && $('s-draws').textContent !== String(draws)) {
    $('s-draws').textContent = String(draws)
  }
  if ($('s-meshes')) {
    let meshes = 0
    scene.traverse(o => {
      if (!o.isMesh || !o.visible) return
      let p = o.parent
      while (p) {
        if (!p.visible) return
        p = p.parent
      }
      meshes++
    })
    if ($('s-meshes').textContent !== String(meshes)) {
      $('s-meshes').textContent = String(meshes)
    }
  }
  if (++frames >= 20) {
    frames = 0
    harness.refreshPanel()
  }
})

function enter() {
  playing = true
  player.enabled = true
  if ($('loader').dataset.ready === '1') $('loader').style.display = 'none'
  $('hud').style.display = 'block'
  $('fpsHud').style.display = 'flex'
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

renderer.domElement.addEventListener('click', () => {
  if (!playing) enter()
  else if (!player.locked) player.requestLock(renderer.domElement)
})
addEventListener('keydown', e => {
  if (e.target && e.target.closest('input, textarea, [contenteditable]')) return
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault()
  }
})
addEventListener('resize', applySize)
applySize()

boot().catch(err => {
  console.error(err)
  setStatus('Failed: ' + err.message)
})
