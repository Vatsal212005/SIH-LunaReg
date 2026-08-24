from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.scientific_pair import (  # noqa: E402
    ScientificPairError,
    load_geometry_csv,
    locate_real_data,
    parse_ohrc_label,
)


def main() -> int:
    raw = BACKEND / "data" / "raw"
    try:
        files = locate_real_data(raw)
        info = parse_ohrc_label(files["ohrc_xml"], files["ohrc_img"])
        geom = load_geometry_csv(files["geometry_csv"])
    except ScientificPairError as exc:
        print("REAL DATA CHECK: NOT READY")
        print(exc)
        return 2

    summary = {
        "status": "READY",
        "ohrc_image": str(files["ohrc_img"]),
        "ohrc_geometry": str(files["geometry_csv"]),
        "lro_reference": str(files["lro_tif"]),
        "ohrc_dimensions": [info.samples, info.lines],
        "ohrc_gsd_m_per_px": info.gsd_m,
        "geometry_records": len(geom),
        "sun_azimuth_deg": info.sun_azimuth_deg,
        "sun_elevation_deg": info.sun_elevation_deg,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
