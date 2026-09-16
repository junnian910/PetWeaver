$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ffprobe = Join-Path $root 'remotion-pet/node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.506/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'
$files = Get-ChildItem (Join-Path $root 'public/assets/videos') -Recurse -Filter *.webm
$rows = foreach ($f in $files) {
  $json = & $ffprobe -v error -show_streams -show_format -of json $f.FullName | ConvertFrom-Json
  $stream = $json.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
  $fps = 0
  if ($stream.avg_frame_rate -match '^(d+)/(d+)$') { $fps = [math]::Round([int]$Matches[1] / [int]$Matches[2], 2) }
  $rel = $f.FullName.Substring($root.Length + 1).Replace([char]92, '/')
  [PSCustomObject]@{
    file = $rel
    codec = $stream.codec_name
    size = "$($stream.width)x$($stream.height)"
    fps = $fps
    dur = [math]::Round([double]$stream.duration, 2)
    alpha = $stream.tags.alpha_mode
    frames = [math]::Round([double]$stream.nb_frames)
  }
}
$rows | Sort-Object file | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $PSScriptRoot 'video-audit.json')
$rows | Sort-Object file | Format-Table -AutoSize | Out-String -Width 220
