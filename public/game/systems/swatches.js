// Texture sample booth: record-store bins of albedo swatches. Grab a card
// (the stack stays), look at it in-hand, drop it on the floor.

import * as THREE from 'three'
import { POSTERS } from './posters.js'

const CARD_W = 0.46
const CARD_H = 0.58
const CARD_T = 0.012
const STACK = 7
const PRESS_RANGE = 5.5

const BOOTH_W = 12.6
const BOOTH_D = 8.2
const BOOTH_H = 3.15
const WALL_T = 0.09
const POST = 0.14
const COLS = 12

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
  entry('Palette', 'Cream', './assets/textures/enviro/Cream.png'),
  entry('Palette', 'Brown', './assets/textures/Brown.png'),
  entry('Palette', 'Grey', './assets/textures/Grey.png'),
  entry('Palette', 'GreyDark', './assets/textures/GreyDark.png'),
  entry('Palette', 'LightGrey', './assets/textures/LightGrey.png'),
  entry('Palette', 'Orange', './assets/textures/Orange.png'),
  entry('Palette', 'Green', './assets/textures/Green.png'),
  entry('Palette', 'DarkRed', './assets/textures/DarkRed.png'),
  entry('Palette', 'Feac', './assets/textures/Feac.png'),
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
  entry('Badges', 'Boss', './assets/textures/badges/Boss.png'),
  entry('Badges', 'Citizen', './assets/textures/badges/Citizen.png'),
  entry('Badges', 'Family', './assets/textures/badges/Family.png'),
  entry('Badges', 'Mayor', './assets/textures/badges/Mayor.png'),
  entry('Badges', 'President', './assets/textures/badges/President.png'),
  entry('Badges', 'Worker', './assets/textures/badges/Worker.png'),
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

function fasciaTex() {
  return canvasTexture(1024, 192, (g, w, h) => {
    g.fillStyle = '#1c1814'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.font = '700 72px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('TEXTURES', w / 2, 88)
    g.fillStyle = '#c4a574'
    g.font = '28px ui-sans-serif, system-ui, sans-serif'
    g.fillText('pick a swatch  ·  look  ·  drop it on the floor', w / 2, 148)
  })
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
    map, color: 0xffffff, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide,
  })
  const face = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H), mat)
  face.castShadow = face.receiveShadow = true
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W + 0.012, CARD_T * 0.6, CARD_H + 0.012),
    new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 0.7 }),
  )
  rim.position.y = -CARD_T * 0.2
  g.add(rim, face)
  return g
}

function stamp(object, item) {
  object.userData.food = item
  object.userData.swatch = item
  object.traverse(o => { o.userData.food = item; o.userData.swatch = item })
}

export function createSwatches({
  scene, player, foodWorld,
  x = 0, y = 0, z = 0, facingY = 0,
} = {}) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: 0.82, metalness: 0.04 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.88 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.45, metalness: 0.25 })

  const object = new THREE.Group()
  object.name = 'TextureBooth'
  object.position.set(x, y, z)
  object.rotation.y = facingY

  const kitchenMap = loadMap('./assets/entities/tiles/KitchenFloor.png')
  kitchenMap.repeat.set(BOOTH_W / 1.4, BOOTH_D / 1.4)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(BOOTH_W - 0.16, BOOTH_D - 0.16),
    new THREE.MeshStandardMaterial({ map: kitchenMap, roughness: 0.92 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.012
  floor.receiveShadow = true
  object.add(floor)

  const diningMap = loadMap('./assets/textures/enviro/DiningFloor.png')
  diningMap.repeat.set(2.2, 1.4)
  const tryIt = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.6),
    new THREE.MeshStandardMaterial({ map: diningMap, roughness: 0.9 }),
  )
  tryIt.rotation.x = -Math.PI / 2
  tryIt.position.set(BOOTH_W * 0.22, 0.018, BOOTH_D * 0.22)
  tryIt.receiveShadow = true
  object.add(tryIt)

  const backZ = -BOOTH_D / 2 + WALL_T / 2
  const back = new THREE.Mesh(new THREE.BoxGeometry(BOOTH_W, BOOTH_H, WALL_T), wallMat)
  back.position.set(0, BOOTH_H / 2, backZ)
  back.receiveShadow = true
  object.add(back)
  for (const sign of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, BOOTH_H, BOOTH_D), wallMat)
    wall.position.set(sign * (BOOTH_W / 2 - WALL_T / 2), BOOTH_H / 2, 0)
    wall.receiveShadow = wall.castShadow = true
    object.add(wall)
  }
  const frontZ = BOOTH_D / 2 - POST / 2
  for (const sign of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(POST, BOOTH_H, POST), metalMat)
    post.position.set(sign * (BOOTH_W / 2 - POST / 2), BOOTH_H / 2, frontZ)
    post.castShadow = true
    post.raycast = () => {}
    object.add(post)
  }
  const fasciaH = 0.5
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(BOOTH_W, fasciaH, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.6 }),
  )
  fascia.position.set(0, BOOTH_H - fasciaH / 2, BOOTH_D / 2 - 0.04)
  fascia.castShadow = true
  fascia.raycast = () => {}
  object.add(fascia)
  const fasciaFace = new THREE.Mesh(
    new THREE.PlaneGeometry(BOOTH_W - 0.08, fasciaH - 0.08),
    new THREE.MeshBasicMaterial({ map: fasciaTex() }),
  )
  fasciaFace.position.set(0, BOOTH_H - fasciaH / 2, BOOTH_D / 2 + 0.025)
  fasciaFace.raycast = () => {}
  object.add(fasciaFace)

  const hw = BOOTH_W / 2, hd = BOOTH_D / 2
  player.addCollider({ x: x - hw, z: z - hd }, { x: x - hw + WALL_T + 0.08, z: z + hd })
  player.addCollider({ x: x + hw - WALL_T - 0.08, z: z - hd }, { x: x + hw, z: z + hd })
  player.addCollider({ x: x - hw, z: z - hd }, { x: x + hw, z: z - hd + WALL_T + 0.08 })

  const cols = COLS
  const gapX = 1.04
  const gapZ = 0.86
  const x0 = -((cols - 1) * gapX) / 2
  // First catalog entries (tiles) at the open front so ground samples are
  // the first stacks you walk up to.
  const z0 = BOOTH_D / 2 - 1.15

  function makeBin(spec, bx, bz) {
    const bin = new THREE.Group()
    bin.position.set(bx, 0, bz)
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.28, 0.62),
      wood,
    )
    crate.position.y = 0.14
    crate.castShadow = crate.receiveShadow = true
    bin.add(crate)
    const well = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.22, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 0.9 }),
    )
    well.position.y = 0.22
    bin.add(well)

    const map = loadMap(spec.file)
    if (spec.tile) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      map.repeat.set(2, 2)
    } else {
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
      map.repeat.set(1, 1)
    }
    for (let i = 0; i < STACK; i++) {
      const card = makeCard(map, spec.caption)
      card.rotation.x = -0.18
      card.position.set((i - STACK / 2) * 0.008, 0.34 + i * 0.011, 0.02 - i * 0.006)
      card.userData.swatchBin = spec
      card.traverse(o => { o.userData.swatchBin = spec })
      bin.add(card)
    }
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.15),
      new THREE.MeshBasicMaterial({ map: labelTex(spec.caption) }),
    )
    tag.position.set(0, 0.08, 0.34)
    tag.userData.swatchBin = spec
    bin.add(tag)
    object.add(bin)
    return bin
  }

  SWATCHES.forEach((spec, i) => {
    const c = i % cols
    const r = (i / cols) | 0
    makeBin(spec, x0 + c * gapX, z0 - r * gapZ)
  })

  scene.add(object)

  function take(spec) {
    const map = loadMap(spec.file)
    if (spec.tile) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      map.repeat.set(2, 2)
    } else {
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
    }
    const card = makeCard(map, spec.caption)
    player.camera.getWorldPosition(card.position)
    card.position.y -= 0.15
    scene.add(card)
    const item = {
      kind: 'swatch',
      type: spec.caption,
      slug: 'textures/' + spec.id,
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

  function lookLabel() {
    const hits = []
    return ''
  }

  function viewSpot() {
    return {
      stand: { x, z: z + BOOTH_D / 2 + 2.2 },
      look: { x, y: 1.4, z },
    }
  }

  return {
    object, take, viewSpot, lookLabel,
    samples: SWATCHES,
    width: BOOTH_W,
    depth: BOOTH_D,
    height: BOOTH_H,
  }
}
