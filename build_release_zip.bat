@echo off
setlocal

set "SCRIPT_NAME=%~nx0"
set "OUTPUT_ZIP=Doomstop-release.zip"

if exist "%OUTPUT_ZIP%" del /f /q "%OUTPUT_ZIP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = Get-Location;" ^
  "$outZip = Join-Path $root '%OUTPUT_ZIP%';" ^
  "$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {" ^
  "  $_.Name -ne 'README.md' -and" ^
  "  $_.Extension -ne '.zip' -and" ^
  "  $_.Name -ne '%SCRIPT_NAME%' -and" ^
  "  $_.FullName -notmatch '\\\.[^\\]+'" ^
  "};" ^
  "if (-not $files) { throw 'No files found to include in archive.' }" ^
  "$relativePaths = $files | ForEach-Object { Resolve-Path -Relative $_.FullName };" ^
  "Compress-Archive -Path $relativePaths -DestinationPath $outZip -Force;" ^
  "Write-Host ('Created: ' + $outZip)"

if errorlevel 1 (
  echo Failed to create archive.
  exit /b 1
)

echo Archive created successfully: %OUTPUT_ZIP%
endlocal
