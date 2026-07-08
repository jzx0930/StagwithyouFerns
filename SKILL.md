---
name: update-plant-wall
description: 當使用者說「開始更新」時觸發。檢查 Google Drive「植物照片」資料夾名稱是否為「英文-中文」格式;不是就上網查名、把改名指令「附加」到 PowerShell 腳本、啟動 .bat 改名;完成後由 Drive 重建 data.json。已是純英文的資料夾不動;改名腳本只累加不刪除,已改好的自動跳過。
---

# 開始更新 — 植物照片牆 Drive → data.json

**觸發語**:使用者說「**開始更新**」。收到後依本手冊執行整套流程。

## 環境限制(務必記得)
- Drive 資料夾在 `G:\我的雲端硬碟\植物照片`(Google Drive 電腦版同步碟)。若未連接,先用 `request_cowork_directory` 連。
- **bash 無法掛載 G:\**,只能用 `Glob` / `Read` 讀 host 路徑。
- **檔案工具與連接器都沒有「改名」功能** → 改名一律靠 PowerShell 腳本在使用者電腦上跑(見下)。
- **我不能改 Drive 分享權限**。網站顯示照片需照片為「知道連結的任何人/檢視者」;若非公開,請使用者自行設定。目前 `植物照片` 整夾已公開。

## 命名規則

### Drive 資料夾格式(硬碟上,連字號 `-`)
- **分類夾** = `屬名-中文`,例 `Platycerium-鹿角蕨`、`Cactaceae-仙人掌`、`Agave-龍舌蘭`。
- **植物夾** = `種小名/園藝名-中文`,例 `elephantotis-象耳`、`Geisha-藝伎`、`williamsii-烏羽玉`。
- **個體夾** = `#01`、`#02`…(**不改**)。
- **已是純英文**(如 `Akki`、`Nano`、`E`)→ **不動**。

### 分類屬名對照
鹿角蕨=Platycerium、棒槌/棒槌樹=Pachypodium、仙人掌=Cactaceae、龍舌蘭=Agave、塊根=Caudex、多肉=Succulent、大戟=Euphorbiaceae、觀葉=Foliage、美照=Gallery。

### 植物命名決策(逐夾判斷,上網查證)
1. **原生種** → 種小名(例 象耳=`elephantotis`、光堂=`namaquanum`)。
2. **園藝品種** → 英文園藝名(例 藝伎=`Geisha`、金童=`GoldenBoy`、銀華=`Ginka`)。
3. **交種** → 交種式(例 `madagascariense×alcicorne`)或已知英文交種名(例 `Darwin`)。
4. **查不到可靠名稱** → **維持中文不改**,並把清單回報給使用者、請他補親本/英文名。
5. **已是英文** → 不動。

## 執行步驟(收到「開始更新」)
1. `Glob` 掃 `G:\我的雲端硬碟\植物照片` 全部分類夾與植物夾。
2. 逐一判斷資料夾名是否已符合「英文-中文」或「純英文」:
   - **符合** → 跳過。
   - **不符合** → 依上面決策上網查名,將一行 `Rn '舊名' '新名'` **附加**到對應腳本:
     - 分類夾 + 非鹿角蕨植物 → `rename_plants.ps1`
     - 鹿角蕨植物 → `rename_platycerium.ps1`
   - **絕不刪除腳本裡既有的行**。已改好的資料夾靠腳本內 `Test-Path` 自動「跳過」。
3. **啟動 `run_rename.bat`**(請使用者雙擊;或經 computer-use 於檔案總管開啟並徵得同意)。等 Google Drive 同步完成(右下角圖示轉完)。
4. **由 Drive 重建 data.json**(見下節)。
5. 提醒使用者到 GitHub Desktop **commit + push**(data.json、models、腳本等)。

## 由 Drive 重建 data.json
用 Drive 連接器 `search_files` 走訪:`植物照片` → 分類夾 → 植物夾 →(`#`個體夾)→ 照片,取檔案 ID。
- **分類**:folder `屬名-中文` → `category.name` = `中文屬名`(中文在前、屬名在後、去掉 `-`,例 `Platycerium-鹿角蕨` → `鹿角蕨Platycerium`)。有 `.glb` 模型的分類設 `"model": true`。
- **植物**:folder `種名-中文` → `name`=中文、`latin`=`屬名 種名`、`category`=分類的中文部分。
- **個體**:每個 `#NN` 夾 → `{ "label":"#NN", "cover":<最新照片ID>, "timeline":[...] }`;直接放在植物夾的照片 → 未編號個體(`label:""`)。
- **時間軸節點**:`date` 由檔名解析(`YYYY:M:D HH:MM:SS` 或 `YYYY年M月D日` → `YYYY.MM.DD`);`photo`=Drive 檔案 ID;`tag`/`note` 可系統化產生。app.js 會自動依日期排序、最新在最上。
- **cover**:用最新一張照片 ID;分類 `cover` 可留空(app.js 自動取該類第一株)。

## 腳本慣例(重要)
- `rename_plants.ps1` / `rename_platycerium.ps1`:存成 **UTF-8 + BOM**(否則 PowerShell 5.1 讀不對中文,改名會失敗)。每筆用 `Rn` 函式,內含 `Test-Path` 保護:目標已存在或找不到舊夾就印「跳過」,不會亂改或覆蓋。
- `run_rename.bat`:**純 ASCII**、`chcp 65001`、以 `-ExecutionPolicy Bypass` 依序呼叫兩支 `.ps1`。
- **累加式**:每次「開始更新」只 **append** 新的 `Rn` 行,**不刪**舊行;重跑整支腳本時,已改好的自動跳過。

## 今日已建立的對照(範例,供延用)
- 分類:仙人掌→Cactaceae、塊根→Caudex、大戟→Euphorbiaceae、龍舌蘭→Agave、美照→Gallery。
- 棒槌:席巴女王玉櫛=densiflorum、光堂=namaquanum、象牙宮=gracilius、非洲霸王樹=lamerei、溫莎瓶幹=windsorii、常綠瓶幹=cactipes、大黑惠比須=densicaule(雜交)。
- 仙人掌:銀冠玉=fricii、烏羽玉/子吹烏羽玉=williamsii、紫兜=asterias、猴尾柱=colademononis、直刺佩雷=perezdelarosae、士童=castanea。
- 塊根:奇異油甘=mirabilis、龜甲摩蘿=cyclophylla、沙漠蘇木=meridionalis、圓葉山烏龜=erecta、象足漆樹=decaryi、墨西哥龜甲龍=mexicana、彎彎曲曲樹=madagascariensis、台灣侏儒羊角玫瑰=obesum。
- 大戟:子吹布紋球=meloformis、白衣魁偉玉=horrida、鬼棲閣=guillauminiana。
- 龍舌蘭:吉祥冠覆輪龍舌蘭=potatorum。
- 鹿角蕨原生種:女王=wandae、象耳=elephantotis、安地斯=andinum、菲律賓皇冠=coronarium、三角=stemaria、四叉=quadridichotomum、何其美=holttumii、亞猴=ridleyi、非猴=madagascariense、巨獸=grande、巨大=superbum、白鹿=bifurcatum、銀葉立葉/奧銀=veitchii。
- 鹿角蕨品種:藝伎=Geisha、獨角獸=Unicorn、美猴王=ridleyi、銀華=Ginka、金童=GoldenBoy、飛飛達爾文=Darwin。
- 未定(維持中文,待補親本):雷達、情花few、艾沙、獅子座、三角四叉。純英文不動:Akki、Nano、E。
