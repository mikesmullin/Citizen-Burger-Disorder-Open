// Free-standing audio booth among the museum pedestals: a walk-in
// trade-show exhibit with a button wall at the back. Music toggles
// (loop, one at a time); SFX are one-shots that stack and restart
// on re-press.

import * as THREE from 'three'

const BOARD_W = 3.85
const BOARD_H = 2.42
const BOARD_T = 0.10
const BOARD_Y = 0.48
const MUSIC_W = 1.12
const PRESS_RANGE = 6.8
const SFX_PRESS = 0.11
const COLS = 5

const BOOTH_W = 5.0
const BOOTH_D = 3.5
const BOOTH_H = 3.2
const WALL_T = 0.09
const POST = 0.14

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

function wrapLines(g, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (cur && g.measureText(t).width > maxWidth) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

function labelMap(text, { accent = '#c4a574' } = {}) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 44
    g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`
    let lines = wrapLines(g, text, w - 48)
    while (size > 26 && (lines.length > 2 || g.measureText(lines[0] || '').width > w - 48)) {
      size -= 2
      g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`
      lines = wrapLines(g, text, w - 48)
    }
    const lh = size + 8
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2
    lines.forEach((ln, i) => {
      g.fillStyle = i === 0 ? '#f0e6d4' : '#d4c4ae'
      g.fillText(ln, w / 2, y0 + i * lh)
    })
    g.fillStyle = accent
    g.fillRect(w * 0.22, 18, w * 0.56, 5)
  })
}

function headerMap(title, sub) {
  return canvasTexture(1024, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#f0e6d4'
    g.font = '700 72px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'left'
    g.fillText(title, 36, 88)
    g.fillStyle = '#b5a48a'
    g.font = '32px ui-sans-serif, system-ui, sans-serif'
    g.fillText(sub, 36, 150)
  })
}

function sectionMap(title, sub) {
  return canvasTexture(1024, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#c4a574'
    g.font = '700 64px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'left'
    g.fillText(title, 16, 78)
    g.fillStyle = '#9a8f80'
    g.font = '36px ui-sans-serif, system-ui, sans-serif'
    g.fillText(sub, 16, 148)
  })
}

function fasciaMap() {
  return canvasTexture(2048, 384, (g, w, h) => {
    g.fillStyle = '#1c1814'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#6b5a45'
    g.fillRect(0, 0, w, 14)
    g.fillRect(0, h - 14, w, 14)
    g.fillStyle = '#f0e6d4'
    g.font = '700 140px ui-sans-serif, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('AUDIO', w / 2, 175)
    g.fillStyle = '#c4a574'
    g.font = '36px ui-sans-serif, system-ui, sans-serif'
    g.fillText('ORIGINAL GAME SOUNDS  ·  INTERACTIVE EXHIBIT', w / 2, 270)
  })
}

function makePlane(w, h, map) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
  )
  m.raycast = () => {}
  return m
}

function retrigger(audio) {
  if (!audio || !audio.buffer) return false
  if (audio.isPlaying) audio.stop()
  audio.offset = 0
  audio.play()
  return true
}

function buildBooth(object) {
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xb7aa98, roughness: 0.84, metalness: 0.04,
  })
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x2a241e, roughness: 0.78, metalness: 0.03,
  })
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x9a9690, roughness: 0.35, metalness: 0.72,
  })
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x4a2418, roughness: 0.92, metalness: 0.0,
  })
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc4a574, roughness: 0.45, metalness: 0.28,
  })
  const fasciaTex = fasciaMap()

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(BOOTH_W - 0.04, 0.04, BOOTH_D - 0.04),
    carpetMat,
  )
  floor.position.set(0, 0.02, 0)
  floor.receiveShadow = true
  floor.raycast = () => {}
  object.add(floor)

  const tapeW = 0.06
  const tapes = [
    { w: BOOTH_W, d: tapeW, x: 0, z: BOOTH_D / 2 - tapeW / 2 - 0.02 },
    { w: BOOTH_W, d: tapeW, x: 0, z: -BOOTH_D / 2 + tapeW / 2 + 0.02 },
    { w: tapeW, d: BOOTH_D, x: -BOOTH_W / 2 + tapeW / 2 + 0.02, z: 0 },
    { w: tapeW, d: BOOTH_D, x: BOOTH_W / 2 - tapeW / 2 - 0.02, z: 0 },
  ]
  for (const t of tapes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(t.w, 0.015, t.d), goldMat)
    m.position.set(t.x, 0.048, t.z)
    m.raycast = () => {}
    object.add(m)
  }

  const backZ = -BOOTH_D / 2 + WALL_T / 2
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(BOOTH_W, BOOTH_H, WALL_T),
    innerMat,
  )
  back.position.set(0, BOOTH_H / 2, backZ)
  back.receiveShadow = true
  back.userData.soundboard = true
  object.add(back)

  const sideH = BOOTH_H
  const sideD = BOOTH_D
  for (const sign of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, sideH, sideD),
      wallMat,
    )
    wall.position.set(sign * (BOOTH_W / 2 - WALL_T / 2), sideH / 2, 0)
    wall.receiveShadow = true
    wall.castShadow = true
    wall.userData.soundboard = true
    object.add(wall)
  }

  const frontZ = BOOTH_D / 2 - POST / 2
  for (const sign of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(POST, BOOTH_H, POST),
      metalMat,
    )
    post.position.set(sign * (BOOTH_W / 2 - POST / 2), BOOTH_H / 2, frontZ)
    post.castShadow = true
    post.raycast = () => {}
    object.add(post)
  }

  const fasciaH = 0.52
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(BOOTH_W, fasciaH, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.6 }),
  )
  fascia.position.set(0, BOOTH_H - fasciaH / 2, BOOTH_D / 2 - 0.04)
  fascia.castShadow = true
  fascia.raycast = () => {}
  object.add(fascia)
  const fasciaFace = new THREE.Mesh(
    new THREE.PlaneGeometry(BOOTH_W - 0.08, fasciaH - 0.08),
    new THREE.MeshBasicMaterial({ map: fasciaTex }),
  )
  fasciaFace.position.set(0, BOOTH_H - fasciaH / 2, BOOTH_D / 2 + 0.025)
  fasciaFace.raycast = () => {}
  object.add(fasciaFace)
  const fasciaInner = fasciaFace.clone()
  fasciaInner.rotation.y = Math.PI
  fasciaInner.position.z = BOOTH_D / 2 - 0.11
  fasciaInner.raycast = () => {}
  object.add(fasciaInner)

  // Simple ceiling truss on top of the walls.
  const bar = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metalMat)
    m.position.set(x, y, z)
    m.raycast = () => {}
    object.add(m)
  }
  const ty = BOOTH_H + 0.04
  bar(BOOTH_W, 0.06, 0.06, 0, ty, -BOOTH_D / 2 + 0.08)
  bar(BOOTH_W, 0.06, 0.06, 0, ty, BOOTH_D / 2 - 0.08)
  bar(0.06, 0.06, BOOTH_D, -BOOTH_W / 2 + 0.08, ty, 0)
  bar(0.06, 0.06, BOOTH_D, BOOTH_W / 2 - 0.08, ty, 0)

  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(BOOTH_W - 0.12, 0.05, BOOTH_D - 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.88 }),
  )
  ceil.position.set(0, BOOTH_H - 0.03, 0)
  ceil.raycast = () => {}
  object.add(ceil)

  const spot = new THREE.SpotLight(0xffe6c4, 22, 14, Math.PI / 4.2, 0.55, 1.4)
  spot.position.set(0, BOOTH_H - 0.08, 0.55)
  spot.target.position.set(0, 1.5, -BOOTH_D / 2 + 0.4)
  object.add(spot)
  object.add(spot.target)

  const fill = new THREE.PointLight(0xffe0b8, 6, 9, 2)
  fill.position.set(0, BOOTH_H - 0.3, 0.2)
  object.add(fill)
}

export async function createSoundboard({
  scene,
  player,
  x = 0,
  y = 0,
  z = 0,
  facingY = 0,
  catalogUrl = './assets/audio/catalog.json',
} = {}) {
  const catalog = await fetch(catalogUrl).then(r => {
    if (!r.ok) throw new Error('audio catalog ' + r.status)
    return r.json()
  })
  const musicClips = catalog.music || []
  const sfxClips = catalog.sfx || []

  const listener = new THREE.AudioListener()
  player.camera.add(listener)
  const loader = new THREE.AudioLoader()

  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1c1814, roughness: 0.62, metalness: 0.08,
  })
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x6b5a45, roughness: 0.45, metalness: 0.22,
  })
  const grillMat = new THREE.MeshStandardMaterial({
    color: 0x0d0b09, roughness: 0.9, metalness: 0.04,
  })
  const musicMatIdle = { color: 0x3a322c, emissive: 0x1a140c }
  const musicMatOn = { color: 0x8a5a18, emissive: 0x5a3208 }
  const sfxMatIdle = { color: 0x2e2824, emissive: 0x000000 }
  const sfxMatHover = { color: 0x4a4034, emissive: 0x22180c }
  const sfxMatPress = { color: 0x6b4420, emissive: 0x3a2008 }

  const object = new THREE.Group()
  object.name = 'AudioBooth'
  object.position.set(x, y, z)
  object.rotation.y = facingY
  buildBooth(object)

  const board = new THREE.Group()
  board.name = 'ButtonWall'
  board.position.set(0, BOARD_Y, -BOOTH_D / 2 + WALL_T + BOARD_T / 2 + 0.03)
  object.add(board)

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_W, BOARD_H, BOARD_T),
    panelMat,
  )
  panel.position.set(0, BOARD_H / 2, 0)
  panel.castShadow = panel.receiveShadow = true
  panel.userData.soundboard = true
  board.add(panel)

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_W + 0.08, BOARD_H + 0.08, BOARD_T * 0.55),
    trimMat,
  )
  frame.position.set(0, BOARD_H / 2, -0.02)
  board.add(frame)

  const header = makePlane(BOARD_W - 0.18, 0.38, headerMap('AUDIO', 'original game sounds'))
  header.position.set(0, BOARD_H - 0.28, BOARD_T / 2 + 0.012)
  board.add(header)

  const splitX = -BOARD_W / 2 + MUSIC_W
  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.025, BOARD_H - 0.58, 0.04), trimMat)
  divider.position.set(splitX, BOARD_H / 2 - 0.08, BOARD_T / 2)
  board.add(divider)

  const musicHead = makePlane(MUSIC_W - 0.12, 0.34, sectionMap('MUSIC', 'toggle · loop · exclusive'))
  musicHead.position.set((-BOARD_W / 2 + splitX) / 2, BOARD_H - 0.64, BOARD_T / 2 + 0.012)
  board.add(musicHead)

  const sfxHead = makePlane(BOARD_W - MUSIC_W - 0.16, 0.34, sectionMap('SOUND EFFECTS', 'one-shot · stacks · re-press restarts'))
  sfxHead.position.set((splitX + BOARD_W / 2) / 2, BOARD_H - 0.64, BOARD_T / 2 + 0.012)
  board.add(sfxHead)

  for (let i = 0; i < 7; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(MUSIC_W - 0.28, 0.045, 0.03), grillMat)
    slot.position.set((-BOARD_W / 2 + splitX) / 2, 0.38 + i * 0.09, BOARD_T / 2 + 0.01)
    slot.raycast = () => {}
    board.add(slot)
  }

  const lamp = new THREE.PointLight(0xffe0b8, 4, 6, 2)
  lamp.position.set(0, BOARD_H - 0.05, 0.45)
  board.add(lamp)

  const buttons = []
  const ndc = new THREE.Vector2(0, 0)
  const raycaster = new THREE.Raycaster()
  const _face = new THREE.Vector3()
  const _q = new THREE.Quaternion()
  let hovered = null
  let musicId = null

  function paintButton(btn) {
    const idle = btn.kind === 'music' ? musicMatIdle : sfxMatIdle
    let look = idle
    if (btn.kind === 'music' && musicId === btn.id) look = musicMatOn
    else if (btn.kind === 'sfx' && btn.pressT > 0) look = sfxMatPress
    else if (hovered === btn) look = btn.kind === 'music' ? musicMatOn : sfxMatHover
    btn.body.material.color.setHex(look.color)
    btn.body.material.emissive.setHex(look.emissive)
    const restZ = BOARD_T / 2 + 0.046
    const inZ = BOARD_T / 2 + 0.016
    const latched = btn.kind === 'music' && musicId === btn.id
    const k = latched ? 1 : (btn.kind === 'sfx' ? Math.min(1, btn.pressT / SFX_PRESS) : 0)
    btn.object.position.z = restZ - (restZ - inZ) * k
    if (btn.led) {
      btn.led.material.color.setHex(latched ? 0x7dff6a : 0x2a2a24)
      btn.led.material.emissive.setHex(latched ? 0x1a8a18 : 0x000000)
    }
  }

  function makeButton(clip, kind, bw, bh) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, 0.055),
      new THREE.MeshStandardMaterial({
        color: kind === 'music' ? musicMatIdle.color : sfxMatIdle.color,
        roughness: 0.48,
        metalness: 0.12,
        emissive: 0x000000,
      }),
    )
    body.castShadow = true
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(bw * 0.92, bh * 0.78),
      new THREE.MeshBasicMaterial({
        map: labelMap(clip.label, { accent: kind === 'music' ? '#c4a574' : '#6b5a45' }),
        transparent: true,
        depthWrite: false,
      }),
    )
    face.position.z = 0.029
    g.add(body, face)
    let led = null
    if (kind === 'music') {
      led = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x2a2a24, roughness: 0.4, emissive: 0x000000 }),
      )
      led.position.set(bw * 0.5 - 0.08, bh * 0.5 - 0.07, 0.04)
      g.add(led)
    }
    const audio = new THREE.PositionalAudio(listener)
    audio.setRefDistance(8)
    audio.setMaxDistance(48)
    audio.setRolloffFactor(1)
    audio.setDistanceModel('linear')
    audio.setVolume(kind === 'music' ? 0.5 : 0.9)
    audio.setLoop(kind === 'music')
    g.add(audio)

    const rec = {
      id: clip.id,
      label: clip.label,
      kind,
      src: clip.src,
      object: g,
      body,
      audio,
      led,
      ready: false,
      pressT: 0,
    }
    g.userData.soundButton = rec
    body.userData.soundButton = rec
    face.userData.soundButton = rec
    if (led) led.userData.soundButton = rec
    buttons.push(rec)
    board.add(g)
    return rec
  }

  const musicBtnH = 0.38
  const musicBtnW = MUSIC_W - 0.22
  musicClips.forEach((clip, i) => {
    const b = makeButton(clip, 'music', musicBtnW, musicBtnH)
    b.object.position.set(
      (-BOARD_W / 2 + splitX) / 2,
      BOARD_H - 1.10 - i * (musicBtnH + 0.08),
      BOARD_T / 2 + 0.046,
    )
  })

  const sfxAreaLeft = splitX + 0.10
  const sfxAreaRight = BOARD_W / 2 - 0.10
  const sfxAreaW = sfxAreaRight - sfxAreaLeft
  const rows = Math.max(1, Math.ceil(sfxClips.length / COLS))
  const gapX = 0.055
  const gapY = 0.05
  const sfxW = (sfxAreaW - gapX * (COLS - 1)) / COLS
  const sfxAreaTop = BOARD_H - 0.88
  const sfxAreaBot = 0.16
  const sfxH = Math.min(0.30, (sfxAreaTop - sfxAreaBot - gapY * (rows - 1)) / rows)

  sfxClips.forEach((clip, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const b = makeButton(clip, 'sfx', sfxW, sfxH)
    const bx = sfxAreaLeft + sfxW / 2 + col * (sfxW + gapX)
    const by = sfxAreaTop - sfxH / 2 - row * (sfxH + gapY)
    b.object.position.set(bx, by, BOARD_T / 2 + 0.046)
  })

  scene.add(object)

  const hw = BOOTH_W / 2
  const hd = BOOTH_D / 2
  const ct = 0.14
  player.addCollider({ x: x - hw, z: z - hd - ct / 2 }, { x: x + hw, z: z - hd + ct / 2 })
  player.addCollider({ x: x - hw - ct / 2, z: z - hd }, { x: x - hw + ct / 2, z: z + hd })
  player.addCollider({ x: x + hw - ct / 2, z: z - hd }, { x: x + hw + ct / 2, z: z + hd })

  function stopMusic() {
    for (const b of buttons) {
      if (b.kind === 'music' && b.audio?.isPlaying) b.audio.stop()
    }
    musicId = null
  }

  function activate(btn) {
    if (!btn || !btn.ready) return false
    unlock()
    if (btn.kind === 'music') {
      if (musicId === btn.id) {
        stopMusic()
      } else {
        stopMusic()
        musicId = btn.id
        retrigger(btn.audio)
      }
      for (const b of buttons) if (b.kind === 'music') paintButton(b)
      return true
    }
    btn.pressT = SFX_PRESS
    retrigger(btn.audio)
    paintButton(btn)
    return true
  }

  function pick() {
    player.object.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, player.camera)
    const hits = raycaster.intersectObject(object, true)
    for (const h of hits) {
      if (h.distance > PRESS_RANGE) continue
      const rec = h.object.userData.soundButton
      if (rec) return rec
      if (h.object.userData.soundboard) return { kind: 'panel', label: 'Soundboard' }
    }
    return null
  }

  function lookLabel() {
    if (!hovered) return ''
    if (hovered.kind === 'panel') return 'Audio booth · original sounds'
    if (!hovered.ready) return hovered.label + ' · loading'
    if (hovered.kind === 'music') {
      return musicId === hovered.id
        ? `music · ${hovered.label} · looping  · click to stop`
        : `music · ${hovered.label} · click to loop`
    }
    return `sfx · ${hovered.label} · click to play`
  }

  function update(dt) {
    dt = Math.min(dt, 0.1)
    hovered = pick()
    for (const b of buttons) {
      if (b.pressT > 0) b.pressT = Math.max(0, b.pressT - dt)
      paintButton(b)
    }
  }

  function tryPress() {
    const target = pick()
    if (!target || target.kind === 'panel') return false
    return activate(target)
  }

  function press(id) {
    const b = buttons.find(x => x.id === id)
    return b ? activate(b) : false
  }

  function unlock() {
    const ctx = listener.context
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  function pause() {
    const ctx = listener.context
    if (ctx && ctx.state === 'running') ctx.suspend()
  }

  function resume() {
    unlock()
  }

  function viewSpot() {
    object.updateMatrixWorld(true)
    object.getWorldQuaternion(_q)
    _face.set(0, 0, 1).applyQuaternion(_q)
    const origin = new THREE.Vector3(x, 0, z)
    const stand = origin.clone().addScaledVector(_face, BOOTH_D / 2 - 0.85)
    const look = origin.clone()
      .addScaledVector(_face, -BOOTH_D / 2 + 0.25)
    look.y = BOARD_Y + BOARD_H * 0.55
    return { stand, look }
  }

  const loads = buttons.map(async b => {
    try {
      const buf = await loader.loadAsync('./assets/' + b.src)
      b.audio.setBuffer(buf)
      b.ready = true
    } catch (err) {
      console.warn('[soundboard] skip', b.id, err)
    }
  })
  await Promise.all(loads)
  for (const b of buttons) paintButton(b)

  return {
    object, buttons, update, tryPress, press, lookLabel,
    unlock, pause, resume, viewSpot,
    get musicId() { return musicId },
    get hovered() { return hovered },
    playingSfx() {
      return buttons.filter(b => b.kind === 'sfx' && b.audio?.isPlaying).map(b => b.id)
    },
    musicPlaying() {
      const b = buttons.find(x => x.kind === 'music' && x.id === musicId)
      return !!(b && b.audio?.isPlaying)
    },
    width: BOOTH_W,
    depth: BOOTH_D,
    height: BOOTH_H,
  }
}
