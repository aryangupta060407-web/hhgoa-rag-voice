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
Write-Host "Installing evaluation dependencies (first run only)..." -ForegroundColor Cyan
& $Python -m pip install --upgrade pip
& $Python -m pip install -r .\eval-requirements.txt

if (-not $env:OPENAI_API_KEY -and -not $env:ANTHROPIC_API_KEY) {
  Write-Warning "No judge credential is configured. Retrieval, reliability, and latency will run, but faithfulness/correctness will be reported as SKIPPED. This is honest evaluator behavior."
} else {
  Write-Host "A judge credential is available; faithfulness and correctness checks will run." -ForegroundColor Green
}

Write-Host "Running $Answerable answerable + $Unanswerable unanswerable MSMARCO-XI examples..." -ForegroundColor Cyan
& $Python -m eval.runner --num-answerable $Answerable --num-unanswerable $Unanswerable --workers $Workers

if ($LASTEXITCODE -ne 0) {
  throw "Evaluation failed. Copy the complete terminal output and send it for diagnosis."
}

Write-Host "Done. Submit the full terminal output and the newest file in .\results\ to the administrator." -ForegroundColor Green
