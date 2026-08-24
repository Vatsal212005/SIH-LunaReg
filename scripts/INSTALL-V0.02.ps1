
param(
    [switch]$SkipWeightPrefetch
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Venv = Join-Path $Backend ".venv"
$Python = Join-Path $Venv "Scripts\python.exe"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LunaReg V0.02 - Low-Compute Benchmark Setup" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Python)) {
    Write-Host "[1/6] backend/.venv not found. Creating it..." -ForegroundColor Yellow
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & py -3.12 -m venv $Venv
        if ($LASTEXITCODE -ne 0) { & py -3 -m venv $Venv }
    } else {
        & python -m venv $Venv
    }
    if (-not (Test-Path $Python)) { throw "Could not create backend/.venv." }
} else {
    Write-Host "[1/6] Existing backend/.venv found." -ForegroundColor Green
}

Write-Host "[2/6] Updating pip and preserving V0.01.2 dependencies..." -ForegroundColor Yellow
& $Python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed." }
& $Python -m pip install -r (Join-Path $Backend "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Base backend dependency install failed." }

Write-Host "[3/6] Checking CUDA-enabled PyTorch..." -ForegroundColor Yellow
$TorchOkay = $false
& $Python -c "import torch, sys; print('torch', torch.__version__, '| cuda', torch.cuda.is_available()); sys.exit(0 if torch.cuda.is_available() else 1)"
if ($LASTEXITCODE -eq 0) {
    $TorchOkay = $true
    Write-Host "      Existing CUDA PyTorch will be reused." -ForegroundColor Green
}

if (-not $TorchOkay) {
    Write-Host "      Installing PyTorch 2.11.0 + CUDA 12.8 wheels..." -ForegroundColor Yellow
    Write-Host "      This is a large ONE-TIME download, not a training workload." -ForegroundColor DarkGray
    & $Python -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
    if ($LASTEXITCODE -ne 0) {
        throw "CUDA PyTorch installation failed. Do not run the benchmark on CPU by accident."
    }
}

Write-Host "[4/6] Installing V0.02 matcher dependencies..." -ForegroundColor Yellow
& $Python -m pip install -r (Join-Path $Backend "requirements-v002.txt")
if ($LASTEXITCODE -ne 0) { throw "Kornia installation failed." }
& $Python -m pip install --no-cache-dir "matplotlib>=3.8,<4"
& $Python -m pip install --no-cache-dir --no-deps "git+https://github.com/cvg/LightGlue.git"
if ($LASTEXITCODE -ne 0) { throw "LightGlue installation failed. Confirm Git can access github.com." }

Write-Host "[5/6] Running CPU-only V0.02 self-test..." -ForegroundColor Yellow
Push-Location $Backend
try {
    & $Python scripts\self_test_v002.py
    if ($LASTEXITCODE -ne 0) { throw "V0.02 self-test failed." }

    if (-not $SkipWeightPrefetch) {
        Write-Host "      Prefetching pretrained weights on CPU..." -ForegroundColor Yellow
        & $Python scripts\prefetch_v002_weights.py
        if ($LASTEXITCODE -ne 0) {
            throw "Model weight prefetch failed. No GPU benchmark was started."
        }
    } else {
        Write-Host "      Weight prefetch skipped by request." -ForegroundColor DarkGray
    }
} finally {
    Pop-Location
}

Write-Host "[6/6] Normalizing LunaReg version file..." -ForegroundColor Yellow
$OldVersion = Join-Path $Root "VERSION_V0.01.2"
if (Test-Path $OldVersion) {
    Remove-Item $OldVersion -Force
}
Set-Content -Path (Join-Path $Root "VERSION") -Value "0.02"

Write-Host ""
Write-Host "V0.02 INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""
Write-Host "Lowest-compute benchmark:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\RUN-V0.02.ps1"
Write-Host ""
Write-Host "To run only LightGlue first:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\RUN-V0.02.ps1 -Model lightglue"
Write-Host ""
