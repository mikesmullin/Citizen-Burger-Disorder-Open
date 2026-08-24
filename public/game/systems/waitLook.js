import { C } from '../common/ecs.js'

// Same radius as the waitFood burger bubble in speech.js.
const NOTICE = 7
// Hall crowd TURN_NOTICE (2.8 rad/s), in degrees.
const TURN = 2.8 * 180 / Math.PI

function wrap180(a) {
  while (a > 180) a -= 360
  while (a < -180) a += 360
  return a
}

function turnToward(tf, targetRy, dt) {
  const d = wrap180(targetRy - tf.ry)
  const maxStep = TURN * dt
  tf.ry = wrap180(tf.ry + (Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep))
}

export function facingTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toZ - fromZ), toX - fromX) * 180 / Math.PI
}

export function update(world, dt, ctx) {
  const p = ctx.playerPos || { x: 0, z: 0 }
  dt = Math.min(dt, 0.1)
  for (const [, think, tf] of world.query(C.Thinker, C.Transform, C.Customer)) {
    if (think.want !== 'waitFood') continue
    const dist = Math.hypot(tf.x - p.x, tf.z - p.z)
    let target = think.restRy
    if (dist < NOTICE) target = facingTo(tf.x, tf.z, p.x, p.z)
    if (target == null) continue
    turnToward(tf, target, dt)
  }
}
