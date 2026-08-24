\
from __future__ import annotations

import gc
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


class LearnedMatcherError(RuntimeError):
    pass


@dataclass
class MatcherOutput:
    source_points: np.ndarray
    reference_points: np.ndarray
    confidences: np.ndarray
    load_time_s: float
    inference_time_s: float
    device: str
    peak_gpu_memory_mb: float | None
    details: dict


def _torch_device(allow_cpu: bool = False):
    try:
        import torch
    except ImportError as exc:
        raise LearnedMatcherError(
            "PyTorch is not installed. Run scripts\\INSTALL-V0.02.ps1 first."
        ) from exc

    if torch.cuda.is_available():
        return torch, torch.device("cuda")

    if not allow_cpu:
        raise LearnedMatcherError(
            "CUDA is not available to PyTorch. V0.02 refuses to run learned matchers "
            "on the CPU by default because prolonged CPU inference is not the low-compute path. "
            "Fix the CUDA PyTorch install, or pass --allow-cpu explicitly."
        )
    return torch, torch.device("cpu")


def _reset_cuda(torch, device) -> None:
    if device.type == "cuda":
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats(device)


def _peak_mb(torch, device) -> float | None:
    if device.type != "cuda":
        return None
    torch.cuda.synchronize(device)
    return round(torch.cuda.max_memory_allocated(device) / (1024 ** 2), 2)


def _cleanup(torch, device, *objects) -> None:
    for obj in objects:
        try:
            del obj
        except Exception:
            pass
    gc.collect()
    if device.type == "cuda":
        torch.cuda.empty_cache()


def run_lightglue(
    source_path: str | Path,
    reference_path: str | Path,
    *,
    max_keypoints: int = 768,
    allow_cpu: bool = False,
) -> MatcherOutput:
    torch, device = _torch_device(allow_cpu=allow_cpu)
    _reset_cuda(torch, device)

    try:
        from lightglue import LightGlue, SuperPoint
        from lightglue.utils import load_image, rbd
    except ImportError as exc:
        raise LearnedMatcherError(
            "LightGlue is not installed. Run scripts\\INSTALL-V0.02.ps1 first."
        ) from exc

    load_started = time.perf_counter()
    try:
        extractor = SuperPoint(max_num_keypoints=max_keypoints).eval().to(device)
        matcher = LightGlue(
            features="superpoint",
            depth_confidence=0.85,
            width_confidence=0.90,
            filter_threshold=0.10,
            mp=(device.type == "cuda"),
        ).eval().to(device)
    except Exception as exc:
        raise LearnedMatcherError(f"Could not initialize SuperPoint + LightGlue: {exc}") from exc
    load_time = time.perf_counter() - load_started

    image0 = load_image(str(source_path)).to(device)
    image1 = load_image(str(reference_path)).to(device)

    infer_started = time.perf_counter()
    try:
        with torch.inference_mode():
            feats0 = extractor.extract(image0, resize=None)
            feats1 = extractor.extract(image1, resize=None)
            matches01 = matcher({"image0": feats0, "image1": feats1})
            feats0, feats1, matches01 = [rbd(x) for x in (feats0, feats1, matches01)]

            matches = matches01["matches"]
            points0 = feats0["keypoints"][matches[..., 0]]
            points1 = feats1["keypoints"][matches[..., 1]]
            scores = matches01.get("scores")
            if scores is None:
                scores = torch.ones((len(matches),), device=points0.device)

        if device.type == "cuda":
            torch.cuda.synchronize(device)
        inference_time = time.perf_counter() - infer_started

        src = points0.detach().float().cpu().numpy().astype(np.float32)
        ref = points1.detach().float().cpu().numpy().astype(np.float32)
        conf = scores.detach().float().cpu().numpy().astype(np.float32)
        peak = _peak_mb(torch, device)
        stop_layer = int(matches01.get("stop", 0))
    except Exception as exc:
        _cleanup(torch, device, extractor, matcher, image0, image1)
        raise LearnedMatcherError(f"LightGlue inference failed: {exc}") from exc

    details = {
        "extractor": "SuperPoint",
        "matcher": "LightGlue",
        "max_keypoints": int(max_keypoints),
        "depth_confidence": 0.85,
        "width_confidence": 0.90,
        "filter_threshold": 0.10,
        "mixed_precision": bool(device.type == "cuda"),
        "compiled": False,
        "stop_layer": stop_layer,
    }
    _cleanup(torch, device, extractor, matcher, image0, image1, feats0, feats1, matches01)
    return MatcherOutput(src, ref, conf, load_time, inference_time, str(device), peak, details)


def _gray_tensor(torch, path: str | Path, device):
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise LearnedMatcherError(f"Could not read image: {path}")
    tensor = torch.from_numpy(image).to(device=device, dtype=torch.float32) / 255.0
    return tensor.unsqueeze(0).unsqueeze(0)


def run_loftr(
    source_path: str | Path,
    reference_path: str | Path,
    *,
    allow_cpu: bool = False,
    fp16: bool = True,
) -> MatcherOutput:
    torch, device = _torch_device(allow_cpu=allow_cpu)
    _reset_cuda(torch, device)

    try:
        from kornia.feature import LoFTR
    except ImportError as exc:
        raise LearnedMatcherError(
            "Kornia/LoFTR is not installed. Run scripts\\INSTALL-V0.02.ps1 first."
        ) from exc

    load_started = time.perf_counter()
    try:
        matcher = LoFTR(pretrained="outdoor").eval().to(device)
    except Exception as exc:
        raise LearnedMatcherError(f"Could not initialize LoFTR: {exc}") from exc
    load_time = time.perf_counter() - load_started

    image0 = _gray_tensor(torch, source_path, device)
    image1 = _gray_tensor(torch, reference_path, device)

    infer_started = time.perf_counter()
    try:
        with torch.inference_mode():
            if device.type == "cuda" and fp16:
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    out = matcher({"image0": image0, "image1": image1})
            else:
                out = matcher({"image0": image0, "image1": image1})

        if device.type == "cuda":
            torch.cuda.synchronize(device)
        inference_time = time.perf_counter() - infer_started

        src = out["keypoints0"].detach().float().cpu().numpy().astype(np.float32)
        ref = out["keypoints1"].detach().float().cpu().numpy().astype(np.float32)
        confidence = out.get("confidence")
        if confidence is None:
            confidence = out.get("matching_scores")
        if confidence is None:
            conf = np.ones((len(src),), dtype=np.float32)
        else:
            conf = confidence.detach().float().cpu().numpy().astype(np.float32).reshape(-1)
        peak = _peak_mb(torch, device)
    except Exception as exc:
        _cleanup(torch, device, matcher, image0, image1)
        if device.type == "cuda" and fp16:
            raise LearnedMatcherError(
                "LoFTR FP16 inference failed. V0.02 intentionally did NOT retry in FP32 "
                f"to avoid doubling compute/heat. Error: {exc}"
            ) from exc
        raise LearnedMatcherError(f"LoFTR inference failed: {exc}") from exc

    details = {
        "matcher": "Kornia LoFTR",
        "pretrained": "outdoor",
        "mixed_precision": bool(device.type == "cuda" and fp16),
        "automatic_fp32_retry": False,
    }
    _cleanup(torch, device, matcher, image0, image1, out)
    return MatcherOutput(src, ref, conf, load_time, inference_time, str(device), peak, details)
