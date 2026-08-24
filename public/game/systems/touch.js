// On-screen stick + buttons for phones. Hidden on desktop (pointer:fine).
// Drive the same key / mouse bits the PC controller already reads, so grab,
// jump, and gait stay one code path. Overlay markup lives in museum.html.

const RUN_MAG = 0.78
const STICK_SENS = 0.5
const DEAD = 0.14
const LOOK_MUL = 4.1
const TAP_PX = 14
const TAP_MS = 280

let releasePlay = () => {}
let posBlockUntil = 0
let posClosePending = null

export function posClicksBlocked() {
  return performance.now() < posBlockUntil || document.body.classList.contains('pos-open')
}

export function setPosOpen(on) {
  if (on) {
    if (posClosePending) {
      clearTimeout(posClosePending.timer)
      document.removeEventListener('pointerup', posClosePending.finish, true)
      document.removeEventListener('pointercancel', posClosePending.finish, true)
      posClosePending = null
    }
    document.body.classList.add('pos-open')
    releasePlay()
    return
  }
  posBlockUntil = performance.now() + 500
  if (posClosePending) return
  const finish = () => {
    if (!posClosePending) return
    clearTimeout(posClosePending.timer)
    document.removeEventListener('pointerup', finish, true)
    document.removeEventListener('pointercancel', finish, true)
    posClosePending = null
    document.body.classList.remove('pos-open')
    requestAnimationFrame(() => releasePlay())
  }
  posClosePending = { finish, timer: setTimeout(finish, 200) }
  document.addEventListener('pointerup', finish, { capture: true })
  document.addEventListener('pointercancel', finish, { capture: true })
}

export function wantTouchUi() {
  const q = new URLSearchParams(location.search)
  if (q.has('touch')) return q.get('touch') !== '0'
  if (q.has('desktop')) return false
  if (window.matchMedia('(pointer: coarse)').matches) return true
  if (window.matchMedia('(hover: none)').matches && (navigator.maxTouchPoints || 0) > 0) return true
  return /Android|iPhone|iPod|iPad|Mobile/i.test(navigator.userAgent || '')
}

export function createTouchControls({
  player,
  canvas,
  onEnter,
  getPlaying,
  getPosing,
} = {}) {
  const root = document.getElementById('touch-ui')
  const stick = document.getElementById('touch-stick')
  const knob = document.getElementById('touch-knob')
  const moveZone = document.getElementById('touch-move')
  const lookZone = document.getElementById('touch-look')
  const btnJump = document.getElementById('touch-jump')
  const btnL = document.getElementById('touch-l')
  const btnR = document.getElementById('touch-r')

  let active = false
  const pointers = new Map()
  const handOn = { l: false, r: false }
  const noPassive = { passive: false }
  const noPassiveCap = { passive: false, capture: true }

  function playing() {
    return !!(getPlaying && getPlaying())
  }

  function posing() {
    return !!(getPosing && getPosing())
  }

  function requestShell() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return
    const el = document.documentElement
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (!req) return
    try {
      const p = req.call(el, { navigationUI: 'hide' })
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch (_) { /* iOS / denied */ }
  }

  function ensurePlay() {
    requestShell()
    if (!playing() && onEnter) onEnter()
  }

  function stickMetrics() {
    const zone = moveZone.getBoundingClientRect()
    const D = stick.offsetWidth
    const R = D * 0.5
    const knobR = knob ? knob.offsetWidth * 0.5 : 0
    const travel = Math.max(1, R - knobR)
    return { zone, D, R, travel }
  }

  function resetStickHome() {
    if (!stick || !moveZone) return
    const D = stick.offsetWidth
    const left = (moveZone.clientWidth - D) * 0.5
    const top = (moveZone.clientHeight - D) * 0.5
    stick.style.left = left + 'px'
    stick.style.top = top + 'px'
    stick.style.margin = '0'
    stick.style.right = 'auto'
    stick.style.bottom = 'auto'
    if (knob) knob.style.transform = 'translate(0px, 0px)'
    stick.classList.remove('on')
  }

  function emitAnalog(x, z) {
    if (!player || !player.setAnalog) return
    let ax = +x || 0, az = +z || 0
    const mag = Math.hypot(ax, az)
    if (mag > 1) { ax /= mag; az /= mag }
    player.setAnalog(ax * STICK_SENS, az * STICK_SENS)
    if (mag >= RUN_MAG) player.keys.add('ShiftLeft')
    else player.keys.delete('ShiftLeft')
  }

  function setStick(x, z) {
    emitAnalog(x, z)
    if ([...pointers.values()].some(p => p.role === 'stick')) return
    resetStickHome()
    if (!knob) return
    let ax = +x || 0, az = +z || 0
    const mag = Math.hypot(ax, az)
    if (mag > 1) { ax /= mag; az /= mag }
    const { travel } = stickMetrics()
    knob.style.transform = `translate(${ax * travel}px, ${-az * travel}px)`
    stick.classList.toggle('on', mag > DEAD)
  }

  function applyStickPointer(e) {
    if (!stick || !moveZone) return { x: 0, z: 0 }
    const { zone, R, travel } = stickMetrics()
    const restX = zone.left + zone.width * 0.5
    const restY = zone.top + zone.height * 0.5
    const maxOff = Math.max(0, zone.width * 0.5 - R)
    let bx = parseFloat(stick.style.left)
    let by = parseFloat(stick.style.top)
    if (Number.isFinite(bx) && Number.isFinite(by)) {
      bx = zone.left + bx + R
      by = zone.top + by + R
    } else {
      bx = restX
      by = restY
    }
    const fx = e.clientX, fy = e.clientY
    let relx = fx - bx, rely = fy - by
    let dist = Math.hypot(relx, rely)
    if (dist > R && dist > 1e-6) {
      const nx = relx / dist, ny = rely / dist
      bx = fx - nx * R
      by = fy - ny * R
      let ox = bx - restX, oy = by - restY
      const od = Math.hypot(ox, oy)
      if (od > maxOff && od > 1e-6) {
        ox *= maxOff / od
        oy *= maxOff / od
        bx = restX + ox
        by = restY + oy
      }
      relx = fx - bx
      rely = fy - by
      dist = Math.hypot(relx, rely)
      if (dist > R && dist > 1e-6) {
        relx *= R / dist
        rely *= R / dist
        dist = R
      }
    }
    stick.style.left = (bx - zone.left - R) + 'px'
    stick.style.top = (by - zone.top - R) + 'px'
    stick.style.margin = '0'
    stick.style.right = 'auto'
    stick.style.bottom = 'auto'
    const mag = R > 0 ? dist / R : 0
    if (knob) {
      const k = R > 0 ? travel / R : 0
      knob.style.transform = `translate(${relx * k}px, ${rely * k}px)`
    }
    stick.classList.toggle('on', mag > DEAD)
    let ax = R > 0 ? relx / R : 0
    let az = R > 0 ? -rely / R : 0
    if (mag < DEAD) { ax = 0; az = 0 }
    emitAnalog(ax, az)
    return { x: ax, z: az }
  }

  function clientToNdc(clientX, clientY) {
    const el = canvas || document.querySelector('body > canvas')
    let r = el && el.getBoundingClientRect()
    if (!r || r.width < 2 || r.height < 2) {
      r = { left: 0, top: 0, width: innerWidth, height: innerHeight }
    }
    return {
      x: ((clientX - r.left) / r.width) * 2 - 1,
      y: -(((clientY - r.top) / r.height) * 2 - 1),
    }
  }

  function fireTap(clientX, clientY) {
    if (!player || !player.pulseFire || player.getMouse(0)) return false
    player.pulseFire(0, clientToNdc(clientX, clientY))
    return true
  }

  function bindHold(el, role, down, up) {
    if (!el) return
    el.addEventListener('pointerdown', e => {
      if (e.button != null && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      if (posing()) return
      ensurePlay()
      try { el.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
      pointers.set(e.pointerId, { role })
      el.classList.add('on')
      down()
    }, noPassive)
    const end = e => {
      const p = pointers.get(e.pointerId)
      if (!p || p.role !== role) return
      pointers.delete(e.pointerId)
      el.classList.remove('on')
      up()
    }
    el.addEventListener('pointerup', end, noPassive)
    el.addEventListener('pointercancel', end, noPassive)
  }

  function key(code, on) {
    if (!player) return
    if (on) player.keys.add(code)
    else player.keys.delete(code)
  }

  function mouse(button, on) {
    if (!player || !player.setMouse) return
    player.setMouse(button, on)
  }

  bindHold(btnJump, 'jump', () => key('Space', true), () => key('Space', false))

  function setHand(side, on) {
    on = !!on
    if (side === 'l') {
      handOn.l = on
      key('KeyQ', on)
      mouse(0, on)
      btnL && btnL.classList.toggle('on', on)
    } else {
      handOn.r = on
      key('KeyE', on)
      mouse(2, on)
      btnR && btnR.classList.toggle('on', on)
    }
  }

  function bindToggle(el, side) {
    if (!el) return
    el.addEventListener('pointerdown', e => {
      if (e.button != null && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      if (posing()) return
      ensurePlay()
      setHand(side, !handOn[side])
    }, noPassive)
  }
  bindToggle(btnL, 'l')
  bindToggle(btnR, 'r')

  function stickDown(e) {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    if (posing()) return
    ensurePlay()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    pointers.set(e.pointerId, {
      role: 'stick', x: e.clientX, y: e.clientY, px: 0, t: performance.now(),
    })
    applyStickPointer(e)
  }

  function stickMove(e) {
    const p = pointers.get(e.pointerId)
    if (!p || p.role !== 'stick') return
    e.preventDefault()
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    p.px += Math.hypot(dx, dy)
    applyStickPointer(e)
  }

  function stickUp(e) {
    const p = pointers.get(e.pointerId)
    if (!p || p.role !== 'stick') return
    pointers.delete(e.pointerId)
    emitAnalog(0, 0)
    resetStickHome()
    if (e.type === 'pointercancel') return
    const dt = performance.now() - p.t
    if (p.px < TAP_PX && dt < TAP_MS && !posClicksBlocked()) {
      fireTap(e.clientX, e.clientY)
    }
  }

  if (moveZone) {
    moveZone.addEventListener('pointerdown', stickDown, noPassive)
    moveZone.addEventListener('pointermove', stickMove, noPassive)
    moveZone.addEventListener('pointerup', stickUp, noPassive)
    moveZone.addEventListener('pointercancel', stickUp, noPassive)
  }

  function lookDown(e) {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    if (posing() || posClicksBlocked()) return
    ensurePlay()
    try { lookZone.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    pointers.set(e.pointerId, {
      role: 'look', x: e.clientX, y: e.clientY, px: 0, t: performance.now(),
    })
  }

  function lookMove(e) {
    const p = pointers.get(e.pointerId)
    if (!p || p.role !== 'look') return
    e.preventDefault()
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    p.px += Math.hypot(dx, dy)
    if (player && player.injectMouse) player.injectMouse(dx * LOOK_MUL, dy * LOOK_MUL)
  }

  function lookUp(e) {
    const p = pointers.get(e.pointerId)
    if (!p || p.role !== 'look') return
    if (e.type === 'pointercancel') {
      p.cancelled = true
      return
    }
    pointers.delete(e.pointerId)
    const dt = performance.now() - p.t
    if (p.px < TAP_PX && dt < TAP_MS && !posClicksBlocked()) {
      fireTap(e.clientX, e.clientY)
    }
  }

  if (lookZone) {
    lookZone.addEventListener('pointerdown', lookDown, noPassive)
    lookZone.addEventListener('pointermove', lookMove, noPassive)
    lookZone.addEventListener('pointerup', lookUp, noPassive)
    lookZone.addEventListener('pointercancel', lookUp, noPassive)
  }

  function releasePlayPointers() {
    emitAnalog(0, 0)
    resetStickHome()
    key('Space', false)
    pointers.clear()
    btnJump && btnJump.classList.remove('on')
  }
  releasePlay = releasePlayPointers

  function onLost() {
    releasePlayPointers()
    setHand('l', false)
    setHand('r', false)
  }
  addEventListener('blur', onLost)
  document.addEventListener('visibilitychange', () => { if (document.hidden) onLost() })

  function blockGesture(e) {
    const multi = !!(e.touches && e.touches.length > 1)
    if (multi) {
      e.preventDefault()
      return
    }
    if (!active) return
    if (document.body.classList.contains('pos-open')) return
    e.preventDefault()
  }

  function continueLookFromTouches(e) {
    let look = null
    for (const p of pointers.values()) {
      if (p.role === 'look') { look = p; break }
    }
    if (!look || !look.cancelled) return
    const zone = moveZone && moveZone.getBoundingClientRect()
    let best = null, bestD = Infinity
    for (const t of e.touches) {
      if (zone && t.clientX >= zone.left && t.clientX <= zone.right
        && t.clientY >= zone.top && t.clientY <= zone.bottom) continue
      const d = Math.hypot(t.clientX - look.x, t.clientY - look.y)
      if (d < bestD) { bestD = d; best = t }
    }
    if (!best) return
    const dx = best.clientX - look.x
    const dy = best.clientY - look.y
    look.x = best.clientX
    look.y = best.clientY
    look.px += Math.hypot(dx, dy)
    if (player && player.injectMouse) player.injectMouse(dx * LOOK_MUL, dy * LOOK_MUL)
  }

  document.addEventListener('touchstart', blockGesture, noPassiveCap)
  document.addEventListener('touchmove', e => {
    blockGesture(e)
    continueLookFromTouches(e)
  }, noPassiveCap)
  document.addEventListener('touchend', e => {
    blockGesture(e)
    if (!active) return
    let lookId = null, look = null
    for (const [id, p] of pointers) {
      if (p.role === 'look') { lookId = id; look = p; break }
    }
    if (!look || !look.cancelled) return
    const zone = moveZone && moveZone.getBoundingClientRect()
    let still = false
    for (const t of e.touches) {
      if (zone && t.clientX >= zone.left && t.clientX <= zone.right
        && t.clientY >= zone.top && t.clientY <= zone.bottom) continue
      still = true
      break
    }
    if (!still) pointers.delete(lookId)
  }, noPassiveCap)
  document.addEventListener('touchcancel', blockGesture, noPassiveCap)
  document.addEventListener('gesturestart', blockGesture, noPassiveCap)
  document.addEventListener('gesturechange', blockGesture, noPassiveCap)
  document.addEventListener('gestureend', blockGesture, noPassiveCap)
  document.addEventListener('wheel', e => {
    if (!active) return
    if (e.ctrlKey) e.preventDefault()
  }, noPassiveCap)

  function apply(show) {
    active = !!show
    document.documentElement.classList.toggle('touch-ui', active)
    document.body.classList.toggle('touch-ui', active)
    if (root) {
      root.hidden = !active
      root.setAttribute('aria-hidden', active ? 'false' : 'true')
    }
    if (!active) {
      onLost()
      if (player && player.setTouchLock) player.setTouchLock(false)
    } else if (playing() && player && player.setTouchLock) {
      player.setTouchLock(true)
    }
    if (active) {
      resetStickHome()
      const rootEl = document.documentElement
      rootEl.style.overscrollBehavior = 'none'
      document.body.style.overscrollBehavior = 'none'
      const el = canvas || document.querySelector('body > canvas')
      if (el) {
        el.style.touchAction = 'none'
        el.style.overscrollBehavior = 'none'
      }
    }
  }

  addEventListener('resize', () => {
    if (active && ![...pointers.values()].some(p => p.role === 'stick')) resetStickHome()
  })
  if (root) root.addEventListener('click', () => { requestShell() })

  apply(wantTouchUi())

  const mq = window.matchMedia('(pointer: coarse)')
  const onMq = () => {
    const q = new URLSearchParams(location.search)
    if (q.has('touch') || q.has('desktop')) return
    apply(wantTouchUi())
  }
  if (mq.addEventListener) mq.addEventListener('change', onMq)
  else if (mq.addListener) mq.addListener(onMq)

  function tapAt(clientX, clientY) {
    const ndc = clientToNdc(clientX, clientY)
    fireTap(clientX, clientY)
    return { ndc, ...dump() }
  }

  function tapNdc(x, y) {
    if (player && player.pulseFire) player.pulseFire(0, { x: +x || 0, y: +y || 0 })
    return dump()
  }

  function press(name, down = true) {
    const n = String(name || '').toLowerCase()
    if (n === 'jump' || n === 'space') {
      key('Space', down)
      btnJump && btnJump.classList.toggle('on', !!down)
    } else if (n === 'l' || n === 'left') setHand('l', down)
    else if (n === 'r' || n === 'right') setHand('r', down)
    return dump()
  }

  function dump() {
    const a = player && player.analog
    return {
      active,
      analog: a ? { x: +a.x.toFixed(3), z: +a.z.toFixed(3) } : null,
      run: !!(player && player.keys.has('ShiftLeft')),
      hands: { l: handOn.l, r: handOn.r },
      jump: !!(player && player.keys.has('Space')),
      left: !!(player && player.leftHand),
      right: !!(player && player.rightHand),
      fire1: !!(player && player.getMouse && player.getMouse(0)),
      fire2: !!(player && player.getMouse && player.getMouse(2)),
      touchLock: !!(player && player.touchLock),
      posOpen: document.body.classList.contains('pos-open'),
      aim: player && player.aimNdc
        ? { x: +player.aimNdc.x.toFixed(3), y: +player.aimNdc.y.toFixed(3) }
        : null,
    }
  }

  return {
    get active() { return active },
    apply,
    force(on) { apply(!!on) },
    setStick,
    press,
    tapAt,
    tapNdc,
    dump,
    wantTouchUi,
    RUN_MAG,
  }
}
