#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
trellis_to_glb.py — 用 NVIDIA build 的 Microsoft TRELLIS(圖片轉 3D)把一張照片變成 .glb。

用法(在你自己的電腦跑,金鑰只留在你這邊):
    # 1) 先設定你的 NVIDIA API Key(到 build.nvidia.com 的 TRELLIS 頁按 Get API Key 取得)
    #    Windows PowerShell:
    #        $env:NVIDIA_API_KEY = "nvapi-你的金鑰"
    #    macOS / Linux:
    #        export NVIDIA_API_KEY="nvapi-你的金鑰"
    #
    # 2) 產生模型(輸出預設 models/staghorn.glb),並自動把「鹿角蕨」分類接上:
    #        python trellis_to_glb.py 你的鹿角蕨照片.jpg --set-category 鹿角蕨
    #
    # 其他選項:
    #    -o models/xxx.glb      指定輸出檔
    #    --max 1024             縮圖最長邊(預設 1024;越大越慢、payload 越大)
    #    --seed 0 --steps 25    生成參數(對應網頁上的欄位)
    #
    # 需要 requests;縮圖需要 Pillow(可選):
    #        pip install requests pillow
    #
    # 提示:TRELLIS 是「單一物件」轉 3D。照片請盡量裁成「只有那株鹿角蕨、背景單純」,
    #       否則它會把樹幹、苔、其他東西一起建模,結果會亂。
"""
import os, sys, io, json, time, base64, zipfile, argparse

INVOKE_URL = "https://ai.api.nvidia.com/v1/genai/microsoft/trellis"
STATUS_URL = "https://ai.api.nvidia.com/v2/nvcf/pexec/status/"

GLTF_MAGIC = b"glTF"          # binary glTF(.glb)開頭
ZIP_MAGIC  = b"PK\x03\x04"    # zip 開頭


def load_image_data_uri(path, max_side):
    with open(path, "rb") as f:
        raw = f.read()
    mime = "image/png"
    # 若有 Pillow 就縮圖 + 轉 PNG,縮小 payload、通常也更穩
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = im.size
        scale = min(1.0, float(max_side) / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        raw = buf.getvalue()
    except Exception as e:
        ext = os.path.splitext(path)[1].lower()
        if ext in (".jpg", ".jpeg"):
            mime = "image/jpeg"
        print("  (未使用 Pillow 縮圖:%s;直接送原圖)" % e)
    b64 = base64.b64encode(raw).decode("ascii")
    print("  影像 base64 大小:約 %.2f MB" % (len(b64) / 1e6))
    return "data:%s;base64,%s" % (mime, b64)


def find_model_bytes(obj):
    """遞迴在回傳 JSON 裡找出可解成 .glb 或 .zip(內含 .glb)的 base64 字串。回傳 (bytes, kind)。"""
    stack = [obj]
    best = None
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)
        elif isinstance(cur, str) and len(cur) >= 8:
            s = cur.split(",", 1)[-1]  # 去掉可能的 data:...;base64, 前綴
            try:
                data = base64.b64decode(s, validate=False)
            except Exception:
                continue
            if data[:4] == GLTF_MAGIC:
                return data, "glb"
            if data[:4] == ZIP_MAGIC and (best is None):
                best = (data, "zip")
    return best if best else (None, None)


def glb_from_zip(data):
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = [n for n in zf.namelist() if n.lower().endswith(".glb")]
    if not names:
        names = [n for n in zf.namelist() if n.lower().endswith((".gltf", ".obj"))]
    if not names:
        raise RuntimeError("回傳的 zip 裡找不到 .glb(內含:%s)" % zf.namelist())
    return zf.read(names[0]), names[0]


def main():
    ap = argparse.ArgumentParser(description="TRELLIS 圖片轉 3D → .glb")
    ap.add_argument("image", help="輸入照片路徑(建議先裁成只有鹿角蕨、背景單純)")
    ap.add_argument("-o", "--out", default="models/staghorn.glb", help="輸出 .glb 路徑")
    ap.add_argument("--max", type=int, default=1024, help="縮圖最長邊(預設 1024)")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--steps", type=int, default=25, help="ss/slat 取樣步數(預設 25)")
    ap.add_argument("--slat-cfg", type=float, default=3.0)
    ap.add_argument("--ss-cfg", type=float, default=7.5)
    ap.add_argument("--set-category", default="", help="順手把 data.json 這個分類的 model 指到輸出檔")
    ap.add_argument("--data-json", default="data.json")
    ap.add_argument("--timeout", type=int, default=600, help="輪詢逾時秒數")
    args = ap.parse_args()

    key = os.environ.get("NVIDIA_API_KEY", "").strip()
    if not key:
        sys.exit("錯誤:沒有讀到環境變數 NVIDIA_API_KEY。請先設定金鑰(見檔案上方說明)。")
    if not os.path.isfile(args.image):
        sys.exit("錯誤:找不到照片:%s" % args.image)

    try:
        import requests
    except ImportError:
        sys.exit("錯誤:缺少 requests。請先 `pip install requests pillow`。")

    print("讀取並編碼影像:%s" % args.image)
    image_uri = load_image_data_uri(args.image, args.max)

    headers = {
        "Authorization": "Bearer %s" % key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "image": image_uri,
        "slat_cfg_scale": args.slat_cfg,
        "ss_cfg_scale": args.ss_cfg,
        "slat_sampling_steps": args.steps,
        "ss_sampling_steps": args.steps,
        "seed": args.seed,
    }

    print("呼叫 TRELLIS…(第一次可能要等 1–3 分鐘)")
    sess = requests.Session()
    r = sess.post(INVOKE_URL, headers=headers, json=payload)

    # 202 → 輪詢直到完成
    deadline = time.time() + args.timeout
    while r.status_code == 202:
        req_id = r.headers.get("NVCF-REQID")
        if not req_id:
            break
        if time.time() > deadline:
            sys.exit("逾時:%d 秒內未完成。" % args.timeout)
        time.sleep(3)
        r = sess.get(STATUS_URL + req_id, headers={"Authorization": "Bearer %s" % key, "Accept": "application/json"})

    if r.status_code != 200:
        body = r.text[:800]
        sys.exit("API 失敗(HTTP %s):%s" % (r.status_code, body))

    # 解析回傳,取出模型 bytes
    ctype = r.headers.get("Content-Type", "")
    model_bytes, kind = (None, None)
    if "application/json" in ctype:
        try:
            model_bytes, kind = find_model_bytes(r.json())
        except ValueError:
            pass
    if model_bytes is None:
        data = r.content
        if data[:4] == GLTF_MAGIC:
            model_bytes, kind = data, "glb"
        elif data[:4] == ZIP_MAGIC:
            model_bytes, kind = data, "zip"

    if model_bytes is None:
        # 印出線索方便回報
        preview = ""
        try:
            preview = json.dumps(r.json(), ensure_ascii=False)[:800]
        except Exception:
            preview = r.text[:400]
        sys.exit("完成了,但在回傳裡找不到 .glb/zip。請把下面內容貼給我調整解析:\n" + preview)

    if kind == "zip":
        model_bytes, inner = glb_from_zip(model_bytes)
        print("  從 zip 取出:%s" % inner)

    out = args.out
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "wb") as f:
        f.write(model_bytes)
    print("完成 ✓ 已寫入:%s(%.2f MB)" % (out, len(model_bytes) / 1e6))

    # 順手接上 data.json 的分類
    if args.set_category:
        try:
            with open(args.data_json, encoding="utf-8") as f:
                dj = json.load(f)
            hit = False
            for c in dj.get("categories", []):
                if isinstance(c, dict) and c.get("name") == args.set_category:
                    c["model"] = out.replace("\\", "/")
                    hit = True
            if hit:
                with open(args.data_json, "w", encoding="utf-8") as f:
                    json.dump(dj, f, ensure_ascii=False, indent=2); f.write("\n")
                print("已把 data.json 分類「%s」的 model 設為 %s" % (args.set_category, out))
            else:
                print("提醒:data.json 找不到分類「%s」,請自己在該分類填 \"model\": \"%s\"" % (args.set_category, out))
        except Exception as e:
            print("提醒:更新 data.json 失敗(%s)。請自己在該分類填 model 路徑。" % e)

    print("\n下一步:commit + push,大廳該分類卡就會用 <model-viewer> 顯示可旋轉的 3D 模型。")


if __name__ == "__main__":
    main()
