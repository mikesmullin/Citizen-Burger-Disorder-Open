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

  const _white = new THREE.Color(1, 1, 1)
  function setColor(i, color) {
    if (i == null || i < 0) return
    const cap = mesh.instanceMatrix.count
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      for (let k = 0; k < cap; k++) mesh.setColorAt(k, _white)
    }
    mesh.setColorAt(i, color.isColor ? color : _white.set(color))
    mesh.instanceColor.needsUpdate = true
  }

  return { mesh, alloc, release, setMatrix, setFromObject, hide, setColor, byInstance }
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

export function visualMeshes(root) {
  const out = []
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return
    if (o.userData.trigger || o.userData.ui) return
    if (/^(NameTag|NameTagTop|Hello|Username|NameText)$/.test(o.name || '')) return
    out.push(o)
  })
  return out
}

const _white = new THREE.Color(1, 1, 1)

export function createVisualInstancer({ scene, max = 64, prefix = 'Pick' } = {}) {
  const pools = new Map()
  const attached = []

  function poolKey(mesh, variant) {
    const mapId = mesh.material && mesh.material.map ? mesh.material.map.uuid : 'nomap'
    return mesh.geometry.uuid + '|' + mapId + '|' + (variant || '')
  }

  function poolFor(mesh, variant) {
    const k = poolKey(mesh, variant)
    let p = pools.get(k)
    if (p) return p
    const mat = mesh.material.clone()
    mat.color.set(1, 1, 1)
    const short = (mesh.name || k).slice(0, 18)
    p = createInstancePool({
      geometry: mesh.geometry,
      material: mat,
      max,
      scene,
      name: prefix + ':' + short,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
    })
    pools.set(k, p)
    return p
  }

  function detach(root) {
    const i = attached.findIndex(a => a.root === root)
    if (i < 0) return
    const a = attached[i]
    for (const s of a.slots) s.pool.release(s.i)
    attached.splice(i, 1)
    if (root.userData) root.userData.instSlots = null
  }

  function attach(root, payload, variant = '') {
    if (!root) return null
    detach(root)
    const vis = visualMeshes(root)
    const slots = []
    for (const mesh of vis) {
      const pool = poolFor(mesh, variant)
      const i = pool.alloc(payload)
      if (i < 0) continue
      mesh.visible = false
      pool.setFromObject(i, mesh)
      const tint = (mesh.material && mesh.material.map) ? _white : (mesh.userData.cookOrig || mesh.material.color)
      pool.setColor(i, tint)
      slots.push({ pool, i, mesh })
    }
    const rec = { root, slots, payload, variant }
    attached.push(rec)
    if (root.userData) root.userData.instSlots = rec
    return rec
  }

  function setColor(root, color) {
    const rec = attached.find(a => a.root === root)
    if (!rec) return
    for (const s of rec.slots) s.pool.setColor(s.i, color)
  }

  function sync(root) {
    const rec = attached.find(a => a.root === root)
    if (!rec) return
    for (const s of rec.slots) s.pool.setFromObject(s.i, s.mesh)
  }

  function syncAll() {
    for (const a of attached) {
      if (!a.root.parent) continue
      for (const s of a.slots) s.pool.setFromObject(s.i, s.mesh)
    }
  }

  function meshes() {
    return [...pools.values()].map(p => p.mesh)
  }

  return { attach, detach, sync, syncAll, setColor, meshes, pools }
}
