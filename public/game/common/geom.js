// Small BufferGeometry helpers. three.js r180 does not ship
// BufferGeometryUtils in the vendor build we serve.

import * as THREE from 'three'

export function setVertexColor(geo, hex) {
  const c = (hex && hex.isColor) ? hex : new THREE.Color(hex)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3))
  return geo
}

export function mergeGeometries(list) {
  const geos = list.map(g => (g.index ? g.toNonIndexed() : g))
  let verts = 0
  for (const g of geos) verts += g.attributes.position.count
  const pos = new Float32Array(verts * 3)
  const nrm = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  const col = new Float32Array(verts * 3)
  let hasNrm = false, hasUv = false, hasCol = false
  let o = 0
  for (const g of geos) {
    const n = g.attributes.position.count
    pos.set(g.attributes.position.array, o * 3)
    if (g.attributes.normal) {
      nrm.set(g.attributes.normal.array, o * 3)
      hasNrm = true
    }
    if (g.attributes.uv) {
      uv.set(g.attributes.uv.array, o * 2)
      hasUv = true
    }
    if (g.attributes.color) {
      col.set(g.attributes.color.array, o * 3)
      hasCol = true
    }
    o += n
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (hasNrm) out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  else out.computeVertexNormals()
  if (hasUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (hasCol) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

const SKIP_MERGE_NAME = /^(NameTag|NameTagTop|Hello|Username|Switch|Tire|hand)$/i

export function mergeByMaterial(root) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const groups = new Map()
  const meshes = []
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return
    if (o.userData.trigger || o.userData.ui) return
    if (SKIP_MERGE_NAME.test(o.name || '')) return
    if (!o.geometry || !o.material || Array.isArray(o.material)) return
    if (o.material.alphaTest > 0) return
    meshes.push(o)
    const k = o.material.uuid
    let g = groups.get(k)
    if (!g) { g = { mat: o.material, list: [] }; groups.set(k, g) }
    g.list.push(o)
  })
  const baked = []
  for (const { mat, list } of groups.values()) {
    if (list.length < 2) continue
    const geos = []
    for (const mesh of list) {
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry).clone()
      g.applyMatrix4(mesh.matrixWorld)
      g.applyMatrix4(inv)
      geos.push(g)
    }
    const merged = mergeGeometries(geos)
    const out = new THREE.Mesh(merged, mat)
    out.name = (list[0].name || 'Merged') + '_batch'
    out.castShadow = list.some(m => m.castShadow)
    out.receiveShadow = list.some(m => m.receiveShadow)
    baked.push({ out, remove: list })
  }
  for (const { out, remove } of baked) {
    root.add(out)
    for (const m of remove) {
      if (m.parent) m.parent.remove(m)
    }
  }
  return baked.length
}

function bakeColor(mat) {
  const c = (mat && mat.color) ? mat.color.clone() : new THREE.Color(1, 1, 1)
  const avg = mat && mat.userData && mat.userData.avg
  if (mat && mat.map && avg) {
    c.r *= avg[0]
    c.g *= avg[1]
    c.b *= avg[2]
  }
  return c
}

// Flatten greybox cubes that only differ by color into one mesh.
// `keep` names stay as empty Object3Ds at the same local pose (grab anchors).
export function bakeColoredCubes(root, { keep = ['hand'] } = {}) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const geos = []
  const saved = []
  const toRemove = []
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return
    if (o.userData.trigger || o.userData.ui) return
    const src = o.geometry
    if (!src || !o.material) return
    const g = (src.index ? src.toNonIndexed() : src).clone()
    setVertexColor(g, bakeColor(o.material))
    g.applyMatrix4(o.matrixWorld)
    g.applyMatrix4(inv)
    geos.push(g)
    if (keep.includes(o.name)) {
      const m = o.matrixWorld.clone().premultiply(inv)
      saved.push({ name: o.name, matrix: m })
    }
    toRemove.push(o)
  })
  if (!geos.length) return 0
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true,
    }),
  )
  mesh.name = (root.name || 'Arm') + '_flat'
  mesh.castShadow = mesh.receiveShadow = true
  for (const m of toRemove) {
    if (m.parent) m.parent.remove(m)
  }
  root.add(mesh)
  for (const s of saved) {
    const dummy = new THREE.Object3D()
    dummy.name = s.name
    dummy.matrix.copy(s.matrix)
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
    // Pose/scale of the original cube, no mesh. boundsOf uses this.
    dummy.userData.anchor = true
    root.add(dummy)
  }
  root.updateMatrixWorld(true)
  return geos.length
}
