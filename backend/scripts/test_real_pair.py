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
    output = BACKEND / "data" / "processed" / "v0011_real_pair_001"
    baseline = output / "baseline_v001"

    print("[1/3] Building geospatially verified OHRC/LRO test pair...")
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
    print(f"      Preview: {output / 'side_by_side.jpg'}")

    print("[2/3] Running unchanged V0.01 SIFT/RANSAC baseline...")
    baseline_status: dict
    try:
        result = register_images(
            output / "source_ohrc_1m.png",
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
        # A real baseline failure is a valid experimental outcome. Preserve it
        # instead of converting it into an installer/test-harness error.
        baseline.mkdir(parents=True, exist_ok=True)
        baseline_status = {"status": "BASELINE_FAILED", "reason": str(exc)}
        (baseline / "failure.json").write_text(json.dumps(baseline_status, indent=2), encoding="utf-8")
        print(f"      V0.01 BASELINE FAILED: {exc}")

    print("[3/3] Saving experiment summary...")
    summary = {
        "version": "0.01.1",
        "pair_metadata": metadata,
        "baseline": baseline_status,
        "important": (
            "Inspect side_by_side.jpg first. A baseline failure is meaningful only if the two panels "
            "visibly show the same lunar terrain."
        ),
    }
    (output / "experiment_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nV0.01.1 REAL-PAIR TEST COMPLETE")
    print(f"Outputs: {output}")
    print("First inspect: side_by_side.jpg")
    if baseline_status["status"] == "SUCCESS":
        print("Then inspect: baseline_v001\\matches.jpg and baseline_v001\\overlay.jpg")
    else:
        print("The verified pair was built, but the unchanged V0.01 baseline could not register it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
