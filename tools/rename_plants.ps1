# 植物照片 資料夾改名腳本(分類=屬名-中文;植物=種小名-中文)
# 由 Claude 產生。改名會同步回 Google Drive。原名有保留在中文部分。
$ErrorActionPreference = 'Continue'
$base = 'G:\我的雲端硬碟\植物照片'

function Rn($rel, $new) {
  $full = Join-Path $base $rel
  if (-not (Test-Path -LiteralPath $full)) { Write-Host ("找不到(跳過): {0}" -f $rel); return }
  $parent = Split-Path -LiteralPath $full
  $target = Join-Path $parent $new
  if (Test-Path -LiteralPath $target) { Write-Host ("已存在(跳過): {0}" -f $new); return }
  try { Rename-Item -LiteralPath $full -NewName $new -ErrorAction Stop; Write-Host ("OK  {0}  ->  {1}" -f $rel, $new) }
  catch { Write-Host ("失敗 {0} : {1}" -f $rel, $_.Exception.Message) }
}

Write-Host '=== 植物夾改名 ==='
# 棒槌 Pachypodium
Rn 'Pachypodium-棒槌樹\席巴女王玉櫛' 'densiflorum-席巴女王玉櫛'
Rn 'Pachypodium-棒槌樹\光堂' 'namaquanum-光堂'
Rn 'Pachypodium-棒槌樹\象牙宮' 'gracilius-象牙宮'
Rn 'Pachypodium-棒槌樹\非洲霸王樹' 'lamerei-非洲霸王樹'
Rn 'Pachypodium-棒槌樹\大黑惠比須' 'densicaule-大黑惠比須'
Rn 'Pachypodium-棒槌樹\溫莎瓶幹' 'windsorii-溫莎瓶幹'
Rn 'Pachypodium-棒槌樹\常綠瓶幹' 'cactipes-常綠瓶幹'
# 鹿角蕨 Platycerium(僅原生種;品種名保留不動)
Rn 'Platycerium-鹿角蕨\安地斯' 'andinum-安地斯'
Rn 'Platycerium-鹿角蕨\象耳' 'elephantotis-象耳'
Rn 'Platycerium-鹿角蕨\菲律賓皇冠' 'coronarium-菲律賓皇冠'
# 仙人掌 Cactaceae
Rn '仙人掌\銀冠玉' 'fricii-銀冠玉'
Rn '仙人掌\烏羽玉' 'williamsii-烏羽玉'
Rn '仙人掌\子吹烏羽玉' 'williamsii-子吹烏羽玉'
Rn '仙人掌\紫兜' 'asterias-紫兜'
Rn '仙人掌\猴尾柱' 'colademononis-猴尾柱'
Rn '仙人掌\直刺佩雷' 'perezdelarosae-直刺佩雷'
Rn '仙人掌\士童' 'castanea-士童'
# 塊根 Caudex
Rn '塊根\台灣侏儒羊角玫瑰' 'obesum-台灣侏儒羊角玫瑰'
Rn '塊根\奇異油甘' 'mirabilis-奇異油甘'
Rn '塊根\龜甲摩蘿' 'cyclophylla-龜甲摩蘿'
Rn '塊根\沙漠蘇木' 'meridionalis-沙漠蘇木'
Rn '塊根\圓葉山烏龜' 'erecta-圓葉山烏龜'
Rn '塊根\象足漆樹' 'decaryi-象足漆樹'
Rn '塊根\墨西哥龜甲龍' 'mexicana-墨西哥龜甲龍'
Rn '塊根\彎彎曲曲樹' 'madagascariensis-彎彎曲曲樹'
# 大戟 Euphorbia
Rn '大戟\子吹布紋球' 'meloformis-子吹布紋球'
Rn '大戟\白衣魁偉玉' 'horrida-白衣魁偉玉'
Rn '大戟\鬼棲閣' 'guillauminiana-鬼棲閣'
# 龍舌蘭 Agave
Rn '龍舌蘭\吉祥冠覆輪龍舌蘭' 'potatorum-吉祥冠覆輪龍舌蘭'
# 觀葉 Foliage(Alocasia 觀音蓮)
Rn '觀葉\黑葉觀音蓮' 'amazonica-黑葉觀音蓮'
Rn '觀葉\絨葉斑葉觀音蓮' 'micholitziana-絨葉斑葉觀音蓮'
# --- 2026-07-17 補:先前維持中文、現已查到學名 ---
Rn 'Cactaceae-仙人掌\天紫玉' 'pflanzii-天紫玉'
Rn 'Cactaceae-仙人掌\疣仙人' 'Mammillaria-疣仙人'
Rn 'Caudex-塊根\阿拉伯沙枚' 'arabicum-阿拉伯沙枚'

Write-Host ''
Write-Host '=== 分類夾改名(最後做)==='
Rn '仙人掌' 'Cactaceae-仙人掌'
Rn '塊根' 'Caudex-塊根'
Rn '大戟' 'Euphorbiaceae-大戟'
Rn '龍舌蘭' 'Agave-龍舌蘭'
Rn '美照' 'Gallery-美照'
Rn '觀葉' 'Foliage-觀葉'

Write-Host ''
Write-Host '完成。品種名鹿角蕨(巨獸/三角/雷達等)因無學名,維持中文未改。'
Read-Host '按 Enter 關閉'
