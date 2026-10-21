/*
 * Our city as dots and lines (deck/scenes/s17_graph.js): the red graph S17 draws ON the city (Euler's move: keep only
 * the islands and the bridges), which is S18's start ("match" in the scene contract). Both scenes include this file,
 * so the graph is the same pixels in both. World units = stage px at camera full (S17 ends at full; S18 draws it in
 * an svg of 1920 x 1080 with viewBox "0 0 1920 1080").
 *
 *   - a dot on each island: the four Auditor islands where their names are (the name gives way to the dot), the
 *     Apps pair beside the river (where their bridges land, so the lines fan out like Euler's), Data connections
 *     and the containers land at their centroids
 *   - the two ports as small dots
 *   - a line along each bridge that exists now, drawn from its port outward: the four Auditor bridges and the Apps
 *     pair to the north port; the south port to the land, to Data connections and to the Apps pair; and three
 *     parallel curves across the river between Generators and Front ends (the product links: several bridges
 *     between the same two banks, as in Euler's city)
 * Every line is a polyline of N points (the bridge's own curve, sampled), so S18 can tween it point by point into
 * the speechmark network of S19 with a plain attribute tween (no callbacks: every frame a function of the time).
 * Colours from THEME only (THEME.key: the close's one red moment).
 *
 *   const G = S17_GRAPH.draw(svgOrGroup, THEME)   // -> {g, lines: [{id, el, from, to, pts, mid}], dots, ports}
 */
(function () {
  const NODES = {
    metadata: [695, 255], sessions: [1081, 255], reloads: [652, 418], telemetry: [1124, 418],
    generators: [700, 590], frontends: [1076, 590], conn: [550, 887], land: [1324, 867],
  };
  const PORTS = { "port:known": [888, 412], "port:missing": [851, 682] };
  // [id, from, to, segments]; the segments start at `from` (a port, or the middle of the river for the product links)
  const EDGES = [
    ["metadata", "port:known", "metadata", [["M", 888, 412], ["L", 879.6, 400.8], ["Q", 843.8, 352.7, 807.9, 304.7], ["L", 695, 255]]],
    ["sessions", "port:known", "sessions", [["M", 888, 412], ["L", 893.1, 399], ["Q", 914.1, 345.6, 935.1, 292.3], ["L", 1081, 255]]],
    ["reloads", "port:known", "reloads", [["M", 888, 412], ["L", 875, 417.3], ["Q", 852.5, 426.6, 829.9, 435.8], ["L", 652, 418]]],
    ["telemetry", "port:known", "telemetry", [["M", 888, 412], ["L", 901.8, 414.3], ["Q", 940.1, 420.6, 978.3, 426.9], ["L", 1124, 418]]],
    ["known-gen", "port:known", "generators", [["M", 888, 412], ["Q", 850, 500, 700, 590]]],
    ["known-fe", "port:known", "frontends", [["M", 888, 412], ["Q", 926, 500, 1076, 590]]],
    ["conn", "port:missing", "conn", [["M", 851, 682], ["L", 843.5, 693.8], ["Q", 813, 741.9, 782.5, 790], ["L", 550, 887]]],
    ["land", "port:missing", "land", [["M", 851, 682], ["L", 856.5, 694.9], ["Q", 874.6, 737.6, 892.7, 780.4], ["L", 1324, 867]]],
    ["missing-gen", "port:missing", "generators", [["M", 851, 682], ["Q", 800, 662, 700, 590]]],
    ["missing-fe", "port:missing", "frontends", [["M", 851, 682], ["Q", 902, 662, 1076, 590]]],
    ["gf-1", "generators", "frontends", [["M", 700, 590], ["Q", 888, 518, 1076, 590]], true],
    ["gf-2", "generators", "frontends", [["M", 700, 590], ["L", 1076, 590]], true],
    ["gf-3", "generators", "frontends", [["M", 700, 590], ["Q", 888, 662, 1076, 590]], true],
  ];
  const N = 40;                                  // points per line
  const R_DOT = 13, W_LINE = 4, R_PORT = 8;
  const NS = "http://www.w3.org/2000/svg";
  const at = (id) => NODES[id] || PORTS[id];

  // the segments as a dense polyline, then resampled to N points evenly by length
  function sample(segs) {
    const dense = [];
    let cur = null;
    for (const s of segs) {
      if (s[0] === "M") { cur = [s[1], s[2]]; dense.push(cur); continue; }
      if (s[0] === "L") {
        const b = [s[1], s[2]], n = Math.max(2, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / 2));
        for (let i = 1; i <= n; i++) dense.push([cur[0] + (b[0] - cur[0]) * i / n, cur[1] + (b[1] - cur[1]) * i / n]);
        cur = b;
      } else {   // Q cx cy x y
        const c = [s[1], s[2]], b = [s[3], s[4]];
        for (let i = 1; i <= 80; i++) {
          const t = i / 80, u = 1 - t;
          dense.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * b[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * b[1]]);
        }
        cur = b;
      }
    }
    return resample(dense, N);
  }
  function resample(pts, n) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = acc[acc.length - 1], out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = L * i / (n - 1);
      while (j < pts.length - 2 && acc[j + 1] < s) j++;
      const f = (s - acc[j]) / ((acc[j + 1] - acc[j]) || 1);
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
    }
    return out;
  }
  const dOf = (pts) => "M" + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" L");

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }

  function draw(parent, T) {
    const g = el("g", { "data-graph": "s17" }, parent);
    const gl = el("g", { "data-graph-part": "lines" }, g), gd = el("g", { "data-graph-part": "dots" }, g);
    const keyInk = T.rgb(T.key);
    const lines = EDGES.map(([id, from, to, segs, mid]) => {
      const pts = sample(segs);
      const e = el("path", { d: dOf(pts), fill: "none", stroke: keyInk, "stroke-width": W_LINE, "stroke-linecap": "round",
        "stroke-linejoin": "round", "data-edge": id }, gl);
      return { id, el: e, from, to, pts, mid: !!mid };
    });
    const ports = Object.entries(PORTS).map(([id, p]) => ({ id, at: p, r: R_PORT,
      el: el("circle", { cx: p[0], cy: p[1], r: R_PORT, fill: keyInk, "data-port": id }, gd) }));
    const dots = Object.entries(NODES).map(([id, p]) => ({ id, at: p, r: R_DOT,
      el: el("circle", { cx: p[0], cy: p[1], r: R_DOT, fill: keyInk, "data-node": id }, gd) }));
    return { g, lines, dots, ports };
  }

  window.S17_GRAPH = { NODES, PORTS, EDGES, N, R_DOT, W_LINE, R_PORT, at, draw, dOf, resample };
})();
