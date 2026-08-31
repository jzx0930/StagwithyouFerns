# 修正資料夾命名:確保為「中文-學名」且學名每個詞彙開頭大寫。可重複執行(冪等)。
# 由 Claude 產生。同步回 Google Drive。個體 #夾、純英文暱稱夾不動。
$ErrorActionPreference = 'Continue'
$OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片'

function TitleCaseLatin($s) {
  ($s -split ' ' | ForEach-Object {
    $w = $_
    if ($w.Length -gt 0) {
      for ($k = 0; $k -lt $w.Length; $k++) {
        if ([char]::IsLetter($w[$k])) { $w = $w.Substring(0,$k) + ([string]$w[$k]).ToUpper() + $w.Substring($k+1); break }
      }
    }
    $w
  }) -join ' '
}
function Fix($name) {
  if ($name.StartsWith("#")) { return $null }   # 個體夾不動
  $fi = $name.IndexOf('-'); if ($fi -lt 1) { return $null }
  $leftFirst = $name.Substring(0, $fi)
  if ($leftFirst -match '[^\x00-\x7F]') {
    # 已是「中文-學名」:右半應為學名(全英數),大寫之
    $zh = $leftFirst; $latin = $name.Substring($fi + 1)
    if ($latin -match '[^\x00-\x7F]') { return $null }        # 右半還有中文 -> 兩邊中文,不動
    $new = $zh + '-' + (TitleCaseLatin $latin)
  } else {
    # 可能是「學名-中文」(未翻):用最後一個 '-' 切,翻+大寫
    $li = $name.LastIndexOf('-'); $latin = $name.Substring(0, $li); $zh = $name.Substring($li + 1)
    if (-not ($zh -match '[^\x00-\x7F]')) { return $null }     # 右半非中文 -> 純英文,不動
    if ($latin -match '[^\x00-\x7F]') { return $null }         # 左半含中文 -> 不動
    $new = $zh + '-' + (TitleCaseLatin $latin)
  }
  if ($new -eq $name) { return $null }
  return $new
}
function DoRename($dir) {
  $new = Fix $dir.Name; if (-not $new) { return }
  $target = Join-Path $dir.Parent.FullName $new
  if (Test-Path -LiteralPath $target) { Write-Host ("已存在跳過: {0}" -f $new); return }
  try { Rename-Item -LiteralPath $dir.FullName -NewName $new -ErrorAction Stop; Write-Host ("OK  {0}  ->  {1}" -f $dir.Name, $new) }
  catch { Write-Host ("失敗 {0} : {1}" -f $dir.Name, $_.Exception.Message) }
}

if (-not (Test-Path -LiteralPath $base)) { Write-Host ("找不到: {0}" -f $base); Read-Host '按 Enter 關閉'; exit }
Write-Host '=== 植物夾(翻轉/大寫學名)==='
Get-ChildItem -LiteralPath $base -Directory | ForEach-Object {
  Get-ChildItem -LiteralPath $_.FullName -Directory | ForEach-Object { DoRename $_ }
}
Write-Host ''
Write-Host '=== 分類夾 ==='
Get-ChildItem -LiteralPath $base -Directory | ForEach-Object { DoRename $_ }
Write-Host ''
Write-Host '完成:皆為「中文-學名」且學名詞首大寫。個體#夾與純英文暱稱夾未動。'
Write-Host '若幾乎沒有 OK 行代表已全部正確、無需變更。'
Read-Host '按 Enter 關閉'
