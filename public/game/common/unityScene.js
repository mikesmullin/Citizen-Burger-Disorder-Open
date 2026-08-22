// Unity YAML scene JSON → three.js graph.
// Coordinate conversion already happened in convert.py
// (Unity LH Z-forward → three.js RH Z-back).

import * as THREE from 'three'

const GEO = {
  Cube:     () => new THREE.BoxGeometry(1, 1, 1),
  Sphere:   () => new THREE.SphereGeometry(0.5, 24, 16),
  Cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  Capsule:  () => new THREE.CapsuleGeometry(0.5, 1, 8, 16),
  Plane:    () => new THREE.PlaneGeometry(10, 10),
  Quad:     () => new THREE.PlaneGeometry(1, 1),
  External: () => new THREE.BoxGeometry(1, 1, 1),
}

export function createUnityLoader({ base = '.' } = {}) {
  const geoCache = {}
  const texCache = {}
  const extGeo   = new Map()
  let models = null
  let modelsP = null

  const geo = k => (geoCache[k] ||= (GEO[k] || GEO.Cube)())

  const tex = url => (texCache[url] ||= (() => {
    const t = new THREE.TextureLoader().load(`${base}/${url}`)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = true
    return t
  })())

  function ensureModels() {
    if (!modelsP) {
      modelsP = fetch(`${base}/models.json`)
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))
        .then(m => { models = m; return m })
    }
    return modelsP
  }

  function externalGeometry(ref) {
    if (extGeo.has(ref)) return extGeo.get(ref)
    const d = models[ref]
    if (!d) return null
    const g = new THREE.BufferGeometry()
    g.userData.pending = fetch(`${base}/${d.bin}`)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const n = d.verts
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 0, n * 3), 3))
        g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(buf, n * 12, n * 3), 3))
        g.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(buf, n * 24, n * 2), 2))
        g.computeBoundingBox()
        g.computeBoundingSphere()
        delete g.userData.pending
      })
      .catch(() => { delete g.userData.pending })
    extGeo.set(ref, g)
    return g
  }

  async function load(slug) {
    await ensureModels()
    const url = slug.endsWith('.json')
      ? slug
      : `${base}/entities/${slug.replace(/~/g, '/').split('/').map(encodeURIComponent).join('/')}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`failed to load ${url} (${res.status})`)
    const data = await res.json()

    const mats = (data.materials || []).map(m => {
      const tint = m.tint || m.color || [1, 1, 1]
      const avg  = m.avg  || [1, 1, 1]
      const rgb  = m.tex ? tint : tint.map((c, i) => c * avg[i])
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(...rgb),
        map: m.tex ? tex(m.tex) : null,
        transparent: m.opacity < 1,
        opacity: m.opacity,
        roughness: 0.85,
        metalness: 0.0,
      })
    })
    const fallback = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.9 })
    const placeholder = new THREE.MeshStandardMaterial({
      color: 0xd07c3a, roughness: 0.7, transparent: true, opacity: 0.55 })
    const triggerMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff, wireframe: true, transparent: true, opacity: 0.22 })

    const objs = new Map()
    const pending = []
    let meshCount = 0, uiCount = 0, modelCount = 0, missingModels = 0

    for (const n of data.nodes) {
      let o
      if (n.rect) {
        const [w, h] = n.rect
        const u = n.ui
        if (u && (u.tex || u.alpha > 0.02)) {
          const m = new THREE.MeshBasicMaterial({
            color: new THREE.Color(...(u.color || [1, 1, 1])),
            map: u.tex ? tex(u.tex) : null,
            transparent: true,
            opacity: u.alpha,
            side: THREE.DoubleSide,
            depthWrite: false,
            alphaTest: 0.01,
          })
          o = new THREE.Mesh(new THREE.PlaneGeometry(w || 1, h || 1), m)
          const [pvx, pvy] = n.pivot || [0.5, 0.5]
          o.geometry.translate((0.5 - pvx) * (w || 1), (0.5 - pvy) * (h || 1), 0)
          o.renderOrder = 10 + uiCount
          uiCount++
        } else {
          o = new THREE.Object3D()
        }
        o.userData.ui = true
      } else if (n.mesh && n.render === false) {
        o = new THREE.Mesh(geo(n.mesh), triggerMat)
        o.userData.trigger = true
      } else if (n.mesh) {
        let g = null, m
        if (n.mesh === 'External') {
          g = externalGeometry(n.meshRef)
          m = g ? (mats[n.mat] ?? fallback) : placeholder
          if (!g) { g = geo('External'); missingModels++ }
          else {
            modelCount++
            if (g.userData.pending) pending.push(g.userData.pending)
          }
        } else {
          m = mats[n.mat] ?? fallback
          g = geo(n.mesh)
        }
        o = new THREE.Mesh(g, m)
        o.castShadow = o.receiveShadow = true
        meshCount++
      } else {
        o = new THREE.Object3D()
      }
      o.name = n.name
      o.position.fromArray(n.pos)
      o.quaternion.fromArray(n.quat)
      o.scale.fromArray(n.scale)
      o.visible = !!n.active
      objs.set(n.id, o)

      if (n.light) {
        const c = new THREE.Color(...n.light.color)
        const L = n.light.type === 1
          ? new THREE.DirectionalLight(c, n.light.intensity * 2.2)
          : new THREE.PointLight(c, n.light.intensity * 6, n.light.range)
        o.add(L)
      }
    }

    const root = new THREE.Group()
    root.name = data.source || slug
    for (const n of data.nodes) {
      const o = objs.get(n.id)
      const p = n.parent ? objs.get(n.parent) : null
      ;(p || root).add(o)
    }

    // Prefabs bake the last instance pose into the root transform.
    // Zero it so callers can place the object themselves. Authored scale stays.
    for (const n of data.nodes) {
      if (n.parent) continue
      const o = objs.get(n.id)
      o.position.set(0, 0, 0)
      o.quaternion.identity()
    }

    await Promise.all(pending)
    root.updateMatrixWorld(true)

    return {
      root, data, objs, slug,
      stats: { meshCount, uiCount, modelCount, missingModels, nodes: data.nodes.length },
    }
  }

  return { load, tex, geo }
}

export function boundsOf(root, { includeTriggers = false } = {}) {
  const box = new THREE.Box3()
  root.updateMatrixWorld(true)
  root.traverse(o => {
    if (!o.isMesh) return
    if (o.userData.trigger && !includeTriggers) return
    box.expandByObject(o)
  })
  return box
}

/** Scale `root` so its longest side equals `target`, then sit its bottom on y=0. */
export function fitOnFloor(root, { maxSize = 2.2, minSize = 0.35 } = {}) {
  const box = boundsOf(root)
  if (box.isEmpty()) return { size: new THREE.Vector3(), scale: 1 }
  const size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z)
  let s = 1
  if (longest > maxSize) s = maxSize / longest
  else if (longest < minSize && longest > 1e-4) s = minSize / longest
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true)
  const fitted = boundsOf(root)
  const mid = fitted.getCenter(new THREE.Vector3())
  root.position.x -= mid.x
  root.position.z -= mid.z
  root.position.y -= fitted.min.y
  root.updateMatrixWorld(true)
  return { size: fitted.getSize(new THREE.Vector3()), scale: s, native: size }
}

export function hideTriggers(root) {
  root.traverse(o => { if (o.userData.trigger) o.visible = false })
}
