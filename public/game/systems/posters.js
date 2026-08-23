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
    map, color: 0xffffff, roughness: 0.72, metalness: 0.02, side: THREE.FrontSide,
  })
  const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat)
  face.castShadow = true
  g.add(face)
  return g
}

function atlasMaterial(map) {
  const mat = new THREE.MeshStandardMaterial({
    map, color: 0xffffff, roughness: 0.72, metalness: 0.02, side: THREE.FrontSide,
  })
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 instanceUv;
varying vec4 vInstanceUv;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vInstanceUv = instanceUv;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vInstanceUv;`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv * vInstanceUv.zw + vInstanceUv.xy );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,
      )
  }
  mat.customProgramCacheKey = () => 'poster-atlas-uv'
  return mat
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
    new THREE.MeshBasicMaterial({ map: signMap, side: THREE.FrontSide }),
  )
  sign.position.set(0, 2.12, 0.2)
  object.add(sign)

  let index = 0
  const n = POSTERS.length
  const _dummy = new THREE.Object3D()
  let carousel = null

  function layout() {
    if (!carousel) return
    const step = (Math.PI * 2) / n
    const ringReach = Math.sqrt(RADIUS * RADIUS + (PW * 0.78) ** 2)
    const displayZ = ringReach + 0.12
    for (let i = 0; i < n; i++) {
      const k = (i - index + n) % n
      if (k === 0) {
        _dummy.position.set(0, 1.15, displayZ)
        _dummy.rotation.set(0, 0, 0)
        _dummy.scale.setScalar(1)
      } else {
        const a = k * step
        const off = (PW / 2) * 0.78
        _dummy.position.set(
          Math.sin(a) * RADIUS + Math.cos(a) * off,
          1.15,
          Math.cos(a) * RADIUS - Math.sin(a) * off,
        )
        _dummy.rotation.set(0, a, 0)
        _dummy.scale.setScalar(0.78)
      }
      _dummy.updateMatrix()
      carousel.setMatrixAt(i, _dummy.matrix)
    }
    carousel.instanceMatrix.needsUpdate = true
  }

  fetch('./assets/textures/posters/atlas.json')
    .then(r => { if (!r.ok) throw new Error('no atlas'); return r.json() })
    .then(meta => {
      const map = loadMap(meta.image)
      const geo = new THREE.PlaneGeometry(PW, PH)
      const uv = new Float32Array(n * 4)
      for (let i = 0; i < n; i++) {
        const f = meta.frames[POSTERS[i].id]
        if (!f) continue
        uv[i * 4] = f.u
        uv[i * 4 + 1] = f.v
        uv[i * 4 + 2] = f.du
        uv[i * 4 + 3] = f.dv
      }
      geo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(uv, 4))
      carousel = new THREE.InstancedMesh(geo, atlasMaterial(map), n)
      carousel.count = n
      carousel.castShadow = true
      carousel.frustumCulled = false
      carousel.name = 'PosterCarousel'
      carousel.userData.posterKiosk = true
      carousel.userData.byInstance = POSTERS.map(p => ({ poster: p, posterKiosk: true }))
      object.add(carousel)
      layout()
    })
    .catch(err => {
      console.warn('[posters] atlas missing, one mesh per sheet', err)
      POSTERS.forEach(spec => {
        const sheet = makeSheet(loadMap(spec.file))
        sheet.userData.poster = spec
        sheet.traverse(o => { o.userData.poster = spec; o.userData.posterKiosk = true })
        object.add(sheet)
      })
    })

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
    const hit = hits[0]
    const spec = hit.object.userData.poster
      || (hit.object.userData.byInstance && hit.instanceId != null
        && hit.object.userData.byInstance[hit.instanceId]?.poster)
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
