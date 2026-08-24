from __future__ import annotations

import math
from typing import Iterable

import cv2
import numpy as np


def reprojection_errors(src_pts: np.ndarray, dst_pts: np.ndarray, homography: np.ndarray) -> np.ndarray:
    """Return per-point reprojection error in pixels."""
    projected = cv2.perspectiveTransform(src_pts.reshape(-1, 1, 2).astype(np.float32), homography).reshape(-1, 2)
    return np.linalg.norm(projected - dst_pts.reshape(-1, 2), axis=1)


def spatial_coverage(points: np.ndarray, image_shape: tuple[int, int], grid_size: int = 8) -> tuple[float, float]:
    """Return occupied-cell coverage and normalized spatial entropy."""
    if points.size == 0:
        return 0.0, 0.0

    height, width = image_shape
    counts = np.zeros((grid_size, grid_size), dtype=np.int32)
    pts = points.reshape(-1, 2)

    xs = np.clip((pts[:, 0] / max(width, 1) * grid_size).astype(int), 0, grid_size - 1)
    ys = np.clip((pts[:, 1] / max(height, 1) * grid_size).astype(int), 0, grid_size - 1)
    for x, y in zip(xs, ys):
        counts[y, x] += 1

    coverage = float(np.count_nonzero(counts) / counts.size)
    p = counts[counts > 0].astype(np.float64)
    p /= p.sum()
    entropy = float(-(p * np.log(p)).sum()) if len(p) else 0.0
    max_entropy = math.log(counts.size) if counts.size > 1 else 1.0
    normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0.0
    return coverage, float(normalized_entropy)


def summarize_metrics(
    errors: Iterable[float],
    proposed_matches: int,
    verified_inliers: int,
    inlier_source_points: np.ndarray,
    source_shape: tuple[int, int],
    processing_time_s: float,
) -> dict:
    values = np.asarray(list(errors), dtype=np.float64)
    if len(values):
        rmse = float(np.sqrt(np.mean(values ** 2)))
        median = float(np.median(values))
        p90 = float(np.percentile(values, 90))
    else:
        rmse = median = p90 = 0.0

    coverage, entropy = spatial_coverage(inlier_source_points, source_shape)
    ratio = float(verified_inliers / proposed_matches) if proposed_matches else 0.0

    return {
        "rmse_px": round(rmse, 4),
        "median_error_px": round(median, 4),
        "p90_error_px": round(p90, 4),
        "proposed_matches": int(proposed_matches),
        "verified_inliers": int(verified_inliers),
        "inlier_ratio": round(ratio, 4),
        "spatial_coverage": round(coverage, 4),
        "coverage_entropy": round(entropy, 4),
        "processing_time_s": round(float(processing_time_s), 4),
        "metric_basis": "homography_reprojection_residual",
    }
