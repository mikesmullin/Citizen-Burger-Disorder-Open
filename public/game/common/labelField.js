// One InstancedMesh for every black-and-gold placard (booth tags,
// pedestal plaques, the truck card). Unique canvas faces go in an atlas.

import * as THREE from 'three'
import { atlasUvMaterial } from './atlasUv.js'

const TAG_W = 1.15
const TAG_H = 0.28
const PLAQUE_W = 1.45
const PLAQUE_H = 0.41
const CELL_W = 512
const CELL_H = 192

const _dummy = new THREE.Object3D()

function drawTag(g, w, h, text) {
  g.fillStyle = '#14110e'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#c4a574'
  g.lineWidth = 10
  g.strokeRect(10, 10, w - 20, h - 20)
  g.fillStyle = '#f0e6d4'
  g.font = '700 72px ui-sans-serif, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(text || '').toUpperCase(), w / 2, h / 2 + 4)
}

function drawPlaque(g, w, h, title, sub) {
  g.fillStyle = '#14110e'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#6b5a45'
  g.lineWidth = 8
  g.strokeRect(10, 10, w - 20, h - 20)
  g.fillStyle = '#f0e6d4'
  g.font = '600 56px ui-sans-serif, system-ui, sans-serif'
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(title || '', 28, 84)
  g.fillStyle = '#b5a48a'
  g.font = '28px ui-sans-serif, system-ui, sans-serif'
  g.fillText(sub || '', 28, 140)
}

export function createLabelField({ scene, max = 192 } = {}) {
  const pending = []
  let mesh = null

  function place({
    text, sub = '', kind = 'tag',
    x = 0, y = 0, z = 0, yaw = 0, pitch = 0,
    sx = 1, sy = 1, parent,
  } = {}) {
    const dummy = new THREE.Object3D()
    dummy.position.set(x, y, z)
    dummy.rotation.order = 'YXZ'
    dummy.rotation.set(pitch, yaw, 0)
    const bw = kind === 'plaque' ? PLAQUE_W : TAG_W
    const bh = kind === 'plaque' ? PLAQUE_H : TAG_H
    dummy.scale.set(bw * sx, bh * sy, 1)
    dummy.userData.label = { text, sub, kind }
    dummy.raycast = () => {}
    if (parent) parent.add(dummy)
    else scene.add(dummy)
    pending.push(dummy)
    return dummy
  }

  function finalize() {
    const n = Math.min(pending.length, max)
    if (!n) return
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const canvas = document.createElement('canvas')
    canvas.width = cols * CELL_W
    canvas.height = rows * CELL_H
    const g = canvas.getContext('2d')
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, canvas.width, canvas.height)
    const uv = new Float32Array(n * 4)
    const tw = canvas.width, th = canvas.height
    for (let i = 0; i < n; i++) {
      const rec = pending[i].userData.label
      const col = i % cols
      const row = (i / cols) | 0
      g.save()
      g.translate(col * CELL_W, row * CELL_H)
      if (rec.kind === 'plaque') drawPlaque(g, CELL_W, CELL_H, rec.text, rec.sub)
      else drawTag(g, CELL_W, CELL_H, rec.text)
      g.restore()
      uv[i * 4] = (col * CELL_W) / tw
      uv[i * 4 + 1] = 1 - ((row + 1) * CELL_H) / th
      uv[i * 4 + 2] = CELL_W / tw
      uv[i * 4 + 3] = CELL_H / th
    }
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(uv, 4))
    mesh = new THREE.InstancedMesh(geo, atlasUvMaterial(map, { key: 'label-atlas', roughness: 0.9, metalness: 0.02 }), n)
    mesh.name = 'LabelInst'
    mesh.count = n
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    scene.add(mesh)
    for (let i = 0; i < n; i++) {
      const dummy = pending[i]
      dummy.updateMatrixWorld(true)
      mesh.setMatrixAt(i, dummy.matrixWorld)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }

  return { place, finalize, get mesh() { return mesh } }
}
