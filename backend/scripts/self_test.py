from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.registration import register_images  # noqa: E402


def make_lunar_texture(width=1200, height=850, seed=26166):
    rng = np.random.default_rng(seed)
    base = rng.normal(118, 24, (height, width)).astype(np.float32)
    base = cv2.GaussianBlur(base, (0, 0), 3.0)

    yy, xx = np.mgrid[0:height, 0:width]
    illumination = 35 * (xx / width) - 18 * (yy / height)
    base += illumination

    for _ in range(90):
        cx = int(rng.integers(20, width - 20))
        cy = int(rng.integers(20, height - 20))
        r = int(rng.integers(5, 55))
        rim = int(rng.integers(1, 4))
        cv2.circle(base, (cx, cy), r, float(rng.integers(65, 100)), -1)
        cv2.circle(base, (cx - max(1, r // 7), cy - max(1, r // 8)), r, float(rng.integers(45, 75)), -1)
        cv2.circle(base, (cx + max(1, r // 8), cy + max(1, r // 8)), r, float(rng.integers(145, 190)), rim)

    base += rng.normal(0, 7, base.shape)
    base = np.clip(base, 0, 255).astype(np.uint8)
    return cv2.cvtColor(base, cv2.COLOR_GRAY2BGR)


def main():
    out = BACKEND / "runs" / "self-test"
    out.mkdir(parents=True, exist_ok=True)
    src = make_lunar_texture()
    h, w = src.shape[:2]

    src_quad = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])
    dst_quad = np.float32([[55, 35], [w - 95, 58], [w - 35, h - 74], [82, h - 35]])
    H_true = cv2.getPerspectiveTransform(src_quad, dst_quad)
    ref = cv2.warpPerspective(src, H_true, (w, h))
    ref = cv2.convertScaleAbs(ref, alpha=0.86, beta=22)
    ref = cv2.GaussianBlur(ref, (3, 3), 0.5)

    source_path = out / "synthetic_source.jpg"
    reference_path = out / "synthetic_reference.jpg"
    cv2.imwrite(str(source_path), src)
    cv2.imwrite(str(reference_path), ref)

    result = register_images(source_path, reference_path, out / "registration")
    H_est = np.asarray(result["homography"], dtype=np.float64)
    H_est /= H_est[2, 2]
    H_true /= H_true[2, 2]

    probes = np.float32([
        [100, 100], [w / 2, 100], [w - 120, 120], [150, h / 2],
        [w / 2, h / 2], [w - 150, h / 2], [120, h - 120], [w / 2, h - 100], [w - 130, h - 130],
    ]).reshape(-1, 1, 2)
    true_pts = cv2.perspectiveTransform(probes, H_true).reshape(-1, 2)
    est_pts = cv2.perspectiveTransform(probes, H_est).reshape(-1, 2)
    known_rmse = float(np.sqrt(np.mean(np.sum((true_pts - est_pts) ** 2, axis=1))))

    summary = {
        "status": "PASS" if known_rmse < 3.0 and result["metrics"]["verified_inliers"] >= 20 else "FAIL",
        "known_transform_rmse_px": round(known_rmse, 4),
        "registration_metrics": result["metrics"],
    }
    (out / "self_test_result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    if summary["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
