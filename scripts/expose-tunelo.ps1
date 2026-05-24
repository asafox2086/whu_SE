param(
  [int]$Port = 4173,
  [string]$TuneloPath = "",
  [switch]$Password
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$localRelease = Join-Path $projectRoot "tools\tunelo\target\release\tunelo.exe"
$localBinary = Join-Path $projectRoot "tools\tunelo\tunelo.exe"
$pathCommand = Get-Command tunelo -ErrorAction SilentlyContinue

if (-not $TuneloPath) {
  if (Test-Path -LiteralPath $localRelease) {
    $TuneloPath = $localRelease
  } elseif (Test-Path -LiteralPath $localBinary) {
    $TuneloPath = $localBinary
  } elseif ($pathCommand) {
    $TuneloPath = $pathCommand.Source
  } else {
    Write-Host "tunelo is cloned at tools\tunelo, but no tunelo executable was found."
    Write-Host "Install the Windows binary first:"
    Write-Host "  irm https://tunelo.net/install.ps1 | iex"
    Write-Host ""
    Write-Host "Then run:"
    Write-Host "  .\scripts\expose-tunelo.ps1 -Port $Port"
    exit 1
  }
}

$env:PORT = [string]$Port
$tuneloArgs = @("port", [string]$Port)
if ($Password) {
  $tuneloArgs += "--password"
}
$tuneloArgs += "--"
$tuneloArgs += "npm"
$tuneloArgs += "start"

Write-Host "Starting Xinggui MVP on port $Port through Tunelo..."
Write-Host "Tunelo will print the Public URL when the tunnel is ready."
& $TuneloPath @tuneloArgs
