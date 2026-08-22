// Third-person player stand-ins: staff skins, nametag, arm raise/lower,
// and a short motion cycle. Height matches the CharacterController (2 units)
// so from our 1.6 eye camera they look like the original FPS screenshot.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'

export const BADGE_ICONS = [
  'Worker', 'Citizen', 'Boss', 'Mayor', 'President', 'Family',
]

export const PLAYER_SKINS = [
  { skin: 'Staff1', name: 'I_AM_WILDCAT', badge: 'Worker' },
  { skin: 'Staff2', name: 'LINE_COOK',    badge: 'Citizen' },
  { skin: 'Staff3', name: 'PREP',         badge: 'Boss' },
  { skin: 'Staff4', name: 'SOUS',         badge: 'Mayor' },
  { skin: 'Staff5', name: 'EXPO',         badge: 'President' },
  { skin: 'Staff6', name: 'HOST',         badge: 'Family' },
  { skin: 'Staff7', name: 'BOH',          badge: 'Worker' },
  { skin: 'Kritz',  name: 'KRITZ',        badge: 'Citizen' },
]

const HEIGHT = 2.0
const ARM_LERP = 25
const STATES = [
  { id: 'idle',       dur: 1.8 },
  { id: 'left',       dur: 1.6 },
  { id: 'idle',       dur: 0.5 },
  { id: 'right',      dur: 1.6 },
  { id: 'idle',       dur: 0.5 },
  { id: 'both',       dur: 2.0 },
  { id: 'look',       dur: 2.8 },
  { id: 'jump',       dur: 0.7 },
]

function loadSkin(name) {
  const t = new THREE.TextureLoader().load(`./assets/textures/skins/${name}.png`)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = true
  return t
}

function applySkin(root, texture) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.trigger) return
    if (o.name === 'NameTag' || o.name === 'NameTagTop') return
    o.material = o.material.clone()
    o.material.map = texture
    o.material.color.set(0xffffff)
    o.material.needsUpdate = true
    o.castShadow = o.receiveShadow = true
  })
}

function loadBadgeIcon(id) {
  const t = new THREE.TextureLoader().load(`./assets/textures/badges/${id}.png`)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = true
  return t
}

function makeNameText(username) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.clearRect(0, 0, 512, 256)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.miterLimit = 2
  const stroke = (text, x, y) => {
    g.lineWidth = 10
    g.strokeStyle = 'rgba(255,255,255,0.88)'
    g.strokeText(text, x, y)
    g.fillText(text, x, y)
  }
  g.fillStyle = '#c4122e'
  g.font = 'italic 46px Georgia, "Palatino Linotype", cursive'
  stroke('HELLO MY NAME IS', 256, 54)
  g.fillStyle = '#111111'
  let size = 68
  g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  while (g.measureText(username).width > 460 && size > 22) {
    size -= 2
    g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  }
  stroke(username, 256, 168)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.72),
    new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false, toneMapped: false,
    }),
  )
  mesh.name = 'NameText'
  return mesh
}

// Prefab NameTag sits at hip height on local -Z (a purse), nested under
// Player's (2,3,2) scale. Seat it on the chest in world space, facing
// local +X, with the burger icon as the card and diegetic HELLO / name
// text on the face — no canvas plate, no head float.
function seatNameTag(body, username, badgeId) {
  const tag = body.getObjectByName('NameTag')
  if (!tag) return null
  body.updateMatrixWorld(true)
  const box = boundsOf(body)
  const h = box.max.y - box.min.y || 2
  const yaw = body.rotation.y
  const world = new THREE.Vector3(
    body.position.x + Math.cos(yaw) * 0.34,
    box.min.y + h * 0.55,
    body.position.z - Math.sin(yaw) * 0.34,
  )
  tag.parent.updateMatrixWorld(true)
  tag.parent.worldToLocal(world)
  tag.position.copy(world)
  tag.rotation.set(0, -Math.PI / 2, 0)
  tag.scale.set(0.82, 0.34, 0.055)
  tag.traverse(o => {
    if (o.name === 'Hello' || o.name === 'Username') o.visible = false
    if (o.isMesh && o.name === 'NameTag') {
      o.material = o.material.clone()
      o.material.map = loadBadgeIcon(badgeId)
      o.material.color.set(0xffffff)
      o.material.needsUpdate = true
    }
  })
  const text = makeNameText(username)
  text.position.set(0, -0.04, -0.52)
  text.rotation.y = Math.PI
  tag.add(text)
  return tag
}

function sitPlayer(root) {
  hideTriggers(root)
  root.updateMatrixWorld(true)
  const box = boundsOf(root)
  const h = box.max.y - box.min.y || 1
  root.scale.multiplyScalar(HEIGHT / h)
  root.updateMatrixWorld(true)
  const fitted = boundsOf(root)
  const mid = fitted.getCenter(new THREE.Vector3())
  root.position.x -= mid.x
  root.position.z -= mid.z
  root.position.y -= fitted.min.y
}

function makeWorldArm(armProto, side) {
  const object = armProto.clone(true)
  object.name = side + '-arm-3p'
  object.visible = false
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  const sign = side === 'left' ? -1 : 1
  return { side, sign, object, baseScale: object.scale.clone(), raise: 0 }
}

export function createDemoPlayers({ scene, player, playerProto, armProto }) {
  const skins = {}
  for (const s of PLAYER_SKINS) skins[s.skin] = loadSkin(s.skin)

  const list = []
  const n = PLAYER_SKINS.length
  const spacing = 2.15
  const x0 = -((n - 1) * spacing) / 2
  const z = 7.2
  // Face the incoming FPS camera (spawn at z=11, looking -Z).
  const faceYaw = Math.atan2(0, 1) // +X toward +Z? wait: atan2(-dz,+dx) with dir (0,1) in xz toward +Z
  // +X = (cos θ, -sin θ); want +X = (0, 1) in xz → cos=0, -sin=1 → θ = -π/2
  const yaw = -Math.PI / 2

  PLAYER_SKINS.forEach((spec, i) => {
    const body = playerProto.clone(true)
    applySkin(body, skins[spec.skin])
    sitPlayer(body)
    const inv = 1 / (body.scale.y || 1)
    body.position.x = x0 + i * spacing
    body.position.z = z
    body.rotation.y = yaw
    body.traverse(o => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
      if (o.name === 'Hello' || o.name === 'Username') o.visible = false
    })

    const badge = seatNameTag(body, spec.name, spec.badge || BADGE_ICONS[i % BADGE_ICONS.length])

    const left = makeWorldArm(armProto, 'left')
    const right = makeWorldArm(armProto, 'right')
    scene.add(left.object)
    scene.add(right.object)

    scene.add(body)
    const demo = {
      spec, body, left, right, badge,
      inv,
      baseY: body.position.y,
      faceYaw: yaw,
      state: 0,
      t: Math.random() * -2,
      radius: 0.45,
      position: body.position,
    }
    body.userData.demoPlayer = demo
    body.traverse(o => { o.userData.demoPlayer = demo })
    player.addMover(demo)
    list.push(demo)
  })

  const _raised = new THREE.Vector3()
  const _hidden = new THREE.Vector3()
  const _face = new THREE.Vector3()
  const _side = new THREE.Vector3()
  const _look = new THREE.Vector3()
  const _dummy = new THREE.Object3D()
  const _eul = new THREE.Euler(0, 0, 0, 'YXZ')
  const _q = new THREE.Quaternion()

  function poseArm(demo, arm, raised, dt) {
    const s = arm.sign
    const origin = demo.body.position
    // Player faces along local +X. World face / right from yaw.
    const yaw = demo.body.rotation.y
    _face.set(Math.cos(yaw), 0, -Math.sin(yaw))
    _side.set(_face.z, 0, -_face.x) // right
    _raised.copy(origin)
      .addScaledVector(_face, 0.28)
      .addScaledVector(_side, s * 0.52)
      .setY(origin.y + 0.32)
    _hidden.copy(origin)
      .addScaledVector(_side, s * 0.2)
      .setY(origin.y - 1.4)
    const target = raised ? _raised : _hidden
    if (raised && !arm.object.visible) {
      arm.object.position.copy(_hidden)
      arm.object.visible = true
    }
    arm.object.position.lerp(target, Math.min(1, ARM_LERP * dt))
    // Hand sits on local −Z; point that axis forward and a little down.
    _look.copy(_face).multiplyScalar(-1)
    _look.y = 0.55
    _dummy.position.copy(arm.object.position)
    _dummy.lookAt(
      arm.object.position.x + _look.x,
      arm.object.position.y + _look.y,
      arm.object.position.z + _look.z,
    )
    arm.object.quaternion.slerp(_dummy.quaternion, Math.min(1, ARM_LERP * dt))
    if (!raised && arm.object.position.distanceTo(_hidden) < 0.15) {
      arm.object.visible = false
    }
  }

  function update(dt) {
    dt = Math.min(dt, 0.1)
    for (const d of list) {
      d.t += dt
      const st = STATES[d.state]
      if (d.t >= st.dur) {
        d.t = 0
        d.state = (d.state + 1) % STATES.length
      }
      const id = STATES[d.state].id
      poseArm(d, d.left, id === 'left' || id === 'both', dt)
      poseArm(d, d.right, id === 'right' || id === 'both', dt)

      if (id === 'look') {
        d.body.rotation.y = d.faceYaw + Math.sin(d.t * 2.2) * 0.7
      } else {
        d.body.rotation.y = THREE.MathUtils.lerp(d.body.rotation.y, d.faceYaw, Math.min(1, 6 * dt))
      }

      if (id === 'jump') {
        const u = Math.min(1, d.t / st.dur)
        d.body.position.y = d.baseY + Math.sin(u * Math.PI) * 0.62
      } else {
        d.body.position.y = THREE.MathUtils.lerp(d.body.position.y, d.baseY, Math.min(1, 10 * dt))
      }
    }
  }

  function setScale(mul) {
    const s = Math.max(0.05, mul)
    for (const d of list) {
      d.left.object.scale.copy(d.left.baseScale).multiplyScalar(s)
      d.right.object.scale.copy(d.right.baseScale).multiplyScalar(s)
    }
  }

  return { players: list, update, setScale }
}
