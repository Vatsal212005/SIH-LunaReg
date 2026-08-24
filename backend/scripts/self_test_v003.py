
from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.robustness_v003 import (  # noqa: E402
    CROP_SIZE,
    REGIONS,
    build_center_stress_cases,
    build_region_pairs,
    regions_are_disjoint,
)


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="lunareg_v003_"))
    try:
        if not regions_are_disjoint():
            raise RuntimeError("Region definitions overlap.")

        yy, xx = np.indices((1500, 1500))
        source = ((xx * 0.09 + yy * 0.04) % 255).astype(np.uint8)
        for y in range(100, 1450, 170):
            for x in range(100, 1450, 190):
                cv2.circle(source, (x, y), 18 + ((x + y) % 20), 220, -1)
        reference = np.roll(source, shift=(5, -7), axis=(0, 1))

        src = tmp / "source.png"
        ref = tmp / "reference.png"
        cv2.imwrite(str(src), source)
        cv2.imwrite(str(ref), reference)

        regions = build_region_pairs(src, ref, tmp / "out")
        if len(regions) != 5:
            raise RuntimeError(f"Expected 5 regions, got {len(regions)}")

        for r in regions:
            image = cv2.imread(r["source"], cv2.IMREAD_GRAYSCALE)
            if image is None or image.shape != (CROP_SIZE, CROP_SIZE):
                raise RuntimeError(f"Bad crop for {r['name']}")

        center = next(r for r in regions if r["name"] == "center")
        stress = build_center_stress_cases(
            center["source"], center["reference"], tmp / "out"
        )
        if len(stress) != 3:
            raise RuntimeError(f"Expected 3 stress cases, got {len(stress)}")

        names = {s["name"] for s in stress}
        expected = {"scale_0p75", "rotation_p10deg", "illumination_gamma"}
        if names != expected:
            raise RuntimeError(f"Unexpected stress cases: {names}")

        print("V0.03 SELF-TEST PASSED")
        print("  5 spatially disjoint 480 x 480 regions")
        print("  3 controlled stress cases")
        print("  Learned model loaded: NO")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
