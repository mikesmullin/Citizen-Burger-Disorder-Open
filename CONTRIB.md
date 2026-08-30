# Contributing

This is a **rewrite** of *Citizen Burger Disorder* into a static three.js
site — not a transpile, not a Unity WebGL export. Kritz’s C# is the
specification; the browser game is ES6 modules under `public/`.

If you are an agent: start here, then `README.md`, then `public/game/` and
`public/museum.html`. The debug harness (`dbg` / `pose`) is documented in
[TEST.md](TEST.md). Do not look for a C# → JavaScript compiler. Do not
put Unity gizmos back on pedestals. Port **behavior** from the original
scripts; keep **art** in `public/assets/`.

Live demo (GitHub Pages, `public/` from `main`):
https://mikesmullin.github.io/Citizen-Burger-Disorder-Open/

---

## The museum is the centerpiece

`public/museum.html` is the whole point of this branch right now. It is an
all-in-one debug / test scene: every translated asset and behavior we have
so far lives in one walkable hall so you can **see it, grab it, and verify
it at once**.

Once the museum is at feature parity with what those systems did in the
original, we split them into real game scenes (the restaurant kitchen, the
order queue, the truck dock, …) true to Kritz’s layout. Until then, do not
invent extra menus or a campaign structure. Put new work in the museum so
it can be checked in one place.

**Play locally**

```bash
bun server.mjs &
# long-running — background it so the shell returns
# http://127.0.0.1:8765/museum.html
```

Click to capture the mouse.

| input | action |
|---|---|
| WASD / arrows | move |
| Shift | run |
| Ctrl | walk |
| mouse | look |
| Q / E | raise left / right arm |
| LMB / RMB | grab or drop with that hand (arm must be up) |
| 0 / 1 / 2 | empty hands / scale gun / transform gun |
| X / Y / Z | (transform gun) toggle that axis; drag does nothing until one is on |
| Space | jump |
| Esc | release mouse (click to recapture; game does not pause) |

On a phone (or `?touch` on the URL) a left stick + jump + **L** / **R** overlay
appears instead of pointer lock. Stick output is halved vs. a full analog
deflection; the rim is still run. Drag the empty right side to look. Tap a
soundboard button or light switch to press it — the tap raycasts from the
finger, not the crosshair. Tap **L** / **R** to raise that hand and grab;
tap again to drop and lower the arm. Drive it from an agent with
`__museum.touch.setStick(x, z)` and `__museum.touch.press('l'|'r'|'jump', true)`.

**Scale and transform guns** are for humans to measure a pose, then paste
the numbers to the coding agent so it can encode them. They are not
gameplay. `0` puts the gun away (empty hands). `1` equips the **scale
gun**: aim at an exhibit, a player nametag, a wainscot, a booth
placard (RANGE, KITCHEN, BACK, PREP, …), or a wall poster, hold LMB, drag right to
enlarge and left to shrink. `2` equips the **transform gun**: tap `X` /
`Y` / `Z` to lock the axes you want (none are on until you tap one), aim,
hold LMB, and drag. On mouse-up the console prints a copy-paste line such
as `tag.position.set(0.502, 0.372, -0.162)` or
`tag.scale.set(0.573, 0.238, 0.038)`. Copy that log (or the JSON object
above it) into the agent chat and ask it to bake the values into the
prefab / `seatNameTag` / `EXHIBIT_LONGEST` / `putTag(...)` / wall-poster `{ id, x, y, z, yaw, w, h }`.

Food exhibits clone into the hand; the pedestal stays. Dropped cheese /
patty / bacon / tomato / tip can be stolen by rats. NPCs wander and look at you
when you get close. The delivery truck is a walk-in bay (not a pedestal):
climb the ramp, grab a closed box, set it down to unpack.

In the browser console, `window.__museum` exposes
`{ scene, camera, player, exhibits, crowd, foodWorld, hands, rats, demoPlayers, teleport, enter, pause, dbg, pose }`.

    __museum.teleport('Cheese')
    __museum.teleport('Npc')
    __museum.teleport('Truck')

Time-travel and the model poser are also on `window.dbg` and `window.pose`.
Agent round-trips are too slow to screenshot a moving frame — freeze first.

    dbg.freeze()                 // sim stops; render keeps going
    dbg.step(60)                 // +1 s at 1/60
    dbg.state()                  // JSON: player, food, rats, NPCs, T
    dbg.key('KeyQ', true)        // hold Q, then dbg.step(1)
    dbg.mouse(0, true)           // LMB down (0) / RMB (2)
    dbg.equip(1)                 // 0 empty, 1 scale gun, 2 transform gun
    dbg.axes('y')                // transform gun: toggle Y
    dbg.unfreeze()
    dbg.help()

    await pose.enter('items/Cheese')           // white studio, model alone
    pose.view('front')                         // also: back left right top bottom iso
    pose.view('left', 'isometric')             // ortho from that axis
    pose.view('iso')                           // 3/4 isometric
    pose.rotate(45)
    pose.exit()

Views × projections: `front|left|top|…` × `perspective|isometric`. `pose.list()` is every exhibit slug. F9 freezes, F10 steps one frame, `?debug` on the URL shows the on-screen panel.

---

## What you are looking at (and what you are not)

Kritz published a Unity 5.1 project. That dump is preserved on this fork as
branch **`original`**
([Kritz7/Citizen-Burger-Disorder-Open](https://github.com/Kritz7/Citizen-Burger-Disorder-Open)
upstream). Branch **`main`** is the browser port only.

The published tree does **not** include the Unity project, binary scenes, or
the conversion scratchpad. Those lived in a private `tmp/` directory during
the port (Unity extract, an orbit-style asset picker, world-matrix fixtures)
and are gitignored. If you clone this repo you will not see them — that is
intentional. You do not need them to work on the museum.

The path from his dump to this tree, in short:

1. Read the C# as a design spec (~13k lines of gameplay). Legacy Unity
   netcode is gone anyway; art was binary-serialized.
2. Convert surviving YAML prefabs / ASCII FBX / 2014 `.blend` meshes into
   browser JSON + float32 triangle soup (see `tools/` below).
3. Drop script hosts, trigger volumes, pathfinding gizmos, and empty GUI
   widgets — those are behavior, not art. Behavior is rewritten in
   `public/game/`.
4. Put every remaining piece in the museum and play it.

Unity’s main restaurant level (`testArea01`) did not survive an early
editor upgrade (it was saved as an empty stub). Grill / oven / sink
**geometry** lived in that scene, not in prefabs. `Grill.cs` is ~24 lines of
`OnTriggerStay → food.cook()`. Cooking, orders, and the real kitchen layout
come after the museum is solid.

---

## Layout of `main`

GitHub Pages deploys the `public/` directory from `main`. That folder is
both the game and the static site root.

```
public/
  museum.html              entry (index.html redirects here)
  vendor/                  three.js r185
  game/                    JavaScript — roles, not Unity folders
    scenes/museum.js       the hall
    systems/               player, hands, food, npc, rats, touch
    common/unityScene.js   JSON → Object3D
    common/timeTravel.js   freeze / step clock
    common/poser.js        white-studio model views
    common/harness.js      window.dbg + window.pose
    common/ecs.js          bitmask world (Game9-shaped, no archetypes)
    entities/              spawned stand-ins (demoPlayers)
    components/            Cmp* factories (data only)
    gamedata/              prefabs, menu recipes, brains
    behaviors/  net/  shaders/   reserved
  assets/
    entities/              prefab JSON, grouped by kind (see below)
      heroes/  mobs/  items/  tiles/  ui/
    models/                extracted meshes (ProperCase.bin)
    textures/              albedo + skins/ + ui/
    audio/  shaders/  web/ reserved
    manifest.json          index the museum reads
```

Repo root besides `public/`:

| path | role |
|---|---|
| `README.md` | History, how to play |
| `CONTRIB.md` | This file |
| `tools/` | One-time Unity → browser converters (see below) |
| `.github/workflows/pages.yml` | Deploys `public/` |

`game/` is named after a C99 layout (systems / scenes / entities) used in
other projects in this family. Empty `net/`, `shaders/`, `audio/` folders
are placeholders for work that is not here yet — do not delete them to
“clean up.”

---

## `assets/entities/` naming

World objects are grouped by **role**, then given a short **ProperCase**
name. That is the same idea as Sébastien “deepnight” Bénard’s Haxe layout
(`en.m` mobs, `en.h` heroes, `en.inter` interactives) and the
`src/game/entities/{creatures,ui}` split in later C games — spelled out in
full words for a JS repo.

| folder | means | examples |
|---|---|---|
| `heroes/` | The body you play as, plus its viewmodel | `Player`, `Arm` |
| `mobs/` | Characters with AI, not the player | `Npc`, `Rat` |
| `items/` | Pickup, placeable, appliance | `Cheese`, `Spatula`, `Truck` |
| `tiles/` | Repeatable ground / wall | `MuseumFloor.png`, `KitchenFloor.png` |
| `ui/` | HUD, tickets, bubbles, menus | `StaffMenu`, `SpeechBubble` |

Rules:

- ProperCase basenames. No `!` Unity-prefab prefixes, no `bun-bottom`,
  no `sCheese`.
- Kind folder is the namespace. Never flatten to `entities/Cheese.json`.
- Meshes follow the same names (`models/Rat.bin`; extra submeshes are
  `Truck_2.bin`, …). Texture `tex` fields in JSON must match.
- `Truck` is an item (delivery prop), not a mob.
- Script-only Unity objects (pathfinding nodes, trigger volumes, empty GUI
  hosts) do **not** belong here. Their C# is rewritten as systems.

`public/assets/manifest.json` is generated from `entities/**/*.json`. The
museum loads it and skips anything that is not real art.

---

## `tools/` — one-time converters

These scripts turned Unity YAML / FBX / `.blend` into the files under
`public/assets/`. They are still in the tree so the conversion is
reproducible against branch `original`, but they are **not** part of the
runtime. Once the game is a faithful translation they will probably be
ignored or removed.

If you have a checkout of `original` (or any Unity extract) and need to
re-run them:

```bash
# point at a Unity 5 project tree
export CBD_PROJ=/path/to/Citizen-Burger-Disorder-Open

python3 tools/convert.py 'Resources/Prefabs/Utensils/!Spatula.prefab'
python3 tools/build_models.py     # → public/assets/models/*.bin
python3 tools/manifest.py         # → public/assets/manifest.json
python3 tools/atlas_posters.py    # → public/assets/textures/posters/atlas.png
python3 tools/build_tire.py       # → public/assets/models/Tire.bin + textures/Tire.png
python3 tools/verify.py items/Spatula
```

`tools/paths.py` is the name table (`ENTITY_BY_BASENAME`, `TEX_RENAME`,
`MESH_BY_SOURCE`). New assets must be added there so converters emit
ProperCase entity slugs (`items/Spatula`), not Unity paths.

Facts the converters already baked in — do not “fix” these without measuring:

- Unity is left-handed Z-forward; three.js is right-handed Z-back.
  `pos → (x, y, -z)`, `quat → (-x, -y, z, w)`, scale unchanged. Convert
  **local** transforms; the Z-flip commutes through the hierarchy.
- Most greybox is Unity Cube `fileID 10202`; `localScale` is the size.
- Legacy albedo is `_Color` × `_MainTex`. Flat dev textures contribute
  their mean, converted to linear.
- ASCII FBX 6100 (Blender 5 refuses these) and 2014 `.blend` files extract
  to float32 `[positions | normals | uvs]`. Axis mapping is identity + Z
  flip, **not** a Blender Z-up swap. Bake `matrix_world`.
- Skinned shipping boxes render in bind pose (closed). `Constructor.FBX`
  is binary FBX and is not extracted (orange placeholder if you ever see
  it).
- World-space Unity UI used `RectTransform` anchors, not `m_LocalPosition`
  (that field is ~0 on children).

---

## How to add or change something

**Art / a new pickup**

1. Add `public/assets/entities/<kind>/<ProperName>.json` (and mesh /
   texture if needed).
2. Register the Unity basename in `tools/paths.py` if it still has to go
   through `convert.py`.
3. `python3 tools/manifest.py`
4. Confirm it appears on a museum pedestal and can be grabbed if it is food.

**Behavior (move, grab, NPC, rat, cook, …)**

Edit `public/game/systems/`. Match the original C# on branch `original`
when that script exists (`FirstPersonControl`, `PickupObject`, `NPC`,
`Rat`, `Food`, `Grill`, …). Numbers from those files (speeds, grab range,
seek weights) are more trustworthy than a fresh guess.

**A real game scene** (kitchen, menu, …)

Not yet. Extend the museum until the relevant systems feel right, then add
`public/game/scenes/<Name>.js` and an HTML entry. The museum stays as the
debug sandbox.

**Multiplayer / audio / custom shaders**

Folders are reserved (`game/net/`, `assets/audio/`, `assets/shaders/`).
Do not introduce a bundler or a Unity WebGL build to get there.

---

## Notes for coding agents

- **Rewrite, not transpile.** There is no automated Unity → three.js path
  that preserves this game. Read C# on `original` as spec; implement in
  `public/game/`.
- **The museum is the test.** If a system cannot be exercised in
  `museum.html`, it is not done. Do not start a parallel scene graph.
- **You will not see `tmp/`.** Do not invent paths like `tmp/cbe2/` or
  `tmp/translating/`. Assets you need are already under `public/assets/`.
  Unity source, if required, is branch `original`.
- **Do not restore gizmos.** Pathfinding nodes, trigger boxes, empty
  `GText` hosts, Standard Assets character controllers — those were
  dropped on purpose. Their logic belongs in JS.
- **Names are a contract.** `items/Cheese` is the cheddar cube, `mobs/Npc` not
  `npc/NPC`, `heroes/Arm` not `player/arm`. `tools/paths.py` is canonical.
- **Hands:** Q/E raises a hand; click while that hand is up grabs. Food
  exhibits clone; `rec.foodType` (from `inferFoodType`) marks grab copies.
- **Debug handle:** `window.__museum`. `teleport('Spatula')` by label or
  slug (`'Name badge'` for the nametag). `dbg.freeze()` / `dbg.step(n)` before
  a screenshot; `pose.enter(slug)` to inspect a model on white
  (`pose.view('front'|'left'|'top', 'isometric')`). `dbg.equip(1|2)` for
  scale / transform guns; `dbg.axes('y')` toggles a transform axis.
- **Edit guns:** humans use `1` (scale) and `2` (transform) in the museum,
  then paste the console `[scale] copy:` / `[transform] copy:` lines into
  the agent. Encode those numbers; do not re-guess. Transform drag is a
  no-op until `X`/`Y`/`Z` has been tapped.
- **Pages:** `public/` is the site root. Keep asset URLs relative
  (`./assets/…`, `./game/…`). `public/.nojekyll` must stay.
- **Front booth:** `public/game/systems/front.js` is the walk-in
  street / door / queue / order computer / dining exhibit. New diners go
  through `spawnPrefab` into `common/ecs.js`; hall `createCrowd` stays.
  Confirm an order with `__museum.front.confirm(['Citizen'])` (dbg skip
  of the number-stand throw). Humans click the order computer; throw a
  stand or call `__museum.front.giveStand()`. The till is the computer
  base — a held Tip touching it counts. Do not grow `npc.js` into the
  restaurant loop.
- **Scope:** grab/throw feel, cooking, fire, and netcode are the
  remaining hard systems. Village flocking, VR/Oculus, drawing/notepad,
  day/night are optional and not load-bearing.

This port is **CC0 1.0 Universal**, same as Kritz’s original dump. See
`LICENSE`. Commercial use is allowed; credit is optional.
