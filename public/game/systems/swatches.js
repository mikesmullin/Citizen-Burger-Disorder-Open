// Texture sample booth: one albedo card per shared mocha pedestal.
// Grab clones a card into the hand; the stand stays.

import * as THREE from 'three'
import { POSTERS } from './posters.js'
import { PEDESTAL_W, PEDESTAL_H, makePedestalHit } from './pedestals.js'

const CARD_W = 0.46
const CARD_H = 0.58
const CARD_T = 0.012
// Plane in XY, +Z = front. -45° around X: texture up, low edge toward +Z.
const CARD_TILT = Math.PI / 4
const CARD_Y = PEDESTAL_H + 0.06 + (CARD_H / 2) * Math.sin(CARD_TILT)

const BOOTH_H = 2.2
const STACK_N = 7
const STACK_GAP = 0.034
const PRESS_RANGE = 6.5

const CARD_GEO = new THREE.PlaneGeometry(CARD_W, CARD_H)
const TAG_GEO = new THREE.PlaneGeometry(0.62, 0.15)

export const BOOTH_W = PEDESTAL_W + 0.4
export const BOOTH_D = PEDESTAL_W + 0.8

function pretty(id) {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2')
}

function entry(group, id, file, tile = false) {
  return { group, id, file, caption: pretty(id), tile }
}

// One stack per PNG under public/assets (tiles + textures). Keep in sync
// with `find public/assets -name '*.png'`.
export const SWATCHES = [
  entry('Tiles', 'KitchenFloor', './assets/entities/tiles/KitchenFloor.png', true),
  entry('Tiles', 'MuseumFloor', './assets/entities/tiles/MuseumFloor.png', true),
  entry('Tiles', 'DiningFloor', './assets/textures/enviro/DiningFloor.png', true),
  entry('Kitchen', 'KitchenWalls', './assets/textures/enviro/KitchenWalls.png'),
  entry('Kitchen', 'KitchenRoof', './assets/textures/enviro/KitchenRoof.png'),
  entry('Dining', 'DiningFill', './assets/textures/enviro/DiningFill.png'),
  entry('Dining', 'DiningUpperWall', './assets/textures/enviro/DiningUpperWall.png'),
  entry('Dining', 'DiningLowerWall', './assets/textures/enviro/DiningLowerWall.png'),
  entry('Dining', 'DiningLowerWallLight', './assets/textures/enviro/DiningLowerWallLight.png'),
  entry('Furniture', 'Bench', './assets/textures/enviro/Bench.png'),
  entry('Furniture', 'ChairFabric', './assets/textures/enviro/ChairFabric.png'),
  entry('Furniture', 'TableMain', './assets/textures/enviro/TableMain.png'),
  entry('Furniture', 'Tabletop', './assets/textures/Tabletop.png'),
  entry('Furniture', 'Wood', './assets/textures/Wood.png'),
  entry('Food', 'Bacon', './assets/textures/Bacon.png'),
  entry('Food', 'Bread', './assets/textures/Bread.png'),
  entry('Food', 'BunBottom', './assets/textures/BunBottom.png'),
  entry('Food', 'BunTop', './assets/textures/BunTop.png'),
  entry('Food', 'Cheese', './assets/textures/Cheese.png'),
  entry('Food', 'Lettuce', './assets/textures/Lettuce.png'),
  entry('Food', 'LettuceHead', './assets/textures/LettuceHead.png'),
  entry('Food', 'Tomato', './assets/textures/Tomato.png'),
  entry('Food', 'Plate', './assets/textures/Plate.png'),
  entry('Food', 'PlateDirty', './assets/textures/PlateDirty.png'),
  entry('Food', 'BaconCooked', './assets/textures/BaconCooked.png'),
  entry('Food', 'BaconCooked2', './assets/textures/BaconCooked2.png'),
  entry('Props', 'Box', './assets/textures/Box.png'),
  entry('Props', 'Fire', './assets/textures/Fire.png'),
  entry('Props', 'FireExtinguisher', './assets/textures/FireExtinguisher.png'),
  entry('Props', 'Rat', './assets/textures/Rat.png'),
  entry('Props', 'Truck', './assets/textures/Truck.png'),
  entry('UI', 'Arrow', './assets/textures/ui/Arrow.png'),
  entry('UI', 'Bubble', './assets/textures/ui/Bubble.png'),
  entry('UI', 'Burger', './assets/textures/ui/Burger.png'),
  entry('UI', 'Family', './assets/textures/ui/Family.png'),
  entry('UI', 'SpeechBubble', './assets/textures/ui/SpeechBubble.png'),
  entry('UI', 'StaffMenu', './assets/textures/ui/StaffMenu.png'),
  entry('Skins', 'Npc1', './assets/textures/skins/Npc1.png'),
  entry('Skins', 'Npc2', './assets/textures/skins/Npc2.png'),
  entry('Skins', 'Npc3', './assets/textures/skins/Npc3.png'),
  entry('Skins', 'Npc4', './assets/textures/skins/Npc4.png'),
  entry('Skins', 'Npc5', './assets/textures/skins/Npc5.png'),
  entry('Skins', 'Npc6', './assets/textures/skins/Npc6.png'),
  entry('Skins', 'Staff1', './assets/textures/skins/Staff1.png'),
  entry('Skins', 'Staff2', './assets/textures/skins/Staff2.png'),
  entry('Skins', 'Staff3', './assets/textures/skins/Staff3.png'),
  entry('Skins', 'Staff4', './assets/textures/skins/Staff4.png'),
  entry('Skins', 'Staff5', './assets/textures/skins/Staff5.png'),
  entry('Skins', 'Staff6', './assets/textures/skins/Staff6.png'),
  entry('Skins', 'Staff7', './assets/textures/skins/Staff7.png'),
  entry('Skins', 'Kritz', './assets/textures/skins/Kritz.png'),
  entry('Skins', 'Jorji', './assets/textures/skins/Jorji.png'),
  entry('Skins', 'CookServe', './assets/textures/skins/CookServe.png'),
  entry('Menu', 'Boss', './assets/textures/badges/Boss.png'),
  entry('Menu', 'Citizen', './assets/textures/badges/Citizen.png'),
  entry('Menu', 'Family', './assets/textures/badges/Family.png'),
  entry('Menu', 'Mayor', './assets/textures/badges/Mayor.png'),
  entry('Menu', 'President', './assets/textures/badges/President.png'),
  entry('Menu', 'Worker', './assets/textures/badges/Worker.png'),
  ...POSTERS.map(p => entry('Posters', p.id, p.file)),
]

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
    g.font = '600 36px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const t = text.length > 18 ? text.slice(0, 16) + '…' : text
    g.fillText(t, w / 2, h / 2 + 2)
  })
}

function loadMap(url) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function makeCard(map, caption) {
  const g = new THREE.Group()
  g.name = 'Swatch:' + caption
  const mat = new THREE.MeshStandardMaterial({
    map, color: 0xffffff, roughness: 0.78, metalness: 0.02, side: THREE.FrontSide,
  })
  const face = new THREE.Mesh(CARD_GEO, mat)
  face.castShadow = true
  g.add(face)
  return g
}

function stamp(object, item) {
  object.userData.food = item
  object.userData.swatch = item
  object.traverse(o => { o.userData.food = item; o.userData.swatch = item })
}

export function createSwatches({
  scene, player, foodWorld, pedestals,
  x = 0, y = 0, z = 0, facingY = 0,
} = {}) {
  const object = new THREE.Group()
  object.name = 'TextureBooth'
  object.position.set(x, y, z)
  object.rotation.y = facingY
  scene.add(object)
  object.updateMatrixWorld(true)

  if (pedestals) pedestals.place(x, z, facingY)
  makePedestalHit(object)
  const half = PEDESTAL_W / 2 + 0.06
  player.addCollider(
    { x: x - half, z: z - half },
    { x: x + half, z: z + half },
  )

  const maps = new Map()
  function mapFor(spec) {
    let t = maps.get(spec.file)
    if (!t) {
      t = loadMap(spec.file)
      if (spec.tile) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(2, 2)
      } else {
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
        t.repeat.set(1, 1)
      }
      maps.set(spec.file, t)
    }
    return t
  }

  let index = 0
  const n = SWATCHES.length
  const wrap = new THREE.Group()
  wrap.name = 'SwatchStack'
  object.add(wrap)

  const stackMat = new THREE.MeshStandardMaterial({
    color: 0xc4b496, roughness: 0.88, metalness: 0, side: THREE.FrontSide,
  })
  const dummy = new THREE.Object3D()
  const stack = new THREE.InstancedMesh(CARD_GEO, stackMat, STACK_N)
  stack.castShadow = true
  stack.raycast = () => {}
  for (let i = 0; i < STACK_N; i++) {
    const k = i + 1
    dummy.position.set(0, -k * 0.014, -k * STACK_GAP)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    stack.setMatrixAt(i, dummy.matrix)
  }
  stack.instanceMatrix.needsUpdate = true

  const top = makeCard(mapFor(SWATCHES[0]), SWATCHES[0].caption)
  top.add(stack)
  top.rotation.x = -CARD_TILT
  top.position.set(0, CARD_Y, 0)
  wrap.add(top)

  const tagMat = new THREE.MeshBasicMaterial({ map: labelTex(SWATCHES[0].caption), side: THREE.FrontSide })
  const tag = new THREE.Mesh(TAG_GEO, tagMat)
  tag.position.set(0, 0.55, PEDESTAL_W * 0.52 + 0.02)
  wrap.add(tag)

  function bind() {
    const spec = SWATCHES[index]
    const face = top.children.find(o => o.isMesh && !o.isInstancedMesh)
    if (face) {
      face.material.map = mapFor(spec)
      face.material.needsUpdate = true
    }
    top.name = 'Swatch:' + spec.caption
    tagMat.map = labelTex(spec.caption)
    tagMat.needsUpdate = true
    object.userData.swatchBin = spec
    object.traverse(o => { o.userData.swatchBin = spec })
  }
  bind()

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  function tryTurn(dir = 1) {
    if (!player.locked) return false
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return false
    cycle(dir)
    return true
  }

  function cycle(dir = 1) {
    index = (index + (dir < 0 ? -1 : 1) + n) % n
    bind()
  }

  function take(spec) {
    const s = spec || SWATCHES[index]
    const card = makeCard(mapFor(s), s.caption)
    player.camera.getWorldPosition(card.position)
    card.position.y -= 0.15
    scene.add(card)
    const item = {
      kind: 'swatch',
      type: s.caption,
      slug: 'textures/' + s.id,
      object: card,
      position: card.position,
      radius: 0.32,
      height: CARD_T + 0.02,
      held: false,
      stolen: null,
      opened: false,
      dropped: false,
      vel: new THREE.Vector3(),
      onFloor: false,
      foodBeenOnFloor: false,
      fromSpawner: null,
    }
    stamp(card, item)
    foodWorld.items.push(item)
    return item
  }

  function current() {
    return SWATCHES[index]
  }

  function lookLabel() {
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return ''
    return current().caption + '  ·  LMB / wheel↓ next  ·  RMB / wheel↑ prev  ·  grab a copy'
  }

  function viewSpot() {
    return {
      stand: { x, z: z + 2.4 },
      look: { x, y: 1.35, z },
    }
  }

  return {
    object, take, tryTurn, cycle, current, viewSpot, lookLabel,
    samples: SWATCHES,
    width: BOOTH_W,
    depth: BOOTH_D,
    height: BOOTH_H,
  }
}
