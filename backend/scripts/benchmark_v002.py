\
from __future__ import annotations

import argparse
import gc
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.benchmark_v002 import (  # noqa: E402
    BALANCED_SIZE,
    ECO_SIZE,
    BenchmarkError,
    build_working_pair,
    evaluate_correspondences,
    sift_correspondences,
    write_summary,
)
from app.core.learned_matchers_v002 import (  # noqa: E402
    LearnedMatcherError,
    run_lightglue,
    run_loftr,
)
from app.core.thermal_guard import (  # noqa: E402
    ThermalSafetyError,
    query_nvidia_gpu,
    wait_until_safe,
)


def parse_args():
    parser = argparse.ArgumentParser(description="LunaReg V0.02 low-compute learned matcher benchmark")
    parser.add_argument(
        "--mode",
        choices=("eco", "balanced"),
        default="eco",
        help="eco=640 px / 768 LightGlue keypoints; balanced=768 px / 1024 keypoints",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        choices=("sift", "lightglue", "loftr"),
        default=["sift", "lightglue", "loftr"],
    )
    parser.add_argument("--allow-cpu", action="store_true")
    parser.add_argument("--loftr-fp32", action="store_true")
    return parser.parse_args()


def model_error_result(method: str, reason: str) -> dict:
    return {
        "version": "0.02",
        "method": method,
        "status": "MODEL_ERROR",
        "failure_reason": reason,
        "metrics": {
            "proposed_matches": 0,
            "verified_inliers": 0,
            "inlier_ratio": 0.0,
            "rmse_px": None,
            "median_error_px": None,
            "p90_error_px": None,
            "spatial_coverage": 0.0,
            "coverage_entropy": 0.0,
            "ground_equivalent_rmse_m": None,
        },
    }


def main() -> int:
    args = parse_args()
    size = ECO_SIZE if args.mode == "eco" else BALANCED_SIZE
    keypoints = 768 if args.mode == "eco" else 1024

    canonical = BACKEND / "data" / "processed" / "v0012_real_pair_001"
    source = canonical / "source_ohrc_rectified_1m.png"
    reference = canonical / "reference_lro_1m.png"
    if not source.exists() or not reference.exists():
        print("V0.02 cannot find the frozen V0.01.2 canonical pair.")
        print(f"Expected: {source}")
        print(f"          {reference}")
        print("Run TEST-REAL-PAIR-V0.01.2.ps1 once before V0.02.")
        return 2

    output = BACKEND / "data" / "processed" / f"v002_benchmark_pair_001_{args.mode}"
    output.mkdir(parents=True, exist_ok=True)

    print("")
    print("======================================================")
    print(" LunaReg V0.02 - LOW-COMPUTE LEARNED MATCHER BENCHMARK")
    print("======================================================")
    print(f"Mode: {args.mode}")
    print(f"Working grid: {size} x {size}")
    print(f"Models: {', '.join(args.models)}")
    print("Training: NONE")
    print("Warm-up loops: NONE")
    print("Parallel GPU models: NONE")
    print("")

    try:
        src_work, ref_work, pair_meta = build_working_pair(source, reference, output, size)
    except BenchmarkError as exc:
        print(f"PAIR PREP FAILED: {exc}")
        return 2

    print("[1] Frozen canonical pair preserved")
    print(f"    V0.01.2: 1500 x 1500 @ 1 m/px")
    print(f"    V0.02 working copy: {size} x {size}")
    print(f"    Ground scale per working pixel: {pair_meta['working_ground_scale_m_per_px']:.4f} m")
    print("")

    # Preserve results from earlier single-model eco runs so the user can benchmark
    # LightGlue and LoFTR separately with a cooling break between them.
    existing_results: dict[str, dict] = {}
    existing_summary_path = output / "benchmark_summary.json"
    if existing_summary_path.exists():
        try:
            existing_summary = json.loads(existing_summary_path.read_text(encoding="utf-8"))
            if existing_summary.get("profile") == args.mode:
                existing_results = dict(existing_summary.get("results", {}))
        except Exception:
            existing_results = {}

    results: dict[str, dict] = existing_results

    if "sift" in args.models:
        print("[2] SIFT comparable low-resolution baseline (CPU)")
        src_pts, ref_pts, conf, runtime = sift_correspondences(src_work, ref_work)
        result = evaluate_correspondences(
            method="SIFT_V0.01_PARAMETERS",
            source_path=src_work,
            reference_path=ref_work,
            src_pts=src_pts,
            ref_pts=ref_pts,
            confidences=conf,
            output_dir=output / "sift",
            inference_time_s=runtime,
            working_ground_scale_m_per_px=pair_meta["working_ground_scale_m_per_px"],
        )
        results["sift"] = result
        print(
            f"    {result['status']}: {result['metrics']['proposed_matches']} proposed, "
            f"{result['metrics']['verified_inliers']} inliers"
        )
        print("")

    learned_order = [m for m in ("lightglue", "loftr") if m in args.models]
    for idx, method in enumerate(learned_order, start=1):
        label = "SuperPoint + LightGlue" if method == "lightglue" else "LoFTR"
        print(f"[GPU {idx}/{len(learned_order)}] {label}")

        try:
            before = wait_until_safe(label=label)
        except ThermalSafetyError as exc:
            print(f"    THERMAL STOP: {exc}")
            results[method] = model_error_result(method, str(exc))
            break

        if before:
            print(
                f"    Start temp: {before.temperature_c:.0f} C | "
                f"VRAM: {before.memory_used_mb:.0f}/{before.memory_total_mb:.0f} MB"
            )

        try:
            if method == "lightglue":
                out = run_lightglue(
                    src_work,
                    ref_work,
                    max_keypoints=keypoints,
                    allow_cpu=args.allow_cpu,
                )
            else:
                out = run_loftr(
                    src_work,
                    ref_work,
                    allow_cpu=args.allow_cpu,
                    fp16=not args.loftr_fp32,
                )
            after = query_nvidia_gpu()
            result = evaluate_correspondences(
                method=label,
                source_path=src_work,
                reference_path=ref_work,
                src_pts=out.source_points,
                ref_pts=out.reference_points,
                confidences=out.confidences,
                output_dir=output / method,
                inference_time_s=out.inference_time_s,
                load_time_s=out.load_time_s,
                device=out.device,
                peak_gpu_memory_mb=out.peak_gpu_memory_mb,
                model_details=out.details,
                working_ground_scale_m_per_px=pair_meta["working_ground_scale_m_per_px"],
                gpu_before=before,
                gpu_after=after,
            )
            results[method] = result
            print(
                f"    {result['status']}: {result['metrics']['proposed_matches']} proposed, "
                f"{result['metrics']['verified_inliers']} inliers"
            )
            print(
                f"    Inference: {result['inference_time_s']:.3f} s | "
                f"Peak allocated VRAM: {result['peak_gpu_memory_mb']} MB"
            )
            if after:
                print(f"    End temp: {after.temperature_c:.0f} C")
        except LearnedMatcherError as exc:
            print(f"    MODEL ERROR: {exc}")
            results[method] = model_error_result(method, str(exc))

        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

        # Do not begin the next learned model while already hot.
        if idx < len(learned_order):
            try:
                wait_until_safe(label="next learned matcher")
            except ThermalSafetyError as exc:
                print(f"    THERMAL STOP BEFORE NEXT MODEL: {exc}")
                break
        print("")

    previous_summary = canonical / "experiment_summary.json"
    historical = None
    if previous_summary.exists():
        try:
            historical = json.loads(previous_summary.read_text(encoding="utf-8")).get("baseline")
        except Exception:
            historical = None

    summary = {
        "version": "0.02",
        "profile": args.mode,
        "compute_policy": {
            "training": False,
            "one_model_at_a_time": True,
            "warmup_runs": 0,
            "timing_repeats": 1,
            "torch_compile": False,
            "lightglue_max_keypoints": keypoints,
            "loftr_fp16_first": not args.loftr_fp32,
            "automatic_loftr_fp32_retry": False,
            "thermal_trigger_c": 78,
            "thermal_resume_c": 74,
            "thermal_hard_start_stop_c": 84,
        },
        "working_pair": pair_meta,
        "historical_v0012_baseline": historical,
        "models_requested_this_run": list(args.models),
        "results": results,
    }
    write_summary(output, summary)

    print("======================================================")
    print("V0.02 BENCHMARK COMPLETE")
    print(f"Outputs: {output}")
    print(f"Summary: {output / 'benchmark_summary.json'}")
    print(f"Table:   {output / 'benchmark.csv'}")
    print("======================================================")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
