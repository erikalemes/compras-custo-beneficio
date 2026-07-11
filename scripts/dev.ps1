# Sobe backend (porta 8000) e frontend (porta 3000) em modo desenvolvimento (Windows).
$root = Split-Path -Parent $PSScriptRoot
Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" `
  -WorkingDirectory "$root\backend"
Set-Location "$root\frontend"
npm run dev
