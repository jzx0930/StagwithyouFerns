# 從 PlantDex 日記匯入 Google Drive「日記-diary」:補建缺少的日期資料夾、下載照片、寫入 1.txt
# 由 Claude 產生(2026-10-27)。冪等:資料夾/照片/txt 已存在就跳過,可重複執行。
# 照片來源是 PlantDex 的公開 Storage 網址(webp、900~1200px)。只補 Drive 原本沒有的 9 個日期;
# 既有日期只在「沒有任何 .txt」時寫入 1.txt(標題+內文),不動照片。
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片\日記-diary'
if (-not (Test-Path -LiteralPath $base)) { Write-Host ('找不到資料夾: {0}' -f $base); Read-Host '按 Enter 關閉'; exit 1 }
$utf8 = New-Object System.Text.UTF8Encoding($true)
$dl = 0; $skip = 0; $txt = 0; $made = 0
function Ensure-Dir($d) { $p = Join-Path $base $d; if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p | Out-Null; Write-Host ('建立資料夾 {0}' -f $d); $script:made++ }; return $p }
function Get-Photo($d, $url, $name) {
  $p = Ensure-Dir $d; $dest = Join-Path $p $name
  if (Test-Path -LiteralPath $dest) { $script:skip++; return }
  try { Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop; Write-Host ('下載 {0}\{1}' -f $d, $name); $script:dl++ }
  catch { Write-Host ('失敗 {0}\{1}  ({2})' -f $d, $name, $_.Exception.Message) }
}
function Put-Text($d, $text) {
  $p = Ensure-Dir $d
  if (Get-ChildItem -LiteralPath $p -Filter *.txt -File -ErrorAction SilentlyContinue) { return }
  [IO.File]::WriteAllText((Join-Path $p '1.txt'), $text, $utf8); Write-Host ('寫入 {0}\1.txt' -f $d); $script:txt++
}

# ---- 2026.10.12  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796463236-o6k0rl.webp' '2026.10.12_01.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796463246-ihbzc6.webp' '2026.10.12_02.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796463248-les6nb.webp' '2026.10.12_03.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796463483-tzthxt.webp' '2026.10.12_04.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796465144-vu5oes.webp' '2026.10.12_05.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796466361-a0omvl.webp' '2026.10.12_06.webp'
Get-Photo '2026.10.12' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1791796467660-gzg0eb.webp' '2026.10.12_07.webp'

# ---- 2026.09.29  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790652552356-gh4vn7.webp' '2026.09.29_01.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790652558843-65pevh.webp' '2026.09.29_02.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790652579237-5ud0fu.webp' '2026.09.29_03.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790652581095-prllea.webp' '2026.09.29_04.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790653240541-winshy.webp' '2026.09.29_05.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790653244550-0ji83a.webp' '2026.09.29_06.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790653504019-cutf1q.webp' '2026.09.29_07.webp'
Get-Photo '2026.09.29' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1790653504233-orto69.webp' '2026.09.29_08.webp'

# ---- 2026.09.08  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.09.08' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788838900903-usq6qg.webp' '2026.09.08_01.webp'
Get-Photo '2026.09.08' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788838900904-75wxr5.webp' '2026.09.08_02.webp'
Get-Photo '2026.09.08' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788838900905-zeq9gb.webp' '2026.09.08_03.webp'
Get-Photo '2026.09.08' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788838901108-zgxrrb.webp' '2026.09.08_04.webp'

# ---- 2026.09.05  (Drive 已有 → 只補 txt) ----
Put-Text '2026.09.05' "移苗、換盆、鋪面、刷毛"

# ---- 2026.09.04  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788501865167-z59xac.webp' '2026.09.04_01.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788502131076-u5pbuq.webp' '2026.09.04_02.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788502131220-k8fh17.webp' '2026.09.04_03.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788502608123-gy1zsd.webp' '2026.09.04_04.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788503751772-f11uv2.webp' '2026.09.04_05.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788503756434-7185i9.webp' '2026.09.04_06.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788503759945-2471rx.webp' '2026.09.04_07.webp'
Get-Photo '2026.09.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788501395535-tisfsh.webp' '2026.09.04_08.webp'

# ---- 2026.08.27  (Drive 已有 → 只補 txt) ----
Put-Text '2026.08.27' "溼度高出現劇毒蘑菇團~~"

# ---- 2026.08.22  (Drive 已有 → 只補 txt) ----
Put-Text '2026.08.22' "八方根製作集體截肢手術"

# ---- 2026.08.14  (Drive 已有 → 只補 txt) ----
Put-Text '2026.08.14' "植寶們團聚`n密刺丸、士童、士童、pseudocataphracta`n黑美人、虎之子、蜈蚣丸`n狐之子、艷姬、艷姬、pygmaea var.dadakii、天惠丸"

# ---- 2026.08.09  (Drive 已有 → 只補 txt) ----
Put-Text '2026.08.09' "武力展示"

# ---- 2026.08.08  (Drive 已有 → 只補 txt) ----
Put-Text '2026.08.08' "網室建置`n1.植物安宅"

# ---- 2026.07.25  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.07.25' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1789976667474-0702jpeg.webp' '2026.07.25_01.webp'
Get-Photo '2026.07.25' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1789976679064-1055jpeg.webp' '2026.07.25_02.webp'
Put-Text '2026.07.25' "網室建置`n1.結構加強`n2.拉頂部黑網`n3.防蟲網、鐵絲網設置"

# ---- 2026.07.16  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.07.16' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1789976662824-G6639JPG.webp' '2026.07.16_01.webp'
Put-Text '2026.07.16' "紀錄全盛時期"

# ---- 2026.07.04  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2026.07.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788501035949-uisgex.webp' '2026.07.04_01.webp'
Get-Photo '2026.07.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788501033557-5fueav.webp' '2026.07.04_02.webp'
Get-Photo '2026.07.04' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788501033775-z69iq2.webp' '2026.07.04_03.webp'
Put-Text '2026.07.04' "網室建置`n主架構與浪板"

# ---- 2026.06.15  (Drive 已有 → 只補 txt) ----
Put-Text '2026.06.15' "白色蘑菇"

# ---- 2026.06.13  (Drive 已有 → 只補 txt) ----
Put-Text '2026.06.13' "神聖之鹿"

# ---- 2026.05.21  (Drive 已有 → 只補 txt) ----

# ---- 2026.03.20  (Drive 已有 → 只補 txt) ----
Put-Text '2026.03.20' "入手`n六隻魚"

# ---- 2025.10.31  (Drive 已有 → 只補 txt) ----
Put-Text '2025.10.31' "雙面植物車`n塑膠鞋盒當悶養箱測試"

# ---- 2025.10.19  (Drive 已有 → 只補 txt) ----

# ---- 2025.07.21  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2025.07.21' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788498459391-G3311jpg.webp' '2025.07.21_01.webp'
Put-Text '2025.07.21' "初次使用植物燈"

# ---- 2024.10.14  (Drive 缺少 → 建夾 + 照片) ----
Get-Photo '2024.10.14' 'https://ouyfbhpkkpotsvnxtfrx.supabase.co/storage/v1/object/public/photos/dddea497-a5ac-49cf-b1ee-e0463e0dd8b7/1788502917612-mba8qx.webp' '2024.10.14_01.webp'
Put-Text '2024.10.14' "幫何奇美換版"

Write-Host ''
Write-Host ('完成:建立 {0} 個日期夾,下載 {1} 張,跳過 {2} 張,寫入 {3} 個 1.txt。' -f $made, $dl, $skip, $txt)
Write-Host '等 Google Drive 同步完成後,跟 Claude 說「開始更新」即可把這些日記讀進網站。'
Read-Host '按 Enter 關閉'