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
    Write-Host "[1/7] backend/.venv not found. Creating it..." -ForegroundColor Yellow
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & py -3.12 -m venv $Venv
        if ($LASTEXITCODE -ne 0) { & py -3 -m venv $Venv }
    } else {
        & python -m venv $Venv
    }
    if (-not (Test-Path $Python)) { throw "Could not create backend/.venv." }
} else {
    Write-Host "[1/7] Existing backend/.venv found." -ForegroundColor Green
}

$PythonVersion = & $Python -c "import sys; print(sys.version.split()[0])"
Write-Host "      Python: $PythonVersion" -ForegroundColor DarkGray

Write-Host "[2/7] Cleaning stale pip-upgrade artifacts if present..." -ForegroundColor Yellow
$SitePackages = & $Python -c "import site; print(site.getsitepackages()[0])"
if ($LASTEXITCODE -eq 0 -and (Test-Path $SitePackages)) {
    $BrokenPip = Get-ChildItem -LiteralPath $SitePackages -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "~ip*" }
    if ($BrokenPip) {
        foreach ($Item in $BrokenPip) {
            Remove-Item -LiteralPath $Item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Host "      Removed stale ~ip artifacts." -ForegroundColor Green
    } else {
        Write-Host "      No stale pip artifacts found." -ForegroundColor DarkGray
    }
}

Write-Host "[3/7] Verifying V0.01.2 dependencies..." -ForegroundColor Yellow
& $Python -c "import fastapi, cv2, numpy, pydantic, rasterio, pyproj; print('      Base backend dependencies OK')"
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Missing base dependency. Installing requirements.txt..." -ForegroundColor Yellow
    & $Python -m pip install --no-cache-dir -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "Base backend dependency install failed." }
}

Write-Host "[4/7] Checking CUDA-enabled PyTorch..." -ForegroundColor Yellow
$TorchOkay = $false
& $Python -c "import torch, torchvision, sys; print('      torch', torch.__version__, '| torchvision', torchvision.__version__, '| cuda', torch.cuda.is_available()); sys.exit(0 if torch.cuda.is_available() else 1)"
if ($LASTEXITCODE -eq 0) {
    $TorchOkay = $true
    Write-Host "      Existing CUDA PyTorch will be reused." -ForegroundColor Green
}

if (-not $TorchOkay) {
    Write-Host "      Installing PyTorch 2.11.0 + CUDA 12.8 wheels..." -ForegroundColor Yellow
    Write-Host "      Large one-time download. --no-cache-dir avoids keeping a duplicate wheel." -ForegroundColor DarkGray
    & $Python -m pip install --no-cache-dir torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
    if ($LASTEXITCODE -ne 0) {
        throw "CUDA PyTorch installation failed. Do not run the learned benchmark on CPU by accident."
    }

    & $Python -c "import torch, torchvision, sys; print('      torch', torch.__version__, '| cuda', torch.cuda.is_available()); sys.exit(0 if torch.cuda.is_available() else 1)"
    if ($LASTEXITCODE -ne 0) {
        throw "PyTorch installed but CUDA is unavailable. Benchmark stopped before any learned inference."
    }
}

Write-Host "[5/7] Installing V0.02 matcher dependencies..." -ForegroundColor Yellow
& $Python -m pip install --no-cache-dir -r (Join-Path $Backend "requirements-v002.txt")
if ($LASTEXITCODE -ne 0) { throw "Kornia/Matplotlib installation failed." }

# LightGlue's upstream requirements include opencv-python. LunaReg already uses
# opencv-python-headless, which provides the same cv2 module. --no-deps prevents
# installing a second conflicting OpenCV wheel while the other dependencies are
# explicitly supplied above.
& $Python -m pip install --no-cache-dir --no-deps "git+https://github.com/cvg/LightGlue.git"
if ($LASTEXITCODE -ne 0) { throw "LightGlue installation failed. Confirm Git can access github.com." }

Write-Host "[6/7] Running CPU-only V0.02 self-test..." -ForegroundColor Yellow
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

Write-Host "[7/7] Normalizing LunaReg version file..." -ForegroundColor Yellow
$OldVersion = Join-Path $Root "VERSION_V0.01.2"
if (Test-Path $OldVersion) {
    Remove-Item $OldVersion -Force
}
Set-Content -Path (Join-Path $Root "VERSION") -Value "0.02"

Write-Host ""
Write-Host "V0.02 INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""
Write-Host "Run LightGlue first:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\RUN-V0.02.ps1 -Model lightglue"
Write-Host ""
