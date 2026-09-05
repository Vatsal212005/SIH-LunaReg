# 🌙 LunaReg — Multi-Modal Lunar Image Registration System

> **SIH 2026 · Problem Statement 26166 · Theme: Space Technology**
> **Team Termin8ors**

LunaReg is an end-to-end lunar image registration platform that solves the challenge of aligning multi-modal, multi-sensor lunar surface imagery captured under varying Sun angles, viewing geometries, and spatial resolutions. The system aligns Chandrayaan-2 OHRC imagery against LRO NAC orthophotos on a verified common lunar map grid using state-of-the-art learned feature correspondence.

---

## 📋 Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Frontend Overview](#frontend-overview)
- [Backend Overview](#backend-overview)
- [Registration Pipeline](#registration-pipeline)
- [Performance Benchmarks](#performance-benchmarks)
- [Robustness Evaluation](#robustness-evaluation)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Team & Acknowledgments](#team--acknowledgments)

---

## Problem Statement

**SIH 26166**: Develop a system for multi-modal, Sun-angle and scale-invariant correspondence for Chandrayaan-2 lunar imagery.

### The Challenge

Lunar surface imagery from different sensors and missions exhibits dramatic visual differences even over identical terrain:

| Factor | Impact |
|--------|--------|
| **Sensor modality** | OHRC (panchromatic 0.25 m/px) vs LRO NAC (1 m/px orthophoto) produce fundamentally different pixel values |
| **Sun-angle variation** | Illumination and shadow patterns shift with orbital geometry, altering surface texture and contrast |
| **Scale differences** | 4× resolution gap between OHRC and LRO NAC requires careful geometric normalization |
| **Viewing geometry** | Oblique vs nadir capture changes perspective distortion across the terrain |

Classical feature matching (SIFT/SURF/ORB) struggles with these cross-modal differences because hand-crafted descriptors assume similar photometric properties across the image pair.

### Why It Matters

Precise image registration is the foundation for:
- **Lunar cartography**: Building unified, multi-source maps of the lunar surface
- **Landing site analysis**: Co-registering pre- and post-landing imagery for terrain change detection
- **Scientific measurement**: Enabling pixel-accurate measurements across multi-temporal datasets
- **Mission planning**: Providing reliable georeferencing for future Chandrayaan missions

---

## Solution Overview

LunaReg replaces classical correspondence with a **learned feature matching pipeline** that is robust to the cross-modal, cross-illumination, and cross-scale challenges of lunar imagery.

### Key Innovation

```
OHRC PDS4 (IMG + XML + geometry)
    │
    ▼
Common Grid (GCP thin-plate spline warp → 1 m/px 1500×1500)
    │
    ▼
SuperPoint + LightGlue (learned correspondence on 640×640 eco grid)
    │
    ▼
RANSAC Homography Verification
    │
    ▼
Quality Assessment (residual RMSE + 8×8 spatial coverage)
```

**Result**: 155 verified inliers across 79.7% spatial coverage — a **31× improvement** over classical SIFT (5 inliers, 7.8% coverage) on the same canonical pair.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        LunaReg System                            │
├──────────────────────┬───────────────────────────────────────────┤
│   Frontend (Next.js) │            Backend (FastAPI)              │
│                      │                                           │
│  ┌────────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Registration    │  │  │ /v1/demo/status                     │  │
│  │ Workspace       │◄─┼──│ /v1/demo/lightglue                  │  │
│  │                 │  │  │ /v1/registrations                    │  │
│  ├────────────────┤  │  ├─────────────────────────────────────┤  │
│  │ Analytics       │  │  │         Core Pipeline               │  │
│  │ Data Catalog    │  │  │  ┌──────────┐  ┌───────────────┐    │  │
│  │ Run History     │  │  │  │SuperPoint│→ │  LightGlue    │    │  │
│  │ Model Pipeline  │  │  │  └──────────┘  └───────┬───────┘    │  │
│  │ How It Works    │  │  │                        ▼            │  │
│  └────────────────┘  │  │  ┌──────────┐  ┌───────────────┐    │  │
│                      │  │  │  RANSAC  │← │  Verification │    │  │
│                      │  │  └──────────┘  └───────────────┘    │  │
│                      │  └─────────────────────────────────────┘  │
└──────────────────────┴───────────────────────────────────────────┘
```

### Data Flow

1. **Scientific Ingestion** — Real Chandrayaan-2 OHRC data (PDS4 IMG, XML metadata, geometry CSV with 484 GCP samples)
2. **Georectification** — GCP/thin-plate-spline warp maps the OHRC onto the LRO lunar map grid at 1 m/px
3. **Scale Normalization** — Canonical 1500×1500 common grid with a 640×640 eco copy for efficient inference
4. **Feature Extraction** — SuperPoint computes compact learned keypoints and descriptors
5. **Correspondence Matching** — LightGlue matches lunar structures across the sensor pair
6. **Geometric Verification** — RANSAC rejects inconsistent correspondences via homography estimation
7. **Quality Evaluation** — 8×8 spatial occupancy grid measures control-point coverage and entropy

---

## Technology Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 15** | React-based framework with SSR and optimized builds |
| **React 19** | Component-based UI with hooks and state management |
| **TypeScript** | Type-safe development across the frontend |
| **Tailwind CSS** | Utility-first styling with custom design tokens |
| **Google Fonts** (Inter, Outfit, JetBrains Mono) | Premium typography system |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** | Core language for scientific computing |
| **FastAPI** | High-performance async API framework |
| **PyTorch + CUDA** | GPU-accelerated deep learning inference |
| **OpenCV** | Image processing, SIFT baseline, visualization |
| **LightGlue** | Learned feature matching backbone |
| **SuperPoint** | Learned keypoint extractor |
| **NumPy / SciPy** | Scientific computing utilities |

---

## Frontend Overview

The frontend is a comprehensive, production-grade scientific dashboard built with Next.js 15 and React 19.

### Sections

| Section | Description |
|---------|-------------|
| **Registration Workspace** | Main interface with paired lunar imagery viewer (Matches/Overlay/Source/Reference modes), real-time metrics, registration controls, and configuration panel |
| **Registration Analytics** | Baseline comparison table (SIFT vs LoFTR vs LightGlue), robustness matrix with 8 test cases, interpretive analysis cards |
| **Lunar Data Catalog** | Sensor cards for OHRC, LRO NAC, TMC-2 (planned), IIRS (planned) with evidence readiness status |
| **Run History** | Table of benchmark runs, robustness suite records, and live session tracking |
| **Model Pipeline** | Visual registration graph showing the 6 implemented stages + planned expansions |
| **How It Works** | System overview with demonstrated performance metrics and architecture highlights |

### Frontend Features
- 🌓 **Dark/Light theme** with persistent preference
- 🎬 **Animated splash screen** with orbital launch sequence
- 🔍 **Command palette** search (Ctrl+K) for quick navigation
- 📊 **Animated metric counters** with smooth easing
- 🖥️ **Live CUDA inference** mode with processing visualization
- 📱 **Responsive design** (desktop, tablet, mobile breakpoints at 1250px, 980px, 650px)
- 📥 **JSON export** of complete registration reports
- 🔔 **System status popover** showing engine health

### Image Handling
The viewer seamlessly handles both live backend assets and local demonstration images. When the backend is unavailable, it displays validated canonical pair imagery stored in `/public/demo-runtime/`.

---

## Backend Overview

The backend is a FastAPI service providing both the original V0.01 SIFT-based registration and the V0.02+ learned matcher pipeline.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/v1/demo/status` | GET | System readiness (CUDA, canonical pair, benchmarks, robustness) |
| `/v1/demo/lightglue` | POST | Run live LightGlue inference on the canonical pair |
| `/v1/registrations` | POST | Upload custom image pair for SIFT registration |
| `/v1/registrations/{run_id}` | GET | Retrieve completed registration results |

### Core Modules

| Module | Description |
|--------|-------------|
| `registration.py` | V0.01 SIFT + RANSAC pipeline (image loading, CLAHE preprocessing, ratio-test matching, homography estimation) |
| `learned_matchers_v002.py` | SuperPoint + LightGlue inference wrapper with mixed precision and thermal guard |
| `benchmark_v002.py` | Working pair construction and correspondence evaluation framework |
| `robustness_v003.py` | 8-case robustness harness (5 native regions + 3 controlled perturbations) |
| `scientific_pair.py` | PDS4 OHRC ingestion, GCP-based georectification, common-grid generation |
| `metrics.py` | Reprojection error computation, spatial coverage analysis, quality summarization |
| `thermal_guard.py` | GPU temperature monitoring to prevent thermal throttling during demos |

---

## Registration Pipeline

### Implemented Stages (V0.03)

| # | Stage | Description |
|---|-------|-------------|
| 01 | **Scientific Ingestion** | Real Chandrayaan-2 OHRC IMG, XML and geometry CSV parsing |
| 02 | **GCP/TPS Georectification** | 484 geometry samples warp OHRC onto the LRO lunar map grid |
| 03 | **Scale-Normalized Working Pair** | Frozen 1500×1500 common grid; 640×640 eco copy for inference |
| 04 | **SuperPoint + LightGlue** | Learned correspondence backbone with early-exit optimization |
| 05 | **RANSAC Verification** | Homography-based geometric consistency filtering |
| 06 | **Coverage Evaluation** | 8×8 spatial occupancy and entropy measurement |

### Planned Expansions

| Stage | Description |
|-------|-------------|
| **Cross-Acquisition Validation** | Independent OHRC acquisitions with different illumination and orbital geometry |
| **TMC-2 Sensor Path** | Sensor/GSD-aware preprocessing for Chandrayaan-2 TMC-2 (~5 m/px) |
| **IIRS Adapter** | Spectral-spatial representation for hyperspectral correspondence |
| **Sub-Pixel Refinement** | Fractional-pixel refinement after robust coarse correspondence |

---

## Performance Benchmarks

All results are measured on the canonical OHRC ↔ LRO NAC pair (640×640 eco grid) with the same RANSAC evaluation layer.

| Method | Status | Proposed | Inliers | Ratio | RMSE | Coverage | Entropy | Inference | Peak VRAM |
|--------|--------|----------|---------|-------|------|----------|---------|-----------|-----------|
| **SIFT** | FAILED | 17 | 5 | 29.4% | 0.601 px | 7.8% | 0.387 | 0.215 s | CPU |
| **LoFTR** | SUCCESS | 217 | 50 | 23.0% | 1.246 px | 20.3% | 0.482 | 0.695 s | 1010 MB |
| **SuperPoint + LightGlue** | ✅ SUCCESS | 298 | **155** | **52.0%** | 1.706 px | **79.7%** | **0.885** | 0.956 s | **262 MB** |

### Key Observations

- **Coverage is the decisive metric**: SIFT's low RMSE is based on only 5 surviving inliers. LightGlue provides 155 verified points over 79.7% of the spatial grid.
- **Low compute footprint**: ~262 MB peak VRAM — substantially lighter than LoFTR (1010 MB) while achieving far broader correspondence.
- **RMSE interpretation**: The pixel RMSE is the homography reprojection residual, not independent ground-truth positioning accuracy.

---

## Robustness Evaluation

8 test cases across native regions and controlled perturbations, all passing with strong correspondence.

| Test Case | Group | Inliers | Coverage | RMSE | Inference |
|-----------|-------|---------|----------|------|-----------|
| **Northwest** | Native region | 56 | 37.5% | 1.593 px | 0.592 s |
| **Northeast** | Native region | 70 | 48.4% | 1.777 px | 0.057 s |
| **Center** | Native region | 100 | 67.2% | 1.816 px | 0.048 s |
| **Southwest** | Native region | 78 | 57.8% | 1.697 px | 0.055 s |
| **Southeast** | Native region | 80 | 62.5% | 1.922 px | 0.047 s |
| **Scale 0.75×** | Controlled stress | 65 | 40.6% | 1.569 px | 0.072 s |
| **Rotation +10°** | Controlled stress | 42 | 35.9% | 1.855 px | 0.072 s |
| **Gamma/contrast** | Photometric proxy | 81 | 65.6% | 1.637 px | 0.048 s |

> **Note**: The five native regions are disjoint crops from one acquisition pair. The gamma/contrast case is a photometric stress proxy, not evidence of real Sun-angle invariance across different acquisitions.

---

## Getting Started

### Prerequisites

- **Node.js 18+** (for frontend)
- **Python 3.11+** (for backend, optional)
- **CUDA-capable GPU** (for live inference, optional)

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/Vatsal212005/SIH-LunaReg.git
cd SIH-LunaReg

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The frontend works fully standalone with validated demonstration data. No backend is required for UI exploration.

### Production Build

```bash
npm run build
npm start
```

### Backend Setup (Optional)

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_LUNAREG_API_URL` | `http://127.0.0.1:8000` | Backend API URL for live inference |

---

## API Reference

### `GET /v1/demo/status`

Returns system readiness status including CUDA availability, canonical pair state, and benchmark evidence.

```json
{
  "status": "ready",
  "version": "0.03-hackathon",
  "canonical_pair_ready": true,
  "v002_ready": true,
  "v003_ready": true,
  "cuda_ready": true,
  "gpu_temperature_c": 52.0,
  "message": "Canonical pair, V0.02 evidence, V0.03 robustness evidence and CUDA are ready."
}
```

### `POST /v1/demo/lightglue`

Triggers live SuperPoint + LightGlue inference on the canonical OHRC ↔ LRO NAC pair.

```json
{
  "mode": "live",
  "run_id": "demo-a1b2c3d4",
  "method": "SuperPoint + LightGlue",
  "status": "SUCCESS",
  "metrics": {
    "proposed_matches": 298,
    "verified_inliers": 155,
    "inlier_ratio": 0.5201,
    "rmse_px": 1.7056,
    "spatial_coverage": 0.7969,
    "processing_time_s": 0.956
  },
  "assets": {
    "source": "/runs/demo-a1b2c3d4/working/source_640.png",
    "reference": "/runs/demo-a1b2c3d4/working/reference_640.png",
    "matches_inliers": "/runs/demo-a1b2c3d4/lightglue/matches_inliers.jpg",
    "overlay": "/runs/demo-a1b2c3d4/lightglue/overlay.jpg"
  }
}
```

### `POST /v1/registrations`

Upload a custom image pair for V0.01 SIFT-based registration.

**Form Data**:
- `source` (file) — Source image
- `reference` (file) — Reference image
- `source_sensor` (string, default: "OHRC") — Source sensor name
- `reference_sensor` (string, default: "LRO NAC") — Reference sensor name

---

## Project Structure

```
SIH-LunaReg/
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Root page
│   ├── layout.tsx                # Root layout with fonts and metadata
│   ├── globals.css               # Core design system and component styles
│   ├── upgrade.css               # Enhanced visual system
│   └── prototype.css             # Prototype-specific styles
├── components/
│   ├── LunaRegApp.tsx            # Main application component (6 sections)
│   ├── Icons.tsx                 # Custom SVG icon components
│   ├── LunarScene.tsx            # SVG lunar terrain visualization
│   └── HackathonDemo.tsx         # Hackathon demonstration component
├── lib/
│   ├── lunareg-api.ts            # API type definitions and contracts
│   └── lunareg-demo.ts           # Demo API client with timeout handling
├── public/
│   ├── demo-runtime/             # Demonstration images (source, reference, matches, overlay)
│   ├── lunar-source.jpg          # OHRC source image
│   ├── lunar-reference.jpg       # LRO NAC reference image
│   └── lunareg-mark.svg          # Brand mark
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI application entry point
│   │   ├── demo.py               # Hackathon demo endpoints
│   │   ├── core/
│   │   │   ├── registration.py   # V0.01 SIFT registration pipeline
│   │   │   ├── learned_matchers_v002.py  # LightGlue wrapper
│   │   │   ├── benchmark_v002.py         # Correspondence evaluation
│   │   │   ├── robustness_v003.py        # Robustness harness
│   │   │   ├── scientific_pair.py        # OHRC data ingestion
│   │   │   ├── metrics.py               # Quality metrics
│   │   │   └── thermal_guard.py         # GPU thermal protection
│   │   └── api/
│   │       └── endpoints.py
│   ├── requirements.txt          # Python dependencies
│   └── scripts/                  # Data preparation scripts
├── docs/
│   ├── HACKATHON_DEMO.md         # Demo instructions
│   ├── V0.02.md                  # V0.02 learned benchmarks documentation
│   └── V0.03.md                  # V0.03 robustness documentation
├── scripts/                      # PowerShell deployment scripts
├── package.json                  # Node.js dependencies
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── next.config.mjs               # Next.js configuration
```

---

## Deployment

### Vercel (Frontend)

1. Push the repository to GitHub
2. Import in [Vercel](https://vercel.com)
3. Vercel auto-detects Next.js — no custom build settings required
4. Deploy

### Backend (GPU Server)

```bash
# Install CUDA dependencies
pip install -r requirements.txt

# Start with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Set frontend env
NEXT_PUBLIC_LUNAREG_API_URL=https://your-api.example.com
```

---

## Scientific Scope & Limitations

| Aspect | Current Status |
|--------|---------------|
| Independent acquisition pairs | 1 |
| Active prototype sensors | 2 (OHRC + LRO NAC) |
| Robustness test cases | 8 (5 native + 3 controlled) |
| Absolute geodetic claim | No — RMSE is homography reprojection residual |
| Sub-pixel refinement | Planned |
| Multi-acquisition Sun-angle validation | Planned |

---

## Team & Acknowledgments

**Team Termin8ors** — Smart India Hackathon 2026

| Role | Technology |
|------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| Backend | FastAPI + PyTorch + OpenCV + LightGlue |
| Data | Chandrayaan-2 OHRC (ISRO) + LRO NAC (NASA/ASU) |

### Data Sources
- **Chandrayaan-2 OHRC**: Indian Space Research Organisation (ISRO)
- **LRO NAC Orthophoto**: NASA / Arizona State University

---

## License

This project was developed for the Smart India Hackathon 2026, Problem Statement 26166 (Space Technology).
