/*
 * Scene runtime: the step protocol between one scene and the player.
 *
 * A scene builds one paused GSAP timeline with a label per step ("s0" = initial state)
 * and calls Scene.init(timeline, labels). Each click plays the timeline from the current
 * label to the next one; a long segment is a "continuous sequence" and runs on its own.
 *
 *   player -> scene  {deck, type:"cmd", cmd:"next"|"prev"|"toggle"|"start"|"end"}
 *                    | {deck, type:"cmd", cmd:"fps", on:true|false}   (the fps meter, key P in the player)
 *   scene  -> player {deck, type:"ready"} | {deck, type:"state", ...} | {deck, type:"edge", dir}
 *                    | {deck, type:"key", key}   (keys pressed while the scene has focus)
 *                    | {deck, type:"fps", live, seqs}   (only while the meter is on; see below)
 *
 * Opened on its own (double-click), a scene scales itself and answers the arrow keys.
 *
 * The fps meter (for the Teams test on the 57" monitor, deck/LEEME.txt): off unless the player turns it on, and then
 * nothing of it runs (no loop, no timer, no message). On, a requestAnimationFrame loop reads frame times only: it
 * never draws and never touches the timeline, so every pixel stays a function of timeline time. About every 500 ms it
 * posts {live, seqs}: live = frames per second since the last post; seqs = every continuous sequence (a segment of
 * >= 1.5 s, as qa/capture.py defines it) that ran from start to end while the meter was on, as
 * {step, from, steps, ms, frames, fps, p95}: ms = wall time without pauses, fps and p95 (ms) from the intervals
 * between frames, computed as capture.py's FPS_PROBE computes them. A segment cut short by a second click, or
 * already running when the meter came on, is not reported. Turned off, it posts what is still pending, then stops.
 */
(function () {
  const embedded = window.parent !== window;
  let tl = null;
  let steps = [];
  let i = 0;          // index of the label we are resting on (or leaving)
  let cur = null;     // tween currently playing a segment
  let target = 0;     // label index the running segment is heading to
  let meter = null;   // the fps meter while it is on: { raf, timer, frames, since, seg, done }

  function post(msg) {
    if (embedded) window.parent.postMessage(Object.assign({ deck: true }, msg), "*");
  }

  function report() {
    post({
      type: "state",
      step: cur ? target : i,
      steps: steps.length - 1,
      running: !!cur,
      paused: !!cur && cur.paused()
    });
  }

  // ---------------------------------------------------------------- fps meter
  const SEQ_MIN_S = 1.5;

  function meterFrame(ts) {
    if (!meter) return;
    meter.frames++;
    const g = meter.seg;
    if (g && g.pausedAt === null) {
      if (g.last !== null) g.deltas.push(ts - g.last);
      g.last = ts;
    }
    meter.raf = requestAnimationFrame(meterFrame);
  }

  function meterPost() {
    const now = performance.now();
    const live = Math.round(meter.frames * 1000 / Math.max(1, now - meter.since));
    meter.frames = 0;
    meter.since = now;
    post({ type: "fps", live, seqs: meter.done.splice(0) });
  }

  function meterSet(on) {
    if (on && !meter) {
      meter = { raf: 0, timer: 0, frames: 0, since: performance.now(), seg: null, done: [] };
      meter.raf = requestAnimationFrame(meterFrame);
      meter.timer = setInterval(meterPost, 500);
    } else if (!on && meter) {
      cancelAnimationFrame(meter.raf);
      clearInterval(meter.timer);
      if (meter.done.length) post({ type: "fps", live: null, seqs: meter.done });
      meter = null;
    }
  }

  // a segment from label `from` to label `to` starts playing
  function meterStart(from, to) {
    if (!meter) return;
    const len = tl.labels[steps[to]] - tl.labels[steps[from]];
    meter.seg = len >= SEQ_MIN_S ? { from, to, t0: performance.now(), paused: 0, pausedAt: null, last: null, deltas: [] } : null;
  }

  // the running segment reached its label (done = true) or was cut short (done = false: not reported)
  function meterEnd(done) {
    if (!meter || !meter.seg) return;
    const g = meter.seg;
    meter.seg = null;
    if (!done || !g.deltas.length) return;
    const d = g.deltas.slice().sort((a, b) => a - b);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    meter.done.push({
      step: g.to, from: g.from, steps: steps.length - 1,
      ms: Math.round(performance.now() - g.t0 - g.paused),
      frames: d.length,
      fps: Math.round(1000 / avg),
      p95: Math.round(d[Math.floor(d.length * 0.95)] || 0)
    });
  }

  function meterPause(paused) {
    const g = meter && meter.seg;
    if (!g) return;
    if (paused && g.pausedAt === null) g.pausedAt = performance.now();
    else if (!paused && g.pausedAt !== null) { g.paused += performance.now() - g.pausedAt; g.pausedAt = null; g.last = null; }
  }

  // ---------------------------------------------------------------- steps
  function settle(to) {
    if (cur) { cur.kill(); cur = null; meterEnd(false); }
    i = to;
    tl.seek(steps[to], false);
    report();
  }

  function next() {
    if (cur) { settle(target); return; }              // a second click finishes the segment at once
    if (i >= steps.length - 1) { post({ type: "edge", dir: "next" }); return; }
    target = i + 1;
    cur = tl.tweenFromTo(steps[i], steps[target], {
      onComplete() { cur = null; i = target; meterEnd(true); report(); }
    });
    meterStart(i, target);
    report();
  }

  function prev() {
    if (cur) { settle(i); return; }                   // abort the running segment back to where it began
    if (i <= 0) { post({ type: "edge", dir: "prev" }); return; }
    settle(i - 1);
  }

  function toggle() {
    if (!cur) return;
    cur.paused(!cur.paused());
    meterPause(cur.paused());
    report();
  }

  function run(cmd) {
    if (!tl) return;
    if (cmd === "next") next();
    else if (cmd === "prev") prev();
    else if (cmd === "toggle") toggle();
    else if (cmd === "start") settle(0);
    else if (cmd === "end") settle(steps.length - 1);
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || !d.deck || d.type !== "cmd") return;
    if (d.cmd === "fps") meterSet(!!d.on);
    else run(d.cmd);
  });

  document.addEventListener("keydown", (e) => {
    if (embedded) {
      post({ type: "key", key: e.key });
      e.preventDefault();
      return;
    }
    if (["ArrowRight", "PageDown", "ArrowDown", "Enter"].includes(e.key)) run("next");
    else if (["ArrowLeft", "PageUp", "ArrowUp"].includes(e.key)) run("prev");
    else if (e.key === " ") run("toggle");
    else return;
    e.preventDefault();
  });

  function fit() {
    if (embedded) return;
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.background = "var(--stage, #000)";   // the letterbox: theme.js's stage, else black
    document.body.style.transformOrigin = "0 0";
    document.body.style.transform =
      `translate(${(window.innerWidth - 1920 * s) / 2}px, ${(window.innerHeight - 1080 * s) / 2}px) scale(${s})`;
  }

  window.Scene = {
    init(timeline, labels) {
      tl = timeline;
      steps = labels;
      tl.pause();
      // Exposed for qa/capture.py, which seeks the timeline frame by frame.
      window.__scene = { tl, steps, ready: false };
      const atEnd = new URLSearchParams(location.search).get("at") === "end";
      settle(atEnd ? steps.length - 1 : 0);
      fit();
      window.addEventListener("resize", fit);
      document.fonts.ready.then(() => {
        window.__scene.ready = true;
        post({ type: "ready" });
      });
    }
  };
})();
