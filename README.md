# 植物照片牆 · 架站說明

深色玻璃質感的植物成長紀錄站。照片放在 **Google Drive**,網站只存文字,GitHub Pages 幾乎不佔空間。

## 檔案
- **index.html** — 骨架(載入字型、樣式、程式)
- **styles.css** — 外觀樣式與動畫(玻璃卡片、極光、螢火蟲、燈箱)
- **app.js** — 程式邏輯(大廳、分類、時間軸、燈箱)
- **data.json** — 你要編輯的內容檔:分類、植物、日期、備註、每張照片的 Drive ID

四支檔放同一層即可上架。日常「加植物 / 加分類 / 換照片」只需要改 `data.json`。

---

## 一、把照片放到 Google Drive 並取得「檔案 ID」
1. 上傳照片到雲端硬碟。
2. 對照片按右鍵 →「共用」→ 權限改成 **「知道連結的任何人 / 檢視者」**(很重要,否則圖不顯示)。
3. 連結長得像 `https://drive.google.com/file/d/`**`1A2b3C4d5E6f...`**`/view`,中間粗體那段就是 **檔案 ID**。

## 二、把 ID 填進 data.json
- 分類:`categories` 每項 `{ "name": "鹿角蕨Platycerium", "cover": "<檔案ID>", "model": true }`。
  - `name` 寫成「**中文+屬名**」(例 `鹿角蕨Platycerium`、`龍舌蘭Agave`;沒屬名者用英文,如 `多肉Succulent`、`美照Gallery`)。網站顯示時中文為主、屬名為斜體小字。
  - `cover` 是大廳分類卡的代表照(留空自動用該類第一株植物封面)。
  - `model` 見下面「四、3D 模型」;沒有就填 `false`。
- 植物:`cover` = 卡片封面;每個時間軸節點的 `photo` = 那天的照片。
- 留空字串 `""` 顯示佔位框;也可直接貼完整圖片網址(http 開頭)。
- `date` 一律 `YYYY.MM.DD`,時間軸自動排序、最新在最上面。
- 植物的 `category` 只填**中文**(如 `鹿角蕨`、`棒槌`),會自動歸到對應分類——分類名加屬名不影響歸類。

## 三、3D 模型(選用)
想讓某分類的封面變成可拖曳旋轉的真實 3D 模型:
1. 分類名帶屬名(例 `鹿角蕨Platycerium`)。
2. 把模型放成 `models/<屬名>/<屬名>.glb`(例 `models/Platycerium/Platycerium.glb`)。
3. data.json 該分類 `"model": true`,網站就自動載入。
細節與壓縮方式見 `models/README.md`。

## 四、發佈到 GitHub Pages
1. 把四支檔上傳到 repo 根目錄。
2. repo → **Settings → Pages** → Source 選 `main`、`/root`,存檔。
3. 等一兩分鐘取得網址 `https://你的帳號.github.io/repo名/`。
4. 之後加照片/植物:改 `data.json` 再 commit,網站自動更新。

---

## 小提醒
- 照片一定要設「知道連結的任何人可檢視」。
- 字型走 Google Fonts,瀏覽需連網。
- 想改外觀改 `styles.css`,想改功能改 `app.js`。
