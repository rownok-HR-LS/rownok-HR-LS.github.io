# Rebuilds Rownok-Rahman-CV.pdf from cv/index.html using Microsoft Edge in headless mode.
# Run from anywhere:  powershell -File scripts\build-cv.ps1
$root = Split-Path -Parent $PSScriptRoot
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$src  = "file:///" + ((Join-Path $root "cv\index.html") -replace "\\", "/")
$out  = Join-Path $root "Rownok-Rahman-CV.pdf"

& $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 "--print-to-pdf=$out" $src | Out-Null
Start-Sleep -Milliseconds 500
if (Test-Path $out) { "Built $out ($([math]::Round((Get-Item $out).Length / 1KB)) KB)" } else { throw "PDF was not created" }
