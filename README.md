# LunaReg

Final-stage frontend for **SIH 2026 Problem Statement 26166**: multi-modal, Sun-angle and scale-invariant correspondence for Chandrayaan-2 lunar imagery.

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Pure SVG scientific visualizations, so the interface has no external image or chart dependencies

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production check:

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository in Vercel.
3. Vercel detects Next.js automatically.
4. Deploy. No custom build settings are required.

## Backend integration

The interface is deliberately built like the final LunaReg product, with a fully populated sample registration session so the complete UX is visible before the ML backend is connected.

When the FastAPI inference service is ready, set:

```env
NEXT_PUBLIC_LUNAREG_API_URL=https://your-api.example.com
```

The API contract is defined in `lib/lunareg-api.ts`. The expected registration flow is:

- `POST /v1/registrations` with `source` and `reference` image files
- `GET /v1/registrations/{run_id}` for completed run metadata and outputs

Replace the seeded session values in the React views with the returned registration result when the backend is integrated.

## Included interface areas

- Registration workspace with paired lunar imagery
- Correspondence-line viewer
- Registered-image swipe/opacity comparison
- Spatial coverage grid
- Residual-error visualization
- Source/reference upload interaction
- Sensor and acquisition metadata
- Animated seven-stage registration pipeline
- Registration analytics and robustness matrix
- Baseline comparison table
- Chandrayaan/LRO data catalog
- Run history
- Model pipeline and runtime inspector
- JSON report export
- Responsive layouts for laptop and projector use

## Project

**Team:** Termin8ors  
**Problem:** SIH26166  
**Theme:** Space Technology
