# Test harness

Console functions for driving the museum from DevTools or an agent
browser eval (`browser_eval`). They exist because an agent turn
(read → tool call → reply) is slower than a frame: by the time you
screenshot, rats have moved and the grab is over. Freeze first, then
look.

Play locally, then open `museum.html` (add `?debug` for the on-screen
panel):

```bash
python3 -m http.server 8765 --directory public
# http://127.0.0.1:8765/museum.html
```

Globals (set once the module loads; `__museum` is complete after boot):

| name | when |
|---|---|
| `window.dbg` | immediately (clock starts with the rAF loop) |
| `window.pose` | immediately (loads assets on `enter`) |
| `window.__museum` | after `[museum] ready` — wait for this before teleport / state |

Same objects also live on `__museum.dbg` and `__museum.pose`.
`dbg.help()` / `pose.help()` print the short cheat sheet.

This is **not a rewind**. `T` only goes forward. `resetT()` zeros the
clock display; it does not restore positions.

---

## Wait until the museum is actually up

Boot is async (manifest + every pedestal). `dbg` exists first; `__museum`
does not.

```js
// poll until boot finished
!!window.__museum && document.getElementById('loader')?.dataset?.ready === '1'
```

Then enable the player if you are not a human with a mouse:

```js
__museum.enter()   // pointer lock may fail without a user gesture; WASD still works
```

The integrated browser often starts at **0×0**. A 0-size canvas never
paints. Emulate a viewport *before* the first screenshot (1280×720 is
enough), then let the rAF `fitRenderer` pick it up — or:

```js
__museum.renderer.setSize(innerWidth, innerHeight)
```

---

## Strategy: freeze, then inspect

1. `dbg.freeze()` — sim stops; the renderer keeps drawing the frozen frame.
2. `dbg.state()` — JSON, not a screenshot. Use this for numbers.
3. Screenshot only when you need to *see* a mesh, a pose, or lighting.
4. `dbg.step(n)` / `dbg.stepMs(ms)` to advance a known amount, then
   `dbg.state()` again and diff.
5. `dbg.unfreeze()` when you are done.

`step(n)` also freezes. Cap is 6000 frames (~100 s). One step is
`1/60 s`. `step(60)` is one second of NPC walk, food gravity, rat AI,
arm lerp.

```js
const before = dbg.state()
dbg.freeze()
dbg.step(120)                 // +2 s
const after = dbg.state()
// after.npcs[i].pos should have moved if they were wandering
```

While frozen, keys still register (`dbg.key`) but nothing moves until
`step`. Click-to-grab is edge-triggered inside `player.update`, so a
mouse button must go down on the *step* that should grab — see
[Grab / drop](#grab--drop) below.

`dbg.step` is a no-op during `pose` (the hidden museum should not walk
away under the studio).

### `dbg.state()` shape

```js
{
  frozen, T, frames, dt, playing,
  pose: { active, … },
  player: { pos, yaw, pitch, enabled, locked, leftHand, rightHand },
  holding: '',
  food:  [{ type, pos, held, onFloor, stolen }],
  rats:  [{ pos, stolen, goingHome }],
  npcs:  [{ skin, want, notice, pos }],
  exhibits: ['heroes/Player', 'items/Cheese', …],
}
```

`dbg.info()` is the clock only: `{ frozen, T, frames, dt, playing }`.

---

## `dbg` — time travel and input

| call | returns | notes |
|---|---|---|
| `dbg.freeze()` | clock info | sim dt becomes 0; render continues |
| `dbg.unfreeze()` | clock info | |
| `dbg.toggle()` | clock info | |
| `dbg.step(n=1)` | clock info | freezes, ticks `n` × 1/60 s, renders |
| `dbg.stepMs(ms)` | clock info | `step(round(ms/1000*60))` |
| `dbg.resetT()` | clock info | `T=0`; **does not rewind the world** |
| `dbg.info()` | clock info | |
| `dbg.state()` | snapshot | see above |
| `dbg.key('KeyQ', true)` | `{ keys }` | `KeyboardEvent.code`. `false` to release |
| `dbg.mouse(0, true)` | `{ button, down }` | `0` LMB, `2` RMB. Needs a following `step(1)` to fire `fire1Down` |
| `dbg.look(yaw, pitch)` | `{ yaw, pitch }` | degrees, applied immediately |
| `dbg.teleport('Cheese')` | caption or `null` | label, caption, or slug. Also `'Soundboard'` |
| `dbg.equip(0\|1\|2)` | scale dump | 0 empty hands, 1 scale gun, 2 transform gun |
| `dbg.axes('x'\|'y'\|'z')` | scale dump | toggle a transform-gun axis (all off by default) |
| `dbg.panel(true)` | `{ panel }` | on-screen HUD. `?debug` in the URL does this |
| `dbg.T` / `dbg.frozen` | number / bool | |
| `dbg.help()` | string | |

Keys that matter here: `KeyW/A/S/D`, `ShiftLeft`, `ControlLeft`,
`KeyQ` (left hand), `KeyE` (right hand).

Keyboard while the tab is focused (human): **F9** freeze, **F10** step 1,
**F8** exit pose.

---

## `pose` — white-studio model views

Isolate one prefab on a white background, nothing else drawn, HUD gone.
Use this to debug meshes, axes, scale, and textures — not gameplay.

```js
await pose.enter('items/Cheese')     // waits for textures + 2 rAFs, then renders
pose.view('top')
pose.view('left', 'isometric')
pose.view('iso')                     // 3/4 isometric (ortho)
pose.exit()                          // museum back; sim stays frozen
```

`enter` freezes the sim and releases pointer lock. `exit` restores
visibility / fog / background; it does **not** unfreeze.

### `enter` argument

- Slug: `'items/Cheese'`, `'mobs/Rat'`, `'heroes/Player'`
- Exhibit label / caption: `'Cheese'`, `'Rat'` (resolved via `pose.list()`)
- A live `THREE.Object3D` — temporarily re-centered; original parent +
  transform restored on `exit`

Do not pass `audio/Soundboard` — that is a JS booth, not a prefab JSON.

On failure `enter` returns `{ active: false, error }` rather than
throwing, so a `browser_eval` still gets a value.

### Views × projections

| view | camera looks from |
|---|---|
| `front` | +Z (Unity forward after LH→RH conversion) |
| `back` | −Z |
| `left` | −X (model's left if it faces +Z) |
| `right` | +X |
| `top` | +Y (up is −Z so lookAt does not flip) |
| `bottom` | −Y |
| `iso` | `(1,1,1)` — 45° yaw, ~35.264° elevation |

Second argument: `'perspective'` (default) or `'isometric'` (orthographic).
Aliases for the projection: `'iso'`, `'ortho'`. Calling `pose.view('iso')`
with no projection switches to isometric.

A thin object (cheese is ~1×0.05×1) is a line from `front` and a square
from `top`. That is the model, not a poser bug — check `pose.info().size`.

### Other pose calls

| call | notes |
|---|---|
| `pose.info()` | `{ active, ready, slug, view, proj, size, radius, cam }` |
| `pose.list()` | `[{ slug, label, group }]` from current exhibits |
| `pose.rotate(deg)` | yaw the model, re-render |
| `pose.axes(true)` | RGB axes at the origin |
| `pose.grid(true)` | XZ grid |
| `pose.bg('#ffffff')` | studio clear color (page chrome matches) |
| `pose.active` / `pose.ready` | bools |
| `pose.views` / `pose.projs` | the name lists |

`ready` is true only after `enter` has finished waiting on textures.

---

## `__museum` — scene handle

Set at the end of boot.

```js
{
  scene, camera, renderer, player,
  exhibits, crowd, foodWorld, hands, rats, demoPlayers, soundboard, delivery,
  kitchen, front, world, teleport, enter, pause,
  dbg, pose,
}
```

| call | notes |
|---|---|
| `__museum.teleport('Spatula')` | stand in front of that pedestal and look at it |
| `__museum.teleport('Truck')` | stand on the aisle in front of the delivery ramp |
| `__museum.teleport('Kitchen')` | stand in the galley entrance. Also `'Range'`, `'Sink'`, `'Counter'`, `'Orders'` |
| `__museum.teleport('Front')` | stand on the road looking at the double door. Also `'Street'`, `'Door'`, `'Queue'`, `'Checkout'`, `'Staff'`, `'Register'`, `'Window'`, `'Pass'`, `'Back'`, `'Seat1'`…`'Seat4'` |
| `__museum.enter()` | enable player, request pointer lock (click on the canvas does this too) |
| `__museum.pause()` | release pointer lock only — sim keeps running |

Useful live objects (not JSON-serializable — don't return them from
eval unless you pick fields):

- `__museum.foodWorld.items`
- `__museum.rats.rats` / `.count`
- `__museum.crowd.npcs`
- `__museum.hands.left` / `.right` / `.holdingLabel()`
- `__museum.exhibits` — `{ slug, label, caption, x, z, size, foodType? }`

You can pose a live mesh:

```js
await pose.enter(__museum.rats.rats[0].object)
pose.view('iso')
```

---

## Recipes

### 1. Confirm a model, all six sides

```js
await pose.enter('mobs/Rat')
// screenshot
pose.view('front')           // screenshot
pose.view('left')
pose.view('top')
pose.view('iso')
pose.view('front', 'isometric')
pose.exit()
```

If the silhouette is wrong, `pose.axes(true)` and `pose.info().size`
tell you which axis is long. Unity leftover facing is +Z = front.

### 2. Did that NPC actually walk?

```js
dbg.freeze()
const a = dbg.state().npcs[0]
dbg.teleport('Truck')        // get the player far enough they stop "noticing"
dbg.step(180)                // 3 s
const b = dbg.state().npcs[0]
// a.pos vs b.pos, a.want vs b.want, a.notice vs b.notice
```

NPCs inside ~3.8 m of the player stand and stare (`notice`). Teleport
away first or they will not wander.

### 3. Grab / drop

Hands only grab if that arm is **up** (`KeyQ` / `KeyE`) *and* the click
edge happens on a sim tick.

```js
dbg.freeze()
dbg.teleport('Cheese')
__museum.enter()
dbg.look(/* facing the pedestal — teleport already does this */)
dbg.key('KeyQ', true)        // raise left arm
dbg.step(20)                 // let the arm lerp up (~25 * dt)
dbg.mouse(0, true)           // LMB down
dbg.step(1)                  // this frame sees fire1Down → grab a copy
dbg.state().holding          // 'cheese'
dbg.mouse(0, false)
dbg.key('KeyQ', false)
dbg.step(1)                  // fire1Up while holding → drop
```

Do **not** try to hold Q across agent turns with a real KeyboardEvent;
inject with `dbg.key`. Pedestal exhibits clone; floor food is stolen by
rats if it is cheese / patty / bacon / tomato / tip.

### 4. Rats steal floor food

Cheese spawners write at `T >= next` (first spawn at `T=0`). After boot
you may already have floor cheese.

```js
dbg.freeze()
const floor = dbg.state().food.filter(f => f.onFloor)
dbg.stepMs(12000)            // spawn delay in rats.js is 12 s
dbg.state().rats             // { pos, stolen, goingHome }
```

### 5. Unload a delivery box

Closed boxes live on the trailer bed. Carry one out, set it down; the
first landing unrolls the cardboard net and spills that box's contents
(`PattMcRat` meat, `SeedyCedric` buns, `GreenGrace` produce — `Box.cs`).

```js
dbg.freeze()
dbg.teleport('Truck')
__museum.enter()
__museum.player.spawn(0, 0, -26.2, 0)   // on the bed, facing the back row
__museum.player.pitch = -22
dbg.key('KeyQ', true)
dbg.step(25)
dbg.mouse(0, true)
dbg.step(1)                            // grab
dbg.state().holding                    // 'box'
__museum.player.spawn(0, 0, -11.5, 0)  // back on the hall floor
dbg.mouse(0, false)
dbg.step(2)                            // drop
dbg.step(90)                           // fall + unpack
dbg.state().food.filter(f => f.type !== 'box')
```

The ramp is a platform: `player.groundY(x,z)` rises from 0 to `delivery.bedY`.

### 6. Kitchen stations

The kitchen is a walk-in booth (DiningFloor, prep counter, range, hanging
order board, dish pit). Food on the counter is live; the range cooks
whatever lands on the dark cooktop (`Grill.cs`, ~10 s to cooked).

```js
dbg.freeze()
dbg.teleport('Kitchen')
dbg.state().exhibits.filter(s => s.startsWith('kitchen/'))
dbg.teleport('Orders')     // look up at the ticket TV
dbg.teleport('Range')
dbg.teleport('Sink')
dbg.teleport('Counter')
```

Drop food on the grill:

```js
dbg.freeze()
dbg.teleport('Counter')
__museum.enter()
dbg.key('KeyQ', true)
dbg.step(20)
dbg.mouse(0, true)
dbg.step(1)
dbg.state().holding          // a prep-line food type
dbg.teleport('Range')
dbg.mouse(0, false)
dbg.step(2)                  // drop onto the cooktop
dbg.step(600)                // 10 s — cooked
```

Demo-player nametags are a white "HELLO my name is" card, not a burger sprite.
The grey NameTag cube matches the sticker's width/height (visible from the
side or back). Scale gun (Digit1) and transform gun (Digit2) both pick the
badge; transform-gun X/Y/Z lock parent-local axes, then LMB-drag moves it
and `console.log`s `tag.position.set(...)` / `tag.scale.set(...)`.

### 7. Front of house (customers, orders, serve, tips)

The booth is ECS. Hall NPCs in `dbg.state().npcs` are the wander crowd;
diners are `dbg.state().front`.

```js
dbg.freeze()
dbg.teleport('Front')
dbg.state().front
// { npcs: [{ eid, want, anger, desiredFood, groupId, pos }],
//   orders, register: { money }, tips: n, queue }

dbg.teleport('Street')
if (!dbg.state().front.npcs.length) __museum.front.spawnNow(2)
dbg.step(180)                 // leader should approach door / queue

dbg.teleport('Queue')
__museum.front.confirm(['Citizen', 'Citizen'])
dbg.step(120)
dbg.state().front.npcs        // want: 'waitFood', seats assigned
dbg.state().front.orders      // hanging Citizen ticket

dbg.teleport('Seat1')
__museum.front.dropPlated('Seat1', 'Citizen')
dbg.step(2)
dbg.state().front.npcs        // want: 'eat'
dbg.state().front.tips        // > 0
dbg.teleport('Register')
// grab a tip: the till takes it on contact — no need to drop it out of the hand
// (wait a moment so the held dollar is inside the till zone)
dbg.step(30)
dbg.state().front.register.money
```

`__museum.front.confirm(items)` is the POS shortcut (skips the number-stand
throw). `__museum.front.dropPlated('Seat1', 'Citizen')` builds a complete
plated burger on that mat so the serve path is dbg-drivable.

Wait without food: `dbg.step(60 * 90)` — anger hits 100, they `leave`.
After a serve, chew is ~4 s (`dbg.step(240)`), then they walk out.

### 8. Screenshot a gameplay moment

```js
dbg.freeze()
dbg.teleport('Npc')
dbg.look(null, -10)
// screenshot now — NPCs will not have walked between eval and capture
dbg.unfreeze()
```

Eval returns JSON immediately; the screenshot tool is a second round
trip. Freeze covers that gap.

### 9. After a code change

Reload the tab (`museum.html`), wait for `__museum`, emulate viewport,
then re-run the same `state()` / `pose.view()` pair. Do not keep a
stale `pose` session across reloads.

---

## Eval notes (agents)

- Prefer `browser_eval` for `dbg.state()` / `pose.info()`. Screenshot
  only for pixels.
- `pose.enter` returns a Promise. Eval it as an expression the tool
  will await: `pose.enter('items/Cheese')` or
  `(async () => await pose.enter('items/Cheese'))()`.
- Return plain JSON. Do not return THREE objects; pick fields.
- Hide the debug panel before a pose screenshot (`?debug` leaves a
  ⏱ button). `pose.enter` already hides `#dbgToggle` / `#dbgPanel`.
- `preserveDrawingBuffer` is on; canvas screenshots are the frozen
  frame, not a later one.

---

## Files

| path | role |
|---|---|
| `public/game/common/timeTravel.js` | freeze / step clock (`1/60`) |
| `public/game/common/poser.js` | white studio, views × projections |
| `public/game/common/harness.js` | `window.dbg` + `window.pose` + panel |
| `public/game/scenes/museum.js` | wires `tick` / `render` / `dumpExtras` |

The museum is still the test scene. New systems should be exercisable
here (`teleport`, `state`, `step`) before they get their own HTML entry.
