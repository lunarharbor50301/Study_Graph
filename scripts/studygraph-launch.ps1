[CmdletBinding()]
param(
  [int]$TaccTimeoutSeconds = 300,
  [switch]$NoOpen,
  [switch]$NoTaccWait
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backendUrl = 'http://127.0.0.1:8000'

function Write-Step([string]$message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Write-Ok([string]$message) { Write-Host "OK  $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "!!  $message" -ForegroundColor Yellow }

function Test-Backend {
  try {
    return (Invoke-WebRequest -Uri "$backendUrl/api/documents" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-Tacc {
  if (-not $env:QWEN_BASE_URL) { return $false }
  try {
    $null = Invoke-RestMethod -Uri ($env:QWEN_BASE_URL.TrimEnd('/') + '/models') -TimeoutSec 3
    return $true
  } catch {
    return $false
  }
}

# Load the same .env used by uvicorn.
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
  }
}

# Windows PowerShell 5.1 can hold both NO_PROXY and no_proxy, which makes
# Start-Process throw "Item has already been added". Keep one case variant.
$proxyValue = [Environment]::GetEnvironmentVariable('NO_PROXY', 'Process')
if ($proxyValue) {
  [Environment]::SetEnvironmentVariable('NO_PROXY', $null, 'Process')
  [Environment]::SetEnvironmentVariable('no_proxy', $proxyValue, 'Process')
}

if (-not (Test-Path (Join-Path $root '.venv\Scripts\python.exe'))) {
  throw "Missing .venv. Run: python -m venv .venv; .\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt"
}
if (-not (Test-Path (Join-Path $root 'frontend\dist\index.html'))) {
  Write-Step 'frontend/dist is missing; building it now...'
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
  if (-not $npm) { throw 'npm was not found in PATH.' }
  Push-Location $root
  try {
    & $npm run build --prefix frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
  } finally {
    Pop-Location
  }
}

if (Test-Backend) {
  Write-Ok "Backend is already running at $backendUrl"
} else {
  $runDir = Join-Path $root '.run'
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null
  Write-Step "Starting backend at $backendUrl"
  $python = Join-Path $root '.venv\Scripts\python.exe'
  $stdout = Join-Path $runDir 'backend.out.log'
  $stderr = Join-Path $runDir 'backend.err.log'
  # Use ProcessStartInfo instead of Start-Process: Windows PowerShell 5.1 can
  # throw on duplicate case variants such as HTTP_PROXY/http_proxy.
  $command = '/d /c ""' + $python + '" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 > "' + $stdout + '" 2> "' + $stderr + '""'
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = $command
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::Start($psi)
  Set-Content -Path (Join-Path $runDir 'backend.pid') -Value $process.Id

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline -and -not (Test-Backend)) {
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-Backend)) {
    if (Test-Path $stderr) { Get-Content $stderr -Tail 20 | ForEach-Object { Write-Warn $_ } }
    throw "Backend did not become ready. See .run/backend.err.log"
  }
  Write-Ok 'Backend is ready.'
}

if ($NoTaccWait) {
  Write-Warn 'Skipping the TACC readiness wait.'
} elseif (-not $env:QWEN_BASE_URL) {
  Write-Warn 'QWEN_BASE_URL is not set; the AI Tutor will be unavailable, but generation still works.'
} else {
  Write-Step "Waiting for TACC Qwen at $($env:QWEN_BASE_URL) ..."
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, $TaccTimeoutSeconds))
  $nextNotice = (Get-Date).AddSeconds(10)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    if (Test-Tacc) { $ready = $true; break }
    if ((Get-Date) -ge $nextNotice) {
      Write-Host '    still waiting for the TACC model...' -ForegroundColor DarkGray
      $nextNotice = (Get-Date).AddSeconds(10)
    }
    Start-Sleep -Seconds 3
  }
  if ($ready) {
    Write-Ok 'TACC model is ready.'
  } else {
    Write-Warn "TACC did not become ready within $TaccTimeoutSeconds seconds; opening the frontend anyway."
    Write-Warn 'Concept maps, study notes and tests still work with DeepSeek.'
  }
}

if ($NoOpen) {
  Write-Host "StudyGraph: $backendUrl"
} else {
  Write-Ok "Opening $backendUrl"
  $open = New-Object System.Diagnostics.ProcessStartInfo
  $open.FileName = $backendUrl
  $open.UseShellExecute = $true
  [void][System.Diagnostics.Process]::Start($open)
}
