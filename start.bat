@echo off
chcp 65001 >nul
title 3L投研平台

echo 启动Agent后端服务...
start "Backend" cmd /c "python agent-service/main.py --server --port 8001"

timeout /t 3 /nobreak >nul

echo 启动Next.js前端...
start "Frontend" cmd /c "npm run dev"

echo.
echo 前端: http://localhost:3000
echo 后端: http://localhost:8001
pause