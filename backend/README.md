# LunaReg V0.01 Registration Engine

This is the first real LunaReg backend milestone. It implements a classical, measurable registration baseline:

**SIFT -> Lowe ratio test -> RANSAC homography -> warp -> metrics**

It is deliberately not the final lunar matcher. Future versions will benchmark learned matchers and add LunaReg-specific illumination, scale, cross-sensor, sub-pixel and coverage modules.

## API

- `GET /health`
- `POST /v1/registrations`
- `GET /v1/registrations/{run_id}`
- generated products are available under `/runs/{run_id}/...`

## Generated products

Each successful registration creates:

- `registered.jpg`
- `overlay.jpg`
- `difference.jpg`
- `matches.jpg`
- `result.json`

## Metric note

In V0.01, `rmse_px` is the reprojection residual of RANSAC inlier correspondences under the estimated homography. It is **not yet absolute ground-truth lunar registration error**. The self-test additionally measures the estimated transform against a known synthetic transform.
