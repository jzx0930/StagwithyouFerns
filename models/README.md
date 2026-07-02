# 3D 模型資料夾(.glb)

把「圖片轉 3D」服務產生的模型檔放這裡,建議命名:

- `models/staghorn.glb` — 鹿角蕨分類的封面模型

## 產生 .glb 的方式
用任一「圖片轉 3D」服務上傳你的照片,匯出 **GLB** 格式:
Meshy.ai / Tripo3D / Luma Genie / Rodin(Hyper3D）/ 騰訊 Hunyuan3D / Stability SPAR3D。
(單張照片:正面佳、背面為 AI 推測;薄的孢子葉可能較糊,想更好用多角度照片。)

## 啟用(讓大廳該分類卡變成可旋轉 3D 模型)
1. 把 `staghorn.glb` 放進這個 `models/` 資料夾。
2. 開 `data.json`,在「鹿角蕨」那個 category 把 `"model"` 從空字串改成:
   `"model": "models/staghorn.glb"`
3. commit + push。大廳鹿角蕨卡就會用 `<model-viewer>` 顯示可拖曳旋轉的真實 3D 模型。
   (`model` 有值 → 用 3D 模型;空 → 用程序生成鹿角蕨;都沒有 → 圖片封面。)

注意:若之後用 Google Drive 重新產生 data.json,這個手填的 `model` 會被覆蓋,需要再填一次
(或請我把「鹿角蕨→models/staghorn.glb」這個對應寫進同步流程)。
