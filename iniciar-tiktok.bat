@echo off
chcp 65001 >nul
title CAOS LIVE - TikTok Bridge
cd /d "%~dp0"
echo.
echo ========================================
echo        CAOS LIVE - TIKTOK BRIDGE
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  echo Instale o Node.js LTS e rode este arquivo novamente.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Falha no npm install.
    pause
    exit /b 1
  )
)
echo.
echo Iniciando bridge local...
echo Deixe esta janela aberta durante a LIVE.
echo.
call npm run tiktok
pause
