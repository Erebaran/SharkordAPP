@echo off
setlocal

where cmake >nul 2>nul
if errorlevel 1 (
    echo CMake nao foi encontrado.
    echo Instale o Visual Studio Build Tools com "Desktop development with C++"
    echo e o componente CMake para Windows.
    exit /b 1
)

if not exist build mkdir build

cmake -S . -B build -A x64
if errorlevel 1 exit /b 1

cmake --build build --config Release
if errorlevel 1 exit /b 1

copy /Y ^
  build\Release\process-audio-capture.exe ^
  process-audio-capture.exe

echo.
echo Criado:
echo %CD%\process-audio-capture.exe
