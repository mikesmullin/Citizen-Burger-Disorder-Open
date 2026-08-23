// Wall light switches. One switch owns one PointLight (or none, for the
// pedestal demo). LMB on the plate toggles the paddle (±45° on local Z,
// same as LightSwitch.cs) and the lamp. Height is chest-reach for the
// 1.6 m eye / 2 m character.
//
// Booth walls do not cast shadows (kills the joint-shadow marks). The
// roof still does, so museum sun cannot light a room once its lamps are off.

import * as THREE from 'three'
import { boundsOf, hideTriggers, fitLongest } from '../common/unityScene.js'

export const SWITCH_Y = 1.32
export const SWITCH_SIZE = 0.22
const PRESS_RANGE = 3.2
const TILT = THREE.MathUtils.degToRad(45)
const SPEED = 15

function yawFromInward(nx, nz) {
  return Math.atan2(-nz, nx)
}

function makeClickBuffer(ctx) {
  const sr = ctx.sampleRate
  const n = Math.max(1, (sr * 0.045) | 0)
  const buf = ctx.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const env = Math.exp(-t * 90)
    d[i] = (Math.sin(2 * Math.PI * 2100 * t) * 0.55
      + (Math.random() * 2 - 1) * 0.22) * env
  }
  return buf
}

function findPaddle(root) {
  let paddle = null
  root.traverse(o => {
    if (!paddle && o.name === 'Switch') paddle = o
  })
  return paddle
}

function paddleZ(on, invert) {
  const onZ = invert ? TILT : -TILT
  return on ? onZ : -onZ
}

// Booth walls must not cast (joint-shadow acne). The roof still does, so
// museum sun cannot light a room once its own lamps are off.
export function muteBoothShadows(root, { skipNames = [], castNames = [] } = {}) {
  const skip = new Set(skipNames)
  const cast = new Set(castNames)
  root.traverse(o => {
    if (!o.isMesh) return
    if (skip.has(o.name)) return
    o.castShadow = cast.has(o.name)
  })
}

export function attachSwitch(object, {
  light = null,
  label = 'Lights',
  startOn = true,
  invertPaddle = false,
  onToggle = null,
  lookOn = '',
  lookOff = '',
  listener = null,
  clickBuf = null,
} = {}) {
  const paddle = findPaddle(object)
  const handle = {
    wrap: object, object, paddle, light, label,
    invertPaddle: !!invertPaddle,
    onToggle, lookOn, lookOff,
    on: !!startOn,
    goalZ: paddleZ(!!startOn, invertPaddle),
  }
  object.traverse(o => {
    o.userData.wallSwitch = handle
    o.userData.noGrab = true
  })

  if (light) {
    if (light.userData.baseIntensity == null) {
      light.userData.baseIntensity = light.intensity
    }
    light.userData.goalIntensity = handle.on ? light.userData.baseIntensity : 0
    if (!handle.on) {
      light.intensity = 0
      light.visible = false
    }
  }
  if (paddle) paddle.rotation.z = handle.goalZ

  let click = null
  if (listener && clickBuf) {
    click = new THREE.PositionalAudio(listener)
    click.setBuffer(clickBuf)
    click.setRefDistance(1.8)
    click.setVolume(0.85)
    object.add(click)
  }

  function playClick() {
    if (!listener) return
    const ctx = listener.context
    if (ctx && ctx.state === 'suspended') ctx.resume()
    if (!click) return
    try {
      if (click.isPlaying) click.stop()
      click.play()
    } catch (_) { /* autoplay */ }
  }

  function applyLight() {
    if (!light) return
    const base = light.userData.baseIntensity || 1
    light.userData.goalIntensity = handle.on ? base : 0
    if (handle.on) light.visible = true
  }

  function setOn(state) {
    handle.on = !!state
    handle.goalZ = paddleZ(handle.on, handle.invertPaddle)
    applyLight()
    if (onToggle) onToggle(handle.on)
  }

  function toggle() {
    setOn(!handle.on)
    playClick()
    return handle.on
  }

  function update(dt) {
    dt = Math.min(dt, 0.1)
    const k = 1 - Math.exp(-SPEED * dt)
    if (paddle) {
      paddle.rotation.z += (handle.goalZ - paddle.rotation.z) * k
    }
    if (light && light.userData.baseIntensity != null) {
      const goal = light.userData.goalIntensity
      light.intensity += (goal - light.intensity) * k
      if (!handle.on && light.intensity < 0.04) {
        light.intensity = 0
        light.visible = false
      }
    }
  }

  handle.setOn = setOn
  handle.toggle = toggle
  handle.update = update
  return handle
}

export function mountSwitch({
  parent, proto, light,
  x, y = SWITCH_Y, z,
  inwardX = 1, inwardZ = 0,
  label = 'Lights',
  startOn = true,
  invertPaddle = false,
  onToggle = null,
  lookOn = '',
  lookOff = '',
  listener = null,
  clickBuf = null,
} = {}) {
  const wrap = new THREE.Group()
  wrap.name = 'WallSwitch'
  wrap.position.set(x + inwardX * 0.03, 0, z + inwardZ * 0.03)
  wrap.rotation.y = yawFromInward(inwardX, inwardZ)
  parent.add(wrap)

  const object = proto.clone(true)
  hideTriggers(object)
  object.position.set(0, 0, 0)
  object.rotation.set(0, 0, 0)
  object.scale.set(1, 1, 1)
  object.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone()
      o.material.side = THREE.DoubleSide
    }
  })
  fitLongest(object, SWITCH_SIZE)
  object.updateMatrixWorld(true)
  const box = boundsOf(object)
  const cy = (box.min.y + box.max.y) / 2
  object.position.x -= box.min.x
  object.position.y += y - cy
  object.position.z -= (box.min.z + box.max.z) / 2
  wrap.add(object)

  const handle = attachSwitch(object, {
    light, label, startOn, invertPaddle, onToggle, lookOn, lookOff,
    listener, clickBuf,
  })
  handle.wrap = wrap
  return handle
}

export function createSwitchSet({ player, proto } = {}) {
  const items = []
  let listener = player?.camera?.children?.find(c => c.type === 'AudioListener') || null
  if (!listener && player?.camera) {
    listener = new THREE.AudioListener()
    player.camera.add(listener)
  }
  const clickBuf = listener ? makeClickBuffer(listener.context) : null
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)

  function add(opts) {
    const p = opts.proto || proto
    if (!p) return null
    const sw = mountSwitch({
      startOn: true, invertPaddle: true, ...opts,
      proto: p, listener, clickBuf,
    })
    items.push(sw)
    return sw
  }

  function bind(object, opts = {}) {
    if (!object) return null
    const sw = attachSwitch(object, {
      startOn: false, label: 'Light switch',
      ...opts, listener, clickBuf,
    })
    items.push(sw)
    return sw
  }

  function pick() {
    if (!player?.camera || !items.length) return null
    raycaster.setFromCamera(ndc, player.camera)
    const roots = items.map(s => s.wrap)
    const hits = raycaster.intersectObjects(roots, true)
    for (const h of hits) {
      if (h.distance > PRESS_RANGE) continue
      const sw = h.object.userData.wallSwitch
      if (sw) return sw
    }
    return null
  }

  function tryPress() {
    if (!player?.locked) return false
    if (!player?.fire1Down) return false
    const sw = pick()
    if (!sw) return false
    sw.toggle()
    return true
  }

  function lookLabel() {
    const sw = pick()
    if (!sw) return ''
    if (sw.on && sw.lookOn) return sw.lookOn
    if (!sw.on && sw.lookOff) return sw.lookOff
    return sw.label + (sw.on ? ' · on · click to switch off' : ' · off · click to switch on')
  }

  function update(dt) {
    for (const sw of items) sw.update(dt)
  }

  return { add, bind, tryPress, lookLabel, update, items, pick }
}
