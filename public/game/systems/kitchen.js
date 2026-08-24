// Walk-in kitchen exhibit. Grill / oven / sink geometry lived in the lost
// testArea01 scene, not in prefabs — this rebuilds the galley from the
// original screenshots: prep counter, commercial range, hanging order
// board (menu-item burger sprites), and a dish pit through a yellow door.
// Floor is DiningFloor. Grill.cs cook() runs on food that lands on the range.

import * as THREE from 'three'
import { isFood, cookTick, setPlateDirty, setPlateClean } from './food.js'
import { addToDishStack, unstackDish } from './stacking.js'
import { createSwitchSet, SWITCH_Y, muteBoothShadows } from './lightSwitch.js'
import { createKit, addTiledFloor, WALL_T, WAINSCOT_T } from '../common/kit.js'
import { loadBuffer, getListener, safePlay } from '../common/audio.js'

export const BOOTH_W = 6.4
export const BOOTH_D = 14.6
export const BOOTH_H = 3.55
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

  addTiledFloor(kit, { map: floorTex, w: BOOTH_W, d: BOOTH_D, layer: 1 })
  kit.roof(BOOTH_W, BOOTH_D, 0, BOOTH_H, 0)

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

  const hx = BOOTH_W / 2
  const hz = BOOTH_D / 2
  const doorZ = -3.15
  const doorX0 = 0.35
  const doorX1 = 2.15
  const doorW = doorX1 - doorX0
  const doorH = 2.42
  const doorX = (doorX0 + doorX1) / 2

  function solidWall(w, d, px, pz, alongX) {
    const tw = alongX ? w : WALL_T
    const td = alongX ? WALL_T : d
    box(tw, BOOTH_H, td, wallMat, px, BOOTH_H / 2, pz)
  }
  solidWall(BOOTH_W, WALL_T, 0, -hz + WALL_T / 2, true)          // back
  solidWall(WALL_T, BOOTH_D, -hx + WALL_T / 2, 0, false)         // left
  solidWall(WALL_T, BOOTH_D, hx - WALL_T / 2, 0, false)          // right

  // Front header beam + hanging banner.
  box(BOOTH_W, 0.22, WALL_T, railMat, 0, BOOTH_H - 0.14, hz - WALL_T / 2)
  putTag('KITCHEN', 0, BOOTH_H - 0.42, hz + 0.02, { sx: 2.2, sy: 1.6 })

  // —— Prep counter (left) ——
  const cInner = -hx + WALL_T + COUNTER_D
  const cZ0 = doorZ + 0.18
  const cZ1 = hz - 0.55
  const cLen = cZ1 - cZ0
  const cZ = (cZ0 + cZ1) / 2
  const cX = -hx + WALL_T + COUNTER_D / 2
  kit.counter(greyMat, topMat, COUNTER_D, cLen, cX, cZ, COUNTER_Y)

  putTag('PREP', cInner + 0.02, 1.55, cZ1 - 1.4, { yaw: Math.PI / 2 })

  // —— Range / cooktop (right) ——
  const rOuter = hx - WALL_T
  const rInner = rOuter - RANGE_W
  const rZ0 = -1.35
  const rZ1 = hz - 1.15
  const rLen = rZ1 - rZ0
  const rZ = (rZ0 + rZ1) / 2
  const rX = (rInner + rOuter) / 2
  const boardLen = 0.95
  const cookLen = rLen - boardLen
  const cookZ0 = rZ0
  const cookZ1 = rZ1 - boardLen
  const cookZ = (cookZ0 + cookZ1) / 2
  const boardZ = (cookZ1 + rZ1) / 2

  box(RANGE_W, RANGE_Y - 0.04, rLen, greyMat, rX, (RANGE_Y - 0.04) / 2, rZ)
  box(RANGE_W - 0.08, 0.04, cookLen - 0.06, darkMat, rX, RANGE_Y, cookZ)
  box(RANGE_W + 0.02, 0.05, boardLen, topMat, rX, RANGE_Y, boardZ)

  box(RANGE_W + 0.18, 0.08, cookLen + 0.1, greyMat, rX, 2.62, cookZ)
  box(RANGE_W * 0.55, 0.85, cookLen * 0.45, greyMat, rX, 2.62 + 0.46, cookZ)

  putTag('RANGE', hx - WALL_T - 0.04, 1.92, cookZ, { sx: 1.25, sy: 1.25, yaw: -Math.PI / 2 })

  // —— Order board: top-left corner, 45° yaw, pitched down so you look up at it ——
  const orderBoard = await makeOrderScreen()
  const orderMap = orderBoard.map
  const order = new THREE.Group()
  order.name = 'OrderBoard'
  // Pulled toward the aisle (+Z / +X) so the 45° corners clear the left wall and partition.
  order.position.set(-hx + 1.62, 2.58, doorZ + 1.72)
  order.rotation.order = 'YXZ'
  order.rotation.set(0.48, Math.PI / 4, 0)
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

  // Adjacent wall in the same corner: the partition, facing the galley.
  putTag('ORDERS', -hx + 1.45, 1.55, doorZ + 0.09)

  // —— Dish pit through a yellow doorway at the back-right ——
  // Partition wall with a hole: two side posts + lintel (the yellow frame).
  kit.doorFrame(frameMat, doorX0, doorX1, doorZ, doorH, { lintel: 0.16, depth: 0.14, lintelD: 0.14 })
  const fillH = BOOTH_H - doorH - 0.16
  if (fillH > 0.1) {
    box(doorW + 0.28, fillH, WALL_T, wallMat, doorX, doorH + 0.16 + fillH / 2, doorZ)
  }
  // Solid partition either side of the door (closes the galley from the dish pit).
  const partW = doorX0 - (-hx + WALL_T)
  if (partW > 0.2) {
    const partX = -hx + WALL_T + partW / 2
    solidWall(partW, WALL_T, partX, doorZ, true)
  }
  const rightPartW = (hx - WALL_T) - doorX1
  if (rightPartW > 0.2) {
    const partX = doorX1 + rightPartW / 2
    solidWall(rightPartW, WALL_T, partX, doorZ, true)
  }

  const inset = WALL_T + WAINSCOT_T / 2
  const coat = { panel: greyMat, rail: railMat }
  const open = { ...coat, cap1: 0 }
  const openBack = { ...coat, cap0: 0 }
  kit.wainscot(BOOTH_W, 0, -hz + inset, 0, coat)
  kit.wainscot(BOOTH_D, -hx + inset, 0, Math.PI / 2, open)
  kit.wainscot(BOOTH_D, hx - inset, 0, -Math.PI / 2, openBack)
  if (partW > 0.2) {
    const partX = -hx + WALL_T + partW / 2
    kit.wainscot(partW, partX, doorZ + inset, 0, { ...coat, cap0: WAINSCOT_T, cap1: 0 })
    kit.wainscot(partW, partX, doorZ - inset, Math.PI, { ...coat, cap0: 0, cap1: WAINSCOT_T })
  }
  if (rightPartW > 0.2) {
    const partX = doorX1 + rightPartW / 2
    kit.wainscot(rightPartW, partX, doorZ + inset, 0, { ...coat, cap0: 0, cap1: WAINSCOT_T })
    kit.wainscot(rightPartW, partX, doorZ - inset, Math.PI, { ...coat, cap0: WAINSCOT_T, cap1: 0 })
  }

  // Sink on the back wall of the dish-pit room (not in the doorway).
  // 2× original basin width, 1.5× z-depth.
  const basinW = 3.10
  const sinkD = 1.29
  const sinkY = 0.90
  const basinFloorY = 0.38
  const rim = 0.08
  const sinkZ = -hz + WALL_T + sinkD / 2 + 0.18
  const basinX = doorX
  const dryW = 0.85
  const dryX = basinX - basinW / 2 - dryW / 2 - 0.06
  const sinkX0 = Math.min(dryX - dryW / 2, basinX - basinW / 2)
  const sinkX1 = basinX + basinW / 2
  const sinkX = (sinkX0 + sinkX1) / 2
  // Dry rack cabinet + top.
  box(dryW, sinkY - 0.04, sinkD, greyMat, dryX, (sinkY - 0.04) / 2, sinkZ)
  box(dryW + 0.02, 0.05, sinkD, greyMat, dryX, sinkY, sinkZ)
  box(basinW, basinFloorY, sinkD, greyMat, basinX, basinFloorY / 2, sinkZ)
  box(basinW, 0.04, sinkD, darkMat, basinX, basinFloorY, sinkZ)
  const rimH = sinkY - basinFloorY
  box(basinW, rimH, rim, greyMat, basinX, basinFloorY + rimH / 2, sinkZ + sinkD / 2 - rim / 2)
  box(basinW, rimH, rim, greyMat, basinX, basinFloorY + rimH / 2, sinkZ - sinkD / 2 + rim / 2)
  box(rim, rimH, sinkD - rim * 2, greyMat, basinX - basinW / 2 + rim / 2, basinFloorY + rimH / 2, sinkZ)
  box(rim, rimH, sinkD - rim * 2, greyMat, basinX + basinW / 2 - rim / 2, basinFloorY + rimH / 2, sinkZ)
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(basinW - rim * 2 - 0.04, 0.05, sinkD - rim * 2 - 0.04),
    waterMat,
  )
  water.position.set(basinX, basinFloorY + 0.16, sinkZ)
  object.add(water)
  // Faucet on the back rim.
  box(0.08, 0.42, 0.08, greyMat, basinX, sinkY + 0.28, sinkZ - sinkD / 2 + 0.12)
  box(0.08, 0.08, 0.32, greyMat, basinX, sinkY + 0.46, sinkZ - sinkD / 2 + 0.28)

  putTag('DISH PIT', sinkX, 1.55, -hz + WALL_T + 0.07)

  const lamp = new THREE.PointLight(0xfff1d0, 14, 16, 2)
  lamp.position.set(0, 3.05, 1.2)
  object.add(lamp)
  const lamp2 = new THREE.PointLight(0xe8f0ff, 8, 10, 2)
  lamp2.position.set(1.2, 2.8, -5.2)
  object.add(lamp2)

  const switches = createSwitchSet({ player, proto: switchProto, instancer: pickInst })
  // Galley lamp: east wall, above the cutting board (right of the range
  // when facing the cooktop).
  switches.add({
    parent: object, light: lamp,
    x: hx - WALL_T, z: boardZ,
    inwardX: -1, inwardZ: 0,
    label: 'Kitchen lights',
  })
  // Dish-pit lamp: right wall of the pit, under the light.
  switches.add({
    parent: object, light: lamp2,
    x: hx - WALL_T, z: -5.2,
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
  addWorldCollider(-hx, cInner, cZ0, cZ1)
  addWorldCollider(rInner, rOuter, rZ0, rZ1)
  addWorldCollider(-hx, hx, -hz, -hz + WALL_T + 0.02)
  addWorldCollider(-hx, -hx + WALL_T, -hz, hz)
  addWorldCollider(hx - WALL_T, hx, -hz, hz)
  addWorldCollider(-hx + WALL_T, doorX0, doorZ - 0.08, doorZ + 0.08)
  addWorldCollider(doorX1, hx - WALL_T, doorZ - 0.08, doorZ + 0.08)
  addWorldCollider(dryX - dryW / 2, dryX + dryW / 2, sinkZ - sinkD / 2, sinkZ + sinkD / 2)

  const counterPlat = addWorldPlatform(-hx + WALL_T, cInner, cZ0, cZ1, COUNTER_Y + 0.03)
  counterPlat.mat = 'counter'
  const grillPlat = addWorldPlatform(rInner + 0.04, rOuter - 0.04, cookZ0 + 0.04, cookZ1 - 0.04, RANGE_Y + 0.03)
  grillPlat.mat = 'grill'
  const boardPlat = addWorldPlatform(rInner, rOuter, cookZ1, rZ1, RANGE_Y + 0.03)
  boardPlat.mat = 'board'
  // Solid range body just under the cooktop/board: a patty that does slide off
  // the cooktop edge lands on the cast-iron body instead of through the wall.
  addWorldPlatform(rInner, rOuter, rZ0, rZ1, RANGE_Y - 0.03).mat = 'grill'
  const dryPlat = addWorldPlatform(sinkX0, sinkX0 + dryW, sinkZ - sinkD / 2, sinkZ + sinkD / 2, sinkY + 0.03)
  dryPlat.mat = 'counter'
  const basinPlat = addWorldPlatform(
    basinX - basinW / 2 + rim + 0.02, basinX + basinW / 2 - rim - 0.02,
    sinkZ - sinkD / 2 + rim + 0.02, sinkZ + sinkD / 2 - rim - 0.02,
    basinFloorY + 0.18,
  )
  basinPlat.mat = 'sink'
  // People can stand on the counter but not step into the open basin: a solid
  // AABB around the whole sink+counter foot so the player's groundY stops at
  // the counter rim. Plates/food keep using the food system (basinPlat).
  addWorldCollider(sinkX0 - 0.02, sinkX1 + 0.02, sinkZ - sinkD / 2 - 0.02, sinkZ + sinkD / 2 + 0.02)

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
      const lz = cZ1 - 0.45 - t * usable
      const lx = cX + (i % 2 === 0 ? -0.12 : 0.14)
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
    let dirtyRoot = null
    const dryPos = worldOf(dryX, sinkY + 0.08, sinkZ)
    for (let i = 0; i < 2; i++) {
      const item = foodWorld.spawn({
        proto: plateProto, type: 'plate', slug: 'items/Plate',
        x: dryPos.x, z: dryPos.z, y: sinkY + 0.1, instanced: false,
      })
      setPlateDirty(item)
      foodWorld.watch(item)
      if (dirtyRoot) addToDishStack(dirtyRoot, item)
      else dirtyRoot = item
    }
    for (let i = 0; i < 3; i++) {
      const w = worldOf(basinX + (i - 1) * 0.55, basinFloorY + 0.22, sinkZ + (i % 2 ? 0.12 : -0.12))
      foodWorld.spawn({
        proto: plateProto, type: 'plate', slug: 'items/Plate',
        x: w.x, z: w.z, y: basinFloorY + 0.22,
      })
    }
  }

  const stations = {
    Kitchen: { x, z, lookY: 1.5 },
    Range: worldOf(rInner - 0.9, RANGE_Y, cookZ),
    Grill: worldOf(rInner - 0.9, RANGE_Y, cookZ),
    Cooktop: worldOf(rInner - 0.9, RANGE_Y, cookZ),
    Counter: worldOf(cInner + 0.9, COUNTER_Y, cZ + 1.2),
    Prep: worldOf(cInner + 0.9, COUNTER_Y, cZ + 1.2),
    Orders: worldOf(0, 1.6, -0.6),
    Board: worldOf(0, 1.6, -0.6),
    Sink: worldOf(doorX, 1.4, doorZ + 1.4),
    Dish: worldOf(doorX, 1.4, doorZ + 1.4),
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
      if (item.stackedOn) continue
      const p = item.object.position
      if (!inBasin(p)) {
        item.soakTime = 0
        continue
      }
      if (item.onFire) {
        const fw = getFireWatch && getFireWatch()
        if (fw) fw.putOutItem(item)
      }
      // Drop a glued pile in the water: wash every plate and break the
      // stack so they can be pulled out one at a time (original physics
      // pile in Sink.cs — each collider soaked on its own).
      if (item.stack && item.stack.length) {
        const all = unstackDish(item)
        const n = all.length
        const cx = (basinPlat.minx + basinPlat.maxx) / 2
        const cz = (basinPlat.minz + basinPlat.maxz) / 2
        const span = Math.min(
          Math.max(0.28, basinPlat.maxx - basinPlat.minx - 0.24),
          Math.max(0.28, (n - 1) * 0.3),
        )
        all.forEach((plate, i) => {
          setPlateClean(plate)
          plate.held = false
          plate.onFloor = false
          plate.dropped = true
          plate.soakTime = 0
          plate.restingMat = 'sink'
          if (plate.onFire) {
            const fw = getFireWatch && getFireWatch()
            if (fw) fw.putOutItem(plate)
          }
          const t = n === 1 ? 0.5 : i / (n - 1)
          const x = cx - span / 2 + t * span
          plate.object.position.set(
            Math.max(basinPlat.minx + 0.1, Math.min(basinPlat.maxx - 0.1, x)),
            basinPlat.y + 0.1,
            cz + (i % 2 ? 0.08 : -0.08),
          )
          if (plate.vel) plate.vel.set(0, 0, 0)
        })
        continue
      }
      item.soakTime = (item.soakTime || 0) + step
      if (item.dirty && item.soakTime >= WASH_TIME) setPlateClean(item)
    }
  }

  function viewSpot(name = 'Kitchen') {
    const raw = name || 'Kitchen'
    if (/^(Lights|KitchenLights|Switch)$/i.test(raw)) {
      const look = worldOf(hx - WALL_T, SWITCH_Y - 0.04, boardZ)
      const stand = worldOf(rInner - 1.35, 0, boardZ)
      return { stand, look, label: 'KitchenLights' }
    }
    if (/^DishLights$/i.test(raw)) {
      const look = worldOf(hx - WALL_T, SWITCH_Y, -5.2)
      const stand = worldOf(hx - WALL_T - 1.55, 0, -5.2)
      return { stand, look, label: 'DishLights' }
    }
    const key = stations[raw] ? raw : 'Kitchen'
    if (key === 'Kitchen') {
      const stand = worldOf(0, 0, hz + 2.1)
      const look = worldOf(0, 1.55, 1.4)
      return { stand, look, label: 'Kitchen' }
    }
    if (key === 'Sink' || key === 'Dish') {
      const stand = worldOf(doorX, 0, doorZ - 1.35)
      const look = worldOf(basinX, 1.05, sinkZ)
      return { stand, look, label: 'Sink' }
    }
    if (key === 'Orders' || key === 'Board') {
      const stand = worldOf(-0.2, 0, 2.2)
      const look = worldOf(-hx + 1.62, 2.35, doorZ + 1.72)
      return { stand, look, label: 'Orders' }
    }
    if (key === 'Range' || key === 'Grill' || key === 'Cooktop') {
      const stand = worldOf(rInner - 1.35, 0, cookZ)
      const look = worldOf(rX, 1.55, cookZ)
      return { stand, look, label: 'Range' }
    }
    const stand = worldOf(cInner + 1.2, 0, cZ + 1.0)
    const look = worldOf(cX, COUNTER_Y + 0.1, cZ + 1.0)
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
  }
}
