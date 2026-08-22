// Scene 01 — first-person walk through a museum of converted prefabs.
// Demonstrates: player controller (move / look / run / walk) + NPC assets
// standing in the space. Grab, cooking, and netcode come in later scenes.

import * as THREE from 'three'
import { createUnityLoader, fitOnFloor, hideTriggers, boundsOf } from '../common/unityScene.js'
import { createFirstPersonPlayer } from '../systems/player.js'
import { createCrowd } from '../systems/npc.js'
import { createFoodWorld, inferFoodType } from '../systems/food.js'
import { createHands } from '../systems/hands.js'
import { createRatDen } from '../systems/rats.js'
import { createDemoPlayers } from '../entities/demoPlayers.js'
import { createSoundboard } from '../systems/soundboard.js'

const FEATURED = [
  { slug: 'heroes/Player', caption: 'Player' },
  { slug: 'mobs/Npc',      caption: 'NPC' },
  { slug: 'heroes/Arm',    caption: 'Arm' },
  { slug: 'mobs/Rat',      caption: 'Rat' },
  { slug: 'items/Truck',   caption: 'Truck' },
]

const GROUP_ORDER = ['heroes', 'mobs', 'items', 'ui']

// Prefabs authored facing -Z (away from spawn). Turn them to face the aisle.
const FACE_AISLE = new Set([
  'items/Cupboard',
  'items/NumberStand',
])

const SPACING_X = 4.6
const SPACING_Z = 7.8
const PEDESTAL_H = 0.88
const PEDESTAL_W = 1.25

const $ = id => document.getElementById(id)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x2a261f)
scene.fog = new THREE.Fog(0x2a261f, 60, 150)

const loader = createUnityLoader({ base: './assets' })
const player = createFirstPersonPlayer()
scene.add(player.object)

const exhibits = []
const foodProtos = {}
let crowd = null
let foodWorld = null
let hands = null
let rats = null
let demoPlayers = null
let soundboard = null
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2(0, 0)

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function makePlaque(title, sub) {
  const map = canvasTexture(768, 220, (g, w, h) => {
    g.fillStyle = '#14110e'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#6b5a45'
    g.lineWidth = 6
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f0e6d4'
    g.font = '600 52px ui-sans-serif, system-ui, sans-serif'
    g.fillText(title, 36, 92)
    g.fillStyle = '#b5a48a'
    g.font = '28px ui-sans-serif, system-ui, sans-serif'
    g.fillText(sub, 36, 156)
  })
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.41),
    new THREE.MeshBasicMaterial({ map, transparent: true })
  )
}

function makeBanner(text) {
  const map = canvasTexture(1024, 192, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.font = '700 92px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(text.toUpperCase(), w / 2, 120)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 1.2),
    new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide })
  )
  return m
}

function makeTitleWall() {
  const map = canvasTexture(2048, 768, (g, w, h) => {
    g.fillStyle = '#cfc6b8'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#5a4634'
    g.font = '600 72px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('SCENE 01', w / 2, 220)
    g.fillStyle = '#1c1610'
    g.font = '700 120px ui-sans-serif, system-ui, sans-serif'
    g.fillText('PLAYER & NPCS', w / 2, 380)
    g.fillStyle = '#6b5a45'
    g.font = '36px ui-sans-serif, system-ui, sans-serif'
    g.fillText('Walk the hall. Every converted prefab is on a pedestal.', w / 2, 500)
    g.fillText('WASD  ·  Shift run  ·  Ctrl walk  ·  mouse look', w / 2, 570)
  })
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5.25),
    new THREE.MeshBasicMaterial({ map })
  )
  return m
}

function makePedestal() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.72, metalness: 0.04 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.55, metalness: 0.06 })
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(PEDESTAL_W, PEDESTAL_H, PEDESTAL_W), mat)
  base.position.y = PEDESTAL_H / 2
  base.castShadow = base.receiveShadow = true
  const cap = new THREE.Mesh(new THREE.BoxGeometry(PEDESTAL_W + 0.12, 0.06, PEDESTAL_W + 0.12), capMat)
  cap.position.y = PEDESTAL_H + 0.03
  cap.receiveShadow = true
  g.add(base, cap)
  return g
}

function tiledFloor(w, d) {
  const map = new THREE.TextureLoader().load('./assets/entities/tiles/MuseumFloor.png')
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(w / 3.2, d / 3.2)
  map.anisotropy = 4
  return map
}

function buildRoom(minx, maxx, minz, maxz, height) {
  const w = maxx - minx, d = maxz - minz
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tiledFloor(w, d), roughness: 0.88 })
  const wallMat  = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.88 })
  const ceilMat  = new THREE.MeshBasicMaterial({ color: 0x3a3530, side: THREE.DoubleSide })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, 0, cz)
  floor.receiveShadow = true
  scene.add(floor)

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(cx, height, cz)
  scene.add(ceil)

  const thick = 0.4
  const walls = [
    { x: cx, z: minz - thick / 2, w,  h: height, d: thick },
    { x: cx, z: maxz + thick / 2, w,  h: height, d: thick },
    { x: minx - thick / 2, z: cz, w: thick, h: height, d },
    { x: maxx + thick / 2, z: cz, w: thick, h: height, d },
  ]
  for (const s of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), wallMat)
    m.position.set(s.x, s.h / 2, s.z)
    m.receiveShadow = true
    scene.add(m)
  }

  const title = makeTitleWall()
  title.position.set(cx, 3.4, maxz - 0.22)
  title.rotation.y = Math.PI
  scene.add(title)

  player.setRoomBounds(minx, maxx, minz, maxz, 0)
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a3228, 1.05))
  const key = new THREE.DirectionalLight(0xfff4e6, 1.9)
  key.position.set(10, 24, 18)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 90 })
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xb9d4ff, 0.45)
  fill.position.set(-12, 10, -8)
  scene.add(fill)
  for (let z = 8; z >= -48; z -= 16) {
    const p = new THREE.PointLight(0xffe6c4, 18, 22, 2)
    p.position.set(0, 6.5, z)
    scene.add(p)
  }
}

function isExhibit(item) {
  if (item.kind !== 'prefab') return false
  if (!item.meshes && !item.ui) return false
  // Script hosts / trigger volumes / nav gizmos — behavior lives in JS, not these JSON poses.
  if (/Particles|Pathfinding|triggers|GameManagement\/Spawn/.test(item.slug)) return false
  if (/\/(ServerBox|PhysCube|3rd_Person_Controller|First_Person_Controller|GTextEras|Text3D|PlayerMenu|Bubbles)$/.test(item.slug)) return false
  if (/\/NPC\/Node$/.test(item.slug)) return false
  if (/Scripts\/Computer\/Graphics\//.test(item.slug)) return false
  if (item.slug === 'Resources/Skins/Cheese') return false
  return true
}

function layoutRows(items, featuredSlugs) {
  const used = new Set(featuredSlugs)
  const rows = [{ name: 'People', items: items.filter(i => featuredSlugs.includes(i.slug)) }]
  rows[0].items.sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug))

  const rest = items.filter(i => !used.has(i.slug))
  const byGroup = new Map()
  for (const i of rest) {
    if (!byGroup.has(i.group)) byGroup.set(i.group, [])
    byGroup.get(i.group).push(i)
  }
  for (const g of GROUP_ORDER) {
    if (byGroup.has(g)) {
      rows.push({ name: g, items: byGroup.get(g) })
      byGroup.delete(g)
    }
  }
  for (const [g, list] of byGroup) rows.push({ name: g, items: list })
  return rows.filter(r => r.items.length)
}

function placeOnPedestal(asset, x, z, meta) {
  hideTriggers(asset)
  const { size, scale, native } = fitOnFloor(asset, { maxSize: 2.35, minSize: 0.4 })
  if (FACE_AISLE.has(meta.slug)) asset.rotation.y += Math.PI
  asset.position.y += PEDESTAL_H + 0.06

  const caption = FEATURED.find(f => f.slug === meta.slug)?.caption || meta.label
  const nativeStr = native
    ? `native ${native.x.toFixed(2)} × ${native.y.toFixed(2)} × ${native.z.toFixed(2)}`
    : meta.group
  const plaque = makePlaque(caption, `${meta.group}  ·  ${nativeStr}`)
  plaque.position.set(0, 0.55, PEDESTAL_W * 0.52 + 0.02)

  const wrap = new THREE.Group()
  wrap.position.set(x, 0, z)
  wrap.add(makePedestal())
  wrap.add(asset)
  wrap.add(plaque)
  scene.add(wrap)

  const hw = Math.max(PEDESTAL_W / 2, size.x * 0.4)
  const hd = Math.max(PEDESTAL_W / 2, size.z * 0.4)
  player.addCollider({ x: x - hw, z: z - hd }, { x: x + hw, z: z + hd })

  const rec = { ...meta, object: wrap, x, z, size, scale, caption }
  const foodType = inferFoodType(meta.slug, meta.label)
  if (foodType !== 'other') rec.foodType = foodType
  exhibits.push(rec)
  wrap.traverse(o => { o.userData.exhibit = rec })
  return rec
}

function setStatus(msg) { $('load-msg').textContent = msg }

async function boot() {
  addLights()
  setStatus('Reading manifest…')
  const manifest = await fetch('./assets/manifest.json').then(r => r.json())
  const featuredSlugs = FEATURED.map(f => f.slug)
  const items = manifest.filter(isExhibit)
  // make sure featured slugs are present even if the filter missed them
  for (const s of featuredSlugs) {
    if (!items.some(i => i.slug === s)) {
      const m = manifest.find(i => i.slug === s)
      if (m) items.unshift(m)
    }
  }
  const rows = layoutRows(items, featuredSlugs)

  const nCols = Math.max(...rows.map(r => r.items.length), 1)
  const hallW = Math.max((nCols - 1) * SPACING_X + 10, 24)
  let z = 0
  const positions = []
  let audioZ = -SPACING_Z

  for (const row of rows) {
    const n = row.items.length
    const rowW = (n - 1) * SPACING_X
    const x0 = -rowW / 2
    positions.push({ row, z, x0 })
    z -= SPACING_Z
    if (row.name === 'People') {
      audioZ = z
      z -= SPACING_Z
    }
  }

  const minz = z - 6
  const maxz = 16
  const minx = -hallW / 2
  const maxx = hallW / 2
  buildRoom(minx, maxx, minz, maxz, 9.5)

  try {
    setStatus('Loading soundboard…')
    soundboard = await createSoundboard({
      scene, player,
      x: 0,
      z: audioZ,
      facingY: 0,
    })
    const banner = makeBanner('Audio')
    banner.position.set(0, 4.4, audioZ + 1.6)
    scene.add(banner)
    exhibits.push({
      slug: 'audio/Soundboard',
      label: 'Soundboard',
      caption: 'Soundboard',
      group: 'audio',
      x: 0,
      z: audioZ,
      size: { x: soundboard.width, y: soundboard.height, z: soundboard.depth },
    })
  } catch (err) {
    console.warn('[museum] soundboard skipped', err)
  }

  let loaded = 0
  const total = rows.reduce((n, r) => n + r.items.length, 0)

  for (const { row, z: rz, x0 } of positions) {
    const banner = makeBanner(row.name)
    banner.position.set(0, 4.4, rz + 1.6)
    scene.add(banner)

    for (let i = 0; i < row.items.length; i++) {
      const item = row.items[i]
      setStatus(`Loading ${++loaded} / ${total}  —  ${item.label}`)
      try {
        const { root } = await loader.load(item.slug)
        const box = boundsOf(root)
        if (box.isEmpty()) continue
        if (inferFoodType(item.slug, item.label) !== 'other') foodProtos[item.slug] = root.clone(true)
        placeOnPedestal(root, x0 + i * SPACING_X, rz, item)
      } catch (err) {
        console.warn('[museum] skip', item.slug, err)
      }
    }
  }

  try {
    const npc = await loader.load('mobs/Npc')
    hideTriggers(npc.root)
    crowd = createCrowd({ scene, player, proto: npc.root, exhibits, count: 12 })
  } catch (err) {
    console.warn('[museum] NPC crowd skipped', err)
  }

  foodWorld = createFoodWorld({ scene, player })
  let cheeseProto = foodProtos['items/Cheese']
  if (!cheeseProto) {
    try {
      const c = await loader.load('items/Cheese')
      cheeseProto = c.root
      foodProtos['items/Cheese'] = cheeseProto
    } catch (err) {
      console.warn('[museum] cheese proto missing', err)
    }
  }
  if (cheeseProto) {
    const b = player.bounds
    const zs = []
    for (let z = 6; z > b.minz + 8; z -= 16) zs.push(z)
    zs.slice(0, 6).forEach((z, i) => {
      const x = (i % 2 === 0 ? -1 : 1) * (2.1 + (i % 3) * 0.4)
      foodWorld.addSpawner(x, z, cheeseProto)
    })
  }

  let armRoot = null
  try {
    const arm = await loader.load('heroes/Arm')
    armRoot = arm.root
    hands = createHands({ scene, player, armProto: armRoot, foodWorld, exhibits, foodProtos })
  } catch (err) {
    console.warn('[museum] arms skipped', err)
  }

  try {
    const pl = await loader.load('heroes/Player')
    hideTriggers(pl.root)
    if (armRoot) {
      demoPlayers = createDemoPlayers({
        scene, player, playerProto: pl.root, armProto: armRoot,
      })
    }
  } catch (err) {
    console.warn('[museum] demo players skipped', err)
  }

  try {
    const rat = await loader.load('mobs/Rat')
    hideTriggers(rat.root)
    rats = createRatDen({ scene, player, ratProto: rat.root, foodWorld })
  } catch (err) {
    console.warn('[museum] rats skipped', err)
  }

  player.spawn(0, 0, 11, 0)
  $('s-exhibits').textContent = String(exhibits.length)
  $('s-visitors').textContent = String(crowd ? crowd.npcs.length : 0)
  setStatus('')
  $('loader').dataset.ready = '1'
  $('loader').querySelector('h1').textContent = 'Asset museum'
  $('loader').querySelector('.sub').textContent =
    `${exhibits.length} exhibits  ·  click to walk`
  $('hint').textContent = 'click to capture mouse'

  window.__museum = {
    scene, camera: player.camera, renderer, player, exhibits, crowd,
    foodWorld, hands, rats, demoPlayers, soundboard,
    teleport(slug) {
      if (soundboard && /^(Soundboard|Audio|audio\/Soundboard)$/i.test(slug)) {
        const v = soundboard.viewSpot()
        player.spawn(v.stand.x, 0, v.stand.z, 0)
        player.lookAt(v.look.x, v.look.y, v.look.z)
        return 'Soundboard'
      }
      const e = exhibits.find(x => x.slug === slug || x.label === slug || x.caption === slug)
      if (!e) return null
      const back = Math.max(2.8, (e.size?.y || 2) * 0.85 + 1.8)
      player.spawn(e.x, 0, e.z + back, 0)
      player.lookAt(e.x, PEDESTAL_H + Math.min((e.size?.y || 2) * 0.45, 1.5), e.z)
      return e.caption || e.label
    },
    enter, pause,
  }
  console.log('[museum] ready', exhibits.length, 'exhibits')
}

const clock = new THREE.Clock()
let frames = 0, lastFps = performance.now()
let playing = false
let lookName = ''

function currentLook() {
  const audioLook = soundboard?.lookLabel()
  if (audioLook) return audioLook
  raycaster.setFromCamera(ndc, player.camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    const npc = h.object.userData.npc
    if (npc) return npc.notice ? `${npc.skin} · looking at you` : `${npc.skin} · ${npc.want}`
    if (h.object.userData.demoPlayer) {
      const d = h.object.userData.demoPlayer
      return d.spec.name + ' · ' + d.spec.skin
    }
    if (h.object.userData.rat) return 'rat'
    const food = h.object.userData.food
    if (food) return food.type + (food.held ? ' (held)' : food.onFloor ? ' (floor)' : '')
    const rec = h.object.userData.exhibit
    if (rec) return rec.foodType ? (rec.caption || rec.label) + ' · take a copy' : (rec.caption || rec.label)
  }
  return ''
}

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta()
  player.update(dt)
  if (soundboard) {
    soundboard.update(dt)
    if (player.fire1Down || player.fire2Down) soundboard.tryPress()
  }
  if (hands) hands.update(dt)
  if (foodWorld) foodWorld.update(dt, clock.elapsedTime)
  if (rats) rats.update(dt, clock.elapsedTime)
  if (crowd) crowd.update(dt, clock.elapsedTime)
  if (demoPlayers) demoPlayers.update(dt)

  const look = currentLook()
  if (look !== lookName) {
    lookName = look
    $('look').textContent = look
    $('look').style.opacity = look ? '1' : '0'
  }

  const p = player.position
  $('s-pos').textContent = `${p.x.toFixed(1)}  ${p.y.toFixed(1)}  ${p.z.toFixed(1)}`
  const k = player.keys
  $('s-speed').textContent = (k.has('ShiftLeft') || k.has('ShiftRight'))
    ? 'run' : ((k.has('ControlLeft') || k.has('ControlRight')) ? 'walk' : 'move')
  if ($('s-hold')) $('s-hold').textContent = hands?.holdingLabel() || '—'
  if ($('s-rats')) $('s-rats').textContent = String(rats ? rats.count : 0)

  renderer.render(scene, player.camera)
  if (++frames >= 20) {
    const now = performance.now()
    $('s-fps').textContent = String(Math.round(frames * 1000 / (now - lastFps)))
    lastFps = now
    frames = 0
  }
})

function enter() {
  if ($('loader').dataset.ready !== '1') return
  playing = true
  player.enabled = true
  $('loader').style.display = 'none'
  $('hud').style.display = 'block'
  $('cross').style.display = 'block'
  $('look').style.display = 'block'
  player.requestLock(renderer.domElement)
  soundboard?.resume()
}

function pause() {
  playing = false
  player.enabled = false
  player.unlock()
  soundboard?.pause()
  $('loader').style.display = 'flex'
  $('loader').querySelector('h1').textContent = 'Paused'
  $('loader').querySelector('.sub').textContent = 'click to continue'
}

$('loader').addEventListener('click', enter)
renderer.domElement.addEventListener('click', () => {
  if (playing && !player.locked) player.requestLock(renderer.domElement)
})
document.addEventListener('pointerlockchange', () => {
  // Only pause when the user actually had pointer lock and released it
  // (Esc). A failed requestPointerLock — iframes, missing user gesture —
  // must not bounce us back to the overlay; WASD still works unlocked.
  if (playing && !player.locked && document.hidden === false) {
    if (player._hadLock) pause()
  }
  player._hadLock = player.locked
})
addEventListener('keydown', e => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault()
  }
  if (e.code === 'Escape' && playing) pause()
})
addEventListener('resize', () => {
  player.camera.aspect = innerWidth / innerHeight
  player.camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

player.camera.aspect = innerWidth / innerHeight
player.camera.updateProjectionMatrix()
player.enabled = false

boot().catch(err => {
  console.error(err)
  setStatus('Failed: ' + err.message)
})
