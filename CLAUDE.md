# StagwithyouFerns — 植物照片牆 / 成長紀錄站

深色玻璃質感的植物成長紀錄靜態網站,部署在 GitHub Pages。照片放 Google Drive,網站只存文字與照片 ID。

## 檔案結構(乾淨三檔 + 資料)

- **index.html** — 骨架:載入 Google Fonts、`styles.css`、`app.js`,含背景層 `#bg`、內容容器 `#app`、燈箱 `#lightbox`。
- **styles.css** — 所有樣式與動畫(玻璃卡片、極光、螢火蟲 `fireDrift/fireTwinkle`、燈箱)。
- **app.js** — 所有邏輯(免框架原生 JS,IIFE)。
- **data.json** — 內容;日常只改這裡(通常由 Google Drive 自動產生,見下)。
- **staghorn-fern.js** — 原生 Web Component `<staghorn-fern>`(自帶 3D 動畫鹿角蕨,首次使用自動載入 Three.js from cdnjs)。大廳中 `c.name === '鹿角蕨'` 或 `category.fx === 'staghorn-fern'` 的分類卡改用此元件當互動封面(滑鼠視差)。
- **真實 3D 模型封面**:index.html 以 CDN 載入 Google `<model-viewer>`。若某 `category` 設 `"model": "models/xxx.glb"`,大廳該卡改用 `<model-viewer>` 顯示可拖曳旋轉的 .glb(優先序:model > staghorn-fern > 圖片)。.glb 需自備(用圖片轉 3D 服務生成),放進 repo(例如 models/ 資料夾)。
- **models/**:放 .glb 模型檔。分類的 `model` 欄位指向它即啟用(見 models/README.md)。**Drive 重新同步 data.json 會覆蓋手填的 `model`**,同步時需把「鹿角蕨→models/staghorn/staghorn.glb」重新補上。網站固定取 `models/staghorn/` 資料夾內檔名為 `staghorn.glb` 的模型顯示(該夾可放多個 .glb,只有 `staghorn.glb` 會被用到)。

## data.json 結構(含「個體 #」層)

```json
{
  "categories": [ { "name": "鹿角蕨", "cover": "<Drive ID 或網址>" } ],
  "plants": [{
    "name": "一本尼", "latin": "Pachypodium eburneum",
    "category": "棒槌樹",            // 必須等於某個 category.name
    "date": "2026.06.07", "note": "", "cover": "<Drive ID>",
    "individuals": [                 // 個體:同種不同株,可在詳情頁切換
      { "label": "#99", "cover": "<Drive ID>",
        "timeline": [ { "date": "2026.06.07", "tag": "#99", "note": "...", "photo": "<Drive ID>" } ] }
    ]
  }]
}
```

規則:
- 導覽:大廳(分類圖片卡)→ 分類植物牆(可切分頁)→ 植物詳情(個體 # 切換 + 成長時間軸)。
- `date` 一律 `YYYY.MM.DD`;時間軸自動排序,**最新在最上面**。
- 照片 `cover`/`photo` 填 Google Drive 檔案 ID 或完整網址;留空 = 佔位框。ID 由 `driveImg()` 轉 `https://lh3.googleusercontent.com/d/<ID>=w<寬>`。**照片須設「知道連結的任何人 / 檢視者」**。
- `individuals`:每個 `{label,cover,timeline}` 是一株個體;`label` 空 = 未編號。詳情頁在「個體數>1 或有 label」時顯示切換列。`app.js` 的 `normIndiv()` 相容舊格式(直接 `plant.timeline`)。
- 分類 `cover` 空 → 自動用該類第一株植物的 cover。

## 由 Google Drive 自動產生 data.json

資料夾階層即資料模型(連 Google Drive 連接器後走訪):
- 根資料夾「植物照片」→ 第一層資料夾 = **分類**(如 `Pachypodium-棒槌樹`,取中文「棒槌樹」當分類名、`Pachypodium` 當屬名)。
- 第二層 = **植物**(如 `eburneum-一本尼`:名稱「一本尼」、`latin` = 屬名+種小名 = `Pachypodium eburneum`)。
- 第三層 `#數字` 資料夾 = **個體**;直接放在植物夾的照片 = 未編號個體。
- 照片檔名帶日期時當節點 `date`(支援 `2026年6月7日` 與 `2026:6:7 14:28:45`),否則用上傳日。`note`/`tag` 目前系統化產生(要依畫面內容寫需另外逐張看圖)。
- 產生前用 `get_file_permissions` 抽查照片是否為 `anyone/reader`(公開),否則網站顯示不出。
- 使用者選擇「完全以 Drive 為準重建」:每次同步都從資料夾重生 data.json,手寫 note/tag 會被覆蓋。

## app.js 重點

- `state`:`view / tab / selected / indiv / data / cats / lbUrl / lbScale`。
- `load()` fetch `./data.json` → `render()` 依 `view` 呼叫 `renderLobby / renderGrid / renderDetail`。
- 互動用事件委派:`data-act`(enter/tab/open/indiv/lobby/back-grid/zoom)+ `data-i`,`#app` 單一 click 監聽。
- `init3D()` 在 `#bg` 內加一張 `#fx3d` canvas,手寫 3D 粒子場(透視投影 + 滑鼠/陀螺儀視差 + 連線 + 微光),大廳全強度、其他頁 `window.__fxMode(view)` 自動淡到很弱;使用者資料經 `esc()` 轉義。

## 驗證習慣(每次改完必做)

1. `data.json`:`json.load` 驗證;`json.dump`(indent=2, ensure_ascii=False)寫入。
2. `app.js`:`node --check app.js` 過語法;用輕量 DOM shim(stub `document/window/fetch`)跑 `load()` 與模擬 click,驗證大廳→分類→個體切換→時間軸→燈箱。jsdom 在此環境被擋。
3. **注意此掛載點對 app.js 分次/大量寫入偶爾會截斷** → 改動後務必 `node --check`;若被截斷,用單次 `cat > app.js <<'EOF'` 完整重寫。

## 部署(GitHub Pages)

- commit 全部檔案 → main / root。字型走 Google Fonts CDN,瀏覽需連網。
- **快取破壞**:`index.html` 對 `styles.css`/`app.js` 用 `?v=N` 版本參數;**每次改 css/js 就把 N +1**,避免使用者被舊快取卡成白畫面。目前為 `?v=6`。
- **燈箱隱藏坑**:`#lightbox` 用 `hidden` 屬性,但 `.lightbox{display:flex}` 會蓋過 `[hidden]` 的預設 `display:none`,導致燈箱變成永遠蓋滿畫面的深色遮罩(整頁看似全黑,其實內容已渲染)。務必保留 `.lightbox[hidden]{display:none}` 這條規則。
- 若使用者回報「空白/開不起來」:多半是舊快取——先請他無痕視窗或 Ctrl+Shift+R;根治靠上面的 `?v=N` bump。
