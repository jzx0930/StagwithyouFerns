# 鹿角蕨品種株改名(原生種=種小名;品種=英文園藝名/交種式)。由 Claude 產生,查證來源見對話。
$ErrorActionPreference = 'Continue'
$base = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片\Platycerium-鹿角蕨'

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
Rn '檸檬' 'Lemoinei-檸檬'
Rn '羅賓' 'Robin-羅賓'

Write-Host ''
Write-Host '=== 鹿角蕨:2026-07-17 詳查補(品種/交種/選拔)==='
Rn '雷達' 'Raider-雷達'
Rn '艾沙' 'Elsa-艾沙'
Rn '獅子座' 'Leo-獅子座'
Rn '二叉' 'bifurcatum-二叉'
Rn '爪哇' 'willinckii-爪哇'
Rn '史迪奇' 'Stitch-史迪奇'
Rn '奶油獅' 'CreamLion-奶油獅'
Rn '白妖爪' 'UnguisAlbi-白妖爪'
Rn '白玫瑰' 'WhiteRose-白玫瑰'
Rn '多佛朗明哥' 'Flamenco-多佛朗明哥'
Rn '信仰者 P.Beliver' 'Believer-信仰者'

Write-Host ''
Write-Host '=== 鹿角蕨:2026-07-20 開始更新補(侏儒/交種)==='
Rn '珍妮' 'Jenny-珍妮'
Rn '三叉戟' 'Trident-三叉戟'
Rn '玉女' 'JadeGirl-玉女'
Rn '侏儒塔蘇塔' 'DwarfTatsuta-侏儒塔蘇塔'

Write-Host ''
Write-Host '=== 鹿角蕨:2026-07-22 新植物整理夾名(英文-中文)==='
Rn 'P. Foong SiQi 捲捲鹿' 'FoongSiQi-捲捲鹿'
Rn 'P. Monkoy North-北猴' 'MonkoyNorth-北猴'
Rn 'P.willinckii Yellow moon-黃月' 'YellowMoon-黃月'
Rn 'P. Hakuna Matata-馬塔塔' 'HakunaMatata-馬塔塔'
Rn 'P.blue vista-藍景' 'BlueVista-藍景'

Write-Host ''
Write-Host '完成。純英文(Akki/Nano/E/YAL/OMG/Namo/Blue Ribbon)未動;雷電交種式維持中文。'
Read-Host '按 Enter 關閉'
