from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.benchmark_v002 import build_working_pair, evaluate_correspondences
from app.core.learned_matchers_v002 import LearnedMatcherError, run_lightglue
from app.core.thermal_guard import ThermalSafetyError, query_nvidia_gpu, wait_until_safe

BASE_DIR = Path(__file__).resolve().parents[1]
RUNS_DIR = BASE_DIR / "runs"
PROCESSED = BASE_DIR / "data" / "processed"
CANONICAL = PROCESSED / "v0012_real_pair_001"
V002 = PROCESSED / "v002_benchmark_pair_001_eco"
V003 = PROCESSED / "v003_initial_pair001"

router = APIRouter(prefix="/v1/demo", tags=["hackathon-demo"])


def _json_if_exists(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


@router.get("/status")
def demo_status():
    source = CANONICAL / "source_ohrc_rectified_1m.png"
    reference = CANONICAL / "reference_lro_1m.png"
    v002 = _json_if_exists(V002 / "benchmark_summary.json")
    v003 = _json_if_exists(V003 / "robustness_summary.json")

    try:
        import torch
        cuda_ready = bool(torch.cuda.is_available())
    except Exception:
        cuda_ready = False

    gpu = query_nvidia_gpu()
    canonical_ready = source.exists() and reference.exists()
    v002_ready = bool(v002 and v002.get("results", {}).get("lightglue"))
    v003_ready = bool(v003 and v003.get("results"))
    ready = canonical_ready and v002_ready and v003_ready and cuda_ready

    return {
        "status": "ready" if ready else "incomplete",
        "version": "0.03-hackathon",
        "canonical_pair_ready": canonical_ready,
        "v002_ready": v002_ready,
        "v003_ready": v003_ready,
        "cuda_ready": cuda_ready,
        "gpu_temperature_c": gpu.temperature_c if gpu else None,
        "message": (
            "Canonical pair, V0.02 evidence, V0.03 robustness evidence and CUDA are ready."
            if ready
            else "One or more local demo prerequisites are missing; recorded frontend fallback remains available."
        ),
    }


@router.post("/lightglue")
def run_hackathon_lightglue():
    source = CANONICAL / "source_ohrc_rectified_1m.png"
    reference = CANONICAL / "reference_lro_1m.png"
    if not source.exists() or not reference.exists():
        raise HTTPException(
            status_code=409,
            detail="Canonical Pair 001 is missing. Run the V0.01.2 real-pair preparation first.",
        )

    run_id = f"demo-{uuid.uuid4().hex[:8]}"
    run_dir = RUNS_DIR / run_id
    working_dir = run_dir / "working"
    result_dir = run_dir / "lightglue"
    run_dir.mkdir(parents=True, exist_ok=False)

    try:
        src_work, ref_work, pair_meta = build_working_pair(
            source, reference, working_dir, 640
        )
        before = wait_until_safe(label="Hackathon LightGlue demo")
        match = run_lightglue(
            src_work,
            ref_work,
            max_keypoints=768,
            allow_cpu=False,
        )
        after = query_nvidia_gpu()
        result = evaluate_correspondences(
            method="SuperPoint + LightGlue",
            source_path=src_work,
            reference_path=ref_work,
            src_pts=match.source_points,
            ref_pts=match.reference_points,
            confidences=match.confidences,
            output_dir=result_dir,
            inference_time_s=match.inference_time_s,
            load_time_s=match.load_time_s,
            device=match.device,
            peak_gpu_memory_mb=match.peak_gpu_memory_mb,
            model_details=match.details,
            working_ground_scale_m_per_px=pair_meta["working_ground_scale_m_per_px"],
            gpu_before=before,
            gpu_after=after,
        )
    except ThermalSafetyError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    except LearnedMatcherError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Demo inference failed: {exc}") from exc

    payload = {
        "mode": "live",
        "run_id": run_id,
        "method": "SuperPoint + LightGlue",
        "status": result["status"],
        "metrics": result["metrics"],
        "pair": {
            "name": "Canonical Pair 001",
            "source": "Chandrayaan-2 OHRC",
            "reference": "LRO NAC",
            "canonical_grid": "1500 x 1500 @ 1 m/px",
            "working_grid": "640 x 640 eco",
        },
        "gpu": {
            "temperature_before_c": before.temperature_c if before else None,
            "temperature_after_c": after.temperature_c if after else None,
            "peak_allocated_memory_mb": match.peak_gpu_memory_mb,
        },
        "assets": {
            "source": f"/runs/{run_id}/working/source_640.png",
            "reference": f"/runs/{run_id}/working/reference_640.png",
            "matches_all": f"/runs/{run_id}/lightglue/matches_all.jpg",
            "matches_inliers": f"/runs/{run_id}/lightglue/matches_inliers.jpg",
            "overlay": f"/runs/{run_id}/lightglue/overlay.jpg",
        },
    }
    (run_dir / "demo_result.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
