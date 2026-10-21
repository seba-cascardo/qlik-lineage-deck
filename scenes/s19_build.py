"""Builds deck/scenes/s19_data.js: the speechmark of S19 (End frame) and the network it is made of at s0.

Usage (from the workshop root):  python deck/scenes/s19_build.py

The speechmark is traced from the official icon (deck/shared/logo/VF_Icon_RGB_WHITE.png, the red speechmark on the
white disc), not redrawn: the 0.5 level of its red coverage (alpha x (1 - green)), simplified to 0.2 source px.
Coordinates are in units of the speechmark's own box: height 1000, origin top-left of the box.

The network (dots and lines, the talk's S17-S18 language) is seeded and deterministic:
  - contour nodes every ~CONTOUR_STEP units along the outline, consecutive ones joined (the outline reads at s0)
  - interior nodes by seeded dart throwing (min distance INTERIOR_GAP, kept INNER_MARGIN from the outline)
  - lines: the relative neighbourhood graph of all nodes (no crossings), only lines that stay inside the shape
  - bands: graph distance from the node nearest the tail tip, in NB bands; S19 swells band by band
Writes window.S19 = {w, h, path, nodes:[[x,y,r]], edges:[[a,b]], nodeBand:[], edgeBand:[], nb, origin, nc}
(nodes 0..nc-1 are the outline, in order from the tail tip).
"""
import json
import pathlib

import contourpy
import numpy as np
from matplotlib.path import Path as MPath
from PIL import Image
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import Delaunay

HERE = pathlib.Path(__file__).resolve().parent
ICON = HERE.parent / "shared" / "logo" / "VF_Icon_RGB_WHITE.png"
OUT = HERE / "s19_data.js"

H = 1000.0            # box height in units
CONTOUR_STEP = 58.0   # spacing of the outline nodes
INTERIOR_GAP = 98.0   # minimum distance between interior nodes
INNER_MARGIN = 52.0   # interior nodes keep this far from the outline
NB = 12               # swell bands
SEED = 19


def mulberry32(a):
    a &= 0xFFFFFFFF

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd


def rdp(pts, eps):
    """Ramer-Douglas-Peucker on an open polyline."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab)
    if n == 0:
        d = np.hypot(*(pts - a).T)
    else:
        d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        left = rdp(pts[: i + 1], eps)
        right = rdp(pts[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([a, b])


def trace():
    im = np.asarray(Image.open(ICON).convert("RGBA")).astype(float) / 255.0
    cover = im[:, :, 3] * (1.0 - im[:, :, 1])          # red coverage: opaque and without green
    gen = contourpy.contour_generator(z=cover)
    lines = gen.lines(0.5)
    poly = max(lines, key=len)                          # the speechmark; [x, y] in source px
    poly = poly[:-1] if np.allclose(poly[0], poly[-1]) else poly
    # simplify as two halves so RDP keeps the closed shape
    k = len(poly) // 2
    simp = np.vstack([rdp(poly[: k + 1], 0.2)[:-1], rdp(np.vstack([poly[k:], poly[:1]]), 0.2)[:-1]])
    x0, y0 = simp.min(axis=0)
    x1, y1 = simp.max(axis=0)
    s = H / (y1 - y0)
    pts = (simp - [x0, y0]) * s
    dense = (poly - [x0, y0]) * s
    return pts, dense, (x1 - x0) * s, s


def resample(dense, step):
    seg = np.diff(np.vstack([dense, dense[:1]]), axis=0)
    L = np.hypot(*seg.T)
    cum = np.concatenate([[0], np.cumsum(L)])
    total = cum[-1]
    n = int(round(total / step))
    out = []
    for t in np.linspace(0, total, n, endpoint=False):
        i = int(np.searchsorted(cum, t, side="right") - 1)
        f = (t - cum[i]) / L[i] if L[i] else 0
        out.append(dense[i] + seg[i] * f)
    return np.array(out)


def main():
    pts, dense, w, s = trace()
    shape = MPath(pts)

    # the tail tip: the outline point farthest up-right (min y - x)
    tip_i = int(np.argmin(dense[:, 1] - dense[:, 0] * 0.6))
    roll = np.roll(dense, -tip_i, axis=0)                 # start the outline nodes at the tip
    contour = resample(roll, CONTOUR_STEP)

    # interior: seeded dart throwing
    rnd = mulberry32(SEED)
    inner = []
    tries = 0
    while tries < 20000:
        tries += 1
        p = np.array([rnd() * w, rnd() * H])
        if not shape.contains_point(p, radius=-1e-9):
            continue
        if np.min(np.hypot(*(dense - p).T)) < INNER_MARGIN:
            continue
        if inner and np.min(np.hypot(*(np.array(inner) - p).T)) < INTERIOR_GAP:
            continue
        inner.append(p)
    inner = np.array(inner)
    nodes = np.vstack([contour, inner])
    nc = len(contour)

    # relative neighbourhood graph from the Delaunay edges
    tri = Delaunay(nodes)
    cand = set()
    for a, b, c in tri.simplices:
        for u, v in ((a, b), (b, c), (a, c)):
            cand.add((min(u, v), max(u, v)))
    edges = set()
    D = np.hypot(*(nodes[:, None, :] - nodes[None, :, :]).transpose(2, 0, 1))
    for u, v in cand:
        duv = D[u, v]
        m = np.maximum(D[u], D[v])
        m[[u, v]] = np.inf
        if np.all(m >= duv):
            edges.add((u, v))
    # the outline: consecutive contour nodes always joined
    for i in range(nc):
        u, v = i, (i + 1) % nc
        edges.add((min(u, v), max(u, v)))
    # keep only lines that stay inside the shape (the outline itself is a chord of the curve: kept)
    keep = []
    for u, v in sorted(edges):
        outline = u < nc and v < nc and (abs(u - v) == 1 or abs(u - v) == nc - 1)
        if outline:
            keep.append((u, v))
            continue
        t = np.linspace(0.08, 0.92, 12)[:, None]
        samples = nodes[u] * (1 - t) + nodes[v] * t
        if np.all(shape.contains_points(samples, radius=-1e-9)):
            keep.append((u, v))

    # graph distance from the tip (node 0)
    n = len(nodes)
    rows = [u for u, v in keep] + [v for u, v in keep]
    cols = [v for u, v in keep] + [u for u, v in keep]
    vals = [D[u, v] for u, v in keep] * 2
    G = csr_matrix((vals, (rows, cols)), shape=(n, n))
    dist = dijkstra(G, indices=0)
    assert np.all(np.isfinite(dist)), "the network is not connected"
    dn = dist / dist.max()
    nband = np.minimum(NB - 1, (dn * NB).astype(int))
    eband = [int(min(nband[u], nband[v])) for u, v in keep]

    # dot radius: outline small, interior medium, the best-connected interior nodes are hubs
    deg = np.zeros(n, int)
    for u, v in keep:
        deg[u] += 1
        deg[v] += 1
    radius = np.where(np.arange(n) < nc, 7.0, 9.5)
    hubs = sorted(range(nc, n), key=lambda i: (-deg[i], i))[:5]
    radius[hubs] = 15.0

    path = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    data = {
        "w": round(float(w), 1), "h": H, "path": path,
        "nodes": [[round(float(x), 1), round(float(y), 1), float(r)] for (x, y), r in zip(nodes, radius)],
        "edges": [list(map(int, e)) for e in keep],
        "nodeBand": [int(b) for b in nband], "edgeBand": eband, "nb": NB, "origin": 0, "nc": int(nc),
    }
    OUT.write_text("// generated by deck/scenes/s19_build.py from deck/shared/logo/VF_Icon_RGB_WHITE.png; do not edit\n"
                   "window.S19 = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8", newline="\n")
    print(f"outline points {len(pts)}, box {w:.1f} x {H:.0f} units (source scale {1 / s:.3f} px/unit), "
          f"nodes {n} ({nc} outline, {n - nc} interior), lines {len(keep)}, hubs {hubs}; wrote {OUT}")


if __name__ == "__main__":
    main()
