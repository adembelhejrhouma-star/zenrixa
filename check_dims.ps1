Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('C:\zip2\public\ezgif-frame-003.jpg')
Write-Host "Width: $($img.Width)"
Write-Host "Height: $($img.Height)"
$img.Dispose()