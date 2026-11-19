$ErrorActionPreference = 'Stop'
$scriptsDir = (Resolve-Path $PSScriptRoot).Path
$launcher = Join-Path $scriptsDir 'studygraph.cmd'
if (-not (Test-Path $launcher)) {
  throw "Missing launcher: $launcher"
}

# Install the renderer once on the machine that serves the web application.
$office = @($env:SOFFICE_PATH, (Get-Command soffice -ErrorAction SilentlyContinue).Source)
foreach ($base in @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
  if ($base) { $office += Join-Path $base 'LibreOffice/program/soffice.exe' }
}
if (-not ($office | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) })) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    & winget install --id TheDocumentFoundation.LibreOffice --exact --source winget
    if ($LASTEXITCODE -ne 0) { Write-Warning 'LibreOffice installation did not finish. PPTX will use basic previews.' }
  } else {
    Write-Warning 'Install LibreOffice on the backend host to enable slide-layout previews. Basic previews remain available.'
  }
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
