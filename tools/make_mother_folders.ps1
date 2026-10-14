# 在「鹿角蕨-Platycerium」每個個體(#NN)建立「母株」子資料夾;
# 沒有個體編號的種,則在該種資料夾內建立「母株」。
# 由 Claude 產生。冪等:已存在就跳過。會同步回 Google Drive。
$ErrorActionPreference = 'Continue'
$root = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片\鹿角蕨-Platycerium'

if (-not (Test-Path -LiteralPath $root)) { Write-Host ("找不到鹿角蕨資料夾: {0}" -f $root); Read-Host '按 Enter 關閉'; exit }

function MakeMother($dir) {
  $m = Join-Path $dir '母株'
  if (Test-Path -LiteralPath $m) { Write-Host ("跳過(已存在): {0}" -f $m) }
  else { try { New-Item -ItemType Directory -Path $m -ErrorAction Stop | Out-Null; Write-Host ("建立: {0}" -f $m) } catch { Write-Host ("失敗 {0} : {1}" -f $m, $_.Exception.Message) } }
}

$made = 0
Get-ChildItem -LiteralPath $root -Directory | ForEach-Object {
  $plant = $_.FullName
  # 個體子夾:名稱以 # 開頭(例 #01)
  $indivs = Get-ChildItem -LiteralPath $plant -Directory | Where-Object { $_.Name -like '#*' }
  if ($indivs.Count -gt 0) {
    foreach ($iv in $indivs) { MakeMother $iv.FullName; $made++ }
  } else {
    MakeMother $plant; $made++
  }
}
Write-Host ''
Write-Host ("完成,共處理 {0} 個位置。" -f $made)
Read-Host '按 Enter 關閉'
