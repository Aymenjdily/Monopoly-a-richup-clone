# Renders the HTML design mockups to PNG screenshots using headless Edge (1600x1000).
$ErrorActionPreference = "Stop"
$dir = (Resolve-Path (Join-Path $PSScriptRoot "..\design\phase-3-screens")).Path

$edgePaths = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "msedge.exe not found" }

Get-ChildItem $dir -Filter *.html | ForEach-Object {
  $png = [System.IO.Path]::ChangeExtension($_.FullName, "png")
  $uri = "file:///" + ($dir -replace '\\', '/') + "/" + $_.Name
  & $edge --headless=new --disable-gpu --no-first-run --hide-scrollbars `
    --window-size=1600,1000 --screenshot="$png" $uri 2>$null
  Start-Sleep -Milliseconds 1500
  if (Test-Path $png) { Write-Output ("OK  " + (Split-Path $png -Leaf)) } else { Write-Output ("FAIL " + $_.Name) }
}
