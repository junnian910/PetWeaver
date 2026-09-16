param(
  [string]$SourceDir,
  [string]$OutputDir,
  [string[]]$Actions
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $SourceDir) {
  $SourceDir = Join-Path $projectRoot 'asset-work\api-video-tests'
}
if (-not $OutputDir) {
  $OutputDir = Join-Path $SourceDir 'processed'
}

$sources = [ordered]@{
  act_spin = 'act_spin-wan26-flash-720p.mp4'
  act_flip_hair = 'act_flip_hair-wan26-flash-720p.mp4'
  act_roll = 'act_roll-wan26-flash-720p.mp4'
  act_hop = 'act_hop-green-wan26-flash-720p.mp4'
  act_sneeze = 'act_sneeze-wan26-flash-720p.mp4'
  act_dance = 'act_dance-wan26-flash-720p.mp4'
  act_ink = 'act_ink-wan26-flash-720p.mp4'
  act_firework = 'act_firework-wan26-flash-720p.mp4'
  special_lottery = 'special_lottery-wan26-flash-720p.mp4'
  state_move = 'state_move-wan26-flash-720p.mp4'
}

if (-not $Actions -or $Actions.Count -eq 0) {
  $Actions = @($sources.Keys)
}
foreach ($action in $Actions) {
  if (-not $sources.Contains($action)) {
    throw "Unknown AI action: $action"
  }
}

$interpolationFfmpeg = $env:FAFA_INTERPOLATION_FFMPEG
if (-not $interpolationFfmpeg) {
  $interpolationFfmpeg = 'C:\Program Files\Live2D Cubism 5.3\tools\ffmpeg\ffmpeg.exe'
}
if (-not (Test-Path -LiteralPath $interpolationFfmpeg -PathType Leaf)) {
  throw "Interpolation FFmpeg not found: $interpolationFfmpeg"
}

$encoderFfmpeg = $env:FAFA_FFMPEG
$ffprobe = $env:FAFA_FFPROBE
if (-not $encoderFfmpeg -or -not $ffprobe) {
  $pnpmRoot = Join-Path $projectRoot 'remotion-pet\node_modules\.pnpm'
  $compositor = Get-ChildItem -LiteralPath $pnpmRoot -Directory -Filter '@remotion+compositor-win32-x64-msvc@*' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $compositor) {
    throw 'Remotion compositor tools were not found. Run pnpm install in remotion-pet first.'
  }
  $toolRoot = Join-Path $compositor.FullName 'node_modules\@remotion\compositor-win32-x64-msvc'
  if (-not $encoderFfmpeg) { $encoderFfmpeg = Join-Path $toolRoot 'ffmpeg.exe' }
  if (-not $ffprobe) { $ffprobe = Join-Path $toolRoot 'ffprobe.exe' }
}
foreach ($tool in @($encoderFfmpeg, $ffprobe)) {
  if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
    throw "Media tool not found: $tool"
  }
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())

foreach ($action in $Actions) {
  $input = Join-Path $SourceDir $sources[$action]
  if (-not (Test-Path -LiteralPath $input -PathType Leaf)) {
    throw "Missing source for ${action}: $input"
  }

  $output = Join-Path $OutputDir "${action}.webm"
  $frameDir = Join-Path $tempRoot ("fafa-ai-${action}-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $frameDir | Out-Null
  Write-Host "[$action] interpolate, key and despill"

  try {
    $framePattern = Join-Path $frameDir 'frame-%04d.png'
    if ($action -eq 'state_move') {
      $filter = '[0:v]trim=start=0:end=2.5,setpts=PTS-STARTPTS,split=2[forward][reverse];[reverse]reverse[backward];[forward][backward]concat=n=2:v=1:a=0,setpts=0.64*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=384:416:flags=lanczos,colorkey=0x00FF00:0.30:0.08,despill=type=green:mix=0.65:expand=0.1,format=rgba[out]'
      & $interpolationFfmpeg -hide_banner -loglevel error -y -i $input `
        -filter_complex $filter -map '[out]' -an $framePattern
    }
    else {
      & $interpolationFfmpeg -hide_banner -loglevel error -y -i $input `
        -vf 'setpts=0.64*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=384:416:flags=lanczos,colorkey=0x00FF00:0.30:0.08,despill=type=green:mix=0.65:expand=0.1,format=rgba' `
        -an $framePattern
    }
    if ($LASTEXITCODE -ne 0) { throw "[$action] interpolation/keying failed" }

    & $encoderFfmpeg -v error -y -framerate 60 -i (Join-Path $frameDir 'frame-%04d.png') `
      -an -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1 `
      -crf 12 -b:v 0 -metadata:s:v:0 alpha_mode=1 $output
    if ($LASTEXITCODE -ne 0) { throw "[$action] VP9 Alpha encoding failed" }

    $probeJson = & $ffprobe -v error -select_streams v:0 `
      -show_entries 'stream=codec_name,width,height,avg_frame_rate:stream_tags=alpha_mode:format=duration' `
      -of json $output
    if ($LASTEXITCODE -ne 0) { throw "[$action] ffprobe failed" }
    $probe = $probeJson | ConvertFrom-Json
    $stream = $probe.streams[0]
    $duration = [double]$probe.format.duration
    if ($stream.codec_name -ne 'vp9' -or $stream.width -ne 384 -or $stream.height -ne 416 -or
        $stream.avg_frame_rate -ne '60/1' -or $stream.tags.ALPHA_MODE -ne '1' -or
        $duration -lt 3.1 -or $duration -gt 3.2) {
      throw "[$action] output metadata validation failed"
    }
    Write-Host "[$action] ready: $output"
  }
  finally {
    $resolved = [IO.Path]::GetFullPath($frameDir)
    if ($resolved.StartsWith($tempRoot) -and (Split-Path $resolved -Leaf).StartsWith("fafa-ai-${action}-")) {
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
}
