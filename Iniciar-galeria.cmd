@echo off
cd /d "%~dp0"
set "GALERIA_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "GALERIA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo Galeria entre fases - Realidad aumentada
echo Abre http://127.0.0.1:8788 cuando aparezca Ready.
echo Deja esta ventana abierta. Ctrl+C detiene el servidor.
"%GALERIA_NODE%" scripts/run.mjs wrangler pages dev dist --ip 127.0.0.1 --port 8788
pause
