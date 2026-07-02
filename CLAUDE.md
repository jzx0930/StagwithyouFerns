# StagwithyouFerns — 植物照片牆 / 成長紀錄站

深色玻璃質感的植物成長紀錄靜態網站,部署在 GitHub Pages。照片放 Google Drive(或任何圖床),網站只存文字與照片 ID,幾乎不佔空間。

## 檔案

- **index.html** — 網站本體。這是「打包過」的單一檔案:字型是大量 base64,整個 App 的模板以一個 JSON 字串存在 `<script type="__bundler/template">`(檔案第 179 行)。載入器(第 60 行)用 `JSON.parse(templateEl.textContent)` 讀它,再用 `DOMParser` 渲染。
- **data.json** — 使用者實際要編輯的內容檔(分類、植物、時間軸、照片 ID)。
- **CLAUDE.md / README.md** — 說明。

一般「加植物 / 加分類 / 換照片」只改 `data.json`,不必動 index.html。改完 commit,GitHub Pages 自動更新。

## data.json 結構

```json
{
  "categories": [ { "name": "鹿角蕨", "cover": "<Drive ID 或圖片網址>" }, ... ],
  "plants": [
    {
      "name": "女王", "latin": "Platycerium wandae",
      "category": "鹿角蕨",              // 必須等於某個 category 的 name
      "date": "2026.07.01", "note": "...",
      "cover": "<Drive ID 或圖片網址>",   // 卡片封面
      "timeline": [
        { "date": "2026.06.27", "tag": "紀錄", "note": "...", "photo": "<Drive ID 或網址>" }
      ]
    }
  ]
}
```

規則:
- `date` 格式一律 `YYYY.MM.DD`。時間軸會自動依日期排序,**最新在最上面**。
- 照片 `cover` / `photo`:填 Google Drive 檔案 ID(推薦)或完整 http(s) 圖片網址;留空字串顯示佔位框。Drive ID 會轉成 `https://lh3.googleusercontent.com/d/<ID>=w<寬>`。**照片必須設「知道連結的任何人 / 檢視者」**,否則不顯示。
- 分類 `cover`:大廳分類卡的代表照片。留空 → 自動用該分類第一株植物的 cover;再空 → 佔位框。

## 導覽層級

大廳(分類圖片卡)→ 點分類進入該類植物牆(grid)→ 點植物進成長時間軸(detail)。時間軸每張照片可「⤢ 全螢幕」開燈箱,點圖片可 200% / 350% 放大看細節。背景有 CSS 螢火蟲綠光。

## 編輯 index.html 的打包模板(重要)

不要盲目手改第 179 行那條超長的跳脫字串。用「解碼 → 改 → 重新編碼」流程(用 bash + python,不要用 Read 讀整個檔,字型 base64 會爆 context):

```python
import json
lines = open('index.html', encoding='utf-8').read().split('\n')
tpl = json.loads(lines[178].strip())      # 解成正常 HTML/JS
# ... 對 tpl 做一般字串替換(每次替換前 assert count==1)...
newline = json.dumps(tpl, ensure_ascii=False).replace('</', '\\u002F' 前綴)  # 見下方注意
assert json.loads(newline) == tpl          # 必須能還原
lines[178] = newline
open('index.html','w',encoding='utf-8').write('\n'.join(lines))
```

重點注意:
- 重新編碼後,務必把所有 `</` 換成 `</`(避免 `</script>` 提前結束外層 script 標籤)。原始檔就是這樣做的。
- 模板前端框架是自訂的 **DCLogic**:支援 `<sc-if value="{{ x }}">`、`<sc-for list="{{ arr }}" as="item">`、以及 `{{ }}` 內插(可用在文字、style 屬性值、`onclick`)。
- 主要邏輯在模板尾端的 `class Component extends DCLogic { state / componentDidMount / renderVals }`。`renderVals()` 回傳的物件就是模板綁定的資料來源。
- 圖片用 `React.createElement('img', ...)`;`driveImg(id, w)` 產生 URL。

## 驗證習慣(每次改完必做)

1. `data.json`:`json.load` 驗證合法;用 `json.dump` 寫入(避免覆寫殘留 NUL / 截斷)。
2. index.html:重新 `json.loads(lines[178])` 確認模板仍為合法 JSON,且該行 **不含未跳脫的 `</`**。
3. 邏輯:把 Component class 抽出,在 node 用 stub(`React.createElement`、`DCLogic`)跑 `renderVals()`,驗證篩選、排序、導覽等行為。

## 部署

commit `index.html` 與 `data.json` → GitHub Pages(Settings → Pages,main / root)。網址 `https://<帳號>.github.io/StagwithyouFerns/`。
