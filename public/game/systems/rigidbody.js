import { C } from '../common/ecs.js'

export function update(world, dt) {
  for (const [, tf, rb] of world.query(C.Transform, C.Rigidbody)) {
    tf.x += rb.vx * dt
    tf.y += rb.vy * dt
    tf.z += rb.vz * dt
  }
}
