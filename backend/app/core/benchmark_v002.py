from __future__ import annotations

import csv
import json
import time
from pathlib import Path

import cv2
import numpy as np

from .metrics import reprojection_errors, summarize_metrics
from .thermal_guard import GPUState, ThermalSafetyError, query_nvidia_gpu, wait_until_safe


class BenchmarkError(RuntimeError):
    pass


ECO_SIZE = 640
BALANCED_SIZE = 768


def _load_gray(path: str | Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise BenchmarkError(f"Could not read image: {path}")
    return image


def build_working_pair(
    source_path: str | Path,
    reference_path: str | Path,
    output_dir: str | Path,
    size: int,
) -> tuple[Path, Path, dict]:
    source = _load_gray(source_path)
    reference = _load_gray(reference_path)
    if source.shape != reference.shape:
        raise BenchmarkError(
            f"Canonical pair dimensions differ: source={source.shape}, reference={reference.shape}"
        )

    h, w = source.shape
    if h != w:
        raise BenchmarkError(
            "V0.02 expects the frozen V0.01.2 canonical pair to be square. "
            f"Received {w} x {h}."
        )

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    src_work = cv2.resize(source, (size, size), interpolation=cv2.INTER_AREA)
    ref_work = cv2.resize(reference, (size, size), interpolation=cv2.INTER_AREA)

    src_path = output_dir / f"source_{size}.png"
    ref_path = output_dir / f"reference_{size}.png"
    cv2.imwrite(str(src_path), src_work)
    cv2.imwrite(str(ref_path), ref_work)

    scale = float(w / size)
    metadata = {
        "canonical_dimensions": [int(w), int(h)],
        "working_dimensions": [int(size), int(size)],
        "canonical_resolution_m_per_px": 1.0,
        "working_ground_scale_m_per_px": round(scale, 6),
        "note": (
            "The canonical V0.01.2 products remain untouched. All V0.02 methods operate "
            "on the same downsampled pair. Ground-equivalent residuals are scaled from "
            "working-grid pixels and are not independent absolute registration truth."
        ),
    }
    (output_dir / "working_pair.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    return src_path, ref_path, metadata


def sift_correspondences(source_path: str | Path, reference_path: str | Path):
    source = _load_gray(source_path)
    reference = _load_gray(reference_path)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    source = clahe.apply(source)
    reference = clahe.apply(reference)

    started = time.perf_counter()
    sift = cv2.SIFT_create(
        nfeatures=9000,
        contrastThreshold=0.02,
        edgeThreshold=12,
        sigma=1.6,
    )
    kp0, des0 = sift.detectAndCompute(source, None)
    kp1, des1 = sift.detectAndCompute(reference, None)
    if des0 is None or des1 is None:
        return (
            np.empty((0, 2), np.float32),
            np.empty((0, 2), np.float32),
            np.empty((0,), np.float32),
            time.perf_counter() - started,
        )

    matcher = cv2.BFMatcher(cv2.NORM_L2)
    pairs = matcher.knnMatch(des0, des1, k=2)
    good = []
    for pair in pairs:
        if len(pair) == 2 and pair[0].distance < 0.75 * pair[1].distance:
            good.append(pair[0])
    good.sort(key=lambda m: m.distance)

    src = np.float32([kp0[m.queryIdx].pt for m in good]) if good else np.empty((0, 2), np.float32)
    ref = np.float32([kp1[m.trainIdx].pt for m in good]) if good else np.empty((0, 2), np.float32)
    if good:
        d = np.asarray([m.distance for m in good], np.float32)
        conf = 1.0 / (1.0 + d)
    else:
        conf = np.empty((0,), np.float32)
    return src, ref, conf, time.perf_counter() - started


def _draw_correspondences(
    source: np.ndarray,
    reference: np.ndarray,
    src_pts: np.ndarray,
    ref_pts: np.ndarray,
    *,
    mask: np.ndarray | None = None,
    max_lines: int = 180,
) -> np.ndarray:
    left = cv2.cvtColor(source, cv2.COLOR_GRAY2BGR)
    right = cv2.cvtColor(reference, cv2.COLOR_GRAY2BGR)
    canvas = np.concatenate([left, right], axis=1)
    offset = left.shape[1]

    if mask is None:
        indices = np.arange(len(src_pts))
    else:
        indices = np.flatnonzero(mask.reshape(-1).astype(bool))

    if len(indices) > max_lines:
        step = max(1, len(indices) // max_lines)
        indices = indices[::step][:max_lines]

    for idx in indices:
        a = tuple(np.round(src_pts[idx]).astype(int))
        b0 = np.round(ref_pts[idx]).astype(int)
        b = (int(b0[0] + offset), int(b0[1]))
        cv2.circle(canvas, a, 2, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(canvas, b, 2, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.line(canvas, a, b, (210, 210, 210), 1, cv2.LINE_AA)
    return canvas


def _gpu_state_dict(state: GPUState | None) -> dict | None:
    if state is None:
        return None
    return {
        "temperature_c": state.temperature_c,
        "memory_used_mb": state.memory_used_mb,
        "memory_total_mb": state.memory_total_mb,
        "power_w": state.power_w,
    }


def evaluate_correspondences(
    *,
    method: str,
    source_path: str | Path,
    reference_path: str | Path,
    src_pts: np.ndarray,
    ref_pts: np.ndarray,
    confidences: np.ndarray | None,
    output_dir: str | Path,
    inference_time_s: float,
    load_time_s: float = 0.0,
    device: str = "cpu",
    peak_gpu_memory_mb: float | None = None,
    model_details: dict | None = None,
    working_ground_scale_m_per_px: float = 1.0,
    ransac_threshold_px: float = 3.0,
    gpu_before: GPUState | None = None,
    gpu_after: GPUState | None = None,
) -> dict:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    source = _load_gray(source_path)
    reference = _load_gray(reference_path)
    src_pts = np.asarray(src_pts, dtype=np.float32).reshape(-1, 2)
    ref_pts = np.asarray(ref_pts, dtype=np.float32).reshape(-1, 2)
    if confidences is None:
        confidences = np.ones((len(src_pts),), dtype=np.float32)
    confidences = np.asarray(confidences, dtype=np.float32).reshape(-1)

    all_viz = _draw_correspondences(source, reference, src_pts, ref_pts)
    cv2.imwrite(str(output_dir / "matches_all.jpg"), all_viz)

    result = {
        "version": "0.02",
        "method": method,
        "status": "FAILED",
        "failure_reason": None,
        "working_resolution": [int(source.shape[1]), int(source.shape[0])],
        "ransac_threshold_px": float(ransac_threshold_px),
        "device": device,
        "model_load_time_s": round(float(load_time_s), 4),
        "inference_time_s": round(float(inference_time_s), 4),
        "peak_gpu_memory_mb": peak_gpu_memory_mb,
        "gpu_before": _gpu_state_dict(gpu_before),
        "gpu_after": _gpu_state_dict(gpu_after),
        "model_details": model_details or {},
        "confidence_mean": round(float(confidences.mean()), 6) if len(confidences) else None,
        "metrics": {
            "proposed_matches": int(len(src_pts)),
            "verified_inliers": 0,
            "inlier_ratio": 0.0,
            "rmse_px": None,
            "median_error_px": None,
            "p90_error_px": None,
            "spatial_coverage": 0.0,
            "coverage_entropy": 0.0,
            "ground_equivalent_rmse_m": None,
            "metric_basis": "homography_reprojection_residual_on_downsampled_common_grid",
        },
        "outputs": {"matches_all": "matches_all.jpg"},
    }

    if len(src_pts) < 4:
        result["failure_reason"] = f"Only {len(src_pts)} proposed correspondences; homography needs at least 4."
        (output_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    H, mask = cv2.findHomography(
        src_pts,
        ref_pts,
        cv2.RANSAC,
        ransac_threshold_px,
        maxIters=5000,
        confidence=0.999,
    )
    if H is None or mask is None:
        result["failure_reason"] = "RANSAC could not estimate a homography."
        (output_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    keep = mask.ravel().astype(bool)
    inlier_src = src_pts[keep]
    inlier_ref = ref_pts[keep]
    errors = reprojection_errors(inlier_src, inlier_ref, H) if len(inlier_src) else np.empty((0,))

    metrics = summarize_metrics(
        errors,
        proposed_matches=len(src_pts),
        verified_inliers=len(inlier_src),
        inlier_source_points=inlier_src,
        source_shape=source.shape[:2],
        processing_time_s=inference_time_s,
    )
    metrics["ground_equivalent_rmse_m"] = (
        round(float(metrics["rmse_px"]) * working_ground_scale_m_per_px, 4)
        if metrics["rmse_px"] is not None
        else None
    )
    metrics["metric_basis"] = "homography_reprojection_residual_on_downsampled_common_grid"
    result["metrics"] = metrics
    result["homography"] = H.tolist()

    inlier_viz = _draw_correspondences(source, reference, src_pts, ref_pts, mask=keep)
    cv2.imwrite(str(output_dir / "matches_inliers.jpg"), inlier_viz)
    result["outputs"]["matches_inliers"] = "matches_inliers.jpg"

    registered = cv2.warpPerspective(
        cv2.cvtColor(source, cv2.COLOR_GRAY2BGR),
        H,
        (reference.shape[1], reference.shape[0]),
    )
    ref_bgr = cv2.cvtColor(reference, cv2.COLOR_GRAY2BGR)
    overlay = cv2.addWeighted(ref_bgr, 0.5, registered, 0.5, 0)
    cv2.imwrite(str(output_dir / "overlay.jpg"), overlay)
    result["outputs"]["overlay"] = "overlay.jpg"

    if len(inlier_src) >= 6:
        result["status"] = "SUCCESS"
    else:
        result["failure_reason"] = (
            f"Only {len(inlier_src)} geometric inliers remained after RANSAC; "
            "V0.02 requires at least 6."
        )

    (output_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def write_summary(output_dir: str | Path, summary: dict) -> None:
    output_dir = Path(output_dir)
    (output_dir / "benchmark_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    fields = [
        "method", "status", "proposed_matches", "verified_inliers", "inlier_ratio",
        "rmse_px", "median_error_px", "p90_error_px", "spatial_coverage",
        "coverage_entropy", "ground_equivalent_rmse_m", "model_load_time_s",
        "inference_time_s", "peak_gpu_memory_mb", "device",
    ]
    with (output_dir / "benchmark.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for method, result in summary["results"].items():
            m = result.get("metrics", {})
            writer.writerow({
                "method": method,
                "status": result.get("status"),
                "proposed_matches": m.get("proposed_matches"),
                "verified_inliers": m.get("verified_inliers"),
                "inlier_ratio": m.get("inlier_ratio"),
                "rmse_px": m.get("rmse_px"),
                "median_error_px": m.get("median_error_px"),
                "p90_error_px": m.get("p90_error_px"),
                "spatial_coverage": m.get("spatial_coverage"),
                "coverage_entropy": m.get("coverage_entropy"),
                "ground_equivalent_rmse_m": m.get("ground_equivalent_rmse_m"),
                "model_load_time_s": result.get("model_load_time_s"),
                "inference_time_s": result.get("inference_time_s"),
                "peak_gpu_memory_mb": result.get("peak_gpu_memory_mb"),
                "device": result.get("device"),
            })
