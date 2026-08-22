Add-Type -AssemblyName System.Drawing
$files = @(
  'C:\zip2\public\ezgif-frame-003.jpg',
  'C:\zip2\public\ezgif-frame-015.jpg',
  'C:\zip2\public\ezgif-frame-021.jpg',
  'C:\zip2\public\ezgif-frame-033.jpg',
  'C:\zip2\public\ezgif-frame-051.jpg',
  'C:\zip2\public\ezgif-frame-072.jpg',
  'C:\zip2\public\ezgif-frame-100.jpg',
  'C:\zip2\public\ezgif-frame-150.jpg',
  'C:\zip2\public\ezgif-frame-200.jpg',
  'C:\zip2\public\ezgif-frame-239.jpg'
)
foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f)
  Write-Host "$([System.IO.Path]::GetFileName($f)): $($img.Width) x $($img.Height)"
  $img.Dispose()
}