@echo off
title MonEspace - Lancement local

echo.
echo  ==========================================
echo   MonEspace - Lancement en local
echo  ==========================================
echo.

:: Backend
echo  [1/2] Demarrage du backend (NestJS)...
start "MonEspace - Backend" cmd /k "cd /d %~dp0backend && npm run start:dev"

:: Petite pause pour laisser le backend démarrer
timeout /t 3 /nobreak >nul

:: Frontend
echo  [2/2] Demarrage du frontend (Vite)...
start "MonEspace - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Backend  : http://localhost:3000
echo  Frontend : http://localhost:5173
echo.
echo  Les deux serveurs sont lances dans des fenetres separees.
echo  Ferme ces fenetres pour tout arreter.
echo.
pause
