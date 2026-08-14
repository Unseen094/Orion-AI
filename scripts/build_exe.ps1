# Build the single-file Orion desktop EXE.
# Requires: node deps installed, backend venv created, npm build works.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "1/3 Building frontend..."
Push-Location "$root\frontend"
npm run build
if (-not $?) { throw "frontend build failed" }
Pop-Location

Write-Host "2/3 Ensuring packaging deps..."
& "$root\backend\.venv\Scripts\python.exe" -m pip install --timeout 120 --retries 12 pywebview pyinstaller
if (-not $?) { throw "pip install failed" }

Write-Host "3/3 Building EXE..."
Push-Location $root
& "$root\backend\.venv\Scripts\pyinstaller.exe" desktop\Orion.spec --noconfirm --distpath build\dist --workpath build\work
if (-not $?) { throw "pyinstaller failed" }
Pop-Location

Write-Host "Done. EXE: $root\build\dist\Orion.exe"
