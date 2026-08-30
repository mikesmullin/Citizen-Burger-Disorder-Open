# Citizen Burger Disorder

A native browser port of Kritz’s 2014 physics co-op burger restaurant, rebuilt
in three.js with the help of AI — no Unity runtime.

<img width="1580" height="889" alt="image" src="https://github.com/user-attachments/assets/8b8a729f-bf03-4aa2-8335-eb351cc23caa" />

**Play the museum:** from the [Github Static Pages hosted version](https://mikesmullin.github.io/Citizen-Burger-Disorder-Open/museum.html),  
or run it locally:
```bash
bun server.mjs
# http://127.0.0.1:8765/museum.html
```

Click to capture the mouse. WASD to walk, Shift to run, Ctrl to walk, Q/E for
each hand, click to grab or drop food, Esc to pause.

On a phone the museum shows a left stick, a jump button, and L / R grab
buttons (tap to grab, tap again to drop); drag the empty right side to look.
Add `?touch` to the URL to force that overlay on a desktop.

---

## Kritz

Nick “Kritz” Blackburn (@atAmpersatKritz) is the independent developer behind
*Citizen Burger Disorder*. He ran it from kritz.net as a free web-based Unity
alpha that needed an account. The game never left early/alpha status.
Development stalled years ago after he moved on (reportedly after getting a
job), and the original servers went offline. A Steam group and plans for a
polished standalone existed at one point; it was never fully released.

## The game

*Citizen Burger Disorder* is a chaotic multiplayer physics-driven burger
restaurant. You play a fast-food worker with deliberately awkward dual-arm
controls (the QWOP of kitchen work): WASD to move, Q/E to raise each arm, mouse
buttons to grab with that hand. Assemble ordered burgers (patty, cheese,
toppings, buns on plates), restock from the delivery truck, wash dishes, put
out fires, chase rats, and hide the health-code violations while the place
falls apart. Burgers finish when the top bun goes on; accuracy affects payout.
Co-op on a shared kitchen was the whole joke.

It stayed extremely buggy and incomplete (“pre-pre-pre-alpha”), which only
added to the humor. It went viral in 2014–2015 through YouTube — Markiplier,
jacksepticeye, CoryxKenshin, Robbaz, LaurenZside, VanossGaming, and others,
many videos with millions of views. People loved the physics flailing, the
rats, burning everything, serving floor food, and multiplayer mayhem. Fan
recreations and nostalgia clips still show up years later.

## The open-source dump

On **June 10, 2026**, Kritz released the source under the GitHub names
**Kritz7** and **Nicholas Blackburn**, with the commit message **“here ya go,
sickos”**. Upstream:
[Kritz7/Citizen-Burger-Disorder-Open](https://github.com/Kritz7/Citizen-Burger-Disorder-Open).

He stripped a few scripts that held sensitive networking/auth, so the Unity
project will not compile as-is, and he will not help you fix it. The dump is
**CC0 1.0 Universal** (see `LICENSE`): commercial use is fine, credit is
optional, no strings. Tone matches the original developer perfectly —
“Have fun, sickos.”

This is the real original source (cleaned of those bits), not a fan reverse
engineer.

## This port

Unity’s legacy netcode is gone from modern Unity, the art is locked in binary
assets, and there is no useful C# → JavaScript transpile for a game like this.
We are **rewriting** it as a static three.js site — ES6 modules, no Unity
runtime — using the C# as a specification and AI/LLMs to do the conversion
work. The original is ~13k lines of gameplay code; the feel (two-hand grab and
throw, cooking, rats, fire) is what we are after.

`public/museum.html` is the first playable slice: a walkable hall of the
converted restaurant art, with the original first-person controls, two hands,
wandering NPCs, and rats that steal dropped food. The real
kitchen level (`testArea01`) still needs reconversion. Cooking, orders, and
multiplayer come after this.

How the museum is laid out, how assets are named, and how to extend
systems: [CONTRIB.md](CONTRIB.md).
