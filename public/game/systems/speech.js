import * as THREE from 'three'
import { C } from '../common/ecs.js'

const badgeMaps = {}
const loader = new THREE.TextureLoader()

function badgeMap(name) {
  if (badgeMaps[name]) return badgeMaps[name]
  const url = name === 'NumberStand'
    ? null
    : `./assets/textures/badges/${name}.png`
  if (!url) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 192
    const g = c.getContext('2d')
    g.fillStyle = '#f4fff8'
    g.fillRect(0, 0, 256, 192)
    g.fillStyle = '#1a1a1a'
    g.font = '700 48px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('#', 128, 80)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    badgeMaps[name] = t
    return t
  }
  const t = loader.load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  badgeMaps[name] = t
  return t
}

export function update(world, ctx) {
  const playerPos = ctx.playerPos || { x: 0, z: 0 }
  const bubbles = ctx.bubbles
  for (const [eid, speech, tf, view] of world.query(C.Speech, C.Transform, C.View)) {
    const think = world.field(eid, C.Thinker)
    const cust = world.field(eid, C.Customer)
    const dist = Math.hypot(tf.x - playerPos.x, tf.z - playerPos.z)
    let show = false
    if (speech.icon) {
      const want = think && think.want
      if (want === 'order') show = cust && cust.queueSlot === 1
      else if (want === 'waitFood') show = dist < 7
    }
    const slot = view.object && view.object.userData.bubbleSlot
    if (slot >= 0 && bubbles) {
      bubbles.set(slot, {
        x: tf.x, y: tf.y + 1.28, z: tf.z,
        icon: speech.icon || 'notice',
        visible: show,
      })
    } else {
      const bubble = view.object && view.object.userData.bubble
      if (bubble) {
        bubble.visible = show
        if (show) {
          bubble.position.set(tf.x, tf.y + 1.28, tf.z)
          if (bubble.userData.icon !== speech.icon) {
            bubble.material.map = badgeMap(speech.icon)
            bubble.material.needsUpdate = true
            bubble.userData.icon = speech.icon
          }
        }
      }
    }
    if (view.object && think) {
      view.object.traverse(o => { o.userData.want = think.want })
    }
  }
}
