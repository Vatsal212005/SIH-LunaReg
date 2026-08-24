
param(
    [ValidateSet("all", "sift", "lightglue", "loftr")]
    [string]$Model = "all",

    [ValidateSet("eco", "balanced")]
    [string]$Mode = "eco",

    [switch]$AllowCpu,
    [switch]$LoFTRFp32
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "backend/.venv was not found. Run .\scripts\INSTALL-V0.02.ps1 first."
}

$ArgsList = @(
    "scripts\benchmark_v002.py",
    "--mode", $Mode
)

if ($Model -ne "all") {
    $ArgsList += @("--models", $Model)
}
if ($AllowCpu) {
    $ArgsList += "--allow-cpu"
}
if ($LoFTRFp32) {
    $ArgsList += "--loftr-fp32"
}

Push-Location (Join-Path $Root "backend")
try {
    & $Python @ArgsList
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
