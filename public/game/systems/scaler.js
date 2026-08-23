// Museum edit guns: Digit1 scale, Digit2 transform, Digit0 empty hands.
// Scale: LMB-drag on the crosshair exhibit resizes it (longest-edge dump).
// Transform: tap X/Y/Z to lock parent-local axes, then LMB-drag to move.
// Persistence is the agent's job: console dump is copy-paste for the prefab.

import * as THREE from 'three'
import { boundsOf } from '../common/unityScene.js'

const RANGE = 6.2
const MIN_MUL = 0.05
const MAX_MUL = 12
// 120 px of mouse-X ≈ 2×. Exponential so cheese and the cupboard feel the same.
const PX_TO_LN = Math.log(2) / 120
const TOOLS = ['hand', 'scale', 'transform']
const AXIS_KEYS = { KeyX: 'x', KeyY: 'y', KeyZ: 'z' }
const AXIS_HEX = { x: 0xe05555, y: 0x55c05a, z: 0x4a8ae0 }

function r3(v) {
  return +(+v).toFixed(3)
}

function vec3(p) {
  if (!p) return null
  return { x: r3(p.x), y: r3(p.y), z: r3(p.z) }
}

function fmtVec(p) {
  return `${r3(p.x)}, ${r3(p.y)}, ${r3(p.z)}`
}

function longestOf(rec) {
  const asset = rec.display
  if (!asset) return 0
  const box = boundsOf(asset)
  if (box.isEmpty()) return 0
  const s = box.getSize(new THREE.Vector3())
  return Math.max(s.x, s.y, s.z)
}

function makeGun({ name, glowHex, pips = false } = {}) {
  const g = new THREE.Group()
  g.name = name || 'EditGun'
  const metal = new THREE.MeshStandardMaterial({
    color: 0x2c333c, metalness: 0.72, roughness: 0.32,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1e24, metalness: 0.55, roughness: 0.4,
  })
  const wood = new THREE.MeshStandardMaterial({
    color: 0x4a3224, metalness: 0.08, roughness: 0.78,
  })
  const glow = new THREE.MeshBasicMaterial({ color: glowHex ?? 0xc4a574 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.22), metal)
  body.position.set(0, 0.02, -0.02)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.32, 10), dark)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, 0.03, -0.24)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.07), wood)
  grip.position.set(0, -0.085, 0.05)
  grip.rotation.x = 0.28
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), dark)
  guard.position.set(0, -0.03, -0.02)
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.022), metal)
  sight.position.set(0, 0.072, -0.1)
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.038), glow)
  tip.position.set(0, 0.03, -0.41)
  tip.name = 'muzzle'
  const parts = [body, barrel, grip, guard, sight, tip]
  if (pips) {
    const pipMap = {}
    let i = 0
    for (const k of ['x', 'y', 'z']) {
      const mat = new THREE.MeshBasicMaterial({
        color: AXIS_HEX[k], transparent: true, opacity: 0.18,
      })
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), mat)
      m.position.set((i - 1) * 0.026, 0.094, -0.06)
      pipMap[k] = { mesh: m, mat }
      parts.push(m)
      i++
    }
    g.userData.axisPips = pipMap
  }
  for (const m of parts) {
    m.castShadow = false
    m.receiveShadow = false
    m.frustumCulled = false
    m.raycast = () => {}
  }
  g.add(...parts)
  g.userData.muzzle = glow
  g.visible = false
  return g
}

export function createScaler({
  scene, player, exhibits, pedestalH = 0.88, onScale, onTransform,
} = {}) {
  const ndc = new THREE.Vector2(0, 0)
  const raycaster = new THREE.Raycaster()
  const _size = new THREE.Vector3()
  const _pos = new THREE.Vector3()
  const _fwd = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _up = new THREE.Vector3()
  const _wp = new THREE.Vector3()
  const _wp2 = new THREE.Vector3()
  const _quat = new THREE.Quaternion()

  const scaleGun = makeGun({ name: 'ScaleGun', glowHex: 0xc4a574 })
  const xformGun = makeGun({ name: 'TransformGun', glowHex: 0x5ec8d8, pips: true })
  const gunPose = { pos: [0.34, -0.24, -0.48], rot: [0.14, 0.18, -0.12] }
  for (const g of [scaleGun, xformGun]) {
    g.position.set(...gunPose.pos)
    g.rotation.set(...gunPose.rot)
    player.camera.add(g)
  }

  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xf0c14a)
  helper.name = 'ScaleHighlight'
  helper.visible = false
  helper.frustumCulled = false
  helper.raycast = () => {}
  scene.add(helper)

  const axesHelper = new THREE.AxesHelper(0.28)
  axesHelper.name = 'TransformAxes'
  axesHelper.visible = false
  axesHelper.frustumCulled = false
  axesHelper.raycast = () => {}
  scene.add(axesHelper)

  let tool = 'hand'
  let hover = null
  let drag = null
  let dragStart = null
  const axis = { x: false, y: false, z: false }

  function gun() {
    return tool === 'transform' ? xformGun : scaleGun
  }

  function anyAxis() {
    return axis.x || axis.y || axis.z
  }

  function axisStr() {
    const on = ['x', 'y', 'z'].filter(k => axis[k]).map(k => k.toUpperCase())
    return on.length ? on.join(' ') : 'none'
  }

  function snapshot(rec) {
    const d = rec && rec.display
    return {
      mul: rec.editMul || 1,
      longest: d ? longestOf(rec) : null,
      pos: d ? vec3(d.position) : null,
      scale: d ? vec3(d.scale) : null,
    }
  }

  function logScale(rec, start) {
    if (!rec || !start) return
    const afterMul = rec.editMul || 1
    if (Math.abs(afterMul - start.mul) < 1e-6) return
    const afterLong = rec.display ? longestOf(rec) : null
    const payload = {
      slug: rec.slug,
      label: rec.hoverName || rec.caption || rec.label || rec.slug,
      mul: { before: r3(start.mul), after: r3(afterMul) },
    }
    if (start.longest != null && afterLong != null) {
      payload.longest = { before: r3(start.longest), after: r3(afterLong) }
    }
    if (rec.display) payload.scale = vec3(rec.display.scale)
    let line = `[scale] ${payload.slug}  ${payload.label}  ×${payload.mul.before} → ×${payload.mul.after}`
    if (payload.longest) {
      line += `  longest ${payload.longest.before} → ${payload.longest.after} m`
    }
    if (payload.scale) line += `  scale ${fmtVec(payload.scale)}`
    console.log(line)
    console.log(payload)
    if (payload.scale) {
      console.log(`[scale] copy: tag.scale.set(${payload.scale.x}, ${payload.scale.y}, ${payload.scale.z})`)
    }
  }

  function logTransform(rec, start) {
    if (!rec || !start || !rec.display || !start.pos) return
    const after = vec3(rec.display.position)
    const dx = Math.abs(after.x - start.pos.x)
    const dy = Math.abs(after.y - start.pos.y)
    const dz = Math.abs(after.z - start.pos.z)
    if (dx + dy + dz < 1e-5) return
    const payload = {
      slug: rec.slug,
      label: rec.hoverName || rec.caption || rec.label || rec.slug,
      axes: { x: axis.x, y: axis.y, z: axis.z },
      pos: { before: start.pos, after },
      scale: vec3(rec.display.scale),
    }
    console.log(`[transform] ${payload.slug}  ${payload.label}  pos ${fmtVec(start.pos)} → ${fmtVec(after)}  axes ${axisStr()}`)
    console.log(payload)
    console.log(`[transform] copy: tag.position.set(${after.x}, ${after.y}, ${after.z})`)
    if (payload.scale) {
      console.log(`[transform] copy: tag.scale.set(${payload.scale.x}, ${payload.scale.y}, ${payload.scale.z})`)
    }
  }

  function setMuzzle(hex) {
    gun().userData.muzzle.color.setHex(hex)
  }

  function setAxisPips() {
    const pips = xformGun.userData.axisPips
    if (!pips) return
    for (const k of ['x', 'y', 'z']) {
      pips[k].mat.opacity = axis[k] ? 1 : 0.18
    }
  }

  function pick() {
    player.object.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObjects(scene.children, true)
    for (const h of hits) {
      if (h.distance > RANGE) continue
      let o = h.object
      while (o) {
        if (o === scaleGun || o === xformGun || o === helper || o === axesHelper) break
        o = o.parent
      }
      if (o === scaleGun || o === xformGun || o === helper || o === axesHelper) continue
      const rec = h.object.userData.exhibit
      if (rec && rec.display) {
        if (rec.virtual) rec.display = h.object.userData.editRoot || h.object
        const demo = h.object.userData.demoPlayer
        rec.hoverName = demo && rec.kind === 'badge' ? demo.spec.name : null
        return rec
      }
    }
    // Thin food (cheese is ~1 cm tall) is easy to miss with a centre ray.
    // Fall back to the exhibit whose pedestal is closest along the look vector.
    player.camera.getWorldPosition(_pos)
    player.camera.getWorldDirection(_fwd)
    let best = null, bestD = RANGE
    for (const rec of exhibits) {
      if (!rec.display) continue
      const dx = rec.x - _pos.x
      const dy = pedestalH + 0.2 - _pos.y
      const dz = rec.z - _pos.z
      const d = Math.hypot(dx, dy, dz)
      if (d > bestD || d < 0.35) continue
      const nd = 1 / d
      if (_fwd.x * dx * nd + _fwd.y * dy * nd + _fwd.z * dz * nd < 0.78) continue
      best = rec
      bestD = d
    }
    return best
  }

  function reseat(rec) {
    const asset = rec.display
    if (!asset) return
    asset.updateMatrixWorld(true)
    const box = boundsOf(asset)
    if (box.isEmpty()) return
    const wrap = rec.object
    const targetMinY = (wrap?.position.y || 0) + pedestalH + 0.06
    asset.position.y += targetMinY - box.min.y
    asset.updateMatrixWorld(true)
    const fitted = boundsOf(asset)
    fitted.getSize(_size)
    rec.size = { x: _size.x, y: _size.y, z: _size.z }
  }

  function applyMul(rec, next) {
    const cur = rec.editMul || 1
    const clamped = Math.max(MIN_MUL, Math.min(MAX_MUL, next))
    const factor = clamped / cur
    if (Math.abs(factor - 1) < 1e-6) return
    rec.editMul = clamped
    const targets = rec.targets ? rec.targets() : null
    if (targets && targets.length) {
      for (const t of targets) {
        const base = t.userData.baseScale
        if (base) t.scale.set(base.x * clamped, base.y * clamped, base.z * clamped)
        else t.scale.multiplyScalar(factor)
      }
    } else if (!rec.virtual && rec.display) {
      const sx = Math.sign(rec.display.scale.x) || 1
      rec.display.scale.multiplyScalar(factor)
      rec.display.scale.x = Math.abs(rec.display.scale.x) * sx
      reseat(rec)
    }
    if (onScale) onScale(rec)
  }

  function applyPos(rec, dpx, dpy) {
    const obj = rec.display
    if (!obj || !anyAxis()) return
    player.camera.updateMatrixWorld(true)
    obj.updateMatrixWorld(true)
    obj.getWorldPosition(_wp)
    const dist = Math.max(0.4, player.camera.getWorldPosition(_pos).distanceTo(_wp))
    const sens = 0.001 * dist
    _right.setFromMatrixColumn(player.camera.matrixWorld, 0).normalize()
    _up.setFromMatrixColumn(player.camera.matrixWorld, 1).normalize()
    const worldDx = _right.x * dpx * sens + _up.x * (-dpy) * sens
    const worldDy = _right.y * dpx * sens + _up.y * (-dpy) * sens
    const worldDz = _right.z * dpx * sens + _up.z * (-dpy) * sens
    const parent = obj.parent
    let lx, ly, lz
    if (parent) {
      parent.updateMatrixWorld(true)
      _wp2.set(_wp.x + worldDx, _wp.y + worldDy, _wp.z + worldDz)
      parent.worldToLocal(_wp)
      parent.worldToLocal(_wp2)
      lx = _wp2.x - _wp.x
      ly = _wp2.y - _wp.y
      lz = _wp2.z - _wp.z
    } else {
      lx = worldDx
      ly = worldDy
      lz = worldDz
    }
    const next = obj.position.clone()
    if (axis.x) next.x += lx
    if (axis.y) next.y += ly
    if (axis.z) next.z += lz
    const targets = rec.targets ? rec.targets() : [obj]
    for (const t of targets) {
      if (!t) continue
      t.position.copy(next)
    }
    if (onTransform) onTransform(rec)
  }

  function highlight(rec) {
    if (!rec || !rec.display) {
      helper.visible = false
      axesHelper.visible = false
      return
    }
    helper.visible = true
    helper.material.color.setHex(tool === 'transform' ? 0x5ec8d8 : 0xf0c14a)
    helper.setFromObject(rec.display)
    if (tool === 'transform') {
      rec.display.updateMatrixWorld(true)
      rec.display.getWorldPosition(_pos)
      const parent = rec.display.parent
      if (parent) {
        parent.updateMatrixWorld(true)
        parent.getWorldQuaternion(_quat)
        axesHelper.position.copy(_pos)
        axesHelper.quaternion.copy(_quat)
      } else {
        axesHelper.position.copy(_pos)
        axesHelper.quaternion.identity()
      }
      axesHelper.visible = true
    } else {
      axesHelper.visible = false
    }
  }

  function labelFor(rec) {
    if (!rec) return ''
    const name = rec.hoverName || rec.caption || rec.label || rec.slug
    if (tool === 'transform') {
      const p = rec.display ? rec.display.position : null
      const pos = p ? fmtVec(p) : '—'
      return `${name}  ·  axes ${axisStr()}  ·  pos ${pos}`
    }
    const mul = rec.editMul || 1
    const long = longestOf(rec)
    const sc = rec.display ? fmtVec(rec.display.scale) : null
    return sc
      ? `${name}  ·  ×${mul.toFixed(2)}  ·  ${long.toFixed(2)} m  ·  scale ${sc}`
      : `${name}  ·  ×${mul.toFixed(2)}  ·  ${long.toFixed(2)} m`
  }

  function showGuns() {
    scaleGun.visible = tool === 'scale'
    xformGun.visible = tool === 'transform'
    if (tool !== 'transform') axesHelper.visible = false
    if (tool === 'hand') {
      hover = null
      highlight(null)
    }
    setAxisPips()
  }

  function equip(name) {
    const next = name === 2 || name === '2' || name === 'transform' ? 'transform'
      : name === 1 || name === '1' || name === 'scale' ? 'scale'
        : name === 0 || name === '0' || name === 'hand' ? 'hand'
          : TOOLS.includes(name) ? name : 'hand'
    if (next === tool) return tool
    if (drag) endDrag()
    tool = next
    showGuns()
    return tool
  }

  function toggleAxis(name) {
    const k = String(name || '').toLowerCase()
    if (k !== 'x' && k !== 'y' && k !== 'z') return axisStr()
    axis[k] = !axis[k]
    setAxisPips()
    console.log(`[transform] axes ${axisStr()}`)
    return { x: axis.x, y: axis.y, z: axis.z }
  }

  function onKey(e) {
    if (e.target && typeof e.target.closest === 'function'
      && e.target.closest('input, textarea, [contenteditable]')) return
    if (e.repeat) return
    if (e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault()
      equip('hand')
    } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
      e.preventDefault()
      equip('scale')
    } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
      e.preventDefault()
      equip('transform')
    } else if (tool === 'transform' && AXIS_KEYS[e.code]) {
      e.preventDefault()
      toggleAxis(AXIS_KEYS[e.code])
    }
  }
  addEventListener('keydown', onKey)

  function beginDrag(rec) {
    if (!rec || drag === rec) return
    if (tool === 'transform' && !anyAxis()) return
    if (drag) endDrag()
    drag = rec
    dragStart = snapshot(rec)
    player.lookFrozen = true
  }

  function endDrag() {
    if (!drag) return
    const rec = drag
    const start = dragStart
    drag = null
    dragStart = null
    player.lookFrozen = false
    if (tool === 'transform') logTransform(rec, start)
    else logScale(rec, start)
  }

  addEventListener('mousedown', e => {
    if (e.button !== 0 || (tool !== 'scale' && tool !== 'transform')) return
    const rec = pick()
    if (!rec) return
    beginDrag(rec)
  })
  addEventListener('mouseup', e => {
    if (e.button !== 0) return
    endDrag()
  })

  function update() {
    if (tool === 'hand') {
      if (player.lookFrozen) player.lookFrozen = false
      scaleGun.visible = false
      xformGun.visible = false
      highlight(null)
      return
    }
    showGuns()

    const lmb = player.getMouse(0)
    if (lmb && !drag) {
      const rec = pick()
      if (rec) beginDrag(rec)
    }
    if (!lmb && drag) endDrag()

    if (drag) {
      const d = player.pullDragDelta()
      if (tool === 'scale') {
        if (d.x) applyMul(drag, (drag.editMul || 1) * Math.exp(d.x * PX_TO_LN))
        setMuzzle(0xf0c14a)
      } else {
        if (d.x || d.y) applyPos(drag, d.x, d.y)
        setMuzzle(0x5ec8d8)
      }
      hover = drag
    } else {
      hover = pick()
      if (tool === 'transform') {
        setMuzzle(hover && anyAxis() ? 0x7ecf8a : 0x5ec8d8)
      } else {
        setMuzzle(hover ? 0x7ecf8a : 0xc4a574)
      }
    }
    highlight(hover)
  }

  function row(rec) {
    const long = longestOf(rec)
    const native = rec.native
    const d = rec.display
    return {
      slug: rec.slug,
      label: rec.hoverName || rec.caption || rec.label,
      mul: r3(rec.editMul || 1),
      longest: r3(long),
      fit: r3(rec.scale || 1),
      pos: d ? vec3(d.position) : null,
      scale: d ? vec3(d.scale) : null,
      native: native
        ? { x: r3(native.x), y: r3(native.y), z: r3(native.z) }
        : null,
    }
  }

  function dump() {
    const rows = exhibits.filter(e => e.display).map(row)
    const changed = rows.filter(e => Math.abs(e.mul - 1) > 0.001)
    const exhibitLongest = {}
    for (const e of changed) exhibitLongest[e.slug] = e.longest
    const badge = exhibits.find(e => e.kind === 'badge' || e.slug === 'heroes/NameTag')
    return {
      tool,
      axes: { x: axis.x, y: axis.y, z: axis.z },
      hovering: hover ? hover.slug : null,
      dragging: drag ? drag.slug : null,
      exhibits: rows,
      changed,
      exhibitLongest,
      badge: badge && badge.display
        ? {
          pos: vec3(badge.display.position),
          scale: vec3(badge.display.scale),
          mul: r3(badge.editMul || 1),
        }
        : null,
    }
  }

  function lookLabel() {
    if (tool === 'scale') {
      if (drag) return 'scale  ·  ' + labelFor(drag)
      if (hover) return 'scale  ·  ' + labelFor(hover)
      return 'scale gun  ·  aim at an exhibit, hold LMB, drag right/left'
    }
    if (tool === 'transform') {
      if (drag) return 'transform  ·  ' + labelFor(drag)
      if (hover) return 'transform  ·  ' + labelFor(hover)
      if (!anyAxis()) return 'transform gun  ·  tap X / Y / Z to enable an axis, then aim and drag'
      return `transform gun  ·  axes ${axisStr()}  ·  aim, hold LMB, drag`
    }
    return ''
  }

  function nudge(dx) {
    const rec = drag || hover || pick()
    if (!rec) return dump()
    const start = snapshot(rec)
    applyMul(rec, (rec.editMul || 1) * Math.exp(dx * PX_TO_LN))
    hover = rec
    highlight(rec)
    logScale(rec, start)
    return row(rec)
  }

  function setMul(rec, mul, { silent = false } = {}) {
    if (!rec) return null
    const start = snapshot(rec)
    applyMul(rec, mul)
    if (!silent) logScale(rec, start)
    return row(rec)
  }

  return {
    get tool() { return tool },
    get equipped() { return tool !== 'hand' },
    get hover() { return hover },
    get drag() { return drag },
    get axes() { return { x: axis.x, y: axis.y, z: axis.z } },
    equip, update, dump, lookLabel, nudge, pick, setMul, toggleAxis,
    gun: scaleGun, helper,
  }
}
