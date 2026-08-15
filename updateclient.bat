@echo off
setlocal

rem One click that takes the project from a fresh pull all the way to a running
rem server, so a play test is this file and then the Play button in Unity.
rem
rem Everything below works off the folder this file lives in rather than off
rem whatever folder the console happened to start in, so it can be double
rem clicked from anywhere and still find the project.
rem
rem It still does everything the original script did, in the same order, and is
rem still the thing to run after editing anything under ServerData.

set "ROOT=%~dp0"
set "BRANCH=claude/ragnarok-rebuild-m0-3cf60r"
cd /d "%ROOT%"

echo ==============================================================
echo   RagnarokRebuild  -  play test setup
echo ==============================================================
echo.

rem --------------------------------------------------------------
echo [1/5] Getting the latest work from GitHub...
echo.
rem The two libraries are kept in the repository but are also rebuilt further
rem down, so a local build left over from last time is thrown away first. Without
rem this, git refuses to pull over its own tracked files and the run stalls on
rem something that was about to be regenerated anyway.
git checkout -- "RebuildClient/Assets/Data/GameConfig.dll" "RebuildClient/Assets/Data/RebuildSharedData.dll" 2>nul
git pull origin %BRANCH%
if errorlevel 1 (
    echo.
    echo   ----------------------------------------------------------
    echo   COULD NOT PULL. Carrying on with the files already on disk,
    echo   so nothing you have here is lost - but you may not be
    echo   testing the newest work. Read the message above:
    echo     * "local changes would be overwritten" means you have
    echo       edits here that have not been committed.
    echo     * "'git' is not recognized" means git is not installed
    echo       or is not on the PATH.
    echo   ----------------------------------------------------------
    echo.
) else (
    echo.
    echo   Now on:
    git --no-pager log --oneline -1
    echo.
)

rem --------------------------------------------------------------
echo [2/5] Building the shared game config...
cd /d "%ROOT%RoRebuildServer\GameConfig"
dotnet build -c Release --property WarningLevel=0
if errorlevel 1 goto :build_failed
echo.

rem --------------------------------------------------------------
echo [3/5] Building the shared data library and copying it to the client...
cd /d "%ROOT%RoRebuildServer\RebuildSharedData"
dotnet build -c Release --property WarningLevel=0
if errorlevel 1 goto :build_failed

if not exist "%ROOT%RebuildClient\Assets\Data\" mkdir "%ROOT%RebuildClient\Assets\Data\"
copy /b/v/y "%ROOT%RoRebuildServer\GameConfig\bin\Release\netstandard2.0\GameConfig.dll" "%ROOT%RebuildClient\Assets\Data\GameConfig.dll"
if errorlevel 1 goto :copy_failed
copy /b/v/y "%ROOT%RoRebuildServer\RebuildSharedData\bin\Release\netstandard2.1\RebuildSharedData.dll" "%ROOT%RebuildClient\Assets\Data\RebuildSharedData.dll"
if errorlevel 1 goto :copy_failed
echo.

rem --------------------------------------------------------------
echo [4/5] Exporting the server data to the client...
cd /d "%ROOT%RoRebuildServer\DataToClientUtility"
dotnet build -c Release --property WarningLevel=0
if errorlevel 1 goto :build_failed
cd /d "%ROOT%RoRebuildServer\DataToClientUtility\bin\Release\net9.0"
DataToClientUtility.exe
if errorlevel 1 goto :export_failed
echo.

rem --------------------------------------------------------------
echo [5/5] Starting the server...
rem netstat is asked for the exact port so that a stray 15000 or 50001 does not
rem read as a server already being up
netstat -an | findstr /C:":5000 " | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
    echo   Something is already listening on port 5000, so it is left alone.
    echo   If that is an old server holding stale data, close its window and
    echo   run this file again.
) else (
    start "RoRebuild Server" /d "%ROOT%RoRebuildServer\RoRebuildServer" cmd /k dotnet run
    echo   Opened in a window of its own.
    echo   Wait there for: Now listening on: http://localhost:5000
)

echo.
echo ==============================================================
echo   Ready.
echo.
echo   1. Switch to Unity and let it finish compiling.
echo   2. Check the Console has no red errors.
echo   3. Open Assets/Scenes/MainScene.unity and press Play.
echo.
echo   Leave the server window open the whole time you are playing.
echo ==============================================================
echo.
pause
exit /b 0

rem --------------------------------------------------------------
:build_failed
echo.
echo   **************************************************************
echo   A BUILD FAILED. Unity will not compile until this is fixed.
echo   The error is in the text above - copy it and send it to Claude.
echo   If it says 'dotnet' is not recognized, install the .NET 9 SDK.
echo   **************************************************************
echo.
pause
exit /b 1

:copy_failed
echo.
echo   **************************************************************
echo   COULD NOT COPY THE LIBRARIES INTO THE CLIENT.
echo   This is usually Unity holding the old file open. Close Unity
echo   and run this file again.
echo   **************************************************************
echo.
pause
exit /b 1

:export_failed
echo.
echo   **************************************************************
echo   THE DATA EXPORT FAILED. The client will be reading stale data.
echo   Copy the error above and send it to Claude.
echo   **************************************************************
echo.
pause
exit /b 1
