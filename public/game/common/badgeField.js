// Instanced HELLO nametags. Unique canvas faces live in an atlas; one
// MeshStandardMaterial so they take hall lighting (not MeshBasic / emissive).

import * as THREE from 'three'
import { atlasUvMaterial } from './atlasUv.js'

export const BADGE_W = 0.96
export const BADGE_H = 0.60
const CELL_W = 512
const CELL_H = 320

const _dummy = new THREE.Object3D()

export function paintNameBadge(g, w, h, username) {
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#c4122e'
  g.fillRect(0, 0, w, Math.round(h * 108 / 320))
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 52px ui-sans-serif, system-ui, sans-serif'
  g.fillText('HELLO', w / 2, Math.round(h * 42 / 320))
  g.font = 'italic 28px Georgia, "Palatino Linotype", cursive'
  g.fillText('my name is', w / 2, Math.round(h * 84 / 320))
  g.fillStyle = '#111111'
  let size = 64
  g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  const label = String(username || '')
  while (g.measureText(label).width > w - 52 && size > 22) {
    size -= 2
    g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  }
  g.fillText(label, w / 2, Math.round(h * 214 / 320))
  g.strokeStyle = '#1a1a1a'
  g.lineWidth = 8
  g.strokeRect(4, 4, w - 8, h - 8)
}

export function createBadgeField({ scene, max = 16 } = {}) {
  const cols = Math.ceil(Math.sqrt(max))
  const rows = Math.ceil(max / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * CELL_W
  canvas.height = rows * CELL_H
  const g = canvas.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4

  const uv = new Float32Array(max * 4)
  const tw = canvas.width, th = canvas.height
  for (let i = 0; i < max; i++) {
    const col = i % cols
    const row = (i / cols) | 0
    uv[i * 4] = (col * CELL_W) / tw
    uv[i * 4 + 1] = 1 - ((row + 1) * CELL_H) / th
    uv[i * 4 + 2] = CELL_W / tw
    uv[i * 4 + 3] = CELL_H / th
  }
  const geo = new THREE.PlaneGeometry(BADGE_W, BADGE_H)
  geo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(uv, 4))
  const mesh = new THREE.InstancedMesh(
    geo,
    atlasUvMaterial(map, { roughness: 0.88, metalness: 0, key: 'badge-atlas' }),
    max,
  )
  mesh.name = 'BadgeInst'
  mesh.count = 0
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const byInstance = []
  mesh.userData.byInstance = byInstance
  if (scene) scene.add(mesh)

  function stamp(username, payload) {
    if (mesh.count >= max) return -1
    const i = mesh.count++
    const col = i % cols
    const row = (i / cols) | 0
    g.save()
    g.translate(col * CELL_W, row * CELL_H)
    paintNameBadge(g, CELL_W, CELL_H, username)
    g.restore()
    map.needsUpdate = true
    byInstance[i] = payload || null
    _dummy.position.set(0, -999, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
    return i
  }

  function setFromObject(i, object) {
    if (i == null || i < 0 || !object) return
    object.updateMatrixWorld(true)
    mesh.setMatrixAt(i, object.matrixWorld)
    mesh.instanceMatrix.needsUpdate = true
  }

  function hide(i) {
    if (i == null || i < 0) return
    _dummy.position.set(0, -999, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }

  return { mesh, stamp, setFromObject, hide, byInstance }
}
