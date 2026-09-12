<#
    cleanspace.ps1 — ลบเฉพาะไฟล์ที่สร้างใหม่ได้ เพื่อเอาพื้นที่คืน

    ค่าเริ่มต้นคือ "ดูเฉย ๆ ไม่ลบ" ต้องใส่ -Go ถึงจะลบจริง
    รันจากที่ไหนก็ได้ มันหา root จากที่ตัวสคริปต์เองวางอยู่

        .\cleanspace.ps1          <- ดูว่าจะลบอะไร ได้คืนเท่าไหร่
        .\cleanspace.ps1 -Go      <- ลบจริง

    ของที่แตะ: build output เก่า, cache ของ Unity ตอน build, ไฟล์ชั่วคราว
    ของที่ไม่แตะเด็ดขาด: Assets ทั้งหมด (สไปรต์ที่ extract จาก GRF + ที่ import แล้ว),
    ไฟล์ .db (ตัวละคร), ProjectSettings, Packages, Library/Artifacts
#>
param(
    [switch]$Go,
    [switch]$IncludeDotnet   # ลบ bin/obj ของฝั่งเซิร์ฟเวอร์ด้วย (ต้อง dotnet build ใหม่)
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# ---- กันรันผิดที่ ---------------------------------------------------------
foreach ($marker in @('updateclient.bat', 'RebuildClient', 'RoRebuildServer')) {
    if (-not (Test-Path (Join-Path $root $marker))) {
        Write-Host "หยุด: ไม่เจอ '$marker' ใน $root" -ForegroundColor Red
        Write-Host "สคริปต์นี้ต้องวางไว้ที่ root ของโปรเจกต์ (ที่เดียวกับ updateclient.bat)"
        exit 1
    }
}

# ---- กัน Unity เปิดอยู่ ---------------------------------------------------
$unity = Get-Process -Name 'Unity' -ErrorAction SilentlyContinue
if ($unity) {
    Write-Host "หยุด: Unity ยังเปิดอยู่ ปิดก่อนแล้วค่อยรันใหม่" -ForegroundColor Red
    Write-Host "(มันถือไฟล์ใน Library กับ Temp ไว้ ลบไปจะพังครึ่ง ๆ)"
    exit 1
}

# ---- รายการที่จะลบ --------------------------------------------------------
$targets = @(
    @{ Path = 'RebuildClient\Library\Bee';               Why = 'cache ตอน build — ตัวที่ค้างครึ่งเพราะดิสก์เต็มอยู่ในนี้' }
    @{ Path = 'RebuildClient\Library\PlayerDataCache';   Why = 'cache ของ build player' }
    @{ Path = 'RebuildClient\Library\il2cpp_cache';      Why = 'cache ของ il2cpp' }
    @{ Path = 'RebuildClient\Library\BuildPlayerData';   Why = 'ข้อมูลชั่วคราวตอน build' }
    # ⛔ Library\com.unity.addressables จงใจไม่อยู่ในรายการนี้
    #
    # ชื่อมันหลอกว่าเป็น cache แต่ไม่ใช่ — profile ตั้ง LocalBuildPath ไว้ที่
    # [Addressables.BuildPath]/[BuildTarget] ซึ่งก็คือโฟลเดอร์นี้ และตอน build player
    # Unity จะ "ก๊อป" จากตรงนี้ไปใส่ StreamingAssets/aa
    #
    # ลบทิ้งแล้วไป build player เลยโดยไม่ได้ build addressables ใหม่ = ไม่มีอะไรให้ก๊อป
    # เกมจะโหลดขึ้นมาแล้วค้างที่ Loading... ตลอดกาล โดยมีร่องรอยเดียวคือ settings.json
    # ขึ้น 404 ใน Network tab ซึ่งไม่มีทางเดาถึงเลยว่าเกี่ยวกับการลบโฟลเดอร์นี้
    #
    # พื้นที่ที่ได้ไม่คุ้มกับการ build ใหม่อีกรอบ ถ้าจะลบจริง ๆ ต้อง build addressables
    # ใหม่ก่อน build player เสมอ
    @{ Path = 'RebuildClient\WebGL';                     Why = 'build เก่า 5 อัน ไม่มีอะไรอ้างถึง' }
    @{ Path = 'RebuildClient\StandaloneWindows64';       Why = 'build PC เก่า' }
    @{ Path = 'RebuildClient\Build';                     Why = 'build เก่าจากเมนู Build Everything' }
    @{ Path = 'RebuildClient\Temp';                      Why = 'ไฟล์ชั่วคราวของ Unity' }
    @{ Path = 'RebuildClient\Logs';                      Why = 'log' }
    @{ Path = 'RebuildClient\MemoryCaptures';            Why = 'memory capture' }
    @{ Path = 'RoRebuildServer\RoRebuildServer\bin\Debug\net9.0\WebClient'; Why = 'output ที่ค้างจาก build ที่พัง' }
    #ของสองอย่างนี้คือชุดไฟล์สำหรับขึ้น VPS ที่ publish.ps1 สร้าง — ตัวเกมทั้งตัวอยู่ในนั้น
    #สองชุด (กองที่ก๊อปไป กับ zip ที่บีบแล้ว) สั่ง publish.ps1 ใหม่ก็ได้คืนทั้งคู่
    @{ Path = 'RoRebuildServer\RoRebuildServer\bin\publish';   Why = 'กองไฟล์ที่ publish.ps1 ก๊อปไว้ก่อนบีบ zip' }
    @{ Path = 'rorebuild-server.zip';                            Why = 'zip สำหรับขึ้น VPS สร้างใหม่ได้' }
)

if ($IncludeDotnet) {
    foreach ($p in @('RoRebuildServer\RoRebuildServer', 'RoRebuildServer\RebuildSharedData',
                     'RoRebuildServer\DataToClientUtility', 'RoRebuildServer\GameConfig',
                     'RoRebuildServer\GameConfig.Generator', 'RoRebuildServer\RoServerScript')) {
        $targets += @{ Path = "$p\bin"; Why = 'ผลลัพธ์ build .NET (ต้อง dotnet build ใหม่)' }
        $targets += @{ Path = "$p\obj"; Why = 'ผลลัพธ์ build .NET (ต้อง dotnet build ใหม่)' }
    }
}

# ---- ตัวกันพลาดชั้นสุดท้าย -------------------------------------------------
# ถ้าเผลอพิมพ์ path ผิดจนไปโดนของที่กู้ไม่ได้ ให้ตายตรงนี้ก่อนลบ
$forbidden = @('\Assets', '\ProjectSettings', '\Packages', '\UserSettings',
               '\Library\Artifacts', '\Library\SourceAssetDB', '\Library\PackageCache',
               '\GameConfig\ServerData', '.db')
foreach ($t in $targets) {
    foreach ($bad in $forbidden) {
        if ($t.Path -like "*$bad*") {
            Write-Host "หยุด: รายการ '$($t.Path)' ไปโดนของต้องห้าม '$bad'" -ForegroundColor Red
            exit 1
        }
    }
}

# ---- วัดขนาด --------------------------------------------------------------
function Get-FolderGB($path) {
    if (-not (Test-Path $path)) { return $null }
    $sum = (Get-ChildItem $path -Recurse -File -Force -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
    if (-not $sum) { return 0.0 }
    return [math]::Round($sum / 1GB, 2)
}

$drive = (Get-Item $root).PSDrive.Name
$freeBefore = [math]::Round((Get-PSDrive $drive).Free / 1GB, 2)

Write-Host ""
Write-Host "โปรเจกต์: $root"
Write-Host "ไดรฟ์ ${drive}: เหลือ $freeBefore GB"
Write-Host ""
Write-Host "กำลังวัดขนาด (โฟลเดอร์ใหญ่ ๆ ใช้เวลาสักครู่)..." -ForegroundColor DarkGray
Write-Host ""

$found = @()
$total = 0.0
foreach ($t in $targets) {
    $full = Join-Path $root $t.Path
    $gb = Get-FolderGB $full
    if ($null -eq $gb) { continue }
    $found += [PSCustomObject]@{ GB = $gb; Path = $t.Path; Why = $t.Why; Full = $full }
    $total += $gb
}

if ($found.Count -eq 0) {
    Write-Host "ไม่เจออะไรให้ลบเลย" -ForegroundColor Yellow
    exit 0
}

$found | Sort-Object GB -Descending |
    Format-Table @{ L = 'GB'; E = { '{0,6:N2}' -f $_.GB } }, Path, Why -AutoSize | Out-String | Write-Host

Write-Host ("รวมที่จะได้คืน: {0:N2} GB  (จะเหลือประมาณ {1:N2} GB)" -f $total, ($freeBefore + $total)) -ForegroundColor Cyan
Write-Host ""

if (-not $Go) {
    Write-Host "นี่คือการดูเฉย ๆ ยังไม่ได้ลบอะไร" -ForegroundColor Yellow
    Write-Host "ถ้าโอเคแล้วรันใหม่แบบนี้:  .\cleanspace.ps1 -Go" -ForegroundColor Yellow
    if (-not $IncludeDotnet) {
        Write-Host "อยากลบ bin/obj ของเซิร์ฟเวอร์ด้วย:  .\cleanspace.ps1 -Go -IncludeDotnet" -ForegroundColor DarkGray
    }
    exit 0
}

# ---- ลบจริง ---------------------------------------------------------------
Write-Host "เริ่มลบ..." -ForegroundColor Green
foreach ($f in ($found | Sort-Object GB -Descending)) {
    Write-Host ("  {0,6:N2} GB  {1}" -f $f.GB, $f.Path) -NoNewline
    try {
        Remove-Item -LiteralPath $f.Full -Recurse -Force -ErrorAction Stop
        Write-Host "   ลบแล้ว" -ForegroundColor Green
    }
    catch {
        # path ยาวเกิน 260 ตัวอักษร Remove-Item มักแพ้ แต่ rd ของ cmd ผ่าน
        cmd /c rd /s /q "`"$($f.Full)`"" 2>$null
        if (Test-Path $f.Full) {
            Write-Host "   ลบไม่ได้: $($_.Exception.Message)" -ForegroundColor Red
        } else {
            Write-Host "   ลบแล้ว (ใช้ rd)" -ForegroundColor Green
        }
    }
}

$freeAfter = [math]::Round((Get-PSDrive $drive).Free / 1GB, 2)
Write-Host ""
Write-Host ("เสร็จ — ไดรฟ์ ${drive}: $freeBefore GB -> $freeAfter GB (ได้คืน {0:N2} GB)" -f ($freeAfter - $freeBefore)) -ForegroundColor Cyan
Write-Host ""
Write-Host "ขั้นต่อไป:" -ForegroundColor Yellow
Write-Host "  1. เปิด Unity (ครั้งนี้จะช้าหน่อย เพราะ cache ตอน build ถูกลบไป — สไปรต์ไม่ได้ import ใหม่)"
Write-Host "  2. Build -> Full Addressables Rebuild -> Build WebGL"
Write-Host "     (เมนูนี้ลงทะเบียนสไปรต์ใหม่ด้วย - Groups -> Build อย่างเดียวไม่ลงทะเบียน"
Write-Host "      สไปรต์ที่ยังไม่มีใน catalog จะกลายเป็น Poring ในเกม)" -ForegroundColor DarkGray
Write-Host "  3. File -> Build Profiles -> Build  (สร้างโฟลเดอร์ WebClient ใหม่ด้วย)"
if ($IncludeDotnet) {
    Write-Host "  0. อย่าลืม dotnet build ที่ RoRebuildServer ก่อนรันเซิร์ฟเวอร์" -ForegroundColor Red
}
