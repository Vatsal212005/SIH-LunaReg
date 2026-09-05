$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) { throw "backend/.venv is missing." }

if (-not (Test-Path (Join-Path $Root "public\demo-runtime\matches.jpg"))) {
  Write-Host "Fallback assets are not prepared. Preparing them now..." -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\PREPARE-HACKATHON-DEMO.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Demo preparation failed." }
}

function Test-Url($Url) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (Test-Url "http://127.0.0.1:8000/health") {
  Write-Host "Backend is already running." -ForegroundColor Green
} else {
  Write-Host "Starting LunaReg backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
  $BackendCommand = "Set-Location '$Backend'; & '$Python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand

  $BackendReady = $false
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Url "http://127.0.0.1:8000/health") { $BackendReady = $true; break }
  }
  if (-not $BackendReady) {
    Write-Host "Backend did not become reachable. Frontend fallback mode will still work." -ForegroundColor Yellow
  }
}

if (Test-Url "http://localhost:3000") {
  Write-Host "Frontend is already running." -ForegroundColor Green
} else {
  Write-Host "Starting LunaReg frontend on http://localhost:3000 ..." -ForegroundColor Cyan
  $FrontendCommand = "Set-Location '$Root'; npm.cmd run dev"
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $FrontendCommand

  $FrontendReady = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Url "http://localhost:3000") { $FrontendReady = $true; break }
  }
  if (-not $FrontendReady) { throw "Frontend did not become reachable on port 3000." }
}

Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "LunaReg demo is open." -ForegroundColor Green
Write-Host "Keep the backend/frontend terminal windows open during the presentation."
Write-Host "If live CUDA inference fails, the interface remains in recorded validated-result mode."
