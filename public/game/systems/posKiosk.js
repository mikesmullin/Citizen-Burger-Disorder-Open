// In-world POS / order-computer exhibit. Original nComputer GUI is replaced
// with a clickable kiosk using the NavigationGraphics PNGs.

import * as THREE from 'three'
import { setPosOpen, posClicksBlocked } from './touch.js'

const PRESS_RANGE = 5.8
const SCREEN_W = 1.28
const SCREEN_H = 0.82

const SCREENS = [
  { id: 'home', bg: './assets/textures/pos/blue-background.png', title: 'POS · home' },
  { id: 'orders', bg: './assets/textures/pos/background-3split.png', title: 'New order' },
  { id: 'split3', bg: './assets/textures/pos/background-3-1split.png', title: 'Order split' },
  { id: 'burgers', bg: './assets/textures/pos/set-burgers.png', title: 'Set burgers' },
  { id: 'burgers2', bg: './assets/textures/pos/set-burgers-02.png', title: 'Set burgers 2' },
  { id: 'table', bg: './assets/textures/pos/set-table-number.png', title: 'Table number' },
  { id: 'split', bg: './assets/textures/pos/background-1split.png', title: 'Ticket split' },
]

const BUTTONS = [
  { id: 'neworder', file: './assets/textures/pos/neworder.png', caption: 'New order', screen: 'orders' },
  { id: 'menu', file: './assets/textures/pos/OrderMenuIcon.png', caption: 'Menu', screen: 'burgers' },
  { id: 'burgers', file: './assets/textures/pos/set-burgers-1.png', caption: 'Burgers', screen: 'burgers2' },
  { id: 'table', file: './assets/textures/pos/set-table-number.png', caption: 'Table', screen: 'table' },
  { id: 'cancel', file: './assets/textures/pos/CancelOrderIcon.png', caption: 'Cancel', screen: 'home' },
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
  if (document.getElementById('pos-terminal')) return
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
      position:relative; height:min(380px, 48vh); background:#123; overflow:hidden;
      border:1px solid #3a322c; border-radius:6px;
    }
    #pos-terminal .screen img { width:100%; height:100%; object-fit:cover; display:block; }
    #pos-terminal .caption {
      position:absolute; left:12px; bottom:10px; background:#14110ee6;
      border:1px solid #6b5a45; border-radius:4px; padding:4px 10px; font-size:13px;
    }
    #pos-terminal .keys {
      display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center;
    }
    #pos-terminal .keys button {
      width:56px; height:56px; padding:4px; background:#2a241f; border:1px solid #4a4038;
      border-radius:8px; cursor:pointer;
    }
    #pos-terminal .keys button:hover { background:#3a322c; }
    #pos-terminal .keys button img { width:100%; height:100%; object-fit:contain; }
    #pos-terminal .keys .close {
      margin-left:auto; width:auto; height:auto; padding:8px 14px;
      color:#f0e6d4; font:13px ui-sans-serif, system-ui, sans-serif; letter-spacing:.06em;
    }
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
      <div class="keys"></div>
    </div>
  `
  document.body.appendChild(wrap)
}

export function createPosKiosk({
  scene, player,
  x = 0, y = 0, z = 0, yaw = 0,
  parent = null, countertop = false, skipCollider = false,
  onOpen, onClose,
} = {}) {
  const object = new THREE.Group()
  object.name = 'PosKiosk'
  object.position.set(x, y, z)
  object.rotation.y = yaw
  if (parent) parent.add(object)
  else scene.add(object)

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.2 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.4, metalness: 0.25 })
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.6 })

  const sw = countertop ? 0.72 : SCREEN_W
  const sh = countertop ? 0.46 : SCREEN_H
  const tilt = countertop ? -0.22 : -0.18
  const screens = {}

  if (countertop) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.50), bodyMat)
    pad.position.set(0, 0.03, 0)
    pad.castShadow = pad.receiveShadow = true
    object.add(pad)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.08, sh + 0.08, 0.06), trimMat)
    bezel.position.set(0, 0.38, 0.02)
    bezel.rotation.x = tilt
    object.add(bezel)
    for (const s of SCREENS) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshBasicMaterial({ map: loadMap(s.bg) }),
      )
      mesh.position.set(0, 0.38, 0.055)
      mesh.rotation.x = tilt
      mesh.visible = s.id === 'home'
      mesh.userData.posScreen = s.id
      object.add(mesh)
      screens[s.id] = mesh
    }
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
    title.position.set(0, 0.66, 0.01)
    object.add(title)
    BUTTONS.forEach((b, i) => {
      const bx = -0.32 + i * 0.16
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.13),
        new THREE.MeshBasicMaterial({ map: loadMap(b.file), transparent: true }),
      )
      mesh.position.set(bx, 0.09, 0.20)
      mesh.userData.posButton = b
      object.add(mesh)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.03), btnMat)
      plate.position.set(bx, 0.085, 0.175)
      plate.userData.posButton = b
      object.add(plate)
    })
  } else {
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 0.7), bodyMat)
    pedestal.position.y = 0.52
    pedestal.castShadow = pedestal.receiveShadow = true
    object.add(pedestal)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.16), bodyMat)
    neck.position.set(0, 1.22, -0.08)
    object.add(neck)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.1, sh + 0.1, 0.08), trimMat)
    bezel.position.set(0, 1.72, 0.18)
    bezel.rotation.x = tilt
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
    object.add(title)
    BUTTONS.forEach((b, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.22),
        new THREE.MeshBasicMaterial({ map: loadMap(b.file), transparent: true }),
      )
      mesh.position.set(-0.48 + i * 0.24, 1.18, 0.38)
      mesh.userData.posButton = b
      object.add(mesh)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), btnMat)
      plate.position.copy(mesh.position)
      plate.position.z -= 0.025
      plate.userData.posButton = b
      object.add(plate)
    })
  }

  if (!skipCollider) {
    player.addCollider(
      { x: x - 0.7, z: z - 0.5 },
      { x: x + 0.7, z: z + 0.5 },
    )
  }

  let screen = 'home'
  let open = false
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  ensureOverlay()
  const overlay = document.getElementById('pos-terminal')
  const overlayImg = overlay.querySelector('.screen img')
  const overlayCap = overlay.querySelector('.caption')
  const overlayKeys = overlay.querySelector('.keys')
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
      show(b.screen)
    })
    overlayKeys.appendChild(btn)
  }
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'close'
  closeBtn.textContent = 'close'
  closeBtn.addEventListener('click', e => {
    e.stopPropagation()
    close()
  })
  overlayKeys.appendChild(closeBtn)
  overlay.addEventListener('pointerdown', e => {
    if (e.target !== overlay) return
    e.preventDefault()
    e.stopPropagation()
    close()
  })

  function paintOverlay() {
    const s = SCREENS.find(x => x.id === screen) || SCREENS[0]
    overlayImg.src = s.bg
    overlayCap.textContent = s.title
  }

  function show(id) {
    if (!screens[id]) id = 'home'
    screen = id
    for (const [k, mesh] of Object.entries(screens)) mesh.visible = k === id
    paintOverlay()
  }

  function openTerminal() {
    if (open) return
    open = true
    overlay.classList.add('open')
    paintOverlay()
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

  function tryPress() {
    if (open) return false
    if (posClicksBlocked()) return false
    if (!player.locked) return false
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    for (const h of hits) {
      if (h.distance > PRESS_RANGE) continue
      const b = h.object.userData.posButton
      if (b) { show(b.screen); openTerminal(); return true }
      if (h.object.userData.posScreen) { openTerminal(); return true }
    }
    if (hits.length && hits[0].distance <= PRESS_RANGE) {
      openTerminal()
      return true
    }
    return false
  }

  function lookLabel() {
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return ''
    const b = hits[0].object.userData.posButton
    if (b) return 'POS  ·  ' + b.caption
    const s = SCREENS.find(x => x.id === screen)
    return (s && s.title) + '  ·  click a button'
  }

  function viewSpot() {
    object.updateMatrixWorld(true)
    const look = new THREE.Vector3()
    object.getWorldPosition(look)
    look.y += countertop ? 0.42 : 1.55
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

  return {
    object, tryPress, lookLabel, viewSpot, show, open: openTerminal, close,
    get isOpen() { return open },
    width: countertop ? 0.9 : 1.4,
    depth: countertop ? 0.55 : 1.1,
    height: countertop ? 0.7 : 2.3,
  }
}
