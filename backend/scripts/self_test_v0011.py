from __future__ import annotations

import csv
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.transform import from_origin

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.core.scientific_pair import (  # noqa: E402
    _normalize_uint8,
    _transform_lonlat,
    build_real_pair,
    load_geometry_csv,
    nearest_geometry_point,
)


PRODUCT = "ch2_ohr_ncp_20230823T0858341949_d_img_n18"
GEOMETRY = "ch2_ohr_ncp_20230823T0858341949_g_grd_n18"
LRO = "NAC_DTM_VIKRAMSITE1_M1442997156_100CM.TIF"


def write_fake_label(path: Path, lines: int, samples: int) -> None:
    path.write_text(
        f'''<?xml version="1.0"?>
<Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1" xmlns:isda="https://isda.issdc.gov.in/pds4/isda/v1">
  <Observation_Area><Mission_Area><isda:Product_Parameters>
    <isda:pixel_resolution>0.25</isda:pixel_resolution>
    <isda:sun_azimuth>61.44</isda:sun_azimuth>
    <isda:sun_elevation>8.99</isda:sun_elevation>
  </isda:Product_Parameters></Mission_Area></Observation_Area>
  <File_Area_Observational>
    <File><file_name>{PRODUCT}.img</file_name></File>
    <Array_2D_Image>
      <offset>0</offset>
      <Element_Array><data_type>UnsignedByte</data_type></Element_Array>
      <Axis_Array><axis_name>Line</axis_name><elements>{lines}</elements></Axis_Array>
      <Axis_Array><axis_name>Sample</axis_name><elements>{samples}</elements></Axis_Array>
    </Array_2D_Image>
  </File_Area_Observational>
</Product_Observational>''',
        encoding="utf-8",
    )


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        raw = tmp / "raw"
        src_dir = raw / "ohrc"
        ref_dir = raw / "lro"
        src_dir.mkdir(parents=True)
        ref_dir.mkdir(parents=True)

        # Small fake PDS image with the same byte layout used by the real OHRC product.
        h = w = 1000
        yy, xx = np.mgrid[0:h, 0:w]
        fake = (
            95
            + 38 * np.sin(xx / 23.0)
            + 31 * np.cos(yy / 31.0)
            + 45 * np.exp(-((xx - 360) ** 2 + (yy - 420) ** 2) / (2 * 55 ** 2))
        )
        fake = np.clip(fake, 0, 255).astype(np.uint8)
        (src_dir / f"{PRODUCT}.img").write_bytes(fake.tobytes(order="C"))
        write_fake_label(src_dir / f"{PRODUCT}.xml", h, w)

        lunar_ps = CRS.from_proj4(
            "+proj=stere +lat_0=-90 +lon_0=0 +lat_ts=-90 +R=1737400 +units=m +no_defs +type=crs"
        )
        lunar_geo = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
        to_xy = Transformer.from_crs(lunar_geo, lunar_ps, always_xy=True)
        to_ll = Transformer.from_crs(lunar_ps, lunar_geo, always_xy=True)
        x0, y0 = to_xy.transform(32.3, -69.4)

        geom = src_dir / f"{GEOMETRY}.csv"
        with geom.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Longitude", "Latitude", "Pixel", "Scan"])
            for scan in list(range(0, 1000, 100)) + [999]:
                for pixel in list(range(0, 1000, 100)) + [999]:
                    x = x0 + (pixel - 500) * 0.25
                    y = y0 - (scan - 500) * 0.25
                    lon, lat = to_ll.transform(x, y)
                    writer.writerow([lon, lat, pixel, scan])
        (src_dir / f"{GEOMETRY}.xml").write_text("<geometry/>", encoding="utf-8")

        # Reference raster covers a wider area around the fake OHRC scene.
        ref = np.roll(fake, 3, axis=1)
        ref = cv2.resize(ref, (250, 250), interpolation=cv2.INTER_AREA)
        ref_canvas = np.zeros((800, 800), dtype=np.uint8)
        ref_canvas[275:525, 275:525] = ref
        transform = from_origin(x0 - 400, y0 + 400, 1.0, 1.0)
        with rasterio.open(
            ref_dir / LRO,
            "w",
            driver="GTiff",
            height=800,
            width=800,
            count=1,
            dtype="uint8",
            crs=lunar_ps,
            transform=transform,
            nodata=0,
        ) as ds:
            ds.write(ref_canvas, 1)

        # First exercise small helpers.
        pts = load_geometry_csv(geom)
        assert nearest_geometry_point(pts, 110, 95).pixel == 100
        norm = _normalize_uint8(np.array([[0, 1, 2], [3, 4, 5]], dtype=np.float32))
        assert norm.dtype == np.uint8
        xy = _transform_lonlat([(32.3, -69.4)], lunar_ps)[0]
        assert all(np.isfinite(xy))

        # Then exercise the entire pair builder end to end.
        out = tmp / "processed"
        result = build_real_pair(raw, out, ground_size_m=200.0, working_gsd_m=1.0)
        assert result["pair"]["geospatial_overlap_verified"] is True
        for name in ["source_ohrc_1m.png", "reference_lro_1m.png", "side_by_side.jpg", "pair_metadata.json"]:
            assert (out / name).exists(), name

    print("V0.01.1 harness self-test: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
