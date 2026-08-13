@echo off
title PixelCraft 打包工具
echo ========================================
echo  PixelCraft 打包工具
echo ========================================
echo.

:: 设置 Python 路径
set PYTHON=C:\Users\30408\AppData\Local\Programs\Python\Python312\python.exe

:: 检查 Python
if not exist "%PYTHON%" (
    echo [错误] 找不到 Python
    echo 请修改 pack.bat 中的 PYTHON 路径
    pause
    exit /b 1
)

:: 创建虚拟环境
if not exist "env" (
    echo [1/4] 创建虚拟环境...
    %PYTHON% -m venv env
) else (
    echo [1/4] 虚拟环境已存在
)

:: 激活虚拟环境
echo [2/4] 激活虚拟环境...
call env\Scripts\activate

:: 安装依赖
echo [3/4] 安装依赖...
pip install pyautogui pyinstaller -q

:: 打包
echo [4/4] 开始打包...
python build.py

:: 复制到项目目录
if exist "dist\PixelCraft.exe" (
    copy /Y "dist\PixelCraft.exe" "PixelCraft.exe"
    echo.
    echo [OK] 已复制 PixelCraft.exe 到项目目录
)

:: 退出虚拟环境
call deactivate

echo.
echo 打包完成！
pause
