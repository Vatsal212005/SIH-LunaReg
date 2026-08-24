$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "backend/.venv was not found. Run the V0.01 installer first." }
Push-Location (Join-Path $Root "backend")
try {
    & $Python scripts\test_real_pair_v0012.py
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
