// Greybox room kit. One unit cube / unit plane, stretched in the instance
// matrix. Same material → one InstancedMesh (the draw-call win). Sharing
// geometry alone does not cut draws.
//
// Floors and roofs are unique FrontSide planes (tile UVs vs black sheen).
// Door frames and window openings are 2 posts + lintel / sill assembled
// from the same box batch so gold trim is one draw per booth.

import * as THREE from 'three'

// r185 Texture.copy() always sets needsUpdate, so a clone of a TextureLoader
// result warns "no image data found" until the PNG arrives. Hold version at 0
// until source.data exists, then mark the clone for upload.
const _texCopy = THREE.Texture.prototype.copy
THREE.Texture.prototype.copy = function (source) {
  _texCopy.call(this, source)
  if (this.image) return this
  this.version = 0
  const src = source
  let n = 0
  const arm = () => {
    if (this.image || src.image) {
      this.needsUpdate = true
      return
    }
    if (++n > 180) return
    requestAnimationFrame(arm)
  }
  arm()
  return this
}

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)

/** Clone a map for unique wrap/repeat. Texture.copy() always sets
 *  needsUpdate, which makes r185 warn if the loader hasn't filled the
 *  image yet. Hold version at 0 until source.data exists. */
export function cloneMap(map) {
  if (!map) return map
  const t = map.clone()
  if (t.image) return t
  t.version = 0
  const src = map
  const arm = () => {
    if (src.image) {
      t.needsUpdate = true
      return
    }
    requestAnimationFrame(arm)
  }
  arm()
  return t
}

export const WALL_T = 0.12
export const WAINSCOT = 1.08
export const RAIL = 0.10
export const WAINSCOT_T = 0.05
/** Pull each wainscot end in by this so it stays inside a meeting wall. */
export const WAINSCOT_CAP = WALL_T + WAINSCOT_T
/** Extra push along local +Z (into the room) so strips don't punch the outer wall. */
export const WAINSCOT_IN = 0.03
export const COUNTER_Y = 0.92
export const DOOR_H = 2.42
// Floor stack: 3 coplanar-ish planes, 1 cm apart, so kit tiles can sit on
// the museum slab without z-fighting. Physics rests on the *top* of this
// band so a paper-thin drop (open box net) never sinks under a texture.
export const FLOOR_STEP = 0.01
export const FLOOR_LAYERS = 3
export const FLOOR_Y0 = 0.01
export function floorY(layer = 0) {
  const i = Math.max(0, Math.min(FLOOR_LAYERS - 1, layer | 0))
  return FLOOR_Y0 + i * FLOOR_STEP
}
export const FLOOR_TOP = floorY(FLOOR_LAYERS - 1)
export const FLOOR_PHYSICS = FLOOR_TOP + 0.004
export const FLOOR_Y = FLOOR_PHYSICS
export const WAINSCOT_PANEL = 0x6e6e70
export const WAINSCOT_RAIL = 0x7e3218

const _dummy = new THREE.Object3D()

export function makeFloor({
  map, w, d, x = 0, y, z = 0, layer = 0, tile = 1.55, roughness = 0.9,
} = {}) {
  if (y == null) y = floorY(layer)
  if (map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(Math.max(0.01, w / tile), Math.max(0.01, d / tile))
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map, roughness, metalness: 0, side: THREE.FrontSide,
  })
  const m = new THREE.Mesh(UNIT_PLANE, mat)
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.scale.set(w, d, 1)
  m.receiveShadow = true
  m.castShadow = false
  m.raycast = () => {}
  return m
}

export function makeRoof({
  w, d, x = 0, y = 3.55, z = 0, color = 0x0c0c0e,
} = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color, side: THREE.FrontSide,
  })
  const m = new THREE.Mesh(UNIT_PLANE, mat)
  m.rotation.x = Math.PI / 2
  m.position.set(x, y, z)
  m.scale.set(w, d, 1)
  m.name = 'RoomCeiling'
  m.castShadow = true
  m.receiveShadow = false
  m.raycast = () => {}
  return m
}

export function makePane({
  w, h, x, y, z, yaw = 0, material,
} = {}) {
  const m = new THREE.Mesh(UNIT_PLANE, material)
  m.position.set(x, y, z)
  m.rotation.y = yaw
  m.scale.set(w, h, 1)
  m.castShadow = m.receiveShadow = false
  return m
}

/** Tiled floor as a kit plane instance (hides with flags.kit). */
export function addTiledFloor(kit, {
  map, w, d, x = 0, z = 0, layer = 1, tile = 1.55, roughness = 0.9,
} = {}) {
  let tex = map
  if (tex) {
    tex = cloneMap(tex)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(Math.max(0.01, w / tile), Math.max(0.01, d / tile))
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: tex, roughness, metalness: 0, side: THREE.FrontSide,
  })
  return kit.floor(mat, w, d, x, floorY(layer), z)
}

export function createKit({ parent, max = 192 } = {}) {
  const batches = new Map()
  const planes = new Map()
  let roofMat = null

  function batchFor(material) {
    let b = batches.get(material.uuid)
    if (b) return b
    const mesh = new THREE.InstancedMesh(UNIT_BOX, material, max)
    mesh.name = 'Kit:' + (material.name || material.uuid.slice(0, 8))
    mesh.count = 0
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    parent.add(mesh)
    b = { mesh, n: 0 }
    batches.set(material.uuid, b)
    return b
  }

  function box(material, w, h, d, x, y, z, yaw = 0) {
    if (!material || !material.isMaterial) {
      console.warn('[kit] box() needs a material first')
      return -1
    }
    const b = batchFor(material)
    if (b.n >= max) {
      if (!b.warned) {
        console.warn('[kit] instance overflow', max)
        b.warned = true
      }
      return -1
    }
    _dummy.position.set(x, y, z)
    _dummy.rotation.set(0, yaw, 0)
    _dummy.scale.set(w, h, d)
    _dummy.updateMatrix()
    const i = b.n++
    b.mesh.setMatrixAt(i, _dummy.matrix)
    b.mesh.count = b.n
    return i
  }

  function planeBatch(material, { name, castShadow = false, receiveShadow = true } = {}) {
    const k = material.uuid
    let b = planes.get(k)
    if (b) return b
    const mesh = new THREE.InstancedMesh(UNIT_PLANE, material, max)
    mesh.name = name || ('Kit:Plane:' + k.slice(0, 8))
    mesh.count = 0
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    parent.add(mesh)
    b = { mesh, n: 0 }
    planes.set(k, b)
    return b
  }

  function plane(material, w, h, x, y, z, rx = 0, ry = 0, extra = {}) {
    if (!material || !material.isMaterial) return -1
    const b = planeBatch(material, extra)
    if (b.n >= max) return -1
    _dummy.position.set(x, y, z)
    _dummy.rotation.set(rx, ry, 0)
    _dummy.scale.set(w, h, 1)
    _dummy.updateMatrix()
    const i = b.n++
    b.mesh.setMatrixAt(i, _dummy.matrix)
    b.mesh.count = b.n
    return i
  }

  function floor(material, w, d, x, y, z) {
    return plane(material, w, d, x, y, z, -Math.PI / 2, 0, {
      name: 'Kit:Floor', receiveShadow: true, castShadow: false,
    })
  }

  function roof(w, d, x, y, z) {
    if (!roofMat) {
      roofMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e, side: THREE.FrontSide })
    }
    const b = planeBatch(roofMat, {
      name: 'Kit:Roof', castShadow: true, receiveShadow: false,
    })
    b.mesh.castShadow = true
    return plane(roofMat, w, d, x, y, z, Math.PI / 2, 0, {
      name: 'Kit:Roof', castShadow: true, receiveShadow: false,
    })
  }

  function glass(material, w, h, x, y, z, yaw = 0) {
    return plane(material, w, h, x, y, z, 0, yaw, {
      name: 'Kit:Glass', castShadow: false, receiveShadow: false,
    })
  }

  let wainN = 0
  function wainscot(len, x, z, yaw = 0, {
    panel, rail, cap = WAINSCOT_CAP, cap0, cap1, inward = WAINSCOT_IN,
    name, pos, scale,
  } = {}) {
    const a = cap0 != null ? cap0 : cap
    const b = cap1 != null ? cap1 : cap
    const L = len - a - b
    if (L < 0.08 || !panel || !rail) return null
    // cap0 trims local −X, cap1 local +X; shift the centre by (a − b) / 2.
    const mid = (a - b) * 0.5
    // Local +Z is into the room for every current caller. Nudge that way so
    // the rail (thicker than the panel) never punches the outer wall face.
    const mx = x + Math.cos(yaw) * mid + Math.sin(yaw) * inward
    const mz = z + Math.sin(yaw) * mid + Math.cos(yaw) * inward
    // Unique group (not the kit InstancedMesh) so the scale / transform
    // guns can pick a strip. Local X = along the wall, Y = up, Z = inward.
    const id = ++wainN
    const pivot = new THREE.Group()
    pivot.name = 'Kit:Wainscot'
    pivot.position.set(mx, 0, mz)
    pivot.rotation.y = yaw
    parent.add(pivot)
    const root = new THREE.Group()
    root.name = name || ('Wainscot-' + id)
    pivot.add(root)
    const panelMesh = new THREE.Mesh(UNIT_BOX, panel)
    panelMesh.name = 'Kit:WainscotPanel'
    panelMesh.position.set(0, WAINSCOT / 2, 0)
    panelMesh.scale.set(L, WAINSCOT, WAINSCOT_T)
    panelMesh.castShadow = false
    panelMesh.receiveShadow = true
    const railMesh = new THREE.Mesh(UNIT_BOX, rail)
    railMesh.name = 'Kit:WainscotRail'
    railMesh.position.set(0, WAINSCOT + RAIL / 2, 0)
    railMesh.scale.set(L, RAIL, WAINSCOT_T + 0.02)
    railMesh.castShadow = false
    railMesh.receiveShadow = true
    root.add(panelMesh, railMesh)
    if (pos) root.position.set(pos.x || 0, pos.y || 0, pos.z || 0)
    if (scale) root.scale.set(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1)
    const booth = parent.name || 'kit'
    const rec = {
      slug: `wainscot/${booth}/${id}`,
      label: name || `${booth} wainscot ${id}`,
      caption: name || `Wainscot ${id}`,
      kind: 'wainscot',
      display: root,
      virtual: true,
      editMul: 1,
      x: mx, z: mz,
    }
    for (const o of [pivot, root, panelMesh, railMesh]) {
      o.userData.exhibit = rec
      o.userData.editRoot = root
      o.userData.noGrab = true
    }
    return rec
  }

  function cladWall(w, d, px, pz, alongX, { lower, rail, upper, h = 3.55 } = {}) {
    const upperH = h - WAINSCOT - RAIL
    const tw = alongX ? w : WALL_T
    const td = alongX ? WALL_T : d
    box(lower, tw, WAINSCOT, td, px, WAINSCOT / 2, pz)
    box(rail, tw, RAIL, td, px, WAINSCOT + RAIL / 2, pz)
    box(upper, tw, upperH, td, px, WAINSCOT + RAIL + upperH / 2, pz)
  }

  function doorFrame(material, a0, a1, along, h = DOOR_H, extra = {}) {
    const mid = (a0 + a1) / 2
    const w = a1 - a0
    const post = extra.post || 0.16
    const lintelH = extra.lintel || 0.28
    const depth = extra.depth || 0.14
    const lintelD = extra.lintelD || depth + 0.02
    // axis 'x' (default): opening along X at z = along.
    // axis 'z': opening along Z at x = along (N–S partition).
    if (extra.axis === 'z') {
      box(material, depth, h, post, along, h / 2, a0)
      box(material, depth, h, post, along, h / 2, a1)
      box(material, lintelD, lintelH, w + post * 1.75, along, h + lintelH / 2, mid)
      return
    }
    box(material, post, h, depth, a0, h / 2, along)
    box(material, post, h, depth, a1, h / 2, along)
    box(material, w + post * 1.75, lintelH, lintelD, mid, h + lintelH / 2, along)
  }

  // Storefront / pass opening: sill + jambs + header. Glass is a separate plane.
  // Do not take a `glass` option — it would shadow the pane helper below.
  function windowWall({
    x0, x1, z, lower, rail, upper, glassMat,
    gBot = WAINSCOT + RAIL, gTop = 2.68, h = 3.55, post,
  } = {}) {
    const span = x1 - x0
    if (span < 0.4) return
    const mid = (x0 + x1) / 2
    const jam = post != null ? post : Math.min(0.16, span * 0.12)
    const gx0 = x0 + jam
    const gx1 = x1 - jam
    const gw = gx1 - gx0
    const gMid = (gx0 + gx1) / 2
    const gH = gTop - gBot
    const gCy = (gBot + gTop) / 2
    const sillMat = lower || upper
    box(sillMat, span, WAINSCOT + RAIL, WALL_T, mid, (WAINSCOT + RAIL) / 2, z)
    box(upper, jam, gH, WALL_T, x0 + jam / 2, gCy, z)
    box(upper, jam, gH, WALL_T, x1 - jam / 2, gCy, z)
    const headH = h - gTop
    if (headH > 0.08) box(upper, span, headH, WALL_T, mid, gTop + headH / 2, z)
    box(rail, gw + 0.06, 0.05, 0.1, gMid, gTop + 0.02, z)
    box(rail, gw + 0.06, 0.05, 0.1, gMid, gBot - 0.02, z)
    if (glassMat) glass(glassMat, gw, gH, gMid, gCy, z, 0)
  }

  function counter(body, top, len, depth, x, z, y = COUNTER_Y) {
    box(body, len, y - 0.04, depth, x, (y - 0.04) / 2, z)
    box(top, len + 0.05, 0.05, depth + 0.04, x, y, z)
  }

  function finalize() {
    for (const set of [batches, planes]) {
      for (const b of set.values()) {
        b.mesh.instanceMatrix.needsUpdate = true
        b.mesh.computeBoundingSphere()
      }
    }
  }

  return {
    box, plane, floor, roof, glass,
    cladWall, doorFrame, windowWall, counter, wainscot, finalize, batches,
  }
}
