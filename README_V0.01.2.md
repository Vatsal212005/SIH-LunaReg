# LunaReg V0.01.2 — OHRC Georectification Fix

V0.01.2 does **not** change the V0.01 SIFT/RANSAC registration algorithm.
It fixes the scientific-pair construction discovered during the V0.01.1 real-data test.

## The V0.01.1 problem

V0.01.1 cropped a square from the raw OHRC sensor raster, resized it to 1 m/px,
and compared that raw sensor-grid crop with an axis-aligned LRO map crop.
The two products overlapped geographically, but they were not represented on the same
map grid. This made the SIFT result difficult to interpret scientifically.

## The V0.01.2 fix

1. Read the OHRC PDS4 raster with memory mapping.
2. Select a source crop larger than the final requested map area.
3. Read the OHRC geometry CSV (longitude, latitude, pixel, scan).
4. Convert a spatially uniform subset of those samples to Ground Control Points in the
   **actual LRO lunar polar-stereographic CRS**.
5. Warp the OHRC crop with a GDAL GCP thin-plate-spline transformation.
6. Reproject/read the LRO orthophoto onto the **exact same CRS, transform, dimensions and 1 m pixel grid**.
7. Mask to common valid coverage.
8. Only then run the unchanged V0.01 SIFT + Lowe + RANSAC baseline.

## Install / verify

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-V0.01.2.ps1
```

## Run the real scientific pair

```powershell
powershell -ExecutionPolicy Bypass -File .\TEST-REAL-PAIR-V0.01.2.ps1
```

Outputs are written to:

```text
backend/data/processed/v0012_real_pair_001/
```

Important outputs:

- `source_ohrc_rectified_1m.png`
- `reference_lro_1m.png`
- `side_by_side.jpg`
- `pre_registration_overlay.jpg`
- `pre_registration_difference.jpg`
- `common_mask.png`
- `pair_metadata.json`
- `experiment_summary.json`
- `baseline_v001/` outputs from the unchanged V0.01 matcher

## Interpretation order

First inspect `side_by_side.jpg`. Major craters and terrain structures should now occupy
approximately the same map positions in both panels. Then inspect `pre_registration_overlay.jpg`.
Only after those are visibly correct should the SIFT match count, RANSAC inliers, RMSE and coverage
be treated as a meaningful real-data baseline.
