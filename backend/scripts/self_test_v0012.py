from __future__ import annotations

import csv
import math
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

from app.core.scientific_pair import build_real_pair  # noqa: E402
from app.core.registration import register_images  # noqa: E402

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


def world_texture(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    z = 104.0 + 22.0 * np.sin(x / 18.0) + 18.0 * np.cos(y / 23.0)
    for cx, cy, radius, depth in [
        (-58, 34, 18, 70),
        (45, -55, 12, 65),
        (68, 61, 15, 52),
        (-12, -18, 9, 48),
        (0, 72, 7, 44),
    ]:
        d2 = (x - cx) ** 2 + (y - cy) ** 2
        z -= depth * np.exp(-d2 / (2.0 * radius ** 2))
        z += 0.55 * depth * np.exp(-((np.sqrt(d2) - radius * 1.05) ** 2) / (2.0 * 3.0 ** 2))
    return np.clip(z, 1, 254).astype(np.uint8)


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        raw = tmp / "raw"
        src_dir = raw / "ohrc"
        ref_dir = raw / "lro"
        src_dir.mkdir(parents=True)
        ref_dir.mkdir(parents=True)

        h = w = 3200
        gsd = 0.25
        lunar_ps = CRS.from_proj4(
            "+proj=stere +lat_0=-69.3 +lon_0=32.3 +R=1737400 +units=m +no_defs +type=crs"
        )
        lunar_geo = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
        to_ll = Transformer.from_crs(lunar_ps, lunar_geo, always_xy=True)

        # Synthetic raw OHRC sensor image is rotated 17 degrees relative to the map grid.
        theta = math.radians(17.0)
        yy, xx = np.mgrid[0:h, 0:w]
        dx = (xx - w / 2.0) * gsd
        dy = -(yy - h / 2.0) * gsd
        wx = math.cos(theta) * dx - math.sin(theta) * dy
        wy = math.sin(theta) * dx + math.cos(theta) * dy
        source = world_texture(wx, wy)
        (src_dir / f"{PRODUCT}.img").write_bytes(source.tobytes(order="C"))
        write_fake_label(src_dir / f"{PRODUCT}.xml", h, w)

        geom = src_dir / f"{GEOMETRY}.csv"
        with geom.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Longitude", "Latitude", "Pixel", "Scan"])
            scan_values = list(range(0, h, 100)) + [h - 1]
            pixel_values = list(range(0, w, 100)) + [w - 1]
            for scan in scan_values:
                for pixel in pixel_values:
                    ddx = (pixel - w / 2.0) * gsd
                    ddy = -(scan - h / 2.0) * gsd
                    x = math.cos(theta) * ddx - math.sin(theta) * ddy
                    y = math.sin(theta) * ddx + math.cos(theta) * ddy
                    lon, lat = to_ll.transform(x, y)
                    writer.writerow([lon, lat, pixel, scan])
        (src_dir / f"{GEOMETRY}.xml").write_text("<geometry/>", encoding="utf-8")

        # Reference orthophoto is a regular 1 m map grid of the same world texture.
        ref_size = 1400
        ref_transform = from_origin(-700, 700, 1.0, 1.0)
        rows, cols = np.mgrid[0:ref_size, 0:ref_size]
        rx = -700 + cols + 0.5
        ry = 700 - rows - 0.5
        reference = world_texture(rx, ry)
        with rasterio.open(
            ref_dir / LRO,
            "w",
            driver="GTiff",
            height=ref_size,
            width=ref_size,
            count=1,
            dtype="uint8",
            crs=lunar_ps,
            transform=ref_transform,
            nodata=0,
        ) as ds:
            ds.write(reference, 1)

        out = tmp / "processed"
        result = build_real_pair(
            raw,
            out,
            ground_size_m=600.0,
            working_gsd_m=1.0,
            source_margin_m=75.0,
        )
        assert result["pair"]["georectified_before_matching"] is True
        assert result["pair"]["same_pixel_grid"] is True
        assert result["pair"]["common_coverage_fraction"] > 0.95

        src = cv2.imread(str(out / "source_ohrc_rectified_1m.png"), cv2.IMREAD_GRAYSCALE)
        ref = cv2.imread(str(out / "reference_lro_1m.png"), cv2.IMREAD_GRAYSCALE)
        assert src is not None and ref is not None
        assert src.shape == ref.shape == (600, 600)
        mask = cv2.imread(str(out / "common_mask.png"), cv2.IMREAD_GRAYSCALE) > 0
        # The synthetic pair shares the same texture; after rectification it should be strongly correlated.
        corr = float(np.corrcoef(src[mask].astype(np.float32), ref[mask].astype(np.float32))[0, 1])
        if corr < 0.90:
            raise AssertionError(f"Georectification correlation too low: {corr:.4f}")

        baseline = register_images(
            out / "source_ohrc_rectified_1m.png",
            out / "reference_lro_1m.png",
            out / "baseline",
            max_dimension=1200,
        )
        if baseline["metrics"]["verified_inliers"] < 20:
            raise AssertionError("Rectified synthetic pair did not produce enough SIFT inliers.")

    print(
        "V0.01.2 georectification self-test: PASS "
        f"(correlation={corr:.4f}, inliers={baseline['metrics']['verified_inliers']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
