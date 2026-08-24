// In-world order computer. nComputer GUI is a clickable kiosk: PNG chrome,
// live burger draft, confirm → OrderTake. The till (cash drawer) is the
// base the monitor sits on — tips touching this station hit the register.

import * as THREE from 'three'
import { ITEM_NAMES } from '../gamedata/menu.js'
import { setPosOpen, posClicksBlocked } from './touch.js'

const PRESS_RANGE = 5.8
const SCREEN_W = 1.28
const SCREEN_H = 0.82

const SCREENS = [
  { id: 'home', bg: './assets/textures/pos/blue-background.png', title: 'Order computer' },
  { id: 'orders', bg: './assets/textures/pos/background-3split.png', title: 'New order' },
  { id: 'split3', bg: './assets/textures/pos/background-3-1split.png', title: 'Order split' },
  { id: 'burgers', bg: './assets/textures/pos/set-burgers.png', title: 'Set burgers' },
  { id: 'burgers2', bg: './assets/textures/pos/set-burgers-02.png', title: 'Set burgers 2' },
  { id: 'table', bg: './assets/textures/pos/set-table-number.png', title: 'Table' },
  { id: 'split', bg: './assets/textures/pos/background-1split.png', title: 'Ticket split' },
]

const BUTTONS = [
  { id: 'neworder', file: './assets/textures/pos/neworder.png', caption: 'New order', action: 'burgers' },
  { id: 'menu', file: './assets/textures/pos/OrderMenuIcon.png', caption: 'Menu', action: 'burgers' },
  { id: 'burgers', file: './assets/textures/pos/set-burgers-1.png', caption: 'Burgers', action: 'burgers' },
  { id: 'table', file: './assets/textures/pos/set-table-number.png', caption: 'Table', action: 'table' },
  { id: 'cancel', file: './assets/textures/pos/CancelOrderIcon.png', caption: 'Cancel', action: 'cancel' },
]

function loadMap(url) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.flipY = true
  return t
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ensureOverlay() {
  const existing = document.getElementById('pos-terminal')
  if (existing && existing.querySelector('#order-computer-draft')) return
  if (existing) existing.remove()
  const css = document.createElement('style')
  css.textContent = `
    #pos-terminal {
      display:none; position:fixed; inset:0; z-index:9;
      background:#0c0a08cc; align-items:center; justify-content:center;
      pointer-events:none;
    }
    #pos-terminal.open { display:flex; pointer-events:auto; }
    #pos-terminal .bezel {
      width:min(720px, 92vw); background:#1c1814; border:2px solid #6b5a45;
      border-radius:12px; padding:16px 16px 12px; box-shadow:0 18px 50px #0008;
      font:14px/1.4 ui-sans-serif, system-ui, sans-serif; color:#f0e6d4;
    }
    #pos-terminal .title {
      letter-spacing:.14em; font-weight:700; font-size:12px;
      color:#c4a574; margin-bottom:10px; text-transform:uppercase;
    }
    #pos-terminal .screen {
      position:relative; height:min(280px, 36vh); background:#123; overflow:hidden;
      border:1px solid #3a322c; border-radius:6px;
    }
    #pos-terminal .screen img { width:100%; height:100%; object-fit:cover; display:block; }
    #pos-terminal .caption {
      position:absolute; left:12px; bottom:10px; background:#14110ee6;
      border:1px solid #6b5a45; border-radius:4px; padding:4px 10px; font-size:13px;
    }
    #pos-terminal .draft {
      min-height:40px; background:#14110e; border:1px solid #3a322c;
      border-radius:6px; padding:8px 12px; margin-top:10px;
    }
    #pos-terminal .burgers { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    #pos-terminal .burgers button, #pos-terminal .row button {
      background:#2a241f; color:#f0e6d4; border:1px solid #4a4038;
      border-radius:8px; padding:8px 12px; cursor:pointer;
      font:13px ui-sans-serif, system-ui, sans-serif;
    }
    #pos-terminal .burgers button:hover, #pos-terminal .row button:hover { background:#3a322c; }
    #pos-terminal .burgers.hidden { display:none; }
    #pos-terminal .table-note {
      margin-top:10px; color:#9a8f80; font-size:13px;
    }
    #pos-terminal .table-note.hidden { display:none; }
    #pos-terminal .keys {
      display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center;
    }
    #pos-terminal .keys button {
      width:56px; height:56px; padding:4px; background:#2a241f; border:1px solid #4a4038;
      border-radius:8px; cursor:pointer;
    }
    #pos-terminal .keys button:hover { background:#3a322c; }
    #pos-terminal .keys button img { width:100%; height:100%; object-fit:contain; }
    #pos-terminal .row { display:flex; gap:8px; margin-top:12px; align-items:center; }
    #pos-terminal .row .close { margin-left:auto; }
    #pos-terminal .hint { color:#9a8f80; font-size:12px; margin-top:8px; }
  `
  document.head.appendChild(css)
  const wrap = document.createElement('div')
  wrap.id = 'pos-terminal'
  wrap.innerHTML = `
    <div class="bezel">
      <div class="title">Order computer</div>
      <div class="screen">
        <img alt="">
        <div class="caption"></div>
      </div>
      <div class="draft" id="order-computer-draft">empty ticket (max 4)</div>
      <div class="burgers" id="order-computer-burgers"></div>
      <div class="table-note hidden" id="order-computer-table"></div>
      <div class="keys"></div>
      <div class="row">
        <button type="button" id="order-computer-confirm">Confirm</button>
        <button type="button" id="order-computer-reset">Reset</button>
        <button type="button" class="close" id="order-computer-close">close</button>
      </div>
      <div class="hint" id="order-computer-hint"></div>
    </div>
  `
  document.body.appendChild(wrap)
  const burgers = wrap.querySelector('#order-computer-burgers')
  for (const name of ITEM_NAMES) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = name
    btn.dataset.item = name
    burgers.appendChild(btn)
  }
}

export function createPosKiosk({
  scene, player,
  x = 0, y = 0, z = 0, yaw = 0,
  parent = null, countertop = false, skipCollider = false,
  onOpen, onClose, onConfirm, getHint,
} = {}) {
  const object = new THREE.Group()
  object.name = 'OrderComputer'
  object.position.set(x, y, z)
  object.rotation.y = yaw
  if (parent) parent.add(object)
  else scene.add(object)

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.2 })
  const tillMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.62, metalness: 0.08 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.4, metalness: 0.25 })
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.6 })

  const sw = countertop ? 0.72 : SCREEN_W
  const sh = countertop ? 0.46 : SCREEN_H
  const tilt = countertop ? -0.22 : -0.18
  const screens = {}
  let tillMap = null
  let tillCtx = null
  let liveMap = null
  let liveCtx = null
  let liveCanvas = null
  let money = 100
  let draft = []
  let assignedTable = 0
  let confirmHint = ''
  let screen = 'home'
  let open = false

  function markComputer(mesh, extra = {}) {
    Object.assign(mesh.userData, { orderComputer: true, ...extra })
  }

  if (countertop) {
    // Cash drawer under the monitor — modern POS: till box + screen on top.
    const till = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.54), tillMat)
    till.position.set(0, 0.12, 0)
    till.castShadow = till.receiveShadow = true
    markComputer(till, { till: true })
    object.add(till)
    const tillCanvas = document.createElement('canvas')
    tillCanvas.width = 256
    tillCanvas.height = 96
    tillCtx = tillCanvas.getContext('2d')
    tillMap = new THREE.CanvasTexture(tillCanvas)
    tillMap.colorSpace = THREE.SRGBColorSpace
    const tillDisp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.16),
      new THREE.MeshBasicMaterial({ map: tillMap, toneMapped: false }),
    )
    tillDisp.position.set(0, 0.12, 0.272)
    markComputer(tillDisp, { till: true })
    object.add(tillDisp)

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.08), bodyMat)
    neck.position.set(0, 0.29, -0.06)
    markComputer(neck)
    object.add(neck)

    const screenY = 0.56
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.08, sh + 0.08, 0.06), trimMat)
    bezel.position.set(0, screenY, 0.02)
    bezel.rotation.x = tilt
    markComputer(bezel)
    object.add(bezel)
    for (const s of SCREENS) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshBasicMaterial({ map: loadMap(s.bg) }),
      )
      mesh.position.set(0, screenY, 0.055)
      mesh.rotation.x = tilt
      mesh.visible = s.id === 'home'
      mesh.userData.posScreen = s.id
      markComputer(mesh)
      object.add(mesh)
      screens[s.id] = mesh
    }
    liveCanvas = document.createElement('canvas')
    liveCanvas.width = 512
    liveCanvas.height = 220
    liveCtx = liveCanvas.getContext('2d')
    liveMap = new THREE.CanvasTexture(liveCanvas)
    liveMap.colorSpace = THREE.SRGBColorSpace
    const livePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(sw * 0.92, sh * 0.42),
      new THREE.MeshBasicMaterial({ map: liveMap, transparent: true, toneMapped: false }),
    )
    livePlane.position.set(0, screenY - 0.08, 0.062)
    livePlane.rotation.x = tilt
    livePlane.raycast = () => {}
    object.add(livePlane)

    const titleMap = canvasTexture(512, 64, (g, w, h) => {
      g.fillStyle = '#14110e'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#f0e6d4'
      g.font = '700 36px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('ORDER COMPUTER', w / 2, h / 2 + 2)
    })
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.09),
      new THREE.MeshBasicMaterial({ map: titleMap }),
    )
    title.position.set(0, 0.86, 0.01)
    title.raycast = () => {}
    object.add(title)
    BUTTONS.forEach((b, i) => {
      const bx = -0.32 + i * 0.16
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.13),
        new THREE.MeshBasicMaterial({ map: loadMap(b.file), transparent: true }),
      )
      mesh.position.set(bx, 0.28, 0.22)
      mesh.userData.posButton = b
      markComputer(mesh)
      object.add(mesh)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.03), btnMat)
      plate.position.set(bx, 0.275, 0.195)
      plate.userData.posButton = b
      markComputer(plate)
      object.add(plate)
    })
  } else {
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 0.7), bodyMat)
    pedestal.position.y = 0.52
    pedestal.castShadow = pedestal.receiveShadow = true
    markComputer(pedestal)
    object.add(pedestal)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.16), bodyMat)
    neck.position.set(0, 1.22, -0.08)
    markComputer(neck)
    object.add(neck)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.1, sh + 0.1, 0.08), trimMat)
    bezel.position.set(0, 1.72, 0.18)
    bezel.rotation.x = tilt
    markComputer(bezel)
    object.add(bezel)
    for (const s of SCREENS) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshBasicMaterial({ map: loadMap(s.bg) }),
      )
      mesh.position.set(0, 1.72, 0.23)
      mesh.rotation.x = tilt
      mesh.visible = s.id === 'home'
      mesh.userData.posScreen = s.id
      markComputer(mesh)
      object.add(mesh)
      screens[s.id] = mesh
    }
    const titleMap = canvasTexture(768, 96, (g, w, h) => {
      g.fillStyle = '#14110e'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#f0e6d4'
      g.font = '700 44px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.fillText('ORDER COMPUTER', w / 2, 62)
    })
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.18),
      new THREE.MeshBasicMaterial({ map: titleMap }),
    )
    title.position.set(0, 2.28, 0.12)
    title.raycast = () => {}
    object.add(title)
    BUTTONS.forEach((b, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.22),
        new THREE.MeshBasicMaterial({ map: loadMap(b.file), transparent: true }),
      )
      mesh.position.set(-0.48 + i * 0.24, 1.18, 0.38)
      mesh.userData.posButton = b
      markComputer(mesh)
      object.add(mesh)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), btnMat)
      plate.position.copy(mesh.position)
      plate.position.z -= 0.025
      plate.userData.posButton = b
      markComputer(plate)
      object.add(plate)
    })
  }

  if (!skipCollider) {
    player.addCollider(
      { x: x - 0.7, z: z - 0.5 },
      { x: x + 0.7, z: z + 0.5 },
    )
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  ensureOverlay()
  const overlay = document.getElementById('pos-terminal')
  const overlayImg = overlay.querySelector('.screen img')
  const overlayCap = overlay.querySelector('.caption')
  const overlayKeys = overlay.querySelector('.keys')
  const draftEl = overlay.querySelector('#order-computer-draft')
  const hintEl = overlay.querySelector('#order-computer-hint')
  const burgersEl = overlay.querySelector('#order-computer-burgers')
  const tableEl = overlay.querySelector('#order-computer-table')
  overlayKeys.innerHTML = ''
  for (const b of BUTTONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = b.caption
    const img = document.createElement('img')
    img.src = b.file
    img.alt = b.caption
    btn.appendChild(img)
    btn.addEventListener('click', e => {
      e.stopPropagation()
      pressAction(b.action)
    })
    overlayKeys.appendChild(btn)
  }

  function queueHint() {
    if (confirmHint) return confirmHint
    return getHint ? getHint() : ''
  }

  function paintLive() {
    const s = SCREENS.find(x => x.id === screen) || SCREENS[0]
    overlayImg.src = s.bg
    overlayCap.textContent = s.title
    const ticket = draft.length ? draft.join(', ') : 'empty ticket (max 4)'
    draftEl.textContent = ticket
    hintEl.textContent = queueHint()
    const showBurgers = screen !== 'table'
    burgersEl.classList.toggle('hidden', !showBurgers)
    if (screen === 'table') {
      tableEl.classList.remove('hidden')
      tableEl.textContent = assignedTable
        ? 'Assigned table ' + assignedTable + ' (read-only)'
        : 'Table is assigned at confirm — not a player input'
    } else {
      tableEl.classList.add('hidden')
    }
    if (liveCtx && liveCanvas) {
      const g = liveCtx
      const w = liveCanvas.width
      const h = liveCanvas.height
      g.clearRect(0, 0, w, h)
      g.fillStyle = '#14110ee8'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#6b5a45'
      g.strokeRect(4, 4, w - 8, h - 8)
      g.fillStyle = '#f0e6d4'
      g.font = '700 28px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(draft.length ? draft.join('  ·  ') : 'empty ticket', w / 2, h * 0.38)
      g.fillStyle = '#c4a574'
      g.font = '600 22px ui-sans-serif, system-ui, sans-serif'
      const sub = assignedTable
        ? 'table ' + assignedTable
        : (queueHint() || 'click to take an order')
      g.fillText(sub, w / 2, h * 0.72)
      liveMap.needsUpdate = true
    }
  }

  function paintRegister(n) {
    if (n != null) money = n
    if (tillCtx && tillMap) {
      const g = tillCtx
      g.fillStyle = '#0b1a12'
      g.fillRect(0, 0, 256, 96)
      g.fillStyle = '#3dff9a'
      g.font = '700 48px ui-monospace, monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('$' + Math.round(money), 128, 50)
      tillMap.needsUpdate = true
    }
  }
  paintRegister(100)

  function show(id) {
    if (!screens[id]) id = 'home'
    screen = id
    for (const [k, mesh] of Object.entries(screens)) mesh.visible = k === id
    paintLive()
  }

  function resetDraft() {
    draft = []
    confirmHint = ''
    paintLive()
  }

  function doConfirm() {
    if (!onConfirm) return
    const r = onConfirm(draft.slice())
    if (r && r.tableId) {
      assignedTable = r.tableId
      draft = []
      confirmHint = 'table ' + r.tableId + ' — throw a number stand'
      paintLive()
      close()
      return
    }
    confirmHint = (r && r.error === 'noTable')
      ? 'no table free'
      : (r && r.error === 'noQueue')
        ? 'no one at slot 1 — queue a customer first'
        : 'could not confirm'
    paintLive()
  }

  function pressAction(action) {
    confirmHint = ''
    if (action === 'cancel') {
      resetDraft()
      show('home')
      return
    }
    if (action === 'table') {
      show('table')
      return
    }
    show('burgers')
  }

  function openTerminal() {
    if (open) return
    open = true
    overlay.classList.add('open')
    paintLive()
    if (onOpen) onOpen()
    setPosOpen(true)
  }

  function close() {
    if (!open) return
    open = false
    overlay.classList.remove('open')
    if (onClose) onClose()
    setPosOpen(false)
  }

  burgersEl.onclick = e => {
    const name = e.target && e.target.dataset && e.target.dataset.item
    if (!name) return
    if (draft.length >= 4) return
    draft.push(name)
    confirmHint = ''
    paintLive()
  }
  overlay.querySelector('#order-computer-confirm').onclick = e => {
    e.stopPropagation()
    doConfirm()
  }
  overlay.querySelector('#order-computer-reset').onclick = e => {
    e.stopPropagation()
    resetDraft()
  }
  overlay.querySelector('#order-computer-close').onclick = e => {
    e.stopPropagation()
    close()
  }
  overlay.addEventListener('pointerdown', e => {
    if (e.target !== overlay) return
    e.preventDefault()
    e.stopPropagation()
    close()
  })

  function tryPress() {
    if (open) return false
    if (posClicksBlocked()) return false
    if (!player.locked) return false
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    for (const h of hits) {
      if (h.distance > PRESS_RANGE) continue
      const b = h.object.userData.posButton
      if (b) { pressAction(b.action); openTerminal(); return true }
      if (h.object.userData.posScreen || h.object.userData.orderComputer) {
        openTerminal()
        return true
      }
    }
    if (hits.length && hits[0].distance <= PRESS_RANGE) {
      openTerminal()
      return true
    }
    return false
  }

  function lookLabel() {
    if (open) return 'ORDER COMPUTER · taking an order'
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return ''
    const b = hits[0].object.userData.posButton
    if (b) return 'ORDER COMPUTER  ·  ' + b.caption
    if (hits[0].object.userData.till) return 'ORDER COMPUTER  ·  till $' + Math.round(money)
    return 'ORDER COMPUTER  ·  take an order'
  }

  function viewSpot() {
    object.updateMatrixWorld(true)
    const look = new THREE.Vector3()
    object.getWorldPosition(look)
    look.y += countertop ? 0.52 : 1.55
    const stand = look.clone()
    const off = new THREE.Vector3(0, 0, countertop ? 1.35 : 2.2)
    off.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()))
    stand.add(off)
    stand.y = 0
    return { stand, look }
  }

  addEventListener('keydown', e => {
    if (e.code === 'Escape' && open) close()
  })

  paintLive()

  return {
    object, tryPress, lookLabel, viewSpot, show, open: openTerminal, close,
    paintRegister, paintLive,
    get isOpen() { return open },
    get money() { return money },
    get assignedTable() { return assignedTable },
    width: countertop ? 0.95 : 1.4,
    depth: countertop ? 0.58 : 1.1,
    height: countertop ? 0.9 : 2.3,
  }
}
