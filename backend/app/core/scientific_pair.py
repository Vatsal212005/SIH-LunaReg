from __future__ import annotations

import csv
import json
import math
import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.control import GroundControlPoint
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from rasterio.windows import Window


class ScientificPairError(RuntimeError):
    pass


@dataclass(frozen=True)
class OHRCRasterInfo:
    path: Path
    xml_path: Path
    lines: int
    samples: int
    dtype: np.dtype
    offset_bytes: int
    gsd_m: float
    sun_azimuth_deg: float | None
    sun_elevation_deg: float | None


@dataclass(frozen=True)
class GeometryPoint:
    longitude: float
    latitude: float
    pixel: int
    scan: int


DTYPE_MAP = {
    "UnsignedByte": np.dtype("uint8"),
    "SignedByte": np.dtype("int8"),
    "UnsignedLSB2": np.dtype("<u2"),
    "UnsignedMSB2": np.dtype(">u2"),
    "SignedLSB2": np.dtype("<i2"),
    "SignedMSB2": np.dtype(">i2"),
}


def _find_text(root: ET.Element, local_name: str) -> str | None:
    node = root.find(f".//{{*}}{local_name}")
    if node is None or node.text is None:
        return None
    return node.text.strip()


def _find_float(root: ET.Element, local_name: str) -> float | None:
    value = _find_text(root, local_name)
    return float(value) if value not in (None, "") else None


def parse_ohrc_label(xml_path: str | Path, image_path: str | Path | None = None) -> OHRCRasterInfo:
    xml_path = Path(xml_path)
    root = ET.parse(xml_path).getroot()

    filename = _find_text(root, "file_name")
    if image_path is None:
        if not filename:
            raise ScientificPairError("OHRC PDS4 label does not contain file_name.")
        image_path = xml_path.parent / filename
    image_path = Path(image_path)

    array = root.find(".//{*}Array_2D_Image")
    if array is None:
        raise ScientificPairError("OHRC label does not contain Array_2D_Image metadata.")

    dimensions: dict[str, int] = {}
    for axis in array.findall("./{*}Axis_Array"):
        name = axis.findtext("{*}axis_name")
        elements = axis.findtext("{*}elements")
        if name and elements:
            dimensions[name.strip().lower()] = int(elements)

    lines = dimensions.get("line")
    samples = dimensions.get("sample")
    if not lines or not samples:
        raise ScientificPairError(f"Could not determine OHRC dimensions from {xml_path.name}.")

    data_type = array.findtext("./{*}Element_Array/{*}data_type")
    if data_type not in DTYPE_MAP:
        raise ScientificPairError(f"Unsupported OHRC PDS data type: {data_type!r}")

    offset_text = array.findtext("./{*}offset") or "0"
    gsd = _find_float(root, "pixel_resolution")
    if not gsd or gsd <= 0:
        raise ScientificPairError("OHRC label does not contain a valid pixel_resolution.")

    return OHRCRasterInfo(
        path=image_path,
        xml_path=xml_path,
        lines=lines,
        samples=samples,
        dtype=DTYPE_MAP[data_type],
        offset_bytes=int(offset_text),
        gsd_m=float(gsd),
        sun_azimuth_deg=_find_float(root, "sun_azimuth"),
        sun_elevation_deg=_find_float(root, "sun_elevation"),
    )


def load_geometry_csv(csv_path: str | Path) -> list[GeometryPoint]:
    points: list[GeometryPoint] = []
    with Path(csv_path).open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"Longitude", "Latitude", "Pixel", "Scan"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise ScientificPairError(
                f"Geometry CSV must contain {sorted(required)}; got {reader.fieldnames}."
            )
        for row in reader:
            points.append(
                GeometryPoint(
                    longitude=float(row["Longitude"]),
                    latitude=float(row["Latitude"]),
                    pixel=int(row["Pixel"]),
                    scan=int(row["Scan"]),
                )
            )
    if not points:
        raise ScientificPairError("Geometry CSV contained no coordinate records.")
    return points


def nearest_geometry_point(points: Iterable[GeometryPoint], pixel: float, scan: float) -> GeometryPoint:
    return min(points, key=lambda p: (p.pixel - pixel) ** 2 + (p.scan - scan) ** 2)


def locate_real_data(raw_root: str | Path) -> dict[str, Path]:
    raw_root = Path(raw_root)
    if not raw_root.exists():
        raise ScientificPairError(f"Raw data directory does not exist: {raw_root}")

    wanted = {
        "ohrc_img": "ch2_ohr_ncp_20230823t0858341949_d_img_n18.img",
        "ohrc_xml": "ch2_ohr_ncp_20230823t0858341949_d_img_n18.xml",
        "geometry_csv": "ch2_ohr_ncp_20230823t0858341949_g_grd_n18.csv",
        "geometry_xml": "ch2_ohr_ncp_20230823t0858341949_g_grd_n18.xml",
        "lro_tif": "nac_dtm_vikramsite1_m1442997156_100cm.tif",
    }

    found: dict[str, Path] = {}
    by_name = {p.name.lower(): p for p in raw_root.rglob("*") if p.is_file()}
    for key, filename in wanted.items():
        path = by_name.get(filename)
        if path is not None:
            found[key] = path

    missing = [key for key in wanted if key not in found]
    if missing:
        detail = "\n".join(f"  - {key}: {wanted[key]}" for key in missing)
        raise ScientificPairError(
            "Required real-data files were not found under backend/data/raw.\n"
            f"Missing:\n{detail}"
        )
    return found


def _memmap_ohrc(info: OHRCRasterInfo) -> np.memmap:
    if not info.path.exists():
        raise ScientificPairError(f"OHRC image file does not exist: {info.path}")
    expected = info.offset_bytes + info.lines * info.samples * info.dtype.itemsize
    actual = info.path.stat().st_size
    if actual < expected:
        raise ScientificPairError(
            f"OHRC .IMG is smaller than the PDS label expects ({actual:,} < {expected:,} bytes)."
        )
    return np.memmap(
        info.path,
        dtype=info.dtype,
        mode="r",
        offset=info.offset_bytes,
        shape=(info.lines, info.samples),
        order="C",
    )


def _normalize_uint8(array: np.ndarray, nodata: float | int | None = None) -> np.ndarray:
    data = np.asarray(array)
    valid = np.isfinite(data)
    if nodata is not None:
        valid &= data != nodata
    if not np.any(valid):
        return np.zeros(data.shape, dtype=np.uint8)
    values = data[valid].astype(np.float32)
    lo, hi = np.percentile(values, [1.0, 99.0])
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        lo = float(values.min())
        hi = float(values.max())
    if hi <= lo:
        return np.zeros(data.shape, dtype=np.uint8)
    result = np.clip((data.astype(np.float32) - lo) * (255.0 / (hi - lo)), 0, 255)
    result[~valid] = 0
    return result.astype(np.uint8)


def _moon_geographic_crs(reference_crs: CRS) -> CRS:
    # LROC products use Moon-specific projected coordinate systems. Reusing the
    # destination ellipsoid/radius avoids the Earth-vs-Moon CRS mismatch that
    # occurs if EPSG:4326 is used as the longitude/latitude source CRS.
    radius = 1_737_400.0
    try:
        ellipsoid = reference_crs.ellipsoid
        if ellipsoid and math.isfinite(ellipsoid.semi_major_metre):
            radius = float(ellipsoid.semi_major_metre)
    except Exception:
        pass
    return CRS.from_proj4(f"+proj=longlat +R={radius:.6f} +no_defs +type=crs")


def _transform_lonlat(points: list[tuple[float, float]], destination_crs) -> list[tuple[float, float]]:
    os.environ.setdefault("PROJ_IGNORE_CELESTIAL_BODY", "YES")
    dst = CRS.from_user_input(destination_crs)
    src = _moon_geographic_crs(dst)
    transformer = Transformer.from_crs(src, dst, always_xy=True)
    return [tuple(map(float, transformer.transform(lon, lat))) for lon, lat in points]


def _safe_window(window: Window, width: int, height: int) -> Window:
    full = Window(0, 0, width, height)
    try:
        return window.intersection(full)
    except Exception as exc:
        raise ScientificPairError("Requested OHRC footprint does not intersect the LRO raster.") from exc


def _save_gray(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(path), image):
        raise ScientificPairError(f"OpenCV could not write {path}")


def _select_crop_gcps(
    geometry: list[GeometryPoint],
    *,
    left: int,
    top: int,
    right: int,
    bottom: int,
    destination_crs,
    max_axis_points: int = 24,
) -> list[GroundControlPoint]:
    """Create a spatially uniform GCP subset for one OHRC crop.

    GCP rows/columns are expressed relative to the cropped source array while
    their X/Y coordinates are expressed directly in the LRO projected CRS.
    """
    inside = [
        p for p in geometry
        if left <= p.pixel < right and top <= p.scan < bottom
    ]
    if len(inside) < 16:
        raise ScientificPairError(
            f"Only {len(inside)} OHRC geometry points fall inside the source crop; at least 16 are required."
        )

    pixels = sorted({p.pixel for p in inside})
    scans = sorted({p.scan for p in inside})
    px_step = max(1, math.ceil(len(pixels) / max_axis_points))
    sc_step = max(1, math.ceil(len(scans) / max_axis_points))
    selected_pixels = set(pixels[::px_step])
    selected_scans = set(scans[::sc_step])
    selected_pixels.add(pixels[-1])
    selected_scans.add(scans[-1])
    selected = [
        p for p in inside
        if p.pixel in selected_pixels and p.scan in selected_scans
    ]

    xy = _transform_lonlat(
        [(p.longitude, p.latitude) for p in selected],
        destination_crs,
    )
    gcps = [
        GroundControlPoint(
            row=float(p.scan - top),
            col=float(p.pixel - left),
            x=float(projected[0]),
            y=float(projected[1]),
        )
        for p, projected in zip(selected, xy)
    ]
    if len(gcps) < 16:
        raise ScientificPairError("GCP thinning left fewer than 16 control points.")
    return gcps


def _normalize_with_mask(array: np.ndarray, valid_mask: np.ndarray) -> np.ndarray:
    data = np.asarray(array)
    valid = np.asarray(valid_mask).astype(bool) & np.isfinite(data)
    if not np.any(valid):
        return np.zeros(data.shape, dtype=np.uint8)
    values = data[valid].astype(np.float32)
    lo, hi = np.percentile(values, [1.0, 99.0])
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        lo, hi = float(values.min()), float(values.max())
    if hi <= lo:
        out = np.zeros(data.shape, dtype=np.uint8)
        out[valid] = np.clip(values, 0, 255).astype(np.uint8)
        return out
    out = np.zeros(data.shape, dtype=np.uint8)
    scaled = np.clip((data.astype(np.float32) - lo) * (255.0 / (hi - lo)), 0, 255)
    out[valid] = scaled[valid].astype(np.uint8)
    return out


def _save_side_by_side(path: Path, source: np.ndarray, reference: np.ndarray) -> None:
    height = max(source.shape[0], reference.shape[0])
    width = max(source.shape[1], reference.shape[1])
    def panel(img: np.ndarray) -> np.ndarray:
        canvas = np.zeros((height, width), dtype=np.uint8)
        y = (height - img.shape[0]) // 2
        x = (width - img.shape[1]) // 2
        canvas[y:y + img.shape[0], x:x + img.shape[1]] = img
        return canvas
    divider = np.full((height, 6), 80, dtype=np.uint8)
    _save_gray(path, np.hstack([panel(source), divider, panel(reference)]))


def build_real_pair(
    raw_root: str | Path,
    output_dir: str | Path,
    *,
    ground_size_m: float = 1500.0,
    working_gsd_m: float = 1.0,
    source_margin_m: float = 300.0,
) -> dict:
    """Build one rectified OHRC/LRO pair on one identical lunar map grid.

    V0.01.2 differs from V0.01.1 in one critical way: the raw OHRC sensor crop
    is not merely resized. Its geometry-grid samples are converted to GCPs and
    the crop is warped into the exact LRO polar-stereographic grid first.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    files = locate_real_data(raw_root)

    ohrc = parse_ohrc_label(files["ohrc_xml"], files["ohrc_img"])
    geometry = load_geometry_csv(files["geometry_csv"])

    center_pixel = ohrc.samples // 2
    center_scan = ohrc.lines // 2
    center_geo = nearest_geometry_point(geometry, center_pixel, center_scan)

    # The raw OHRC crop is deliberately larger than the requested output map.
    # This gives the rotated sensor footprint enough margin to fully cover the
    # axis-aligned LRO target square after georectification.
    source_ground_size_m = ground_size_m + 2.0 * source_margin_m
    crop_native = int(round(source_ground_size_m / ohrc.gsd_m))
    crop_native = min(crop_native, ohrc.samples - 4, ohrc.lines - 4)
    if crop_native < 1024:
        raise ScientificPairError("Requested OHRC source crop is unexpectedly small.")
    if crop_native % 2:
        crop_native -= 1

    half = crop_native // 2
    left = max(0, center_pixel - half)
    top = max(0, center_scan - half)
    right = min(ohrc.samples, left + crop_native)
    bottom = min(ohrc.lines, top + crop_native)
    left = right - crop_native
    top = bottom - crop_native

    source_mm = _memmap_ohrc(ohrc)
    source_native = np.asarray(source_mm[top:bottom, left:right])

    out_size = int(round(ground_size_m / working_gsd_m))
    if out_size < 512:
        raise ScientificPairError("Requested output map is too small for the baseline experiment.")

    with rasterio.open(files["lro_tif"]) as ds:
        if ds.crs is None:
            raise ScientificPairError("LRO GeoTIFF has no CRS; cannot georectify OHRC.")

        center_x, center_y = _transform_lonlat(
            [(center_geo.longitude, center_geo.latitude)], ds.crs
        )[0]
        half_ground = out_size * working_gsd_m / 2.0
        target_transform = from_origin(
            center_x - half_ground,
            center_y + half_ground,
            working_gsd_m,
            working_gsd_m,
        )
        target_bounds = [
            center_x - half_ground,
            center_y - half_ground,
            center_x + half_ground,
            center_y + half_ground,
        ]

        gcps = _select_crop_gcps(
            geometry,
            left=left,
            top=top,
            right=right,
            bottom=bottom,
            destination_crs=ds.crs,
        )

        # Rectify OHRC into the exact same map grid that will be used for LRO.
        source_rectified = np.zeros((out_size, out_size), dtype=np.uint8)
        source_valid = np.zeros((out_size, out_size), dtype=np.uint8)
        reproject(
            source=source_native,
            destination=source_rectified,
            gcps=gcps,
            src_crs=ds.crs,
            dst_transform=target_transform,
            dst_crs=ds.crs,
            dst_nodata=0,
            resampling=Resampling.bilinear,
            init_dest_nodata=True,
            SRC_METHOD="GCP_TPS",
            num_threads=2,
        )
        reproject(
            source=np.full(source_native.shape, 255, dtype=np.uint8),
            destination=source_valid,
            gcps=gcps,
            src_crs=ds.crs,
            dst_transform=target_transform,
            dst_crs=ds.crs,
            dst_nodata=0,
            resampling=Resampling.nearest,
            init_dest_nodata=True,
            SRC_METHOD="GCP_TPS",
            num_threads=2,
        )

        # Reproject/read the LRO orthophoto onto the identical output grid.
        reference_rectified = np.zeros((out_size, out_size), dtype=np.uint8)
        reference_valid = np.zeros((out_size, out_size), dtype=np.uint8)
        reproject(
            source=rasterio.band(ds, 1),
            destination=reference_rectified,
            src_transform=ds.transform,
            src_crs=ds.crs,
            src_nodata=ds.nodata,
            dst_transform=target_transform,
            dst_crs=ds.crs,
            dst_nodata=0,
            resampling=Resampling.bilinear,
            init_dest_nodata=True,
            num_threads=2,
        )
        # A reference validity mask avoids treating dataset nodata as terrain.
        reference_valid[:] = (reference_rectified != 0).astype(np.uint8) * 255

        common = (source_valid > 0) & (reference_valid > 0)
        common_fraction = float(np.count_nonzero(common) / common.size)
        if common_fraction < 0.65:
            raise ScientificPairError(
                f"Only {common_fraction:.1%} of the target map has common OHRC/LRO coverage. "
                "The GCP rectification or target center must be checked before matching."
            )

        source_working = _normalize_with_mask(source_rectified, common)
        reference_working = _normalize_with_mask(reference_rectified, common)
        source_working[~common] = 0
        reference_working[~common] = 0
        common_mask = common.astype(np.uint8) * 255

        ref_meta = {
            "crs": ds.crs.to_string(),
            "crs_wkt": ds.crs.to_wkt(),
            "native_width": ds.width,
            "native_height": ds.height,
            "native_dtypes": list(ds.dtypes),
            "nodata": ds.nodata,
            "target_transform": [float(v) for v in tuple(target_transform)[:6]],
            "target_bounds_projected": [float(v) for v in target_bounds],
        }

    source_path = output_dir / "source_ohrc_rectified_1m.png"
    reference_path = output_dir / "reference_lro_1m.png"
    _save_gray(source_path, source_working)
    _save_gray(reference_path, reference_working)
    _save_gray(output_dir / "common_mask.png", common_mask)
    _save_side_by_side(output_dir / "side_by_side.jpg", source_working, reference_working)
    pre_overlay = cv2.addWeighted(source_working, 0.5, reference_working, 0.5, 0)
    _save_gray(output_dir / "pre_registration_overlay.jpg", pre_overlay)
    pre_difference = cv2.absdiff(source_working, reference_working)
    _save_gray(output_dir / "pre_registration_difference.jpg", pre_difference)

    metadata = {
        "version": "0.01.2",
        "purpose": "Georectified real OHRC-to-LRO V0.01 baseline test pair",
        "source": {
            "product": files["ohrc_img"].name,
            "pds4_label": files["ohrc_xml"].name,
            "geometry_csv": files["geometry_csv"].name,
            "native_dimensions": [ohrc.samples, ohrc.lines],
            "native_gsd_m_per_px": ohrc.gsd_m,
            "sun_azimuth_deg": ohrc.sun_azimuth_deg,
            "sun_elevation_deg": ohrc.sun_elevation_deg,
            "raw_crop_pixel_window": [left, top, right, bottom],
            "raw_crop_native_size_px": crop_native,
            "gcp_count_used": len(gcps),
            "rectification_method": "GDAL GCP thin-plate-spline warp",
            "working_image": source_path.name,
        },
        "reference": {
            "product": files["lro_tif"].name,
            "working_image": reference_path.name,
            **ref_meta,
        },
        "pair": {
            "center_geometry_sample": {
                "longitude_deg": center_geo.longitude,
                "latitude_deg": center_geo.latitude,
                "pixel": center_geo.pixel,
                "scan": center_geo.scan,
            },
            "ground_size_m": ground_size_m,
            "source_margin_m": source_margin_m,
            "working_gsd_m_per_px": working_gsd_m,
            "output_dimensions": [out_size, out_size],
            "common_coverage_fraction": round(common_fraction, 6),
            "same_crs": True,
            "same_transform": True,
            "same_pixel_grid": True,
            "georectified_before_matching": True,
            "visual_check": (
                "The major craters/terrain in side_by_side.jpg should now occupy approximately the same map positions. "
                "Only after this visual check should the SIFT baseline be interpreted."
            ),
        },
    }
    (output_dir / "pair_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
