# 鹿角蕨品種株改名(原生種=種小名;品種=英文園藝名/交種式)。由 Claude 產生,查證來源見對話。
$ErrorActionPreference = 'Continue'
$base = 'G:\我的雲端硬碟\植物照片\Platycerium-鹿角蕨'

function Rn($old, $new) {
  $full = Join-Path $base $old
  if (-not (Test-Path -LiteralPath $full)) { Write-Host ("找不到(跳過): {0}" -f $old); return }
  $target = Join-Path $base $new
  if (Test-Path -LiteralPath $target) { Write-Host ("已存在(跳過): {0}" -f $new); return }
  try { Rename-Item -LiteralPath $full -NewName $new -ErrorAction Stop; Write-Host ("OK  {0}  ->  {1}" -f $old, $new) }
  catch { Write-Host ("失敗 {0} : {1}" -f $old, $_.Exception.Message) }
}

Write-Host '=== 鹿角蕨:原生種(種小名)==='
Rn '三角' 'stemaria-三角'
Rn '四叉' 'quadridichotomum-四叉'
Rn '何其美' 'holttumii-何其美'
Rn '亞猴' 'ridleyi-亞猴'
Rn '非猴' 'madagascariense-非猴'
Rn '巨獸' 'grande-巨獸'
Rn '巨大' 'superbum-巨大'
Rn '白鹿' 'bifurcatum-白鹿'
Rn '銀葉立葉' 'veitchii-銀葉立葉'
Rn '奧銀' 'veitchii-奧銀'

Write-Host ''
Write-Host '=== 鹿角蕨:品種/交種(英文園藝名)==='
Rn '藝伎' 'Geisha-藝伎'
Rn '獨角獸' 'Unicorn-獨角獸'
Rn '美猴王' 'ridleyi-美猴王'
Rn '銀華' 'Ginka-銀華'
Rn '金童' 'GoldenBoy-金童'
Rn '飛飛達爾文' 'Darwin-飛飛達爾文'
Rn '三角四叉' 'AfricanOddity-三角四叉'

Write-Host ''
Write-Host '完成。以下查不到可靠名稱,維持中文未改:雷達、情花few、艾沙、獅子座。'
Write-Host 'Akki、Nano、E 本身已是英文,未動。'
Read-Host '按 Enter 關閉'
