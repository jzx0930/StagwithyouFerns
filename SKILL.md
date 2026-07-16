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

## 執行步驟(收到「開始更新」)— 嚴格照順序
1. **掃描 + 偵測變更**:`Glob` 掃 `G:\我的雲端硬碟\植物照片` 全部分類夾與植物夾,和「上次的狀態」(現有 `data.json` 的 plants + 現有資料夾名)比對,分出三種變更:
   - **(A) 新增夾 / 改名夾**:資料夾名還不是「英文-中文」或純英文 → 進第 2 步查名改名;純新增但已命名好的植物也記下來要補進 data.json。
   - **(B) 舊植物補了新照片**:資料夾名沒變、但裡面照片變多。**這種光看資料夾名看不出來**,要**逐一比對該株在 data.json 的照片數 vs Drive 該夾實際照片數**(用 `search_files` 抓該夾照片數對照),不一致就要重抓那株的時間軸。若不確定,對「有在成長中、可能常拍」的植物直接重抓即可。
   - **(C) 完全沒變**:跳過。
   - 把「這次要處理的清單」(要改名的、要補進 data.json 的新株、要更新照片的舊株)先列出來,再往下做。
2. **查名 + 附加腳本**:逐一判斷資料夾名是否已符合「英文-中文」或「純英文」:
   - 符合 / 純英文 → 跳過。
   - 不符合 → 依決策上網查名,把 `Rn '舊名' '新名'` **附加**到對應腳本(都在 `tools/`:分類夾+非鹿角蕨植物 → `tools/rename_plants.ps1`;鹿角蕨植物 → `tools/rename_platycerium.ps1`)。**只 append,絕不刪舊行**;已改好的靠 `Test-Path` 跳過。
   - 若**全部都已符合**(沒有要改的名),跳過第 3、4 步,直接到第 5 步。
3. **請使用者跑 bat,然後停下來等**:請使用者**雙擊 `tools/run_rename.bat`** → **⚠️ 停在這裡,等使用者回覆「好了」並等 Drive 同步完成後才繼續。在確認前絕不往下做**,否則會用到舊資料夾名。
4. **驗證改名**:重新 `Glob` 確認每筆改名都生效。偶爾某夾第一次沒改到(同步延遲/暫時失敗)——腳本是冪等的,請使用者**再雙擊一次**即可(已改好的會跳過)。全部符合後再繼續。
5. **更新 data.json**(見下節;**增量優先**)。
6. **提醒 commit + push**:請使用者到 GitHub Desktop commit + push(data.json、改過的腳本等)。

## 更新 data.json(保留 categories/_說明,只動 plants)

**增量優先(重要教訓)**:整棵樹(200+ 檔)用 subagent 走訪**很容易 API 連線中斷**,實測失敗多次。所以:
- **平常只做增量**:比對現有 data.json 的 plants 與 Drive 現況,**只處理「新增夾 / 改名夾 / 補了照片的夾」**——用 `search_files` 只抓那幾株的照片(ID+檔名日期),建立或就地更新該株物件、append 到 plants。既有未變動的植物**不重抓**。改名但中文名沒變的,plants 不受影響;若某株的顯示名要跟著資料夾改(如純英文夾),就地更新該株 `name`/`latin`。
- **只有第一次建、或使用者明確要「完整重建」時**,才用 subagent 走訪整棵樹(給它 8 個分類夾 ID + 下面規則)。即使如此仍可能中斷 → 斷了就改用增量補齊剩下的。

走訪規則(`search_files` 以 `parentId` 查:植物照片 → 分類夾 → 植物夾 →(`#`個體夾)→ 照片):
- **分類**:**保留現有 `categories` 陣列**(名稱/cover/model 都不動),不要重建。
- **植物**:植物夾名用**第一個 `-`** 切:左=latin、右=中文=`name`(無中文就用整個資料夾名,如 `P.willinckii Yellow moon…`)。`category` = 分類中文部分,但**棒槌類一律填「棒槌」**(對應 data.json 的 `棒槌Pachypodium`,app.js 用 `c.zh` 精確比對;填「棒槌樹」會對不上而消失)。
- **latin** = 屬名 + 種名。屬名取分類夾 latin,**但這幾類要用該株「真正的屬」而非分類名**:仙人掌(Cactaceae 是科)→ 用真正屬如 `Lophophora`/`Astrophytum`;塊根(Caudex)、大戟(Euphorbiaceae 是科)→ 用真正屬;**觀葉(Foliage)→ 用 `Alocasia` 等真正屬,不是 Foliage**。鹿角蕨/棒槌/龍舌蘭的分類夾 latin 本就是正確屬名。植物夾 latin 已含屬名(如 `Platycerium wandae`)就不重複加。
- **個體**:`#NN` 夾 → `{ "label":"#NN", "cover":<該個體最新照片ID>, "timeline":[...] }`;直接放植物夾的照片 → 未編號個體(`label:""`)。巢狀 `#01/#01` 用最外層 label。
- **時間軸節點**:`date` 由檔名解析(`YYYY:M:D HH:MM:SS` / `YYYY年M月D日` / `YYYY M D HH MM SS` → `YYYY.MM.DD`);`photo`=Drive 檔案 ID;`tag`/`note` 可系統化。app.js 自動依日期排序、最新在最上。
- **空資料夾(無照片)不產生植物**。
- **cover**:用該株最新一張照片 ID;分類 `cover` 可留空。
- **寫檔**:Read 現有 data.json,保留 `_說明`/`_範例植物格式`/`categories`,只換或補 `plants`,用 Python `json.dump(ensure_ascii=False, indent=2)` 寫,寫完 `json.load` 驗證。

## 腳本慣例(重要)
- **所有腳本都在 `tools/` 資料夾**(`run_rename.bat`、`optimize_models.bat`〔模型 Draco 壓縮〕等)。`rename_plants.ps1` / `rename_platycerium.ps1`:存成 **UTF-8 + BOM**(否則 PowerShell 5.1 讀不對中文,改名會失敗)。每筆用 `Rn` 函式,內含 `Test-Path` 保護:目標已存在或找不到舊夾就印「跳過」,不會亂改或覆蓋。
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
