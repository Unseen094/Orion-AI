# Orion one-command boot. Run from repo root.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path "$root\backend\.venv")) {
    Write-Host "Creating backend venv..."
    python -m venv "$root\backend\.venv"
    & "$root\backend\.venv\Scripts\pip" install -r "$root\backend\requirements.txt"
}

Write-Host "Starting ORION backend on :8000 ..."
Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000" `
    -WorkingDirectory "$root\backend" -WindowStyle Hidden

if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "Installing frontend deps..."
    Push-Location "$root\frontend"
    npm install
    Pop-Location
}

Write-Host "Starting ORION frontend on :5173 ..."
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "cd /d $root\frontend && npm run dev" -WindowStyle Hidden

Start-Sleep -Seconds 3
Write-Host "ORION is live at http://localhost:5173"
Write-Host "Backend: http://localhost:8000/docs"
