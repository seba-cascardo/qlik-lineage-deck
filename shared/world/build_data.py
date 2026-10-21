"""The deck's world builder (CLI kept from round 2): builds deck/shared/world/data.js.

Usage (from the workshop root):
    python deck/shared/world/build_data.py           = python deck/shared/world/make_data.py

Since 2026-10-21 the world is the round-3 city A2 (docs/superpowers/specs/2026-10-20-world-cadastre-design.md):
the mockup kit builds it (python design-demos/round3-layout/kit/run.py A2-vertical) and make_data.py turns the kit's
output into the deck's data.js. The round-2 builder is in docs/archive/round2-world/build_data.py.
"""
import pathlib
import runpy
import sys

if __name__ == "__main__":
    here = pathlib.Path(__file__).resolve().parent
    sys.argv = [str(here / "make_data.py")] + sys.argv[1:]
    runpy.run_path(str(here / "make_data.py"), run_name="__main__")
