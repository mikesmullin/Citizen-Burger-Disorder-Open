// Third-person player stand-ins: staff skins, nametag, arm raise/lower,
// and a short motion cycle. Height matches the CharacterController (2 units)
// so from our 1.6 eye camera they look like the original FPS screenshot.

import * as THREE from 'three'
import { boundsOf, hideTriggers } from '../common/unityScene.js'
import { createInstancePool, visualMesh, hideVisuals } from '../common/instancePool.js'

export const PLAYER_SKINS = [
  { skin: null,    name: 'PLAYER' },
  { skin: 'Staff1', name: 'I_AM_WILDCAT' },
  { skin: 'Staff2', name: 'LINE_COOK' },
  { skin: 'Staff3', name: 'PREP' },
  { skin: 'Staff4', name: 'SOUS' },
  { skin: 'Staff5', name: 'EXPO' },
  { skin: 'Staff6', name: 'HOST' },
  { skin: 'Staff7', name: 'BOH' },
  { skin: 'Kritz',  name: 'KRITZ' },
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

// Default Feac.png face sits at u≈0.34; THREE.CapsuleGeometry puts local +X
// (the badge / "forward") at u=0.5. Shift the map, not the mesh, so the
// nametag stays on the chest.
const FEAC_FACE_OFFSET_U = -0.18

function alignDefaultFace(root) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.trigger) return
    if (o.name === 'NameTag' || o.name === 'NameTagTop' || o.name === 'NameText') return
    if (!o.material || !o.material.map) return
    o.material = o.material.clone()
    const map = o.material.map.clone()
    map.wrapS = THREE.RepeatWrapping
    map.offset.x = FEAC_FACE_OFFSET_U
    map.needsUpdate = true
    o.material.map = map
    o.material.needsUpdate = true
  })
}

// Classic "HELLO my name is" sticker: red header, solid white body.
// Burger PNGs under textures/badges/ are menu-item art for the kitchen
// order board — they do not belong on the nametag. Front-facing plane only;
// the Unity NameTag cube is kept as a transform host but not drawn.
const BADGE_W = 0.96
const BADGE_H = 0.60

function makeNameBadge(username) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 320)
  g.fillStyle = '#c4122e'
  g.fillRect(0, 0, 512, 108)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 52px ui-sans-serif, system-ui, sans-serif'
  g.fillText('HELLO', 256, 42)
  g.font = 'italic 28px Georgia, "Palatino Linotype", cursive'
  g.fillText('my name is', 256, 84)
  g.fillStyle = '#111111'
  let size = 64
  g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  while (g.measureText(username).width > 460 && size > 22) {
    size -= 2
    g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
  }
  g.fillText(username, 256, 214)
  g.strokeStyle = '#1a1a1a'
  g.lineWidth = 8
  g.strokeRect(4, 4, 504, 312)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BADGE_W, BADGE_H),
    new THREE.MeshBasicMaterial({
      map, toneMapped: false, side: THREE.FrontSide,
    }),
  )
  mesh.name = 'NameText'
  return mesh
}

// Prefab NameTag sits at hip height on local -Z (a purse), nested under
// Player's (2,3,2) scale. Seat it on the chest, facing local +X. Pose
// from the museum transform/scale guns (I_AM_WILDCAT / KRITZ pass).
const BADGE_POS = [0.502, 0.372, -0.162]
const BADGE_SCALE = [0.573, 0.238, 0.038]

function seatNameTag(body, username) {
  const tag = body.getObjectByName('NameTag')
  if (!tag) return null
  tag.position.set(...BADGE_POS)
  tag.rotation.set(0, -Math.PI / 2, 0)
  tag.scale.set(...BADGE_SCALE)
  tag.traverse(o => {
    if (o.name === 'Hello' || o.name === 'Username') o.visible = false
    if (o.name === 'NameTagTop') o.visible = false
    if (o.isMesh && o.name === 'NameTag') {
      o.geometry = new THREE.BufferGeometry()
      o.material.visible = false
      o.raycast = () => {}
    }
  })
  const text = makeNameBadge(username)
  text.position.set(0, 0, -0.52)
  text.rotation.y = Math.PI
  tag.add(text)
  tag.userData.baseScale = tag.scale.clone()
  tag.userData.basePos = tag.position.clone()
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

function makeWorldArm(armProto, side, pool) {
  const object = armProto.clone(true)
  object.name = side + '-arm-3p'
  object.visible = false
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  // Hand is local −Z; the +Z end of the cube is the shoulder.
  const shoulderZ = box.max.z
  object.position.set(0, 0, -shoulderZ)
  const pivot = new THREE.Group()
  pivot.name = side + '-shoulder'
  pivot.add(object)
  const sign = side === 'left' ? -1 : 1
  const vis = visualMesh(object)
  const slot = pool && vis ? pool.alloc() : -1
  if (slot >= 0) {
    hideVisuals(object)
    pool.hide(slot)
  }
  return {
    side, sign, object, pivot,
    baseScale: object.scale.clone(),
    shoulderZ,
    raise: 0,
    visual: vis,
    pool,
    slot,
  }
}

export function createDemoPlayers({
  scene, player, playerProto, armProto, armPool, bodies,
  x = 0, z = 7.2, yaw = -Math.PI / 2, spacing = 2.15,
} = {}) {
  const skins = {}
  for (const s of PLAYER_SKINS) {
    if (s.skin) skins[s.skin] = loadSkin(s.skin)
  }

  const list = []
  const pools = {}
  const n = PLAYER_SKINS.length
  const armVis = visualMesh(armProto)
  const sharedArmPool = armPool || (armVis ? createInstancePool({
    geometry: armVis.geometry,
    material: armVis.material.clone(),
    max: n * 2,
    scene,
    name: 'ArmInst',
  }) : null)
  const x0 = x - ((n - 1) * spacing) / 2
  // Player faces along local +X. yaw = -π/2 looks toward +Z (incoming camera).

  PLAYER_SKINS.forEach((spec, i) => {
    const body = playerProto.clone(true)
    if (spec.skin) applySkin(body, skins[spec.skin])
    else alignDefaultFace(body)
    sitPlayer(body)
    const inv = 1 / (body.scale.y || 1)
    body.position.x = x0 + i * spacing
    body.position.z = z
    body.rotation.y = yaw
    body.traverse(o => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
      if (o.name === 'Hello' || o.name === 'Username') o.visible = false
    })

    const badge = seatNameTag(body, spec.name)

    const left = makeWorldArm(armProto, 'left', sharedArmPool)
    const right = makeWorldArm(armProto, 'right', sharedArmPool)
    scene.add(left.pivot)
    scene.add(right.pivot)

    scene.add(body)
    const vis = visualMesh(body)
    const skinKey = spec.skin || 'default'
    const demo = {
      spec, body, left, right, badge,
      inv,
      visual: vis,
      pool: null,
      slot: -1,
      baseY: body.position.y,
      faceYaw: yaw,
      state: 0,
      t: Math.random() * -2,
      radius: 0.45,
      position: body.position,
    }
    if (bodies && vis) {
      const rec = bodies.attach(body, {
        skin: skinKey,
        map: vis.material.map,
        payload: { demo },
      })
      if (rec) {
        demo.pool = rec.pool
        demo.slot = rec.i
        demo.visual = rec.vis
      }
    } else {
      if (!pools[skinKey] && vis) {
        pools[skinKey] = createInstancePool({
          geometry: vis.geometry,
          material: vis.material.clone(),
          max: n,
          scene,
          name: 'PlayerInst:' + skinKey,
        })
      }
      hideVisuals(body)
      demo.pool = pools[skinKey] || null
      if (demo.pool && vis) {
        demo.slot = demo.pool.alloc({ demo })
        demo.pool.setFromObject(demo.slot, vis)
      }
    }
    body.userData.demoPlayer = demo
    body.traverse(o => { o.userData.demoPlayer = demo })
    player.addMover(demo)
    list.push(demo)
  })

  const _face = new THREE.Vector3()
  const _side = new THREE.Vector3()
  const REACH_X = -0.35
  const HANG_X = REACH_X - Math.PI / 2

  function poseArm(demo, arm, raised, dt) {
    const origin = demo.body.position
    const yaw = demo.body.rotation.y
    _face.set(Math.cos(yaw), 0, -Math.sin(yaw))
    _side.set(_face.z, 0, -_face.x)
    // Shoulder stays on the chest; the limb swings around this pivot.
    arm.pivot.position.copy(origin)
      .addScaledVector(_face, 0.10)
      .addScaledVector(_side, arm.sign * 0.40)
    arm.pivot.position.y = origin.y + 0.42

    const want = raised ? 1 : 0
    arm.raise = THREE.MathUtils.lerp(arm.raise, want, Math.min(1, ARM_LERP * dt))
    arm.pivot.rotation.order = 'YXZ'
    arm.pivot.rotation.y = Math.PI / 2 - yaw
    arm.pivot.rotation.z = 0
    arm.pivot.rotation.x = THREE.MathUtils.lerp(HANG_X, REACH_X, arm.raise)

    const show = raised || arm.raise > 0.03
    arm.object.visible = show
    arm.pivot.visible = show
    if (arm.pool && arm.slot >= 0) {
      if (show && arm.visual) arm.pool.setFromObject(arm.slot, arm.visual)
      else arm.pool.hide(arm.slot)
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
      if (d.pool && d.visual) d.pool.setFromObject(d.slot, d.visual)
    }
  }

  function setScale(mul) {
    const s = Math.max(0.05, mul)
    for (const d of list) {
      for (const arm of [d.left, d.right]) {
        arm.object.scale.copy(arm.baseScale).multiplyScalar(s)
        arm.object.position.z = -arm.shoulderZ * s
      }
    }
  }

  function setBadgeScale(mul) {
    const s = Math.max(0.05, mul)
    for (const d of list) {
      const tag = d.badge
      const base = tag && tag.userData.baseScale
      if (!tag || !base) continue
      tag.scale.set(base.x * s, base.y * s, base.z * s)
    }
  }

  function setBadgePos(pos) {
    if (!pos) return
    for (const d of list) {
      if (d.badge) d.badge.position.set(pos.x, pos.y, pos.z)
    }
  }

  function badgeDump() {
    return list.map(d => {
      const tag = d.badge
      if (!tag) return { name: d.spec.name }
      return {
        name: d.spec.name,
        pos: { x: +tag.position.x.toFixed(3), y: +tag.position.y.toFixed(3), z: +tag.position.z.toFixed(3) },
        scale: { x: +tag.scale.x.toFixed(3), y: +tag.scale.y.toFixed(3), z: +tag.scale.z.toFixed(3) },
      }
    })
  }

  return { players: list, update, setScale, setBadgeScale, setBadgePos, badgeDump }
}
