@echo off
rem Opens the deck (index.html in this folder) in an Edge app window: no tabs and no address bar, so sharing that
rem window on Teams never shows the file path (with the user name). Works from any folder the deck is copied to,
rem paths with spaces and accents included. See LEEME.txt, "Presentar en el monitor de 57 pulgadas".
rem
rem   "Abrir presentacion.cmd" /url    only prints the URL it would open, in quotes (qa/test_player.py launcher_cmd)
rem
rem Edge ignores an --app value that is not ASCII and opens a new tab instead (measured 2026-10-20), so the folder,
rem taken from %%~dp0, goes as a file URL with those characters percent-encoded (UTF-8), built by PowerShell. If
rem PowerShell does not answer, the plain path, which works as long as it has no accents.
rem No --user-data-dir: Edge opens with its usual profile (a fresh one can show the first-run screens).
setlocal
set "DECK=%~dp0"
set "URL="
for /f "usebackq delims=" %%U in (`powershell -NoProfile -NonInteractive -Command "[uri]::new($env:DECK + 'index.html').AbsoluteUri" 2^>nul`) do set "URL=%%U"
if not defined URL goto plainurl
if /i not "%URL:~0,5%"=="file:" set "URL="
:plainurl
if not defined URL set "URL=file:///%DECK:\=/%index.html"
if /i "%~1"=="/url" (
  echo "%URL%"
  exit /b 0
)

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" goto open
rem elsewhere: wherever Windows has it registered as "msedge" (App Paths)
set "EDGE=msedge"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" /ve >nul 2>&1 && goto open
reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" /ve >nul 2>&1 && goto open
echo.
echo   No encuentro Microsoft Edge en esta computadora.
echo   Para verla igual: doble clic en index.html, en esta misma carpeta.
echo   Ojo: otro navegador muestra la barra de direcciones, con la ruta del archivo y tu usuario.
echo   En Teams no compartas esa ventana.
echo.
pause
exit /b 1

:open
start "" "%EDGE%" --app="%URL%"
exit /b 0
