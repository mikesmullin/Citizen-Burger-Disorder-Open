// Impact sound, ported from AudioLibrary.cs + PickupObject.OnCollisionEnter.
// A random one-shot from a small set, played positionally, with a short
// per-type cooldown so a plate can clatter but never machine-gun.
//
// Kritz's layering: wet = bacon/cheese/patty/tomato, dry = everything else,
// and a dedicated plate-collision set (clank / clatter) when a Plate touches.

import * as THREE from 'three'

const SETS = {
  plate: [
    'PlateCollision.mp3',
    'PlateCollision01.mp3', 'PlateCollision02.mp3', 'PlateCollision03.mp3',
    'PlateCollision04.mp3', 'PlateCollision05.mp3', 'PlateCollision06.mp3',
    'PlateCollision07.mp3', 'PlateCollision08.mp3',
  ],
  wet: [
    'WetDropping01.mp3', 'WetDropping02.mp3',
    'MeatDropping.mp3', 'SoftMeat.mp3',
  ],
  dry: [
    'DryDropping01.mp3',
    'FoodDroppingPlate01.mp3', 'FoodDroppingPlate02.mp3',
  ],
}
const BASE = './assets/audio/sfx/'

// Which set a food type drops into.
export function impactSet(type) {
  if (type === 'plate') return 'plate'
  if (type === 'patty' || type === 'cheese' || type === 'tomato' || type === 'bacon') return 'wet'
  if (type === 'rat') return 'wet'
  return 'dry'
}

export function createImpactSfx({ player, scene } = {}) {
  let listener = player?.camera?.children?.find(c => c.type === 'AudioListener')
  if (!listener && player?.camera) {
    listener = new THREE.AudioListener()
    player.camera.add(listener)
  }

  const buffers = new Map()   // url -> AudioBuffer
  const last = { plate: 0, wet: 0, dry: 0 }
  let globalLast = 0
  let nodeSeq = 0
  const PER_TYPE = 0.12
  const GLOBAL = 0.06
  const MIN_SPEED = 1.1

  const loader = new THREE.AudioLoader()
  for (const set of Object.values(SETS)) {
    for (const name of set) {
      const url = BASE + name
      if (buffers.has(url)) continue
      loader.load(url, buf => buffers.set(url, buf),
        undefined, err => { /* missing clip: set stays short */ })
    }
  }

  function pick(setName) {
    const set = SETS[setName] || SETS.dry
    let idx = (Math.random() * set.length) | 0
    // avoid re-using the very last clip for this set
    if (set.length > 1 && last[setName + '_i'] === idx) idx = (idx + 1) % set.length
    last[setName + '_i'] = idx
    return BASE + set[idx]
  }

  function playAt(url, pos, volume) {
    if (!listener || !scene) return
    const buf = buffers.get(url)
    if (!buf) return
    const a = new THREE.PositionalAudio(listener)
    a.setBuffer(buf)
    a.setRefDistance(2.2)
    a.setMaxDistance(16)
    a.setRolloffFactor(1)
    a.setVolume(volume)
    const host = new THREE.Object3D()
    host.position.copy(pos)
    host.name = 'sfx' + (nodeSeq++)
    host.add(a)
    scene.add(host)
    try {
      a.play()
      const remove = () => { if (host.parent) host.parent.remove(host) }
      a.addEventListener('ended', remove)
      a.addEventListener('error', remove)
      if (buf.duration) setTimeout(remove, buf.duration * 1000 + 200)
    } catch (_) { /* autoplay */ }
  }

  // `time` is the harness clock (dbg.state().T) so freeze/step stays sane.
  function impact(item, speed, time = 0) {
    if (!item || speed < MIN_SPEED) return
    const set = impactSet(item.type)
    if (time - last[set] < PER_TYPE) return
    if (time - globalLast < GLOBAL) return
    last[set] = time
    globalLast = time
    const vol = Math.min(1, 0.25 + speed / 14)
    playAt(pick(set, time), item.position, vol)
  }

  function dump() {
    return {
      loaded: buffers.size,
      sets: Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, v.length])),
    }
  }

  return { impact, impactSet, dump }
}
