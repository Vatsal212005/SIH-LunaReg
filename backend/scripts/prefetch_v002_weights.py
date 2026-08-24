\
from __future__ import annotations

import gc


def main() -> int:
    print("Prefetching V0.02 pretrained weights on CPU. No inference will run.")

    print("  [1/2] SuperPoint + LightGlue weights...")
    from lightglue import LightGlue, SuperPoint
    sp = SuperPoint(max_num_keypoints=768).eval()
    lg = LightGlue(features="superpoint").eval()
    del sp, lg
    gc.collect()
    print("        cached")

    print("  [2/2] LoFTR outdoor weights...")
    from kornia.feature import LoFTR
    loftr = LoFTR(pretrained="outdoor").eval()
    del loftr
    gc.collect()
    print("        cached")

    print("Weight prefetch complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
