param(
  [ValidateRange(1, 50)] [int] $Answerable = 25,
  [ValidateRange(1, 50)] [int] $Unanswerable = 25,
  [ValidateRange(1, 8)] [int] $Workers = 1
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "Python Launcher (py) was not found. Install Python 3.11 from python.org, then run this file again."
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "Creating the evaluation virtual environment..." -ForegroundColor Cyan
  & py -3.11 -m venv .venv
}

$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Results = Join-Path $Root "results"
New-Item -ItemType Directory -Force -Path $Results | Out-Null

Write-Host "Installing evaluation dependencies (first run only)..." -ForegroundColor Cyan
& $Python -m pip install --upgrade pip
& $Python -m pip install -r .\eval-requirements.txt

Write-Warning "Judge checks will be skipped intentionally. This runner measures real retrieval, reliability, and latency without inventing unavailable judge scores."

function Run-LanguageEval([string] $Language, [string] $DisplayName) {
  $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $RawLog = Join-Path $Results "${Timestamp}_${Language}_raw_terminal.log"

  Write-Host "" 
  Write-Host "================================================================" -ForegroundColor Yellow
  Write-Host "Running $DisplayName: $Answerable answerable + $Unanswerable unanswerable examples" -ForegroundColor Cyan
  Write-Host "Exact terminal output will be saved to: $RawLog" -ForegroundColor DarkGray
  Write-Host "================================================================" -ForegroundColor Yellow

  & $Python -m eval.runner `
    --num-answerable $Answerable `
    --num-unanswerable $Unanswerable `
    --workers $Workers `
    --language $Language `
    --skip-judge 2>&1 | Tee-Object -FilePath $RawLog

  if ($LASTEXITCODE -ne 0) {
    throw "$DisplayName evaluation failed. The partial raw log is saved at $RawLog."
  }
}

# English reads the official original English fields in hinval.
Run-LanguageEval -Language "eng" -DisplayName "English"
# Hindi reads official translated Hindi fields in hinval.
Run-LanguageEval -Language "hin" -DisplayName "Hindi"
# Marathi reads official translated Marathi fields in marval.
Run-LanguageEval -Language "mar" -DisplayName "Marathi"

Write-Host "" 
Write-Host "Done. Submit the three raw terminal logs and the three newest JSON files in .\results\." -ForegroundColor Green
Write-Host "Do not average the three independent 25+25 runs into a single 150-example score." -ForegroundColor Yellow
