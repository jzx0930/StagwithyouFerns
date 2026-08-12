---
name: update-plant-wall
description: StagwithyouFerns 專案的「唯一最新事實來源」交接文件 + 「開始更新」工作手冊。當使用者說「開始更新」時,依本檔「附錄 A」執行 Drive → data.json 更新流程;任何裝置或 AI 接手本專案時,只讀本檔即可完整掌握現況。
---

# StagwithyouFerns — 專案交接文件(單一事實來源）

> **本檔用途**:這是給「**別的裝置或別的 AI**」接手本專案用的**唯一交接文件**。只讀這一份、不看其他檔,就能完整掌握專案現況並安全地繼續修改。所有數字/版本/路徑均以「探勘當下的實際檔案」為準(最後校對:2026-08-12)。
>
> **維護規則(鐵則)**:**日後每次修改專案,都要同步更新這份文件**,讓它永遠是最新事實。改了哪個檔的版本號、加了什麼功能、刪了什麼資產,都要回來改對應章節(尤其 §3 目錄、§10 當前狀態)。文件本身的文字修訂**不需**動任何程式 `?v=N` 版本號。

---

## 1. 一句話定位

**StagwithyouFerns** 是一個**深色玻璃質感的植物成長紀錄靜態網站**,部署在 **GitHub Pages**。給植物收藏者(鹿角蕨、棒槌、仙人掌、塊根多肉等)用來展示每一株的 **3D 分類封面 + 成長時間軸**。核心設計:**照片全放 Google Drive,網站只存文字與照片 ID**,所以 repo 幾乎不佔空間、部署極快。可選的「購買/詢價」功能讓它也能當賣場。

## 2. 技術棧與架構

- **無框架、無建置步驟(no build)**:純 HTML + CSS + 原生 JavaScript。每支 JS 都是 IIFE(立即函式),用 `<script>` 直接載入,**沒有 bundler、沒有 npm 執行期相依**。改完存檔 → GitHub Desktop commit + push 就上線。
- **載入順序(`index.html` 第 41–49 行,順序有意義)**:
  1. `shop/shop-config.js` → 設 `window.SHOP_CONFIG`(價格、Web3Forms key)。
  2. `config/config.js` → 同步 XHR 讀 `config/config.ini` → 設 `window.SITE_CONFIG`;並用 `[shop]` 覆寫 `SHOP_CONFIG.enabled/currency`。
  3. `staghorn-fern.js` → 定義 `<staghorn-fern>` Web Component。
  4. `orb.js` → 定義 `window.SFOrb`(載入用點陣光球)。
  5. `intro.js` → 開場飛越動畫。
  6. `shop/shop.js` → 購物車 `window.SHOP`。
  7. `plant-notes.js` → `window.PLANT_NOTES`(每株介紹筆記)。
  8. `app.js` → 主程式(大廳/分類/詳情/燈箱/背景 3D)。
  9. `layout.js` → 版面拖曳編輯器(`?edit` 時才顯示手把)。
- **資料流**:`app.js` `load()` → `fetch('./data.json')` → `state.data` → `render()` 依 `state.view` 呼叫 `renderLobby / renderGrid / renderDetail`。互動用**事件委派**:`#app` 上單一 click 監聽,靠 `data-act`(enter/tab/open/indiv/lobby/back-grid/zoom)+ `data-i` 分派。
- **設定驅動外觀**:`config.ini` 的值進 `window.SITE_CONFIG`,被 `app.js`(粒子亮度、卡片明顯度、動畫開關)、`config.js`(字型、背景、標題)即時採用。
- **照片來源**:Google Drive 檔案 ID → `driveImg()` 轉 `https://lh3.googleusercontent.com/d/<ID>=w<寬>`。照片須設「知道連結的任何人/檢視者」才顯示得出來。
- **外部相依(全走 CDN,無金鑰)**:`<model-viewer>`@4.0.0(jsdelivr,真實 3D 模型封面)、GSAP 3.12.5(cdnjs,開場動畫)、hanzi-writer@3(jsdelivr,中文名筆順動畫)、Google Fonts、Three.js(cdnjs,`staghorn-fern.js` 首次使用時才載)。

## 3. 目錄結構(每個關鍵檔用途)

**根目錄(會部署的執行檔)**
- `index.html` — 骨架;載字型 + `styles.css` + 各 JS;含背景層 `#bg`、內容容器 `#app`、燈箱 `#lightbox`。**本檔沒有 `?v=` 版本參數**(改它時使用者需 Ctrl+Shift+R)。
- `styles.css` — 全部樣式與動畫(玻璃卡片、極光、螢火蟲 `fireDrift/fireTwinkle`、燈箱)。目前 `?v=44`。
- `app.js`(595 行,`?v=47`)— 主邏輯。關鍵函式:`load()`(讀 data.json)、`render()`/`renderLobby()`/`renderGrid()`/`renderDetail()`、`parseCat()`(拆「中文+屬名」)、`normCats()`、`normIndiv()`/`indivLabel()`(個體)、`driveImg()`/`coverImg()`、`noteOf()`/`fmtNote()`(套 plant-notes)、`init3D()`(背景螢火蟲粒子 canvas)、`mountModelOrbs()`(3D 模型 poster 放光球)、`openLightbox()`/`cycleZoom()`。`state = { view, tab, selected, indiv, data, cats, lbUrl, lbScale }`。
- `intro.js`(270 行,`?v=19`)— 開場飛越:`startFlight()`/`runFlightGSAP()`/`renderFlight()`/`scheduleLand()`/`autoEnter()`/`enter()`;`warmLobby()` 預熱大廳。受 `config.ini [intro]` 控制。
- `orb.js`(101 行,`?v=14`)— 載入光球 `window.SFOrb.mount(container,{size,count,color})`:完整點陣經緯格線球恆顯示,隨機挑一條經/緯線做 90° 正/逆旋轉(一次一條)。**必須同步渲染**(model 光球生命週期短)。被 `intro.js` 與 `app.js mountModelOrbs()` 使用,model-viewer 觸發 `load` 時 `stop()`。
- `layout.js`(196 行,`?v=3`)— 版面拖曳/縮放編輯器。讀寫 `config/layout.json`,對帶 `data-lay="..."` 的元素套位移/縮放。網址加 `?edit` 才顯示手把。
- `config/config.js`(139 行,`?v=9`)— `config.ini` 載入器:`parseIni()`、`loadGoogleFont()`、`applyFonts()`;結果放 `window.SITE_CONFIG`。**同步 XHR**,`file://` 直開讀不到會用預設。
- `staghorn-fern.js`(310 行,`?v=1`)— `<staghorn-fern>` Web Component(自帶 3D 鹿角蕨,首用自 cdnjs 載 Three.js)。僅在分類 `fx==='staghorn-fern'` 或 `name==='鹿角蕨'` **且該分類無 `.glb` model** 時當封面(有 model 時 model 優先,故目前實際少用)。
- `plant-notes.js`(133 行,`?v=1`)— `window.PLANT_NOTES`,key = 植物中文名。詳情頁顯示的「植物介紹」。Drive 重建 data.json **不會**覆蓋它。
- `shop/shop-config.js`(30 行,`?v=1`)— 賣家自編:`window.SHOP_CONFIG = { enabled, web3formsKey, currency, prices{} }`。
- `shop/shop.js`(262 行,`?v=1`)— 購物車 `window.SHOP`:`add/setQty/removeItem`、`renderDrawer/renderCheckout`、`submitOrder()`(POST 到 Web3Forms)。購物車存 `localStorage['sf_cart_v1']`。
- `data.json` — 內容主檔(見 §4)。目前 **9 分類 / 123 株 / 161 個體 / 493 張時間軸照片**。頂層 keys:`_說明`、`categories`、`_範例植物格式`、`plants`。
- `config/config.ini` — 網站行為/外觀開關(見 §4「設定」)。
- `config/layout.json` — 版面位移覆寫;目前 `{}`(無調整)。
- `site.webmanifest`、`icon/*` — PWA 名稱/圖示、favicon、apple-touch-icon。
- `models/<屬名>/<屬名>.glb` + `<屬名>-poster.webp/.png` — 各分類 3D 封面。現有 9 個屬:Agave、Cactaceae、Caudex、Euphorbiaceae、Foliage、Gallery、Pachypodium、Platycerium、Succulent。命名一律用**屬名**(由分類 latin 推),`data.json` 該分類 `"model": true` 就自動抓 `models/<屬名>/<屬名>.glb`。

**開發/工具檔(不一定要部署)**
- `README.md` — 給人看的架站說明(填照片、GitHub Pages 上架)。
- `CLAUDE.md` — 專案協作規範(給 AI 的專案內指令)。
- `SKILL.md` — **本檔**(交接 + 開始更新手冊)。**依使用者要求不推上庫**(見 §11)。
- `note.txt` — 使用者隨手筆記(3D 生成網站連結、Web3Forms 連結、待辦提醒)。
- `tools/` — 只在**使用者電腦上**跑的腳本(檔案工具/連接器都無改名功能):
  - `rename_plants.ps1`(分類 + 非鹿角蕨植物)、`rename_platycerium.ps1`(鹿角蕨):UTF-8+BOM,`Rn` 函式含 `Test-Path` 保護,**只 append 不刪**。
  - `run_rename.bat`:純 ASCII、`chcp 65001`、`-ExecutionPolicy Bypass` 依序呼叫兩支 ps1。
  - `optimize_models.ps1` / `.bat`:.glb 壓縮(依賴 Node.js + gltf-transform,bat 會自動 `npm install -g @gltf-transform/cli`)。
  - `orb-vendor/`(`build.bat`、`entry.mjs`)— 把官方 `thinking-orbs` npm 元件打包成 `vendor/thinking-orbs.js` 的工具。**目前未使用**(見 §6)。
  - `test-snapshot.html` — 測試用臨時頁。
- `config/config-editor.html` + `config/config-editor.bat` + `config/serve.py` — **本機**設定/版面編輯器:`serve.py` 起一個 localhost:8137 伺服器,服務整個專案並接受 POST 把調整結果寫回 `config.ini`/`layout.json`。**純本機開發工具,不部署**。
- `_backup/` — 手動還原備份(gitignore)。

## 4. 功能總覽(使用者視角 + 開發者視角)

**導覽三層**(使用者)→ 大廳(分類圖片/3D 卡)→ 分類植物牆(可分頁)→ 植物詳情(個體 # 切換 + 成長時間軸 + 燈箱放大)。
- 大廳:`renderLobby()`(app.js:241)。分類卡封面優先序 **model(.glb)> `<staghorn-fern>` > 圖片**。
- 分類牆:`renderGrid()`(app.js:278);上方可放一個較大、可拖曳的 3D 模型 hero。
- 詳情:`renderDetail()`(app.js:327)。**順序固定為:植物介紹(plant-notes)→ 選擇個體 → 成長時間軸**。名稱進場用 hanzi-writer 手寫(`runDetailIntro()`)。
- 燈箱:`openLightbox()`/`cycleZoom()`(app.js:453+);`#lightbox` 用 `hidden` 屬性,靠 `.lightbox[hidden]{display:none}` 這條 CSS 才不會變全黑遮罩(見 §9 雷區)。
- 背景:`init3D()`(app.js:477)在 `#bg` 疊一張 canvas 手寫 3D 粒子場(螢火蟲,透視 + 滑鼠/陀螺儀視差),大廳全強度、其他頁自動淡弱。
- 購買/詢價(可選):`window.SHOP`(shop.js)。加入購物車 → 結帳 → `submitOrder()` POST 到 Web3Forms 寄訂單信。**目前關閉**(見 §6)。

**data.json 結構**(開發者)
```json
{
  "categories": [ { "name": "鹿角蕨Platycerium", "cover": "<Drive ID 或網址>", "model": true } ],
  "plants": [{
    "name": "一本尼", "latin": "Pachypodium eburneum",
    "category": "棒槌",                 // 只填中文,須等於某 category 的中文部分
    "date": "2026.06.07", "note": "", "cover": "<Drive ID>",
    "individuals": [
      { "label": "#99", "name": "酋長", "cover": "<Drive ID>",
        "timeline": [ { "date": "2026.06.07", "tag": "#99", "note": "...", "photo": "<Drive ID>" } ] }
    ]
  }]
}
```
- `category.name` = 「中文+屬名」(例 `鹿角蕨Platycerium`);`parseCat()` 拆成 `zh`(顯示)+`latin`(斜體小字)。**植物 `category` 只填中文**,靠 `zh` 比對歸類 → 改分類屬名不會讓植物跑掉。
- `date` 一律 `YYYY.MM.DD`;時間軸自動排序、**最新在最上**。
- `cover`/`photo` 填 Drive 檔案 ID 或完整網址;留空 = 佔位框。
- `individuals`:每個 `{label,cover,timeline}` 是一株;`name` = 個體暱稱(選填)。`normIndiv()` 相容舊格式(直接 `plant.timeline`)。詳情頁在「個體數>1 或有 label」時顯示切換列,標題用 `indivLabel()` 顯示「暱稱(#NN)」。

**設定(config.ini,改檔即生效)**:`[site]`(標題/副標)、`[background]`(背景 Drive ID/亮度)、`[intro]`(開場飛越開關/秒數)、`[effects]`(螢火蟲、卡片明顯度 `panel_opacity`/`metric_opacity`、傾斜/磁吸/進場)、`[shop]`(購買主開關/幣別)、`[handwriting]`(中文筆順/英文書寫速度)、`[fonts]`(標題/內文 Google Fonts 名、`font_scale`)。

## 5. 如何在新環境跑起來

**只是瀏覽/部署**(最常見,零安裝):
- 本機預覽:專案根執行 `python -m http.server 8000` → 開 `http://localhost:8000/`(**不要**直接雙擊 `index.html`,`file://` 讀不到 `config.ini`/`data.json`)。或雙擊 `config/config-editor.bat`(起 serve.py,localhost:8137,可即時調設定與版面)。
- 部署:把 repo push 到 GitHub → **Settings → Pages → Source = `main` / `/root`** → 得到 `https://<帳號>.github.io/StagwithyouFerns/`。字型/CDN 需連網。**沒有任何建置指令**。
- 驗證改動:`data.json` 用 `python -c "import json;json.load(open('data.json'))"`;`app.js` 用 `node --check app.js`。

**要改照片內容**:編 `data.json`(手動或用「開始更新」流程由 Drive 產生)。

**要壓縮新 3D 模型**:裝 Node.js,把原始 `.glb` 放 `models/<屬名>/未壓縮/<屬名>.glb`,雙擊 `tools/optimize_models.bat`。

**要「開始更新」(Drive→data.json)**:見**附錄 A**;需 Google Drive 桌面版同步碟 + Google Drive 連接器。

## 6. 已擁有但「未啟用 / 未使用」的功能與資產

| 項目 | 位置 | 為何未用 | 要啟用怎麼做 | 可否安全刪除 |
|---|---|---|---|---|
| **購買/詢價功能** | `shop/shop.js`、`shop/shop-config.js` | `config.ini [shop] enabled = false` **覆寫**了 shop-config 的 `enabled:true` → 全站目前不顯示購買 | 把 `config.ini [shop] enabled` 改 `true`;在 `shop-config.js` `prices` 填價格 | 保留(隨時可開) |
| **官方 thinking-orbs 打包產物** | `vendor/thinking-orbs.js`(約 158KB) | 載入球已改回自製 `orb.js`,**index.html 未引用** vendor 檔 | 若要換回官方版,index.html 於 `orb.js` 前加 `<script src="vendor/thinking-orbs.js">` 並改寫 orb 掛載 | **可刪**(連同 `tools/orb-vendor/`),目前純多餘 |
| **`<staghorn-fern>` 3D 元件** | `staghorn-fern.js` | Platycerium 分類有 `.glb` model,而 **model 優先**於此元件 → 實務上不觸發 | 某分類移除 `model` 並設 `fx:'staghorn-fern'`(或名為`鹿角蕨`) | 保留(是備援封面) |
| **本機設定/版面編輯器** | `config/serve.py`、`config-editor.html`、`config-editor.bat` | 純本機開發工具,不隨網站部署 | 雙擊 `config-editor.bat`,瀏覽器開 localhost:8137 | 保留(方便調參) |
| **未壓縮原始模型** | `models/**/未壓縮/`、`*-original.glb` | 只作重壓縮備份,gitignore、不部署 | 需重壓時放回對應資料夾再跑 optimize | 本機可刪(但重壓要重下載) |

## 7. 不納入版控的內容與運作邏輯(`.gitignore` 逐條)

被忽略者**皆非網站執行/部署所需**,拿掉不影響線上運作:
- `_backup/` — 手動還原備份,純本機。
- `_movetest/`、`新增資料夾/` — 誤建空夾。
- `models/**/未壓縮/`、`models/**/*-original.glb`、`*.opt.glb` — 未壓縮原模型;網站只用壓好的 `<屬名>.glb`(已在 repo)。**留原檔會拖垮 GitHub Pages 的 syncing_files**,故擋掉。
- `glb-optimization-master*/` — 下載的壓縮工具,不該進 repo(`optimize_models.bat` 只靠 Node+gltf-transform,與它無關)。
- `_*_preview.png`、`models/**/*-poster.png`、`_poster_sheet.png` — 暫存預覽圖(網站用 `-poster.webp`)。
- `models/**/Hitem3d-*.glb`、`Meshy_*.glb` — AI 生成的大原始檔。
- `_new_plants.json` — 子代理重建 data.json 的暫存。
- `tools/orb-vendor/node_modules/`、`package.json`、`package-lock.json` — 打包用相依,只需本機。**注意**:`vendor/thinking-orbs.js`(打包產物)**沒**被 ignore(原設計要 commit),但目前未被引用 → 見 §6 可刪。
- `SKILL.md` — **本次新增**(依使用者要求,交接文件不推上庫;見 §11)。

## 8. 機密與外部相依(帳號/金鑰)

- **Web3Forms(訂單信箱服務)**:access key = `43d41607-5a34-4ef1-a764-6f4246f6b18a`,寫在 `shop/shop-config.js`。這是 Web3Forms 的**前端公開 key**(設計上就放在 client;訂單經 `https://api.web3forms.com/submit` 寄到「申請此 key 時綁定的信箱」)。**申請/管理處**:`https://web3forms.com`(`note.txt` 記 `https://app.web3forms.com/onboarding/create`)。若被濫發,到 Web3Forms 後台重新產生 key 換掉即可;它**不是**能存取帳號的密鑰,可安全留在 repo。
- **Google Drive(照片主機)**:所有照片存在 Drive「植物照片」資料夾,以檔案 ID 經 `lh3.googleusercontent.com/d/<ID>` 內嵌。整夾須為「知道連結的任何人 / 檢視者」才顯示。`data.json` 由 **Google Drive 連接器**走訪產生。桌面同步碟路徑:`C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片`(**不是**失效的 `G:\`)。
- **GitHub Pages(主機)**:repo `StagwithyouFerns`,`main`/`root` 部署。無伺服器、無環境變數、無資料庫。
- **CDN(無金鑰)**:model-viewer、GSAP、hanzi-writer、Google Fonts、Three.js。皆公開 CDN,離線則對應功能失效但不致命。
- **無其他密鑰/憑證/環境變數**:整站是靜態前端,沒有 `.env`、沒有後端 token。
- **帳號登錄對照(請持有者補實際帳號 email,避免臆測)**:

  | 服務 | 用途 | 註冊帳號 | 帳號內有什麼 |
  |---|---|---|---|
  | GitHub | repo + Pages 部署 | (由持有者填) | 本 repo、Pages 設定 |
  | Google Drive | 照片主機 | (由持有者填) | 「植物照片」資料夾(分類/植物/個體階層 + 照片) |
  | Web3Forms | 訂單信件 | 綁定於 key `43d4…f6b18a` 的 email(由持有者填) | 收單信箱設定、key 管理 |

  Cowork 操作者 email:`erdapplication@gmail.com`(僅供辨識,非上述服務登入帳號)。**若要外洩處置**:GitHub 用 repo Settings 撤權/改密;Drive 用檔案共用設定;Web3Forms 重產 key。

## 9. 慣例與雷區

- **快取破壞**:`index.html` 對 `styles.css`/各 JS 用 `?v=N`;**每次改該 css/js 就把它的 N +1**,否則使用者被舊快取卡成白畫面。`index.html` 自身無版本參數 → 改它要請人 Ctrl+Shift+R。
- **燈箱全黑坑**:`#lightbox` 用 `hidden` 屬性,但 `.lightbox{display:flex}` 會蓋過 `[hidden]` 預設的 `display:none`。**務必保留 `.lightbox[hidden]{display:none}`**,否則整頁看似全黑。
- **分類歸類**:植物 `category` **只填中文**(如 `棒槌`),對應 `category.name` 的中文段;填成「棒槌樹」會對不上而消失。棒槌類一律填「棒槌」。
- **latin 屬名**:仙人掌(Cactaceae)、塊根(Caudex)、大戟(Euphorbiaceae)、觀葉(Foliage)分類夾名是「科/泛稱」;寫 latin 要用該株**真正的屬**(如 Lophophora、Alocasia),不是分類名。
- **檔名日期格式**:照片檔名可能是 `2025:10:21 22:05:35.jpeg`(冒號、且年份可能是 2025)→ 掃描別只抓 `2026*`,會整批漏。
- **本機 Drive 快取**:Glob 讀同步碟有時回舊快取 → 「使用者說有更新但掃不到」時,改用 Drive 連接器 `search_files`(讀雲端即時)。
- **app.js 大量寫入偶爾截斷**:此掛載點對 app.js 分次寫入偶爾截斷 → 改完務必 `node --check app.js`;被截斷就用單次完整重寫。
- **PowerShell 中文**:rename ps1 必須存 **UTF-8 + BOM**,否則 PowerShell 5.1 讀不對中文。
- **同步 XHR 讀 config.ini**:`file://` 直開讀不到 → 一定要用 http server 預覽。
- **平台路徑**:改名腳本用 `C:\` 同步碟路徑,不是 `G:\`。

## 10. 當前狀態速記

- **版本號**(index.html):`styles.css?v=44`、`shop-config.js?v=1`、`config.js?v=9`、`staghorn-fern.js?v=1`、`orb.js?v=14`、`intro.js?v=19`、`shop.js?v=1`、`plant-notes.js?v=1`、`app.js?v=47`、`layout.js?v=3`。
- **規模**:data.json = 9 分類 / 123 株 / 161 個體 / 493 張時間軸照片;`plant-notes.js` = 122 則筆記;`models/` = 9 個屬的壓縮 .glb。
- **最近改動**:載入光球 `orb.js` 重寫為 v14(完整點陣經緯球恆顯示 + 隨機單條經/緯線 90° 正逆旋轉,一次一條);先前移除了「撕貼紙」個體切換;詳情頁順序固定為 介紹→選個體→時間軸;`config/layout.json` 重置為 `{}`。
- **已知狀態/待辦**:
  - `vendor/thinking-orbs.js` + `tools/orb-vendor/` 目前無用,可刪(§6)。
  - 購買功能被 `config.ini [shop] enabled=false` 關閉中。
  - 少數植物暱稱查不到正式學名,latin 暫維持中文(見附錄 A 對照表尾);待補:情花few 等。
  - `SKILL.md` 若原本已被 git 追蹤,加入 `.gitignore` 後需執行一次 `git rm --cached SKILL.md` 才會停止推送(見 §11)。

## 11. 版控範圍(只推必要,其餘留本機)

**必須推上庫(網站執行/部署所需)**:`index.html`、`styles.css`、`app.js`、`intro.js`、`orb.js`、`layout.js`、`config/config.js`、`config/config.ini`、`config/layout.json`、`staghorn-fern.js`、`plant-notes.js`、`shop/shop.js`、`shop/shop-config.js`、`data.json`、`site.webmanifest`、`icon/*`、`models/<屬名>/<屬名>.glb` 與 `-poster.webp`。

**留本機即可(不影響部署)**:`SKILL.md`(本檔,依要求不推)、`_backup/`、未壓縮模型、`tools/orb-vendor/node_modules` 等打包相依、各暫存/預覽圖(已由 `.gitignore` 處理)。`README.md`/`CLAUDE.md`/`note.txt`/`tools/`/`config/serve.py`+`config-editor.*` 屬開發輔助,推不推由持有者決定(推上去無害、但非執行必需)。

**依使用者要求:`SKILL.md` 不推上庫** — 已加入 `.gitignore`。若之前已被追蹤,執行一次 `git rm --cached SKILL.md` 後 commit,即停止推送而保留本機檔。

---

# 附錄 A — 「開始更新」工作手冊(Drive → data.json)

**觸發語**:使用者說「**開始更新**」。收到後嚴格照下列順序執行。

## 環境限制
- Drive 資料夾正確路徑 `C:\Users\MyUser\Google 雲端硬碟檔案串流\我的雲端硬碟\植物照片`(**不是失效的 `G:\`**;腳本 `$base` 也用 C:\)。bash 無法掛載,用 `Glob`/`Read` 或 Drive 連接器。
- 檔案工具/連接器都**沒有改名功能** → 改名一律靠 `tools/` 的 PowerShell 腳本在使用者電腦上跑。
- 我不能改 Drive 分享權限;需照片為「知道連結的任何人/檢視者」才顯示(目前整夾已公開)。

## 命名規則
- **Drive 資料夾格式(連字號 `-`)**:分類夾 `屬名-中文`(例 `Platycerium-鹿角蕨`);植物夾 `種小名/園藝名-中文`(例 `elephantotis-象耳`、`Geisha-藝伎`);個體夾 `#01`…(不改),可帶暱稱 `#編號-暱稱` 或無連字號 `#15酋長`(regex `^(#\d+)[-\s]*(.*)$`)。已是純英文(Akki/Nano/E)不動。
- **分類屬名對照**:鹿角蕨=Platycerium、棒槌=Pachypodium、仙人掌=Cactaceae、龍舌蘭=Agave、塊根=Caudex、多肉=Succulent、大戟=Euphorbiaceae、觀葉=Foliage、美照=Gallery。
- **植物命名決策**(上網查證):原生種→種小名;園藝品種→英文園藝名;交種→交種式或已知英文交種名;查不到→維持中文並回報;已英文→不動。
- **深度查名**(用 Claude in Chrome `browser_batch` 一次多組「navigate Google 搜尋 → get_page_text」):查詢式帶中文暱稱+屬名+猜的英文;可靠來源(交叉比對 ≥2):蝦皮、FB 蕨類買賣交流、haruhanaplants、HippoFerns、Threads、痞客邦、doromon01、Tumblr 品種樹狀圖;仙人掌/塊根用 百度百科、塔內、iPlant、有肉。注意音近正字(雷達=Raider、艾沙=Elsa、佛朗明哥=Flamenco)。

## 執行步驟(嚴格照順序)
1. **掃描 + 偵測變更**:掃全部分類/植物夾,與現有 `data.json` plants + 現有資料夾名比對,分:(A)新增/改名夾;(B)舊植物補了新照片(名稱沒變,需比對 data.json 該株照片數 vs Drive 實際數,用連接器 `search_files`);(C)沒變則跳過。先列「這次要處理的清單」。⚠️ 兩大盲點:檔名可能是 `2025:M:D` 冒號格式(別只掃 `2026*`);本機清單會快取(掃不到就改用 Drive 連接器讀雲端)。
2. **查名 + 附加腳本**:不符「英文-中文」的夾 → 查名,把 `Rn '舊' '新'` **append** 到 `tools/rename_plants.ps1`(分類+非鹿角蕨)或 `tools/rename_platycerium.ps1`(鹿角蕨)。只 append 不刪;都符合就跳到第 5 步。⚠️ **查到英文名就一定要改資料夾名**(不能只寫進 data.json latin)。
3. **請使用者跑 bat → 停下來等**:請他雙擊 `tools/run_rename.bat`,**停在這等他回「好了」+ Drive 同步完成才繼續**。
4. **驗證改名**:重新 `Glob` 確認每筆生效;沒改到就請他**再雙擊一次**(腳本冪等)。
5. **更新 data.json(增量優先)**:只抓新增/改名/補照片那幾株補進 `plants`,保留其餘及 `categories`/`_說明`。整棵樹用 subagent 走訪雖可但 200+ 檔易 API 中斷,斷了改增量補齊。latin:仙人掌/塊根/大戟/觀葉填該株**真正的屬**;棒槌 `category` 一律填「棒槌」。個體 `#NN-暱稱` 拆 `label="#NN"`+`name="暱稱"`。時間軸 `date` 由檔名解析(`YYYY:M:D` / `YYYY年M月D日` → `YYYY.MM.DD`),自動排序最新在上。寫檔用 `json.dump(ensure_ascii=False, indent=2)`,寫完 `json.load` 驗證。
6. **提醒 commit + push**。

## 收尾自我檢查(每次結束前)
1. 查到新英文名的植物是否都 append `Rn` 到腳本?2. 是否請使用者跑 bat 並重新 Glob 驗證每夾變「英文-中文」?3. Drive 是否已無純中文暱稱夾(純英文除外)?4. data.json 是否同步(name 中文、latin 帶品種名)?5. **新增植物是否都在 `plant-notes.js` 補了介紹筆記(美照相簿除外)**?

## plant-notes.js 筆記格式(每株都要有)
第一行 `***學名***`;第二行 `**中文名 — 科/屬,一句特色**`;一段 2–3 句描述;分隔線 `˚°˖✿˖°˚`×5;`小知識💡`(產地、夏/冬型、休眠);`📝養護筆記`(難度⭐️、光照、澆水、休眠、介質各一行)。使用者可能自己寫(如「四叉」是第一人稱),已有內容不要覆蓋,只補缺的。

## 已建立的中↔英對照(供延用,節錄)
- 棒槌:席巴女王玉櫛=densiflorum、光堂=namaquanum、象牙宮=gracilius、非洲霸王樹=lamerei、亞阿相界=`Pachypodium geayi`。
- 仙人掌:銀冠玉=fricii、烏羽玉=williamsii、紫兜=asterias、猴尾柱=colademononis、直刺佩雷=perezdelarosae、士童=castanea、天紫玉=`Gymnocalycium pflanzii var. albipulpa`。
- 塊根:奇異油甘=mirabilis、龜甲摩蘿=cyclophylla、彎彎曲曲樹=madagascariensis、南非龜甲龍=`Dioscorea elephantipes`、安哥拉葡萄甕=`Cyphostemma uter var. macropus`、萬象=`Haworthia maughanii`。
- 大戟:子吹布紋球=meloformis、白衣魁偉玉=horrida、鬼棲閣=guillauminiana、綠鬼玉=decepta、金輪際=gorgonis、法利達=valida、九頭龍=inermis、群星冠=stellispina。
- 龍舌蘭:吉祥冠覆輪=potatorum。多肉:黑騎士=`Echeveria 'Black Knight'`。觀葉:斑馬=`Alocasia zebrina`。
- 鹿角蕨原生種:女王=wandae、象耳=elephantotis、安地斯=andinum、菲律賓皇冠=coronarium、三角=stemaria、四叉=quadridichotomum、亞猴=ridleyi、非猴=madagascariense、巨獸=grande、巨大=superbum、白鹿=bifurcatum、奧銀=veitchii、深綠=hillii、圓盾=alcicorne。
- 鹿角蕨品種/交種:藝伎=Geisha、銀華=Ginka、金童=GoldenBoy、飛飛達爾文=Darwin、三角四叉=`'African Oddity'`、雷達=`'Raider'`、艾莎=`'Elsa'`、獅子座=`willinckii 'Leo'`、佛朗明哥=`hillii × coronarium 'Flamenco'`、史迪奇=`'Stitch'`、奶油獅=`willinckii 'Cream Lion'`、白玫瑰=`willinckii 'White Rose'`、三叉戟=`Platycerium 'Trident'`、玉女=`willinckii 'Jade Girl'`、爆米花=`'Popcorn'`、愛麗絲=`'Alice'`、雷神=`'Thor'`、月光=`'Moonlight'`、清姬=`'Kiyohime'`、深綠龍=`hillii 'Drang'`。
- Nano/OMG:Drive 夾 `P. Willinckii Nano/OMG`,但**網站顯示名維持短的 `Nano`/`OMG`**,latin=`Platycerium willinckii 'Nano'/'OMG'`。
- **查不到維持中文**:蒼鬼塔、群星際、寶塔摩蘿、細菌、單刺蓬萊宮、鬼精棒、情花few、深綠龍x野銀。
- **這些暱稱株完整 latin 以 data.json 為準(含品種引號);全樹重建時資料夾名只切得出屬名,務必套本表補回。**
