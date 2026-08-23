import { C } from '../common/ecs.js'

export function update(world) {
  for (const [, tf, view] of world.query(C.Transform, C.View)) {
    if (!view.object) continue
    view.object.position.set(tf.x, tf.y, tf.z)
    view.object.rotation.set(
      tf.rx * Math.PI / 180,
      tf.ry * Math.PI / 180,
      tf.rz * Math.PI / 180,
    )
  }
}
