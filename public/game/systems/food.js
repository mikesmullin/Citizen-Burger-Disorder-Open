// World food: gravity, floor registry (FloorTrigger.foodDropPosition),
// and cheese spawners. Rats read `foodOnFloor()`.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'

export function inferFoodType(slug = '', label = '') {
  const s = (slug + ' ' + label).toLowerCase()
  if (s.includes('cheese')) return 'cheese'
  if (s.includes('patty')) return 'patty'
  if (s.includes('bacon')) return 'bacon'
  if (s.includes('tomato')) return 'tomato'
  if (s.includes('lettuce')) return 'lettuce'
  if (s.includes('bun-top') || s.includes('bun_top') || s.includes('topbun')) return 'topBun'
  if (s.includes('bun')) return 'bun'
  return 'other'
}

export function ratWillSteal(type) {
  return type === 'cheese' || type === 'patty' || type === 'bacon' || type === 'tomato'
}

export function layoutFood(root, { maxSize = 0.55, sit = false } = {}) {
  hideTriggers(root)
  root.updateMatrixWorld(true)
  const box = boundsOf(root)
  if (box.isEmpty()) return { height: 0.1 }
  const size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z, 1e-4)
  const s = longest > maxSize ? maxSize / longest : 1
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true)
  const fitted = boundsOf(root)
  const mid = fitted.getCenter(new THREE.Vector3())
  const sz = fitted.getSize(new THREE.Vector3())
  root.position.x -= mid.x
  root.position.z -= mid.z
  if (sit) root.position.y -= fitted.min.y
  else root.position.y -= mid.y
  return { height: sz.y, size: sz }
}

export function createFoodWorld({ scene, player }) {
  const items = []
  const spawners = []
  const SPAWN_EVERY = 5 * 60

  function spawn({ proto, type, x, z, y = null, onFloor = false, fromSpawner = null, maxSize }) {
    const object = proto.clone(true)
    const { height } = layoutFood(object, { maxSize: maxSize ?? (onFloor ? 0.7 : 0.5), sit: true })
    object.position.x = x
    object.position.z = z
    object.position.y = y != null && !onFloor ? y : height * 0.5
    scene.add(object)
    const item = {
      object, type,
      position: object.position,
      radius: 0.28,
      height,
      foodBeenOnFloor: !!onFloor,
      held: false,
      stolen: null,
      vel: new THREE.Vector3(),
      onFloor: !!onFloor,
      fromSpawner,
    }
    object.userData.food = item
    object.traverse(o => { o.userData.food = item })
    items.push(item)
    if (fromSpawner) fromSpawner.item = item
    return item
  }

  function destroy(item) {
    if (!item) return
    scene.remove(item.object)
    const i = items.indexOf(item)
    if (i >= 0) items.splice(i, 1)
    if (item.fromSpawner && item.fromSpawner.item === item) item.fromSpawner.item = null
  }

  function addSpawner(x, z, proto) {
    const g = new THREE.Group()
    g.position.set(x, 0.01, z)
    const grate = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.95 })
    )
    grate.rotation.x = -Math.PI / 2
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 12),
      new THREE.MeshBasicMaterial({ color: 0x0a0806 })
    )
    hole.rotation.x = -Math.PI / 2
    hole.position.y = 0.012
    g.add(grate, hole)
    scene.add(g)
    const sp = { x, z, proto, item: null, next: 0, mesh: g }
    spawners.push(sp)
    return sp
  }

  function foodOnFloor() {
    return items.filter(i => i.foodBeenOnFloor && !i.held && !i.stolen && ratWillSteal(i.type))
  }

  function update(dt, time) {
    dt = Math.min(dt, 0.1)
    for (const sp of spawners) {
      if (sp.item && items.includes(sp.item)) continue
      sp.item = null
      if (time >= sp.next) {
        spawn({ proto: sp.proto, type: 'cheese', x: sp.x, z: sp.z, onFloor: true, fromSpawner: sp })
        sp.next = time + SPAWN_EVERY
      }
    }

    for (const item of items) {
      if (item.held || item.stolen) continue
      item.vel.y -= 9.81 * dt
      item.object.position.addScaledVector(item.vel, dt)
      const half = item.height * 0.5
      if (item.object.position.y - half <= 0) {
        item.object.position.y = half
        if (item.vel.y < 0) item.vel.y *= -0.15
        if (Math.abs(item.vel.y) < 0.4) item.vel.y = 0
        item.vel.x *= Math.max(0, 1 - 6 * dt)
        item.vel.z *= Math.max(0, 1 - 6 * dt)
        if (item.vel.lengthSq() < 0.04) item.vel.set(0, 0, 0)
        item.onFloor = true
        item.foodBeenOnFloor = true
      } else {
        item.onFloor = false
      }
      const hit = player.resolveXZ(item.object.position.x, item.object.position.z, item.radius, null)
      item.object.position.x = hit.x
      item.object.position.z = hit.z
    }
  }

  return { items, spawners, spawn, destroy, addSpawner, foodOnFloor, update, SPAWN_EVERY }
}
