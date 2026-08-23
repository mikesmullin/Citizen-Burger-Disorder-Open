// Instanced thought-bubbles: hall "···" plus the burger-badge icons.
// Planes billboard to the camera each tick. Hidden by scale 0.

import * as THREE from 'three'
import { atlasUvMaterial } from './atlasUv.js'

export const BUBBLE_ICONS = [
  'notice',
  'Citizen', 'Family', 'Worker', 'President', 'Mayor', 'Boss',
  'NumberStand',
]

const BW = 0.72
const BH = 0.54
const _dummy = new THREE.Object3D()
const _q = new THREE.Quaternion()

function paintChrome(g, w, h) {
  g.fillStyle = '#f4fff8'
  g.strokeStyle = '#2a2a2a'
  g.lineWidth = 7
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(108, 114)
  g.lineTo(150, 120)
  g.lineTo(118, 176)
  g.closePath()
  g.fill()
  g.beginPath()
  g.moveTo(108, 114)
  g.lineTo(118, 176)
  g.lineTo(150, 120)
  g.stroke()
  g.beginPath()
  g.ellipse(128, 70, 108, 54, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
}

function bakeAtlas() {
  const n = BUBBLE_ICONS.length
  const canvas = document.createElement('canvas')
  canvas.width = n * 256
  canvas.height = 192
  const g = canvas.getContext('2d')
  const loader = new THREE.TextureLoader()
  const frames = {}
  BUBBLE_ICONS.forEach((id, i) => {
    g.save()
    g.translate(i * 256, 0)
    paintChrome(g, 256, 192)
    if (id === 'notice') {
      g.fillStyle = '#1a1a1a'
      g.font = '700 72px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('···', 128, 74)
    } else if (id === 'NumberStand') {
      g.fillStyle = '#1a1a1a'
      g.font = '700 48px ui-sans-serif, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('#', 128, 80)
    }
    g.restore()
    frames[id] = { u: i / n, v: 0, du: 1 / n, dv: 1 }
  })
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  // Stamp burger badges into the oval once they load.
  for (const id of BUBBLE_ICONS) {
    if (id === 'notice' || id === 'NumberStand') continue
    const i = BUBBLE_ICONS.indexOf(id)
    loader.load(`./assets/textures/badges/${id}.png`, tex => {
      const img = tex.image
      if (!img) return
      g.save()
      g.translate(i * 256, 0)
      paintChrome(g, 256, 192)
      const iw = 150, ih = 90
      g.drawImage(img, 128 - iw / 2, 70 - ih / 2, iw, ih)
      g.restore()
      map.needsUpdate = true
    })
  }
  return { map, frames, n }
}

export function createBubbleField({ scene, max = 48 } = {}) {
  const { map, frames } = bakeAtlas()
  const geo = new THREE.PlaneGeometry(BW, BH)
  const uv = new Float32Array(max * 4)
  const notice = frames.notice
  for (let i = 0; i < max; i++) {
    uv[i * 4] = notice.u
    uv[i * 4 + 1] = notice.v
    uv[i * 4 + 2] = notice.du
    uv[i * 4 + 3] = notice.dv
  }
  geo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(uv, 4))
  const mesh = new THREE.InstancedMesh(
    geo,
    atlasUvMaterial(map, { basic: true, transparent: true, key: 'bubble-atlas' }),
    max,
  )
  mesh.name = 'BubbleInst'
  mesh.count = max
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  scene.add(mesh)

  const free = []
  const used = []
  const state = []
  for (let i = 0; i < max; i++) {
    free.push(i)
    state[i] = { icon: 'notice', visible: false, x: 0, y: -999, z: 0 }
    _dummy.position.set(0, -999, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true

  function alloc() {
    const i = free.pop()
    if (i == null) return -1
    used.push(i)
    return i
  }

  function release(i) {
    if (i == null || i < 0) return
    const k = used.indexOf(i)
    if (k >= 0) used.splice(k, 1)
    free.push(i)
    state[i].visible = false
    _dummy.position.set(0, -999, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }

  function set(i, { x, y, z, icon, visible } = {}) {
    if (i == null || i < 0) return
    const s = state[i]
    if (icon && icon !== s.icon) {
      const f = frames[icon] || frames.notice
      uv[i * 4] = f.u
      uv[i * 4 + 1] = f.v
      uv[i * 4 + 2] = f.du
      uv[i * 4 + 3] = f.dv
      geo.attributes.instanceUv.needsUpdate = true
      s.icon = icon
    }
    if (x != null) s.x = x
    if (y != null) s.y = y
    if (z != null) s.z = z
    if (visible != null) s.visible = !!visible
  }

  function billboard(camera) {
    camera.getWorldQuaternion(_q)
    for (const i of used) {
      const s = state[i]
      if (!s.visible) {
        _dummy.position.set(0, -999, 0)
        _dummy.scale.set(0, 0, 0)
      } else {
        _dummy.position.set(s.x, s.y, s.z)
        _dummy.quaternion.copy(_q)
        _dummy.scale.set(1, 1, 1)
      }
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  return { alloc, release, set, billboard, mesh }
}
