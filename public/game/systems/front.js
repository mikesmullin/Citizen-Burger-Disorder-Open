// Walk-in front-of-house exhibit: street, door, queue, POS, register, dining.
// Sibling of kitchen.js. Customers are ECS; hall crowd stays as-is.

import * as THREE from 'three'
import { C } from '../common/ecs.js'
import { spawnPrefab } from '../gamedata/prefabs.js'
import { ITEM_NAMES } from '../gamedata/menu.js'
import { addToBurger, plateBurger, layoutStack, layoutPlate, grabStackWith } from './stacking.js'
import { applyCookLook, COOK_RGB } from './food.js'
import * as SpawnCustomer from './spawnCustomer.js'
import * as Locomotion from './locomotion.js'
import * as Rigidbody from './rigidbody.js'
import * as Queue from './queue.js'
import * as OrderTake from './orderTake.js'
import * as TableAssign from './tableAssign.js'
import * as SeatArrive from './seatArrive.js'
import * as WaitLook from './waitLook.js'
import * as Patience from './patience.js'
import * as Think from './think.js'
import * as Serve from './serve.js'
import * as Tip from './tip.js'
import * as Register from './register.js'
import * as Speech from './speech.js'
import * as View from './view.js'
import { createPosKiosk } from './posKiosk.js'
import { setPosOpen, posClicksBlocked } from './touch.js'
import { createSwitchSet, SWITCH_Y, muteBoothShadows } from './lightSwitch.js'
import { createKit, addTiledFloor, WALL_T, WAINSCOT, RAIL, WAINSCOT_T, COUNTER_Y } from '../common/kit.js'
import { mountWallPosters } from './posters.js'

export const BOOTH_W = 12
export const BOOTH_D = 18
export const BOOTH_H = 3.55
export const STREET_D = 3.6
export const PASS_INSET = 3.55
export const PASS_X1 = -2.35
export const WIN_X0 = -0.45
export const WIN_X1 = 2.85
export const BACK_DOOR_X0 = -3.55
export const BACK_DOOR_X1 = -2.05
const HALF_H = WAINSCOT + RAIL
const TABLE_Y = 0.76
// House-roof table tent: triangular prism, numbers on the two roof faces.
// ~60° pitch so a standing guest reads the aisle face; almost-square roof
// so the digit is not stretched.
const TENT_LEN = 0.16
const TENT_BASE = 0.16
const TENT_H = 0.14
const TENT_INSET = 0.16

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

function mat(color, { map = null, roughness = 0.78, metalness = 0.04 } = {}) {
  return new THREE.MeshStandardMaterial({ color, map, roughness, metalness })
}

function makeTentGeometry() {
  const hl = TENT_LEN / 2
  const hz = TENT_BASE / 2
  const h = TENT_H
  const A = [-hl, 0, -hz]
  const B = [hl, 0, -hz]
  const C = [hl, 0, hz]
  const D = [-hl, 0, hz]
  const E = [-hl, h, 0]
  const F = [hl, h, 0]
  const pos = []
  const nrm = []
  const uv = []
  function tri(p0, p1, p2, uv0, uv1, uv2) {
    pos.push(...p0, ...p1, ...p2)
    const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2]
    const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2]
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    const inv = 1 / Math.hypot(nx, ny, nz)
    nx *= inv; ny *= inv; nz *= inv
    nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)
    uv.push(...uv0, ...uv1, ...uv2)
  }
  // Door roof (+Z). Camera looking −Z has +X on the right, so C/F are u=1.
  tri(C, F, E, [1, 0], [1, 1], [0, 1])
  tri(C, E, D, [1, 0], [0, 1], [0, 0])
  // Back roof (−Z). Camera looking +Z has +X on the left, so B/F are u=0.
  tri(A, E, F, [1, 0], [1, 1], [0, 1])
  tri(A, F, B, [1, 0], [0, 1], [0, 0])
  // Gable ends: blank white.
  tri(A, D, E, [0, 0], [0, 0], [0, 0])
  tri(B, F, C, [0, 0], [0, 0], [0, 0])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.addGroup(0, 12, 0)
  geo.addGroup(12, 6, 1)
  return geo
}

const TENT_GEO = makeTentGeometry()

function makeNumberTent(n) {
  const map = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#111111'
    g.font = '700 140px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(n), w / 2, h / 2 + 6)
  })
  const roof = mat(0xffffff, { map, roughness: 0.86, metalness: 0 })
  const ends = mat(0xffffff, { roughness: 0.86, metalness: 0 })
  const mesh = new THREE.Mesh(TENT_GEO, [roof, ends])
  mesh.name = 'TableNumber' + n
  mesh.receiveShadow = true
  return mesh
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

function ensureLiveOverlay() {
  if (document.getElementById('pos-live')) return
  const css = document.createElement('style')
  css.textContent = `
    #pos-live {
      display:none; position:fixed; inset:0; z-index:9;
      background:#0c0a08cc; align-items:center; justify-content:center;
      pointer-events:none;
    }
    #pos-live.open { display:flex; pointer-events:auto; }
    #pos-live .bezel {
      width:min(640px, 92vw); background:#1c1814; border:2px solid #6b5a45;
      border-radius:12px; padding:16px; color:#f0e6d4;
      font:14px/1.4 ui-sans-serif, system-ui, sans-serif;
    }
    #pos-live .title {
      letter-spacing:.14em; font-weight:700; font-size:12px;
      color:#c4a574; margin-bottom:10px; text-transform:uppercase;
    }
    #pos-live .draft {
      min-height:48px; background:#14110e; border:1px solid #3a322c;
      border-radius:6px; padding:10px 12px; margin-bottom:12px;
    }
    #pos-live .burgers { display:flex; flex-wrap:wrap; gap:8px; }
    #pos-live .burgers button, #pos-live .row button {
      background:#2a241f; color:#f0e6d4; border:1px solid #4a4038;
      border-radius:8px; padding:8px 12px; cursor:pointer;
      font:13px ui-sans-serif, system-ui, sans-serif;
    }
    #pos-live .burgers button:hover, #pos-live .row button:hover { background:#3a322c; }
    #pos-live .row { display:flex; gap:8px; margin-top:14px; align-items:center; }
    #pos-live .row .close { margin-left:auto; }
    #pos-live .hint { color:#9a8f80; font-size:12px; margin-top:8px; }
  `
  document.head.appendChild(css)
  const wrap = document.createElement('div')
  wrap.id = 'pos-live'
  wrap.innerHTML = `
    <div class="bezel">
      <div class="title">Front of house · new order</div>
      <div class="draft" id="pos-live-draft">empty ticket</div>
      <div class="burgers" id="pos-live-burgers"></div>
      <div class="row">
        <button type="button" id="pos-live-confirm">Confirm</button>
        <button type="button" id="pos-live-reset">Reset</button>
        <button type="button" class="close" id="pos-live-close">close</button>
      </div>
      <div class="hint" id="pos-live-hint"></div>
    </div>
  `
  document.body.appendChild(wrap)
  const burgers = wrap.querySelector('#pos-live-burgers')
  for (const name of ITEM_NAMES) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = name
    btn.dataset.item = name
    burgers.appendChild(btn)
  }
}

export async function createFront({
  scene, player, foodWorld, foodProtos,
  npcProto, world, kitchen, onPosOpen, switchProto, getHands,
  labels, pickInst, bubbles, bodies,
  x = 0, z = 0, facingY = 0,
} = {}) {
  const object = new THREE.Group()
  object.name = 'FrontBooth'
  object.position.set(x, 0, z)
  object.rotation.y = facingY
  scene.add(object)

  const wallUpper = loadMap('./assets/textures/enviro/DiningUpperWall.png')
  const wallLower = loadMap('./assets/textures/enviro/DiningLowerWall.png')
  const floorTex = loadMap('./assets/textures/enviro/DiningFloor.png')
  const topTex = loadMap('./assets/textures/enviro/TableMain.png')
  const greyTex = loadMap('./assets/textures/Grey.png')
  const darkTex = loadMap('./assets/textures/GreyDark.png')

  const upperMat = mat(0xffffff, { map: wallUpper, roughness: 0.9 })
  const lowerMat = mat(0xffffff, { map: wallLower, roughness: 0.88 })
  const greyMat = mat(0xffffff, { map: greyTex, roughness: 0.7 })
  const darkMat = mat(0xffffff, { map: darkTex, roughness: 0.62, metalness: 0.08 })
  const topMat = mat(0xffffff, { map: topTex, roughness: 0.55 })
  const railMat = mat(0xd4a24c, { roughness: 0.5 })
  const orangeMat = mat(0xc45a28, { roughness: 0.55 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xb7d8ee, roughness: 0.06, metalness: 0.12,
    transparent: true, opacity: 0.22, depthWrite: false,
    side: THREE.DoubleSide,
  })
  const kit = createKit({ parent: object })
  function box(w, h, d, material, x, y, z, yaw = 0) {
    kit.box(material, w, h, d, x, y, z, yaw)
  }

  const hx = BOOTH_W / 2
  const hz = BOOTH_D / 2
  const doorZ = hz - STREET_D
  const doorH = 2.42
  // Partition between kitchen (north / -Z) and dining. West gap is the
  // staff corridor into the galley; the rest is half-wall order window.
  const winZ = -hz + PASS_INSET

  const diningD = doorZ - winZ
  const diningZ = (winZ + doorZ) / 2
  addTiledFloor(kit, { map: floorTex, w: BOOTH_W, d: diningD, z: diningZ, layer: 1, tile: 1.55 })
  kit.roof(BOOTH_W, diningD, 0, BOOTH_H, diningZ)

  function solidWall(w, d, px, pz, alongX) {
    const tw = alongX ? w : WALL_T
    const td = alongX ? WALL_T : d
    box(tw, BOOTH_H, td, upperMat, px, BOOTH_H / 2, pz)
  }

  function doorFrame(x0, x1, z, h = doorH) {
    kit.doorFrame(railMat, x0, x1, z, h)
    const mid = (x0 + x1) / 2
    const w = x1 - x0
    const fillStart = h + 0.28 - 0.06
    const fillH = BOOTH_H - fillStart
    if (fillH > 0.08) box(w + 0.28, fillH, WALL_T, upperMat, mid, fillStart + fillH / 2, z)
  }

  // Exterior shell. Open +Z is the road. Side walls stop at the pass —
  // the kitchen owns everything north of winZ (including the back door).
  solidWall(WALL_T, diningD, -hx + WALL_T / 2, diningZ, false)
  solidWall(WALL_T, diningD, hx - WALL_T / 2, diningZ, false)

  const backDoorX0 = BACK_DOOR_X0
  const backDoorX1 = BACK_DOOR_X1

  const doorW = 2.65
  const doorX = -1.15
  const doorX0 = doorX - doorW / 2
  const doorX1 = doorX + doorW / 2

  // Storefront: sill + header + two posts, glass in the hole. No solid
  // wall behind the pane — NPCs looking in actually see the dining room.
  function facadeWindow(x0, x1, z) {
    kit.windowWall({
      x0, x1, z,
      upper: upperMat, rail: railMat, glassMat,
      gBot: HALF_H, gTop: 2.68, h: BOOTH_H,
    })
  }

  facadeWindow(-hx, doorX0, doorZ)
  facadeWindow(doorX1, hx, doorZ)
  doorFrame(doorX0, doorX1, doorZ)

  function putTag(text, x, y, z, extra = {}) {
    const par = extra.parent || object
    if (labels) {
      return labels.place({ text, kind: 'tag', x, y, z, parent: par, ...extra })
    }
    const m = makeLabel(text)
    if (extra.sx || extra.sy) m.scale.set(extra.sx || 1, extra.sy || 1, 1)
    m.position.set(x, y, z)
    if (extra.yaw) m.rotation.y = extra.yaw
    par.add(m)
    return m
  }
  putTag('FRONT', doorX, doorH + 0.52, doorZ + 0.08, { sx: 1.45, sy: 1.25 })

  // Window wall: west staff passage, then solid, half-wall window, solid.
  const passX1 = PASS_X1
  const winX0 = WIN_X0
  const winX1 = WIN_X1
  const solidW1 = winX0 - passX1
  if (solidW1 > 0.2) solidWall(solidW1, WALL_T, passX1 + solidW1 / 2, winZ, true)
  const solidW2 = (hx - WALL_T) - winX1
  if (solidW2 > 0.2) solidWall(solidW2, WALL_T, winX1 + solidW2 / 2, winZ, true)
  const winW = winX1 - winX0
  box(winW, HALF_H, WALL_T, upperMat, (winX0 + winX1) / 2, HALF_H / 2, winZ)
  box(winW, 0.06, 0.36, topMat, (winX0 + winX1) / 2, HALF_H + 0.03, winZ + 0.22)

  putTag('PASS', (winX0 + winX1) / 2, HALF_H - 0.22, winZ + WALL_T / 2 + 0.01, { sx: 0.72, sy: 0.72 })
  // Dining face of the west pass solid — visible from checkout looking at the kitchen.
  putTag('KITCHEN', passX1 + solidW1 / 2, 1.55, winZ + WALL_T / 2 + 0.02, { sx: 1.5, sy: 1.25 })

  // Checkout: bar running east–west. Staff stand on the -Z side (toward
  // the window); guests queue on the +Z side. West wall closes the pen.
  // Alley is ~2.5 m so two people can stand without clipping the pass wall.
  const cD = 0.82
  const cLen = 5.6
  const cX = 0.85
  const cZ = winZ + 2.88
  const cX0 = cX - cLen / 2
  const cX1 = cX + cLen / 2
  kit.counter(orangeMat, topMat, cLen, cD, cX, cZ, COUNTER_Y)

  // Divider on the *guest* side of the counter, west to the exterior.
  // Staff behind the till walk west (north of this wall) to the back door.
  // Dining cannot enter that corridor without going around the counter.
  const divideZ = cZ + cD / 2
  const divideX0 = -hx + WALL_T
  const divideW = cX0 - divideX0
  if (divideW > 0.2) {
    solidWall(divideW, WALL_T, divideX0 + divideW / 2, divideZ, true)
  }

  const inset = WALL_T + WAINSCOT_T / 2
  // Outer-edge walls (hx) use `inset`. Walls whose box is centred on the
  // plane (pass, divider, storefront) use `face` or the strip sits ~9 cm off.
  const face = WALL_T / 2 + WAINSCOT_T / 2
  const coat = { panel: lowerMat, rail: railMat }
  const free = { ...coat, cap: 0 }
  kit.wainscot(diningD, -hx + inset, diningZ, Math.PI / 2, {
    ...coat, pos: { x: 0.037, y: 0, z: 0 }, scale: { x: 1.025, y: 1, z: 1 },
  })
  kit.wainscot(diningD, hx - inset, diningZ, -Math.PI / 2, {
    ...coat, pos: { x: 0.031, y: 0, z: -0.035 }, scale: { x: 1.022, y: 1, z: 1 },
  })
  const leftWin = doorX0 - (-hx)
  if (leftWin > 0.2) kit.wainscot(leftWin, -hx + leftWin / 2, doorZ - face, Math.PI, {
    ...coat, cap0: 0, pos: { x: 0.035, y: 0, z: -0.02 }, scale: { x: 0.994, y: 1, z: 1 },
  })
  const rightWin = hx - doorX1
  if (rightWin > 0.2) kit.wainscot(rightWin, doorX1 + rightWin / 2, doorZ - face, Math.PI, {
    ...coat, cap1: 0, pos: { x: -0.038, y: 0, z: -0.021 }, scale: { x: 0.987, y: 1, z: 1 },
  })
  if (solidW1 > 0.2) kit.wainscot(solidW1, passX1 + solidW1 / 2, winZ + face, 0, {
    ...free, pos: { x: -0.002, y: 0, z: -0.039 }, scale: { x: 1.002, y: 1, z: 1 },
  })
  kit.wainscot(winW, (winX0 + winX1) / 2, winZ + face, 0, {
    ...free, pos: { x: 0, y: 0, z: -0.037 }, scale: { x: 1, y: 1, z: 1 },
  })
  if (solidW2 > 0.2) kit.wainscot(solidW2, winX1 + solidW2 / 2, winZ + face, 0, {
    ...coat, cap0: 0, cap1: WAINSCOT_T, pos: { x: 0.026, y: 0, z: -0.039 }, scale: { x: 1.017, y: 1, z: 1 },
  })
  if (divideW > 0.2) {
    kit.wainscot(divideW, divideX0 + divideW / 2, divideZ + face, 0, {
      ...coat, cap0: WAINSCOT_T, cap1: 0, pos: { x: -0.016, y: 0, z: -0.019 }, scale: { x: 1.004, y: 1, z: 1 },
    })
    kit.wainscot(divideW, divideX0 + divideW / 2, divideZ - face, Math.PI, {
      ...coat, cap0: 0, cap1: WAINSCOT_T, pos: { x: 0.028, y: 0, z: -0.02 }, scale: { x: 1.002, y: 1, z: 1 },
    })
  }

  const staffZ = (winZ + (cZ - cD / 2)) / 2
  const staffX0 = 0.05
  const staffX1 = 1.85

  // Till (west) · order computer · burger POS (east). All face staff.
  const posX = 1.75
  const posG = new THREE.Group()
  posG.position.set(posX, 0, cZ - cD / 2)
  posG.rotation.y = Math.PI
  box(0.72, 0.48, 0.08, darkMat, posX, COUNTER_Y + 0.42, cZ - cD / 2 - 0.04, Math.PI)
  const posScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.40),
    new THREE.MeshBasicMaterial({
      map: loadMap('./assets/textures/pos/set-burgers.png'),
      toneMapped: false,
    }),
  )
  posScreen.position.set(0, COUNTER_Y + 0.42, 0.09)
  posScreen.userData.posLive = true
  posG.add(posScreen)
  putTag('POS', 0, COUNTER_Y + 0.78, 0.08, { sx: 0.7, sy: 0.7, parent: posG })
  object.add(posG)

  const regX = cX0 + 0.55
  const regZ = cZ
  box(0.62, 0.42, 0.48, darkMat, regX, COUNTER_Y + 0.24, regZ)
  const regCanvas = document.createElement('canvas')
  regCanvas.width = 256
  regCanvas.height = 96
  const regCtx = regCanvas.getContext('2d')
  const regMap = new THREE.CanvasTexture(regCanvas)
  regMap.colorSpace = THREE.SRGBColorSpace
  function paintRegister(money) {
    const g = regCtx
    g.fillStyle = '#0b1a12'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = '#3dff9a'
    g.font = '700 48px ui-monospace, monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$' + Math.round(money), 128, 50)
    regMap.needsUpdate = true
  }
  paintRegister(100)
  const regDisp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.2),
    new THREE.MeshBasicMaterial({ map: regMap, toneMapped: false }),
  )
  regDisp.position.set(regX, COUNTER_Y + 0.52, cZ - cD / 2 - 0.02)
  regDisp.rotation.y = Math.PI
  object.add(regDisp)
  putTag('TILL', regX, COUNTER_Y + 0.78, cZ - cD / 2 - 0.02, { sx: 0.65, sy: 0.65, yaw: Math.PI })

  const compX = 0.15

  // Staff menu on the dining face of the pass wall, east of the order
  // window. Same gun path as the other wall posters (not the Unity prefab).
  const menuW = 2.508
  const menuH = 1.672
  const menuX = 4.382
  const menuY = 2.288
  const menuZ = -5.36
  const posKiosk = createPosKiosk({
    scene, player,
    parent: object,
    countertop: true,
    skipCollider: true,
    x: compX, y: COUNTER_Y, z: cZ,
    yaw: Math.PI,
    onOpen: onPosOpen,
    onClose: () => {},
  })

  // Single-file queue, perpendicular to the counter. Slot 1 is closest
  // to the guest face so staff see who is first. 1.55 m off the counter
  // and 1.35 m apart matches the earlier anti-jitter spacing.
  const qx = 0.15
  const qz0 = cZ + cD / 2 + 1.55
  const qStep = 1.35
  const queueLocal = [1, 2, 3, 4].map(slotId => ({
    slotId,
    x: qx,
    z: qz0 + (slotId - 1) * qStep,
  }))
  const markMat = mat(0x2a241f, { roughness: 0.9 })
  for (const q of queueLocal) {
    box(0.36, 0.02, 0.52, markMat, q.x, 0.05, q.z)
  }

  // Wall posters (dining + kitchen) share the kiosk atlas — one InstancedMesh.

  function makeTable(spec) {
    const tw = spec.w
    const td = spec.d
    box(tw, TABLE_Y - 0.04, td, greyMat, spec.x, (TABLE_Y - 0.04) / 2, spec.z)
    box(tw + 0.04, 0.04, td + 0.04, topMat, spec.x, TABLE_Y, spec.z)

    // Door-nearest aisle corner. Ridge aims at that corner so both
    // numbered roof faces read from the entrance and the aisle.
    const aisle = spec.x < 0 ? 1 : -1
    const tent = makeNumberTent(spec.tableId)
    tent.position.set(
      spec.x + aisle * (tw / 2 - TENT_INSET),
      TABLE_Y + 0.02,
      spec.z + (td / 2 - TENT_INSET),
    )
    tent.rotation.y = Math.atan2(-1, aisle)
    object.add(tent)

    const seats = []
    if (spec.capacity === 4) {
      seats.push({ x: spec.x - tw * 0.22, z: spec.z + td * 0.55 + 0.38 })
      seats.push({ x: spec.x + tw * 0.22, z: spec.z + td * 0.55 + 0.38 })
      seats.push({ x: spec.x - tw * 0.22, z: spec.z - td * 0.55 - 0.38 })
      seats.push({ x: spec.x + tw * 0.22, z: spec.z - td * 0.55 - 0.38 })
    } else {
      seats.push({ x: spec.x, z: spec.z + td / 2 + 0.38 })
      seats.push({ x: spec.x, z: spec.z - td / 2 - 0.38 })
    }
    return { ...spec, seats, tw, td, tent, aisle }
  }

  const tableSpecs = [
    makeTable({ tableId: 1, capacity: 2, x: -3.85, z: 3.2, w: 1.35, d: 0.78 }),
    makeTable({ tableId: 2, capacity: 2, x: 3.95, z: 3.2, w: 1.35, d: 0.78 }),
    makeTable({ tableId: 3, capacity: 2, x: -3.85, z: 1.05, w: 1.35, d: 0.78 }),
    makeTable({ tableId: 4, capacity: 4, x: 3.85, z: 1.0, w: 1.85, d: 1.15 }),
  ]

  const kLayout = kitchen && kitchen.layout
  const wallPosters = await mountWallPosters(object, [
    { id: 'CoverYourBurger', x: -4.361, y: 2.341, z: -2.24, yaw: Math.PI, w: 2.014, h: 2.014 },
    kLayout
      ? { id: 'Poster2', x: 6.542, y: 2.328, z: -11.71, yaw: 0, w: 1.983, h: 1.983 }
      : { id: 'Poster2', x: hx - WALL_T - 0.02, y: 1.80, z: -7.2, yaw: -Math.PI / 2, w: 1.1, h: 1.1 },
    { id: 'jTZL8p0', x: -5.84, y: 2.253, z: 3.413, yaw: Math.PI / 2, w: 2.671, h: 2.003 },
    { id: 'n0kvMQ6', x: -5.84, y: 2.26, z: -0.014, yaw: Math.PI / 2, w: 2.723, h: 2.042 },
    { id: 'BLCkYpI', x: 5.84, y: 2.319, z: 2.915, yaw: -Math.PI / 2, w: 2.896, h: 2.172 },
    { id: 'VF9IcfX', x: 5.84, y: 2.314, z: -0.608, yaw: -Math.PI / 2, w: 2.868, h: 2.151 },
  ])
  {
    const map = loadMap('./assets/textures/ui/StaffMenu.png')
    // StaffMenu.bin front-quad UVs (white menu). The red STAFF back lives
    // in the bottom of the same PNG (v ≲ 0.29) and must not show.
    map.offset.set(0.009, 0.355)
    map.repeat.set(0.977, 0.636)
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.72, metalness: 0.02 }),
    )
    sheet.name = 'WallPoster:StaffMenu'
    sheet.position.set(menuX, menuY, menuZ)
    sheet.rotation.set(0, 0, 0)
    sheet.scale.set(menuW, menuH, 1)
    sheet.castShadow = true
    sheet.receiveShadow = true
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 }),
    )
    back.name = 'StaffMenuBack'
    back.rotation.y = Math.PI
    back.position.z = -0.01
    back.raycast = () => {}
    sheet.add(back)
    sheet.userData.noGrab = true
    sheet.userData.wallPoster = {
      id: 'StaffMenu', caption: 'Staff menu',
      x: menuX, y: menuY, z: menuZ, yaw: 0, w: menuW, h: menuH,
    }
    object.add(sheet)
    if (wallPosters && wallPosters.items) {
      sheet.userData.slot = wallPosters.items.length
      wallPosters.items.push(sheet)
    }
  }

  const lamp = new THREE.PointLight(0xfff1d0, 16, 20, 2)
  lamp.position.set(0, 3.05, 0.6)
  object.add(lamp)
  const lamp2 = new THREE.PointLight(0xe8f0ff, 9, 12, 2)
  lamp2.position.set(0.8, 2.7, winZ - 1.3)
  object.add(lamp2)
  const lamp3 = new THREE.PointLight(0xfff1d0, 8, 11, 2)
  lamp3.position.set(doorX, 2.7, doorZ - 1.4)
  object.add(lamp3)

  // Guest-face divider west of the till (the south wall in the screenshot:
  // stand behind the counter, look at the till, wall to the right).
  const switches = createSwitchSet({ player, proto: switchProto, instancer: pickInst })
  const swStep = 0.28
  const swX = cX0 - 0.55
  const swZ0 = divideZ
  switches.add({
    parent: object, light: lamp,
    x: swX - swStep, z: swZ0,
    inwardX: 0, inwardZ: -1,
    label: 'Dining lights',
  })
  switches.add({
    parent: object, light: lamp3,
    x: swX, z: swZ0,
    inwardX: 0, inwardZ: -1,
    label: 'Entry lights',
  })
  switches.add({
    parent: object, light: lamp2,
    x: swX + swStep, z: swZ0,
    inwardX: 0, inwardZ: -1,
    label: 'Pass lights',
  })
  kit.finalize()
  muteBoothShadows(object, { skipNames: ['Kit:Floor', 'Kit:Glass'], castNames: ['Kit:Roof'] })

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

  addWorldCollider(-hx, -hx + WALL_T, winZ, doorZ)
  addWorldCollider(hx - WALL_T, hx, winZ, doorZ)
  addWorldCollider(-hx, doorX0, doorZ - 0.08, doorZ + 0.08)
  addWorldCollider(doorX1, hx, doorZ - 0.08, doorZ + 0.08)
  addWorldCollider(passX1, winX0, winZ - 0.08, winZ + 0.08)
  addWorldCollider(winX0, winX1, winZ - 0.08, winZ + 0.08)
  addWorldCollider(winX1, hx - WALL_T, winZ - 0.08, winZ + 0.08)
  addWorldCollider(divideX0, cX0, divideZ - 0.08, divideZ + 0.08)
  addWorldCollider(cX0, cX1, cZ - cD / 2, cZ + cD / 2)
  addWorldPlatform(cX0, cX1, cZ - cD / 2, cZ + cD / 2, COUNTER_Y + 0.03)
  addWorldPlatform(winX0, winX1, winZ + 0.04, winZ + 0.42, HALF_H + 0.06)

  for (const t of tableSpecs) {
    addWorldCollider(t.x - t.tw / 2, t.x + t.tw / 2, t.z - t.td / 2, t.z + t.td / 2)
    addWorldPlatform(t.x - t.tw / 2, t.x + t.tw / 2, t.z - t.td / 2, t.z + t.td / 2, TABLE_Y + 0.05)
  }

  const doorWpos = worldOf(doorX, 0, doorZ)
  const streetWpos = worldOf(doorX, 0, hz - 1.4)
  const posWpos = worldOf(posX, COUNTER_Y, cZ)
  const regWpos = worldOf(regX, COUNTER_Y, regZ)
  const staffWpos = worldOf((staffX0 + staffX1) / 2, 0, staffZ)
  const passWpos = worldOf(1.35, 0, winZ + 1.6)
  const backWpos = kitchen && kitchen.viewSpot
    ? kitchen.viewSpot('Back').look
    : worldOf((backDoorX0 + backDoorX1) / 2, 0, -hz + 1.2)
  const winLook = worldOf((winX0 + winX1) / 2, HALF_H, winZ)

  let numberStandPos = worldOf(0.95, COUNTER_Y, cZ)
  const nsProto = foodProtos && foodProtos['items/NumberStand']
  if (nsProto && foodWorld) {
    for (let i = 0; i < 3; i++) {
      const w = worldOf(0.88 + i * 0.24, COUNTER_Y + 0.12, cZ - 0.06)
      if (i === 0) numberStandPos = w
      foodWorld.spawn({
        proto: nsProto, type: 'numberStand', slug: 'items/NumberStand',
        x: w.x, z: w.z, y: COUNTER_Y + 0.14, maxSize: 0.28,
      })
    }
  }

  if (world) {
    for (const q of queueLocal) {
      const w = worldOf(q.x, 0, q.z)
      spawnPrefab(world, 'front/QueueNode', { x: w.x, y: 0, z: w.z, extra: { slotId: q.slotId } })
    }
    for (const t of tableSpecs) {
      const w = worldOf(t.x, TABLE_Y, t.z)
      spawnPrefab(world, 'front/Table', {
        x: w.x, y: TABLE_Y, z: w.z,
        extra: { tableId: t.tableId, capacity: t.capacity },
      })
      for (const s of t.seats) {
        const sw = worldOf(s.x, TABLE_Y, s.z)
        spawnPrefab(world, 'front/Seat', {
          x: sw.x, y: TABLE_Y, z: sw.z,
          extra: { tableId: t.tableId },
        })
      }
    }
    spawnPrefab(world, 'front/Register', { x: regWpos.x, y: COUNTER_Y, z: regWpos.z })
  }

  const indoorNodes = [
    worldOf(-3.2, 0, 2.1),
    worldOf(3.3, 0, 2.1),
    worldOf(-2.4, 0, 3.8),
    worldOf(2.6, 0, 3.8),
    worldOf(-2.2, 0, 2.4),
    worldOf(-3.4, 0, 0.4),
  ].map(v => ({ x: v.x, z: v.z }))

  const seatSpots = {}
  tableSpecs.forEach((t, ti) => {
    const sw = worldOf(t.seats[0].x, TABLE_Y, t.seats[0].z)
    seatSpots['Seat' + (ti + 1)] = sw
    seatSpots['Table' + t.tableId] = worldOf(t.x, TABLE_Y, t.z)
  })

  ensureLiveOverlay()
  const overlay = document.getElementById('pos-live')
  const draftEl = document.getElementById('pos-live-draft')
  const hintEl = document.getElementById('pos-live-hint')
  let overlayOpen = false
  let draft = []

  function paintDraft() {
    draftEl.textContent = draft.length ? draft.join(', ') : 'empty ticket (max 4)'
    const waiting = world ? OrderTake.npcInQueue(world) : 0
    hintEl.textContent = waiting
      ? 'leader is waiting to order'
      : 'no one at slot 1 — queue a customer first'
  }

  function closeOverlay() {
    overlayOpen = false
    overlay.classList.remove('open')
    setPosOpen(false)
  }

  function openOverlay() {
    overlayOpen = true
    overlay.classList.add('open')
    paintDraft()
    if (!player.touchLock) player.unlock()
    setPosOpen(true)
  }

  overlay.querySelector('#pos-live-burgers').onclick = e => {
    const name = e.target && e.target.dataset && e.target.dataset.item
    if (!name) return
    if (draft.length >= 4) return
    draft.push(name)
    paintDraft()
  }
  overlay.querySelector('#pos-live-reset').onclick = () => {
    draft = []
    paintDraft()
  }
  overlay.querySelector('#pos-live-confirm').onclick = () => {
    const r = confirmOrder(draft.slice())
    draft = []
    paintDraft()
    if (r) closeOverlay()
  }
  overlay.querySelector('#pos-live-close').onclick = closeOverlay
  overlay.addEventListener('pointerdown', e => {
    if (e.target !== overlay) return
    e.preventDefault()
    e.stopPropagation()
    closeOverlay()
  })
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && overlayOpen) closeOverlay()
  })

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  function tryPress() {
    if (overlayOpen) return false
    if (posClicksBlocked()) return false
    if (!player.locked) return false
    if (switches.tryPress()) return true
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    for (const h of hits) {
      if (h.distance > 5.8) continue
      if (h.object.userData.posLive || h.object === posBezel) {
        openOverlay()
        return true
      }
    }
    return false
  }

  function confirmOrder(items) {
    if (!world) return null
    const r = OrderTake.confirm(world, items)
    return r
  }

  function spawnNow(size = 2) {
    if (!world || !npcProto) return []
    return SpawnCustomer.spawnGroup(world, {
      size, street: streetWpos, door: doorWpos,
      proto: npcProto, scene, player, bubbles, bodies,
    })
  }

  function dropPlated(seatName = 'Seat1', foodName = 'Citizen') {
    if (!foodWorld) return null
    const spot = seatSpots[seatName] || seatSpots.Seat1
    if (!spot) return null
    // Seats sit beside the table; the plate has to land on the table top
    // (Table.cs trigger) so it stays put and the diner can reach it.
    const tableSpot = seatSpots[String(seatName).replace(/^Seat/i, 'Table')] || spot
    const bunP = foodProtos['items/BunBottom']
    const topP = foodProtos['items/BunTop']
    const plateP = foodProtos['items/Plate']
    if (!bunP || !topP || !plateP) return { error: 'missing food protos' }
    const y = TABLE_Y + 0.18
    const x = tableSpot.x
    const z = tableSpot.z
    const bun = foodWorld.spawn({ proto: bunP, type: 'bun', slug: 'items/BunBottom', x, z, y })
    const layers = {
      Citizen: [
        ['items/Patty', 'patty'],
        ['items/Cheese', 'cheese'],
        ['items/Lettuce', 'lettuce'],
      ],
      Worker: [
        ['items/Patty', 'patty'],
        ['items/Cheese', 'cheese'],
        ['items/Patty', 'patty'],
        ['items/Cheese', 'cheese'],
      ],
      Family: [
        ['items/Patty', 'patty'],
        ['items/Cheese', 'cheese'],
        ['items/Lettuce', 'lettuce'],
      ],
    }
    const recipe = layers[foodName] || layers.Citizen
    for (const [slug, type] of recipe) {
      const proto = foodProtos[slug]
      if (!proto) continue
      const f = foodWorld.spawn({ proto, type, slug, x, z, y: y + 0.1 })
      if (type === 'patty' || type === 'bacon') {
        f.cooked = 1
        applyCookLook(f.object, { cooked: 1, cookedRGB: COOK_RGB[type] || COOK_RGB.default })
      }
      addToBurger(bun, f)
    }
    const top = foodWorld.spawn({
      proto: topP, type: 'topBun', slug: 'items/BunTop',
      x, z, y: y + 0.2,
    })
    addToBurger(bun, top)
    const plate = foodWorld.spawn({
      proto: plateP, type: 'plate', slug: 'items/Plate',
      x, z, y,
    })
    plateBurger(plate, bun)
    layoutStack(bun)
    layoutPlate(plate)
    return { plate: plate.type, complete: !!bun.complete, at: seatName, food: foodName }
  }

  let ticketsLive = false
  function syncTickets() {
    if (!kitchen || !kitchen.setTickets || !world) return
    const cols = [[], [], [], []]
    for (const [, order] of world.query(C.Order)) {
      if (order.status !== 'hanging') continue
      ticketsLive = true
      const i = Math.max(0, Math.min(3, (order.tableId || 1) - 1))
      cols[i] = (order.items || []).slice(0, i === 3 ? 4 : 2)
    }
    if (ticketsLive) kitchen.setTickets(cols)
  }

  function dump() {
    const npcs = []
    if (world) {
      for (const [eid, cust, think, tf] of world.query(C.Customer, C.Thinker, C.Transform)) {
        npcs.push({
          eid,
          want: think.want,
          anger: +cust.anger.toFixed(1),
          desiredFood: cust.desiredFood,
          groupId: cust.groupId,
          queueSlot: cust.queueSlot,
          tableId: cust.tableId,
          skin: cust.skin,
          ry: +tf.ry.toFixed(1),
          restRy: think.restRy == null ? null : +think.restRy.toFixed(1),
          pos: { x: +tf.x.toFixed(2), y: +tf.y.toFixed(2), z: +tf.z.toFixed(2) },
        })
      }
    }
    const orders = []
    if (world) {
      for (const [, order] of world.query(C.Order)) {
        orders.push({ tableId: order.tableId, items: order.items, status: order.status })
      }
    }
    let money = 100
    if (world) {
      for (const [, reg] of world.query(C.Register)) money = reg.money
    }
    const queue = []
    if (world) {
      for (const [, slot] of world.query(C.QueueSlot)) {
        queue.push({ slotId: slot.slotId, occupied: !!slot.occupiedBy })
      }
      queue.sort((a, b) => a.slotId - b.slotId)
    }
    const tips = (foodWorld?.items || []).filter(i => i.type === 'tip').length
    return { npcs, orders, register: { money }, tips, queue }
  }

  function viewSpot(name = 'Front') {
    const key = name || 'Front'
    if (/^Street$/i.test(key)) {
      const stand = worldOf(doorX, 0, hz - 0.7)
      const look = worldOf(doorX, 1.5, doorZ)
      return { stand, look, label: 'Street' }
    }
    if (/^Door$/i.test(key)) {
      const stand = worldOf(doorX, 0, doorZ + 1.7)
      const look = worldOf(doorX, 1.5, doorZ)
      return { stand, look, label: 'Door' }
    }
    if (/^Queue$/i.test(key)) {
      const q1 = queueLocal[0]
      const qLast = queueLocal[queueLocal.length - 1]
      const stand = worldOf(qLast.x - 1.8, 0, (q1.z + qLast.z) / 2)
      const look = worldOf(q1.x, 1.35, q1.z)
      return { stand, look, label: 'Queue' }
    }
    if (/^(POS|Checkout)$/i.test(key) || key === 'front/POS') {
      if (posKiosk && posKiosk.viewSpot) {
        const v = posKiosk.viewSpot()
        return { stand: v.stand, look: v.look, label: 'POS' }
      }
      const stand = worldOf(staffX0, 0, staffZ)
      const look = worldOf(posX, COUNTER_Y + 0.4, cZ - cD / 2)
      return { stand, look, label: 'POS' }
    }
    if (/^Staff$/i.test(key)) {
      return {
        stand: staffWpos,
        look: worldOf(qx, COUNTER_Y + 0.25, qz0),
        label: 'Staff',
      }
    }
    if (/^(Lights|Switch|Switches)$/i.test(key)) {
      return {
        stand: worldOf(swX, 0, swZ0 - 1.45),
        look: worldOf(swX, SWITCH_Y - 0.04, swZ0),
        label: 'Lights',
      }
    }
    if (/^NumberStand$/i.test(key)) {
      return {
        stand: worldOf(0.95, 0, staffZ),
        look: { x: numberStandPos.x, y: COUNTER_Y + 0.2, z: numberStandPos.z },
        label: 'NumberStand',
      }
    }
    if (/^StaffMenu$/i.test(key)) {
      const stand = worldOf(menuX, 0, cZ + cD / 2 + 1.8)
      const look = worldOf(menuX, menuY, menuZ)
      return { stand, look, label: 'StaffMenu' }
    }
    if (/^Register$/i.test(key)) {
      const stand = worldOf(regX, 0, staffZ)
      const look = worldOf(regX, COUNTER_Y + 0.35, cZ - cD / 2)
      return { stand, look, label: 'Register' }
    }
    if (/^(Window|Pass)$/i.test(key)) {
      if (/^Pass$/i.test(key)) {
        return {
          stand: passWpos,
          look: worldOf((winX0 + winX1) / 2, 1.35, winZ),
          label: 'Pass',
        }
      }
      const stand = worldOf((winX0 + winX1) / 2, 0, cZ + 2.2)
      return { stand, look: winLook, label: 'Window' }
    }
    if (/^Back$/i.test(key)) {
      if (kitchen && kitchen.viewSpot) {
        const v = kitchen.viewSpot('Back')
        if (v && v.label === 'Back') return v
      }
      return {
        stand: worldOf((backDoorX0 + backDoorX1) / 2, 0, -hz - 1.5),
        look: worldOf((backDoorX0 + backDoorX1) / 2, 1.4, -hz + 1.2),
        label: 'Back',
      }
    }
    const seatHit = key.match(/^Seat(\d)$/i)
    if (seatHit) {
      const spot = seatSpots['Seat' + seatHit[1]]
      if (spot) {
        return {
          stand: { x: spot.x, y: 0, z: spot.z + 1.4 },
          look: { x: spot.x, y: TABLE_Y + 0.4, z: spot.z },
          label: 'Seat' + seatHit[1],
        }
      }
    }
    const tableHit = key.match(/^Table(\d)$/i)
    if (tableHit) {
      const spec = tableSpecs.find(t => t.tableId === +tableHit[1])
      if (spec?.tent) {
        const look = worldOf(spec.tent.position.x, spec.tent.position.y + 0.04, spec.tent.position.z)
        const stand = worldOf(
          spec.tent.position.x + spec.aisle * 1.35,
          0,
          spec.tent.position.z + 0.35,
        )
        return { stand, look, label: 'Table' + spec.tableId }
      }
      const spot = seatSpots['Table' + tableHit[1]]
      if (spot) {
        return {
          stand: { x: spot.x, y: 0, z: spot.z + 1.6 },
          look: { x: spot.x, y: TABLE_Y + 0.3, z: spot.z },
          label: 'Table' + tableHit[1],
        }
      }
    }
    const stand = worldOf(doorX, 0, hz - 0.5)
    const look = worldOf(doorX, 1.45, doorZ)
    return { stand, look, label: 'Front' }
  }

  function lookLabel() {
    if (overlayOpen) return 'POS · live terminal'
    const sw = switches.lookLabel()
    if (sw) return sw
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (hits.length && hits[0].distance < 5.8 && hits[0].object.userData.posLive) {
      return 'POS · take an order'
    }
    return ''
  }

  function ctx(dt, T) {
    return {
      T, dt,
      door: doorWpos,
      street: streetWpos,
      proto: npcProto,
      scene,
      player,
      playerPos: player.position,
      foodWorld,
      bubbles,
      bodies,
      tipProto: foodProtos && foodProtos['items/Tip'],
      hands: getHands ? getHands() : null,
      indoorNodes,
      groundY: (gx, gz) => player.groundY(gx, gz),
      resolveXZ: (gx, gz, r, skip) => player.resolveXZ(gx, gz, r, skip),
      slideXZ: (x0, z0, x1, z1, r, skip) => player.slideXZ(x0, z0, x1, z1, r, skip),
    }
  }

  function update(dt, T) {
    switches.update(dt)
    if (!world) return
    dt = Math.min(dt, 0.1)
    const c = ctx(dt, T)
    SpawnCustomer.update(world, dt, c)
    Locomotion.update(world, dt, c)
    Rigidbody.update(world, dt)
    Queue.update(world)
    OrderTake.update(world)
    TableAssign.update(world)
    SeatArrive.update(world)
    WaitLook.update(world, dt, c)
    Patience.update(world, dt, c)
    Think.update(world, dt, c)
    Serve.update(world, c)
    Tip.update(world, c)
    Register.update(world, c)
    for (const { payload } of world.drain('TipCollected')) {
      paintRegister(payload.money)
    }
    Speech.update(world, c)
    View.update(world)
    syncTickets()
    world.drain()
  }

  return {
    object, update, viewSpot, lookLabel, tryPress,
    confirm: confirmOrder, spawnNow, dropPlated, dump,
    get overlayOpen() { return overlayOpen },
    close: closeOverlay,
    posKiosk, wallPosters,
    width: BOOTH_W, depth: BOOTH_D, height: BOOTH_H,
    spots: {
      door: doorWpos, street: streetWpos, pos: posWpos, register: regWpos,
      staff: staffWpos, pass: passWpos, back: backWpos, window: winLook,
      numberStand: numberStandPos, staffMenu: worldOf(menuX, menuY, menuZ),
    },
  }
}
