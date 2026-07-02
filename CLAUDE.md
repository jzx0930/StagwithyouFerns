# StagwithyouFerns — 植物照片牆 / 成長紀錄站

深色玻璃質感的植物成長紀錄靜態網站,部署在 GitHub Pages。照片放 Google Drive(或任何圖床),網站只存文字與照片 ID。

## 檔案結構(乾淨三檔 + 資料)

- **index.html** — 骨架:載入 Google Fonts、`styles.css`、`app.js`,含背景層 `#bg`、內容容器 `#app`、燈箱 `#lightbox`。很短,幾乎不用改。
- **styles.css** — 所有樣式與動畫(玻璃卡片、極光光暈、螢火蟲 `@keyframes fireDrift/fireTwinkle`、燈箱等)。改外觀來這裡。
- **app.js** — 所有邏輯(免框架、免建置的原生 JS,包在一個 IIFE)。改行為來這裡。
- **data.json** — 內容(分類、植物、時間軸、照片 ID)。日常加植物/分類/換照片只改這裡。

> 注意:早期版本的 index.html 是「打包成單一檔」的機器產物(整個 App 塞在一條 JSON 字串、字型 base64)。**現已重寫成上面的一般三檔結構**,不再需要「解碼→改→重編碼」那套流程。

## data.json 結構

```json
{
  "categories": [ { "name": "鹿角蕨", "cover": "<Drive ID 或圖片網址>" } ],
  "plants": [{
    "name": "女王", "latin": "Platycerium wandae",
    "category": "鹿角蕨",              // 必須等於某個 category 的 name
    "date": "2026.07.01", "note": "...",
    "cover": "<Drive ID 或圖片網址>",   // 卡片封面
    "timeline": [ { "date": "2026.06.27", "tag": "紀錄", "note": "...", "photo": "<Drive ID 或網址>" } ]
  }]
}
```

規則:
- `date` 一律 `YYYY.MM.DD`;時間軸自動排序,**最新在最上面**。
- 照片 `cover` / `photo`:填 Google Drive 檔案 ID(推薦)或完整 http(s) 網址;留空 = 佔位框。Drive ID 由 `app.js` 的 `driveImg()` 轉成 `https://lh3.googleusercontent.com/d/<ID>=w<寬>`。**照片必須設「知道連結的任何人 / 檢視者」**。
- 分類 `cover` = 大廳分類卡代表照;留空 → 自動用該類第一株植物的 cover;再空 → 佔位框。

## 導覽層級(app.js 的 `state.view`)

`lobby`(分類圖片卡大廳)→ `grid`(該分類植物牆,含分頁列可快速切換)→ `detail`(成長時間軸)。時間軸照片可「⤢ 全螢幕」開燈箱,點圖片 200% / 350% 放大。

## app.js 重點

- `state`:`view / tab / selected / data / cats / lbUrl / lbScale`。
- `load()` fetch `./data.json` → `render()`。`render()` 依 `view` 呼叫 `renderLobby / renderGrid / renderDetail`,把 HTML 字串寫進 `#app`。
- 互動用**事件委派**:元素上放 `data-act`(enter/tab/open/lobby/back-grid/zoom)與 `data-i`,`#app` 的單一 click 監聽處理。
- `driveImg()` 產圖片 URL;`normCats()` 相容 `categories` 為字串或 `{name,cover}`;`initFireflies()` 動態產生 30 顆螢火蟲塞進 `#bg`。
- 使用者資料經 `esc()` 做 HTML 轉義。

## 驗證習慣(每次改完必做)

1. `data.json`:用 `json.load` 驗證合法;寫入用 `json.dump`(indent=2, ensure_ascii=False)。
2. `app.js`:`node --check app.js` 過語法;必要時用輕量 DOM shim(stub `document/window/fetch`)跑 `load()` 與模擬 click,驗證各 view 輸出與導覽。jsdom 在此環境被擋,用 shim 即可。
3. 樣式:改 `styles.css` 後確認類名與 `app.js` 產生的 class 一致。

## 部署

commit 全部檔案 → GitHub Pages(Settings → Pages,main / root)。字型走 Google Fonts CDN,瀏覽需連網。
