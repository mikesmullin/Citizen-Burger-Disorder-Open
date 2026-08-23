// Shared mocha plinths. One InstancedMesh for every exhibit and
// texture-card stand — a single draw for the whole hall.
// Cap and base are one geometry; the two mocha tones are vertex colors.

import * as THREE from 'three'
import { mergeGeometries, setVertexColor } from '../common/geom.js'

export const PEDESTAL_H = 0.88
export const PEDESTAL_W = 1.25
const CAP_H = 0.06
const CAP_Y = PEDESTAL_H + CAP_H / 2

// Invisible volume matching the mocha plinth so kiosk next/prev (click or
// wheel) hits the stand, not only the display item on top.
export function makePedestalHit(parent) {
  const h = PEDESTAL_H + CAP_H
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(PEDESTAL_W + 0.12, h, PEDESTAL_W + 0.12),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  mesh.name = 'PedestalHit'
  mesh.position.y = h / 2
  parent.add(mesh)
  return mesh
}

const _dummy = new THREE.Object3D()

function makeGeometry() {
  const base = new THREE.BoxGeometry(PEDESTAL_W, PEDESTAL_H, PEDESTAL_W)
  base.translate(0, PEDESTAL_H / 2, 0)
  setVertexColor(base, 0x3a322c)
  const cap = new THREE.BoxGeometry(PEDESTAL_W + 0.12, CAP_H, PEDESTAL_W + 0.12)
  cap.translate(0, CAP_Y, 0)
  setVertexColor(cap, 0x4a4038)
  return mergeGeometries([base, cap])
}

export function createPedestalField({ scene, max = 256 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.68, metalness: 0.05, vertexColors: true,
  })
  const mesh = new THREE.InstancedMesh(makeGeometry(), mat, max)
  mesh.name = 'Pedestals'
  mesh.count = 0
  mesh.castShadow = mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  scene.add(mesh)

  let n = 0

  function place(x, z, yaw = 0) {
    if (n >= max) return -1
    _dummy.position.set(x, 0, z)
    _dummy.rotation.set(0, yaw, 0)
    _dummy.scale.set(1, 1, 1)
    _dummy.updateMatrix()
    mesh.setMatrixAt(n, _dummy.matrix)
    n += 1
    mesh.count = n
    return n - 1
  }

  function finalize() {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }

  return {
    mesh, place, finalize,
    get count() { return n },
  }
}
