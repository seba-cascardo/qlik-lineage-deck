/*
 * Theme tokens of the night-map deck (deck/shared/world/theme.js). The ONLY file of the deck that may hold colour
 * literals: qa/lint_colors.py flags anywhere else a hex, rgb()/rgba(), an "r,g,b" string, an [r, g, b] under a
 * colour key, a CSS variable this file does not set (tokens.css's --aqua, --turq, --orange... do not follow
 * ?theme=), and a "lighter" blend. Load it first, in <head>, before world.js and before any scene script, so the
 * first paint already has the theme.
 *
 *   window.THEME    the theme chosen by ?theme=night|day (default night; an unknown name falls back to night)
 *   window.THEMES   both themes by name (tests, presenter)
 *   :root           CSS variables from THEME: --stage --paper --paper-ink --paper-ink-dim --paper-ink-faint --ink
 *                   --ink-dim --ink-faint --in-use --unused-apps --never-read --no-sign --review --key;
 *                   and <html data-theme="night|day">
 *   THEME.rgba(c, a), THEME.rgb(c)   c = "#RRGGBB", "r,g,b" or [r, g, b] (integers 0-255), a = a finite number
 *                   -> a CSS colour string; R.rgb is THEME.rgba. Anything else throws "theme.js: not a colour",
 *                   so a typo or a removed key is a page error, not a canvas that keeps its previous colour.
 *   THEME.channels(c) -> [r, g, b] numbers, same inputs and same errors: the colour for ImageData pixel maths.
 *                   A fade toward the stage is d[i] = d[i] * k + sr * (1 - k) with
 *                   const [sr, sg, sb] = THEME.channels(THEME.stage); a paper grain starts from
 *                   THEME.channels(THEME.paper). Never channel numbers written by hand (round-2 S09's #vig fade
 *                   wrote 6, 7, 7 and its paper 246; on day they paint the night onto the paper).
 *   THEME.icon      the icon on the stage (white on night, red on day); THEME.paperIcon the icon on paper (red on
 *                   both: S01-S03 are paper on night too). Both are absolute URLs, usable from any page.
 *
 * Derived colours are built from tokens, never written: a tint in CSS is
 * color-mix(in srgb, var(--in-use) 24%, transparent), a fainter paper ink (a rule, a header faded back) is
 * color-mix(in srgb, var(--paper-ink) N%, var(--paper)) or opacity; in JS, THEME.rgba(THEME.inUse, 0.24). A blend
 * of lights is THEME.blend ("lighter" on night, "multiply" on day), never a literal.
 *
 * Light and texture (Task 4, read by world.js; its header says what each scale does; round 2 = all 1):
 *   bloom      scale of the alpha of every bloom (R.bloom, R.bloomCells) of information light: in use, key, review
 *   halo       scale of the soft halo of those light sprites (R.lights)
 *   appLight   {bloom, halo}: the same two scales for light in THEME.app (the Apps island, the beacons): the
 *              estate's own atmosphere, kept at round 2's strength on night
 *   texture    {marks, shade, gaps, contours, topo}: scales of what is texture, not information; marks keep the
 *              field's mean brightness (the light they give up becomes an even lift of the ground)
 *   Both themes lower them so the land is calm at 720p / 0.9 Mbps and in-use light reads as light, not neon
 *   (gated by qa/test_legibility.py (b), (b2) and (f): <= 0.70 x round 2); the colour tokens stay round 2's /
 *   Task 2's.
 *
 * night = the approved round-2 look (design-demos/round2/2-benchmark-light/world.js, palette C) value for value,
 *         plus the semantic colours the talk needs.
 * day   = plan B: the same world on a paper-white stage. Every token re-stepped for a light ground: what is lit on
 *         night is inked on day (lights and bloom multiply instead of adding), the darker brand step of each
 *         night hue (Aqua -> Turquoise, Red Violet -> Aubergine), Fresh Orange darkened in OKLCH to 3:1 (hue kept,
 *         chroma reduced 14 % to stay inside sRGB).
 *
 * Semantics (docs/plans/2026-10-20-night-map-deck.md, Global Constraints):
 *   inUse       in use / a relationship found in the logs
 *   unusedApps  read only by apps nobody opens (never teal, orange or red)
 *   neverRead   written, never read
 *   noSign      no sign of use (recedes into the ground on both themes)
 *   review      to review: outlines and bars only, never "delete"
 *   key         brand and the single key moment, never "error"
 * Checked by qa/test_theme.py with qa/vendor/validate_palette.js (CVD separation and normal-vision floor, adjacent
 * pairs in the order inUse, unusedApps, neverRead, noSign, review; on night all pairs too, because on S11's land
 * every category touches every other) and an OKLab L gap >= 0.15 neverRead vs noSign.
 * Day trade-offs, measured (no day palette was found that avoids them while noSign recedes and the L gap holds):
 *   - all pairs fail on day (Turquoise vs neverRead, dE 5.4 protan): S11 on day labels each category on the land.
 *   - day noSign #B3B6B8 is 1.87:1 on the stage, below the brand's 3:1 for meaningful graphics: the "no sign of
 *     use" cells carry a direct label on day, and their step frame is checked at 720p.
 */
(function () {
  const night = {
    name: "night",
    stage: "#060707",                 // round-2 --stage
    paper: "#F4F5F5", paperInk: "#25282B",   // round-2 log sheet and its ink
    paperInkDim: "#4A4D4E", paperInkFaint: "#6A6E70",   // round-2 S09 --ink2, --ink3 (8.4:1 and 5.0:1 on the paper)
    ink: "#FFFFFF", inkDim: "#D9DCDD", inkFaint: "#AEB2B4",   // round-2 --white, --lab, --lab2
    // ---- the renderer's palette (round-2 world.js C, unchanged)
    sea: "#060707",
    rings: ["rgba(126,131,133,0.20)", "rgba(126,131,133,0.15)", "rgba(126,131,133,0.11)", "rgba(126,131,133,0.08)"],
    known: { fill: "#0E1011", rim: "#5A5E60", topo: "#25282A", channel: "#2A2D2E" },
    // ground: a container's field is rgb(base + v * span + tint[i]) truncated, v in [0, 1) seeded per container
    dark: { fill: "#0C0D0E", rim: "#2E3132", gap: "#060707", ground: { base: 17, span: 8, tint: [0, 2, 3] }, mark: "126,131,133" },
    lit: { fill: "#111314", rim: "#8A8F91", gap: "#060707", ground: { base: 22, span: 14, tint: [0, 2, 3] }, mark: "217,220,221" },
    app: "255,255,255",                // the light of an app, a connection beacon
    glow: { rgb: "120,128,132", alpha: 0.11 },   // the faint pool of light the estate sits in
    blend: "lighter",                  // lights and bloom add up on the dark sea
    bloom: 0.6,                        // scale of the bloom of information light: in use, key, review (round 2: 1)
    halo: 0.55,                        // scale of the soft halo of those light sprites (round 2: 1)
    appLight: { bloom: 1, halo: 1 },   // the same scales for THEME.app's white light, the estate's atmosphere: round 2
    // scales of what is texture, not information (world.js header; round 2: all 1)
    texture: { marks: 0.6, shade: 1, gaps: 0.8, contours: 0.7, topo: 0.7 },
    // ---- semantic colours
    inUse: "#00B0CA",                  // Aqua Blue
    unusedApps: "#9C2AA0",             // Red Violet (Vodafone secondary)
    neverRead: "#C8CBCD",              // light grey, lighter than round-2 S11's #A9ADAF so Aqua stays apart on all pairs
    noSign: "#5A5E60",                 // dim grey (round-2 S11 "no sign of use")
    review: "#EB9700",                 // Fresh Orange
    key: "#E60000",                    // Vodafone Red
    iconFile: "VF_Icon_RGB_WHITE.png",
    paperIconFile: "VF_Icon_RGB_RED.png",
  };

  const day = {
    name: "day",
    stage: "#F4F5F5",
    paper: "#FFFFFF", paperInk: "#25282B",   // a sheet on the stage is 1.09:1: it needs a rim or a shadow on day
    paperInkDim: "#4A4D4E", paperInkFaint: "#6A6E70",
    ink: "#25282B", inkDim: "#4A4D4E", inkFaint: "#6A6E70",
    sea: "#F4F5F5",
    rings: ["rgba(74,77,78,0.14)", "rgba(74,77,78,0.10)", "rgba(74,77,78,0.075)", "rgba(74,77,78,0.05)"],
    known: { fill: "#E9EBEC", rim: "#9A9EA0", topo: "#D3D6D7", channel: "#CCCFD0" },
    dark: { fill: "#EDEFEF", rim: "#CACDCE", gap: "#F4F5F5", ground: { base: 228, span: -8, tint: [0, 2, 3] }, mark: "126,131,133" },
    lit: { fill: "#E8EAEB", rim: "#7E8385", gap: "#F4F5F5", ground: { base: 226, span: -14, tint: [0, 2, 3] }, mark: "37,40,43" },
    app: "37,40,43",
    glow: { rgb: "255,255,255", alpha: 0.65 },
    blend: "multiply",                 // ink on paper: lights and bloom darken
    bloom: 0.35,                       // Task 2: 0.5
    halo: 0.55,
    appLight: { bloom: 0.35, halo: 0.55 },   // ink on paper: the app marks take the same scales as the rest
    texture: { marks: 0.6, shade: 1, gaps: 0.8, contours: 0.7, topo: 0.7 },
    inUse: "#007C92",                  // Turquoise: the darker brand step of Aqua
    unusedApps: "#5E2750",             // Aubergine: the darker brand step of Red Violet
    neverRead: "#6A6E70",
    noSign: "#B3B6B8",                 // 1.87:1 on the stage (see the header): labelled on the land on day
    review: "#C07B00",                 // Fresh Orange at OKLCH L 0.64, hue kept, chroma reduced to fit sRGB: 3.2:1
    key: "#E60000",
    iconFile: "VF_Icon_RGB_RED.png",
    paperIconFile: "VF_Icon_RGB_RED.png",
  };

  // ---------------------------------------------------------------- colour strings (the only place they are built)
  const notColour = (c) => new Error(`theme.js: not a colour: ${typeof c === "string" ? JSON.stringify(c) : Array.isArray(c) ? `[${c}]` : String(c)}`);
  const byte = (n) => Number.isInteger(n) && n >= 0 && n <= 255;
  // the strict parser behind every helper: [r, g, b] integers 0-255, a new array each call
  const channels = (c) => {
    let v = null;
    if (Array.isArray(c)) v = c.slice();
    else if (typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c)) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    else if (typeof c === "string" && /^\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*$/.test(c)) v = c.split(",").map(Number);
    if (!v || v.length !== 3 || !v.every(byte)) throw notColour(c);
    return v;
  };
  const rgba = (c, a) => {
    if (typeof a !== "number" || !Number.isFinite(a)) throw new Error(`theme.js: not an alpha: ${String(a)} (for ${String(c)})`);
    return `rgba(${channels(c).join(",")},${a})`;
  };
  const rgb = (c) => `rgb(${channels(c).join(",")})`;

  // the icons, as absolute URLs resolved from this file, so any page can use them wherever it lives. Loaded
  // without a src (inline, injected), from the page's own deck/ folder; outside deck/, null and a warning,
  // never a relative path (an <img> resolves it against the page, not against this file, and it 404s).
  const here = document.currentScript && document.currentScript.src;
  const logoBase = (() => {
    if (here) return new URL("../logo/", here).href;
    let page = "";
    try { page = String(location.href); } catch (e) { /* no location */ }
    const at = page.lastIndexOf("/deck/");
    if (at >= 0) return new URL("deck/shared/logo/", page.slice(0, at + 1)).href;
    console.warn(`theme.js: loaded without a src on ${page || "a page without a location"}, outside deck/: THEME.icon and THEME.paperIcon are null (load theme.js with <script src>)`);
    return null;
  })();
  const iconUrl = (file) => (logoBase ? new URL(file, logoBase).href : null);

  const THEMES = {};
  for (const t of [night, day]) {
    t.icon = iconUrl(t.iconFile);
    t.paperIcon = iconUrl(t.paperIconFile);
    Object.defineProperty(t, "rgba", { value: rgba });   // helpers, not tokens: kept out of JSON and Object.keys
    Object.defineProperty(t, "rgb", { value: rgb });
    Object.defineProperty(t, "channels", { value: channels });
    THEMES[t.name] = t;
  }

  let want = null;
  try { want = new URLSearchParams(location.search).get("theme"); } catch (e) { /* no location */ }
  const known = want !== null && Object.hasOwn(THEMES, want);   // hasOwn: ?theme=constructor must not pick a prototype key
  if (want && !known) console.warn(`theme.js: unknown ?theme=${want}, using night (known: ${Object.keys(THEMES).join(", ")})`);
  const T = known ? THEMES[want] : night;

  const root = document.documentElement;
  // the CSS variables theme.js sets; qa/lint_colors.py reads these keys as the variables a scene may use
  const vars = { "--stage": T.stage, "--paper": T.paper, "--paper-ink": T.paperInk, "--paper-ink-dim": T.paperInkDim,
    "--paper-ink-faint": T.paperInkFaint, "--ink": T.ink, "--ink-dim": T.inkDim,
    "--ink-faint": T.inkFaint, "--in-use": T.inUse, "--unused-apps": T.unusedApps, "--never-read": T.neverRead,
    "--no-sign": T.noSign, "--review": T.review, "--key": T.key };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = T.name;

  window.THEMES = THEMES;
  window.THEME = T;
})();
