import numpy as np

from app.core.metrics import spatial_coverage


def test_spatial_coverage_nonzero():
    pts = np.array([[10, 10], [90, 90], [50, 50]], dtype=np.float32)
    coverage, entropy = spatial_coverage(pts, (100, 100), grid_size=4)
    assert coverage > 0
    assert 0 <= entropy <= 1
