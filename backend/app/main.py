from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.registration import RegistrationError, register_images

BASE_DIR = Path(__file__).resolve().parents[1]
RUNS_DIR = BASE_DIR / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="LunaReg Registration API",
    version="0.0.1",
    description="V0.01 baseline lunar image registration engine.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/runs", StaticFiles(directory=str(RUNS_DIR)), name="runs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "lunareg-registration", "version": "0.0.1"}


@app.post("/v1/registrations")
async def create_registration(
    source: UploadFile = File(...),
    reference: UploadFile = File(...),
    source_sensor: str = Form("OHRC"),
    reference_sensor: str = Form("LRO NAC"),
):
    run_id = uuid.uuid4().hex[:12]
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=False)

    source_suffix = Path(source.filename or "source.jpg").suffix or ".jpg"
    ref_suffix = Path(reference.filename or "reference.jpg").suffix or ".jpg"
    source_path = run_dir / f"source{source_suffix}"
    reference_path = run_dir / f"reference{ref_suffix}"

    with source_path.open("wb") as f:
        shutil.copyfileobj(source.file, f)
    with reference_path.open("wb") as f:
        shutil.copyfileobj(reference.file, f)

    try:
        result = register_images(source_path, reference_path, run_dir)
    except RegistrationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result.update({
        "run_id": run_id,
        "source_sensor": source_sensor,
        "reference_sensor": reference_sensor,
        "registered_product_url": f"/runs/{run_id}/registered.jpg",
        "match_points_url": f"/runs/{run_id}/result.json",
        "quality_report_url": f"/runs/{run_id}/result.json",
        "overlay_url": f"/runs/{run_id}/overlay.jpg",
        "difference_url": f"/runs/{run_id}/difference.jpg",
        "match_visualization_url": f"/runs/{run_id}/matches.jpg",
    })
    (run_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


@app.get("/v1/registrations/{run_id}")
def get_registration(run_id: str):
    result_path = RUNS_DIR / run_id / "result.json"
    if not result_path.exists():
        raise HTTPException(status_code=404, detail="Registration run not found")
    return json.loads(result_path.read_text(encoding="utf-8"))
