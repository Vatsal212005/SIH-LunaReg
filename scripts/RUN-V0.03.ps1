
param(
    [ValidateSet("all", "regions", "stress")]
    [string]$Suite = "all"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "backend/.venv was not found. Install V0.02 first."
}

Push-Location (Join-Path $Root "backend")
try {
    & $Python scripts\robustness_v003.py --suite $Suite
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
