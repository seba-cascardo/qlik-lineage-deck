/*
 * The shared world on a scene's stage (deck/shared/world/stage.js): window.WorldStage.
 * Fifteen scenes are built in parallel by different hands; this file makes them show the SAME world states.
 * Load after theme.js, data.js, world.js and GSAP (deck/shared/world/SCENE_BRIEF.md: include order and a skeleton).
 *
 *   const h = await WorldStage.mount(stageEl, opts)      // before Scene.init: the map is drawn once and frozen
 *
 * opts (all optional):
 *   cam       the camera the world starts at (default "full"; WORLD.cams: full, land, conn, apps, stream, diary)
 *   res       canvas px per world unit of the frozen map (default 2). Keep res >= the largest zoom the scene uses
 *             (full 1, apps 1.06, land 1.81, conn 2, diary 0.49 are fine at 2; stream 3.5 needs res 3.5 and a
 *             rect, e.g. {res: 3.5, rect: R.camRect("stream", 40)}, or the map turns soft)
 *   rect      the world rectangle the map covers (default the stage at camera full plus 96 on every side,
 *             {x: -96, y: -96, w: 2112, h: 1272}, so no map edge shows at land or diary; h.rect is the one used)
 *   detached  "dark" (default, S04-S10) | "lit" (the land and Data connections as neutral terrain)
 *   split     true: two frozen maps, the city unlit (known: false) under the city lit, so the scene can turn the
 *             known islands' lights on by fading layers.lit (S04); default false (one map, lit)
 *   labels    true (default): the city's labels (WORLD.labels, layer "base": island names, territories, the "?")
 *   state     a preset to start in (default "S04-end")
 *
 * Returns handles:
 *   world     the element to move: gsap.set(h.world, R.camera("land")) or tl.to(h.world, {...R.camera("land")})
 *   map       the frozen map <img> (lit); lit: the lit map when split (else the same img), unlit: the unlit one
 *   svg       the SVG overlay in world units (inside world): draw scene bridges here with R.lightBridge etc.
 *   labelsEl  the screen-space label layer; labels: Map<id, element> (ids: apps, generators, frontends, reloads,
 *             sessions, telemetry, metadata, connections, containers, terr-On-prem, terr-GCP, terr-AWS, q)
 *   q         the "?" element (.w-qm); q.__ink = its ink box (stage px) at the camera it was placed for
 *   veil      a screen-space veil of --stage over the world, under the labels (the "dim" states fade it)
 *   ports     {known, missing}: <g> of each port as the layers draw them (missing: the needed layer's quay)
 *   bridges   {known: [<g>], needed: [<g>], gf: <g>, bridged: [<g>]}
 *   owners    Map<stream district id, {g, dot, at}>: one mark per stream district (59); dot shown = owner known.
 *             Placed clear of the label plates, of every bridge end and port (36 world units) and, where the
 *             district allows, of the bridges' lines (14). World units: hide layers.owners at zoom > 1
 *   layers    {known, needed, bridged, owners} (<g> in svg) + lit (the lit map when split)
 *   setState(name)   presets of the scene contract, set instantly (gsap.set): "S04-end", "S06-end", "S09-end",
 *                    "dim" (adds the veil to the current state), "base" (map and labels only)
 *   camVars(name)    = R.camera(name); place(cam) re-anchors the labels for a camera (name or {x, y, scale});
 *   sync()           re-anchors them to the world's current transform: pass it as onUpdate of a dolly
 *   state()          the facts a test reads (layer opacities, label ids, the "?" ink box)
 * Labels are screen space (constant size): during a dolly either fade them out and place(cam) after, or add
 * onUpdate: h.sync to the camera tween. Fade layers, labels and the veil with autoAlpha, not opacity: a layer
 * left at opacity 0 but visible changes how Chromium draws every text run on the stage (measured, 2026-10-21).
 */
(function () {
  const R = window.WorldRender, W = window.WORLD, T = window.THEME;
  if (!R || !W || !T || !window.gsap) throw new Error("stage.js: load theme.js, data.js, world.js and gsap first");
  const NS = "http://www.w3.org/2000/svg";
  const OWNED = 0.5;          // S06: "owners: Ops, in progress", half the stream districts have their owner
  const STATES = {
    // S04's end: the known layer lit (Apps pair, the four Auditor islands incl. Metadata, quiet bridges, the
    // common port), the detached dark, the "?" in the river, every base label (territories x3 on the land)
    "S04-end": { known: 1, needed: 0, bridged: 0, owners: 0, q: 1, labels: 1, veil: 0, owned: 0 },
    // S06's end: + the needed links dashed to the second port and across the river at the "?", owner marks half
    "S06-end": { known: 1, needed: 1, bridged: 0, owners: 1, q: 1, labels: 1, veil: 0, owned: OWNED },
    // S09's end: the needed links are now solid bridges of light (from the logs), the second port built, the "?"
    // answered (gone); owner marks still half (S16-S17 complete them)
    "S09-end": { known: 1, needed: 0, bridged: 1, owners: 1, q: 0, labels: 1, veil: 0, owned: OWNED },
    "base": { known: 0, needed: 0, bridged: 0, owners: 0, q: 1, labels: 1, veil: 0, owned: 0 },
  };
  const DIM = 0.6;
  // the default map reaches PAD world units past the stage on every side: at land and diary the stage's edge (where
  // the sea's glow met the flat --stage in a straight step, review 2026-10-21) falls off screen
  const PAD = 96;

  function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
  function div(cls, parent, css) { const d = document.createElement("div"); d.className = cls; if (css) d.style.cssText = css; parent.appendChild(d); return d; }

  function drawMap(world, rect, res, opt, cls) {
    const cv = document.createElement("canvas");
    cv.className = cls;
    cv.width = Math.round(rect.w * res); cv.height = Math.round(rect.h * res);
    cv.style.cssText = `position:absolute;display:block;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
    world.appendChild(cv);
    R.map(cv.getContext("2d", { alpha: false }), rect, res, opt);
    return cv;
  }

  // a point inside a stream district for its owner mark: the centroid if it is well inside the district and clear of
  // every label plate (at camera full), else the nearest parcel centre that is
  function edgeDist(pt, poly) {
    let m = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L));
      m = Math.min(m, Math.hypot(a[0] + u * dx - pt[0], a[1] + u * dy - pt[1]));
    }
    return m;
  }
  // where an owner mark must not sit (review 2026-10-21: the gf crossing read as a link between two owner rings):
  // a disc of END_R around every bridge end and port (the ring's edge stays ~28 px clear), and LINE_R around the
  // bridges' lines (the overview bridges, S09's traced route and its fan), as far as the district allows
  const END_R = 36, LINE_R = 14;
  function keepOut() {
    const ends = W.ports.map((p) => p.at), lines = [];
    const add = (b) => {
      const c = b.c || b.q, pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        pts.push([u * u * b.a[0] + 2 * u * t * c[0] + t * t * b.b[0], u * u * b.a[1] + 2 * u * t * c[1] + t * t * b.b[1]]);
      }
      ends.push(b.a, b.b); lines.push(pts);
    };
    W.bridges.known.forEach(add); W.bridges.needed.forEach(add); add(W.bridges.gf);
    ((W.route && W.route.bridges) || []).forEach(add);
    ((W.route && W.route.fan) || []).forEach(add);
    return { ends, lines };
  }
  function lineDist(p, pts) {
    let m = 1e9;
    for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, edgeDist(p, [pts[i], pts[i + 1]]));
    return m;
  }
  function markAt(s, parcels, plates, K) {
    const c = R.centroid(s.poly);
    const unplated = (p) => !plates.some((b) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3]);
    const clearEnds = (p) => K.ends.every((e) => Math.hypot(p[0] - e[0], p[1] - e[1]) >= END_R);
    const clearLines = (p) => K.lines.every((l) => lineDist(p, l) >= LINE_R);
    const inner = (p, m) => R.inside(p, s.poly) && edgeDist(p, s.poly) >= m;
    const cand = [c].concat(parcels.map((q) => q.c).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1])));
    const tiers = [   // strictest first; a district too small for one tier falls to the next
      (p) => inner(p, 10) && unplated(p) && clearEnds(p) && clearLines(p),
      (p) => inner(p, 6) && unplated(p) && clearEnds(p),
      (p) => inner(p, 0) && unplated(p),
      (p) => unplated(p),
    ];
    for (const ok of tiers) { const p = cand.find(ok); if (p) return p; }
    return c;
  }

  async function mount(container, opts = {}) {
    const res = opts.res ?? 2, rect = opts.rect || { x: -PAD, y: -PAD, w: 1920 + 2 * PAD, h: 1080 + 2 * PAD };
    const cam = opts.cam || "full";
    const h = { container, cam, rect, res };
    // ---- the world layer: the frozen map(s) and the SVG overlay, moved together by the camera
    const world = div("ws-world", container, "position:absolute;left:0;top:0;width:1px;height:1px;transform-origin:0 0");
    h.world = world;
    const canv = [];
    let unlit = null;
    if (opts.split) unlit = drawMap(world, rect, res, { detached: opts.detached, known: false }, "ws-map ws-map-unlit");
    const lit = drawMap(world, rect, res, { detached: opts.detached, known: true }, "ws-map ws-map-lit");
    if (unlit) canv.push(unlit);
    canv.push(lit);
    const svg = svgEl("svg", { class: "ws-svg", width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, world);
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
    h.svg = svg;
    const layer = (name) => svgEl("g", { "data-layer": name }, svg);
    const L = { owners: layer("owners"), known: layer("known"), needed: layer("needed"), bridged: layer("bridged") };

    // ---- known: the Auditor's links to the common port (quiet rails), then the port on top
    h.bridges = { known: W.bridges.known.map((b) => R.knownBridge(L.known, b).g), needed: [], bridged: [], gf: null };
    h.ports = { known: R.port(L.known, W.ports.find((p) => p.id === "known"), "known").g, missing: null };
    // ---- needed (S06): dashed to the second port; the gf crossing is added once the "?" is placed (below)
    h.bridges.needed = W.bridges.needed.map((b) => R.neededBridge(L.needed, b).g);
    // ---- bridged (S09's end): the same links as bridges of light, the gf crossing whole, the second port built
    h.bridges.bridged = W.bridges.needed.map((b) => R.lightBridge(L.bridged, b).g);
    const gf = W.bridges.gf;
    h.bridges.bridged.push(R.lightBridge(L.bridged, { id: "gf", a: gf.a, c: gf.q, b: gf.b }).g);
    R.port(L.bridged, W.ports.find((p) => p.id === "missing"), "bridged");

    // ---- veil and labels (screen space)
    h.veil = div("ws-veil", container, "position:absolute;inset:0;background:var(--stage);opacity:0;visibility:hidden;pointer-events:none");
    h.labelsEl = div("ws-labels", container, "position:absolute;inset:0;pointer-events:none");
    h.labels = opts.labels === false ? new Map() : R.labels(h.labelsEl, "base");
    h.q = h.labels.get("q") || null;

    // ---- freeze, fonts, place
    const frozen = await R.freeze(canv);
    h.map = frozen[frozen.length - 1]; h.lit = h.map; h.unlit = unlit ? frozen[0] : null;
    await Promise.all(["400", "500", "700"].map((w) => document.fonts.load(`${w} 26px Vodafone`)));
    await document.fonts.ready;
    gsap.set(world, R.camera(cam));
    h.place = (c) => { R.placeLabels(h.labels, c); };
    h.place(cam);
    // the gf crossing leaves its middle span open around the "?" ink (world units: the ink box through the camera)
    {
      const v = R.camera(cam);
      const ink = h.q && h.q.__ink ? h.q.__ink.map((s, i) => (s - (i % 2 ? v.y : v.x)) / v.scale)
        : [gf.q[0] - 14, gf.q[1] - 26, gf.q[0] + 14, gf.q[1] + 26];
      h.bridges.gf = R.neededGF(L.needed, gf, ink).g;
      h.ports.missing = R.port(L.needed, W.ports.find((p) => p.id === "missing"), "missing").g;   // quays on top
    }
    // ---- owner marks: one per stream district, clear of the label plates as they sit at camera full
    const plates = [];
    for (const el of h.labels.values()) {
      const Lb = el.__L, w = el.offsetWidth, ht = el.offsetHeight, x = Lb.at[0] - Lb.ax * w, y = Lb.at[1] - Lb.ay * ht;
      plates.push([x - 10 - 12, y - 2 - 12, x + w + 10 + 12, y + ht + 2 + 12]);
    }
    h.owners = new Map();
    const rnd = R.mulberry32(606), order = [], K = keepOut();
    for (const key of ["generators", "frontends"]) {
      const I = W.apps[key];
      I.streams.forEach((s, si) => {
        const at = markAt(s, I.parcels.filter((p) => p.s === si), plates, K);
        const g = svgEl("g", { "data-owner": s.id }, L.owners);
        // quiet (review 2026-10-21): an empty ring in --ink-faint, the owner's dot in --ink-dim; S06's dashed
        // bridges stay the loudest marks on the Apps pair. World units: at zoom > 1 they grow (brief §3)
        svgEl("circle", { cx: at[0], cy: at[1], r: 7, fill: T.rgba(T.sea, 0.6), stroke: T.rgba(T.inkFaint, 0.85), "stroke-width": 1.5 }, g);
        const dot = svgEl("circle", { cx: at[0], cy: at[1], r: 3.5, fill: T.rgb(T.inkDim) }, g);
        h.owners.set(s.id, { g, dot, at });
        order.push([rnd(), s.id]);
      });
    }
    order.sort((a, b) => a[0] - b[0]);
    h.ownerOrder = order.map((o) => o[1]);   // the order owners are found in (seeded): S06 shows the first half
    h.layers = Object.assign({ lit: unlit ? h.lit : null }, L);
    h.camVars = (name) => R.camera(name);
    h.sync = () => {
      h.place({ x: gsap.getProperty(world, "x"), y: gsap.getProperty(world, "y"), scale: gsap.getProperty(world, "scaleX") });
    };
    h.setOwned = (frac) => {
      const n = Math.round(frac * h.ownerOrder.length);
      h.ownerOrder.forEach((id, i) => gsap.set(h.owners.get(id).dot, { autoAlpha: i < n ? 1 : 0 }));
    };
    h.setState = (name) => {
      if (name === "dim") { gsap.set(h.veil, { autoAlpha: DIM }); return h; }
      const s = STATES[name];
      if (!s) throw new Error(`WorldStage.setState: unknown state ${name} (${Object.keys(STATES).join(", ")}, dim)`);
      // autoAlpha: a layer at 0 is also visibility: hidden. Measured 2026-10-21: an SVG layer left at opacity 0
      // (the owner marks) changed how Chromium rasterises every text run on the stage (the port gate)
      for (const k of ["known", "needed", "bridged", "owners"]) gsap.set(L[k], { autoAlpha: s[k] });
      if (h.layers.lit) gsap.set(h.layers.lit, { autoAlpha: s.known });
      for (const [id, el] of h.labels) gsap.set(el, { autoAlpha: id === "q" ? s.q : s.labels });
      gsap.set(h.veil, { autoAlpha: s.veil });
      h.setOwned(s.owned);
      h.current = name;
      return h;
    };
    h.state = () => ({
      current: h.current, cam,
      layers: Object.fromEntries(Object.entries(L).map(([k, g]) => [k, +getComputedStyle(g).opacity])),
      labels: [...h.labels.keys()], q: h.q ? h.q.__ink : null,
      owned: [...h.owners.values()].filter((o) => +getComputedStyle(o.dot).opacity > 0).length, owners: h.owners.size,
    });
    h.setState(opts.state || "S04-end");
    return h;
  }

  window.WorldStage = { mount, STATES, DIM };
})();
