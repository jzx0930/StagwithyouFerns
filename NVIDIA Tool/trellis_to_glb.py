#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
trellis_to_glb.py — 用 NVIDIA build 的 Microsoft TRELLIS(圖片轉 3D)把照片變成 .glb。
可當命令列工具,也被 trellis_gui.py(圖形介面)呼叫。核心函式:run(...)。
金鑰從環境變數 NVIDIA_API_KEY 讀,或由呼叫端傳入;不會硬寫在檔案裡。
"""
import os, sys, io, json, time, base64, zipfile, argparse

INVOKE_URL = "https://ai.api.nvidia.com/v1/genai/microsoft/trellis"
STATUS_URL = "https://ai.api.nvidia.com/v2/nvcf/pexec/status/"
GLTF_MAGIC = b"glTF"
ZIP_MAGIC  = b"PK\x03\x04"


def load_image_data_uri(path, max_side, log=print):
    with open(path, "rb") as f:
        raw = f.read()
    mime = "image/png"
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = im.size
        scale = min(1.0, float(max_side) / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
        buf = io.BytesIO(); im.save(buf, format="PNG"); raw = buf.getvalue()
    except Exception as e:
        ext = os.path.splitext(path)[1].lower()
        if ext in (".jpg", ".jpeg"):
            mime = "image/jpeg"
        log("  (未縮圖:%s;直接送原圖)" % e)
    b64 = base64.b64encode(raw).decode("ascii")
    log("  影像 base64:約 %.2f MB" % (len(b64) / 1e6))
    return "data:%s;base64,%s" % (mime, b64)


def find_model_bytes(obj):
    stack = [obj]; best = None
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)
        elif isinstance(cur, str) and len(cur) >= 8:
            s = cur.split(",", 1)[-1]
            try:
                data = base64.b64decode(s, validate=False)
            except Exception:
                continue
            if data[:4] == GLTF_MAGIC:
                return data, "glb"
            if data[:4] == ZIP_MAGIC and best is None:
                best = (data, "zip")
    return best if best else (None, None)


def glb_from_zip(data):
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = [n for n in zf.namelist() if n.lower().endswith(".glb")] or \
            [n for n in zf.namelist() if n.lower().endswith((".gltf", ".obj"))]
    if not names:
        raise RuntimeError("回傳的 zip 裡找不到 .glb(內含:%s)" % zf.namelist())
    return zf.read(names[0]), names[0]


def run(image, out, key, max_side=1024, seed=0, slat_steps=25, ss_steps=25,
        slat_cfg=3.0, ss_cfg=7.5, timeout=600, log=print):
    """呼叫 TRELLIS 產生 .glb 並寫入 out。成功回傳 out 路徑;失敗丟例外。"""
    key = (key or "").strip()
    if not key:
        raise RuntimeError("沒有 API Key。請設定環境變數 NVIDIA_API_KEY,或在介面填入。")
    if not os.path.isfile(image):
        raise RuntimeError("找不到照片:%s" % image)
    try:
        import requests
    except ImportError:
        raise RuntimeError("缺少 requests,請先 `pip install requests pillow`。")

    log("讀取並編碼影像:%s" % image)
    image_uri = load_image_data_uri(image, max_side, log)

    headers = {"Authorization": "Bearer %s" % key, "Accept": "application/json",
               "Content-Type": "application/json"}
    payload = {"image": image_uri, "slat_cfg_scale": slat_cfg, "ss_cfg_scale": ss_cfg,
               "slat_sampling_steps": int(slat_steps), "ss_sampling_steps": int(ss_steps),
               "seed": int(seed)}

    log("呼叫 TRELLIS…(第一次可能要等 1–3 分鐘)")
    sess = requests.Session()
    r = sess.post(INVOKE_URL, headers=headers, json=payload)

    deadline = time.time() + timeout
    while r.status_code == 202:
        req_id = r.headers.get("NVCF-REQID")
        if not req_id:
            break
        if time.time() > deadline:
            raise RuntimeError("逾時:%d 秒內未完成。" % timeout)
        log("  處理中…")
        time.sleep(3)
        r = sess.get(STATUS_URL + req_id, headers={"Authorization": "Bearer %s" % key,
                                                   "Accept": "application/json"})
    if r.status_code != 200:
        raise RuntimeError("API 失敗(HTTP %s):%s" % (r.status_code, r.text[:600]))

    model_bytes, kind = (None, None)
    if "application/json" in r.headers.get("Content-Type", ""):
        try:
            model_bytes, kind = find_model_bytes(r.json())
        except ValueError:
            pass
    if model_bytes is None:
        data = r.content
        if data[:4] == GLTF_MAGIC: model_bytes, kind = data, "glb"
        elif data[:4] == ZIP_MAGIC: model_bytes, kind = data, "zip"
    if model_bytes is None:
        try:
            preview = json.dumps(r.json(), ensure_ascii=False)[:800]
        except Exception:
            preview = r.text[:400]
        raise RuntimeError("完成了,但回傳裡找不到 .glb/zip。請把這段貼給開發者調整解析:\n" + preview)

    if kind == "zip":
        model_bytes, inner = glb_from_zip(model_bytes); log("  從 zip 取出:%s" % inner)

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "wb") as f:
        f.write(model_bytes)
    log("完成 ✓ 已寫入 %s(%.2f MB)" % (out, len(model_bytes) / 1e6))
    return out


def set_category_model(data_json, category, out, log=print):
    with open(data_json, encoding="utf-8") as f:
        dj = json.load(f)
    hit = False
    for c in dj.get("categories", []):
        if isinstance(c, dict) and c.get("name") == category:
            c["model"] = out.replace("\\", "/"); hit = True
    if hit:
        with open(data_json, "w", encoding="utf-8") as f:
            json.dump(dj, f, ensure_ascii=False, indent=2); f.write("\n")
        log("已把 data.json 分類「%s」的 model 設為 %s" % (category, out))
    else:
        log("提醒:data.json 找不到分類「%s」,請自行填 \"model\":\"%s\"" % (category, out))


def main():
    ap = argparse.ArgumentParser(description="TRELLIS 圖片轉 3D → .glb")
    ap.add_argument("image")
    ap.add_argument("-o", "--out", default="models/staghorn.glb")
    ap.add_argument("--max", type=int, default=1024)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--steps", type=int, default=25)
    ap.add_argument("--slat-cfg", type=float, default=3.0)
    ap.add_argument("--ss-cfg", type=float, default=7.5)
    ap.add_argument("--set-category", default="")
    ap.add_argument("--data-json", default="data.json")
    a = ap.parse_args()
    try:
        run(a.image, a.out, os.environ.get("NVIDIA_API_KEY", ""), a.max, a.seed,
            a.steps, a.steps, a.slat_cfg, a.ss_cfg)
        if a.set_category:
            set_category_model(a.data_json, a.set_category, a.out)
    except Exception as e:
        sys.exit("錯誤:%s" % e)
    print("\n下一步:commit + push,大廳該分類卡就會用 <model-viewer> 顯示 3D 模型。")


if __name__ == "__main__":
    main()
