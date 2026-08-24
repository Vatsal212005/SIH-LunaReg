from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.registration import RegistrationError, register_images  # noqa: E402
from app.core.scientific_pair import ScientificPairError, build_real_pair  # noqa: E402


def main() -> int:
    raw = BACKEND / "data" / "raw"
    output = BACKEND / "data" / "processed" / "v0012_real_pair_001"
    baseline = output / "baseline_v001"

    print("[1/4] Georectifying OHRC onto the LRO 1 m map grid...")
    try:
        metadata = build_real_pair(raw, output)
    except ScientificPairError as exc:
        print(f"PAIR BUILD FAILED: {exc}")
        return 2

    center = metadata["pair"]["center_geometry_sample"]
    print(
        "      Pair center: "
        f"lon {center['longitude_deg']:.6f}, lat {center['latitude_deg']:.6f}"
    )
    print(f"      GCPs used: {metadata['source']['gcp_count_used']}")
    print(f"      Common coverage: {metadata['pair']['common_coverage_fraction']:.1%}")
    print(f"      Same output grid: {metadata['pair']['output_dimensions'][0]} x {metadata['pair']['output_dimensions'][1]} px")

    print("[2/4] Writing rectification diagnostics...")
    print(f"      Side-by-side: {output / 'side_by_side.jpg'}")
    print(f"      Pre-registration overlay: {output / 'pre_registration_overlay.jpg'}")
    print(f"      Common mask: {output / 'common_mask.png'}")

    print("[3/4] Running unchanged V0.01 SIFT/RANSAC baseline...")
    baseline_status: dict
    try:
        result = register_images(
            output / "source_ohrc_rectified_1m.png",
            output / "reference_lro_1m.png",
            baseline,
            max_dimension=1800,
        )
        baseline_status = {
            "status": "SUCCESS",
            "metrics": result["metrics"],
            "outputs": result["outputs"],
        }
        print(json.dumps(result["metrics"], indent=2))
    except RegistrationError as exc:
        baseline.mkdir(parents=True, exist_ok=True)
        baseline_status = {"status": "BASELINE_FAILED", "reason": str(exc)}
        (baseline / "failure.json").write_text(json.dumps(baseline_status, indent=2), encoding="utf-8")
        print(f"      V0.01 BASELINE FAILED: {exc}")

    print("[4/4] Saving experiment summary...")
    summary = {
        "version": "0.01.2",
        "pair_metadata": metadata,
        "baseline": baseline_status,
        "interpretation_order": [
            "1. Inspect side_by_side.jpg and confirm major terrain features occupy similar positions.",
            "2. Inspect pre_registration_overlay.jpg for gross geospatial alignment.",
            "3. Only then interpret baseline_v001 metrics and matches.",
        ],
    }
    (output / "experiment_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nV0.01.2 GEORECTIFIED REAL-PAIR TEST COMPLETE")
    print(f"Outputs: {output}")
    print("Inspect first: side_by_side.jpg")
    print("Then: pre_registration_overlay.jpg")
    if baseline_status["status"] == "SUCCESS":
        print("Finally: baseline_v001\\matches.jpg and baseline_v001\\overlay.jpg")
    else:
        print("The pair was georectified successfully, but the unchanged V0.01 baseline could not register it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
