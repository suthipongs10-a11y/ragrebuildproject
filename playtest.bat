@echo off
setlocal

rem One click to start playing. Nothing is rebuilt and nothing is pulled: this
rem starts the server, waits until it is actually answering, and hands you the
rem address to open on a phone.
rem
rem Use updateclient.bat instead when anything under ServerData has changed, or
rem after pulling new work. That one rebuilds the libraries and re-exports the
rem data, then starts the server the same way this does.

set "ROOT=%~dp0"
set "PORT=5000"
cd /d "%ROOT%"

echo ==============================================================
echo   RagnarokRebuild  -  play test
echo ==============================================================
echo.

rem --------------------------------------------------------------
echo [1/4] Checking the browser build...
set "WEBCLIENT=%ROOT%RoRebuildServer\RoRebuildServer\bin\Debug\net9.0\WebClient"
if exist "%WEBCLIENT%\index.html" (
    echo   Found one at:
    echo     %WEBCLIENT%
    rem index.html is rewritten after every build to name the folder the build
    rem actually went into, so reading it back is proof the build landed rather
    rem than a guess that it did
    for /f "tokens=2 delims== " %%A in ('findstr /C:"buildUrl" "%WEBCLIENT%\index.html"') do (
        echo   Serving build: %%~A
    )
) else (
    echo   No browser build yet - only this PC will be able to play,
    echo   through the Unity editor. See MOBILE.md to make one.
)
echo.

rem --------------------------------------------------------------
echo [2/4] Opening the network so a phone can reach the server...
netsh advfirewall firewall show rule name="RagnarokRebuild %PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="RagnarokRebuild %PORT%" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
    if errorlevel 1 (
        echo   Could not add the firewall rule - not running as administrator.
        echo   Playing on this PC still works. To play from a phone, right click
        echo   this file and choose "Run as administrator" once.
    ) else (
        echo   Port %PORT% opened for the local network.
    )
) else (
    echo   Port %PORT% is already open.
)

rem Read from the machine rather than written down, because the router hands out
rem a different one often enough that a number typed in here would go stale.
set "LANIP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    if not defined LANIP set "LANIP=%%A"
)
set "LANIP=%LANIP: =%"
echo.

rem --------------------------------------------------------------
echo [3/4] Starting the server...
netstat -an | findstr /C:":%PORT% " | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
    echo   Something is already listening on port %PORT%, so it is left alone.
    echo   If that is an old server holding stale data, close its window and
    echo   run this file again.
    goto :ready
)

rem --urls is passed rather than trusted to configuration. appsettings.json asks
rem for 0.0.0.0 so a phone can reach it, but any ASPNETCORE_URLS in the
rem environment would quietly win and bind localhost only - and the symptom of
rem that is a phone that cannot connect while the PC works fine, which reads
rem like a firewall or wifi problem and is neither.
start "RoRebuild Server" /d "%ROOT%RoRebuildServer\RoRebuildServer" cmd /k dotnet run --launch-profile RoRebuildServer -- --urls http://0.0.0.0:%PORT%
echo   Opened in a window of its own. Waiting for it to answer...

set /a WAITED=0
:waitloop
rem the port is asked for exactly, so a stray 15000 or 50001 does not read as
rem the server being up
netstat -an | findstr /C:":%PORT% " | findstr /C:"LISTENING" >nul
if not errorlevel 1 goto :serverup
set /a WAITED+=2
if %WAITED% geq 60 (
    echo.
    echo   Still not answering after %WAITED% seconds. Look at the server window:
    echo     * a wall of red usually means a script error under ServerData
    echo     * "address already in use" means an old server is still running
    echo     * nothing at all means the first build is still going, give it longer
    goto :ready
)
timeout /t 2 /nobreak >nul
goto :waitloop

:serverup
echo   Answering after %WAITED% seconds.

:ready
echo.

rem --------------------------------------------------------------
echo [4/4] Opening the game on this PC...
if exist "%WEBCLIENT%\index.html" (
    start "" http://localhost:%PORT%/
    echo   Opened in your browser. Closing that tab does not stop the server.
) else (
    echo   Skipped - no browser build. Press Play in Unity instead.
)

echo.
echo ==============================================================
echo   Ready.
echo.
if defined LANIP (
    echo   On a phone on the same wifi:
    echo.
    echo       http://%LANIP%:%PORT%/
    echo.
) else (
    echo   Could not work out this PC's network address. Run ipconfig
    echo   and look for IPv4 Address.
    echo.
)
echo   Testing guilds with more than one account: each browser tab is
echo   its own login, so the PC can hold two and the phone a third.
echo.
echo   Leave the server window open the whole time you are playing.
echo   Closing it is how you stop the server.
echo ==============================================================
echo.
pause
exit /b 0
