# 日記照片整理腳本:把「日記-diary」夾內的照片依日期搬進 YYYY.MM.DD 子資料夾
# 由 Claude 產生。冪等:已在子夾裡的檔案不會重複搬;可重複執行。
# 日期來源優先序:檔名(2026年8月27日 / 2026:8:27 / 2026-08-27 / 2026 8 27)→ EXIF 拍攝日 → 檔案修改日。
# 之後在各日期資料夾放一個 .txt(任意檔名、UTF-8),內容就是那天的日記文字;「開始更新」會讀進網站。
$ErrorActionPreference = 'Continue'
$base = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片\日記-diary'
if (-not (Test-Path -LiteralPath $base)) { Write-Host ("找不到資料夾: {0}" -f $base); Read-Host '按 Enter 關閉'; exit 1 }
Add-Type -AssemblyName System.Drawing
$exts = @('.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif')

function Get-DateFromName([string]$name) {
  if ($name -match '(\d{4})年(\d{1,2})月(\d{1,2})日') { return ('{0}.{1:D2}.{2:D2}' -f $matches[1], [int]$matches[2], [int]$matches[3]) }
  if ($name -match '(\d{4})[:\-\._\s](\d{1,2})[:\-\._\s](\d{1,2})') { return ('{0}.{1:D2}.{2:D2}' -f $matches[1], [int]$matches[2], [int]$matches[3]) }
  return $null
}
function Get-DateFromExif([string]$path) {
  try {
    $img = [System.Drawing.Image]::FromFile($path)
    try {
      $pi = $img.GetPropertyItem(0x9003)   # DateTimeOriginal "YYYY:MM:DD HH:MM:SS"
      $s = [System.Text.Encoding]::ASCII.GetString($pi.Value).Trim([char]0)
      if ($s -match '^(\d{4}):(\d{2}):(\d{2})') { return ('{0}.{1}.{2}' -f $matches[1], $matches[2], $matches[3]) }
    } finally { $img.Dispose() }
  } catch { }
  return $null
}

$moved = 0; $skipped = 0; $made = 0
Get-ChildItem -LiteralPath $base -File | Where-Object { $exts -contains $_.Extension.ToLower() } | ForEach-Object {
  $f = $_
  $d = Get-DateFromName $f.Name
  if (-not $d) { $d = Get-DateFromExif $f.FullName }
  if (-not $d) { $d = $f.LastWriteTime.ToString('yyyy.MM.dd') }
  $dir = Join-Path $base $d
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null; Write-Host ("建立資料夾 {0}" -f $d); $made++ }
  $dest = Join-Path $dir $f.Name
  if (Test-Path -LiteralPath $dest) { Write-Host ("已存在(跳過): {0}" -f $f.Name); $skipped++; return }
  try {
    Move-Item -LiteralPath $f.FullName -Destination $dest -ErrorAction Stop
    Write-Host ("OK  {0}  ->  {1}\" -f $f.Name, $d)
    $moved++
  } catch { Write-Host ("失敗: {0}  ({1})" -f $f.Name, $_.Exception.Message) }
}
Write-Host ''
Write-Host ("完成:建立 {0} 個日期夾,搬移 {1} 張,跳過 {2} 張。" -f $made, $moved, $skipped)
Write-Host '提示:在各日期資料夾放一個 .txt(UTF-8),內容就是那天的日記文字。'
Read-Host '按 Enter 關閉'
