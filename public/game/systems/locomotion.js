import { C } from '../common/ecs.js'

export function update(world, dt, ctx = {}) {
  const groundY = ctx.groundY
  const resolveXZ = ctx.resolveXZ
  const slideXZ = ctx.slideXZ
  for (const [eid, tf, loco] of world.query(C.Transform, C.Locomotor)) {
    const view = world.field(eid, C.View)
    const x0 = tf.x, z0 = tf.z
    if (loco.hasGoal) {
      const dx = loco.goalx - tf.x
      const dz = loco.goalz - tf.z
      const dist = Math.hypot(dx, dz)
      loco.arrivedist = dist
      if (dist < 0.05) {
        tf.x = loco.goalx
        tf.z = loco.goalz
        loco.hasGoal = false
        loco.arrivedist = 0
      } else {
        loco.dirx = dx / dist
        loco.dirz = dz / dist
        const s = loco.indoor ? Math.min(loco.walkspeed, 5.3) : loco.walkspeed
        tf.x += loco.dirx * s * dt
        tf.z += loco.dirz * s * dt
        tf.ry = Math.atan2(-loco.dirz, loco.dirx) * 180 / Math.PI
      }
    }
    const skip = view?.mover
    if (slideXZ) {
      const hit = slideXZ(x0, z0, tf.x, tf.z, 0.42, skip)
      tf.x = hit.x
      tf.z = hit.z
    } else if (resolveXZ) {
      const hit = resolveXZ(tf.x, tf.z, 0.42, skip)
      tf.x = hit.x
      tf.z = hit.z
    }
    const gy = groundY ? groundY(tf.x, tf.z) : 0
    tf.y = gy + (view?.footY || 0)
    // Keep the mesh on this frame's transform so later movers (and this
    // diner's own collider) don't resolve against last frame's ghost.
    if (view?.object) view.object.position.set(tf.x, tf.y, tf.z)
  }
}

export function setGoal(loco, x, z) {
  loco.goalx = x
  loco.goalz = z
  loco.hasGoal = true
  // Same-frame systems (Queue, SeatArrive) must not treat the previous
  // destination's arrivedist as "already there."
  loco.arrivedist = 999
}

export function clearGoal(loco) {
  loco.hasGoal = false
  loco.arrivedist = 0
}
