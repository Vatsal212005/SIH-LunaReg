$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " LunaReg Final Pre-Hackathon Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "[1/3] Readiness checks..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\CHECK-HACKATHON-DEMO.ps1")
if ($LASTEXITCODE -ne 0) { throw "Readiness checks failed." }

Write-Host "[2/3] Next.js production build..." -ForegroundColor Yellow
Push-Location $Root
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Next.js production build failed." }
} finally {
  Pop-Location
}

Write-Host "[3/3] Python syntax/self-tests..." -ForegroundColor Yellow
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
Push-Location (Join-Path $Root "backend")
try {
  & $Python -m compileall -q app
  if ($LASTEXITCODE -ne 0) { throw "Python compile check failed." }
  & $Python scripts\self_test_v002.py
  if ($LASTEXITCODE -ne 0) { throw "V0.02 self-test failed." }
  & $Python scripts\self_test_v003.py
  if ($LASTEXITCODE -ne 0) { throw "V0.03 self-test failed." }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "FINAL VERIFICATION PASSED" -ForegroundColor Green
Write-Host "Do not add new research features before the internal hackathon." -ForegroundColor Yellow
