// Museum scale-gun: Digit1 equips a right-hand viewmodel; LMB-drag on the
// crosshair exhibit resizes it. Digit0 returns to empty hands.
//
// Persistence is the agent's job: dump() reports each exhibit's current
// longest edge so EXHIBIT_LONGEST (or the prefab) can be updated later.

import * as THREE from 'three'
import { boundsOf } from '../common/unityScene.js'

const RANGE = 6.2
const MIN_MUL = 0.05
const MAX_MUL = 12
// 120 px of mouse-X ≈ 2×. Exponential so cheese and the cupboard feel the same.
const PX_TO_LN = Math.log(2) / 120
const TOOLS = ['hand', 'scale']

function r3(v) {
  return +(+v).toFixed(3)
}

function longestOf(rec) {
  const asset = rec.display
  if (!asset) return 0
  const box = boundsOf(asset)
  if (box.isEmpty()) return 0
  const s = box.getSize(new THREE.Vector3())
  return Math.max(s.x, s.y, s.z)
}

function makeGun() {
  const g = new THREE.Group()
  g.name = 'ScaleGun'
  const metal = new THREE.MeshStandardMaterial({
    color: 0x2c333c, metalness: 0.72, roughness: 0.32,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1e24, metalness: 0.55, roughness: 0.4,
  })
  const wood = new THREE.MeshStandardMaterial({
    color: 0x4a3224, metalness: 0.08, roughness: 0.78,
  })
  const glow = new THREE.MeshBasicMaterial({ color: 0xc4a574 })

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
  for (const m of [body, barrel, grip, guard, sight, tip]) {
    m.castShadow = false
    m.receiveShadow = false
    m.frustumCulled = false
    m.raycast = () => {}
  }
  g.add(body, barrel, grip, guard, sight, tip)
  g.userData.muzzle = glow
  g.visible = false
  return g
}

export function createScaler({
  scene, player, exhibits, pedestalH = 0.88, onScale,
} = {}) {
  const ndc = new THREE.Vector2(0, 0)
  const raycaster = new THREE.Raycaster()
  const _size = new THREE.Vector3()
  const _pos = new THREE.Vector3()
  const _fwd = new THREE.Vector3()

  const gun = makeGun()
  gun.position.set(0.34, -0.24, -0.48)
  gun.rotation.set(0.14, 0.18, -0.12)
  player.camera.add(gun)

  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xf0c14a)
  helper.name = 'ScaleHighlight'
  helper.visible = false
  helper.frustumCulled = false
  helper.raycast = () => {}
  scene.add(helper)

  let tool = 'hand'
  let hover = null
  let drag = null

  function setMuzzle(hex) {
    gun.userData.muzzle.color.setHex(hex)
  }

  function pick() {
    player.object.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObjects(scene.children, true)
    for (const h of hits) {
      if (h.distance > RANGE) continue
      let o = h.object
      while (o) {
        if (o === gun || o === helper) break
        o = o.parent
      }
      if (o === gun || o === helper) continue
      const rec = h.object.userData.exhibit
      if (rec && rec.display) return rec
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
    const sx = Math.sign(rec.display.scale.x) || 1
    rec.display.scale.multiplyScalar(factor)
    rec.display.scale.x = Math.abs(rec.display.scale.x) * sx
    reseat(rec)
    if (onScale) onScale(rec)
  }

  function highlight(rec) {
    if (!rec || !rec.display) {
      helper.visible = false
      return
    }
    helper.visible = true
    helper.setFromObject(rec.display)
  }

  function labelFor(rec) {
    if (!rec) return ''
    const name = rec.caption || rec.label || rec.slug
    const mul = rec.editMul || 1
    const long = longestOf(rec)
    return `${name}  ·  ×${mul.toFixed(2)}  ·  ${long.toFixed(2)} m`
  }

  function equip(name) {
    const next = name === 1 || name === '1' || name === 'scale' ? 'scale'
      : name === 0 || name === '0' || name === 'hand' ? 'hand'
        : TOOLS.includes(name) ? name : 'hand'
    if (next === tool) return tool
    if (drag) {
      drag = null
      player.lookFrozen = false
    }
    tool = next
    gun.visible = tool === 'scale'
    if (tool !== 'scale') {
      hover = null
      highlight(null)
      setMuzzle(0xc4a574)
    }
    return tool
  }

  function onDigit(e) {
    if (e.target && e.target.closest('input, textarea, [contenteditable]')) return
    if (e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault()
      equip('hand')
    } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
      e.preventDefault()
      equip('scale')
    }
  }
  addEventListener('keydown', onDigit)
  addEventListener('mousedown', e => {
    if (e.button !== 0 || tool !== 'scale') return
    const rec = pick()
    if (!rec) return
    drag = rec
    player.lookFrozen = true
  })
  addEventListener('mouseup', e => {
    if (e.button !== 0) return
    if (!drag) return
    drag = null
    player.lookFrozen = false
  })

  function update() {
    if (tool !== 'scale') {
      if (player.lookFrozen) player.lookFrozen = false
      gun.visible = false
      highlight(null)
      return
    }
    gun.visible = true

    const lmb = player.getMouse(0)
    if (lmb && !drag) {
      const rec = pick()
      if (rec) {
        drag = rec
        player.lookFrozen = true
      }
    }
    if (!lmb && drag) {
      drag = null
      player.lookFrozen = false
    }

    if (drag) {
      const d = player.pullDragDelta()
      if (d.x) applyMul(drag, (drag.editMul || 1) * Math.exp(d.x * PX_TO_LN))
      hover = drag
      setMuzzle(0xf0c14a)
    } else {
      hover = pick()
      setMuzzle(hover ? 0x7ecf8a : 0xc4a574)
    }
    highlight(hover)
  }

  function row(rec) {
    const long = longestOf(rec)
    const native = rec.native
    return {
      slug: rec.slug,
      label: rec.caption || rec.label,
      mul: r3(rec.editMul || 1),
      longest: r3(long),
      fit: r3(rec.scale || 1),
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
    return {
      tool,
      hovering: hover ? hover.slug : null,
      dragging: drag ? drag.slug : null,
      exhibits: rows,
      changed,
      exhibitLongest,
    }
  }

  function lookLabel() {
    if (tool !== 'scale') return ''
    if (drag) return 'scale  ·  ' + labelFor(drag)
    if (hover) return 'scale  ·  ' + labelFor(hover)
    return 'scale gun  ·  aim at an exhibit, hold LMB, drag right/left'
  }

  function nudge(dx) {
    const rec = drag || hover || pick()
    if (!rec) return dump()
    applyMul(rec, (rec.editMul || 1) * Math.exp(dx * PX_TO_LN))
    hover = rec
    highlight(rec)
    return row(rec)
  }

  return {
    get tool() { return tool },
    get equipped() { return tool === 'scale' },
    get hover() { return hover },
    get drag() { return drag },
    equip, update, dump, lookLabel, nudge, pick,
    gun, helper,
  }
}
