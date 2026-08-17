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
echo [1/6] Getting the latest work from GitHub...
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
echo [2/6] Building the shared game config...
cd /d "%ROOT%RoRebuildServer\GameConfig"
dotnet build -c Release --property WarningLevel=0
if errorlevel 1 goto :build_failed
echo.

rem --------------------------------------------------------------
echo [3/6] Building the shared data library and copying it to the client...
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
echo [4/6] Exporting the server data to the client...
cd /d "%ROOT%RoRebuildServer\DataToClientUtility"
dotnet build -c Release --property WarningLevel=0
if errorlevel 1 goto :build_failed
cd /d "%ROOT%RoRebuildServer\DataToClientUtility\bin\Release\net9.0"
DataToClientUtility.exe
if errorlevel 1 goto :export_failed
echo.

rem --------------------------------------------------------------
echo [5/6] Opening the network so a phone can reach the server...
rem The server listens on every network card now, but Windows still drops the
rem connection at the firewall unless it has been told not to. Adding the rule
rem needs administrator rights; without them this quietly does nothing and only
rem this PC can connect, which is exactly how it behaved before.
netsh advfirewall firewall show rule name="RagnarokRebuild 5000" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="RagnarokRebuild 5000" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
    if errorlevel 1 (
        echo   Could not add the firewall rule - not running as administrator.
        echo   Playing on this PC still works. To play from a phone, right click
        echo   this file and choose "Run as administrator" once.
    ) else (
        echo   Port 5000 opened for the local network.
    )
) else (
    echo   Port 5000 is already open.
)

rem The address the phone has to be given. Read from the machine rather than
rem written down, because the router hands out a different one often enough
rem that a number typed in here would be wrong by next week.
set "LANIP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    if not defined LANIP set "LANIP=%%A"
)
set "LANIP=%LANIP: =%"
echo.

rem --------------------------------------------------------------
echo [6/6] Starting the server...
rem netstat is asked for the exact port so that a stray 15000 or 50001 does not
rem read as a server already being up
set "STALESERVER="
netstat -an | findstr /C:":5000 " | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
    set "STALESERVER=1"
    echo   Something is already listening on port 5000, so it is left alone.
) else (
    start "RoRebuild Server" /d "%ROOT%RoRebuildServer\RoRebuildServer" cmd /k dotnet run
    echo   Opened in a window of its own.
    echo   Wait there for: Now listening on: http://localhost:5000
)

echo.
echo ==============================================================
if defined STALESERVER (
    echo   **************************************************************
    echo   THE SERVER WAS NOT RESTARTED.
    echo.
    echo   A server was already running on port 5000, so the one you
    echo   have is still the one that started before this run. It is
    echo   serving the OLD data and the OLD protocol number, while the
    echo   client you are about to play has just been given the new
    echo   ones. Logging in will fail with:
    echo.
    echo       your client protocol vNN does not match the server vNN
    echo.
    echo   Close the black RoRebuild Server window and run this file
    echo   again. Nothing else needs doing.
    echo   **************************************************************
    echo.
)
echo   Ready.
echo.
echo   On this PC:
echo     1. Switch to Unity and let it finish compiling.
echo     2. Check the Console has no red errors.
echo     3. Open Assets/Scenes/MainScene.unity and press Play.
echo.
if defined LANIP (
    echo   On a phone on the same wifi, open this in its browser:
    echo.
    echo       http://%LANIP%:5000/
    echo.
    echo   That only works once a WebGL build exists. See MOBILE.md.
) else (
    echo   Could not work out this PC's network address, so the phone
    echo   address cannot be shown. Run ipconfig and look for IPv4 Address.
)
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
