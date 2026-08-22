// Discrete simulation clock: freeze the world, then step N frames of dt.
// Render still runs every rAF so a screenshot after freeze is the frozen frame.
// This is not a rewind — T only goes forward unless you call resetT().

import * as THREE from 'three'

export const STEP_DT = 1 / 60

export function createTimeTravel({ dt = STEP_DT, maxSteps = 6000 } = {}) {
  let T = 0
  let frozen = false
  let frames = 0
  const clock = new THREE.Clock()
  let tickFn = () => {}
  let renderFn = () => {}

  function bind({ tick, render } = {}) {
    if (tick) tickFn = tick
    if (render) renderFn = render
  }

  function info() {
    return {
      frozen,
      T: +T.toFixed(4),
      frames,
      dt,
      playing: !frozen,
    }
  }

  // Consume wall-clock delta. Returns dt to tick, or 0 when frozen.
  function advance() {
    const wall = Math.min(clock.getDelta(), 0.1)
    if (frozen) return 0
    T += wall
    frames++
    return wall
  }

  function freeze(v = true) {
    clock.getDelta()
    frozen = !!v
    renderFn()
    return info()
  }

  function unfreeze() {
    return freeze(false)
  }

  function toggle() {
    return freeze(!frozen)
  }

  function step(n = 1) {
    frozen = true
    n = Math.max(1, Math.min(maxSteps, n | 0))
    for (let i = 0; i < n; i++) {
      T += dt
      frames++
      tickFn(dt)
    }
    renderFn()
    return info()
  }

  function stepMs(ms) {
    return step(Math.max(1, Math.round(ms / (dt * 1000))))
  }

  function resetT() {
    T = 0
    frames = 0
    clock.getDelta()
    renderFn()
    return info()
  }

  return {
    bind, advance, freeze, unfreeze, toggle, step, stepMs, resetT, info,
    get T() { return T },
    get frozen() { return frozen },
    get frames() { return frames },
    dt,
  }
}
