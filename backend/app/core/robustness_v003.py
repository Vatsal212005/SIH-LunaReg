
from __future__ import annotations

import gc
import json
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


class RobustnessError(RuntimeError):
    pass


CROP_SIZE = 480


@dataclass(frozen=True)
class RegionSpec:
    name: str
    x: int
    y: int
    size: int = CROP_SIZE


REGIONS = (
    RegionSpec("northwest", 30, 30),
    RegionSpec("northeast", 990, 30),
    RegionSpec("center", 510, 510),
    RegionSpec("southwest", 30, 990),
    RegionSpec("southeast", 990, 990),
)


def _read_gray(path: str | Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise RobustnessError(f"Could not read image: {path}")
    return image


def validate_canonical_pair(source_path: str | Path, reference_path: str | Path) -> tuple[np.ndarray, np.ndarray]:
    source = _read_gray(source_path)
    reference = _read_gray(reference_path)
    if source.shape != reference.shape:
        raise RobustnessError(
            f"Canonical pair dimensions differ: source={source.shape}, reference={reference.shape}"
        )
    if source.shape != (1500, 1500):
        raise RobustnessError(
            f"V0.03 Initial expects the frozen V0.01.2 pair at 1500 x 1500. Received {source.shape[::-1]}."
        )
    return source, reference


def regions_are_disjoint(regions=REGIONS) -> bool:
    boxes = []
    for r in regions:
        boxes.append((r.x, r.y, r.x + r.size, r.y + r.size, r.name))
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            overlap_x = max(a[0], b[0]) < min(a[2], b[2])
            overlap_y = max(a[1], b[1]) < min(a[3], b[3])
            if overlap_x and overlap_y:
                return False
    return True


def build_region_pairs(
    source_path: str | Path,
    reference_path: str | Path,
    output_dir: str | Path,
) -> list[dict]:
    source, reference = validate_canonical_pair(source_path, reference_path)
    if not regions_are_disjoint():
        raise RobustnessError("V0.03 region definitions overlap; aborting.")

    output_dir = Path(output_dir)
    region_root = output_dir / "regions"
    region_root.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    for region in REGIONS:
        x0, y0, s = region.x, region.y, region.size
        src_crop = source[y0:y0 + s, x0:x0 + s].copy()
        ref_crop = reference[y0:y0 + s, x0:x0 + s].copy()
        if src_crop.shape != (s, s) or ref_crop.shape != (s, s):
            raise RobustnessError(f"Region {region.name} fell outside the canonical pair.")

        folder = region_root / region.name
        folder.mkdir(parents=True, exist_ok=True)
        src_out = folder / "source.png"
        ref_out = folder / "reference.png"
        cv2.imwrite(str(src_out), src_crop)
        cv2.imwrite(str(ref_out), ref_crop)

        records.append({
            "name": region.name,
            "x": x0,
            "y": y0,
            "size": s,
            "source": str(src_out),
            "reference": str(ref_out),
            "ground_resolution_m_per_px": 1.0,
            "independence_note": (
                "Spatially disjoint subpair from Canonical Pair 001. "
                "It is not an independent acquisition."
            ),
        })

    (output_dir / "region_manifest.json").write_text(
        json.dumps(
            {
                "version": "0.03",
                "canonical_pair": "v0012_real_pair_001",
                "crop_size": CROP_SIZE,
                "regions_disjoint": True,
                "regions": records,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return records


def _warp_centered(image: np.ndarray, *, scale: float = 1.0, angle_deg: float = 0.0) -> np.ndarray:
    h, w = image.shape
    center = ((w - 1) / 2.0, (h - 1) / 2.0)
    M = cv2.getRotationMatrix2D(center, angle_deg, scale)
    return cv2.warpAffine(
        image,
        M,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )


def _gamma_contrast(image: np.ndarray, gamma: float = 0.60, contrast: float = 1.20) -> np.ndarray:
    normalized = image.astype(np.float32) / 255.0
    adjusted = np.power(np.clip(normalized, 0.0, 1.0), gamma)
    adjusted = (adjusted - 0.5) * contrast + 0.5
    return np.clip(adjusted * 255.0, 0, 255).astype(np.uint8)


def build_center_stress_cases(
    center_source_path: str | Path,
    center_reference_path: str | Path,
    output_dir: str | Path,
) -> list[dict]:
    source = _read_gray(center_source_path)
    reference = _read_gray(center_reference_path)
    if source.shape != (CROP_SIZE, CROP_SIZE) or reference.shape != source.shape:
        raise RobustnessError("Center subpair has unexpected dimensions.")

    output_dir = Path(output_dir)
    stress_root = output_dir / "stress"
    stress_root.mkdir(parents=True, exist_ok=True)

    specs = [
        {
            "name": "scale_0p75",
            "description": "Source scaled to 0.75x around image center; constant border.",
            "transform": lambda img: _warp_centered(img, scale=0.75, angle_deg=0.0),
            "parameters": {"scale": 0.75, "rotation_deg": 0.0},
            "claim_limit": "Controlled scale stress only; not a real sensor/GSD acquisition.",
        },
        {
            "name": "rotation_p10deg",
            "description": "Source rotated +10 degrees around image center.",
            "transform": lambda img: _warp_centered(img, scale=1.0, angle_deg=10.0),
            "parameters": {"scale": 1.0, "rotation_deg": 10.0},
            "claim_limit": "Controlled rotation/viewpoint proxy only.",
        },
        {
            "name": "illumination_gamma",
            "description": "Source gamma=0.60 and contrast=1.20 photometric stress.",
            "transform": lambda img: _gamma_contrast(img, gamma=0.60, contrast=1.20),
            "parameters": {"gamma": 0.60, "contrast": 1.20},
            "claim_limit": "Photometric stress proxy; it does not prove real Sun-angle invariance.",
        },
    ]

    records: list[dict] = []
    for spec in specs:
        folder = stress_root / spec["name"]
        folder.mkdir(parents=True, exist_ok=True)
        stressed = spec["transform"](source)
        src_out = folder / "source.png"
        ref_out = folder / "reference.png"
        cv2.imwrite(str(src_out), stressed)
        cv2.imwrite(str(ref_out), reference)
        records.append({
            "name": spec["name"],
            "description": spec["description"],
            "parameters": spec["parameters"],
            "claim_limit": spec["claim_limit"],
            "source": str(src_out),
            "reference": str(ref_out),
            "ground_resolution_m_per_px": 1.0,
        })

    (output_dir / "stress_manifest.json").write_text(
        json.dumps({"version": "0.03", "stress_cases": records}, indent=2),
        encoding="utf-8",
    )
    return records


class LightGlueEcoSession:
    """Load SuperPoint + LightGlue once, then reuse it across all V0.03 cases."""

    def __init__(self, *, max_keypoints: int = 512):
        try:
            import torch
        except ImportError as exc:
            raise RobustnessError("PyTorch is missing. V0.02 must be installed first.") from exc
        if not torch.cuda.is_available():
            raise RobustnessError(
                "CUDA is unavailable to PyTorch. V0.03 Initial refuses learned CPU inference."
            )
        try:
            from lightglue import LightGlue, SuperPoint
            from lightglue.utils import load_image, rbd
        except ImportError as exc:
            raise RobustnessError("LightGlue is missing. V0.02 must be installed first.") from exc

        self.torch = torch
        self.load_image = load_image
        self.rbd = rbd
        self.device = torch.device("cuda")
        self.max_keypoints = int(max_keypoints)

        started = time.perf_counter()
        self.extractor = SuperPoint(max_num_keypoints=self.max_keypoints).eval().to(self.device)
        self.matcher = LightGlue(
            features="superpoint",
            depth_confidence=0.85,
            width_confidence=0.90,
            filter_threshold=0.10,
            mp=True,
        ).eval().to(self.device)
        torch.cuda.synchronize(self.device)
        self.load_time_s = time.perf_counter() - started

    def match(self, source_path: str | Path, reference_path: str | Path) -> dict:
        torch = self.torch
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats(self.device)

        image0 = self.load_image(str(source_path)).to(self.device)
        image1 = self.load_image(str(reference_path)).to(self.device)

        started = time.perf_counter()
        with torch.inference_mode():
            feats0 = self.extractor.extract(image0, resize=None)
            feats1 = self.extractor.extract(image1, resize=None)
            matches01 = self.matcher({"image0": feats0, "image1": feats1})
            feats0, feats1, matches01 = [
                self.rbd(x) for x in (feats0, feats1, matches01)
            ]
            matches = matches01["matches"]
            points0 = feats0["keypoints"][matches[..., 0]]
            points1 = feats1["keypoints"][matches[..., 1]]
            scores = matches01.get("scores")
            if scores is None:
                scores = torch.ones((len(matches),), device=points0.device)

        torch.cuda.synchronize(self.device)
        inference_time_s = time.perf_counter() - started
        peak_mb = torch.cuda.max_memory_allocated(self.device) / (1024 ** 2)

        out = {
            "source_points": points0.detach().float().cpu().numpy().astype(np.float32),
            "reference_points": points1.detach().float().cpu().numpy().astype(np.float32),
            "confidences": scores.detach().float().cpu().numpy().astype(np.float32),
            "inference_time_s": float(inference_time_s),
            "peak_gpu_memory_mb": round(float(peak_mb), 2),
            "stop_layer": int(matches01.get("stop", 0)),
        }

        del image0, image1, feats0, feats1, matches01, matches, points0, points1, scores
        gc.collect()
        torch.cuda.empty_cache()
        return out

    def close(self) -> None:
        try:
            del self.extractor
            del self.matcher
        except Exception:
            pass
        gc.collect()
        self.torch.cuda.empty_cache()
