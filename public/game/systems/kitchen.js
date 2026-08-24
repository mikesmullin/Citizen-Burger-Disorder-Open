// Walk-in kitchen exhibit. Grill / oven / sink geometry lived in the lost
// testArea01 scene, not in prefabs — this rebuilds the galley from the
// original screenshots: prep counter, commercial range, hanging order
// board (menu-item burger sprites), and a dish pit through a yellow door.
// Rotated 90° CW from the first museum booth, then joined to the north of
// Front: prep on the north wall, grill on the pass, dish pit to the east.
// Floor is DiningFloor. Grill.cs cook() runs on food that lands on the range.

import * as THREE from 'three'
import { applyCookLook, isFood, cookTick } from './food.js'
import { createSwitchSet, SWITCH_Y, muteBoothShadows } from './lightSwitch.js'
import { createKit, addTiledFloor, WALL_T, WAINSCOT_T } from '../common/kit.js'
import { loadBuffer, getListener, safePlay } from '../common/audio.js'
import {
  BOOTH_W as FRONT_W,
  BOOTH_D as FRONT_D,
  PASS_INSET,
  PASS_X1,
  BACK_DOOR_X0,
  BACK_DOOR_X1,
} from './front.js'

// After 90° CW: original 6.4 × 14.6 (X × Z) → 14.6 × 6.4 (galley+dish × N–S).
export const BOOTH_W = 14.6
export const BOOTH_D = 6.4
export const BOOTH_H = 3.55
const GALLEY_W = 10.45
const DISH_W = 4.15
const COUNTER_D = 0.72
const COUNTER_Y = 0.92
const RANGE_W = 1.32
const RANGE_Y = 0.94

const MENU = ['Citizen', 'Family', 'Worker', 'President', 'Mayor', 'Boss']

// Table columns from ElementViewOrderOverview: 1–3 hold 2, table 4 holds 4.
const SAMPLE_TICKETS = [
  ['Mayor', 'Citizen'],
  ['President'],
  ['Worker', 'Boss'],
  ['Family', 'Citizen'],
]

function loadMap(url, { repeatX = 1, repeatY = 1, flipY = true } = {}) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.flipY = flipY
  if (repeatX !== 1 || repeatY !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeatX, repeatY)
  }
  return t
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('kitchen image ' + src))
    img.src = src
  })
}

function mat(color, { map = null, roughness = 0.78, metalness = 0.04 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, map, roughness, metalness,
  })
}



function makeLabel(text) {
  const map = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#c4a574'
    g.lineWidth = 6
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f0e6d4'
    g.font = '700 48px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, w / 2, h / 2 + 2)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.28),
    new THREE.MeshBasicMaterial({ map }),
  )
  m.raycast = () => {}
  return m
}

async function makeOrderScreen() {
  const sprites = {}
  await Promise.all(MENU.map(async name => {
    sprites[name] = await loadImage(`./assets/textures/badges/${name}.png`)
  }))
  const W = 1024
  const H = 640
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4

  function paint(columns) {
    const g = canvas.getContext('2d')
    g.fillStyle = '#111111'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#f7f7f4'
    g.fillRect(10, 10, W - 20, H - 20)

    const cols = 4
    const footerH = 88
    const headerH = 86
    const pad = 10
    const innerW = W - 20
    const colW = innerW / cols
    const bodyTop = 10 + headerH
    const bodyH = H - 20 - headerH - footerH

    for (let c = 0; c < cols; c++) {
      const x = 10 + c * colW
      g.fillStyle = '#1e4ea3'
      g.fillRect(x, 10, colW, headerH)
      g.strokeStyle = '#0a0a0a'
      g.lineWidth = 4
      g.strokeRect(x, 10, colW, headerH + bodyH)
      g.fillStyle = '#ffffff'
      g.font = '700 64px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(c + 1), x + colW / 2, 10 + headerH / 2)

      const tickets = columns[c] || []
      const slots = c === 3 ? 4 : 2
      const slotH = bodyH / slots
      tickets.forEach((name, i) => {
        const img = sprites[name]
        if (!img) return
        const sy = bodyTop + i * slotH
        const maxW = colW - pad * 2
        const maxH = slotH - pad * 2
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        g.drawImage(img, x + (colW - dw) / 2, sy + (slotH - dh) / 2, dw, dh)
      })
    }

    g.fillStyle = '#111111'
    g.fillRect(10, H - 10 - footerH, innerW, footerH)
    const half = innerW / 2
    g.fillStyle = '#f7f7f4'
    g.fillRect(18, H - 10 - footerH + 10, half - 20, footerH - 20)
    g.fillRect(10 + half + 8, H - 10 - footerH + 10, half - 20, footerH - 20)
    g.fillStyle = '#111111'
    g.font = 'italic 700 42px Georgia, "Times New Roman", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('ORDERS', 10 + half / 2, H - 10 - footerH / 2)
    g.fillText('DELIVERY', 10 + half + half / 2, H - 10 - footerH / 2)
    map.needsUpdate = true
  }

  paint(SAMPLE_TICKETS)
  return { map, paint }
}

export async function createKitchen({
  scene, player, foodWorld, foodProtos,
  getRats, getFireWatch, switchProto, labels, pickInst,
  x = 0, z = 0, facingY = 0,
} = {}) {
  const object = new THREE.Group()
  object.name = 'KitchenBooth'
  object.position.set(x, 0, z)
  object.rotation.y = facingY
  scene.add(object)

  const wallTex = loadMap('./assets/textures/enviro/KitchenWalls.png')
  const floorTex = loadMap('./assets/textures/enviro/DiningFloor.png')
  const topTex = loadMap('./assets/textures/enviro/TableMain.png')
  const greyTex = loadMap('./assets/textures/Grey.png')
  const darkTex = loadMap('./assets/textures/GreyDark.png')

  const wallMat = mat(0xffffff, { map: wallTex, roughness: 0.92 })
  const greyMat = mat(0xffffff, { map: greyTex, roughness: 0.7 })
  const darkMat = mat(0xffffff, { map: darkTex, roughness: 0.62, metalness: 0.08 })
  const topMat = mat(0xffffff, { map: topTex, roughness: 0.55 })
  const railMat = mat(0xd4a24c, { roughness: 0.5 })
  const frameMat = railMat
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x8ec4d4, roughness: 0.18, metalness: 0.12,
    transparent: true, opacity: 0.55,
  })

  const kit = createKit({ parent: object })
  function box(w, h, d, material, x, y, z) {
    kit.box(material, w, h, d, x, y, z)
  }

  // Front-local axes (+X east, +Z south). Origin is the Front booth origin
  // so the galley sits on the north side of the pass window.
  const frontHx = FRONT_W / 2
  const frontHz = FRONT_D / 2
  const winZ = -frontHz + PASS_INSET
  const kSouth = winZ
  const kNorth = winZ - BOOTH_D
  const kWest = -frontHx
  const partX = kWest + GALLEY_W
  const kEast = partX + DISH_W
  const kMidX = (kWest + kEast) / 2
  const kMidZ = (kNorth + kSouth) / 2
  const galleyMidX = (kWest + partX) / 2

  addTiledFloor(kit, {
    map: floorTex, w: BOOTH_W, d: BOOTH_D,
    x: kMidX, z: kMidZ, layer: 1,
  })
  kit.roof(BOOTH_W, BOOTH_D, kMidX, BOOTH_H, kMidZ)

  function putTag(text, x, y, z, extra = {}) {
    if (labels) {
      return labels.place({ text, kind: 'tag', x, y, z, parent: object, ...extra })
    }
    const m = makeLabel(text)
    if (extra.sx || extra.sy) m.scale.set(extra.sx || 1, extra.sy || 1, 1)
    m.position.set(x, y, z)
    if (extra.yaw) m.rotation.y = extra.yaw
    object.add(m)
    return m
  }

  const backDoorX0 = BACK_DOOR_X0
  const backDoorX1 = BACK_DOOR_X1
  const doorH = 2.42
  // Original door sat on the east of the E–W partition; 90° CW puts it on
  // the south of the N–S partition, next to the grill.
  const doorZ0 = kMidZ + 0.35
  const doorZ1 = kMidZ + 2.15
  const doorW = doorZ1 - doorZ0
  const doorZ = (doorZ0 + doorZ1) / 2

  function solidWall(w, d, px, pz, alongX) {
    const tw = alongX ? w : WALL_T
    const td = alongX ? WALL_T : d
    box(tw, BOOTH_H, td, wallMat, px, BOOTH_H / 2, pz)
  }

  // North wall with the back door (staff corridor continues through the galley).
  const northZ = kNorth + WALL_T / 2
  const backW = backDoorX0 - kWest
  const backE = kEast - backDoorX1
  if (backW > 0.2) solidWall(backW, WALL_T, kWest + backW / 2, northZ, true)
  if (backE > 0.2) solidWall(backE, WALL_T, kEast - backE / 2, northZ, true)
  kit.doorFrame(frameMat, backDoorX0, backDoorX1, northZ, 2.2)
  {
    const bw = backDoorX1 - backDoorX0
    const fillStart = 2.2 + 0.28 - 0.06
    const fillH = BOOTH_H - fillStart
    if (fillH > 0.08) {
      box(bw + 0.28, fillH, WALL_T, wallMat, (backDoorX0 + backDoorX1) / 2, fillStart + fillH / 2, northZ)
    }
  }

  solidWall(WALL_T, BOOTH_D, kWest + WALL_T / 2, kMidZ, false)
  solidWall(WALL_T, BOOTH_D, kEast - WALL_T / 2, kMidZ, false)

  // Dish pit sticks east of Front; close that south face. Front's pass wall
  // already covers partX → frontHx.
  const dishSouthW = kEast - frontHx
  if (dishSouthW > 0.2) {
    solidWall(dishSouthW, WALL_T, (frontHx + kEast) / 2, kSouth, true)
  }

  putTag('BACK', (backDoorX0 + backDoorX1) / 2, 2.55, kNorth + WALL_T + 0.08, { sx: 0.75, sy: 0.75 })

  // —— Prep counter (north wall). Starts east of the back door so the
  // west aisle stays a walk-through to the staff corridor / pass gap. ——
  const cInner = kNorth + WALL_T + COUNTER_D
  const cX0 = backDoorX1 + 0.28
  const cX1 = partX - 0.28
  const cLen = cX1 - cX0
  const cX = (cX0 + cX1) / 2
  const cZ = kNorth + WALL_T + COUNTER_D / 2
  kit.counter(greyMat, topMat, cLen, COUNTER_D, cX, cZ, COUNTER_Y)

  putTag('PREP', backDoorX1 + 1.05, 1.55, kNorth + WALL_T + 0.07)

  // —— Range / cooktop (south, behind the pass). Kept east of PASS_X1 so
  // the west staff gap stays clear. Cutting board is the west end. ——
  const rOuter = kSouth - WALL_T
  const rInner = rOuter - RANGE_W
  const rX0 = PASS_X1 + 0.15
  const rX1 = partX - 0.35
  const rLen = rX1 - rX0
  const rX = (rX0 + rX1) / 2
  const rZ = (rInner + rOuter) / 2
  const boardLen = 0.95
  const cookLen = rLen - boardLen
  const cookX0 = rX0 + boardLen
  const cookX1 = rX1
  const cookX = (cookX0 + cookX1) / 2
  const boardX = (rX0 + cookX0) / 2

  box(rLen, RANGE_Y - 0.04, RANGE_W, greyMat, rX, (RANGE_Y - 0.04) / 2, rZ)
  box(cookLen - 0.06, 0.04, RANGE_W - 0.08, darkMat, cookX, RANGE_Y, rZ)
  box(boardLen, 0.05, RANGE_W + 0.02, topMat, boardX, RANGE_Y, rZ)

  box(cookLen + 0.1, 0.08, RANGE_W + 0.18, greyMat, cookX, 2.62, rZ)
  box(cookLen * 0.45, 0.85, RANGE_W * 0.55, greyMat, cookX, 2.62 + 0.46, rZ)

  putTag('RANGE', boardX, 1.55, kSouth - WALL_T / 2 - 0.02, { sx: 1.25, sy: 1.25, yaw: Math.PI })

  // —— Order board: NE corner of the galley, 45° into the aisle ——
  const orderBoard = await makeOrderScreen()
  const orderMap = orderBoard.map
  const order = new THREE.Group()
  order.name = 'OrderBoard'
  order.position.set(partX - 1.62, 2.58, kNorth + 1.72)
  order.rotation.order = 'YXZ'
  order.rotation.set(0.48, -Math.PI / 4, 0)
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(3.05, 1.82, 0.10),
    mat(0x111111, { roughness: 0.45 }),
  )
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.86, 1.64),
    new THREE.MeshBasicMaterial({ map: orderMap, toneMapped: false }),
  )
  screen.position.z = 0.055
  order.add(bezel, screen)
  object.add(order)

  putTag('ORDERS', partX - 0.09, 1.55, kNorth + 1.45, { yaw: -Math.PI / 2 })

  // —— Dish pit through a yellow doorway in the N–S partition ——
  kit.doorFrame(frameMat, doorZ0, doorZ1, partX, doorH, {
    lintel: 0.16, depth: 0.14, lintelD: 0.14, axis: 'z',
  })
  const fillH = BOOTH_H - doorH - 0.16
  if (fillH > 0.1) {
    box(WALL_T, fillH, doorW + 0.28, wallMat, partX, doorH + 0.16 + fillH / 2, doorZ)
  }
  const northPart = doorZ0 - (kNorth + WALL_T)
  if (northPart > 0.2) {
    solidWall(WALL_T, northPart, partX, kNorth + WALL_T + northPart / 2, false)
  }
  const southPart = (kSouth - WALL_T) - doorZ1
  if (southPart > 0.2) {
    solidWall(WALL_T, southPart, partX, doorZ1 + southPart / 2, false)
  }

  const inset = WALL_T + WAINSCOT_T / 2
  // partX is the wall centre, not an outer edge — sit the strip on the face.
  const partFace = WALL_T / 2 + WAINSCOT_T / 2
  const coat = { panel: greyMat, rail: railMat }
  const hug = { ...coat, inward: 0.01 }
  const open = { ...coat, cap1: 0 }
  if (backW > 0.2) kit.wainscot(backW, kWest + backW / 2, kNorth + inset, 0, {
    ...coat, cap1: 0, pos: { x: -0.045, y: 0, z: 0 }, scale: { x: 0.99, y: 1, z: 1 },
  })
  if (backE > 0.2) kit.wainscot(backE, kEast - backE / 2, kNorth + inset, 0, {
    ...coat, cap0: 0, pos: { x: 0.03, y: 0, z: 0 }, scale: { x: 0.998, y: 1, z: 1 },
  })
  kit.wainscot(BOOTH_D, kWest + inset, kMidZ, Math.PI / 2, open)
  kit.wainscot(BOOTH_D, kEast - inset, kMidZ, -Math.PI / 2, {
    ...coat, pos: { x: 0.035, y: 0, z: 0 }, scale: { x: 1.012, y: 1, z: 1 },
  })
  if (dishSouthW > 0.2) {
    kit.wainscot(dishSouthW, (frontHx + kEast) / 2, kSouth - partFace, Math.PI, {
      ...hug, cap0: 0, cap1: 0, pos: { x: 0.81, y: 0, z: 0 }, scale: { x: 1.484, y: 1, z: 1 },
    })
  }
  if (northPart > 0.2) {
    const pz = kNorth + WALL_T + northPart / 2
    kit.wainscot(northPart, partX - partFace, pz, -Math.PI / 2, {
      ...hug, cap0: 0, cap1: WAINSCOT_T, pos: { x: -0.039, y: 0, z: 0 }, scale: { x: 0.977, y: 1, z: 1 },
    })
    kit.wainscot(northPart, partX + partFace, pz, Math.PI / 2, {
      ...hug, cap0: WAINSCOT_T, cap1: 0, pos: { x: 0.035, y: 0, z: 0 }, scale: { x: 0.979, y: 1, z: 1 },
    })
  }
  if (southPart > 0.2) {
    const pz = doorZ1 + southPart / 2
    kit.wainscot(southPart, partX - partFace, pz, -Math.PI / 2, {
      ...hug, cap0: WAINSCOT_T, cap1: 0, pos: { x: 0.037, y: 0, z: 0 }, scale: { x: 0.915, y: 1, z: 1 },
    })
    kit.wainscot(southPart, partX + partFace, pz, Math.PI / 2, {
      ...hug, cap0: 0, cap1: WAINSCOT_T, pos: { x: -0.097, y: 0, z: -0.019 }, scale: { x: 1.051, y: 1, z: 1 },
    })
  }

  // Sink on the east wall of the dish-pit (original back wall after 90° CW).
  const basinW = 3.10
  const sinkD = 1.29
  const sinkY = 0.90
  const basinFloorY = 0.38
  const rim = 0.08
  const sinkX = kEast - WALL_T - sinkD / 2 - 0.18
  const basinZ = doorZ
  const dryW = 0.85
  const dryZ = basinZ - basinW / 2 - dryW / 2 - 0.06
  const sinkZ0 = Math.min(dryZ - dryW / 2, basinZ - basinW / 2)
  const sinkZ1 = basinZ + basinW / 2
  const sinkZMid = (sinkZ0 + sinkZ1) / 2
  box(sinkD, sinkY - 0.04, dryW, greyMat, sinkX, (sinkY - 0.04) / 2, dryZ)
  box(sinkD, 0.05, dryW + 0.02, greyMat, sinkX, sinkY, dryZ)
  box(sinkD, basinFloorY, basinW, greyMat, sinkX, basinFloorY / 2, basinZ)
  box(sinkD, 0.04, basinW, darkMat, sinkX, basinFloorY, basinZ)
  const rimH = sinkY - basinFloorY
  box(rim, rimH, basinW, greyMat, sinkX + sinkD / 2 - rim / 2, basinFloorY + rimH / 2, basinZ)
  box(rim, rimH, basinW, greyMat, sinkX - sinkD / 2 + rim / 2, basinFloorY + rimH / 2, basinZ)
  box(sinkD - rim * 2, rimH, rim, greyMat, sinkX, basinFloorY + rimH / 2, basinZ - basinW / 2 + rim / 2)
  box(sinkD - rim * 2, rimH, rim, greyMat, sinkX, basinFloorY + rimH / 2, basinZ + basinW / 2 - rim / 2)
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(sinkD - rim * 2 - 0.04, 0.05, basinW - rim * 2 - 0.04),
    waterMat,
  )
  water.position.set(sinkX, basinFloorY + 0.16, basinZ)
  object.add(water)
  box(0.08, 0.42, 0.08, greyMat, sinkX + sinkD / 2 - 0.12, sinkY + 0.28, basinZ)
  box(0.32, 0.08, 0.08, greyMat, sinkX + sinkD / 2 - 0.28, sinkY + 0.46, basinZ)

  putTag('DISH PIT', kEast - WALL_T - 0.07, 1.55, sinkZMid, { yaw: -Math.PI / 2 })

  const lamp = new THREE.PointLight(0xfff1d0, 14, 16, 2)
  lamp.position.set(galleyMidX, 3.05, kMidZ)
  object.add(lamp)
  const lamp2 = new THREE.PointLight(0xe8f0ff, 8, 10, 2)
  lamp2.position.set((partX + kEast) / 2, 2.8, kMidZ)
  object.add(lamp2)

  const switches = createSwitchSet({ player, proto: switchProto, instancer: pickInst })
  // Galley lamp: west wall, at the cutting-board end of the range
  // (right of the cooktop when you face it).
  switches.add({
    parent: object, light: lamp,
    x: kWest + WALL_T, z: rZ,
    inwardX: 1, inwardZ: 0,
    label: 'Kitchen lights',
  })
  // Dish-pit lamp: east wall of the pit, under the light.
  switches.add({
    parent: object, light: lamp2,
    x: kEast - WALL_T, z: kMidZ,
    inwardX: -1, inwardZ: 0,
    label: 'Dish pit lights',
  })
  kit.finalize()
  muteBoothShadows(object, { skipNames: ['Kit:Floor'], castNames: ['Kit:Roof'] })

  function worldOf(lx, ly, lz) {
    object.updateMatrixWorld(true)
    const v = new THREE.Vector3(lx, ly, lz)
    object.localToWorld(v)
    return v
  }

  function addWorldCollider(lx0, lx1, lz0, lz1) {
    const pts = [
      worldOf(lx0, 0, lz0), worldOf(lx0, 0, lz1),
      worldOf(lx1, 0, lz0), worldOf(lx1, 0, lz1),
    ]
    player.addCollider(
      { x: Math.min(...pts.map(p => p.x)), z: Math.min(...pts.map(p => p.z)) },
      { x: Math.max(...pts.map(p => p.x)), z: Math.max(...pts.map(p => p.z)) },
    )
  }

  function addWorldPlatform(lx0, lx1, lz0, lz1, y) {
    const pts = [
      worldOf(lx0, 0, lz0), worldOf(lx0, 0, lz1),
      worldOf(lx1, 0, lz0), worldOf(lx1, 0, lz1),
    ]
    const p = {
      minx: Math.min(...pts.map(p => p.x)), maxx: Math.max(...pts.map(p => p.x)),
      minz: Math.min(...pts.map(p => p.z)), maxz: Math.max(...pts.map(p => p.z)),
      y,
    }
    player.addPlatform(p)
    return p
  }

  // Player walks the aisle; stations are solid. Food uses the platforms.
  addWorldCollider(cX0, cX1, kNorth, cInner)
  addWorldCollider(rX0, rX1, rInner, rOuter)
  addWorldCollider(kWest, backDoorX0, kNorth, kNorth + WALL_T + 0.02)
  addWorldCollider(backDoorX1, kEast, kNorth, kNorth + WALL_T + 0.02)
  addWorldCollider(kWest, kWest + WALL_T, kNorth, kSouth)
  addWorldCollider(kEast - WALL_T, kEast, kNorth, kSouth)
  addWorldCollider(partX - 0.08, partX + 0.08, kNorth + WALL_T, doorZ0)
  addWorldCollider(partX - 0.08, partX + 0.08, doorZ1, kSouth)
  if (dishSouthW > 0.2) {
    addWorldCollider(frontHx, kEast, kSouth - WALL_T, kSouth + 0.02)
  }
  addWorldCollider(
    sinkX - sinkD / 2, sinkX + sinkD / 2,
    dryZ - dryW / 2, dryZ + dryW / 2,
  )

  const counterPlat = addWorldPlatform(cX0, cX1, kNorth + WALL_T, cInner, COUNTER_Y + 0.03)
  counterPlat.mat = 'counter'
  const grillPlat = addWorldPlatform(cookX0 + 0.04, cookX1 - 0.04, rInner + 0.04, rOuter - 0.04, RANGE_Y + 0.03)
  grillPlat.mat = 'grill'
  const boardPlat = addWorldPlatform(rX0, cookX0, rInner, rOuter, RANGE_Y + 0.03)
  boardPlat.mat = 'board'
  // Solid range body just under the cooktop/board: a patty that does slide off
  // the cooktop edge lands on the cast-iron body instead of through the wall.
  addWorldPlatform(rX0, rX1, rInner, rOuter, RANGE_Y - 0.03).mat = 'grill'
  const dryPlat = addWorldPlatform(
    sinkX - sinkD / 2, sinkX + sinkD / 2,
    sinkZ0, sinkZ0 + dryW,
    sinkY + 0.03,
  )
  dryPlat.mat = 'counter'
  const basinPlat = addWorldPlatform(
    sinkX - sinkD / 2 + rim + 0.02, sinkX + sinkD / 2 - rim - 0.02,
    basinZ - basinW / 2 + rim + 0.02, basinZ + basinW / 2 - rim - 0.02,
    basinFloorY + 0.18,
  )
  basinPlat.mat = 'sink'
  // People can stand on the counter but not step into the open basin: a solid
  // AABB around the whole sink+counter foot so the player's groundY stops at
  // the counter rim. Plates/food keep using the food system (basinPlat).
  addWorldCollider(
    sinkX - sinkD / 2 - 0.02, sinkX + sinkD / 2 + 0.02,
    sinkZ0 - 0.02, sinkZ1 + 0.02,
  )

  function onRect(p, plat, ySlop = 0.35) {
    return p.x >= plat.minx && p.x <= plat.maxx
      && p.z >= plat.minz && p.z <= plat.maxz
      && p.y < plat.y + ySlop + 0.4
  }

  // Prep line, near → far (entrance tomatoes … buns under the board).
  const prepLine = [
    { slug: 'items/Tomato', type: 'tomato', n: 3 },
    { slug: 'items/Cheese', type: 'cheese', n: 3 },
    { slug: 'items/LettuceHead', type: 'lettuceHead', n: 3 },
    { slug: 'items/Lettuce', type: 'lettuce', n: 2 },
    { slug: 'items/Bacon', type: 'bacon', n: 3 },
    { slug: 'items/Patty', type: 'patty', n: 3 },
    { slug: 'items/BunBottom', type: 'bun', n: 3 },
    { slug: 'items/BunTop', type: 'topBun', n: 3 },
  ]
  const usable = cLen - 1.2
  let cursor = 0
  const totalN = prepLine.reduce((s, r) => s + r.n, 0)
  for (const row of prepLine) {
    const proto = foodProtos[row.slug]
    if (!proto) {
      cursor += row.n
      continue
    }
    for (let i = 0; i < row.n; i++) {
      const t = (cursor + 0.5) / totalN
      const lx = cX0 + 0.45 + t * usable
      const lz = cZ + (i % 2 === 0 ? -0.12 : 0.14)
      const w = worldOf(lx, COUNTER_Y + 0.08, lz)
      foodWorld.spawn({
        proto, type: row.type, slug: row.slug,
        x: w.x, z: w.z, y: COUNTER_Y + 0.12,
      })
      cursor++
    }
  }

  const plateProto = foodProtos['items/Plate']
  if (plateProto) {
    for (let i = 0; i < 2; i++) {
      const w = worldOf(sinkX, sinkY + 0.08, dryZ + (i - 0.5) * 0.28)
      const item = foodWorld.spawn({
        proto: plateProto, type: 'plate', slug: 'items/Plate',
        x: w.x, z: w.z, y: sinkY + 0.1, instanced: false,
      })
      item.dirty = true
      item.instVariant = 'dirty'
      applyCookLook(item.object, { mapUrl: './assets/textures/PlateDirty.png' })
      foodWorld.watch(item)
    }
    for (let i = 0; i < 3; i++) {
      const w = worldOf(sinkX + (i % 2 ? 0.12 : -0.12), basinFloorY + 0.22, basinZ + (i - 1) * 0.55)
      foodWorld.spawn({
        proto: plateProto, type: 'plate', slug: 'items/Plate',
        x: w.x, z: w.z, y: basinFloorY + 0.22,
      })
    }
  }

  const stations = {
    Kitchen: { x, z, lookY: 1.5 },
    Range: worldOf(cookX, RANGE_Y, rInner - 0.9),
    Grill: worldOf(cookX, RANGE_Y, rInner - 0.9),
    Cooktop: worldOf(cookX, RANGE_Y, rInner - 0.9),
    Counter: worldOf(cX, COUNTER_Y, cInner + 0.9),
    Prep: worldOf(cX, COUNTER_Y, cInner + 0.9),
    Orders: worldOf(partX - 1.62, 1.6, kNorth + 1.72),
    Board: worldOf(partX - 1.62, 1.6, kNorth + 1.72),
    Sink: worldOf(partX + 1.4, 1.4, doorZ),
    Dish: worldOf(partX + 1.4, 1.4, doorZ),
  }

  const WASH_TIME = 3

  function inBasin(p) {
    return onRect(p, basinPlat, 0.55)
  }

  // Cooktop slab: xz of the grill platform, y near RANGE_Y. Held food cooks
  // only while its collider overlaps this volume (Grill.cs OnTriggerStay).
  function onCooktop(item) {
    if (!item || !item.object) return false
    const p = item.object.position
    const half = Math.max(0.04, (item.height || 0.12) * 0.5)
    const pad = 0.08
    if (p.x < grillPlat.minx - pad || p.x > grillPlat.maxx + pad) return false
    if (p.z < grillPlat.minz - pad || p.z > grillPlat.maxz + pad) return false
    const bottom = p.y - half
    const top = p.y + half
    return bottom < grillPlat.y + 0.2 && top > grillPlat.y - 0.06
  }

  function cookable(item) {
    return item && !item.stolen && (isFood(item.type) || item.type === 'rat')
  }

  function cookTree(item, dt) {
    if (!item.onFire) cookTick(item, dt)
    for (const f of item.stack || []) if (!f.onFire) cookTick(f, dt)
    if (item.plated) cookTree(item.plated, dt)
  }

  let listener = null
  let pattyBuf = null
  loadBuffer('./assets/audio/sfx/Patty.mp3', (buf, lis) => {
    pattyBuf = buf
    listener = lis
  })

  function setGrillSound(item, on) {
    if (!item || !item.object) return
    // Grill.cs OnTriggerEnter: one-shot sfxMeatCooking (patty.mp3), not a loop.
    if (on) {
      if (!item.onGrill) {
        item.onGrill = true
        listener = listener || getListener()
        if (pattyBuf && listener) {
          const a = new THREE.PositionalAudio(listener)
          a.setBuffer(pattyBuf)
          a.setLoop(false)
          a.setRefDistance(2.2)
          a.setMaxDistance(18)
          a.setRolloffFactor(1)
          a.setVolume(0.75)
          item.object.add(a)
          item.cookAudio = a
          safePlay(a)
          const drop = () => { if (a.parent) a.parent.remove(a) }
          a.addEventListener('ended', drop)
          if (pattyBuf.duration) setTimeout(drop, pattyBuf.duration * 1000 + 200)
        }
      }
    } else if (item.onGrill) {
      item.onGrill = false
    }
  }

  let washAcc = 0
  function update(dt) {
    dt = Math.min(dt, 0.1)
    switches.update(dt)
    washAcc += dt

    const den = getRats && getRats()
    const seen = new Set()
    function consider(item) {
      if (!item || seen.has(item) || !cookable(item)) return
      if (item.inFood && item.stackedOn && item.stackedOn.type === 'bun') return
      seen.add(item)
      const hot = onCooktop(item)
        || (item.stack || []).some(f => onCooktop(f))
        || (item.plated && onCooktop(item.plated))
      if (hot) cookTree(item, dt)
      setGrillSound(item, hot && !item.onFire)
    }
    for (const item of foodWorld.items) consider(item)
    for (const rat of den ? den.rats : []) consider(rat)

    if (washAcc < 0.12) return
    const step = washAcc
    washAcc = 0
    for (const item of foodWorld.items) {
      if (item.held || item.stolen || item.type !== 'plate') continue
      const p = item.object.position
      if (inBasin(p)) {
        item.soakTime = (item.soakTime || 0) + step
        if (item.onFire) {
          const fw = getFireWatch && getFireWatch()
          if (fw) fw.putOutItem(item)
        }
        if (item.dirty && item.soakTime >= WASH_TIME) {
          item.dirty = false
          item.instVariant = ''
          applyCookLook(item.object, { mapUrl: './assets/textures/Plate.png' })
          if (item.watchVisual) item.watchVisual(item)
        }
      } else {
        item.soakTime = 0
      }
    }
  }

  function viewSpot(name = 'Kitchen') {
    const raw = name || 'Kitchen'
    if (/^(Lights|KitchenLights|Switch)$/i.test(raw)) {
      const look = worldOf(kWest + WALL_T, SWITCH_Y - 0.04, rZ)
      const stand = worldOf(kWest + WALL_T + 1.55, 0, rZ)
      return { stand, look, label: 'KitchenLights' }
    }
    if (/^DishLights$/i.test(raw)) {
      const look = worldOf(kEast - WALL_T, SWITCH_Y, kMidZ)
      const stand = worldOf(kEast - WALL_T - 1.55, 0, kMidZ)
      return { stand, look, label: 'DishLights' }
    }
    if (/^Back$/i.test(raw)) {
      const mid = (backDoorX0 + backDoorX1) / 2
      return {
        stand: worldOf(mid, 0, kNorth - 1.5),
        look: worldOf(mid, 1.4, kNorth + 1.2),
        label: 'Back',
      }
    }
    const key = stations[raw] ? raw : 'Kitchen'
    if (key === 'Kitchen') {
      const stand = worldOf(galleyMidX, 0, kMidZ)
      const look = worldOf(cookX, 1.35, rZ)
      return { stand, look, label: 'Kitchen' }
    }
    if (key === 'Sink' || key === 'Dish') {
      const stand = worldOf(partX - 1.35, 0, doorZ)
      const look = worldOf(sinkX, 1.05, basinZ)
      return { stand, look, label: 'Sink' }
    }
    if (key === 'Orders' || key === 'Board') {
      const stand = worldOf(galleyMidX + 0.8, 0, kMidZ + 0.4)
      const look = worldOf(partX - 1.62, 2.35, kNorth + 1.72)
      return { stand, look, label: 'Orders' }
    }
    if (key === 'Range' || key === 'Grill' || key === 'Cooktop') {
      const stand = worldOf(cookX, 0, rInner - 1.35)
      const look = worldOf(cookX, 1.55, rZ)
      return { stand, look, label: 'Range' }
    }
    const stand = worldOf(cX, 0, cInner + 0.85)
    const look = worldOf(cX, COUNTER_Y + 0.1, cZ)
    return { stand, look, label: 'Counter' }
  }

  function lookLabel() {
    return switches.lookLabel()
  }

  function tryPress() {
    return switches.tryPress()
  }

  function setTickets(columns) {
    orderBoard.paint(columns)
  }

  return {
    object, update, viewSpot, lookLabel, tryPress, stations, setTickets,
    width: BOOTH_W, depth: BOOTH_D, height: BOOTH_H,
    counterY: COUNTER_Y, rangeY: RANGE_Y,
    grillPlat, counterPlat, dryPlat, basinPlat, boardPlat,
    layout: {
      north: kNorth, south: kSouth, west: kWest, east: kEast, partX,
      backDoorX0, backDoorX1,
    },
  }
}
