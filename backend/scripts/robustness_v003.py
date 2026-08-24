
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.benchmark_v002 import evaluate_correspondences  # noqa: E402
from app.core.robustness_v003 import (  # noqa: E402
    LightGlueEcoSession,
    RobustnessError,
    build_center_stress_cases,
    build_region_pairs,
)
from app.core.thermal_guard import (  # noqa: E402
    ThermalSafetyError,
    query_nvidia_gpu,
    wait_until_safe,
)


def parse_args():
    parser = argparse.ArgumentParser(description="LunaReg V0.03 Initial robustness benchmark")
    parser.add_argument(
        "--suite",
        choices=("all", "regions", "stress"),
        default="all",
        help="all=5 disjoint regions + 3 center stress cases",
    )
    return parser.parse_args()


def classify(result: dict) -> str:
    metrics = result.get("metrics", {})
    inliers = int(metrics.get("verified_inliers") or 0)
    coverage = float(metrics.get("spatial_coverage") or 0.0)
    if inliers < 6:
        return "FAILED"
    if inliers >= 20 and coverage >= 0.35:
        return "ROBUST"
    return "PARTIAL"


def main() -> int:
    args = parse_args()
    canonical = BACKEND / "data" / "processed" / "v0012_real_pair_001"
    source = canonical / "source_ohrc_rectified_1m.png"
    reference = canonical / "reference_lro_1m.png"
    if not source.exists() or not reference.exists():
        print("V0.03 cannot find Canonical Pair 001.")
        print("Run V0.01.2 real-pair generation first.")
        return 2

    output = BACKEND / "data" / "processed" / "v003_initial_pair001"
    output.mkdir(parents=True, exist_ok=True)

    print("")
    print("========================================================")
    print(" LunaReg V0.03 Initial - LOW-COMPUTE ROBUSTNESS HARNESS")
    print("========================================================")
    print("Training: NONE")
    print("New scientific downloads: NONE")
    print("Matcher: SuperPoint + LightGlue")
    print("Canonical data: existing V0.01.2 pair")
    print("Native crop resolution: 480 x 480 @ 1 m/px")
    print("LightGlue keypoint cap: 512")
    print("Model loads: ONCE")
    print("")

    try:
        regions = build_region_pairs(source, reference, output)
    except RobustnessError as exc:
        print(f"PAIR PREP FAILED: {exc}")
        return 2

    center = next(r for r in regions if r["name"] == "center")
    stress = build_center_stress_cases(center["source"], center["reference"], output)

    cases = []
    if args.suite in ("all", "regions"):
        for r in regions:
            cases.append({
                "group": "region",
                "name": r["name"],
                "source": r["source"],
                "reference": r["reference"],
                "description": "Native spatially disjoint subpair.",
                "claim_limit": r["independence_note"],
            })
    if args.suite in ("all", "stress"):
        for s in stress:
            cases.append({
                "group": "stress",
                "name": s["name"],
                "source": s["source"],
                "reference": s["reference"],
                "description": s["description"],
                "claim_limit": s["claim_limit"],
            })

    print(f"Cases this run: {len(cases)}")
    if args.suite == "all":
        print("  5 disjoint native regions + 3 controlled stress cases")
    print("")

    try:
        initial_gpu = wait_until_safe(label="V0.03 LightGlue session")
    except ThermalSafetyError as exc:
        print(f"THERMAL STOP: {exc}")
        return 3

    if initial_gpu:
        print(
            f"GPU start: {initial_gpu.temperature_c:.0f} C | "
            f"VRAM {initial_gpu.memory_used_mb:.0f}/{initial_gpu.memory_total_mb:.0f} MB"
        )

    try:
        session = LightGlueEcoSession(max_keypoints=512)
    except RobustnessError as exc:
        print(f"MODEL INIT FAILED: {exc}")
        return 4

    print(f"LightGlue session loaded once in {session.load_time_s:.3f} s")
    print("")

    results: dict[str, dict] = {}
    rows: list[dict] = []

    try:
        for index, case in enumerate(cases, start=1):
            label = f"{case['group']}:{case['name']}"
            print(f"[{index}/{len(cases)}] {label}")

            try:
                before = wait_until_safe(label=label)
            except ThermalSafetyError as exc:
                print(f"    THERMAL STOP: {exc}")
                break

            if before:
                print(f"    Start temp: {before.temperature_c:.0f} C")

            match = session.match(case["source"], case["reference"])
            after = query_nvidia_gpu()

            result_dir = output / case["group"] / case["name"]
            result = evaluate_correspondences(
                method="SuperPoint + LightGlue",
                source_path=case["source"],
                reference_path=case["reference"],
                src_pts=match["source_points"],
                ref_pts=match["reference_points"],
                confidences=match["confidences"],
                output_dir=result_dir,
                inference_time_s=match["inference_time_s"],
                load_time_s=0.0,
                device="cuda",
                peak_gpu_memory_mb=match["peak_gpu_memory_mb"],
                model_details={
                    "version": "V0.03 Initial",
                    "shared_session": True,
                    "max_keypoints": 512,
                    "depth_confidence": 0.85,
                    "width_confidence": 0.90,
                    "filter_threshold": 0.10,
                    "mixed_precision": True,
                    "stop_layer": match["stop_layer"],
                },
                working_ground_scale_m_per_px=1.0,
                gpu_before=before,
                gpu_after=after,
            )

            robustness = classify(result)
            result["robustness_class"] = robustness
            result["case"] = {
                "group": case["group"],
                "name": case["name"],
                "description": case["description"],
                "claim_limit": case["claim_limit"],
            }
            (result_dir / "result.json").write_text(
                json.dumps(result, indent=2), encoding="utf-8"
            )
            key = f"{case['group']}:{case['name']}"
            results[key] = result

            m = result["metrics"]
            row = {
                "group": case["group"],
                "case": case["name"],
                "robustness_class": robustness,
                "status": result["status"],
                "proposed_matches": m.get("proposed_matches"),
                "verified_inliers": m.get("verified_inliers"),
                "inlier_ratio": m.get("inlier_ratio"),
                "rmse_px": m.get("rmse_px"),
                "median_error_px": m.get("median_error_px"),
                "p90_error_px": m.get("p90_error_px"),
                "spatial_coverage": m.get("spatial_coverage"),
                "coverage_entropy": m.get("coverage_entropy"),
                "inference_time_s": result.get("inference_time_s"),
                "peak_gpu_memory_mb": result.get("peak_gpu_memory_mb"),
                "gpu_start_c": before.temperature_c if before else None,
                "gpu_end_c": after.temperature_c if after else None,
            }
            rows.append(row)

            print(
                f"    {robustness}: {m.get('verified_inliers')} inliers | "
                f"coverage {m.get('spatial_coverage'):.3f} | "
                f"RMSE {m.get('rmse_px')} px | "
                f"{result.get('inference_time_s'):.3f} s"
            )
            if after:
                print(f"    End temp: {after.temperature_c:.0f} C")
            print("")
    finally:
        session.close()

    v002_summary_path = (
        BACKEND / "data" / "processed" / "v002_benchmark_pair_001_eco" / "benchmark_summary.json"
    )
    v002_reference = None
    if v002_summary_path.exists():
        try:
            v002 = json.loads(v002_summary_path.read_text(encoding="utf-8"))
            lg = v002.get("results", {}).get("lightglue")
            if lg:
                v002_reference = {
                    "method": "SuperPoint + LightGlue",
                    "working_resolution": lg.get("working_resolution"),
                    "metrics": lg.get("metrics"),
                    "note": "V0.02 full-pair eco baseline; retained for context, not rerun.",
                }
        except Exception:
            pass

    summary = {
        "version": "0.03",
        "stage": "initial",
        "scientific_scope": {
            "new_downloads": False,
            "independent_acquisitions": 1,
            "spatially_disjoint_native_subpairs": 5,
            "controlled_stress_cases": 3,
            "important_limit": (
                "The five native regions come from one OHRC/LRO acquisition pair. "
                "They test spatial robustness but do not establish cross-acquisition generalization."
            ),
        },
        "compute_policy": {
            "training": False,
            "matcher": "SuperPoint + LightGlue",
            "crop_size_px": 480,
            "crop_ground_resolution_m_per_px": 1.0,
            "max_keypoints": 512,
            "model_loaded_once": True,
            "thermal_guard": True,
            "parallel_models": False,
        },
        "classification_rule": {
            "ROBUST": ">=20 verified inliers and >=0.35 spatial coverage",
            "PARTIAL": ">=6 verified inliers but below ROBUST threshold",
            "FAILED": "<6 verified inliers",
            "note": "Classification is a V0.03 engineering diagnostic, not an ISRO acceptance threshold.",
        },
        "v002_reference": v002_reference,
        "results": results,
    }
    (output / "robustness_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    if rows:
        fields = list(rows[0].keys())
        with (output / "robustness.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    robust = sum(1 for r in rows if r["robustness_class"] == "ROBUST")
    partial = sum(1 for r in rows if r["robustness_class"] == "PARTIAL")
    failed = sum(1 for r in rows if r["robustness_class"] == "FAILED")

    print("========================================================")
    print("V0.03 INITIAL COMPLETE")
    print(f"ROBUST: {robust} | PARTIAL: {partial} | FAILED: {failed}")
    print(f"Outputs: {output}")
    print(f"Summary: {output / 'robustness_summary.json'}")
    print(f"Table:   {output / 'robustness.csv'}")
    print("========================================================")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
