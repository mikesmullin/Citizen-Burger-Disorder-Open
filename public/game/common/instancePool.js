// InstancedMesh slot allocator. Logic objects keep moving; this just
// mirrors matrixWorld into a single draw.

import * as THREE from 'three'

const _dummy = new THREE.Object3D()

export function createInstancePool({
  geometry, material, max = 16, scene, name = 'Instances',
  castShadow = true, receiveShadow = true,
} = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, max)
  mesh.name = name
  mesh.count = 0
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const byInstance = []
  mesh.userData.byInstance = byInstance
  const free = []
  if (scene) scene.add(mesh)

  function alloc(payload) {
    let i = free.pop()
    if (i == null) {
      if (mesh.count >= max) return -1
      i = mesh.count++
    }
    byInstance[i] = payload || null
    return i
  }

  function release(i) {
    if (i == null || i < 0) return
    byInstance[i] = null
    free.push(i)
    _dummy.position.set(0, -999, 0)
    _dummy.rotation.set(0, 0, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }

  function setMatrix(i, matrix) {
    if (i == null || i < 0) return
    mesh.setMatrixAt(i, matrix)
    mesh.instanceMatrix.needsUpdate = true
  }

  function setFromObject(i, object) {
    if (i == null || i < 0 || !object) return
    object.updateMatrixWorld(true)
    mesh.setMatrixAt(i, object.matrixWorld)
    mesh.instanceMatrix.needsUpdate = true
  }

  function hide(i) {
    _dummy.position.set(0, -999, 0)
    _dummy.rotation.set(0, 0, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    setMatrix(i, _dummy.matrix)
  }

  return { mesh, alloc, release, setMatrix, setFromObject, hide, byInstance }
}

export function visualMesh(root) {
  let found = null
  root.traverse(o => {
    if (found || !o.isMesh || o.isInstancedMesh) return
    if (o.userData.trigger || o.userData.ui) return
    if (/^(NameTag|NameTagTop|Hello|Username|NameText)$/.test(o.name || '')) return
    found = o
  })
  return found
}

export function hideVisuals(root) {
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return
    if (/^(NameTag|NameTagTop|Hello|Username|NameText)$/.test(o.name || '')) return
    if (o.userData.ui) return
    o.visible = false
  })
}
