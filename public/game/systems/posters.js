// Circular poster kiosk: rolodex around a round rack. Click (no hands up)
// to step through the stack; grab with Q/E to take a copy onto the floor.

import * as THREE from 'three'

export const POSTERS = [
  { id: 'CoverYourBurger', file: './assets/textures/posters/CoverYourBurger.png', caption: 'Cover your burger' },
  { id: 'Poster2', file: './assets/textures/posters/Poster2.png', caption: 'Poster 2' },
  { id: 'MenuBoard', file: './assets/textures/posters/MenuBoard.png', caption: 'Menu board' },
  { id: 'DoubleCheese', file: './assets/textures/posters/DoubleCheese.png', caption: 'Double cheese' },
  { id: 'WhyIsAustraliaSo', file: './assets/textures/posters/WhyIsAustraliaSo.png', caption: 'Why is Australia so' },
  { id: '5gDMYkH', file: './assets/textures/posters/5gDMYkH.png', caption: 'Promo 5gDMYkH' },
  { id: 'BLCkYpI', file: './assets/textures/posters/BLCkYpI.png', caption: 'Promo BLCkYpI' },
  { id: 'jTZL8p0', file: './assets/textures/posters/jTZL8p0.png', caption: 'Promo jTZL8p0' },
  { id: 'n0kvMQ6', file: './assets/textures/posters/n0kvMQ6.png', caption: 'Promo n0kvMQ6' },
  { id: 'N1psFxI', file: './assets/textures/posters/N1psFxI.png', caption: 'Promo N1psFxI' },
  { id: 'o41Pq', file: './assets/textures/posters/o41Pq.png', caption: 'Promo o41Pq' },
  { id: 'VF9IcfX', file: './assets/textures/posters/VF9IcfX.png', caption: 'Promo VF9IcfX' },
  { id: 'Vq6ad', file: './assets/textures/posters/Vq6ad.png', caption: 'Promo Vq6ad' },
  { id: 'wS8OjJU', file: './assets/textures/posters/wS8OjJU.png', caption: 'Promo wS8OjJU' },
]

const PW = 1.05
const PH = 1.45
const PT = 0.02
const RADIUS = 0.72
const PRESS_RANGE = 6.5

function loadMap(url) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
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

function makeSheet(map) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    map, color: 0xffffff, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide,
  })
  const face = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, PT), mat)
  face.castShadow = true
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(PW + 0.02, PH + 0.02, PT * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.8 }),
  )
  back.position.z = -PT * 0.4
  g.add(back, face)
  return g
}

export function createPosters({ scene, player, foodWorld, x = 0, z = 0 } = {}) {
  const object = new THREE.Group()
  object.name = 'PosterKiosk'
  object.position.set(x, 0, z)
  scene.add(object)

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.85, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a322c, metalness: 0.35, roughness: 0.45 }),
  )
  pole.position.y = 0.92
  pole.castShadow = true
  object.add(pole)
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.82, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 0.6 }),
  )
  cap.position.y = 1.88
  object.add(cap)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.05, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.7 }),
  )
  base.position.y = 0.06
  base.receiveShadow = true
  object.add(base)

  const signMap = canvasTexture(768, 160, (g, w, h) => {
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.font = '700 56px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('POSTERS', w / 2, 70)
    g.fillStyle = '#c4a574'
    g.font = '24px ui-sans-serif, system-ui, sans-serif'
    g.fillText('click to flip  ·  grab a copy', w / 2, 122)
  })
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.34),
    new THREE.MeshBasicMaterial({ map: signMap }),
  )
  sign.position.set(0, 2.12, 0.2)
  object.add(sign)

  const sheets = POSTERS.map((spec, i) => {
    const sheet = makeSheet(loadMap(spec.file))
    sheet.userData.poster = spec
    sheet.traverse(o => { o.userData.poster = spec; o.userData.posterKiosk = true })
    object.add(sheet)
    return sheet
  })

  let index = 0
  const n = sheets.length
  const _q = new THREE.Quaternion()
  const _e = new THREE.Euler()

  function layout() {
    const fan = Math.min(5, n)
    for (let i = 0; i < n; i++) {
      const k = (i - index + n) % n
      const sheet = sheets[i]
      sheet.visible = true
      if (k < fan) {
        // Accordion / rolodex at the aisle face — one full poster, the rest stacked.
        const a = 0.15 * k
        sheet.position.set(Math.sin(a) * 0.2, 1.15, RADIUS + 0.22 - k * 0.034)
        sheet.rotation.set(0, a * 0.42, 0)
        sheet.scale.setScalar(1 - k * 0.035)
      } else {
        // Remainder around the pole so walking the kiosk still shows posters.
        const around = k - fan
        const remain = Math.max(1, n - fan)
        const a = 0.7 + (around / remain) * (Math.PI * 2 - 1.25)
        sheet.position.set(Math.sin(a) * RADIUS, 1.15, Math.cos(a) * RADIUS)
        sheet.rotation.set(0, a, 0)
        sheet.scale.setScalar(0.78)
      }
    }
  }
  layout()

  player.addCollider(
    { x: x - 0.9, z: z - 0.9 },
    { x: x + 0.9, z: z + 0.9 },
  )

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  function tryTurn() {
    if (!player.locked) return false
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return false
    const spec = hits[0].object.userData.poster
    if (spec) {
      const i = POSTERS.findIndex(p => p.id === spec.id)
      if (i >= 0 && i !== index) index = i
      else index = (index + 1) % n
    } else {
      index = (index + 1) % n
    }
    layout()
    return true
  }

  function take(spec) {
    const sheet = makeSheet(loadMap(spec.file))
    player.camera.getWorldPosition(sheet.position)
    sheet.position.y -= 0.1
    scene.add(sheet)
    const item = {
      kind: 'swatch',
      type: spec.caption,
      slug: 'posters/' + spec.id,
      object: sheet,
      position: sheet.position,
      radius: 0.4,
      height: PH * 0.15,
      held: false,
      stolen: null,
      opened: false,
      dropped: false,
      vel: new THREE.Vector3(),
      onFloor: false,
      foodBeenOnFloor: false,
      fromSpawner: null,
    }
    sheet.userData.food = item
    sheet.traverse(o => { o.userData.food = item })
    foodWorld.items.push(item)
    return item
  }

  function current() {
    return POSTERS[index]
  }

  function lookLabel() {
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    if (!hits.length || hits[0].distance > PRESS_RANGE) return ''
    return current().caption + '  ·  click to flip  ·  grab a copy'
  }

  function viewSpot() {
    return {
      stand: { x, z: z + 2.6 },
      look: { x, y: 1.2, z },
    }
  }

  return {
    object, tryTurn, take, current, lookLabel, viewSpot,
    posters: POSTERS,
    width: 2.2, depth: 2.2, height: 2.2,
  }
}
