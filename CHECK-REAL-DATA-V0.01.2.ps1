$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "backend/.venv was not found. Run INSTALL-V0.01.ps1 first." }
Push-Location (Join-Path $Root "backend")
try {
    & $Python scripts\check_real_data.py
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
