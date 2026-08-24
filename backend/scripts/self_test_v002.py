\
from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.benchmark_v002 import build_working_pair, evaluate_correspondences  # noqa: E402


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="lunareg_v002_"))
    try:
        rng = np.random.default_rng(42)
        image = np.zeros((320, 320), dtype=np.uint8)
        for _ in range(90):
            x = int(rng.integers(15, 305))
            y = int(rng.integers(15, 305))
            r = int(rng.integers(2, 10))
            cv2.circle(image, (x, y), r, int(rng.integers(80, 255)), -1)

        H_true = np.array(
            [[1.0, 0.006, 7.0], [-0.004, 1.0, 5.0], [0.00001, -0.00002, 1.0]],
            dtype=np.float64,
        )
        ref = cv2.warpPerspective(image, H_true, (320, 320))
        src_path = tmp / "src.png"
        ref_path = tmp / "ref.png"
        cv2.imwrite(str(src_path), image)
        cv2.imwrite(str(ref_path), ref)

        work_src, work_ref, meta = build_working_pair(src_path, ref_path, tmp / "pair", 256)

        pts = rng.uniform(20, 236, size=(100, 2)).astype(np.float32)
        pts_ref = cv2.perspectiveTransform(
            pts.reshape(-1, 1, 2),
            np.array(
                [[1.0, 0.006, 5.6], [-0.004, 1.0, 4.0], [0.0000125, -0.000025, 1.0]],
                dtype=np.float64,
            ),
        ).reshape(-1, 2)
        pts_ref += rng.normal(0, 0.15, size=pts_ref.shape).astype(np.float32)

        outliers_src = rng.uniform(10, 246, size=(10, 2)).astype(np.float32)
        outliers_ref = rng.uniform(10, 246, size=(10, 2)).astype(np.float32)
        all_src = np.vstack([pts, outliers_src])
        all_ref = np.vstack([pts_ref, outliers_ref])

        result = evaluate_correspondences(
            method="SYNTHETIC_V002_SELF_TEST",
            source_path=work_src,
            reference_path=work_ref,
            src_pts=all_src,
            ref_pts=all_ref,
            confidences=np.ones(len(all_src), np.float32),
            output_dir=tmp / "result",
            inference_time_s=0.001,
            working_ground_scale_m_per_px=meta["working_ground_scale_m_per_px"],
        )

        if result["status"] != "SUCCESS":
            raise RuntimeError(f"Synthetic evaluation failed: {json.dumps(result, indent=2)}")
        if result["metrics"]["verified_inliers"] < 90:
            raise RuntimeError(f"Too few synthetic inliers: {result['metrics']['verified_inliers']}")
        if result["metrics"]["rmse_px"] > 0.5:
            raise RuntimeError(f"Synthetic RMSE too high: {result['metrics']['rmse_px']}")

        print("V0.02 SELF-TEST PASSED")
        print(f"  Verified inliers: {result['metrics']['verified_inliers']}")
        print(f"  RMSE: {result['metrics']['rmse_px']} px")
        print("  Learned models were NOT loaded during this self-test.")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
