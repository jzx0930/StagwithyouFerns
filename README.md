# 植物照片牆 · 架站說明

深色玻璃質感的植物成長紀錄站。照片放在 **Google Drive**,網站只存文字,GitHub Pages 幾乎不佔空間。

## 檔案
- **index.html** — 網站本體(字型、程式全內嵌)
- **data.json** — 你要編輯的內容檔:植物、日期、備註、每張照片的 Drive ID

上架只需要這兩支檔案放在同一層。

---

## 一、把照片放到 Google Drive 並取得「檔案 ID」
1. 上傳照片到你的雲端硬碟。
2. 對照片按右鍵 →「共用」→ 把權限改成 **「知道連結的任何人 / 檢視者」**(這步很重要,否則圖不會顯示)。
3. 複製連結,長得像:
   `https://drive.google.com/file/d/`**`1A2b3C4d5E6f7G8h9I0`**`/view?usp=sharing`
   中間那段粗體就是 **檔案 ID**。

## 二、把 ID 填進 data.json
- 每株植物的 `cover` = 封面照片的檔案 ID。
- 每個時間軸節點的 `photo` = 那天照片的檔案 ID。
- 留空字串 `""` 就顯示佔位框。
- 也可以直接貼完整圖片網址(以 http 開頭),系統會照用。

範例:
```json
{ "date": "2024.11.05", "tag": "開背", "note": "第七片葉開孔。", "photo": "1A2b3C4d5E6f7G8h9I0" }
```

## 三、發佈到 GitHub Pages
1. 建一個 repo,把 `index.html` 和 `data.json` 上傳(放在根目錄)。
2. repo → **Settings → Pages** → Source 選 `main` 分支、`/root`,存檔。
3. 等一兩分鐘,GitHub 給你網址(`https://你的帳號.github.io/repo名/`)。
4. 之後要加照片/植物:只改 `data.json` 再 commit,網站自動更新,不必動 index.html。

---

## 小提醒
- 照片一定要設成「知道連結的任何人可檢視」,否則會顯示佔位框。
- Google Drive 偶爾對熱連結有流量限制;若要非常穩定、大量瀏覽,日後可考慮改用 Cloudinary、imgur 或 Cloudflare R2 等圖床(填法一樣,把 `photo` 換成該圖床的完整網址即可)。
- 想改文字、日期、植物順序,全都在 `data.json` 內完成。
