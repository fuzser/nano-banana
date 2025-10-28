@echo off
chcp 65001 >nul
setlocal

:: ==============================
:: 配置
:: ==============================
set BACKEND_DIR=backend
set FRONTEND_FILE=frontend\index.html
set BACKEND_PORT=3000

echo.
echo ==============================
echo 🖥 开始启动 AI-image 项目
echo ==============================
echo.

:: ==============================
:: 1️⃣ 检查并安装 backend 依赖
:: ==============================
cd /d %BACKEND_DIR%
if not exist node_modules (
    echo ⚙️  node_modules 不存在，正在执行 npm install...
    npm install express multer node-fetch cors
    if errorlevel 1 (
        echo.
        echo ❌ npm install 失败！请检查是否已安装 Node.js
        echo 📥 下载地址: https://nodejs.org/
        echo.
        pause
        exit
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ backend 已安装依赖
)
echo.

:: ==============================
:: 2️⃣ 启动后端 server.js
:: ==============================
echo 🚀 启动后端服务器...
start "AI-image Backend" cmd /k "node server.js"
echo ✅ 后端已在新窗口启动
echo.

:: ==============================
:: 3️⃣ 等待并打开前端页面
:: ==============================
echo ⏳ 等待后端启动...
timeout /t 3 >nul
echo 🌐 打开前端页面...
cd /d "%~dp0"
start "" "%FRONTEND_FILE%"

echo.
echo ==============================
echo ✅ 项目启动完成
echo ==============================
echo 📌 后端地址: http://localhost:%BACKEND_PORT%
echo 📌 如需停止，请关闭后端窗口
echo ==============================
echo.