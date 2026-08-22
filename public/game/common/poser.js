// Studio model poser: isolate one mesh on a white background and frame it
// from named views × (perspective | isometric/ortho). Built so an agent can
// `await pose.enter('items/Cheese')`, `pose.view('left','isometric')`, then
// screenshot without racing the museum sim.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from './unityScene.js'

export const VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'iso']
export const PROJS = ['perspective', 'isometric']

// Camera looks toward origin from this direction. Front = +Z (Unity forward
// after the LH→RH conversion). Left = −X (model's left if it faces +Z).
const VIEW_DIR = {
  front:  [0, 0, 1],
  back:   [0, 0, -1],
  left:   [-1, 0, 0],
  right:  [1, 0, 0],
  top:    [0, 1, 0],
  bottom: [0, -1, 0],
  // True isometric: 45° yaw, 35.264° elevation.
  iso:    [1, 1, 1],
}

const FOV = 35
const PAD = 1.45

function r3(v) {
  return +v.toFixed(3)
}

function waitFrame() {
  return new Promise(r => requestAnimationFrame(r))
}

function texturesReady(root) {
  const pending = []
  root.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
    for (const m of mats) {
      if (!m) continue
      for (const k of ['map', 'lightMap', 'aoMap', 'emissiveMap', 'normalMap', 'alphaMap']) {
        const tex = m[k]
        if (!tex) continue
        const img = tex.image
        if (!img) {
          pending.push(new Promise(resolve => {
            const t0 = performance.now()
            const id = setInterval(() => {
              if (tex.image || performance.now() - t0 > 4000) {
                clearInterval(id)
                resolve()
              }
            }, 40)
          }))
          continue
        }
        if (typeof img.complete === 'boolean' && !img.complete) {
          pending.push(new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          }))
        }
      }
    }
  })
  return Promise.all(pending)
}

function hideHud(selectors) {
  const restored = []
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      restored.push([el, el.style.display])
      el.style.display = 'none'
    })
  }
  return restored
}

export function createPoser({
  scene,
  renderer,
  loader,
  getExhibits = () => [],
  hudSelectors = ['#hud', '#look', '#cross', '#help', '#loader', '#dbgPanel', '#dbgToggle'],
} = {}) {
  const persp = new THREE.PerspectiveCamera(FOV, 1, 0.02, 800)
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.02, 800)
  const rig = new THREE.Group()
  rig.name = 'poser-rig'
  rig.visible = false

  const amb = new THREE.AmbientLight(0xffffff, 0.55)
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.35)
  const key = new THREE.DirectionalLight(0xffffff, 1.55)
  key.position.set(2.4, 3.2, 2.8)
  const fill = new THREE.DirectionalLight(0xffffff, 0.7)
  fill.position.set(-2.2, 1.4, -1.6)
  const rim = new THREE.DirectionalLight(0xffffff, 0.4)
  rim.position.set(0.2, 2.0, -3.0)
  rig.add(amb, hemi, key, fill, rim)

  const axes = new THREE.AxesHelper(0.6)
  axes.visible = false
  rig.add(axes)
  const grid = new THREE.GridHelper(4, 8, 0xbbbbbb, 0xe8e8e8)
  grid.visible = false
  rig.add(grid)

  scene.add(rig)

  let session = null
  let view = 'front'
  let proj = 'perspective'
  let bg = 0xffffff
  let ready = false
  let axleUi = null

  function cam() {
    return proj === 'isometric' ? ortho : persp
  }

  function aspect() {
    const el = renderer.domElement
    return (el.clientWidth || innerWidth) / Math.max(1, el.clientHeight || innerHeight)
  }

  function measure() {
    const root = session?.root
    if (!root) return { size: [0, 0, 0], radius: 0.5 }
    const box = boundsOf(root)
    const size = box.getSize(new THREE.Vector3())
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    return {
      size: [size.x, size.y, size.z],
      radius: Math.max(sphere.radius, 0.05),
    }
  }

  function placeCamera() {
    if (!session) return
    const { radius } = measure()
    const a = aspect()
    const dir = new THREE.Vector3(...(VIEW_DIR[view] || VIEW_DIR.front)).normalize()
    const distPersp = (radius * PAD) / Math.tan((FOV * Math.PI / 180) / 2)
    const dist = proj === 'isometric' ? radius * PAD * 2.4 : distPersp
    const c = cam()
    c.position.copy(dir).multiplyScalar(dist)
    if (Math.abs(dir.y) > 0.99) c.up.set(0, 0, dir.y > 0 ? -1 : 1)
    else c.up.set(0, 1, 0)
    c.lookAt(0, 0, 0)
    c.near = Math.max(0.01, dist - radius * 4)
    c.far = dist + radius * 6
    if (c.isOrthographicCamera) {
      const half = radius * PAD
      c.left = -half * a
      c.right = half * a
      c.top = half
      c.bottom = -half
    } else {
      c.aspect = a
      c.fov = FOV
    }
    c.updateProjectionMatrix()
    c.updateMatrixWorld()
  }

  function render() {
    if (!session) return
    placeCamera()
    renderer.render(scene, cam())
  }

  function info() {
    if (!session) return { active: false }
    const m = measure()
    const c = cam()
    return {
      active: true,
      ready,
      slug: session.slug,
      view,
      proj,
      size: m.size.map(r3),
      radius: r3(m.radius),
      cam: [r3(c.position.x), r3(c.position.y), r3(c.position.z)],
      views: VIEWS,
      projs: PROJS,
    }
  }

  function hideOthers(keep) {
    const hidden = []
    scene.traverse(o => {
      if (!o.visible) return
      if (o === keep || o === rig) return
      let p = o
      while (p) {
        if (p === keep || p === rig) return
        p = p.parent
      }
      if (o.isMesh || o.isPoints || o.isSprite || o.isLine || o.isLight || o.isSkinnedMesh) {
        hidden.push(o)
        o.visible = false
      }
    })
    return hidden
  }

  function center(root) {
    root.position.set(0, 0, 0)
    root.rotation.set(0, 0, 0)
    root.updateMatrixWorld(true)
    const box = boundsOf(root)
    if (box.isEmpty()) return
    const mid = box.getCenter(new THREE.Vector3())
    root.position.sub(mid)
    root.updateMatrixWorld(true)
  }

  function resolveSlug(q) {
    if (typeof q !== 'string') return q
    const exhibits = getExhibits() || []
    const e = exhibits.find(x => x.slug === q || x.label === q || x.caption === q)
    return e ? e.slug : q
  }

  async function settle() {
    if (!session) return info()
    await texturesReady(session.root)
    await waitFrame()
    await waitFrame()
    render()
    ready = true
    return info()
  }

  async function enter(target, opts = {}) {
    if (session) exit()
    const nextView = opts.view || 'front'
    const nextProj = opts.proj === 'iso' || opts.proj === 'ortho' ? 'isometric'
      : (opts.proj || (nextView === 'iso' ? 'isometric' : 'perspective'))
    view = VIEWS.includes(nextView) ? nextView : 'front'
    proj = nextProj === 'isometric' ? 'isometric' : 'perspective'
    if (opts.bg != null) bg = new THREE.Color(opts.bg).getHex()

    let root, slug, live = null
    if (target && target.isObject3D) {
      live = {
        object: target,
        parent: target.parent,
        pos: target.position.clone(),
        quat: target.quaternion.clone(),
        scale: target.scale.clone(),
      }
      root = target
      slug = target.name || 'object'
      scene.attach(root)
    } else {
      slug = resolveSlug(target)
      if (!slug) throw new Error('pose.enter(slug) needs a slug, label, or Object3D')
      const loaded = await loader.load(slug)
      root = loaded.root
      hideTriggers(root)
      scene.add(root)
    }

    center(root)
    hideTriggers(root)
    rig.visible = true
    if (opts.axes) axes.visible = true
    if (opts.grid) grid.visible = true

    session = {
      root,
      slug,
      live,
      hidden: hideOthers(root),
      hud: hideHud(hudSelectors),
      bg: scene.background ? scene.background.clone() : null,
      fog: scene.fog,
      bodyBg: document.body.style.background,
      htmlBg: document.documentElement.style.background,
    }
    scene.background = new THREE.Color(bg)
    scene.fog = null
    const cssBg = '#' + new THREE.Color(bg).getHexString()
    document.body.style.background = cssBg
    document.documentElement.style.background = cssBg
    ready = false
    return settle()
  }

  function setView(nextView, nextProj) {
    if (!session) return { active: false, error: 'not in pose mode — pose.enter(slug) first' }
    if (nextView) view = VIEWS.includes(nextView) ? nextView : view
    if (nextProj != null) {
      const p = nextProj === 'iso' || nextProj === 'ortho' ? 'isometric' : nextProj
      proj = p === 'isometric' ? 'isometric' : 'perspective'
    } else if (nextView === 'iso') {
      proj = 'isometric'
    }
    render()
    return info()
  }

  function tiresOf(root) {
    const list = []
    if (!root) return list
    root.traverse(o => { if (o.name === 'Tire') list.push(o) })
    return list
  }

  function axleXs(root) {
    const xs = []
    const _p = new THREE.Vector3()
    for (const t of tiresOf(root)) {
      t.getWorldPosition(_p)
      xs.push(_p.x)
    }
    xs.sort((a, b) => a - b)
    const axles = []
    for (const x of xs) {
      if (!axles.length || Math.abs(x - axles[axles.length - 1]) > 0.25) axles.push(x)
    }
    return axles
  }

  function worldXFromEvent(e) {
    const el = renderer.domElement
    const rect = el.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    const v = new THREE.Vector3(ndcX, ndcY, 0)
    v.unproject(cam())
    return v.x
  }

  function screenXFromWorldX(wx) {
    const v = new THREE.Vector3(wx, 0, 0)
    v.project(cam())
    const rect = renderer.domElement.getBoundingClientRect()
    return rect.left + (v.x * 0.5 + 0.5) * rect.width
  }

  function paintAxleMarkers() {
    if (!axleUi || !session) return
    const marks = axleUi.querySelectorAll('[data-axle]')
    const xs = axleXs(session.root)
    marks.forEach((el, i) => {
      if (i >= xs.length) { el.style.display = 'none'; return }
      el.style.display = 'block'
      el.style.left = screenXFromWorldX(xs[i]) + 'px'
    })
  }

  function snapNearestAxle(clickX) {
    if (!session) return null
    const _p = new THREE.Vector3()
    const tires = tiresOf(session.root)
    if (!tires.length) return { error: 'no Tire meshes on the posed object' }
    let nearest = null, nearestD = 1e9
    for (const t of tires) {
      t.getWorldPosition(_p)
      const d = Math.abs(_p.x - clickX)
      if (d < nearestD) { nearestD = d; nearest = _p.x }
    }
    const dx = clickX - nearest
    const _wp = new THREE.Vector3()
    for (const t of tires) {
      t.getWorldPosition(_wp)
      if (Math.abs(_wp.x - nearest) > 0.25) continue
      _wp.x += dx
      if (t.parent) t.parent.worldToLocal(_wp)
      t.position.copy(_wp)
    }
    session.root.updateMatrixWorld(true)
    render()
    paintAxleMarkers()
    return axleReport()
  }

  function axleReport() {
    if (!session) return { active: false }
    const box = boundsOf(session.root)
    const minX = box.min.x, span = box.max.x - box.min.x || 1
    const xs = axleXs(session.root)
    return {
      axles: xs.map(x => ({
        x: r3(x),
        fromLeft: r3((x - minX) / span),
        fromRight: r3((box.max.x - x) / span),
      })),
      aabbX: [r3(minX), r3(box.max.x)],
    }
  }

  function stopMarkAxle() {
    if (!axleUi) return
    axleUi.removeEventListener('mousemove', axleUi._move)
    axleUi.removeEventListener('click', axleUi._click)
    axleUi.remove()
    axleUi = null
  }

  function markAxle() {
    if (!session) return { error: 'pose.enter a truck with Tire children first' }
    stopMarkAxle()
    view = 'front'
    proj = 'isometric'
    render()
    const wrap = document.createElement('div')
    wrap.id = 'axleMark'
    wrap.innerHTML = `
      <style>
        #axleMark { position:fixed; inset:0; z-index:40; cursor:crosshair; }
        #axleMark .axle-line {
          position:absolute; top:0; bottom:0; width:0; border-left:2px solid #e23;
          pointer-events:none; transform:translateX(-1px);
        }
        #axleMark .axle-cur { border-left-color:#2a7; border-left-style:dashed; opacity:.85; }
        #axleMark .axle-hint {
          position:absolute; left:50%; bottom:18px; transform:translateX(-50%);
          background:#14110ee6; color:#f0e6d4; border:1px solid #3a322c; border-radius:8px;
          padding:8px 14px; font:13px/1.4 ui-sans-serif,system-ui,sans-serif; pointer-events:none;
        }
      </style>
      <div class="axle-line" id="axleCursor"></div>
      <div class="axle-line axle-cur" data-axle="0"></div>
      <div class="axle-line axle-cur" data-axle="1"></div>
      <div class="axle-hint">click to snap the nearest axle to this line · green = current axles · pose.exit() when done</div>
    `
    document.body.appendChild(wrap)
    const cursor = wrap.querySelector('#axleCursor')
    wrap._move = e => {
      cursor.style.left = e.clientX + 'px'
    }
    wrap._click = e => {
      e.preventDefault()
      e.stopPropagation()
      snapNearestAxle(worldXFromEvent(e))
    }
    wrap.addEventListener('mousemove', wrap._move)
    wrap.addEventListener('click', wrap._click)
    axleUi = wrap
    paintAxleMarkers()
    return { ok: true, ...axleReport() }
  }

  function exit() {
    if (!session) return { active: false }
    stopMarkAxle()
    session.hidden.forEach(o => { o.visible = true })
    session.hud.forEach(([el, d]) => { el.style.display = d })
    scene.background = session.bg
    scene.fog = session.fog
    document.body.style.background = session.bodyBg
    document.documentElement.style.background = session.htmlBg
    if (session.live) {
      const L = session.live
      if (L.parent) L.parent.attach(L.object)
      else scene.add(L.object)
      L.object.position.copy(L.pos)
      L.object.quaternion.copy(L.quat)
      L.object.scale.copy(L.scale)
    } else if (session.root && session.root.parent) {
      session.root.parent.remove(session.root)
    }
    axes.visible = false
    grid.visible = false
    rig.visible = false
    session = null
    ready = false
    return { active: false }
  }

  function list() {
    return (getExhibits() || []).map(e => ({ slug: e.slug, label: e.label || e.caption, group: e.group }))
  }

  function rotate(deg = 0) {
    if (!session) return info()
    session.root.rotation.y = THREE.MathUtils.degToRad(deg)
    session.root.updateMatrixWorld(true)
    render()
    return info()
  }

  function showAxes(on = true) {
    axes.visible = !!on
    render()
    return info()
  }

  function showGrid(on = true) {
    grid.visible = !!on
    render()
    return info()
  }

  function setBg(color = 0xffffff) {
    bg = new THREE.Color(color).getHex()
    if (session) scene.background = new THREE.Color(bg)
    render()
    return info()
  }

  function resize() {
    if (session) render()
  }

  return {
    enter, view: setView, exit, list, info, render, resize,
    rotate, axes: showAxes, grid: showGrid, bg: setBg, settle,
    markAxle, axleReport,
    get active() { return !!session },
    get ready() { return ready },
    views: VIEWS,
    projs: PROJS,
  }
}
