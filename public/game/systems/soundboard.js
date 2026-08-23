// Free-standing audio booth among the museum pedestals: a walk-in
// trade-show exhibit with a button wall at the back. Music toggles
// (loop, one at a time); SFX are one-shots that stack and restart
// on re-press.

import * as THREE from 'three'
import { createSwitchSet, SWITCH_Y } from './lightSwitch.js'
import { whenAudio, resumeAudio, safePlay } from '../common/audio.js'

const BOARD_W = 3.85
const BOARD_H = 2.42
const BOARD_T = 0.10
const BOARD_Y = 0.48
const MUSIC_W = 1.12
// Extra canvas on the right so the light switch sits on the panel
// with margin, without shifting the music / SFX layout.
const SWITCH_COL = 0.58
const PRESS_RANGE = 6.8
const SFX_PRESS = 0.11
const COLS = 5

const BOOTH_W = 5.6
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

function labelMap(text) {
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
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2 + 10
    lines.forEach((ln, i) => {
      g.fillStyle = i === 0 ? '#f0e6d4' : '#d4c4ae'
      g.fillText(ln, w / 2, y0 + i * lh)
    })
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
  audio.offset = 0
  safePlay(audio, { restart: true })
  return true
}

function buildBooth(object) {
  const fill = new THREE.PointLight(0xffe0b8, 8, 11, 2)
  fill.name = 'AudioFill'
  fill.position.set(0, 3.2, 0.2)
  object.add(fill)
  return fill
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

  let listener = null

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
  const overhead = buildBooth(object)

  const board = new THREE.Group()
  board.name = 'ButtonWall'
  board.position.set(0, BOARD_Y, -BOOTH_D / 2 + WALL_T + BOARD_T / 2 + 0.03)
  object.add(board)

  const panelW = BOARD_W + SWITCH_COL
  const panelX = SWITCH_COL / 2
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(panelW, BOARD_H, BOARD_T),
    panelMat,
  )
  panel.position.set(panelX, BOARD_H / 2, 0)
  panel.castShadow = panel.receiveShadow = true
  panel.userData.soundboard = true
  board.add(panel)

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(panelW + 0.08, BOARD_H + 0.08, BOARD_T * 0.55),
    trimMat,
  )
  frame.position.set(panelX, BOARD_H / 2, -0.02)
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

  let switches = null
  function mountLightSwitch(proto) {
    if (!proto || switches) return
    switches = createSwitchSet({ player, proto })
    switches.add({
      parent: board,
      light: overhead,
      x: BOARD_W / 2 + SWITCH_COL / 2,
      y: SWITCH_Y - BOARD_Y,
      z: BOARD_T / 2,
      inwardX: 0,
      inwardZ: 1,
      label: 'Audio lights',
      onToggle: on => {
        lamp.visible = on
        lamp.intensity = on ? 4 : 0
      },
    })
  }

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
    const lit = !!(btn.audio && btn.audio.isPlaying)
    if (btn.led) {
      btn.led.material.color.setHex(lit ? 0xffe0a0 : (btn.kind === 'music' ? 0xc4a574 : 0x6b5a45))
      btn.led.material.emissive.setHex(lit ? 0xffc060 : 0x000000)
      btn.led.material.emissiveIntensity = lit ? 1.8 : 0
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
    const faceW = bw * 0.92
    const faceH = bh * 0.78
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(faceW, faceH),
      new THREE.MeshBasicMaterial({
        map: labelMap(clip.label),
        transparent: true,
        depthWrite: false,
      }),
    )
    face.position.z = 0.029
    g.add(body, face)
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(faceW * 0.56, Math.max(0.01, faceH * 0.05), 0.008),
      new THREE.MeshStandardMaterial({
        color: 0x2a2418,
        roughness: 0.38,
        metalness: 0.12,
        emissive: 0x000000,
        emissiveIntensity: 0,
      }),
    )
    led.position.set(0, faceH * 0.42, 0.033)
    g.add(led)

    const rec = {
      id: clip.id,
      label: clip.label,
      kind,
      src: clip.src,
      object: g,
      body,
      audio: null,
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
    const sw = switches && switches.lookLabel()
    if (sw) return sw
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
    if (switches) switches.update(dt)
    hovered = pick()
    for (const b of buttons) {
      if (b.pressT > 0) b.pressT = Math.max(0, b.pressT - dt)
      paintButton(b)
    }
  }

  function tryPress() {
    if (switches && switches.tryPress()) return true
    const target = pick()
    if (!target || target.kind === 'panel') return false
    return activate(target)
  }

  function press(id) {
    const b = buttons.find(x => x.id === id)
    return b ? activate(b) : false
  }

  function unlock() {
    resumeAudio()
  }

  function pause() {
    const ctx = listener?.context
    if (ctx && ctx.state === 'running') ctx.suspend()
  }

  function resume() {
    unlock()
  }

  function viewSpot(name) {
    object.updateMatrixWorld(true)
    object.getWorldQuaternion(_q)
    _face.set(0, 0, 1).applyQuaternion(_q)
    const origin = new THREE.Vector3(x, 0, z)
    if (name && /light/i.test(String(name)) && switches?.items?.[0]) {
      const handle = switches.items[0]
      const src = handle.object || handle.wrap
      src.updateMatrixWorld(true)
      const look = new THREE.Vector3()
      src.getWorldPosition(look)
      look.y = SWITCH_Y
      look.addScaledVector(_face, 0.06)
      const stand = look.clone().addScaledVector(_face, 1.35)
      stand.y = 0
      return { stand, look }
    }
    const stand = origin.clone().addScaledVector(_face, BOOTH_D / 2 - 0.85)
    const look = origin.clone()
      .addScaledVector(_face, -BOOTH_D / 2 + 0.25)
    look.y = BOARD_Y + BOARD_H * 0.55
    return { stand, look }
  }

  const loads = buttons.map(async b => {
    try {
      const r = await fetch('./assets/' + b.src)
      if (!r.ok) throw new Error(r.status)
      b.raw = await r.arrayBuffer()
    } catch (err) {
      console.warn('[soundboard] skip', b.id, err)
    }
  })
  await Promise.all(loads)

  whenAudio(lis => {
    listener = lis
    for (const b of buttons) {
      const audio = new THREE.PositionalAudio(lis)
      audio.setRefDistance(8)
      audio.setMaxDistance(48)
      audio.setRolloffFactor(1)
      audio.setDistanceModel('linear')
      audio.setVolume(b.kind === 'music' ? 0.5 : 0.9)
      audio.setLoop(b.kind === 'music')
      b.object.add(audio)
      b.audio = audio
      if (!b.raw) continue
      lis.context.decodeAudioData(b.raw.slice(0)).then(buf => {
        audio.setBuffer(buf)
        b.ready = true
        b.raw = null
        paintButton(b)
      }).catch(err => console.warn('[soundboard] decode', b.id, err))
    }
  })
  for (const b of buttons) paintButton(b)

  return {
    object, buttons, update, tryPress, press, lookLabel,
    mountLightSwitch,
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
