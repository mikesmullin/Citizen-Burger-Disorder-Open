// WebAudio is created on the first key/click, not at boot. Firefox logs
// "AudioContext was prevented from starting automatically" if we `new` it
// (or call source.start) before a user gesture — even when we resume later.

import * as THREE from 'three'

let camera = null
let listener = null
let armed = false
const pending = []

function flush() {
  if (!listener) return
  const q = pending.splice(0)
  for (const fn of q) fn(listener)
}

function inGesture(e) {
  if (e && e.isTrusted === false) return false
  const ua = navigator.userActivation
  if (ua && !ua.isActive) return false
  return true
}

function unlock() {
  if (!listener && camera) {
    listener = camera.children.find(c => c.type === 'AudioListener') || null
    if (!listener) {
      // Create the native context in this call stack (must be a user
      // gesture) and hand it to three so AudioListener does not `new` one.
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) THREE.AudioContext.setContext(new AC())
      listener = new THREE.AudioListener()
      camera.add(listener)
    }
  }
  const ctx = listener?.context
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().then(flush).catch(() => {})
    return
  }
  flush()
}

export function bindAudio(cam) {
  camera = cam || camera
  if (armed) return
  armed = true
  const opts = { capture: true }
  // Firefox: pointerdown is not a transient user activation. Creating or
  // resuming AudioContext there logs "prevented from starting automatically".
  // click / touchend are.
  const kick = e => {
    if (!inGesture(e)) return
    window.removeEventListener('click', kick, opts)
    window.removeEventListener('touchend', kick, opts)
    unlock()
  }
  window.addEventListener('click', kick, opts)
  window.addEventListener('touchend', kick, opts)
}

export function getListener() {
  return listener
}

export function whenAudio(fn) {
  if (listener && listener.context && listener.context.state === 'running') {
    fn(listener)
    return
  }
  pending.push(fn)
}

export function resumeAudio() {
  const ctx = listener?.context
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

export function safePlay(audio, { restart = false } = {}) {
  if (!audio) return
  const ctx = audio.context
  const go = () => {
    try {
      if (restart && audio.isPlaying) audio.stop()
      if (!audio.isPlaying) audio.play()
    } catch (_) { /* autoplay */ }
  }
  if (!ctx || ctx.state === 'suspended') {
    if (ctx) ctx.resume().then(go).catch(() => {})
    return
  }
  go()
}

export function loadBuffer(url, onLoad, onErr) {
  whenAudio(lis => {
    new THREE.AudioLoader().load(
      url,
      buf => onLoad(buf, lis),
      undefined,
      err => { if (onErr) onErr(err) },
    )
  })
}
