
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LunaReg V0.03 Initial - Robustness Harness" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Python)) {
    throw "backend/.venv is missing. Install V0.02 first."
}

Write-Host "[1/4] Verifying V0.02 runtime..." -ForegroundColor Yellow
& $Python -c "import torch, cv2, numpy, lightglue; print('      torch', torch.__version__, '| cuda', torch.cuda.is_available()); raise SystemExit(0 if torch.cuda.is_available() else 1)"
if ($LASTEXITCODE -ne 0) {
    throw "V0.02 CUDA/LightGlue environment is not ready. Fix V0.02 before installing V0.03."
}

$Required = @(
    (Join-Path $Backend "app\core\benchmark_v002.py"),
    (Join-Path $Backend "app\core\thermal_guard.py"),
    (Join-Path $Backend "data\processed\v0012_real_pair_001\source_ohrc_rectified_1m.png"),
    (Join-Path $Backend "data\processed\v0012_real_pair_001\reference_lro_1m.png")
)
foreach ($Path in $Required) {
    if (-not (Test-Path $Path)) {
        throw "Required V0.02/V0.01.2 file is missing: $Path"
    }
}

Write-Host "[2/4] Confirming V0.03 adds no dependencies..." -ForegroundColor Yellow
Write-Host "      No packages will be downloaded." -ForegroundColor Green
Write-Host "      No model weights will be downloaded." -ForegroundColor Green
Write-Host "      No training will run." -ForegroundColor Green

Write-Host "[3/4] Running CPU-only V0.03 self-test..." -ForegroundColor Yellow
Push-Location $Backend
try {
    & $Python scripts\self_test_v003.py
    if ($LASTEXITCODE -ne 0) { throw "V0.03 self-test failed." }
} finally {
    Pop-Location
}

Write-Host "[4/4] Setting LunaReg version..." -ForegroundColor Yellow
Set-Content -Path (Join-Path $Root "VERSION") -Value "0.03"

Write-Host ""
Write-Host "V0.03 INITIAL INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""
Write-Host "Run the complete initial robustness suite:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\RUN-V0.03.ps1"
Write-Host ""
