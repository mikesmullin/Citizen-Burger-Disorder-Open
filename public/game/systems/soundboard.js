// Free-standing audio booth among the museum pedestals: a walk-in
// trade-show exhibit with a button wall at the back. Music toggles
// (loop, one at a time) as a non-positional bed that follows the
// listener; SFX are one-shots that stack and restart on re-press.
//
// Draws: kit greybox (panel/frame/grill) + one face canvas + two
// InstancedMeshes (bodies, LEDs). Labels live on the canvas so a
// clip does not cost a Mesh.

import * as THREE from 'three'
import { createSwitchSet, SWITCH_Y } from './lightSwitch.js'
import { whenAudio, resumeAudio, safePlay } from '../common/audio.js'
import { createKit, UNIT_BOX, UNIT_PLANE } from '../common/kit.js'
import { atlasUvMaterial } from '../common/atlasUv.js'

const BOARD_W = 3.85
const BOARD_H = 2.42
const BOARD_T = 0.10
const BOARD_Y = 0.48
const MUSIC_W = 1.12
const SWITCH_COL = 0.58
const PRESS_RANGE = 6.8
const SFX_PRESS = 0.11
const COLS = 5

const BOOTH_W = 5.6
const BOOTH_D = 3.5
const BOOTH_H = 3.2

const REST_Z = BOARD_T / 2 + 0.046
const IN_Z = BOARD_T / 2 + 0.016
const BODY_Z = 0.055
const LED_Z = 0.033

const musicMatIdle = { color: 0x3a322c }
const musicMatOn = { color: 0x8a5a18 }
const sfxMatIdle = { color: 0x2e2824 }
const sfxMatHover = { color: 0x4a4034 }
const sfxMatPress = { color: 0x6b4420 }

const _dummy = new THREE.Object3D()
const _col = new THREE.Color()
const _face = new THREE.Vector3()
const _q = new THREE.Quaternion()

function wrapLines(g, text, maxWidth) {
  const words = String(text || '').split(' ')
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

function retrigger(audio) {
  if (!audio || !audio.buffer) return false
  audio.offset = 0
  safePlay(audio, { restart: true })
  return true
}

function colorize(mesh, i, hex) {
  mesh.setColorAt(i, _col.setHex(hex))
  mesh.instanceColor.needsUpdate = true
}

function stampAt(mesh, i, x, y, z, sx, sy, sz) {
  _dummy.position.set(x, y, z)
  _dummy.rotation.set(0, 0, 0)
  _dummy.scale.set(sx, sy, sz)
  _dummy.updateMatrix()
  mesh.setMatrixAt(i, _dummy.matrix)
}

function enableInstanceColor(mesh, n) {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  attr.setUsage(THREE.DynamicDrawUsage)
  mesh.instanceColor = attr
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  for (let i = 0; i < n; i++) mesh.instanceColor.setXYZ(i, 1, 1, 1)
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

  const object = new THREE.Group()
  object.name = 'AudioBooth'
  object.position.set(x, y, z)
  object.rotation.y = facingY
  const overhead = buildBooth(object)

  const board = new THREE.Group()
  board.name = 'ButtonWall'
  board.position.set(0, BOARD_Y, -BOOTH_D / 2 + 0.09 + BOARD_T / 2 + 0.03)
  object.add(board)

  const panelW = BOARD_W + SWITCH_COL
  const panelX = SWITCH_COL / 2
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1c1814, roughness: 0.62, metalness: 0.08,
  })
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x6b5a45, roughness: 0.45, metalness: 0.22,
  })
  const grillMat = new THREE.MeshStandardMaterial({
    color: 0x0d0b09, roughness: 0.9, metalness: 0.04,
  })

  const kit = createKit({ parent: board, max: 24 })
  kit.box(panelMat, panelW, BOARD_H, BOARD_T, panelX, BOARD_H / 2, 0)
  kit.box(trimMat, panelW + 0.08, BOARD_H + 0.08, BOARD_T * 0.55, panelX, BOARD_H / 2, -0.02)
  const splitX = -BOARD_W / 2 + MUSIC_W
  kit.box(trimMat, 0.025, BOARD_H - 0.58, 0.04, splitX, BOARD_H / 2 - 0.08, BOARD_T / 2)
  for (let i = 0; i < 7; i++) {
    kit.box(
      grillMat, MUSIC_W - 0.28, 0.045, 0.03,
      (-BOARD_W / 2 + splitX) / 2, 0.38 + i * 0.09, BOARD_T / 2 + 0.01,
    )
  }
  kit.finalize()

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(panelW, BOARD_H, BOARD_T),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  hit.name = 'AudioHit'
  hit.position.set(panelX, BOARD_H / 2, 0)
  hit.userData.soundboard = true
  board.add(hit)

  const buttons = []
  const ndc = new THREE.Vector2(0, 0)
  const raycaster = new THREE.Raycaster()
  let hovered = null
  let musicId = null

  const nBtn = musicClips.length + sfxClips.length
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.48, metalness: 0.12,
  })
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.38, metalness: 0.12,
    emissive: 0x000000, emissiveIntensity: 0,
  })
  const bodies = new THREE.InstancedMesh(UNIT_BOX, bodyMat, Math.max(1, nBtn))
  bodies.name = 'AudioBtn'
  bodies.count = nBtn
  bodies.castShadow = true
  bodies.receiveShadow = true
  bodies.frustumCulled = false
  enableInstanceColor(bodies, nBtn)
  bodies.userData.byInstance = buttons
  board.add(bodies)

  const leds = new THREE.InstancedMesh(UNIT_BOX, ledMat, Math.max(1, nBtn))
  leds.name = 'AudioLed'
  leds.count = nBtn
  leds.castShadow = false
  leds.receiveShadow = false
  leds.frustumCulled = false
  leds.raycast = () => {}
  enableInstanceColor(leds, nBtn)
  board.add(leds)

  let labels = null

  function latchK(btn) {
    const latched = btn.kind === 'music' && musicId === btn.id
    if (latched) return 1
    if (btn.kind === 'sfx') return Math.min(1, btn.pressT / SFX_PRESS)
    return 0
  }

  function syncButton(btn) {
    const k = latchK(btn)
    const z = REST_Z - (REST_Z - IN_Z) * k
    btn.object.position.z = z
    stampAt(bodies, btn.i, btn.x, btn.y, z, btn.bw, btn.bh, BODY_Z)
    const faceW = btn.bw * 0.92
    const faceH = btn.bh * 0.78
    if (labels) stampAt(labels, btn.i, btn.x, btn.y, z + 0.029, faceW, faceH, 1)
    stampAt(
      leds, btn.i,
      btn.x, btn.y + faceH * 0.42, z + LED_Z,
      faceW * 0.56, Math.max(0.01, faceH * 0.05), 0.008,
    )
    bodies.instanceMatrix.needsUpdate = true
    leds.instanceMatrix.needsUpdate = true
    if (labels) labels.instanceMatrix.needsUpdate = true
  }

  function paintButton(btn) {
    const idle = btn.kind === 'music' ? musicMatIdle : sfxMatIdle
    let look = idle
    if (btn.kind === 'music' && musicId === btn.id) look = musicMatOn
    else if (btn.kind === 'sfx' && btn.pressT > 0) look = sfxMatPress
    else if (hovered === btn) look = btn.kind === 'music' ? musicMatOn : sfxMatHover
    colorize(bodies, btn.i, look.color)
    const lit = !!(btn.audio && btn.audio.isPlaying)
    colorize(leds, btn.i, lit
      ? 0xffe0a0
      : (btn.kind === 'music' ? 0xc4a574 : 0x6b5a45))
    syncButton(btn)
  }

  function makeButton(clip, kind, bw, bh, bx, by) {
    const g = new THREE.Object3D()
    g.position.set(bx, by, REST_Z)
    board.add(g)
    const rec = {
      i: buttons.length,
      id: clip.id,
      label: clip.label,
      kind,
      src: clip.src,
      object: g,
      audio: null,
      ready: false,
      pressT: 0,
      x: bx, y: by, bw, bh,
    }
    g.userData.soundButton = rec
    buttons.push(rec)
    return rec
  }

  const musicBtnH = 0.38
  const musicBtnW = MUSIC_W - 0.22
  const musicX = (-BOARD_W / 2 + splitX) / 2
  musicClips.forEach((clip, i) => {
    makeButton(
      clip, 'music', musicBtnW, musicBtnH,
      musicX, BOARD_H - 1.10 - i * (musicBtnH + 0.08),
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
    const row = (i / COLS) | 0
    const bx = sfxAreaLeft + sfxW / 2 + col * (sfxW + gapX)
    const by = sfxAreaTop - sfxH / 2 - row * (sfxH + gapY)
    makeButton(clip, 'sfx', sfxW, sfxH, bx, by)
  })

  const heads = [
    {
      text: 'AUDIO', sub: 'original game sounds', kind: 'header',
      x: 0, y: BOARD_H - 0.28, w: BOARD_W - 0.18, h: 0.38,
    },
    {
      text: 'MUSIC', sub: 'toggle · loop · exclusive', kind: 'section',
      x: musicX, y: BOARD_H - 0.64, w: MUSIC_W - 0.12, h: 0.34,
    },
    {
      text: 'SOUND EFFECTS', sub: 'one-shot · stacks · re-press restarts', kind: 'section',
      x: (splitX + BOARD_W / 2) / 2, y: BOARD_H - 0.64,
      w: BOARD_W - MUSIC_W - 0.16, h: 0.34,
    },
  ]
  const nLabel = buttons.length + heads.length
  const cellW = 512
  const cellH = 192
  const cols = 6
  const rowsA = Math.max(1, Math.ceil(nLabel / cols))
  const atlas = document.createElement('canvas')
  atlas.width = cols * cellW
  atlas.height = rowsA * cellH
  const ag = atlas.getContext('2d')
  const luv = new Float32Array(nLabel * 4)
  const tw = atlas.width
  const th = atlas.height

  function packCell(i, draw) {
    const col = i % cols
    const row = (i / cols) | 0
    ag.save()
    ag.translate(col * cellW, row * cellH)
    ag.clearRect(0, 0, cellW, cellH)
    draw(ag, cellW, cellH)
    ag.restore()
    luv[i * 4] = (col * cellW) / tw
    luv[i * 4 + 1] = 1 - ((row + 1) * cellH) / th
    luv[i * 4 + 2] = cellW / tw
    luv[i * 4 + 3] = cellH / th
  }

  for (const b of buttons) {
    packCell(b.i, (g, w, h) => {
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      let size = b.kind === 'music' ? 48 : 36
      g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`
      let lines = wrapLines(g, b.label, w - 36)
      while (size > 20 && (lines.length > 2 || g.measureText(lines[0] || '').width > w - 36)) {
        size -= 2
        g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`
        lines = wrapLines(g, b.label, w - 36)
      }
      const lh = size + 8
      const y0 = h / 2 - ((lines.length - 1) * lh) / 2 + 8
      lines.forEach((ln, li) => {
        g.fillStyle = li === 0 ? '#f0e6d4' : '#d4c4ae'
        g.fillText(ln, w / 2, y0 + li * lh)
      })
    })
  }
  heads.forEach((h, hi) => {
    packCell(buttons.length + hi, (g, w, ht) => {
      const pad = h.kind === 'header' ? 28 : 16
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      g.fillStyle = h.kind === 'header' ? '#f0e6d4' : '#c4a574'
      g.font = h.kind === 'header'
        ? '700 72px ui-sans-serif, system-ui, sans-serif'
        : '700 56px ui-sans-serif, system-ui, sans-serif'
      g.fillText(h.text, pad, 78)
      g.fillStyle = h.kind === 'header' ? '#b5a48a' : '#9a8f80'
      let subSize = 32
      g.font = `${subSize}px ui-sans-serif, system-ui, sans-serif`
      while (subSize > 18 && g.measureText(h.sub).width > w - pad * 2) {
        subSize -= 2
        g.font = `${subSize}px ui-sans-serif, system-ui, sans-serif`
      }
      g.fillText(h.sub, pad, 140)
    })
  })

  const labelMap = new THREE.CanvasTexture(atlas)
  labelMap.colorSpace = THREE.SRGBColorSpace
  labelMap.anisotropy = 4
  const labelGeo = UNIT_PLANE.clone()
  labelGeo.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(luv, 4))
  labels = new THREE.InstancedMesh(
    labelGeo,
    atlasUvMaterial(labelMap, {
      basic: true, transparent: true, key: 'audio-labels',
    }),
    Math.max(1, nLabel),
  )
  labels.name = 'AudioLabel'
  labels.count = nLabel
  labels.frustumCulled = false
  labels.raycast = () => {}
  board.add(labels)
  const headZ = BOARD_T / 2 + 0.012
  heads.forEach((h, hi) => {
    stampAt(labels, buttons.length + hi, h.x, h.y, headZ, h.w, h.h, 1)
  })
  labels.instanceMatrix.needsUpdate = true

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
    const aim = player.aimNdc || ndc
    raycaster.setFromCamera(aim, player.camera)
    const hits = raycaster.intersectObject(object, true)
    for (const h of hits) {
      if (h.distance > PRESS_RANGE) continue
      if (h.object === bodies && h.instanceId != null) {
        const rec = buttons[h.instanceId]
        if (rec) return rec
      }
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
        ? `music · ${hovered.label} · looping everywhere  · click to stop`
        : `music · ${hovered.label} · click to loop everywhere`
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
      let audio
      if (b.kind === 'music') {
        audio = new THREE.Audio(lis)
        audio.setVolume(0.5)
        audio.setLoop(true)
        lis.add(audio)
      } else {
        audio = new THREE.PositionalAudio(lis)
        audio.setRefDistance(8)
        audio.setMaxDistance(48)
        audio.setRolloffFactor(1)
        audio.setDistanceModel('linear')
        audio.setVolume(0.9)
        b.object.add(audio)
      }
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

  scene.add(object)

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
