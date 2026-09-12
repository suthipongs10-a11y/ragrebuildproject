# Builds the server bundle for the VPS on the Windows machine. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
# Output: rorebuild-server.tar in the repo root, holding the published server, ServerData,
# the walk data, the WebGL build (if one exists) and the GM seed file (if one exists).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srv  = Join-Path $root "RoRebuildServer\RoRebuildServer"
$out  = Join-Path $srv "bin\publish"

if (Test-Path $out) { Remove-Item $out -Recurse -Force }

dotnet publish (Join-Path $srv "RoRebuildServer.csproj") -c Release -o $out
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

# The published output already has a ServerData, and Copy-Item onto a folder that
# exists puts the source *inside* it rather than over it - so the bundle ends up
# with the build's copy at ServerData and the real one buried at
# ServerData\ServerData. The server reads the first, and the one file the build
# leaves out is missing from it. Clearing the destination first makes this copy
# mean what it reads as: the bundle's ServerData is the source folder, entire.
$serverData = Join-Path $out "ServerData"
if (Test-Path $serverData) { Remove-Item $serverData -Recurse -Force }
Copy-Item (Join-Path $root "RoRebuildServer\GameConfig\ServerData") $serverData -Recurse

$missing = @("Db\WeaponClass.csv", "Db\Maps.csv", "Db\Monsters.csv") |
    Where-Object { -not (Test-Path (Join-Path $serverData $_)) }
if ($missing) { throw "ServerData is incomplete - missing: $($missing -join ', ')" }

$walk = Join-Path $root "RebuildClient\Assets\Maps\exportdata"
if (Test-Path $walk) {
    Copy-Item $walk (Join-Path $out "walkdata") -Recurse
} else {
    Write-Warning "No walk data at $walk - import the maps in Unity first. Without it every map is treated as fully walkable."
}

# Where MOBILE.md sends the build, and where the server reads it from when you play
# locally, so the same folder that works on this machine is the one that ships. The second
# is where builds went before that was settled - still accepted, because a bundle quietly
# missing its web client is only discovered on the VPS.
$webCandidates = @(
    (Join-Path $srv "bin\Debug\net9.0\WebClient"),
    (Join-Path $root "RebuildClient\WebGL")
)
$web = $webCandidates | Where-Object { Test-Path (Join-Path $_ "index.html") } | Select-Object -First 1

if ($web) {
    Write-Host "Browser build: $web"
    $webOut = Join-Path $out "WebClient"
    Copy-Item $web $webOut -Recurse

    # Every build leaves a new Build_<timestamp> folder and none of them are cleaned up, so
    # a folder built in five times holds five copies of the game and index.html names one.
    # Dropping the other four off the copy is several hundred megabytes that do not have to
    # be zipped, uploaded over a home connection, and unpacked on a 2 GB box.
    $match = Select-String -Path (Join-Path $webOut "index.html") -Pattern 'buildUrl\s*=\s*"([^"]+)"' | Select-Object -First 1
    $wanted = if ($match) { $match.Matches[0].Groups[1].Value } else { $null }
    if ($wanted) {
        Get-ChildItem $webOut -Directory -Filter "Build_*" | Where-Object { $_.Name -ne $wanted } | ForEach-Object {
            Write-Host "  dropping stale build $($_.Name)"
            Remove-Item $_.FullName -Recurse -Force
        }
        if (-not (Test-Path (Join-Path $webOut $wanted))) {
            throw "index.html asks for $wanted and there is no such folder. The page would load and sit on 'Loading...' forever. Delete the old Build_* folders and build again."
        }
    }
} else {
    Write-Warning "No browser build found - players will not be able to play from a browser."
    Write-Warning "  Looked in: $($webCandidates -join ' and ')"
    Write-Warning "  Build one with File > Build Profiles > Web > Build, into the first of those. See MOBILE.md."
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

# tar, not Compress-Archive.
#
# Compress-Archive writes the names into the zip as UTF-8 and Info-ZIP's unzip on the
# server reads them back through a legacy codepage, so every sprite with a Korean
# name - which is every player sprite - lands under a mangled one: 10_\uB0A8.spr became
# 10_\u044B\u0412\u0438.spr. The catalogue still asks for the real name, nothing is there under it,
# and the player character simply does not render, while monsters and npcs, whose
# names are ascii, are all fine. The file count matches exactly, so nothing reads as
# missing and there is no error anywhere that mentions a name.
#
# Compress-Archive also cannot write an archive past 2 GB, and this bundle is at 1.8.
#
# tar has shipped with Windows since 10 1803 and passes the name bytes through
# untouched, which is the whole requirement.
$bundle = Join-Path $root "rorebuild-server.tar"
if (Test-Path $bundle) { Remove-Item $bundle }

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw "tar is not on the path. It ships with Windows 10 1803 and later; without it the bundle cannot be built safely, because Compress-Archive corrupts the Korean sprite names."
}

Push-Location $out
try {
    & tar.exe -cf $bundle .
    if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
}
finally { Pop-Location }

#The old zip would otherwise sit next to the new tar and get deployed by mistake.
$stale = Join-Path $root "rorebuild-server.zip"
if (Test-Path $stale) {
    Remove-Item $stale
    Write-Host "Removed the old rorebuild-server.zip - the bundle is a .tar now."
}

Write-Host "Bundle ready: $bundle"
