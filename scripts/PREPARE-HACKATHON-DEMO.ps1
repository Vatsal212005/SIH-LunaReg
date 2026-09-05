$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Runtime = Join-Path $Root "public\demo-runtime"
$Backup = Join-Path $Root "demo-backup"

$Canonical = Join-Path $Backend "data\processed\v0012_real_pair_001"
$V002 = Join-Path $Backend "data\processed\v002_benchmark_pair_001_eco"
$V003 = Join-Path $Backend "data\processed\v003_initial_pair001"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LunaReg - Prepare Internal Hackathon Demo" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$Required = @(
  (Join-Path $Canonical "source_ohrc_rectified_1m.png"),
  (Join-Path $Canonical "reference_lro_1m.png"),
  (Join-Path $V002 "lightglue\matches_inliers.jpg"),
  (Join-Path $V002 "lightglue\overlay.jpg"),
  (Join-Path $V002 "benchmark_summary.json"),
  (Join-Path $V002 "benchmark.csv"),
  (Join-Path $V003 "robustness_summary.json"),
  (Join-Path $V003 "robustness.csv")
)
foreach ($Item in $Required) {
  if (-not (Test-Path $Item)) { throw "Required validated demo evidence is missing: $Item" }
}

Write-Host "[1/4] Building local presentation fallback assets..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
Copy-Item (Join-Path $Canonical "source_ohrc_rectified_1m.png") (Join-Path $Runtime "source.png") -Force
Copy-Item (Join-Path $Canonical "reference_lro_1m.png") (Join-Path $Runtime "reference.png") -Force
Copy-Item (Join-Path $V002 "lightglue\matches_inliers.jpg") (Join-Path $Runtime "matches.jpg") -Force
Copy-Item (Join-Path $V002 "lightglue\overlay.jpg") (Join-Path $Runtime "overlay.jpg") -Force

$Optional = @(
  @{ Source = (Join-Path $V003 "region\northwest\matches_inliers.jpg"); Name = "northwest_matches.jpg" },
  @{ Source = (Join-Path $V003 "stress\rotation_p10deg\matches_inliers.jpg"); Name = "rotation_matches.jpg" }
)
foreach ($Item in $Optional) {
  if (Test-Path $Item.Source) { Copy-Item $Item.Source (Join-Path $Runtime $Item.Name) -Force }
}
Write-Host "      Fallback viewer assets ready." -ForegroundColor Green

Write-Host "[2/4] Creating offline evidence backup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $Backup | Out-Null
Copy-Item (Join-Path $V002 "benchmark_summary.json") (Join-Path $Backup "v002_benchmark_summary.json") -Force
Copy-Item (Join-Path $V002 "benchmark.csv") (Join-Path $Backup "v002_benchmark.csv") -Force
Copy-Item (Join-Path $V003 "robustness_summary.json") (Join-Path $Backup "v003_robustness_summary.json") -Force
Copy-Item (Join-Path $V003 "robustness.csv") (Join-Path $Backup "v003_robustness.csv") -Force
Copy-Item (Join-Path $Runtime "source.png") (Join-Path $Backup "source.png") -Force
Copy-Item (Join-Path $Runtime "reference.png") (Join-Path $Backup "reference.png") -Force
Copy-Item (Join-Path $Runtime "matches.jpg") (Join-Path $Backup "matches.jpg") -Force
Copy-Item (Join-Path $Runtime "overlay.jpg") (Join-Path $Backup "overlay.jpg") -Force
Write-Host "      Offline evidence copied to demo-backup." -ForegroundColor Green

Write-Host "[3/4] Writing local API configuration..." -ForegroundColor Yellow
Set-Content -Path (Join-Path $Root ".env.local") -Value "NEXT_PUBLIC_LUNAREG_API_URL=http://127.0.0.1:8000"
Write-Host "      .env.local points the frontend to local FastAPI." -ForegroundColor Green

Write-Host "[4/4] Checking core runtime..." -ForegroundColor Yellow
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "backend/.venv is missing." }
& $Python -c "import torch, lightglue, fastapi, cv2; print('      CUDA:', torch.cuda.is_available(), '| GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
if ($LASTEXITCODE -ne 0) { throw "Backend runtime check failed." }

Write-Host ""
Write-Host "HACKATHON DEMO PREPARATION COMPLETE" -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\START-HACKATHON-DEMO.ps1"
Write-Host ""
