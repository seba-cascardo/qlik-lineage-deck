"""The shared world of the night-map deck: deck/shared/world/data.js (window.LOGS, window.TRUTH, window.WORLD).

Usage (from the workshop root):
    python deck/shared/world/make_data.py [--src <kit data.js>] [--out <data.js>]

The city is the round-3 mockup A2 that Seba approved (2026-10-21, docs/superpowers/specs/2026-10-20-world-cadastre-
design.md), built by the mockup kit, not re-engineered here ("the short path"):
    python design-demos/round3-layout/kit/run.py A2-vertical      (builds, renders and checks the variant)
    python deck/shared/world/make_data.py                         (this script: the deck's data.js from it)
The kit reads the round-2 land from deck/shared/world/data_round2_frozen.js (pinned by land_source.sha256), never
from this script's output.

What this script adds to the kit's WORLD (and renames, so scenes address things by plain names):
  - ports "apps" -> "known" (north, the common port), "mouth" -> "missing" (south, the second port); bridge ends
    "port:apps" / "port:mouth" -> "port:known" / "port:missing"; the connections island "conn0" -> "conn"
  - conn = {poly, districts, parcels: [{id, d, p, c}]} (one island: the kit's islets[0])
  - bridges = {known: [B], needed: [B], gf: B}; B = {id, ends, a, c, b, len} (a quadratic a -> c -> b); known ids are
    the island names, needed ids "land" and "conn"; gf = S06's Generators -> Front ends crossing at the "?"
  - route = the kit's route + bridges (S09's traced route: ids db, store, load, gf) + fan (product links)
  - labels: {id, html, at, ax, ay, cls, home, edge?, layer: "base" | "s09"}
  - counts: generators / frontends by environment, apps 3,562, connections 203, files 123,860, containers 96 (asserted
    against foundation/truth.json)
  - icon_air {at, r0, r1}: where world.js erases the sea rings around the Vodafone icon (spec §6)
  - cams {full, land, conn, apps, stream, diary}, each {x, y, zoom}: the world point at the stage centre (960, 540)
    and the zoom; focus_stream = the stream district the stream camera frames (S16)
  - LOGS and TRUTH from foundation/, exactly as the round-2 builder wrote them (asserted equal to the frozen copy)
Writes only on change, atomically (scenes and captures may read data.js while it is rebuilt).
"""
import argparse
import json
import math
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
KIT_DATA = ROOT / "design-demos" / "round3-layout" / "variants" / "A2-vertical" / "data.js"
FROZEN = HERE / "data_round2_frozen.js"
OUT = HERE / "data.js"

STAGE_C = (960, 540)
REGION = (96, 182, 1824, 990)          # what the map may use at camera full (below the title block, above the foot)
DIARY = (1000, 182, 1824, 990)         # S08/S09: the city to the right, x 96-960 left for the log sheet
LAND_R2 = {"zoom": 1.53732, "centre_screen": (960, 636)}   # round-2 S11 framed the land's box centre there
CONN_ZOOM = 2.0                        # the connections island at 2x: the map's default res (2) stays sharp
# spec §6, icon air: no sea ring within r0 of the icon's centre (tokens.css .vf-icon: right 64, bottom 56, 72 px),
# fading back in by r1 (world units at camera full); world.js erases the rings there
ICON_AIR = {"at": [1820, 988], "r0": 64, "r1": 112}
STREAM_ZOOM = 3.5                      # one district with its neighbours; a scene at this camera mounts res >= 3.5


def read_js(path, key):
    s = path.read_text(encoding="utf-8")
    i = s.index(key)
    j = s.index("\n", i)
    return json.loads(s[i + len(key): j].strip().rstrip(";"))


def bbox(poly):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    return [min(xs), min(ys), max(xs), max(ys)]


def area(p):
    return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2


def inside(pt, poly):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        (xi, yi), (xj, yj) = poly[i], poly[j]
        if (yi > pt[1]) != (yj > pt[1]) and pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi + 1e-12) + xi:
            c = not c
        j = i
    return c


def fit(box, region, fill=1.0):
    """{x, y, zoom}: the box scaled by `fill` of the region's fit and centred on the region."""
    w, h = box[2] - box[0], box[3] - box[1]
    z = fill * min((region[2] - region[0]) / w, (region[3] - region[1]) / h)
    return centre_on(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), ((region[0] + region[2]) / 2, (region[1] + region[3]) / 2), z)


def centre_on(world_pt, screen_pt, z):
    """The camera that puts world_pt at screen_pt at zoom z."""
    return {"x": round(world_pt[0] - (screen_pt[0] - STAGE_C[0]) / z, 2),
            "y": round(world_pt[1] - (screen_pt[1] - STAGE_C[1]) / z, 2), "zoom": round(z, 5)}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(KIT_DATA), help="the kit's data.js (default: variants/A2-vertical)")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--no-icon-air", action="store_true", help="omit icon_air (the port gate: the round-3b frame)")
    a = ap.parse_args()
    src, out = pathlib.Path(a.src), pathlib.Path(a.out)
    K = read_js(src, "window.WORLD = ")
    ok = []

    # ---- renames: ports, the connections island
    port_id = {"apps": "known", "mouth": "missing"}
    assert [p["id"] for p in K["ports"]] == ["apps", "mouth"], K["ports"]

    def end(e):
        if isinstance(e, str) and e.startswith("port:"):
            return "port:" + port_id[e[5:]]
        return "conn" if e == "conn0" else e

    def bridge(b, bid):
        return {"id": bid, "ends": [end(e) for e in b["ends"]], "a": b["a"], "c": b["c"], "b": b["b"], "len": b["len"]}

    W = {"meta": {"source": "design-demos/round3-layout/variants/A2-vertical (Seba, 2026-10-21)", "title": K["meta"]["title"]}}
    for k in ("land_transform", "land", "sales_container", "sales_file", "river", "apps", "islands"):
        W[k] = K[k]
    assert len(K["conn"]["islets"]) == 1, "one Data connections island"
    W["conn"] = {"poly": K["conn"]["islets"][0], "districts": K["conn"]["districts"],
                 "parcels": [{"id": p["id"], "d": p["d"], "p": p["p"], "c": p["c"]} for p in K["conn"]["parcels"]]}
    W["ports"] = [{"id": port_id[p["id"]], "at": p["at"], "r": p["r"]} for p in K["ports"]]

    B = K["bridges"]
    W["bridges"] = {
        "known": [bridge(b, b["ends"][0]) for b in B["known"]],
        "needed": [bridge(b, "conn" if b["ends"][0] == "conn0" else b["ends"][0]) for b in B["needed"]],
        "gf": dict(bridge(B["needed_gf"], "gf"), q=B["needed_gf"]["q"], reach=B["needed_gf"]["reach"]),
    }
    route = {k: v for k, v in K["route"].items()}
    route["bridges"] = [bridge(b, b["id"]) for b in B["s09"]]
    route["fan"] = B["fan"]
    W["route"] = route

    labels = []
    for L in K["labels"]:
        L = dict(L)
        L["layer"] = L.pop("overlay", None) or "base"
        h = L.get("home")
        L["home"] = [end(x) for x in h] if isinstance(h, list) else end(h)
        labels.append(L)
    W["labels"] = labels
    W["island_ids"] = [end(k) for k in K["island_ids"]]

    # ---- counts, against foundation/truth.json
    truth = json.loads((ROOT / "foundation" / "truth.json").read_text(encoding="utf-8"))
    env = {"generators": {}, "frontends": {}}
    for k in env:
        for p in W["apps"][k]["parcels"]:
            env[k][p["e"]] = env[k].get(p["e"], 0) + 1
    gen_truth = {g["env"]: g["total"] for g in truth["generators"]["by_env"]}
    fe_truth = {e: truth["apps"]["by_env"][e] - gen_truth[e] for e in truth["environments"]}
    assert env["generators"] == gen_truth == K["counts"]["generators"], (env["generators"], gen_truth)
    assert env["frontends"] == fe_truth == K["counts"]["frontends"], (env["frontends"], fe_truth)
    n_apps = sum(env["generators"].values()) + sum(env["frontends"].values())
    assert n_apps == truth["apps"]["total"] == 3562
    assert len(W["conn"]["parcels"]) == truth["connections_onprem"]["total"] == 203
    files = sum(cl["files"] for ct in W["land"]["containers"] for cl in ct["cells"])
    assert files == truth["qvd_files"]["total_files"] == 123860, files
    n_cont = len(W["land"]["containers"])
    W["counts"] = {"generators": env["generators"], "frontends": env["frontends"], "apps": n_apps,
                   "connections": len(W["conn"]["parcels"]), "files": files, "containers": n_cont}
    ok.append(f"counts = truth.json: generators {env['generators']}, front ends {env['frontends']}, apps {n_apps:,}, "
              f"connections {len(W['conn']['parcels'])}, files {files:,} in {n_cont} containers")

    # ---- cameras
    lt = W["land_transform"]
    lb = bbox(W["land"]["poly"])
    land_c = (lt["pivot"][0] + lt["dx"], lt["pivot"][1] + lt["dy"])      # the pivot (round 2's box centre), moved
    cams = {"full": {"x": 960, "y": 540, "zoom": 1}}
    cams["land"] = centre_on(land_c, LAND_R2["centre_screen"], LAND_R2["zoom"] / lt["scale"])
    cb = bbox(W["conn"]["poly"])
    cams["conn"] = centre_on(((cb[0] + cb[2]) / 2, (cb[1] + cb[3]) / 2), ((REGION[0] + REGION[2]) / 2, (REGION[1] + REGION[3]) / 2), CONN_ZOOM)
    pg, pf = bbox(W["apps"]["generators"]["poly"]), bbox(W["apps"]["frontends"]["poly"])
    pair = [min(pg[0], pf[0]), min(pg[1], pf[1]), max(pg[2], pf[2]), max(pg[3], pf[3])]
    cams["apps"] = fit(pair, REGION, 0.98)
    # the stream camera: an On-prem front-end stream district of median area (S16)
    fe = sorted((area(s["poly"]), s["id"]) for s in W["apps"]["frontends"]["streams"] if s["env"] == "On-prem")
    focus = fe[len(fe) // 2][1]
    st = next(s for s in W["apps"]["frontends"]["streams"] if s["id"] == focus)
    sb = bbox(st["poly"])
    cams["stream"] = centre_on(((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2), ((REGION[0] + REGION[2]) / 2, (REGION[1] + REGION[3]) / 2), STREAM_ZOOM)
    # the diary camera: the whole city in the stage's right part (S08/S09's log sheet takes x 96-960)
    polys = [W["apps"]["generators"]["poly"], W["apps"]["frontends"]["poly"], W["conn"]["poly"], W["land"]["poly"]] + \
            [i["poly"] for i in W["islands"].values()]
    boxes = [bbox(p) for p in polys]
    city = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
    cams["diary"] = fit(city, DIARY, 1.0)
    W["cams"] = cams
    if not a.no_icon_air:
        W["icon_air"] = ICON_AIR
    W["focus_stream"] = focus
    assert inside((cams["stream"]["x"], cams["stream"]["y"]), st["poly"]), "the stream camera's centre is in its district"
    ok.append("cams: " + ", ".join(f"{k} ({v['x']}, {v['y']}) x{v['zoom']}" for k, v in cams.items())
              + f"; focus_stream {focus} ({st['n']} apps, {fe[len(fe) // 2][0]:,.0f} px2, the median of {len(fe)} On-prem "
              f"front-end districts); land box {[round(v, 1) for v in lb]}, city box {[round(v, 1) for v in city]}")

    # ---- LOGS and TRUTH from foundation/, as round 2 wrote them
    logs = {k: (ROOT / "foundation" / f"reload-log-{k}.txt").read_text(encoding="utf-8").splitlines()
            for k in ("generator", "frontend")}
    assert logs == read_js(FROZEN, "window.LOGS = ") and truth == read_js(FROZEN, "window.TRUTH = "), \
        "LOGS / TRUTH differ from the round-2 data.js (foundation/ changed?)"
    ok.append("LOGS and TRUTH = foundation/ = the round-2 data.js")

    js = ("/* Generated by deck/shared/world/make_data.py from the round-3 kit's A2-vertical: do not edit by hand. "
          "Illustrative layout, real counts. */\n"
          "window.LOGS = " + json.dumps(logs, ensure_ascii=False) + ";\n"
          "window.TRUTH = " + json.dumps(truth, ensure_ascii=False) + ";\n"
          "window.WORLD = " + json.dumps(W, separators=(",", ":")) + ";\n")
    if not out.exists() or out.read_bytes() != js.encode("utf-8"):
        tmp = out.with_suffix(".js.tmp")
        tmp.write_text(js, encoding="utf-8", newline="\n")
        os.replace(tmp, out)
        print(f"wrote {out} ({out.stat().st_size // 1024} KB) from {src}")
    else:
        print(f"unchanged {out} ({out.stat().st_size // 1024} KB)")
    for m in ok:
        print("assert ok · " + m)


if __name__ == "__main__":
    main()
