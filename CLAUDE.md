# StagwithyouFerns — 植物照片牆 / 成長紀錄站

深色玻璃質感的植物成長紀錄靜態網站,部署在 GitHub Pages。照片放 Google Drive,網站只存文字與照片 ID。

> **完整、最新的交接資訊一律以 `SKILL.md` 為準**(目錄、功能、data.json 欄位、命名規則、個體 ID、「開始更新」流程、當前版本號)。本檔只放最常用的重點;兩者衝突時以 SKILL.md 為準。**每次改專案都要同步更新 SKILL.md(§3 目錄、§4 功能、§10 版本/規模)。**

## 檔案一覽

- `index.html` 骨架;各 css/js 用 `?v=N` 快取破壞(**改哪支就把它的 N +1**,目前 `styles.css?v=81`、`app.js?v=84`,其餘見 SKILL §10)。
- `app.js` 主程式(IIFE、免框架):大廳 / 分類牆(鹿角蕨 18 原種圖鑑、日記一日一卡)/ 詳情(個體下拉 + 來源·母株 + 時間軸)/ 關於 / 知識庫 / 搜尋(含 ID)/ `?id=` 深連結。
- `styles.css` 全部樣式。
- `data.json` 內容主檔(由 Drive「開始更新」產生)。
- 手寫內容檔(Drive 同步不覆蓋):`plant-notes.js`(每株介紹)、`about.js`(關於頁)、`knowledge.js`(知識庫)、`sources.js`(來源·母株文字備援)。
- `staghorn-fern.js`、`orb.js`、`intro.js`、`layout.js`、`config/`、`shop/`、`models/<屬名>/<屬名>.glb`。
- `tools/` 使用者電腦上跑的 PowerShell/bat(大量改名、日記整理、母株夾、模型壓縮等)。

## data.json 重點

```json
{ "categories": [ { "name": "鹿角蕨Platycerium", "cover": "", "model": true } ],
  "plants": [{ "name": "奧銀", "pid": "PL-015", "latin": "Platycerium veitchii ‘Auburn River’",
    "category": "鹿角蕨", "date": "2026.07.07", "cover": "<Drive ID>", "coverLocked": true,
    "fid": "<Drive 植物資料夾 ID>",
    "individuals": [{ "id": "PL-015-008", "label": "#08", "name": "Jacksonii", "cover": "<ID>",
      "mother": ["<ID>"], "motherInfo": { "source": "", "mother": "" },
      "timeline": [ { "date": "2026.10.24", "tag": "#08", "note": "", "photo": "<ID>" } ] }] }],
  "_ids": { "codes": {}, "counters": {}, "speciesSlots": {}, "speciesNext": {} } }
```
- `category` 只填中文;`latin` 存**全屬名**、種小名小寫、品種名彎引號 `‘ ’`;`date` 一律 `YYYY.MM.DD`。
- 個體 ID `分類碼-植物序號-個體序號`(各 3 碼),發出後永不更改/重用;併株後的舊號記在 `_ids.retired`(規則見 SKILL §10b)。
- `fid` = 該株的 Drive 資料夾 ID(每株都有,網站不用),同步時靠它對應植物。
- 照片須 Drive「知道連結的任何人/檢視者」;`driveImg()` → `lh3.googleusercontent.com/d/<ID>=w<寬>`。

## Drive 資料夾結構(2026-11 起)

`植物照片/分類(中文-屬或科)/[屬名夾]/植物(中文-屬縮寫 種小名 ‘品種’ (標記))/#NN-暱稱/母株/`
- 混屬分類(仙人掌/大戟/塊根/多肉/觀葉)多一層**屬名夾**(純拉丁);鹿角蕨/棒槌/龍舌蘭無屬名夾。
- `母株/` 夾:照片 → `mother`,`.txt` → `motherInfo`;`日記-diary/YYYY.MM.DD/`:照片 + `.txt`(當日文字)。
- Drive 連接器 `update_file` 可直接改名/搬移;**對應植物一律用資料夾 ID(data.json `fid`)**,勿只靠名稱解析(會重複建株)。
- `植物照片/` 根目錄:`知識庫素材/` = 知識庫素材(同步時比對 knowledge.js 並回報);`素材/`、`文案/`、`StagwithyourFerns_Seasonal_TimeSet/` 一律忽略。

## 「開始更新」

使用者說「開始更新」→ 依 `SKILL.md` 附錄 A 執行(以照片 ID 集合比對偵測新照片,不信任上次同步日期;日記逐夾比對;發 ID;補 plant-notes;更新 SKILL;給 commit 訊息)。

## 驗證習慣

1. `data.json`:`json.load` 驗證;`json.dump(indent=2, ensure_ascii=False)`。
2. JS:`node --check app.js`(及改過的內容檔);掛載點偶爾截斷大檔寫入,改完必檢查。
3. 燈箱:務必保留 `.lightbox[hidden]{display:none}`。使用者回報白畫面先請 Ctrl+Shift+R。
4. commit 訊息以兩個可複製的程式碼區塊給出(Summary / Description)。
