param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Payload = Join-Path $Root "_lunareg_upgrade"
$PackageJson = Join-Path $Root "package.json"
$Parent = Split-Path -Parent $Root
$ProjectName = Split-Path -Leaf $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     LunaReg Interactive Upgrade v2.1" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $PackageJson)) {
    Write-Host "ERROR: package.json was not found here:" -ForegroundColor Red
    Write-Host "  $Root" -ForegroundColor Red
    Write-Host ""
    Write-Host "Extract this upgrade ZIP into the ROOT of the existing LunaReg project, then run upgrade.ps1 again." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $Payload)) {
    Write-Host "ERROR: Upgrade payload folder is missing: $Payload" -ForegroundColor Red
    Write-Host "Re-extract the upgrade ZIP into the project root and run the script again." -ForegroundColor Yellow
    exit 1
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Parent "$ProjectName.lunareg-backup-$Timestamp"
$PayloadFiles = Get-ChildItem -Path $Payload -Recurse -File
$Updated = 0

# Older v2.0 created backups inside the Next.js project. Because tsconfig includes
# **/*.tsx, those folders can be type-checked by Next.js and break the build.
# Move them one level above the project before doing anything else.
$LegacyBackups = Get-ChildItem -Path $Root -Directory -Filter ".lunareg-backup-*" -ErrorAction SilentlyContinue
if ($LegacyBackups) {
    Write-Host "[0/5] Moving legacy backup folders outside the Next.js source tree..." -ForegroundColor Yellow
    foreach ($Legacy in $LegacyBackups) {
        $Destination = Join-Path $Parent ("$ProjectName." + $Legacy.Name.TrimStart('.'))
        if (Test-Path $Destination) {
            $Destination = "$Destination-$Timestamp"
        }
        Move-Item -Path $Legacy.FullName -Destination $Destination -Force
        Write-Host "      Preserved: $Destination" -ForegroundColor DarkGray
    }
}

Write-Host "[1/5] Backing up files that will be replaced..." -ForegroundColor Yellow
foreach ($File in $PayloadFiles) {
    $Relative = $File.FullName.Substring($Payload.Length).TrimStart([char[]]@('\','/'))
    $Target = Join-Path $Root $Relative

    if (Test-Path $Target) {
        $BackupTarget = Join-Path $BackupRoot $Relative
        $BackupDir = Split-Path -Parent $BackupTarget
        if (-not (Test-Path $BackupDir)) {
            New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        }
        Copy-Item -Path $Target -Destination $BackupTarget -Force
    }
}
Write-Host "      Backup created outside project: $BackupRoot" -ForegroundColor DarkGray

Write-Host "[2/5] Applying LunaReg upgrade files..." -ForegroundColor Yellow
foreach ($File in $PayloadFiles) {
    $Relative = $File.FullName.Substring($Payload.Length).TrimStart([char[]]@('\','/'))
    $Target = Join-Path $Root $Relative
    $TargetDir = Split-Path -Parent $Target
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    Copy-Item -Path $File.FullName -Destination $Target -Force
    $Updated++
}
Write-Host "      Updated $Updated files." -ForegroundColor Green

Write-Host "[3/5] Cleaning temporary upgrade source..." -ForegroundColor Yellow
# Critical: never leave TS/TSX staging files inside a Next.js project whose
# tsconfig includes **/*.ts and **/*.tsx.
if (Test-Path $Payload) {
    Remove-Item -Path $Payload -Recurse -Force
}
Write-Host "      Temporary _lunareg_upgrade folder removed before type-checking." -ForegroundColor DarkGray

Write-Host "[4/5] Checking dependencies and clearing build cache..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Host "      node_modules not found. Running npm install..." -ForegroundColor DarkGray
    Push-Location $Root
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
} else {
    Write-Host "      Existing node_modules found. No dependency changes are required." -ForegroundColor DarkGray
}

if (Test-Path (Join-Path $Root ".next")) {
    Remove-Item -Path (Join-Path $Root ".next") -Recurse -Force
}

if (-not $SkipBuild) {
    Write-Host "[5/5] Running production build..." -ForegroundColor Yellow
    Push-Location $Root
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
    }
    catch {
        Write-Host ""
        Write-Host "BUILD FAILED." -ForegroundColor Red
        Write-Host "A safe backup exists OUTSIDE the project at:" -ForegroundColor Yellow
        Write-Host "  $BackupRoot" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Send the build error to ChatGPT. Do not delete the backup." -ForegroundColor Yellow
        exit 1
    }
    finally { Pop-Location }
} else {
    Write-Host "[5/5] Build skipped because -SkipBuild was supplied." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " LunaReg upgrade completed successfully." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  Open http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Optional real lunar images:" -ForegroundColor Cyan
Write-Host "  public\\lunar-source.jpg" -ForegroundColor White
Write-Host "  public\\lunar-reference.jpg" -ForegroundColor White
Write-Host "See IMAGE_SETUP.txt for the exact image requirements." -ForegroundColor DarkGray
Write-Host ""
