# LunaReg Internal Hackathon Demo

## Freeze point

This build is the presentation prototype for the internal hackathon.

Do not add new sensors, models or datasets before the demo. The working scientific
scope is the verified Chandrayaan-2 OHRC to LRO NAC Canonical Pair 001.

## One-time preparation

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\PREPARE-HACKATHON-DEMO.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\VERIFY-HACKATHON-DEMO.ps1
```

`PREPARE-HACKATHON-DEMO.ps1` copies the already validated local evidence into an
ignored `public/demo-runtime/` directory and creates `demo-backup/`. These folders are
for the presentation laptop and are not committed to GitHub.

## Start the demo

Normal start:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\START-HACKATHON-DEMO.ps1
```

On the actual hackathon day, use the one-command launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\DEMO-DAY.ps1
```

This opens FastAPI on `http://127.0.0.1:8000` and Next.js on
`http://localhost:3000`. Keep both terminal windows open.

## 2-minute live sequence

1. Open **Live Demo**.
2. State that Canonical Pair 001 uses real Chandrayaan-2 OHRC and LRO NAC data.
3. Click **Run Live Registration**.
4. Show proposed matches, verified inliers, spatial coverage, residual and inference time.
5. Open **Evidence** and compare SIFT, LoFTR and LightGlue.
6. Open **Robustness** and show the eight V0.03 Initial cases.
7. Open **Pipeline** and separate implemented modules from planned TMC-2/IIRS/sub-pixel work.

## Recorded fallback

If CUDA or the backend fails, the interface remains in **RECORDED VALIDATED RESULT**
mode and shows the exact V0.02 evidence already measured on this laptop.

Say:

> Live inference is unavailable on this run, so I am showing the recorded validated
> output from the same canonical pair and configuration.

## Claims supported by the prototype

- Real Chandrayaan-2 OHRC scientific product ingestion.
- Real LRO NAC reference imagery.
- OHRC-to-LRO common-grid georectification.
- 484 geometry control samples used in the V0.01.2 pair build.
- 100% common coverage for Canonical Pair 001.
- SIFT: 5 verified inliers, 7.81% coverage, failed.
- LoFTR: 50 verified inliers, 20.31% coverage.
- SuperPoint + LightGlue: 155 verified inliers, 79.69% coverage.
- Measured LightGlue inference: approximately 0.956 seconds in V0.02 eco mode.
- V0.03 Initial passed five disjoint regions and three controlled stress cases.

## Do not claim

- absolute sub-pixel geodetic accuracy
- general real Sun-angle invariance
- cross-acquisition generalization
- implemented TMC-2 matching
- implemented IIRS matching
- a custom-trained LunaReg network

## September 8 checklist

- run `VERIFY-HACKATHON-DEMO.ps1`
- run the live demo at least five times
- confirm `demo-backup/` contains the validated outputs
- push source code to GitHub
- keep a PDF copy of the presentation locally
- optionally screen-record one successful complete demo
- restart the laptop and repeat the demo once from a cold boot


## Final product-style frontend

The internal-hackathon build now uses the original LunaReg application shell rather
than the temporary evidence-only frontend.

Navigation:
- Registration: real live LightGlue inference and current/recorded metrics
- Analytics: measured V0.02 baseline and V0.03 robustness results
- Data Catalog: actual OHRC/LRO products; TMC-2 and IIRS explicitly planned
- Run History: real benchmark, robustness and current live sessions only
- Model Pipeline: implemented versus planned system stages
- How It Works: presentation narrative and claims boundary

The temporary `HackathonDemo.tsx` file may remain in the source tree for provenance,
but `app/page.tsx` renders `LunaRegApp.tsx`.


## Presentation-polish build

The final internal-demo UI retains the original LunaReg product shell and adds a
presentation layer without changing the scientific pipeline:

- branded launch sequence
- dashboard/page entrance transitions
- metric count-up animation
- staged live-registration presentation
- success reveal with actual fresh API metrics
- cross-fading viewer modes
- system-readiness popover
- replayable launch sequence
- friendly timeout/fallback behavior

The staged loading sequence names operations that the current live endpoint actually
performs. It does not display fabricated exact completion percentages.

Backend status timeout is 10 seconds. Live inference timeout is 60 seconds. Raw browser
abort messages are never shown to the presentation audience.
