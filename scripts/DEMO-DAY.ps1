$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LunaReg Internal Hackathon - Demo Day Start" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\CHECK-HACKATHON-DEMO.ps1")
if ($LASTEXITCODE -ne 0) {
  Write-Host "Readiness check failed. Running preparation once..." -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\PREPARE-HACKATHON-DEMO.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Preparation failed." }

  & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\CHECK-HACKATHON-DEMO.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Demo is still not ready." }
}

& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\START-HACKATHON-DEMO.ps1")
