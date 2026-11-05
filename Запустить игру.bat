@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Своя игра — не закрывай это окно во время игры
where py >nul 2>nul && (py -3 server.py & goto :end)
where python >nul 2>nul && (python server.py & goto :end)
if exist "%LOCALAPPDATA%\Programs\Python" for /d %%P in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%P\python.exe" ("%%P\python.exe" server.py & goto :end)
echo.
echo Не найден Python. Установи его: https://www.python.org/downloads/
echo (при установке поставь галочку "Add python.exe to PATH") и запусти этот файл снова.
:end
pause
