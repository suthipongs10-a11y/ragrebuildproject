# Builds the server bundle for the VPS on the Windows machine. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
# Output: rorebuild-server.zip in the repo root, holding the published server, ServerData,
# the walk data, the WebGL build (if one exists) and the GM seed file (if one exists).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srv  = Join-Path $root "RoRebuildServer\RoRebuildServer"
$out  = Join-Path $srv "bin\publish"

if (Test-Path $out) { Remove-Item $out -Recurse -Force }

dotnet publish (Join-Path $srv "RoRebuildServer.csproj") -c Release -o $out
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

Copy-Item (Join-Path $root "RoRebuildServer\GameConfig\ServerData") (Join-Path $out "ServerData") -Recurse

$walk = Join-Path $root "RebuildClient\Assets\Maps\exportdata"
if (Test-Path $walk) {
    Copy-Item $walk (Join-Path $out "walkdata") -Recurse
} else {
    Write-Warning "No walk data at $walk - import the maps in Unity first. Without it every map is treated as fully walkable."
}

$web = Join-Path $root "RebuildClient\WebGL"
if (Test-Path (Join-Path $web "index.html")) {
    Copy-Item $web (Join-Path $out "WebClient") -Recurse
} else {
    Write-Warning "No WebGL build at $web - browser play is off until one is built there (File > Build Settings > WebGL, output folder RebuildClient\WebGL)."
}

$gm = Join-Path $srv "GmAccount.local.json"
if (Test-Path $gm) {
    Copy-Item $gm $out
} else {
    Write-Warning "No GmAccount.local.json - the server will not create the GM account by itself."
}

# never ship a database, the local keys, the script cache or logs
Get-ChildItem $out -Filter "RoCharacterDatabase.db*" | Remove-Item -Force
foreach ($dir in @("Keys", "Cache", "Logs")) {
    $d = Join-Path $out $dir
    if (Test-Path $d) { Remove-Item $d -Recurse -Force }
}

$zip = Join-Path $root "rorebuild-server.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip
Write-Host "Bundle ready: $zip"
