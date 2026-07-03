#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
trellis_gui.py — 圖形介面:選照片、用拖曳桿調 TRELLIS 參數、產生 .glb。
需要:requests(呼叫 API)、pillow(縮圖與預覽,可選)。Tkinter 為 Python 內建。
直接雙擊 trellis-3d.bat 會自動檢查/安裝套件後開這個介面。
"""
import os, threading, queue
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import trellis_to_glb as core

APP_DIR = os.path.dirname(os.path.abspath(__file__))

def _find_repo_root(start):
    d = start
    for _ in range(5):
        if os.path.isfile(os.path.join(d, "data.json")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return os.path.dirname(start)

REPO_DIR = _find_repo_root(APP_DIR)


class App:
    def __init__(self, root):
        self.root = root
        root.title("鹿角蕨 · 圖片轉 3D(TRELLIS)")
        root.geometry("760x680")
        self.q = queue.Queue()
        self.img_path = tk.StringVar()
        self.out_path = tk.StringVar(value=os.path.join("models", "staghorn.glb"))
        self.category = tk.StringVar(value="鹿角蕨")
        self.api_key = tk.StringVar(value=os.environ.get("NVIDIA_API_KEY", ""))
        self.rm_bg = tk.BooleanVar(value=True)
        self._preview_img = None
        self._build()
        self.root.after(120, self._drain)

    def _build(self):
        pad = dict(padx=10, pady=6)
        top = ttk.Frame(self.root); top.pack(fill="x", **pad)

        # 選照片 + 預覽
        row = ttk.Frame(top); row.pack(fill="x")
        ttk.Button(row, text="選擇照片…", command=self.pick).pack(side="left")
        ttk.Entry(row, textvariable=self.img_path).pack(side="left", fill="x", expand=True, padx=8)
        self.preview = ttk.Label(top, text="(照片預覽)", anchor="center")
        self.preview.pack(fill="x", pady=(6, 2))

        ttk.Label(top, text="要調整的是下面 5 個生成參數;「照片」本身不是參數。",
                  foreground="#557").pack(anchor="w")

        # 拖曳桿參數
        box = ttk.LabelFrame(self.root, text="生成參數(拖曳桿)")
        box.pack(fill="x", **pad)
        self.s_slat_cfg = self._slider(box, "slat_cfg_scale(結構引導 >1)", 1.5, 10.0, 3.0, 0.5)
        self.s_ss_cfg   = self._slider(box, "ss_cfg_scale(外觀引導 >1)", 1.5, 15.0, 7.5, 0.5)
        self.s_slat_st  = self._slider(box, "slat_sampling_steps(結構步數)", 10, 50, 25, 1)
        self.s_ss_st    = self._slider(box, "ss_sampling_steps(外觀步數)", 10, 50, 25, 1)
        self.s_seed     = self._slider(box, "seed(隨機種子)", 0, 100000, 0, 1)
        self.s_max      = self._slider(box, "縮圖最長邊 px(越大越慢)", 512, 2048, 1024, 64)
        bgrow = ttk.Frame(box); bgrow.pack(fill="x", padx=8, pady=(2, 8))
        ttk.Checkbutton(bgrow, variable=self.rm_bg,
                        text="上傳前自動去背(rembg,建議;首次會自動安裝並下載模型)").pack(side="left")

        # 輸出 / 分類 / 金鑰
        opt = ttk.Frame(self.root); opt.pack(fill="x", **pad)
        self._labeled(opt, "輸出 .glb", self.out_path)
        self._labeled(opt, "接到分類(data.json)", self.category)
        krow = ttk.Frame(opt); krow.pack(fill="x", pady=3)
        ttk.Label(krow, text="NVIDIA API Key", width=20).pack(side="left")
        ttk.Entry(krow, textvariable=self.api_key, show="•").pack(side="left", fill="x", expand=True)
        ttk.Label(opt, text="金鑰只留在本機、不會上傳;留空則讀環境變數 NVIDIA_API_KEY。",
                  foreground="#557").pack(anchor="w")

        # 動作 + 記錄
        act = ttk.Frame(self.root); act.pack(fill="x", **pad)
        self.btn = ttk.Button(act, text="產生 3D 模型", command=self.start)
        self.btn.pack(side="left")
        self.status = ttk.Label(act, text="就緒")
        self.status.pack(side="left", padx=12)

        self.log = tk.Text(self.root, height=12, wrap="word")
        self.log.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self._log("提示:TRELLIS 是單一物件轉 3D。照片請先裁成只有那株鹿角蕨、背景單純,品質最好。")

    def _slider(self, parent, label, lo, hi, init, res):
        f = ttk.Frame(parent); f.pack(fill="x", padx=8, pady=4)
        ttk.Label(f, text=label, width=26).pack(side="left")
        var = tk.DoubleVar(value=init)
        val = ttk.Label(f, width=8, text=self._fmt(init, res))
        val.pack(side="right")
        def on_move(v):
            var.set(round(float(v) / res) * res)
            val.config(text=self._fmt(var.get(), res))
        ttk.Scale(f, from_=lo, to=hi, orient="horizontal", command=on_move).pack(
            side="left", fill="x", expand=True, padx=8)
        return var

    @staticmethod
    def _fmt(v, res):
        return str(int(round(v))) if res >= 1 else ("%.1f" % v)

    def _labeled(self, parent, label, var):
        f = ttk.Frame(parent); f.pack(fill="x", pady=3)
        ttk.Label(f, text=label, width=20).pack(side="left")
        ttk.Entry(f, textvariable=var).pack(side="left", fill="x", expand=True)

    def pick(self):
        p = filedialog.askopenfilename(
            title="選擇照片",
            filetypes=[("圖片", "*.jpg *.jpeg *.png *.webp *.bmp"), ("所有檔案", "*.*")])
        if not p:
            return
        self.img_path.set(p)
        try:
            from PIL import Image, ImageTk
            im = Image.open(p); im.thumbnail((360, 240))
            self._preview_img = ImageTk.PhotoImage(im)
            self.preview.config(image=self._preview_img, text="")
        except Exception:
            self.preview.config(text=os.path.basename(p), image="")

    def _log(self, msg):
        self.log.insert("end", str(msg) + "\n"); self.log.see("end")

    def _drain(self):
        try:
            while True:
                kind, payload = self.q.get_nowait()
                if kind == "log":
                    self._log(payload)
                elif kind == "status":
                    self.status.config(text=payload)
                elif kind == "done":
                    self.btn.config(state="normal")
                    if payload:
                        messagebox.showinfo("完成", "已產生:%s\n記得 commit + push。" % payload)
                elif kind == "error":
                    self.btn.config(state="normal")
                    messagebox.showerror("失敗", payload)
        except queue.Empty:
            pass
        self.root.after(120, self._drain)

    def start(self):
        if not self.img_path.get():
            messagebox.showwarning("缺少照片", "請先選擇一張照片。"); return
        key = self.api_key.get().strip() or os.environ.get("NVIDIA_API_KEY", "")
        if not key:
            messagebox.showwarning("缺少金鑰", "請填入 NVIDIA API Key(或設定環境變數)。"); return
        self.btn.config(state="disabled"); self.status.config(text="產生中…")
        args = dict(
            image=self.img_path.get(),
            out=os.path.join(REPO_DIR, self.out_path.get()),
            key=key,
            max_side=int(self.s_max.get()),
            seed=int(self.s_seed.get()),
            slat_steps=int(self.s_slat_st.get()),
            ss_steps=int(self.s_ss_st.get()),
            slat_cfg=float(self.s_slat_cfg.get()),
            ss_cfg=float(self.s_ss_cfg.get()),
            remove_bg=bool(self.rm_bg.get()),
        )
        threading.Thread(target=self._work, args=(args,), daemon=True).start()

    def _work(self, args):
        log = lambda m: self.q.put(("log", m))
        try:
            out = core.run(log=log, **args)
            cat = self.category.get().strip()
            if cat:
                try:
                    core.set_category_model(os.path.join(REPO_DIR, "data.json"), cat,
                                            self.out_path.get(), log)
                except Exception as e:
                    log("更新 data.json 失敗:%s" % e)
            self.q.put(("status", "完成 ✓")); self.q.put(("done", out))
        except Exception as e:
            self.q.put(("status", "失敗")); self.q.put(("log", "錯誤:%s" % e))
            self.q.put(("error", str(e)))


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
