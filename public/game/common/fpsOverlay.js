// FPS sparkline for the museum HUD. Type and 14px inset live in museum.html
// (#fpsHud); this module only paints the transparent graph and the value.

const DBG_N = 120
const DBG_CW = 120
const DBG_CH = 20

function dbgColdHot(t) {
  t = Math.max(0, Math.min(1, t))
  let r, g, b
  if (t < 0.5) {
    const s = t * 2
    r = 0.20 + 0.75 * s
    g = 0.45 + 0.40 * s
    b = 0.95 - 0.70 * s
  } else {
    const s = (t - 0.5) * 2
    r = 0.95
    g = 0.85 - 0.60 * s
    b = 0.25 - 0.05 * s
  }
  return 'rgb(' + (r * 255 | 0) + ',' + (g * 255 | 0) + ',' + (b * 255 | 0) + ')'
}

function backingScale() {
  return Math.max(1, Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1))
}

export function createFpsOverlay({ canvas, valueEl } = {}) {
  const samples = new Float32Array(DBG_N)
  let head = 0
  let lastFps = 0
  const el = canvas || document.getElementById('fpsGraph')
  const val = valueEl || document.getElementById('fpsVal')
  const ctx = el ? el.getContext('2d') : null

  function resizeBacking() {
    if (!el || !ctx) return
    const dpr = backingScale()
    const w = Math.max(1, Math.round(DBG_CW * dpr))
    const h = Math.max(1, Math.round(DBG_CH * dpr))
    if (el.width !== w || el.height !== h) {
      el.width = w
      el.height = h
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function draw() {
    if (!ctx) return
    resizeBacking()
    ctx.clearRect(0, 0, DBG_CW, DBG_CH)
    let sum = 0, cnt = 0
    for (let i = 0; i < DBG_N; i++) {
      const v = samples[(head + i) % DBG_N]
      if (v <= 0.01) continue
      const t = Math.min(1, v / 33.3)
      ctx.fillStyle = dbgColdHot(t)
      const bh = Math.max(1, DBG_CH * t)
      ctx.fillRect(i, DBG_CH - bh, 1, bh)
      sum += v
      cnt++
    }
    lastFps = cnt ? Math.round(1000 / (sum / cnt)) : 0
    if (val) val.textContent = cnt ? String(lastFps) : '—'
  }

  function sample(dtMs) {
    samples[head] = dtMs
    head = (head + 1) % DBG_N
    if ((head & 3) === 0) draw()
  }

  resizeBacking()
  draw()

  return {
    sample,
    get fps() { return lastFps },
  }
}
