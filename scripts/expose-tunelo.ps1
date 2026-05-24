param(
  [int]$Port = 4173,
  [string]$TuneloPath = "",
  [switch]$Password,
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$localRelease = Join-Path $projectRoot "tools\tunelo\target\release\tunelo.exe"
$localBinary = Join-Path $projectRoot "tools\tunelo\tunelo.exe"

if (-not $TuneloPath) {
  if (Test-Path -LiteralPath $localRelease) {
    $TuneloPath = $localRelease
  } elseif (Test-Path -LiteralPath $localBinary) {
    $TuneloPath = $localBinary
  }
}

if (-not $TuneloPath) {
  $pathCommand = Get-Command tunelo -ErrorAction SilentlyContinue
  if ($pathCommand) {
    $TuneloPath = $pathCommand.Source
  } else {
    if ($NoInstall) {
      Write-Host "tunelo was not found. Re-run without -NoInstall to install automatically."
      exit 1
    }
    Write-Host "tunelo was not found. Installing the Windows binary from https://tunelo.net/install.ps1 ..."
    Invoke-Expression (Invoke-RestMethod "https://tunelo.net/install.ps1")
    $pathCommand = Get-Command tunelo -ErrorAction SilentlyContinue
    if (-not $pathCommand) {
      $installPath = Join-Path $env:LOCALAPPDATA "tunelo\tunelo.exe"
      if (Test-Path -LiteralPath $installPath) {
        $TuneloPath = $installPath
      } else {
        throw "tunelo install completed, but tunelo.exe was not found on PATH or in $installPath"
      }
    } else {
      $TuneloPath = $pathCommand.Source
    }
  }
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Port $Port is already in use. Searching for a free port..."
  $candidatePort = $Port + 1
  while (Get-NetTCPConnection -LocalPort $candidatePort -State Listen -ErrorAction SilentlyContinue) {
    $candidatePort += 1
  }
  $Port = $candidatePort
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
Write-Host "Default mode is public HTTPS access. Everyone with the Public URL can use the same role choices as you."
Write-Host "Look for: Public URL: https://..."
& $TuneloPath @tuneloArgs
