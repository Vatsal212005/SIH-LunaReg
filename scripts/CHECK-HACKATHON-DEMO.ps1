$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

Write-Host ""
Write-Host "LunaReg Hackathon Readiness Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$Failures = 0
function Check-Path($Label, $Path) {
  if (Test-Path $Path) {
    Write-Host "  [OK] $Label" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $Label -> $Path" -ForegroundColor Red
    $script:Failures++
  }
}

Check-Path "Backend virtual environment" $Python
Check-Path "Canonical OHRC source" (Join-Path $Backend "data\processed\v0012_real_pair_001\source_ohrc_rectified_1m.png")
Check-Path "Canonical LRO reference" (Join-Path $Backend "data\processed\v0012_real_pair_001\reference_lro_1m.png")
Check-Path "V0.02 benchmark summary" (Join-Path $Backend "data\processed\v002_benchmark_pair_001_eco\benchmark_summary.json")
Check-Path "V0.03 robustness summary" (Join-Path $Backend "data\processed\v003_initial_pair001\robustness_summary.json")
Check-Path "Fallback match image" (Join-Path $Root "public\demo-runtime\matches.jpg")
Check-Path "Fallback overlay" (Join-Path $Root "public\demo-runtime\overlay.jpg")
Check-Path "Frontend dependencies" (Join-Path $Root "node_modules")
Check-Path "Local API config" (Join-Path $Root ".env.local")

if (Test-Path $Python) {
  & $Python -c "import torch, lightglue, kornia; print('  [GPU] CUDA:', torch.cuda.is_available(), '|', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO CUDA'); raise SystemExit(0 if torch.cuda.is_available() else 1)"
  if ($LASTEXITCODE -ne 0) { $Failures++ }
}

Write-Host ""
if ($Failures -eq 0) {
  Write-Host "READY FOR DEMO" -ForegroundColor Green
  exit 0
}
Write-Host "$Failures readiness check(s) failed." -ForegroundColor Red
Write-Host "Run .\scripts\PREPARE-HACKATHON-DEMO.ps1 and fix any missing prerequisite."
exit 1
