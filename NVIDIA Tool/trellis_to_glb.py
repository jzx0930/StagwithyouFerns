#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
trellis_to_glb.py — 用 NVIDIA build 的 Microsoft TRELLIS(圖片轉 3D)把照片變成 .glb。
可當命令列工具,也被 trellis_gui.py(圖形介面)呼叫。核心函式:run(...)。
金鑰從環境變數 NVIDIA_API_KEY 讀,或由呼叫端傳入;不會硬寫在檔案裡。

重要:TRELLIS 的 image 欄位「不吃 base64」。要先把圖片上傳成 NVCF asset,
拿到 assetId,再用 image = "data:image/png;asset_id,<assetId>" 參照。
(否則會回 HTTP 422:Expected: example_id, got: base64)
"""
import os, sys, io, json, time, base64, zipfile, argparse

INVOKE_URL = "https://ai.api.nvidia.com/v1/genai/microsoft/trellis"
STATUS_URL = "https://ai.api.nvidia.com/v2/nvcf/pexec/status/"
ASSETS_URL = "https://api.nvcf.nvidia.com/v2/nvcf/assets"
ASSET_DESC = "trellis-input-image"
GLTF_MAGIC = b"glTF"
ZIP_MAGIC  = b"PK\x03\x04"


def _pip_install_rembg_cpu(log=print):
    import subprocess, sys as _sys, importlib
    log("安裝 rembg[cpu](含 CPU 後端,可能需幾分鐘)…")
    subprocess.check_call([_sys.executable, "-m", "pip", "install", "rembg[cpu]"])
    importlib.invalidate_caches()


def ensure_rembg(log=print):
    """確保 rembg + onnxruntime 後端可用;不足就安裝 rembg[cpu]。"""
    ok = False
    try:
        import onnxruntime  # noqa: F401
        import rembg  # noqa: F401
        ok = bool(onnxruntime.get_available_providers())
    except Exception:
        ok = False
    if not ok:
        _pip_install_rembg_cpu(log)


def remove_background(img_bytes, log=print):
    log("  去背中(rembg)…第一次會下載模型,請稍候")
    try:
        from rembg import remove
        return remove(img_bytes)
    except Exception as e:
        # 常見:No onnxruntime backend found → 補裝 rembg[cpu] 再試一次
        log("  rembg 後端問題(%s),自動補裝 rembg[cpu] 後重試…" % e)
        _pip_install_rembg_cpu(log)
        import importlib, sys as _sys
        for m in list(_sys.modules):
            if m == "rembg" or m.startswith("rembg."):
                _sys.modules.pop(m, None)
        importlib.invalidate_caches()
        from rembg import remove
        return remove(img_bytes)


def load_image_bytes(path, max_side, remove_bg=False, log=print):
    """讀圖;可選去背;(有 Pillow 就)縮圖並轉 PNG,回傳 (bytes, mime)。"""
    with open(path, "rb") as f:
        raw = f.read()
    mime = "image/png"
    if remove_bg:
        raw = remove_background(raw, log)  # 去背後為透明背景的 RGBA PNG
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGBA") if remove_bg else im.convert("RGB")
        w, h = im.size
        scale = min(1.0, float(max_side) / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
        buf = io.BytesIO(); im.save(buf, format="PNG"); raw = buf.getvalue()
        mime = "image/png"
    except Exception as e:
        ext = os.path.splitext(path)[1].lower()
        if ext in (".jpg", ".jpeg") and not remove_bg:
            mime = "image/jpeg"
        log("  (未縮圖:%s;直接上傳)" % e)
    log("  影像大小:約 %.2f MB" % (len(raw) / 1e6))
    return raw, mime


def upload_asset(sess, key, img_bytes, mime, log=print):
    """把圖片上傳成 NVCF asset,回傳 assetId。"""
    log("上傳圖片為 asset…")
    r = sess.post(ASSETS_URL, headers={
        "Authorization": "Bearer %s" % key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }, json={"contentType": mime, "description": ASSET_DESC})
    if r.status_code not in (200, 201):
        raise RuntimeError("建立 asset 失敗(HTTP %s):%s" % (r.status_code, r.text[:400]))
    j = r.json()
    asset_id = j.get("assetId") or j.get("asset_id")
    upload_url = j.get("uploadUrl") or j.get("upload_url")
    if not asset_id or not upload_url:
        raise RuntimeError("建立 asset 回傳缺少 assetId/uploadUrl:%s" % json.dumps(j)[:400])
    put = sess.put(upload_url, data=img_bytes, headers={
        "Content-Type": mime,
        "x-amz-meta-nvcf-asset-description": ASSET_DESC,
    })
    if put.status_code not in (200, 201, 204):
        raise RuntimeError("上傳 asset 內容失敗(HTTP %s):%s" % (put.status_code, put.text[:400]))
    log("  assetId = %s" % asset_id)
    return asset_id, mime


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
        slat_cfg=3.0, ss_cfg=7.5, remove_bg=False, timeout=600, log=print):
    key = (key or "").strip()
    if not key:
        raise RuntimeError("沒有 API Key。請設定環境變數 NVIDIA_API_KEY,或在介面填入。")
    if not os.path.isfile(image):
        raise RuntimeError("找不到照片:%s" % image)
    try:
        import requests
    except ImportError:
        raise RuntimeError("缺少 requests,請先 `pip install requests pillow`。")

    sess = requests.Session()
    log("讀取影像:%s" % image)
    if remove_bg:
        try:
            ensure_rembg(log)
            img_bytes, mime = load_image_bytes(image, max_side, True, log)
        except Exception as e:
            log("  去背失敗(onnxruntime 後端無法載入,常見於缺少 VC++ 執行庫):%s" % e)
            log("  → 跳過去背,改用原圖繼續(TRELLIS 伺服器端本來就會自動去背)。")
            img_bytes, mime = load_image_bytes(image, max_side, False, log)
    else:
        img_bytes, mime = load_image_bytes(image, max_side, False, log)

    asset_id, mime = upload_asset(sess, key, img_bytes, mime, log)

    # API 要求 cfg 必須 > 1
    if slat_cfg <= 1: slat_cfg = 1.5
    if ss_cfg <= 1: ss_cfg = 1.5
    headers = {
        "Authorization": "Bearer %s" % key,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "NVCF-INPUT-ASSET-REFERENCES": asset_id,
    }
    payload = {
        "image": "data:%s;example_id,%s" % (mime, asset_id),
        "slat_cfg_scale": slat_cfg, "ss_cfg_scale": ss_cfg,
        "slat_sampling_steps": int(slat_steps), "ss_sampling_steps": int(ss_steps),
        "seed": int(seed),
    }

    def invoke_once():
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
        return r

    log("呼叫 TRELLIS…(第一次可能要等 1–3 分鐘)")
    r = None
    for attempt in range(3):
        r = invoke_once()
        if r.status_code in (500, 502, 503, 504) and attempt < 2:
            log("  伺服器忙碌/錯誤(HTTP %s),4 秒後重試…(%d/2)" % (r.status_code, attempt + 1))
            time.sleep(4)
            continue
        break
    if r.status_code != 200:
        hint = ""
        if r.status_code >= 500:
            hint = "(這是伺服器端錯誤。多半是暫時性,或輸入圖太複雜——請把圖裁成只有單株鹿角蕨、背景單純後再試。)"
        raise RuntimeError("API 失敗(HTTP %s)%s:%s" % (r.status_code, hint, r.text[:500]))

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
    ap.add_argument("--remove-bg", action="store_true", help="上傳前自動去背(rembg)")
    a = ap.parse_args()
    try:
        run(a.image, a.out, os.environ.get("NVIDIA_API_KEY", ""), a.max, a.seed,
            a.steps, a.steps, a.slat_cfg, a.ss_cfg, a.remove_bg)
        if a.set_category:
            set_category_model(a.data_json, a.set_category, a.out)
    except Exception as e:
        sys.exit("錯誤:%s" % e)
    print("\n下一步:commit + push,大廳該分類卡就會用 <model-viewer> 顯示 3D 模型。")


if __name__ == "__main__":
    main()
