param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Output
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "Missing source video: $Source" }

$projectRoot = Split-Path $PSScriptRoot -Parent
$interpolationFfmpeg = 'C:\Program Files\Live2D Cubism 5.3\tools\ffmpeg\ffmpeg.exe'
if (-not (Test-Path -LiteralPath $interpolationFfmpeg -PathType Leaf)) { throw "Interpolation FFmpeg not found: $interpolationFfmpeg" }

$compositor = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'remotion-pet\node_modules\.pnpm') -Directory -Filter '@remotion+compositor-win32-x64-msvc@*' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $compositor) { throw 'Remotion compositor tools were not found.' }
$encoderFfmpeg = Join-Path $compositor.FullName 'node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe'
if (-not (Test-Path -LiteralPath $encoderFfmpeg -PathType Leaf)) { throw "Encoder FFmpeg not found: $encoderFfmpeg" }

$outputParent = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
$frameDir = Join-Path ([IO.Path]::GetTempPath()) ('fafa-api-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $frameDir | Out-Null

try {
  & $interpolationFfmpeg -hide_banner -loglevel error -y -i $Source `
    -vf 'setpts=0.64*PTS,scale=384:416:flags=lanczos,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,colorkey=0x00FF00:0.30:0.08,despill=type=green:mix=0.65:expand=0.1,format=rgba' `
    -an (Join-Path $frameDir 'frame-%04d.png')
  if ($LASTEXITCODE -ne 0) { throw 'Frame interpolation or keying failed.' }

  & $encoderFfmpeg -v error -y -framerate 60 -i (Join-Path $frameDir 'frame-%04d.png') `
    -an -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1 `
    -crf 12 -b:v 0 -metadata:s:v:0 alpha_mode=1 $Output
  if ($LASTEXITCODE -ne 0) { throw 'VP9 Alpha encoding failed.' }
}
finally {
  Remove-Item -LiteralPath $frameDir -Recurse -Force -ErrorAction SilentlyContinue
}
