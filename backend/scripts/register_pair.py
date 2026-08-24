from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.registration import RegistrationError, register_images  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Run LunaReg V0.01 registration on two images.")
    parser.add_argument("--source", required=True, help="Path to source image")
    parser.add_argument("--reference", required=True, help="Path to reference image")
    parser.add_argument("--output", default="runs/manual", help="Output directory")
    parser.add_argument("--max-dimension", type=int, default=1800)
    args = parser.parse_args()

    try:
        result = register_images(args.source, args.reference, args.output, max_dimension=args.max_dimension)
    except RegistrationError as exc:
        print(f"REGISTRATION FAILED: {exc}")
        raise SystemExit(2)

    print("\nLunaReg V0.01 registration complete")
    print(json.dumps(result["metrics"], indent=2))
    print(f"Outputs: {Path(args.output).resolve()}")


if __name__ == "__main__":
    main()
