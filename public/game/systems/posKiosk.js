// In-world POS / order-computer exhibit. Original nComputer GUI is replaced
// with a clickable kiosk using the NavigationGraphics PNGs.

import * as THREE from 'three'

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
      display:none; position:fixed; inset:0; z-index:8;
      background:#0c0a08cc; align-items:center; justify-content:center;
    }
    #pos-terminal.open { display:flex; }
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

export function createPosKiosk({ scene, player, x = 0, z = 0, onOpen, onClose } = {}) {
  const object = new THREE.Group()
  object.name = 'PosKiosk'
  object.position.set(x, 0, z)
  scene.add(object)

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.2 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.4, metalness: 0.25 })

  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 0.7), bodyMat)
  pedestal.position.y = 0.52
  pedestal.castShadow = pedestal.receiveShadow = true
  object.add(pedestal)
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.16), bodyMat)
  neck.position.set(0, 1.22, -0.08)
  object.add(neck)
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.1, SCREEN_H + 0.1, 0.08), trimMat)
  bezel.position.set(0, 1.72, 0.18)
  bezel.rotation.x = -0.18
  object.add(bezel)

  const screens = {}
  for (const s of SCREENS) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
      new THREE.MeshBasicMaterial({ map: loadMap(s.bg) }),
    )
    mesh.position.set(0, 1.72, 0.23)
    mesh.rotation.x = -0.18
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

  const btns = []
  BUTTONS.forEach((b, i) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: loadMap(b.file), transparent: true }),
    )
    mesh.position.set(-0.48 + i * 0.24, 1.18, 0.38)
    mesh.userData.posButton = b
    object.add(mesh)
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.6 }),
    )
    plate.position.copy(mesh.position)
    plate.position.z -= 0.025
    plate.userData.posButton = b
    object.add(plate)
    btns.push({ spec: b, mesh, plate })
  })

  player.addCollider(
    { x: x - 0.7, z: z - 0.5 },
    { x: x + 0.7, z: z + 0.5 },
  )

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
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close()
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
  }

  function close() {
    if (!open) return
    open = false
    overlay.classList.remove('open')
    if (onClose) onClose()
  }

  function tryPress() {
    if (open) return false
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
    return {
      stand: { x, z: z + 2.2 },
      look: { x, y: 1.55, z },
    }
  }

  addEventListener('keydown', e => {
    if (e.code === 'Escape' && open) close()
  })

  return {
    object, tryPress, lookLabel, viewSpot, show, open: openTerminal, close,
    get isOpen() { return open },
    width: 1.4, depth: 1.1, height: 2.3,
  }
}
