# The shared world · scene brief

The world is the A2 city Seba approved (2026-10-21; `docs/superpowers/specs/2026-10-20-world-cadastre-design.md`):
every island a cadastre, Generators (west) and Front ends (east) split by a river with the "?", the four Auditor
islands (Reloads, Sessions, Telemetry, Metadata) bridged to the common port (north), Data connections (south-west,
203 parcels) and the containers land (south-east) dark until S06/S09 bridge them to the second port (south).
World units = stage px at camera `full`. Every scene that shows the map uses `WorldStage`, so all show the same states.
Shared files are read-only for scene agents: anything missing goes in your report as a shared request.

## 1 · Include order (paths from `deck/scenes/`)

```html
<link rel="stylesheet" href="../shared/tokens.css">
<link rel="stylesheet" href="../shared/world/world.css">
<script src="../shared/world/theme.js"></script>       <!-- first: ?theme=night|day, CSS variables -->
<script src="../shared/world/data.js"></script>        <!-- WORLD, LOGS, TRUTH -->
...body...
<script src="../shared/vendor/gsap.min.js"></script>   <!-- + any plugin from ../shared/vendor/ -->
<script src="../shared/scene-runtime.js"></script>
<script src="../shared/world/world.js"></script>       <!-- window.WorldRender (R) -->
<script src="../shared/world/stage.js"></script>       <!-- window.WorldStage -->
```

## 2 · Skeleton

`deck/shared/world/scene_skeleton.html` is a working S04-like scene (lights off -> on -> names and "?"), captured
clean with `qa/capture.py` on night, day and `?at=end`. Copy it to `deck/scenes/sNN.html`. Its core:

```js
const h = await WorldStage.mount(document.querySelector("#ws"), { split: true, state: "S04-end" });
const names = [...h.labels.values()].filter((el) => el !== h.q);
gsap.set([h.layers.lit, h.layers.known, h.q, ...names], { autoAlpha: 0 });   // s0: lights off, no names
const tl = gsap.timeline({ paused: true }).addLabel("s0", 0);
tl.to(h.layers.lit, { autoAlpha: 1, duration: 0.8, ease: R.MOTION.light }, "s0").addLabel("s1");
Scene.init(tl, ["s0", "s1"]);                                            // after mount (the map is frozen)
```
`#ws` is an empty `position:absolute; inset:0` div placed FIRST in the stage, so title, notes and icon sit above.
`h.layers.lit` exists only with `split: true` (else it is `null`, and `gsap.set(null)` warns: the console gate fails).

## 3 · `WorldStage.mount(container, opts) -> Promise<h>`

opts: `cam` ("full"), `res` (2), `rect` ({-96, -96, 2112, 1272}: the stage plus 96 on every side, so no map edge
shows at `land` or `diary`), `detached` ("dark" | "lit"), `split` (false: an unlit map under the lit one, for S04's
lights), `labels` (true), `state` ("S04-end").

| handle | what |
|---|---|
| `h.world` | the element the camera moves: `tl.to(h.world, {...R.camera("land"), duration: 1.8, ease: R.MOTION.dolly})` |
| `h.svg` | SVG overlay in world units, inside `h.world`: your own bridges, marks |
| `h.layers` | `known` (rails + common port), `needed` (dashed to the second port + gf at the "?"), `bridged` (bridges of light, second port built), `owners` (59 marks), `lit` (lit map when `split`) |
| `h.labels`, `h.q` | Map id -> label (screen space); `h.q` = the "?" |
| `h.veil` | `--stage` veil over the world, under the labels (`setState("dim")` = 0.6) |
| `h.ports`, `h.bridges`, `h.owners` | `{known, missing}`; `{known[], needed[], gf, bridged[]}`; Map district id -> `{g, dot, at}` (clear of plates, bridge ends, ports) |
| `h.setState(name)` | `"S04-end"`, `"S06-end"`, `"S09-end"`, `"base"`, `"dim"` (adds the veil) |
| `h.setOwned(f)` | fill the first f of the owner marks (seeded order `h.ownerOrder`; S06 = 0.5, S17 = 1) |
| `h.place(cam)`, `h.sync()` | re-anchor labels for a camera / to the world's current transform (`onUpdate: h.sync`) |

States (the scene contract): **S04-end** = known lit incl. Metadata, detached dark, "?" in the river, every name
and the territories; **S06-end** = + `needed`, owners half filled; **S09-end** = `needed` -> `bridged`, "?" gone,
owners still half. Start a scene with `setState` of the previous scene's end, so continuity matches. **S09 rests
on its last step in exactly "S09-end"** (its traced route faded, `bridged` in, `needed` and the "?" out), because
S10 starts from `setState("S09-end")` + `setState("dim")`.

The detached islands (land, Data connections) are baked into the map, not a layer. A scene that lights them
mid-scene draws its own canvas over them (§5: `R.land`, `R.parcels` on `c0..c202`) and fades it in; a scene that
starts with them lit (S17's complete map) mounts with `detached: "lit"`.

Rules: fade layers, labels and the veil with **autoAlpha**, never opacity alone (an SVG layer left visible at
opacity 0 changed how Chromium draws every text run: measured). Labels are placed by their own `transform`: never
tween a label's x / y / scale; fade it, or `h.place(cam)` after a camera move. The labels do not scale with the
camera; at `diary` (0.49) hide them. Owner marks are SVG in world units: they grow with the camera, so hide
`h.layers.owners` at zoom > 1 (S16 draws its own at `stream`).

Text at camera `full`: the map fills ~94 % of x 96-1824, y 182-990. Open ground is the band right of the
headline (open sea, about x 1300-1824, y 56-185) and the footer band (left of the note). S05-S07's stakes and notes
go there, or on their own `.w-label` plate over `setState("dim")`, or beside the city at camera `diary` (x 96-960
free). Never bare text on the lit map.

## 4 · Cameras (`R.camera(name)` -> GSAP vars; `R.camRect(name, pad)` = the visible world)

| name | zoom | frames | map res needed |
|---|---|---|---|
| `full` | 1 | the whole city (S04-S10, S17) | 2 (default) |
| `land` | 1.809 | the land as round-2 S11 framed it (centre at screen 960, 636) | 2 |
| `conn` | 2.0 | Data connections (S12) | 2 |
| `apps` | 1.056 | Generators + Front ends (S13-S15) | 2 |
| `stream` | 3.5 | `WORLD.focus_stream` = "fs4", an On-prem front-end district of median size (S16) | 3.5: `{res: 3.5, rect: R.camRect("stream", 40)}` |
| `diary` | 0.493 | the city in x 1000-1824, y 182-990; x 96-960 is the log sheet (S08/S09) | 2 |

Map res must be >= the largest zoom you use, or it turns soft. Beyond `rect` the stage shows `--stage`; a custom
`rect` must cover every camera you rest on (pad 40), or its edge shows as a faint straight step in the sea.
The icon's air (no sea rings within 64 px of 1820, 988) holds at `full` only: at other cameras keep that corner
clear yourself.

## 5 · Drawing on the city (S11, S12, S13, S15)

Draw your own transparent canvas over the map (world units; the islands lie inside the stage rect), once, then
freeze it before `Scene.init`:
```js
const rect = { x: 0, y: 0, w: 1920, h: 1080 }, res = 2, cv = document.createElement("canvas");
cv.width = rect.w * res; cv.height = rect.h * res;
cv.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px";
h.world.insertBefore(cv, h.svg);                       // above the map, under the SVG
const ctx = cv.getContext("2d");
R.parcels(ctx, rect, res, litIds, { fill: T.inUse, alpha: 0.85 });            // S12: 67 lit
R.parcels(ctx, rect, res, reviewIds, { stroke: T.review, width: 2 });         // S12: 22 outlined
R.bloomCells(ctx, litIds.map((id) => R.parcel(id).p), T.inUse, 0.55, 14, rect, res);
await R.freeze([cv]);                                  // then R.fz(cv) is the <img> to animate
```
Ids: app parcels `g0..g1806` (generators) and `f0..f1754` (front ends), each `{id, e: env, s: district index, p:
polygon, c: centre}`; connection parcels `c0..c202` (`{id, d, p, c}`); stream districts `gs0..`, `fs0..` (`R.district
(id)`: `{id, env, poly, n}`). The land: `WORLD.land.containers[].cells[]` with `u` (usage), `files`, `mb`; draw it
with `R.land` / `R.cellFiles` (S11; their style object as in world.js `map()`). Counts are real (asserted against
`foundation/truth.json`); which parcel is "the 67" is illustrative: pick with `R.mulberry32(seed)`, never
`Math.random`. Which apps are lit or marked never implies a real app.

S09's traced route: `WORLD.route` = `{gen, fe, db, G, F, DB, FILE, bridges: [db, store, load, gf], fan}`; draw with
`R.lightBridge(h.svg, b, {arrow: true})` or `R.bridgeD(b)` for your own path (DrawSVG). While it plays, the second
port is hidden or `R.port(h.svg, port, "neutral")`. The gf arc passes 44 px above the "?" centre (18 px over its
ink, spec §6), so the "?" can stay while it draws and fades when it lands. Route labels: `R.labels(h.labelsEl,
"s09")` then `R.placeLabels(map, cam)`.

## 6 · Text and colour

Label classes (`world.css`): `.w-label` (26 px Medium, plate at night, halo by day; names in `<b>`), `.w-label-dim`
(receding), `.w-dim` (inside a label), `.w-hero` (Bold 150, `--key`: the single key moment only), `.w-note` (24 px,
e.g. "Illustrative layout · real counts", required whenever the map is visible), `.w-foot` (footer band),
`.w-qm` (the "?"), `.w-terr`, `.w-route`. Headline: `.scene-title` (Bold 64, one size per scene) overridden to
`left: 96px; top: 56px; line-height: 70px` as the skeleton does (tokens.css says 120 / 92).
Text >= 24 px; nothing under the icon (bottom-right 72 px); footer baselines >= 1,032 px.

Colours only from `THEME` (JS: `THEME.inUse`, `THEME.review`, `THEME.key`, `THEME.app`, `THEME.ink*`, `THEME.sea`,
`T.rgba(token, a)`) or the CSS variables (`--stage --ink --ink-dim --ink-faint --in-use --review --key
--unused-apps --never-read --no-sign --paper*`); derived tints with `color-mix(...)`. No literal colours anywhere
(`python qa/lint_colors.py <files>` must pass). Red only for the key moment. Light: `R.bloom` / `R.bloomCells`,
SVG halos x `R.C.halo`; never your own glow constants.

## 7 · Gates

```
python qa/capture.py deck/scenes/sNN.html qa/out/sNN --throttle 1                  # while building
python qa/capture.py deck/scenes/sNN.html qa/out/sNN_day --throttle 1 --query theme=day
python qa/capture.py "deck/scenes/sNN.html?at=end" qa/out/sNN_end --throttle 1
python qa/lint_colors.py deck/scenes/sNN.html
```
report.json: console, page errors and external requests empty; every text >= 24 px; open the step frames and the
`_teams720` ones at full size. fps at 4x throttle is measured later in one serial pass (`--throttle 4`): the probe's
2 s dolly full -> land at 4x is the reference (see `qa/out/world_review/summary.json`).

World checks (shared, not yours to change): `python qa/test_world.py` (data, cameras, the port gate),
`python qa/test_legibility.py`, `python qa/test_theme.py`. The probe shows every state:
`qa/fixtures/world_probe.html?overlay=none|known|needed|s09|s09end&cam=<name>&theme=day&dolly=1`.

## 8 · Rebuilding the city (world owner only)

`python design-demos/round3-layout/kit/run.py A2-vertical` (kit build + render + checks), then
`python deck/shared/world/make_data.py` (writes `data.js` only on change), then `python qa/test_world.py`.
Ids and positions are deterministic (seeded): a rebuild with nothing changed leaves `data.js` untouched.
