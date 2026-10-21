/*
 * World renderer of the night-map deck (deck/shared/world/world.js), alias R in every scene: window.WorldRender.
 * Draws the shared world, window.WORLD from data.js: the round-3 city A2 that Seba approved on 2026-10-21
 * (docs/superpowers/specs/2026-10-20-world-cadastre-design.md), ported from the mockup kit's renderer
 * (design-demos/round3-layout/kit/kit.js and render.html) so the deck draws what he approved, pixel for pixel at
 * camera "full" (qa/test_world.py, the port gate). World units = stage px at camera full (1920 x 1080).
 * The round-2 renderer is in docs/archive/round2-world/world.js.
 *
 * The cadastral grammar (the same on every island; Seba 2026-10-20: "todas las islas parecen un catastro"):
 *   - a parcel is a filled polygon; the streets are the island's ground showing between parcels
 *   - three widths of street: between parcels (fine grain, TEXTURE: 1.25-1.4 px, spec §3), between districts
 *     (stream districts on the Apps islands, containers on the land), between territories (environments)
 *   - the coast is a 2 px rim; the sea around every island (the river included) carries contour hairlines
 *   - light is information: the known islands (Apps pair, the Auditor's four) are lit in THEME.app's white light;
 *     the detached (the land, Data connections) are terrain, dark until they are bridged
 *
 * Colours only from window.THEME (theme.js, loaded first; ?theme=night|day): this file holds no colour literal
 * (qa/lint_colors.py). No Math.random, no clock: seeded, drawn once, then frozen into images (R.freeze) before
 * Scene.init.
 *
 * API (the scene brief, deck/shared/world/SCENE_BRIEF.md, says how to use it; WorldStage in stage.js composes it):
 *   R.map(ctx, rect, res, opt)       the whole city. rect = the world rectangle the canvas covers {x, y, w, h};
 *                                    res = canvas px per world unit. opt = {detached: "dark" | "lit" (default dark,
 *                                    S04's end state), known: true | false (false: the Apps pair and the Auditor's
 *                                    islands unlit, drawn as dark terrain like the detached), dim: 0..1 (a veil of
 *                                    the sea over everything), bloom: the Apps bloom alpha (default 0.26)}
 *   R.parcels(ctx, rect, res, list, style)   fill and/or outline some parcels (S11, S12, S15): list = parcel
 *                                    objects or ids ("g12", "f7", "c40"); style = {fill?, stroke?, alpha?, width?}
 *                                    colours from THEME (e.g. THEME.inUse); width in world units (default 2)
 *   R.parcel(id)                     a parcel {id, p, c, ...} by id; R.district(id) a stream district by id
 *   R.bridgeD(B) -> "M.. Q.."        the SVG d of a bridge B = {a, c, b} (a quadratic)
 *   R.knownBridge(svg, B), R.neededBridge(svg, B), R.neededGF(svg, gf, inkBox), R.lightBridge(svg, B, opt),
 *   R.port(svg, port, look)          SVG drawers (world units); look = "known" | "missing" | "neutral" | "bridged".
 *                                    Each returns {g, pts: [polyline]} (pts: what a check measures)
 *   R.labels(parent, layer) -> Map<id, element>   WORLD.labels of that layer ("base" | "s09") as world.css labels
 *   R.placeLabels(map, cam)          anchor them for a camera (a name or {x, y, scale}); call after fonts load
 *   R.camera(name) -> {x, y, scale}  GSAP vars of the world layer at WORLD.cams[name]; R.camRect(name, pad) = the
 *                                    world rectangle visible at that camera
 *   R.freeze(canvases) -> Promise, R.fz(canvas) -> its frozen <img>; R.MOTION (the motion grammar);
 *   R.bloom, R.bloomCells (light, scaled by THEME.bloom / appLight), R.lights, R.sprite (round 2's light sprites,
 *   kept for qa/test_legibility.py (f) and scenes that kindle lights), R.land, R.cellFiles (the container land's
 *   file marks, S11), R.contours, R.glow, R.mulberry32, R.rgb, R.C (= THEME), R.HAIR, R.TEXTURE_STREETS (the
 *   fine street widths, exempt from the 2 px stroke rule), path, bb, area, inside, centroid.
 */
(function () {
  const W = window.WORLD;
  const T = window.THEME;
  if (!T) throw new Error("world.js: window.THEME is missing; load deck/shared/world/theme.js before world.js");
  if (!W || !W.apps || !W.conn || !W.conn.poly) throw new Error("world.js: load deck/shared/world/data.js (the A2 city) before world.js");
  const C = T;
  const ERASE = C.sea;
  const HAIR = 2;
  const TEXTURE_STREETS = [1.25, 1.4];   // the streets between parcels (Apps, known islands): texture, spec §3
  const TX = (() => {
    const t = T.texture, keys = ["marks", "shade", "gaps", "contours", "topo"];
    const bad = !t || typeof t !== "object" ? keys : keys.filter((k) => typeof t[k] !== "number" || !(t[k] >= 0 && t[k] <= 1));
    if (bad.length) throw new Error(`world.js: THEME.texture needs ${keys.join(", ")} in 0..1 (missing or wrong: ${bad.join(", ")})`);
    for (const k of ["bloom", "halo"]) if (typeof T[k] !== "number" || !(T[k] >= 0 && T[k] <= 1)) throw new Error(`world.js: THEME.${k} must be a number in 0..1`);
    const a = T.appLight;
    for (const k of ["bloom", "halo"]) if (!a || typeof a[k] !== "number" || !(a[k] >= 0 && a[k] <= 1)) throw new Error(`world.js: THEME.appLight.${k} must be a number in 0..1`);
    return t;
  })();
  const APP = T.channels(C.app).join(",");
  const lightOf = (colour) => (T.channels(colour).join(",") === APP ? C.appLight : C);
  const NS = "http://www.w3.org/2000/svg";

  // ---------------------------------------------------------------- helpers
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function path(ctx, poly, xf) {
    ctx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const p = xf ? xf(poly[i]) : poly[i];
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
  }
  function addPath(ctx, poly) {   // a subpath, so many polygons stroke as one shape (no double alpha on shared edges)
    for (let i = 0; i < poly.length; i++) { const p = poly[i]; if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
  }
  function bb(poly) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  }
  function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi + 1e-12) + xi) c = !c;
    }
    return c;
  }
  function centroid(p) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; const k = x1 * y2 - x2 * y1; a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k; }
    return Math.abs(a) < 1e-9 ? p[0] : [cx / (3 * a), cy / (3 * a)];
  }
  const rgb = (h, a) => T.rgba(h, a);

  // ---------------------------------------------------------------- light (round 2 / Task 4)
  const SPR = {};
  function sprite(rgbStr, core = 0.22) {
    const key = rgbStr + core;
    if (SPR[key]) return SPR[key];
    const s = document.createElement("canvas"); s.width = s.height = 32;
    const g = s.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, T.rgba(rgbStr, 1)); gr.addColorStop(core, T.rgba(rgbStr, 0.95));
    gr.addColorStop(core + 0.2, T.rgba(rgbStr, 0.22 * lightOf(rgbStr).halo)); gr.addColorStop(1, T.rgba(rgbStr, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return (SPR[key] = s);
  }
  function lights(ctx, pts, rgbStr, a, r) {
    const s = sprite(rgbStr); ctx.globalAlpha = a;
    for (const p of pts) ctx.drawImage(s, p[0] - r, p[1] - r, 2 * r, 2 * r);
    ctx.globalAlpha = 1;
  }
  // soft bloom over a cluster of points (world units), low-res, THEME.blend, dithered; alpha x the colour's bloom scale
  function bloom(ctx, pts, rgbStr, a, blur, rect, res, seed = 3) {
    const k = 0.25, w = Math.ceil(rect.w * k), h = Math.ceil(rect.h * k);
    const b = document.createElement("canvas"); b.width = w; b.height = h;
    const g = b.getContext("2d"); g.setTransform(k, 0, 0, k, -rect.x * k, -rect.y * k);
    g.fillStyle = T.rgb(rgbStr);
    for (const p of pts) g.fillRect(p[0] - 2, p[1] - 2, 4, 4);
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    const og = o.getContext("2d"); og.filter = `blur(${blur * k}px)`; og.drawImage(b, 0, 0); og.filter = "none";
    const id = og.getImageData(0, 0, w, h), d = id.data, rnd = mulberry32(seed);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 2; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    og.putImageData(id, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = C.blend; ctx.globalAlpha = a * lightOf(rgbStr).bloom; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(o, 0, 0, rect.w * res, rect.h * res);
    ctx.restore();
  }
  // the glow of lit fields (polygons, world units): a field glows with R.bloomCells, never with its own constants
  function bloomCells(ctx, polys, rgbStr, a, blur, rect, res, seed = 5) {
    const k = 0.5, w = Math.ceil(rect.w * res * k), h = Math.ceil(rect.h * res * k);
    const xf = (p) => [(p[0] - rect.x) * res, (p[1] - rect.y) * res];
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    const g = o.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = T.rgb(rgbStr);
    for (const p of polys) { path(g, p, xf); g.fill(); }
    const b = document.createElement("canvas"); b.width = w; b.height = h;
    const bg = b.getContext("2d"); bg.filter = `blur(${blur * res * k}px)`; bg.drawImage(o, 0, 0); bg.filter = "none";
    const id = bg.getImageData(0, 0, w, h), d = id.data, rnd = mulberry32(seed), A = a * lightOf(rgbStr).bloom;
    for (let i = 3; i < d.length; i += 4) if (d[i]) d[i] = Math.max(0, d[i] * A + (rnd() - 0.5) * 2);
    bg.putImageData(id, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = C.blend;
    ctx.drawImage(b, 0, 0, rect.w * res, rect.h * res);
    ctx.restore();
  }
  // dithered radial light (canvas, never a CSS gradient)
  function glow(w, h, cx, cy, rx, ry, colour, a0, seed = 9) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), id = g.createImageData(w, h), d = id.data, rnd = mulberry32(seed);
    const [r, gg, b] = T.channels(colour);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, q = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const a = a0 * q * q * (3 - 2 * q) * 255 + (rnd() - 0.5) * 1.6;
      const k = (y * w + x) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = Math.max(0, Math.min(255, a));
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- sea: contour lines around every island
  function contours(ctx, polys, xf, scale = 1) {
    const ds = [60, 40, 24, 11];
    const o = document.createElement("canvas"); o.width = ctx.canvas.width; o.height = ctx.canvas.height;
    const g = o.getContext("2d");
    g.lineJoin = "round"; g.lineCap = "round";
    ds.forEach((d, i) => {
      const lw = HAIR * scale;
      g.globalCompositeOperation = "source-over";
      for (const p of polys) { path(g, p, xf); g.lineWidth = 2 * d * scale + lw; g.strokeStyle = C.rings[3 - i]; g.stroke(); }
      g.globalCompositeOperation = "destination-out";
      for (const p of polys) { path(g, p, xf); g.lineWidth = 2 * d * scale - lw; g.strokeStyle = ERASE; g.stroke(); }
    });
    g.globalCompositeOperation = "destination-out";
    for (const p of polys) { path(g, p, xf); g.fillStyle = ERASE; g.fill(); }
    iconAir(g, xf, scale);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = TX.contours; ctx.drawImage(o, 0, 0); ctx.restore();
  }
  /*
   * The icon's air (spec §6): the Vodafone icon sits bottom-right (centre 1820, 988 at camera full) and no sea ring
   * passes under or near it: on the rings' own canvas the rings are erased within r0 of that point and fade back in
   * by r1 (world units). At other cameras that point moves: a scene there keeps the icon's corner clear itself.
   */
  const ICON_AIR = W.icon_air || null;   // {at, r0, r1} from make_data.py (absent: the round-3b frame, no air)
  function iconAir(g, xf, scale) {
    if (!ICON_AIR) return;
    const [cx, cy] = xf(ICON_AIR.at), r1 = ICON_AIR.r1 * scale;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r1);
    gr.addColorStop(0, T.rgba(ERASE, 1)); gr.addColorStop(ICON_AIR.r0 / ICON_AIR.r1, T.rgba(ERASE, 1)); gr.addColorStop(1, T.rgba(ERASE, 0));
    g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = gr;
    g.fillRect(cx - r1, cy - r1, 2 * r1, 2 * r1); g.restore();
  }

  // ---------------------------------------------------------------- the container land: files inside a cell
  function cellFiles(ctx, cl, theta, xf, s, style, seed) {
    const P = cl.poly.map(xf), A = area(P);
    if (A < 0.6) return;
    const pitch = Math.sqrt(A / cl.files);
    const c = Math.cos(theta), sn = Math.sin(theta);
    const loc = P.map(([x, y]) => [x * c + y * sn, -x * sn + y * c]);
    const b = bb(loc);
    const rnd = mulberry32(seed);
    const mk = style.marks ?? TX.marks;
    const tiles = pitch >= style.minTile, lum = tiles ? (style.tileLum ?? style.lum) : style.lum;
    ctx.save(); path(ctx, P); ctx.clip();
    if (style.ground) { ctx.fillStyle = style.ground; ctx.fill(); }
    if (style.add) ctx.globalCompositeOperation = C.blend;
    if (mk < 1 && lum > 0) { ctx.fillStyle = T.rgba(style.rgb, Math.min(1, lum * (1 - mk))); ctx.fill(); }
    ctx.globalAlpha = mk;
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([c, sn, -sn, c, 0, 0])));
    if (tiles) {
      let p = pitch, pts = null;
      for (let it = 0; it < 30; it++) {
        const cand = [];
        const ox = b[0] + ((b[2] - b[0]) % p) / 2, oy = b[1] + ((b[3] - b[1]) % p) / 2;
        for (let y = oy + p / 2; y < b[3]; y += p) for (let x = ox + p / 2; x < b[2]; x += p) if (inside([x, y], loc)) cand.push([x, y]);
        if (cand.length >= cl.files) { pts = cand.slice(0, cl.files); break; }
        p *= 0.97;
      }
      if (!pts) pts = [];
      const t = Math.max(1, p - Math.max(style.gap, p * style.gapK));
      ctx.fillStyle = T.rgba(style.rgb, Math.min(1, (style.tileLum ?? style.lum) / ((t * t) / (p * p))));
      for (const [x, y] of pts) ctx.fillRect(x - t / 2, y - t / 2, t, t);
      ctx.restore();
      return pts.length;
    }
    const gp = Math.max(style.minGrain, pitch), d = Math.max(0.9, gp * style.dotK);
    ctx.fillStyle = T.rgba(style.rgb, Math.min(1, style.lum / (style.cover * (d * d) / (gp * gp))));
    for (let y = b[1] + gp / 2; y < b[3]; y += gp) for (let x = b[0] + gp / 2; x < b[2]; x += gp) {
      const jx = (rnd() - 0.5) * gp * (style.jx ?? 0.7), jy = (rnd() - 0.5) * gp * (style.jy ?? 0.7);
      if (rnd() < style.cover) ctx.fillRect(x + jx - d / 2, y + jy - d / 2, d, d);
    }
    ctx.restore();
    return -1;
  }
  /*
   * The container land (S11 draws its categories with it). opt: xf (world -> canvas px), s (canvas px per world
   * unit), style(cl, ct) -> {ground, rgb, lum, minTile, minGrain, gap, gapK, dotK, cover, marks?} | null, gap and
   * terrGap (line widths, canvas px, >= HAIR * s, at THEME.texture.gaps unless opt.gapAlpha), gapColor, only(ct),
   * rim / rimW.
   */
  function land(ctx, opt) {
    const L = W.land, s = opt.s;
    let k = 0;
    for (const ct of L.containers) {
      if (opt.only && !opt.only(ct)) continue;
      for (const cl of ct.cells) {
        const st = opt.style(cl, ct);
        if (!st) continue;
        cellFiles(ctx, cl, ct.theta, opt.xf, s, st, 900 + k++);
      }
    }
    ctx.lineJoin = "round";
    ctx.globalAlpha = opt.gapAlpha ?? TX.gaps;
    for (const ct of L.containers) {
      if (opt.only && !opt.only(ct)) continue;
      path(ctx, ct.poly, opt.xf); ctx.lineWidth = Math.max(opt.gap, HAIR * s); ctx.strokeStyle = opt.gapColor || C.lit.gap; ctx.stroke();
    }
    if (opt.terrGap) for (const t of L.territories) { path(ctx, t.poly, opt.xf); ctx.lineWidth = Math.max(opt.terrGap, HAIR * s); ctx.strokeStyle = opt.gapColor || C.lit.gap; ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (opt.rim) { path(ctx, L.poly, opt.xf); ctx.lineWidth = Math.max(opt.rimW || 0, HAIR * s); ctx.strokeStyle = opt.rim; ctx.stroke(); }
  }

  // ---------------------------------------------------------------- the cadastral grammar (kit.js)
  /*
   * reg = {poly, parcels: [{p}], districts?: [poly], territories?: [poly]}; ctx in world units. st: ground (the
   * colour of every street), fill(i, pc), lot (fine streets' width) + lotAlpha, district, territory (wider streets),
   * street (their colour, else ground), rim (the coast, 2 px).
   */
  function cadastre(ctx, reg, st) {
    ctx.save();
    path(ctx, reg.poly); ctx.fillStyle = st.ground; ctx.fill(); ctx.clip();
    reg.parcels.forEach((pc, i) => { path(ctx, pc.p || pc.poly); ctx.fillStyle = st.fill(i, pc); ctx.fill(); });
    ctx.lineJoin = "miter"; ctx.miterLimit = 3;
    if (st.lot) {
      ctx.beginPath(); for (const pc of reg.parcels) addPath(ctx, pc.p || pc.poly);
      ctx.globalAlpha = st.lotAlpha ?? 1; ctx.lineWidth = st.lot; ctx.strokeStyle = st.ground; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (st.district && reg.districts) {
      ctx.beginPath(); for (const d of reg.districts) addPath(ctx, d);
      ctx.lineWidth = st.district; ctx.strokeStyle = st.street || st.ground; ctx.stroke();
    }
    if (st.territory && reg.territories) {
      ctx.beginPath(); for (const t of reg.territories) addPath(ctx, t);
      ctx.lineWidth = st.territory; ctx.strokeStyle = st.street || st.ground; ctx.stroke();
    }
    ctx.restore();
    path(ctx, reg.poly); ctx.lineJoin = "round"; ctx.lineWidth = HAIR; ctx.strokeStyle = st.rim; ctx.stroke();
  }
  const LIGHT = { apps: [0.24, 0.16, 0.07], known: [0.16, 0.10, 0.05], bloom: 0.26, knownBloom: 0.14 };
  const shadeOf = (seed) => { const r = mulberry32(seed); const m = new Map(); return (k) => { if (!m.has(k)) m.set(k, r()); return m.get(k); }; };
  const islandPolys = () => [W.apps.generators.poly, W.apps.frontends.poly, ...Object.values(W.islands).map((i) => i.poly),
    W.land.poly, W.conn.poly];

  // the river's water: the sea's own contour ring, again and stronger inside the river band (kit.js)
  const RIVER = { d: 10, alpha: 0.55 };
  function riverBand() {
    const L = W.river.line, w = W.river.w, left = [], right = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      const nx = dy / n, ny = -dx / n, h = w[i] / 2 + 1;
      left.push([L[i][0] + nx * h, L[i][1] + ny * h]); right.push([L[i][0] - nx * h, L[i][1] - ny * h]);
    }
    return left.concat(right.reverse());
  }
  function riverWater(ctx, xf, res) {
    const o = document.createElement("canvas"); o.width = ctx.canvas.width; o.height = ctx.canvas.height;
    const g = o.getContext("2d"), polys = [W.apps.generators.poly, W.apps.frontends.poly], lw = HAIR * res;
    g.lineJoin = "round";
    for (const p of polys) { path(g, p, xf); g.lineWidth = 2 * RIVER.d * res + lw; g.strokeStyle = C.known.rim; g.stroke(); }
    g.globalCompositeOperation = "destination-out";
    for (const p of polys) { path(g, p, xf); g.lineWidth = 2 * RIVER.d * res - lw; g.strokeStyle = ERASE; g.stroke(); }
    for (const p of polys) { path(g, p, xf); g.fillStyle = ERASE; g.fill(); }
    g.globalCompositeOperation = "destination-in"; path(g, riverBand(), xf); g.fillStyle = ERASE; g.fill();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = RIVER.alpha; ctx.drawImage(o, 0, 0); ctx.restore();
  }

  // terrain style (the land's ground plus an even lift of its marks): the connections, and the known islands unlit
  function terrain(D, lit, vOf) {
    const mk = T.channels(D.mark), lift = (lit ? 0.11 : 0.085) * (1 - TX.marks) + 0.05;
    return (j, pc) => { const G = D.ground, v = vOf(pc, j);
      const g0 = G.base + v * G.span * TX.shade;
      return T.rgb(G.tint.map((t, c) => Math.round((g0 + t) * (1 - lift) + mk[c] * lift))); };
  }

  /*
   * The whole city (see the header). At rect {0, 0, 1920, 1080}, res 2, {detached: "dark"} it is the approved A2
   * frame (design-demos/round3-layout/variants/A2-vertical/frames/base.png) without its labels.
   */
  function map(ctx, rect, res, opt = {}) {
    const xf = (p) => [(p[0] - rect.x) * res, (p[1] - rect.y) * res];
    const toW = () => ctx.setTransform(res, 0, 0, res, -rect.x * res, -rect.y * res);
    const toPx = () => ctx.setTransform(1, 0, 0, 1, 0, 0);
    const det = opt.detached || "dark";
    if (det !== "dark" && det !== "lit") throw new Error(`R.map: detached must be "dark" or "lit", not ${det}`);
    const D = C[det], lit = det === "lit", known = opt.known !== false;
    toPx();
    // ---- sea, the city's pool of light, contours (the river is sea: its hairlines come from here)
    ctx.fillStyle = C.sea; ctx.fillRect(0, 0, rect.w * res, rect.h * res);
    const k = 0.25, gw = Math.ceil(rect.w * res * k), gh = Math.ceil(rect.h * res * k);
    const gl = glow(gw, gh, (1040 - rect.x) * res * k, (600 - rect.y) * res * k, 1150 * res * k, 660 * res * k, C.glow.rgb, C.glow.alpha, 21);
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(gl, 0, 0, rect.w * res, rect.h * res);
    contours(ctx, islandPolys(), xf, res);
    riverWater(ctx, xf, res);

    // ---- the container land, its geometry the deck's (moved and scaled as one piece)
    path(ctx, W.land.poly, xf); ctx.fillStyle = D.fill; ctx.fill();
    const rv = mulberry32(77), shade = {};
    for (const ct of W.land.containers) shade[ct.id] = rv();
    land(ctx, {
      xf, s: res, gap: HAIR * res, terrGap: 3.4 * res, gapColor: D.gap,
      style: (cl, ct) => {
        const v = shade[ct.id], G = D.ground, g0 = G.base + v * G.span * TX.shade;
        return { ground: T.rgb([(g0 + G.tint[0]) | 0, (g0 + G.tint[1]) | 0, (g0 + G.tint[2]) | 0]), rgb: D.mark, lum: lit ? 0.11 : 0.085,
          add: false, minTile: 3.4 * res, minGrain: 2.0 * res, gap: 0.8 * res, gapK: 0.32, dotK: 0.5, cover: 0.7, jx: 0.5, jy: 0.08 };
      },
    });
    path(ctx, W.land.poly, xf); ctx.lineWidth = HAIR * res; ctx.strokeStyle = D.rim; ctx.stroke();

    // ---- Data connections: one parcel per connection, districts first (its streets), the land's terrain
    toW();
    const cs = shadeOf(31);
    cadastre(ctx, { poly: W.conn.poly, parcels: W.conn.parcels, districts: W.conn.districts }, {
      ground: D.gap, street: D.gap, fill: terrain(D, lit, (pc) => 0.65 * cs("d" + pc.d) + 0.35 * cs(pc.id)),
      lot: HAIR, lotAlpha: TX.gaps, district: 3.4, rim: D.rim,
    });

    if (known) {
      // ---- the Auditor's islands: known, lit quietly (white light on the lots)
      const ks = shadeOf(41);
      for (const [name, isl] of Object.entries(W.islands)) {
        cadastre(ctx, isl, {
          ground: C.known.fill, street: C.sea,
          fill: (j, pc) => T.rgba(C.app, LIGHT.known[0] + LIGHT.known[1] * ks(name + pc.d) + LIGHT.known[2] * ks(name + ":" + j)),
          lot: 1.4, lotAlpha: 0.9, district: HAIR, rim: C.known.rim,
        });
      }
      // ---- the two Apps islands: known, lit; territories -> stream districts -> one parcel per app
      const as = shadeOf(51);
      for (const key of ["generators", "frontends"]) {
        const I = W.apps[key];
        cadastre(ctx, { poly: I.poly, parcels: I.parcels, districts: I.streams.map((s) => s.poly), territories: I.territories.map((t) => t.poly) }, {
          ground: C.known.fill, street: C.sea,
          fill: (j, pc) => T.rgba(C.app, LIGHT.apps[0] + LIGHT.apps[1] * as(key + pc.s) + LIGHT.apps[2] * as(pc.id)),
          lot: 1.25, lotAlpha: 0.72, district: 2.4, territory: 4.2, rim: C.known.rim,
        });
      }
      toPx();
      const lotsC = [].concat(W.apps.generators.parcels.map((p) => p.c), W.apps.frontends.parcels.map((p) => p.c));
      bloom(ctx, lotsC, C.app, opt.bloom ?? LIGHT.bloom, 26, rect, res, 5);
      const knownC = [];
      for (const isl of Object.values(W.islands)) for (const pc of isl.parcels) knownC.push(centroid(pc.p));
      bloom(ctx, knownC, C.app, LIGHT.knownBloom, 18, rect, res, 6);
    } else {
      // unlit: the same cadastres in the detached terrain (the lights come on in S04)
      const us = shadeOf(61);
      for (const [name, isl] of Object.entries(W.islands)) {
        cadastre(ctx, isl, { ground: D.gap, street: D.gap, fill: terrain(D, lit, (pc, j) => 0.65 * us(name + pc.d) + 0.35 * us(name + ":" + j)),
          lot: 1.4, lotAlpha: TX.gaps, district: HAIR, rim: D.rim });
      }
      for (const key of ["generators", "frontends"]) {
        const I = W.apps[key];
        cadastre(ctx, { poly: I.poly, parcels: I.parcels, districts: I.streams.map((s) => s.poly), territories: I.territories.map((t) => t.poly) }, {
          ground: D.gap, street: D.gap, fill: terrain(D, lit, (pc) => 0.65 * us(key + pc.s) + 0.35 * us(pc.id)),
          lot: 1.25, lotAlpha: TX.gaps, district: 2.4, territory: 4.2, rim: D.rim });
      }
    }
    toPx();
    if (opt.dim) { ctx.fillStyle = T.rgba(C.sea, Math.max(0, Math.min(1, opt.dim))); ctx.fillRect(0, 0, rect.w * res, rect.h * res); }
  }

  // ---------------------------------------------------------------- parcels by id, lit or outlined (S11, S12, S15)
  const PARCELS = new Map(), DISTRICTS = new Map();
  for (const key of ["generators", "frontends"]) {
    for (const p of W.apps[key].parcels) PARCELS.set(p.id, Object.assign({ island: key }, p));
    for (const s of W.apps[key].streams) DISTRICTS.set(s.id, Object.assign({ island: key }, s));
  }
  for (const p of W.conn.parcels) PARCELS.set(p.id, Object.assign({ island: "conn" }, p));
  const parcel = (id) => PARCELS.get(id);
  const district = (id) => DISTRICTS.get(id);
  function parcels(ctx, rect, res, list, style = {}) {
    ctx.save(); ctx.setTransform(res, 0, 0, res, -rect.x * res, -rect.y * res);
    ctx.globalAlpha = style.alpha ?? 1; ctx.lineJoin = "round";
    for (const it of list) {
      const pc = typeof it === "string" ? PARCELS.get(it) : it;
      if (!pc) throw new Error(`R.parcels: unknown parcel ${it}`);
      path(ctx, pc.p || pc.poly);
      if (style.fill) { ctx.fillStyle = T.rgb(style.fill); ctx.fill(); }
      if (style.stroke) { ctx.lineWidth = style.width ?? HAIR; ctx.strokeStyle = T.rgb(style.stroke); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- SVG: bridges and ports (render.html)
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
  const quad = (a, c, b, n = 48) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
  const dOf = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
  const bridgeD = (b) => `M${b.a[0]},${b.a[1]} Q${b.c[0]},${b.c[1]} ${b.b[0]},${b.b[1]}`;
  function offset(pts, d) {
    return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] + (dy / L) * d, p[1] - (dx / L) * d]; });
  }
  // a known bridge: two rails (THEME.inkFaint at 60 %, 2 px) with flared ends over a deck of sea: quiet, never
  // brighter than the "?"
  const RAIL = { a: 0.6, w: 2 };
  function knownBridge(svg, b) {
    const pts = quad(b.a, b.c, b.b, 40), g = el("g", { "data-bridge": "known:" + b.id }, svg);
    const n = pts.length - 1;
    const tan = (i, j) => { const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
    const t0 = tan(0, 1), t1 = tan(n - 1, n);
    el("path", { d: dOf(pts), fill: "none", stroke: T.sea, "stroke-width": 13, "stroke-linecap": "butt" }, g);
    for (const side of [-1, 1]) {
      const r = offset(pts, side * 4.2), f = 7, o = 4.5;
      const s0 = [r[0][0] - t0[0] * f + (t0[1]) * side * o, r[0][1] - t0[1] * f - (t0[0]) * side * o];
      const s1 = [r[n][0] + t1[0] * f + (t1[1]) * side * o, r[n][1] + t1[1] * f - (t1[0]) * side * o];
      el("path", { d: dOf([s0, ...r, s1]), fill: "none", stroke: T.rgba(T.inkFaint, RAIL.a), "stroke-width": RAIL.w, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
    }
    return { g, pts };
  }
  // a needed bridge (S06): a link still missing, dashed in THEME.inUse at 55 % over a deck of sea
  const DASH = [11, 8];
  function dashes(L) {
    const n = Math.max(1, Math.round((L + DASH[1]) / (DASH[0] + DASH[1]))), k = (L + DASH[1]) / (n * (DASH[0] + DASH[1]));
    return `${(DASH[0] * k).toFixed(2)} ${(DASH[1] * k).toFixed(2)}`;
  }
  const plen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  function dashedLine(g, pts) {
    el("path", { d: dOf(pts), fill: "none", stroke: T.sea, "stroke-width": 10, "stroke-opacity": 0.7, "stroke-linecap": "round" }, g);
    el("path", { d: dOf(pts), fill: "none", stroke: T.inUse, "stroke-width": 7, "stroke-opacity": 0.08, "stroke-linecap": "round" }, g);
    el("path", { d: dOf(pts), fill: "none", stroke: T.inUse, "stroke-width": 3.2, "stroke-opacity": 0.55, "stroke-linecap": "round",
      "stroke-dasharray": dashes(plen(pts)) }, g);
  }
  function neededBridge(svg, b) {
    const pts = quad(b.a, b.c, b.b, 40), g = el("g", { "data-bridge": "needed:" + b.id }, svg);
    dashedLine(g, pts);
    return { g, pts };
  }
  // S06's Generators -> Front ends: straight through the "?", its middle span open around the glyph's ink box
  function neededGF(svg, b, ink) {
    const g = el("g", { "data-bridge": "needed:gf" }, svg);
    const ux = b.b[0] - b.a[0], uy = b.b[1] - b.a[1], L = Math.hypot(ux, uy), u = [ux / L, uy / L];
    const hx = (ink[2] - ink[0]) / 2, hy = (ink[3] - ink[1]) / 2, cx = (ink[0] + ink[2]) / 2, cy = (ink[1] + ink[3]) / 2;
    const t = Math.min(Math.abs(u[0]) > 1e-6 ? hx / Math.abs(u[0]) : 1e9, Math.abs(u[1]) > 1e-6 ? hy / Math.abs(u[1]) : 1e9) + 8;
    const s = (cx - b.a[0]) * u[0] + (cy - b.a[1]) * u[1];
    const at = (d) => [b.a[0] + u[0] * d, b.a[1] + u[1] * d];
    const segs = [[at(0), at(s - t)], [at(s + t), at(L)]];
    for (const seg of segs) dashedLine(g, seg);
    return { g, pts: segs };
  }
  /*
   * A bridge of light (round-2 S09's: halo, glow, body, white core, optional arrowhead) in THEME.inUse: a link
   * found in the logs. opt = {core: px (3.4), arrow: false, halo: 1}; halo and glow opacities x THEME.halo.
   */
  function lightBridge(svg, b, opt = {}) {
    const core = opt.core ?? 3.4, h = (opt.halo ?? 1) * T.halo, g = el("g", { "data-bridge": "light:" + b.id }, svg), d = bridgeD(b);
    el("path", { d, fill: "none", stroke: T.inUse, "stroke-width": 16, "stroke-opacity": 0.09 * h, "stroke-linecap": "round" }, g);
    el("path", { d, fill: "none", stroke: T.inUse, "stroke-width": 7, "stroke-opacity": 0.24 * h, "stroke-linecap": "round" }, g);
    el("path", { d, fill: "none", stroke: T.inUse, "stroke-width": core, "stroke-linecap": "round" }, g);
    el("path", { d, fill: "none", stroke: T.rgba(T.app, 0.9), "stroke-width": Math.max(1.2, core * 0.36), "stroke-linecap": "round" }, g);
    if (opt.arrow) {
      const t = 0.64, a = b.a, c = b.c, e = b.b;
      const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * e[0], y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * e[1];
      const tx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (e[0] - c[0]), ty = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (e[1] - c[1]), L = Math.hypot(tx, ty);
      const ux = tx / L, uy = ty / L, s = 9;
      el("path", { d: `M${x + ux * s},${y + uy * s} L${x - ux * s - uy * s * 0.8},${y - uy * s + ux * s * 0.8} L${x - ux * s * 0.45},${y - uy * s * 0.45} L${x - ux * s + uy * s * 0.8},${y - uy * s - ux * s * 0.8} Z`,
        fill: T.rgb(T.app), stroke: T.inUse, "stroke-width": 1.2, "stroke-linejoin": "round" }, g);
    }
    return { g, pts: quad(b.a, b.c, b.b, 48) };
  }
  /*
   * A port: a small quay of the pair's own ground and coast with an anchor (the chart symbol for a harbour); the
   * bridges stop on its rim. look: "known" (the common port, white light), "missing" (the second port before S09:
   * THEME.inUse, its quay dashed), "neutral" (no light, muted anchor: while S09's route plays), "bridged" (the
   * second port once built: THEME.inUse, solid).
   */
  function glowFill(svg, id, colour, a) {
    const root = svg.ownerSVGElement || svg;
    let defs = root.querySelector(":scope > defs");
    if (!defs) defs = el("defs", {}, root);
    if (!defs.querySelector("#" + id)) {
      const rg = el("radialGradient", { id, cx: "50%", cy: "50%", r: "50%" }, defs);
      el("stop", { offset: "0", "stop-color": T.rgb(colour), "stop-opacity": a }, rg);
      el("stop", { offset: "0.45", "stop-color": T.rgb(colour), "stop-opacity": a * 0.45 }, rg);
      el("stop", { offset: "1", "stop-color": T.rgb(colour), "stop-opacity": 0 }, rg);
    }
    return `url(#${id})`;
  }
  function anchor(g, x, y, s, ink) {
    const a = { fill: "none", stroke: ink, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
    el("circle", Object.assign({ cx: x, cy: y - 0.8 * s, r: 0.2 * s }, a), g);
    el("path", Object.assign({ d: `M${x},${y - 0.6 * s} L${x},${y + 0.92 * s}` }, a), g);
    el("path", Object.assign({ d: `M${x - 0.42 * s},${y - 0.36 * s} L${x + 0.42 * s},${y - 0.36 * s}` }, a), g);
    el("path", Object.assign({ d: `M${x - 0.78 * s},${y + 0.2 * s} Q${x - 0.72 * s},${y + 0.92 * s} ${x},${y + 0.92 * s}`
      + ` Q${x + 0.72 * s},${y + 0.92 * s} ${x + 0.78 * s},${y + 0.2 * s}` }, a), g);
    for (const k of [-1, 1]) {
      el("path", Object.assign({ d: `M${x + k * 0.98 * s},${y + 0.36 * s} L${x + k * 0.78 * s},${y + 0.2 * s} L${x + k * 0.58 * s},${y + 0.4 * s}` }, a), g);
    }
  }
  function port(svg, p, look = "known") {
    if (!["known", "missing", "neutral", "bridged"].includes(look)) throw new Error(`R.port: look ${look}`);
    const g = el("g", { "data-port": p.id, "data-look": look }, svg), [x, y] = p.at, r = p.r || 16;
    const use = look === "missing" || look === "bridged";
    if (look !== "neutral") el("circle", { cx: x, cy: y, r: r * 2.6, fill: glowFill(svg, use ? "pg-needed" : "pg-known", use ? T.inUse : T.app, use ? 0.16 : 0.12) }, g);
    el("circle", { cx: x, cy: y, r, fill: T.known.fill, stroke: use ? T.rgba(T.inUse, 0.8) : T.known.rim, "stroke-width": 2,
      "stroke-dasharray": look === "missing" ? `${(Math.PI * r / 6 * 0.6).toFixed(2)} ${(Math.PI * r / 6 * 0.4).toFixed(2)}` : "none" }, g);
    anchor(g, x, y + 0.5, r * 0.62, use ? T.rgba(T.inUse, 0.95) : look === "neutral" ? T.rgba(T.inkFaint, 0.7) : T.rgba(T.app, 0.82));
    return { g, pts: [p.at] };
  }

  // ---------------------------------------------------------------- labels (screen space, constant size)
  /*
   * WORLD.labels of one layer ("base": the city's names, the territories, the "?"; "s09": the route's) as elements
   * of world.css's classes, inside parent (a screen-space layer over the world). Returns Map<id, element>; each
   * element carries data-label = its id. The "?" is .w-qm. Place them with R.placeLabels once fonts are loaded.
   */
  function labels(parent, layer = "base") {
    const out = new Map();
    for (const L of W.labels) {
      if ((L.layer || "base") !== layer) continue;
      const d = document.createElement("div");
      d.className = "w-at " + L.cls; d.innerHTML = L.html; d.dataset.label = L.id;
      if (L.align) d.style.textAlign = L.align;
      d.__L = L;
      parent.appendChild(d);
      out.set(L.id, d);
    }
    return out;
  }
  // the ink box of a one-line label's glyphs, relative to its box (canvas metrics of the same font)
  function inkOf(d) {
    const cs = getComputedStyle(d), c = document.createElement("canvas").getContext("2d");
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = c.measureText(d.textContent), lh = d.offsetHeight;
    const base = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    return [-m.actualBoundingBoxLeft, base - m.actualBoundingBoxAscent, m.actualBoundingBoxRight, base + m.actualBoundingBoxDescent];
  }
  /*
   * Anchor labels for a camera (a name or {x, y, scale}): screen = (x, y) + scale * at, then the label's own anchor
   * (ax, ay of its box; the "?" by its ink, centred on the river). Sets el.__ink (stage px) on the "?".
   */
  function placeLabels(map, cam = "full") {
    const v = typeof cam === "string" ? camera(cam) : cam;
    for (const d of map.values()) {
      const L = d.__L;
      const sx = v.x + v.scale * L.at[0], sy = v.y + v.scale * L.at[1];
      const w = d.offsetWidth, h = d.offsetHeight;
      let x = sx - L.ax * w, y = sy - L.ay * h;
      if (L.id === "q") {
        const k = d.__inkRel || (d.__inkRel = inkOf(d));   // measured once (fonts loaded): a dolly re-places it per frame
        x = sx - (k[0] + k[2]) / 2; y = sy - (k[1] + k[3]) / 2;
        d.__ink = [x + k[0], y + k[1], x + k[2], y + k[3]];
      }
      d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  }

  // ---------------------------------------------------------------- freeze, motion, cameras
  /*
   * Freeze drawn canvases into images: a visible 2D canvas is re-produced on every commit in the harness's
   * Chromium; an <img> is rasterised once. Resolves once every image is decoded.
   */
  const FROZEN = new Map();
  function freeze(list) {
    return Promise.all(list.map((c) => new Promise((done) => {
      c.toBlob((blob) => {
        const img = new Image();
        img.className = c.className; img.style.cssText = c.style.cssText; img.id = c.id;
        if (!img.style.width) img.style.width = c.width + "px";
        if (!img.style.height) img.style.height = c.height + "px";
        img.decoding = "sync"; img.draggable = false;
        img.src = URL.createObjectURL(blob);
        img.decode().then(() => { c.replaceWith(img); FROZEN.set(c, img); done(img); });
      }, "image/png");
    })));
  }
  const fz = (x) => (Array.isArray(x) ? x.map(fz) : FROZEN.get(x) || x);
  /*
   * The motion grammar (round 2, one hand): mark 0.55 s power2.out · lens 0.7 s expo.out · slide 1.1 s expo.out ·
   * drop 0.9 s power3.in · lift 0.4-0.9 s power3.out · travel 0.8-1.0 s power2.inOut (y: back.inOut 1.1) · beam
   * 0.8-1.0 s power2.inOut · kindle 0.6 s expo.out · light 0.6-0.8 s power1.inOut · match 0.25 up / 0.6 hold /
   * 0.8 decay (the one red moment) · rise 0.7 s expo.out · dolly 1.8 s power3.inOut (the camera, alone)
   */
  const MOTION = { mark: "power2.out", lens: "expo.out", slide: "expo.out", drop: "power3.in", lift: "power3.out", travel: "power2.inOut",
    arc: "back.inOut(1.1)", beam: "power2.inOut", kindle: "expo.out", light: "power1.inOut", rise: "expo.out", dolly: "power3.inOut" };
  /*
   * Cameras: WORLD.cams[name] = {x, y, zoom}, the world point at the stage centre and the zoom. R.camera(name) =
   * the GSAP vars {x, y, scale} of the world layer (transform-origin 0 0): screen = (x, y) + scale * world.
   */
  function camera(name) {
    const c = W.cams && W.cams[name];
    if (!c) throw new Error(`unknown camera "${name}": WORLD.cams has ${Object.keys(W.cams || {}).join(", ")}`);
    return { x: 960 - c.x * c.zoom, y: 540 - c.y * c.zoom, scale: c.zoom };
  }
  function camRect(name, pad = 0) {
    const c = W.cams[name];
    if (!c) throw new Error(`unknown camera "${name}"`);
    return { x: c.x - 960 / c.zoom - pad, y: c.y - 540 / c.zoom - pad, w: 1920 / c.zoom + 2 * pad, h: 1080 / c.zoom + 2 * pad };
  }

  window.WorldRender = { map, parcels, parcel, district, bridgeD, knownBridge, neededBridge, neededGF, lightBridge, port,
    labels, placeLabels, camera, camRect, freeze, fz, MOTION, bloom, bloomCells, lights, sprite, land, cellFiles, contours,
    cadastre, glow, mulberry32, rgb, C, HAIR, TEXTURE_STREETS, ICON_AIR, quad, path, bb, area, inside, centroid };
})();
