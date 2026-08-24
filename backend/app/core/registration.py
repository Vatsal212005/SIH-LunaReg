from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .metrics import reprojection_errors, summarize_metrics


class RegistrationError(RuntimeError):
    pass


@dataclass
class PreparedImage:
    original: np.ndarray
    gray: np.ndarray
    scale: float


def _load_image(path: str | Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise RegistrationError(f"Could not read image: {path}")
    return image


def _prepare(image: np.ndarray, max_dimension: int = 1800) -> PreparedImage:
    h, w = image.shape[:2]
    scale = min(1.0, max_dimension / max(h, w))
    if scale < 1.0:
        working = cv2.resize(image, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        working = image.copy()

    gray = cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    return PreparedImage(original=working, gray=gray, scale=scale)


def _extract_sift(gray: np.ndarray):
    sift = cv2.SIFT_create(
        nfeatures=9000,
        contrastThreshold=0.02,
        edgeThreshold=12,
        sigma=1.6,
    )
    keypoints, descriptors = sift.detectAndCompute(gray, None)
    if descriptors is None or len(keypoints) < 8:
        raise RegistrationError("Not enough SIFT features were found in one of the images.")
    return keypoints, descriptors


def _ratio_matches(desc_a: np.ndarray, desc_b: np.ndarray, ratio: float = 0.75):
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    pairs = matcher.knnMatch(desc_a, desc_b, k=2)
    good = []
    for pair in pairs:
        if len(pair) != 2:
            continue
        m, n = pair
        if m.distance < ratio * n.distance:
            good.append(m)
    return sorted(good, key=lambda m: m.distance)


def _draw_matches(src: np.ndarray, ref: np.ndarray, kp_src, kp_ref, matches, mask: np.ndarray) -> np.ndarray:
    inlier_matches = [m for m, keep in zip(matches, mask.ravel().tolist()) if keep]
    # Keep visualization readable while retaining wide spatial distribution.
    if len(inlier_matches) > 250:
        step = max(1, len(inlier_matches) // 250)
        inlier_matches = inlier_matches[::step][:250]
    return cv2.drawMatches(
        src,
        kp_src,
        ref,
        kp_ref,
        inlier_matches,
        None,
        matchColor=(90, 240, 190),
        singlePointColor=(160, 160, 160),
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS,
    )


def register_images(
    source_path: str | Path,
    reference_path: str | Path,
    output_dir: str | Path,
    *,
    max_dimension: int = 1800,
    ratio_threshold: float = 0.75,
    ransac_threshold_px: float = 3.0,
) -> dict:
    started = time.perf_counter()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    src = _prepare(_load_image(source_path), max_dimension=max_dimension)
    ref = _prepare(_load_image(reference_path), max_dimension=max_dimension)

    kp_src, desc_src = _extract_sift(src.gray)
    kp_ref, desc_ref = _extract_sift(ref.gray)
    matches = _ratio_matches(desc_src, desc_ref, ratio_threshold)

    if len(matches) < 8:
        raise RegistrationError(
            f"Only {len(matches)} ratio-test matches survived. V0.01 needs at least 8. "
            "Try a more strongly overlapping image pair."
        )

    src_pts = np.float32([kp_src[m.queryIdx].pt for m in matches])
    ref_pts = np.float32([kp_ref[m.trainIdx].pt for m in matches])

    H, inlier_mask = cv2.findHomography(
        src_pts,
        ref_pts,
        cv2.RANSAC,
        ransac_threshold_px,
        maxIters=5000,
        confidence=0.999,
    )
    if H is None or inlier_mask is None:
        raise RegistrationError("RANSAC could not estimate a stable homography.")

    keep = inlier_mask.ravel().astype(bool)
    inlier_src = src_pts[keep]
    inlier_ref = ref_pts[keep]
    if len(inlier_src) < 6:
        raise RegistrationError(f"Only {len(inlier_src)} geometric inliers remained after RANSAC.")

    errors = reprojection_errors(inlier_src, inlier_ref, H)
    registered = cv2.warpPerspective(src.original, H, (ref.original.shape[1], ref.original.shape[0]))

    overlay = cv2.addWeighted(ref.original, 0.5, registered, 0.5, 0)
    difference = cv2.absdiff(ref.original, registered)
    match_viz = _draw_matches(src.original, ref.original, kp_src, kp_ref, matches, inlier_mask)

    cv2.imwrite(str(output_dir / "registered.jpg"), registered)
    cv2.imwrite(str(output_dir / "overlay.jpg"), overlay)
    cv2.imwrite(str(output_dir / "difference.jpg"), difference)
    cv2.imwrite(str(output_dir / "matches.jpg"), match_viz)

    points = []
    for s, r, err in zip(inlier_src, inlier_ref, errors):
        points.append({
            "source": [round(float(s[0]), 3), round(float(s[1]), 3)],
            "reference": [round(float(r[0]), 3), round(float(r[1]), 3)],
            "residual_px": round(float(err), 4),
        })

    processing_time = time.perf_counter() - started
    metrics = summarize_metrics(
        errors,
        proposed_matches=len(matches),
        verified_inliers=len(inlier_src),
        inlier_source_points=inlier_src,
        source_shape=src.gray.shape[:2],
        processing_time_s=processing_time,
    )

    result = {
        "version": "0.0.1",
        "algorithm": "SIFT + Lowe ratio test + RANSAC homography",
        "homography": H.tolist(),
        "metrics": metrics,
        "matches": points,
        "working_resolution": {
            "source": [int(src.original.shape[1]), int(src.original.shape[0])],
            "reference": [int(ref.original.shape[1]), int(ref.original.shape[0])],
        },
        "outputs": {
            "registered": "registered.jpg",
            "overlay": "overlay.jpg",
            "difference": "difference.jpg",
            "matches": "matches.jpg",
        },
    }

    (output_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
