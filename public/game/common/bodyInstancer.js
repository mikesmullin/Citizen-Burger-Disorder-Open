// Shared capsule bodies. NPC and Player prefabs are the same Unity Capsule
// (2×3×2, geo cached in unityScene); only the skin map changes. One
// InstancedMesh per skin covers hall crowd, front customers, and the
// third-person player lineup.

import * as THREE from 'three'
import { createInstancePool, visualMesh, hideVisuals } from './instancePool.js'

export function createBodyInstancer({
  scene, geometry = null, maxPerSkin = 32, prefix = 'BodyInst:',
} = {}) {
  const pools = new Map()
  const attached = []
  let geo = geometry

  function poolFor(skin, sourceMat, map) {
    const key = skin || 'default'
    let p = pools.get(key)
    if (p) return p
    const mat = (sourceMat ? sourceMat.clone() : new THREE.MeshStandardMaterial())
    if (map) mat.map = map
    mat.color.set(0xffffff)
    mat.needsUpdate = true
    p = createInstancePool({
      geometry: geo,
      material: mat,
      max: maxPerSkin,
      scene,
      name: prefix + key,
    })
    pools.set(key, p)
    return p
  }

  function attach(root, { skin, map, payload } = {}) {
    if (!root) return null
    detach(root)
    const vis = visualMesh(root)
    if (!vis) return null
    if (!geo) geo = vis.geometry
    const pool = poolFor(skin, vis.material, map || vis.material.map)
    const i = pool.alloc(payload || { root })
    if (i < 0) return null
    hideVisuals(root)
    pool.setFromObject(i, vis)
    const rec = { root, vis, pool, i, skin: skin || 'default' }
    attached.push(rec)
    root.userData.bodyInst = rec
    return rec
  }

  function detach(root) {
    if (!root) return
    const rec = root.userData && root.userData.bodyInst
    if (!rec) return
    rec.pool.release(rec.i)
    const k = attached.indexOf(rec)
    if (k >= 0) attached.splice(k, 1)
    root.userData.bodyInst = null
  }

  function sync(root) {
    const rec = root && root.userData && root.userData.bodyInst
    if (rec && rec.vis) rec.pool.setFromObject(rec.i, rec.vis)
  }

  function syncAll() {
    for (const rec of attached) {
      if (!rec.root.parent || !rec.vis) continue
      rec.pool.setFromObject(rec.i, rec.vis)
    }
  }

  return { attach, detach, sync, syncAll, poolFor, pools }
}
