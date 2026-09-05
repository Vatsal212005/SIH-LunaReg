# LunaReg Presentation Notes

## Opening

The same lunar region can look significantly different across sensors, resolutions,
illumination and orbital geometry. LunaReg aims to automate correspondence and
registration so multi-sensor lunar products can be fused reliably.

## Working prototype

The current prototype uses a real Chandrayaan-2 OHRC product and an overlapping LRO
NAC orthophoto. OHRC is georectified using its geometry samples onto the exact same
1 m map grid as the LRO reference. The current learned matcher is SuperPoint +
LightGlue followed by RANSAC geometric verification and explicit spatial-coverage
measurement.

## Evidence

On the same verified pair:

- SIFT: 17 proposed, 5 inliers, 7.81% coverage, failed.
- LoFTR: 217 proposed, 50 inliers, 20.31% coverage.
- LightGlue: 298 proposed, 155 inliers, 79.69% coverage.

The important improvement is not merely match count. LightGlue provides correspondences
over much more of the image, which constrains registration geometry more reliably.

## Robustness

V0.03 Initial tests five non-overlapping areas from the current acquisition plus
controlled 0.75x scale, +10 degree rotation and gamma/contrast perturbations. All
eight passed the current engineering diagnostic.

## Scope statement

The internal-hackathon prototype validates the core OHRC-to-LRO pipeline. TMC-2, IIRS,
independent-acquisition validation and sub-pixel refinement are the next system stages.

## Closing

The prototype establishes that classical matching is insufficient on the tested real
pair, while a low-compute learned correspondence backbone works strongly enough to
support the next lunar-specific development stages.
