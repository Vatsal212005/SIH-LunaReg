$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     LunaReg V0.01.2 Georectification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Python)) {
    throw "V0.01 backend virtual environment was not found. Run INSTALL-V0.01.ps1 first."
}

Write-Host "[1/3] Hardening .gitignore for local scientific data..." -ForegroundColor Yellow
$GitIgnore = Join-Path $Root ".gitignore"
if (-not (Test-Path $GitIgnore)) { New-Item -ItemType File -Path $GitIgnore | Out-Null }
$RequiredIgnore = @(
    "# LunaReg local scientific data",
    "backend/data/raw/",
    "backend/data/processed/",
    "backend/runs/",
    "backend/backups/"
)
$Existing = Get-Content $GitIgnore -ErrorAction SilentlyContinue
foreach ($Line in $RequiredIgnore) {
    if ($Existing -notcontains $Line) { Add-Content -Path $GitIgnore -Value $Line }
}
Write-Host "      Raw data, processed pairs, runs, and backend backups are ignored." -ForegroundColor Green

Write-Host "[2/3] Verifying geospatial dependencies..." -ForegroundColor Yellow
& $Python -c "import rasterio, pyproj, cv2, numpy; print('      rasterio', rasterio.__version__, '| pyproj', pyproj.__version__)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Missing package detected. Reinstalling backend requirements..." -ForegroundColor Yellow
    & $Python -m pip install -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
}

Write-Host "[3/3] Running V0.01.2 georectification self-test..." -ForegroundColor Yellow
Push-Location $Backend
try {
    & $Python scripts\self_test_v0012.py
    if ($LASTEXITCODE -ne 0) { throw "V0.01.2 georectification self-test failed." }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "V0.01.2 INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""
Write-Host "Run the real pair with:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\TEST-REAL-PAIR-V0.01.2.ps1"
