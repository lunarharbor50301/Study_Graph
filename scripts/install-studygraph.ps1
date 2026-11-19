$ErrorActionPreference = 'Stop'
$scriptsDir = (Resolve-Path $PSScriptRoot).Path
$launcher = Join-Path $scriptsDir 'studygraph.cmd'
if (-not (Test-Path $launcher)) {
  throw "Missing launcher: $launcher"
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$parts = @($userPath -split ';' | Where-Object { $_ -and $_.Trim() })
if ($parts -notcontains $scriptsDir) {
  $newPath = (($parts + $scriptsDir) -join ';')
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "Added to user PATH: $scriptsDir" -ForegroundColor Green
} else {
  Write-Host "Already on user PATH: $scriptsDir" -ForegroundColor Green
}
$env:Path = "$scriptsDir;$env:Path"

Write-Host ''
Write-Host "Installed. Open a new PowerShell window and type:" -ForegroundColor Cyan
Write-Host '    studygraph' -ForegroundColor White
Write-Host ''
Write-Host 'Options:' -ForegroundColor Cyan
Write-Host '    studygraph -NoTaccWait' -ForegroundColor White
Write-Host '    studygraph -TaccTimeoutSeconds 120' -ForegroundColor White
