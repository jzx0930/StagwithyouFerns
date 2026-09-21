# 植物照片 資料夾改名腳本(分類=屬名-中文;植物=種小名-中文)
# 由 Claude 產生。改名會同步回 Google Drive。原名有保留在中文部分。
$ErrorActionPreference = 'Continue'
$base = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片'

function Rn($rel, $new) {
  $full = Join-Path $base $rel
  if (-not (Test-Path -LiteralPath $full)) { Write-Host ("找不到(跳過): {0}" -f $rel); return }
  $parent = Split-Path -LiteralPath $full
  $cur = Split-Path -Leaf $full
  if ($cur -ceq $new) { Write-Host ("已是目標名(跳過): {0}" -f $new); return }
  # Windows 檔名不分大小寫:只差大小寫時 Test-Path 會誤判「已存在」,
  # 直接 Rename-Item 也可能失敗 → 先改暫時名再改回,兩段式繞過。
  $caseOnly = ($cur -ieq $new)
  $target = Join-Path $parent $new
  if ((Test-Path -LiteralPath $target) -and (-not $caseOnly)) { Write-Host ("已存在(跳過): {0}" -f $new); return }
  try {
    if ($caseOnly) {
      $tmp = "$new~tmp"
      Rename-Item -LiteralPath $full -NewName $tmp -ErrorAction Stop
      Rename-Item -LiteralPath (Join-Path $parent $tmp) -NewName $new -ErrorAction Stop
    } else {
      Rename-Item -LiteralPath $full -NewName $new -ErrorAction Stop
    }
    Write-Host ("OK  {0}  ->  {1}" -f $rel, $new)
  }
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
# --- 2026-07-20 開始更新:新植物查名 ---
Rn 'Pachypodium-棒槌樹\亞阿相界' 'geayi-亞阿相界'
Rn 'Caudex-塊根\安哥拉葡萄甕' 'uter-安哥拉葡萄甕'
Rn 'Euphorbiaceae-大戟\綠鬼玉' 'decepta-綠鬼玉'
Rn 'Euphorbiaceae-大戟\金輪際' 'gorgonis-金輪際'
Rn 'Euphorbiaceae-大戟\法利達' 'valida-法利達'
Rn 'Euphorbiaceae-大戟\九頭龍' 'inermis-九頭龍'
Rn 'Euphorbiaceae-大戟\貴清玉' 'meloformis-貴清玉'
Rn 'Euphorbiaceae-大戟\群星冠' 'stellispina-群星冠'
Rn 'Euphorbiaceae-大戟\布紋球' 'meloformis-布紋球'
Rn '多肉\萬象' 'maughanii-萬象'
# 查不到可靠學名,維持中文未改:蒼鬼塔、群星際、寶塔摩蘿

Write-Host ''
Write-Host '=== 分類夾改名(最後做)==='
Rn '仙人掌' 'Cactaceae-仙人掌'
Rn '塊根' 'Caudex-塊根'
Rn '大戟' 'Euphorbiaceae-大戟'
Rn '龍舌蘭' 'Agave-龍舌蘭'
Rn '美照' 'Gallery-美照'
Rn '觀葉' 'Foliage-觀葉'
Rn '多肉' 'Succulent-多肉'

Write-Host ''
Write-Host '=== 2026-08-03 新增(非鹿角蕨植物夾)==='
Rn 'Caudex-塊根\南非龜甲龍' 'elephantipes-南非龜甲龍'
Rn 'Succulent-多肉\黑騎士' 'BlackKnight-黑騎士'
Rn 'Foliage-觀葉\斑馬' 'zebrina-斑馬'
# 沙漠玫瑰正名(沙枚 -> 沙漠玫瑰)
Rn 'Caudex-塊根\arabicum-阿拉伯沙枚' 'arabicum-阿拉伯沙漠玫瑰'
# 查不到維持中文(不改):Cactaceae-仙人掌\單刺蓬萊宮、Pachypodium-棒槌樹\鬼精棒(空夾)

Write-Host ''
Write-Host '=== 2026-08-14 開始更新(補到學名改名)==='
# 寶塔蘿藦 = Stapelianthus decaryi
Rn 'Succulent-多肉\寶塔摩蘿' 'decaryi-寶塔蘿藦'
# 單刺蓬萊宮 = Mammillaria schumannii
Rn 'Cactaceae-仙人掌\單刺蓬萊宮' 'schumannii-單刺蓬萊宮'

Write-Host ''
Write-Host '=== 2026-08-14 分類改名:美照 -> 日記(diary) ==='
Rn 'Gallery-美照' 'diary-日記'

Write-Host ''
Write-Host '=== 2026-08-18 開始更新(新植物改名)==='
# 荒皮沙漠玫瑰 = Adenium arabicum(粗皮系)
Rn 'Caudex-塊根\荒皮沙漠玫瑰' 'arabicum-荒皮沙漠玫瑰'

Write-Host ''
Write-Host '=== 2026-08-23 大重整新植物改名(塊根)==='
# 裂紋山烏龜=Stephania(種名待考)、哥吉拉沙漠玫瑰=Adenium arabicum(哥吉拉選型)
Rn 'Caudex-塊根\裂紋山烏龜' 'Stephania-裂紋山烏龜'
Rn 'Caudex-塊根\哥吉拉沙漠玫瑰' 'arabicum-哥吉拉沙漠玫瑰'

Write-Host ''
Write-Host '=== 2026-08-31 查名改名(塊根)==='
# 足球樹 = Pseudobombax ellipticum
Rn 'Caudex-塊根\足球樹' 'ellipticum-足球樹'

Write-Host ''

Write-Host ''
Write-Host '=== 2026-09-21 新植物改名 ==='
# 惠比須笑 = Pachypodium brevicaule(棒槌)；角疣巨象 = Coryphantha cornifera(仙人掌，巨象屬帶角種)
Rn '棒槌-Pachypodium\惠比須笑' '惠比須笑-Pachypodium brevicaule'
Rn '仙人掌-Cactaceae\角疣巨象' '角疣巨象-Coryphantha cornifera'

Write-Host '完成。品種名鹿角蕨(巨獸/三角/雷達等)因無學名,維持中文未改。'
Read-Host '按 Enter 關閉'

Write-Host ''
Write-Host '=== 2026-09-21 命名規範整理(學名詞首大寫;屬名層級分類只留種小名)==='
# 棒槌-Pachypodium
Rn '棒槌-Pachypodium\惠比須笑' '惠比須笑-Brevicaule'
Rn '棒槌-Pachypodium\光堂-namaquanum' '光堂-Namaquanum'
Rn '棒槌-Pachypodium\象牙宮-gracilius' '象牙宮-Gracilius'
Rn '棒槌-Pachypodium\畢之比（雙刺瓶幹）-bispinosum' '畢之比（雙刺瓶幹）-Bispinosum'
Rn '棒槌-Pachypodium\亞阿相界-geayi' '亞阿相界-Geayi'
Rn '棒槌-Pachypodium\非洲霸王樹-lamerei' '非洲霸王樹-Lamerei'
Rn '棒槌-Pachypodium\常綠瓶幹-cactipes' '常綠瓶幹-Cactipes'
Rn '棒槌-Pachypodium\溫莎瓶幹-windsorii' '溫莎瓶幹-Windsorii'
Rn '棒槌-Pachypodium\一本尼-eburneum' '一本尼-Eburneum'
Rn '棒槌-Pachypodium\大黑惠比須-densicaule' '大黑惠比須-Densicaule'
Rn '棒槌-Pachypodium\席巴女王玉櫛-densiflorum' '席巴女王玉櫛-Densiflorum'
Rn '棒槌-Pachypodium\梅里迪棒槌-meridionale' '梅里迪棒槌-Meridionale'
# 龍舌蘭-Agave
Rn '龍舌蘭-Agave\吉祥冠覆輪龍舌蘭-potatorum' '吉祥冠覆輪龍舌蘭-Potatorum'
Rn '龍舌蘭-Agave\嚴龍-Agave titanota ''oteroi''' '嚴龍-Titanota ''Oteroi'''
Rn '龍舌蘭-Agave\瀧之白絲-schidigera Lem' '瀧之白絲-Schidigera'
Rn '龍舌蘭-Agave\內華達妖炎-utahensis var. nevadensis' '內華達妖炎-Utahensis var. Nevadensis'
Rn '龍舌蘭-Agave\象牙妖炎-utahensisvar.eborispina' '象牙妖炎-Utahensis var. Eborispina'
# 多肉-Succulent
Rn '多肉-Succulent\黑騎士-BlackKnight' '黑騎士-Black Knight'
Rn '多肉-Succulent\鬼切丸-Aloe marlothii' '鬼切丸-Aloe Marlothii'
Rn '多肉-Succulent\海豹天章-Adromischus cooperi var. festivus' '海豹天章-Adromischus Cooperi var. Festivus'
Rn '多肉-Succulent\萬象-maughanii' '萬象-Maughanii'
Rn '多肉-Succulent\四方凝蹄玉-Pseudolithos cubiformis' '四方凝蹄玉-Pseudolithos Cubiformis'
Rn '多肉-Succulent\蛇蹄玉-Pseudolithos caput-viperae' '蛇蹄玉-Pseudolithos Caput-viperae'
Rn '多肉-Succulent\寶塔蘿藦-decaryi' '寶塔蘿藦-Decaryi'
# 仙人掌-Cactaceae
Rn '仙人掌-Cactaceae\碧岩玉-Gymnocalycium hybopleurum' '碧岩玉-Gymnocalycium Hybopleurum'
Rn '仙人掌-Cactaceae\緋牡丹-Gymnocalycium mihanovichii' '緋牡丹-Gymnocalycium Mihanovichii'
Rn '仙人掌-Cactaceae\銀冠玉-fricii' '銀冠玉-Fricii'
Rn '仙人掌-Cactaceae\拉根-Gymnocalycium ragonesei' '拉根-Gymnocalycium Ragonesei'
Rn '仙人掌-Cactaceae\Discocactus-disco' 'disco-Discocactus'
Rn '仙人掌-Cactaceae\天紫玉-pflanzii' '天紫玉-Pflanzii'
Rn '仙人掌-Cactaceae\兜-Astrophytum asterias' '紫兜-Astrophytum Asterias'
Rn '仙人掌-Cactaceae\銀沙鸞鳳玉-Astrophytum myriostigma' '銀沙鸞鳳玉-Astrophytum Myriostigma'
Rn '仙人掌-Cactaceae\無刺王冠龍-Ferocactus glaucescens cv. ''Nuda''' '無刺王冠龍-Ferocactus Glaucescens cv. ''Nuda'''
Rn '仙人掌-Cactaceae\帝冠-Obregonia denegrii' '帝冠-Obregonia Denegrii'
Rn '仙人掌-Cactaceae\長槍雲、茜雲-Melocactus ernestii' '長槍雲、茜雲-Melocactus Ernestii'
Rn '仙人掌-Cactaceae\千波萬波-Stenocactus multicostatus' '千波萬波-Stenocactus Multicostatus'
Rn '仙人掌-Cactaceae\短刺象牙丸-Coryphantha elephantidens ''Tenshi''' '短刺象牙丸-Coryphantha Elephantidens ''Tenshi'''
Rn '仙人掌-Cactaceae\紫太陽-Echinocereus rigidissimus' '紫太陽-Echinocereus Rigidissimus'
Rn '仙人掌-Cactaceae\黑刺鳳頭-Gymnocalycium bodenbenderianum f. nigrispina' '黑刺鳳頭-Gymnocalycium Bodenbenderianum f. Nigrispina'
Rn '仙人掌-Cactaceae\象牙丸-Coryphantha elephantidens' '象牙丸-Coryphantha Elephantidens'
Rn '仙人掌-Cactaceae\月世界-Epithelantha micromeris' '月世界-Epithelantha Micromeris'
Rn '仙人掌-Cactaceae\單刺蓬萊宮-schumannii' '單刺蓬萊宮-Schumannii'
Rn '仙人掌-Cactaceae\猴尾柱-colademononis' '猴尾柱-Colademononis'
Rn '仙人掌-Cactaceae\無刺象牙丸-Coryphantha elephantidens inermis' '無刺象牙丸-Coryphantha Elephantidens Inermis'
Rn '仙人掌-Cactaceae\直刺佩雷-perezdelarosae' '直刺佩雷-Perezdelarosae'
Rn '仙人掌-Cactaceae\烏羽玉-williamsii' '烏羽玉-Williamsii'
Rn '仙人掌-Cactaceae\士童-castanea' '士童-Castanea'
Rn '仙人掌-Cactaceae\子吹烏羽玉-williamsii' '子吹烏羽玉-Williamsii'
# 塊根-Caudex
Rn '塊根-Caudex\安哥拉葡萄甕-uter' '安哥拉葡萄甕-Uter'
Rn '塊根-Caudex\墨西哥龜甲龍-mexicana' '墨西哥龜甲龍-Mexicana'
Rn '塊根-Caudex\龜甲摩蘿-cyclophylla' '龜甲摩蘿-Cyclophylla'
Rn '塊根-Caudex\台灣侏儒羊角玫瑰-obesum' '台灣侏儒羊角玫瑰-Obesum'
Rn '塊根-Caudex\荒皮沙漠玫瑰-arabicum' '荒皮沙漠玫瑰-Arabicum'
Rn '塊根-Caudex\錦珊瑚-Jatropha cathartica' '錦珊瑚-Jatropha Cathartica'
Rn '塊根-Caudex\足球樹-ellipticum' '足球樹-Ellipticum'
Rn '塊根-Caudex\列加氏漆樹-Operculicarya decaryi' '列加氏漆樹-Operculicarya Decaryi'
Rn '塊根-Caudex\奇異油甘-mirabilis' '奇異油甘-Mirabilis'
Rn '塊根-Caudex\蟻巢玉-Hydnophytum moseleyanum' '蟻巢玉-Hydnophytum Moseleyanum'
Rn '塊根-Caudex\索科特拉沙漠玫瑰-Adenium socotranum' '索科特拉沙漠玫瑰-Adenium Socotranum'
Rn '塊根-Caudex\哥吉拉沙漠玫瑰-arabicum' '哥吉拉沙漠玫瑰-Arabicum'
Rn '塊根-Caudex\阿拉伯沙漠玫瑰-arabicum' '阿拉伯沙漠玫瑰-Arabicum'
Rn '塊根-Caudex\南非龜甲龍-elephantipes' '南非龜甲龍-Elephantipes'
Rn '塊根-Caudex\圓葉山烏龜-erecta' '圓葉山烏龜-Erecta'
Rn '塊根-Caudex\彎彎曲曲樹-madagascariensis' '彎彎曲曲樹-Madagascariensis'
Rn '塊根-Caudex\沙漠蘇木-meridionalis' '沙漠蘇木-Meridionalis'
# 大戟-Euphorbiaceae
Rn '大戟-Euphorbiaceae\金輪際-gorgonis' '金輪際-Gorgonis'
Rn '大戟-Euphorbiaceae\九頭龍-inermis' '九頭龍-Inermis'
Rn '大戟-Euphorbiaceae\裸萼大戟-Euphorbia gymnocalycioides' '裸萼大戟-Euphorbia Gymnocalycioides'
Rn '大戟-Euphorbiaceae\群星冠-stellispina' '群星冠-Stellispina'
Rn '大戟-Euphorbiaceae\綠鬼玉-decepta' '綠鬼玉-Decepta'
Rn '大戟-Euphorbiaceae\布紋球-meloformis' '布紋球-Meloformis'
Rn '大戟-Euphorbiaceae\噴火龍-Euphorbia viguieri' '噴火龍-Euphorbia Viguieri'
Rn '大戟-Euphorbiaceae\柳葉麒麟-Euphorbia hedyotoides' '柳葉麒麟-Euphorbia Hedyotoides'
Rn '大戟-Euphorbiaceae\蘋果麒麟-Euphorbia bongolavensis' '蘋果麒麟-Euphorbia Bongolavensis'
Rn '大戟-Euphorbiaceae\哥列麒麟-Euphorbia phillipsiae' '哥列麒麟-Euphorbia Phillipsiae'
Rn '大戟-Euphorbiaceae\銅綠麒麟-Euphorbia aeruginosa' '銅綠麒麟-Euphorbia Aeruginosa'
Rn '大戟-Euphorbiaceae\法利達-valida' '法利達-Valida'
Rn '大戟-Euphorbiaceae\貴清玉-meloformis' '貴清玉-Meloformis'
Rn '大戟-Euphorbiaceae\子吹布紋球-meloformis' '子吹布紋球-Meloformis'
Rn '大戟-Euphorbiaceae\白衣魁偉玉-horrida' '白衣魁偉玉-Horrida'
Rn '大戟-Euphorbiaceae\鬼棲閣-guillauminiana' '鬼棲閣-Guillauminiana'
# 觀葉-Foliage
Rn '觀葉-Foliage\斑馬觀音蓮-Alocasia zebrina' '斑馬觀音蓮-Alocasia Zebrina'
Rn '觀葉-Foliage\迷彩粗肋草-Aglaonema pictum' '迷彩粗肋草-Aglaonema Pictum'
Rn '觀葉-Foliage\聖靈蔓綠絨-Philodendron spiritus-sancti' '聖靈蔓綠絨-Philodendron Spiritus-sancti'
Rn '觀葉-Foliage\黑絲絨觀音蓮-Alocasia reginula ''Black Velvet''' '黑絲絨觀音蓮-Alocasia Reginula ''Black Velvet'''
Rn '觀葉-Foliage\黑龍鱗觀音蓮-Alocasia baginda ''Dragon Scale''' '黑龍鱗觀音蓮-Alocasia Baginda ''Dragon Scale'''
Rn '觀葉-Foliage\橘柄蔓綠絨-Philodendron billietiae' '橘柄蔓綠絨-Philodendron Billietiae'
Rn '觀葉-Foliage\孔雀竹芋-Calathea makoyana' '孔雀竹芋-Calathea Makoyana'
Rn '觀葉-Foliage\窗孔龜背芋-Monstera adansonii' '窗孔龜背芋-Monstera Adansonii'
Rn '觀葉-Foliage\銀箭蔓綠絨-Philodendron hastatum' '銀箭蔓綠絨-Philodendron Hastatum'
Rn '觀葉-Foliage\青蘋果火鶴-Anthurium villenaorum' '青蘋果火鶴-Anthurium Villenaorum'
Rn '觀葉-Foliage\黑葉觀音蓮-amazonica' '黑葉觀音蓮-Amazonica'
Rn '觀葉-Foliage\絨葉斑葉觀音蓮-micholitziana' '絨葉斑葉觀音蓮-Micholitziana'
Write-Host '完成。角疣巨象學名待確認(Drive=Elephantidens Lem. / data.json=Cornifera),本次未動。'

Write-Host ''
Write-Host '=== 2026-09-21 補正 ==='
# 惠比須笑 被更早的指令改成含屬名的形式,這裡統一成「只留種小名」
Rn '棒槌-Pachypodium\惠比須笑-Pachypodium brevicaule' '惠比須笑-Brevicaule'
