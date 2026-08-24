// Agent-facing debug harness: time-travel + model poser, plus a small HUD.
//
// Console (also on window.__museum.dbg / .pose):
//   dbg.freeze() / dbg.unfreeze() / dbg.step(n) / dbg.stepMs(ms) / dbg.resetT()
//   dbg.state()  — JSON snapshot of player, food, rats, NPCs
//   dbg.key('KeyQ', true) / dbg.mouse(0, true)  — inject input, then step(1)
//   pose.enter('items/Cheese')  — white studio, model alone
//   pose.view('front'|'left'|'top'|'iso', 'perspective'|'isometric')
//   pose.exit()
//
// Round-trips between agent turns are slow; freeze first, then inspect.

import { createTimeTravel } from './timeTravel.js'
import { createPoser, VIEWS, PROJS } from './poser.js'

const HELP = `dbg — time travel
  dbg.freeze()            stop sim (render keeps going)
  dbg.unfreeze()
  dbg.step(n=1)           advance n frames of 1/60 s, then render
  dbg.stepMs(ms)          advance ~ms of sim time
  dbg.resetT()            set T=0 (does not rewind world state)
  dbg.info()              { frozen, T, frames }
  dbg.state()             JSON snapshot
  dbg.key('KeyQ', true)   hold/release a key
  dbg.mouse(0, true)      mouse button 0=LMB 2=RMB
  dbg.look(yaw, pitch)    degrees, applied immediately
  dbg.teleport('Cheese')  same as __museum.teleport
  dbg.equip(0|1|2)        0 empty hands, 1 scale gun, 2 transform gun
  dbg.axes('x'|'y'|'z')   toggle transform-gun axis (X/Y/Z)
  dbg.mouseMove(dx, dy)   pointer-lock delta (LMB-drag scales/moves when a gun is out)
  dbg.scales()            exhibit mul / longest-edge / badge pos dump
  dbg.panel(true|false)   show the on-screen panel
  dbg.draws()             next frame: meshes grouped by name, highest count first
  dbg.help()

touch (phones, or ?touch on the URL)
  __museum.touch.dump()
  __museum.touch.setStick(0, 1)     // analog: x strafe, z forward
  __museum.touch.press('l'|'r'|'jump', true)

pose — model studio (white bg, nothing else)
  await pose.enter('items/Cheese')
  pose.view('front'|'back'|'left'|'right'|'top'|'bottom'|'iso')
  pose.view('left', 'isometric')   // ortho from that axis
  pose.view('iso')                 // 3/4 isometric (ortho)
  pose.rotate(45)                  // yaw degrees
  pose.axes(true) / pose.grid(true)
  pose.list()                      // exhibit slugs
  pose.exit()
  pose.info()`

function r(v) {
  return +(+v).toFixed(2)
}

function vec(p) {
  if (!p) return null
  return { x: r(p.x), y: r(p.y), z: r(p.z) }
}

function injectPanel() {
  if (document.getElementById('dbgPanel')) return
  const css = document.createElement('style')
  css.textContent = `
    #dbgToggle {
      position:fixed; left:12px; bottom:36px; z-index:30;
      background:#14110e; color:#c4a574; border:1px solid #3a322c;
      border-radius:8px; padding:5px 10px; font:12px/1.3 ui-sans-serif,system-ui,sans-serif;
      cursor:pointer; display:none;
    }
    #dbgPanel {
      display:none; position:fixed; left:12px; bottom:72px; z-index:30;
      background:#14110eee; color:#e8dcc8; border:1px solid #3a322c;
      border-radius:10px; padding:12px 14px; font:12px/1.45 ui-sans-serif,system-ui,sans-serif;
      width:270px;
    }
    #dbgPanel.open { display:block; }
    #dbgPanel b { color:#f0e6d4; font-size:13px; }
    #dbgPanel .row { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; align-items:center; }
    #dbgPanel button {
      background:#2a241f; color:#f0e6d4; border:1px solid #4a4038;
      border-radius:6px; padding:4px 8px; font:12px ui-sans-serif,system-ui,sans-serif; cursor:pointer;
    }
    #dbgPanel button:hover { background:#3a322c; }
    #dbgPanel .lbl { color:#9a8f80; font-size:11px; margin-top:8px; }
    #dbgPanel input[type=number], #dbgPanel input[type=text] {
      width:64px; background:#1a1714; color:#f0e6d4; border:1px solid #4a4038;
      border-radius:6px; padding:3px 6px; font:12px ui-sans-serif,system-ui,sans-serif;
    }
    #dbgPanel input[type=text] { width:140px; }
  `
  document.head.appendChild(css)

  const toggle = document.createElement('button')
  toggle.id = 'dbgToggle'
  toggle.textContent = '⏱ Debug'
  document.body.appendChild(toggle)

  const panel = document.createElement('div')
  panel.id = 'dbgPanel'
  panel.innerHTML = `
    <b>Time-travel</b>
    <div class="row">
      <button id="dbgFreeze" title="F9">Freeze</button>
      <span class="lbl" style="margin-top:0">steps</span>
      <input type="number" id="dbgSteps" value="1" min="1" max="600">
    </div>
    <div class="row">
      <button id="dbgStep1">+1</button>
      <button id="dbgStepN">+N</button>
      <button id="dbgResetT">Reset T</button>
    </div>
    <div class="lbl" id="dbgInfo">frozen: false · T=0.0s</div>
    <b style="display:block;margin-top:12px">Model poser</b>
    <div class="row">
      <input type="text" id="dbgSlug" placeholder="items/Cheese" spellcheck="false">
      <button id="dbgPoseEnter">Enter</button>
      <button id="dbgPoseExit">Exit</button>
    </div>
    <div class="row">
      <button data-view="front">front</button>
      <button data-view="left">left</button>
      <button data-view="top">top</button>
      <button data-view="iso">iso</button>
    </div>
    <div class="row">
      <button data-proj="perspective">persp</button>
      <button data-proj="isometric">isometric</button>
    </div>
    <div class="lbl" id="dbgPoseInfo">not posing</div>
  `
  document.body.appendChild(panel)
}

export function installHarness({
  scene, renderer, loader, player,
  getExhibits, dumpExtras, teleport,
  hudSelectors, extraDbg,
} = {}) {
  const time = createTimeTravel()
  const poser = createPoser({ scene, renderer, loader, getExhibits, hudSelectors })

  let tickFn = () => {}
  function bind({ tick, render } = {}) {
    tickFn = tick || tickFn
    time.bind({
      tick: dt => tickFn(dt),
      render: () => {
        if (poser.active) poser.render()
        else if (render) render()
      },
    })
  }

  function snapshot() {
    const extra = dumpExtras ? dumpExtras() : {}
    return {
      ...time.info(),
      pose: poser.info(),
      player: player ? {
        pos: vec(player.position),
        yaw: r(player.yaw),
        pitch: r(player.pitch),
        enabled: player.enabled,
        locked: player.locked,
        leftHand: player.leftHand,
        rightHand: player.rightHand,
        analog: player.analog ? { x: r(player.analog.x), z: r(player.analog.z) } : null,
        touchLock: !!player.touchLock,
      } : null,
      ...extra,
    }
  }

  const dbg = {
    freeze: () => time.freeze(true),
    unfreeze: () => time.freeze(false),
    toggle: () => time.toggle(),
    step: n => poser.active ? poser.info() : time.step(n),
    stepMs: ms => poser.active ? poser.info() : time.stepMs(ms),
    resetT: () => time.resetT(),
    info: () => time.info(),
    state: snapshot,
    key(code, down = true) {
      if (!player) return { error: 'no player' }
      if (down) player.keys.add(code)
      else player.keys.delete(code)
      return { keys: [...player.keys] }
    },
    mouse(button, down = true) {
      if (!player) return { error: 'no player' }
      player.setMouse(button, down)
      extraDbg && extraDbg.scaler && extraDbg.scaler.update()
      return { button, down: !!down }
    },
    look(yaw, pitch) {
      if (!player) return { error: 'no player' }
      if (yaw != null) player.yaw = yaw
      if (pitch != null) player.pitch = pitch
      if (poser.active) poser.render()
      else renderer.render(scene, player.camera)
      return { yaw: r(player.yaw), pitch: r(player.pitch) }
    },
    teleport(slug) {
      return teleport ? teleport(slug) : null
    },
    equip(name) {
      const s = extraDbg && extraDbg.scaler
      if (!s) return { error: 'no scaler' }
      s.equip(name)
      s.update()
      return s.dump()
    },
    axes(name) {
      const s = extraDbg && extraDbg.scaler
      if (!s) return { error: 'no scaler' }
      if (name) s.toggleAxis(name)
      s.update()
      return s.dump()
    },
    mouseMove(dx = 0, dy = 0) {
      if (!player || !player.injectMouse) return { error: 'no player' }
      extraDbg && extraDbg.scaler && extraDbg.scaler.update()
      const injected = player.injectMouse(dx, dy)
      extraDbg && extraDbg.scaler && extraDbg.scaler.update()
      return extraDbg && extraDbg.scaler ? extraDbg.scaler.dump() : injected
    },
    scales() {
      const s = extraDbg && extraDbg.scaler
      return s ? s.dump() : { error: 'no scaler' }
    },
    panel(on) {
      injectPanel()
      const toggle = document.getElementById('dbgToggle')
      const panel = document.getElementById('dbgPanel')
      const show = on == null ? toggle.style.display === 'none' : !!on
      toggle.style.display = show ? 'block' : 'none'
      if (!show) panel.classList.remove('open')
      return { panel: show }
    },
    draws() {
      const req = extraDbg && extraDbg.requestDrawCensus
      if (!req) return Promise.reject(new Error('no draw census'))
      return req()
    },
    get lastDraws() { return extraDbg && extraDbg.lastDrawCensus },
    help: () => HELP,
    get T() { return time.T },
    get frozen() { return time.frozen },
  }

  const pose = {
    async enter(t, o) {
      time.freeze(true)
      player?.unlock()
      try {
        return await poser.enter(t, o)
      } catch (err) {
        return { active: false, error: String(err && err.message || err) }
      }
    },
    view: (v, p) => poser.view(v, p),
    exit: () => poser.exit(),
    list: () => poser.list(),
    info: () => poser.info(),
    rotate: d => poser.rotate(d),
    axes: on => poser.axes(on),
    grid: on => poser.grid(on),
    bg: c => poser.bg(c),
    get active() { return poser.active },
    get ready() { return poser.ready },
    views: VIEWS,
    projs: PROJS,
    help: () => HELP,
    async markAxle() {
      const truck = window.__museum && window.__museum.delivery && window.__museum.delivery.object
      if (!truck) return { error: 'no delivery truck in the scene' }
      time.freeze(true)
      player?.unlock()
      const entered = await poser.enter(truck)
      if (!entered.active) return entered
      return poser.markAxle()
    },
    axleReport: () => poser.axleReport(),
  }

  injectPanel()
  const toggle = document.getElementById('dbgToggle')
  const panel = document.getElementById('dbgPanel')
  toggle.addEventListener('click', () => panel.classList.toggle('open'))
  document.getElementById('dbgFreeze').addEventListener('click', () => {
    time.toggle()
    refreshPanel()
  })
  document.getElementById('dbgStep1').addEventListener('click', () => {
    time.step(1)
    refreshPanel()
  })
  document.getElementById('dbgStepN').addEventListener('click', () => {
    const n = parseInt(document.getElementById('dbgSteps').value, 10) || 1
    time.step(n)
    refreshPanel()
  })
  document.getElementById('dbgResetT').addEventListener('click', () => {
    time.resetT()
    refreshPanel()
  })
  document.getElementById('dbgPoseEnter').addEventListener('click', () => {
    const slug = document.getElementById('dbgSlug').value.trim() || 'items/Cheese'
    pose.enter(slug).then(() => refreshPanel())
  })
  document.getElementById('dbgPoseExit').addEventListener('click', () => {
    pose.exit()
    refreshPanel()
  })
  panel.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const run = poser.active ? Promise.resolve() : pose.enter(document.getElementById('dbgSlug').value.trim() || 'items/Cheese')
      run.then(() => {
        pose.view(btn.dataset.view)
        refreshPanel()
      })
    })
  })
  panel.querySelectorAll('[data-proj]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!poser.active) return
      pose.view(undefined, btn.dataset.proj)
      refreshPanel()
    })
  })

  function refreshPanel() {
    const infoEl = document.getElementById('dbgInfo')
    const poseEl = document.getElementById('dbgPoseInfo')
    const freezeBtn = document.getElementById('dbgFreeze')
    if (!infoEl) return
    const i = time.info()
    infoEl.textContent = `frozen: ${i.frozen} · T=${i.T.toFixed(2)}s · frames=${i.frames}`
    freezeBtn.textContent = i.frozen ? 'Resume' : 'Freeze'
    const p = poser.info()
    poseEl.textContent = p.active
      ? `${p.slug} · ${p.view} · ${p.proj}`
      : 'not posing'
  }

  addEventListener('keydown', e => {
    if (e.code === 'F9') {
      e.preventDefault()
      time.toggle()
      refreshPanel()
    }
    if (e.code === 'F10') {
      e.preventDefault()
      time.step(1)
      refreshPanel()
    }
    if (e.code === 'F8' && poser.active) {
      e.preventDefault()
      pose.exit()
      refreshPanel()
    }
  })

  if (/\bdebug\b/.test(location.search)) dbg.panel(true)

  window.dbg = dbg
  window.pose = pose
  window.__dbgHelp = HELP

  return { time, poser, dbg, pose, bind, snapshot, refreshPanel }
}
