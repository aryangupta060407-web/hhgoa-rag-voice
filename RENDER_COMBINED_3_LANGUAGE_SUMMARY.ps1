param(
  [Parameter(Mandatory = $true)] [string] $EnglishJson,
  [Parameter(Mandatory = $true)] [string] $HindiJson,
  [Parameter(Mandatory = $true)] [string] $MarathiJson
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Run RUN_3_LANGUAGE_EVAL_FOR_ADMIN.ps1 first so .venv exists." }

$OutputHtml = Join-Path $Root "results\combined-three-language-eval.html"
$OutputPng = Join-Path $Root "results\Samvad-Combined-Three-Language-Eval.png"

& $Python .\scripts\render_combined_eval_summary.py `
  --english $EnglishJson `
  --hindi $HindiJson `
  --marathi $MarathiJson `
  --output $OutputHtml

$ChromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Chrome) { throw "Google Chrome was not found. Open $OutputHtml in any browser and take its screenshot manually." }

$Uri = [System.Uri]::new((Resolve-Path $OutputHtml)).AbsoluteUri
& $Chrome --headless --disable-gpu --hide-scrollbars --window-size=1600,1550 "--screenshot=$OutputPng" $Uri
if (-not (Test-Path $OutputPng)) { throw "Chrome did not create the combined PNG." }

Write-Host "Combined summary created: $OutputPng" -ForegroundColor Green
