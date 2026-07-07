# 3D 模型資料夾(.glb)

每個要顯示 3D 模型的分類,在這裡開一個**以屬名命名**的資料夾,裡面放**同名**的 `.glb`:

```
models/<屬名>/<屬名>.glb
```

例:`models/Platycerium/Platycerium.glb`、`models/Caudex/Caudex.glb`。

## 啟用(讓大廳分類卡 + 分類頁變成可拖曳 3D 模型)
1. 分類名要是「中文+屬名」(例 `鹿角蕨Platycerium`);`app.js` 會從屬名推路徑。
2. 把 `<屬名>.glb` 放進 `models/<屬名>/`。
3. 開 `data.json`,把該分類的 `"model"` 設成 `true`。
   - `model: true` → 自動載入 `models/<屬名>/<屬名>.glb`
   - `model: "models/xxx.glb"`(字串)→ 直接用這個路徑
   - `model: false` / 空 → 沒有 3D 模型(改用程序生成鹿角蕨 or 圖片封面)
4. commit + push。大廳該卡與分類頁上方都會出現可旋轉的模型。

目前已有:`Platycerium`、`Pachypodium`、`Agave`、`Caudex`。

## 產生 .glb 的方式
用任一「圖片轉 3D」服務上傳照片,匯出 **GLB**:
Meshy.ai / Tripo3D / Luma Genie / Rodin(Hyper3D)/ 騰訊 Hunyuan3D / Stability SPAR3D / Hitem3d。
(單張照片:正面佳、背面為 AI 推測;薄的孢子葉可能較糊,想更好可用多角度照片。)

## 壓縮(檔案太大時)
AI 生成模型常達數十 MB(多半是高多邊形幾何)。建議壓到單檔 **<15MB** 再放,
避免拖垮 GitHub Pages 的 deploy(syncing_files 逾時)。無 gltf-transform 時,
可用 numpy 頂點叢集減面 + PIL 貼圖轉 JPEG(例 74MB → 8.3MB)。原始大檔**別進 repo**——
`.gitignore` 已擋 `*-original.glb`、`Hitem3d-*`、`Meshy_*`,請把原檔留在本機或 repo 外。

## 注意
若之後用 Google Drive 重新產生 data.json,手填的 `model` 會被覆蓋,需要把要顯示模型的
分類 `model` 重新設回 `true`。
