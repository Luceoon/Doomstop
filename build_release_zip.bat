@echo off
setlocal

set "SCRIPT_NAME=%~nx0"
set "OUTPUT_ZIP=Doomstop-release.zip"

if exist "%OUTPUT_ZIP%" del /f /q "%OUTPUT_ZIP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = Get-Location;" ^
  "$outZip = Join-Path $root '%OUTPUT_ZIP%';" ^
  "$includePaths = @(" ^
  "  'manifest.json'," ^
  "  'config.json'," ^
  "  'icon.svg'," ^
  "  'assets'," ^
  "  'pages'," ^
  "  'scripts'" ^
  ");" ^
  "$archiveInputs = $includePaths | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ };" ^
  "if (-not $archiveInputs) { throw 'No extension files found to include in archive.' }" ^
  "Compress-Archive -Path $archiveInputs -DestinationPath $outZip -Force;" ^
  "Write-Host ('Created: ' + $outZip)"

if errorlevel 1 (
  echo Failed to create archive.
  exit /b 1
)

echo Archive created successfully: %OUTPUT_ZIP%
endlocal
