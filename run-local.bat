@echo off
REM ============================================================
REM  Ledgerline Invoice Decision Engine - one-click local runner
REM  (Windows)  Run me from the project folder:  run-local.bat
REM ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node 18+ from https://nodejs.org and re-run.
  pause & exit /b 1
)

if not exist .env.local (
  copy .env.example .env.local >nul
  echo.
  echo [SETUP] Created .env.local from .env.example.
  echo   - Open .env.local and paste your ANTHROPIC_API_KEY to enable LLM extraction.
  echo   - Leave it blank and the app still works: it falls back to the local heuristic parser.
)

if not exist node_modules (
  echo [SETUP] First run - installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed - check your network/registry access and try again.
    pause & exit /b 1
  )
)

if not exist public\samples\sample-01-happy.pdf (
  echo [SETUP] Generating demo invoices...
  node scripts\make-samples.js
)

echo.
echo ============================================================
echo   Ledgerline Invoice Decision Engine
echo   Starting at  http://localhost:3000
echo   (Ctrl+C stops the server; session state resets on restart)
echo ============================================================
call npm run dev
pause
