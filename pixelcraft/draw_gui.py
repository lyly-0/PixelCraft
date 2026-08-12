#!/usr/bin/env python3
"""PixelCraft 自动绘画脚本（GUI版）
双击运行，图形界面操作
用法：python draw_gui.py
打包：python build.py
输出：PixelCraft.exe"""

import json
import time
import sys
import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

# ========== 可调参数 ==========
DOUBLE_CLICK_INTERVAL = 0.05
CLICK_AFTER_DELAY = 0.03

COLOR_NAMES = {
    '#000000': '黑色', '#ffffff': '白色', '#ff0000': '红色',
    '#00ff00': '绿色', '#0000ff': '蓝色', '#ffff00': '黄色',
    '#ff00ff': '品红/洋红', '#00ffff': '青色', '#808080': '灰色',
    '#800000': '栗色/深红', '#808000': '橄榄色', '#008000': '深绿色',
    '#800080': '紫色', '#008080': '蓝绿色', '#000080': '海军蓝',
    '#c0c0c0': '银色', '#ffa500': '橙色', '#a52a2a': '棕色',
    '#ffc0cb': '粉色', '#ffd700': '金色', '#4b0082': '靛蓝色',
    '#7fffd4': '碧绿色', '#ff6347': '番茄红', '#40e0d0': '绿松色',
    '#ee82ee': '紫罗兰', '#dda0dd': '梅红色', '#fa8072': '鲑鱼色',
    '#87ceeb': '天蓝', '#ffb6c1': '浅粉', '#d2b48c': '棕褐色',
    '#f0e68c': '卡其色', '#98fb98': '淡绿色',
}


def get_color_name(hex_color):
    h = hex_color.upper()
    if h in COLOR_NAMES:
        return COLOR_NAMES[h]
    r1, g1, b1 = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    best, best_dist = '自定义颜色', float('inf')
    for kh, name in COLOR_NAMES.items():
        r2, g2, b2 = int(kh[1:3], 16), int(kh[3:5], 16), int(kh[5:7], 16)
        d = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
        if d < best_dist:
            best_dist, best = d, name
    return best


def merge_colors(data):
    cm = {}
    for g in data['colorGroups']:
        c = g['color']
        cn = g.get('colorName', get_color_name(c))
        ps = g['positions']
        if not ps:
            continue
        if isinstance(ps[0], list):
            pl = [tuple(p) for p in ps]
        elif isinstance(ps[0], (int, float)):
            pl = [(int(ps[i]), int(ps[i + 1])) for i in range(0, len(ps), 2) if i + 1 < len(ps)]
        else:
            continue
        if c not in cm:
            cm[c] = {'color': c, 'colorName': cn, 'positions': []}
        cm[c]['positions'].extend(pl)
    r = []
    for c, info in cm.items():
        info['count'] = len(info['positions'])
        r.append(info)
    r.sort(key=lambda x: x['count'], reverse=True)
    return r


def draw_pixel(x, y):
    pyautogui.moveTo(x, y)
    time.sleep(0.003)
    pyautogui.click(x, y)
    time.sleep(DOUBLE_CLICK_INTERVAL)
    pyautogui.click(x, y)
    time.sleep(CLICK_AFTER_DELAY)


class PixelCraftGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("PixelCraft 自动绘画")
        self.root.geometry("520x480")
        self.root.resizable(True, True)
        self.data = None
        self.color_groups = None
        self.ox = self.oy = self.ex = self.ey = None
        self.step_x = self.step_y = 0
        self.is_drawing = False
        self.current_color_idx = 0
        self._setup_ui()

    def _setup_ui(self):
        f = tk.Frame(self.root, padx=15, pady=10)
        f.pack(fill=tk.BOTH, expand=True)

        tk.Label(f, text="PixelCraft 自动绘画助手", font=("", 14, "bold")).pack(pady=5)

        tk.Label(f, text="1. 选择从网页下载的 action.json 文件", anchor="w").pack(fill=tk.X)
        bf = tk.Frame(f)
        bf.pack(fill=tk.X, pady=5)
        self.path_var = tk.StringVar(value="未选择文件...")
        tk.Entry(bf, textvariable=self.path_var, state="readonly").pack(
            side=tk.LEFT, fill=tk.X, expand=True)
        tk.Button(bf, text="浏览...", command=self._load_json).pack(
            side=tk.RIGHT, padx=(5, 0))

        tk.Label(f, text="2. 标定画布位置", anchor="w").pack(fill=tk.X, pady=(10, 0))
        cf = tk.Frame(f)
        cf.pack(fill=tk.X, pady=3)
        tk.Button(cf, text="左上角", command=self._calibrate_tl).pack(side=tk.LEFT, padx=2)
        tk.Button(cf, text="右下角", command=self._calibrate_br).pack(side=tk.LEFT, padx=2)
        self.calib_var = tk.StringVar(value="未标定")
        tk.Label(cf, textvariable=self.calib_var, fg="gray").pack(side=tk.LEFT, padx=10)

        tk.Label(f, text="3. 开始自动绘制", anchor="w").pack(fill=tk.X, pady=(10, 0))
        self.info_var = tk.StringVar(value="")
        tk.Label(f, textvariable=self.info_var, fg="blue").pack(anchor="w")
        self.progress = ttk.Progressbar(f, mode="determinate", length=450)
        self.progress.pack(fill=tk.X, pady=5)
        self.status_var = tk.StringVar(value="等待开始...")
        tk.Label(f, textvariable=self.status_var, fg="gray").pack(anchor="w")
        self.color_label = tk.Label(f, text="", font=("", 11))
        self.color_label.pack(pady=5)

        bbf = tk.Frame(f)
        bbf.pack(pady=10)
        self.start_btn = tk.Button(bbf, text="▶ 开始绘制", bg="#4CAF50", fg="white",
                                   font=("", 12, "bold"), width=15, state=tk.DISABLED,
                                   command=self._start_drawing)
        self.start_btn.pack(side=tk.LEFT, padx=5)
        tk.Button(bbf, text="⏹ 紧急停止", bg="#f44336", fg="white",
                  font=("", 10), width=12, command=self._emergency_stop).pack(
            side=tk.LEFT, padx=5)

    def _load_json(self):
        fp = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])
        if not fp:
            return
        try:
            with open(fp, "r", encoding="utf-8") as f:
                self.data = json.load(f)
            self.color_groups = merge_colors(self.data)
            self.path_var.set(os.path.basename(fp))
            w, h = self.data["image"]["width"], self.data["image"]["height"]
            nc = len(self.color_groups)
            tp = self.data["totalPixels"]
            self.info_var.set(f'画布: {w}×{h} | 颜色: {nc} 种 | 总像素: {tp}')
            if self.ox is not None and self.ey is not None:
                self.start_btn.config(state=tk.NORMAL)
            messagebox.showinfo("加载成功", f"已加载 {nc} 种颜色\n画布 {w}×{h} 像素")
        except Exception as ex:
            messagebox.showerror("错误", f"加载失败：{ex}")

    def _calibrate_tl(self):
        self.root.iconify()
        time.sleep(0.5)
        messagebox.showinfo("标定", "移动鼠标到画布左上角第一个像素中心\n然后回到此处按确定")
        self.ox, self.oy = pyautogui.position()
        self.root.deiconify()
        self.calib_var.set(f"左上({self.ox},{self.oy})")
        self._check_ready()

    def _calibrate_br(self):
        self.root.iconify()
        time.sleep(0.5)
        messagebox.showinfo("标定", "移动鼠标到画布右下角最后一个像素中心\n然后回到此处按确定")
        self.ex, self.ey = pyautogui.position()
        self.root.deiconify()
        self.calib_var.set(f"右下({self.ex},{self.ey})")
        self._check_ready()

    def _check_ready(self):
        if self.ox is not None and self.ey is not None and self.data:
            w, h = self.data["image"]["width"], self.data["image"]["height"]
            self.step_x = (self.ex - self.ox) / max(w - 1, 1)
            self.step_y = (self.ey - self.oy) / max(h - 1, 1)
            self.calib_var.set(f"步长 X:{self.step_x:.1f} Y:{self.step_y:.1f}")
            self.start_btn.config(state=tk.NORMAL)

    def _start_drawing(self):
        if self.is_drawing:
            return
        self.is_drawing = True
        self.current_color_idx = 0
        self.root.iconify()
        time.sleep(0.3)
        # 激活窗口
        cx, cy = (self.ox + self.ex) // 2, (self.oy + self.ey) // 2
        pyautogui.click(cx - 100, cy)
        time.sleep(0.2)
        pyautogui.click(cx, cy)
        time.sleep(0.3)
        self._draw_next_color()

    def _draw_next_color(self):
        if not self.is_drawing or self.current_color_idx >= len(self.color_groups):
            self._finish()
            return
        g = self.color_groups[self.current_color_idx]
        color, name, positions, count = g["color"], g["colorName"], g["positions"], g["count"]
        self.root.deiconify()
        self.progress["value"] = 0
        self.progress["maximum"] = count
        self.color_label.config(text=f"🎨 {color}（{name}）- {count} 个像素", fg=color)
        self.status_var.set(f'请将画笔切换为 {color}（{name}），然后按确定')

        if messagebox.askokcancel("切换颜色",
                                  f"请将画笔颜色切换为：\n{color}（{name}）\n\n"
                                  f"共 {count} 个像素\n\n按「确定」开始绘制"):
            self.root.iconify()
            time.sleep(0.3)
            threading.Thread(target=self._draw_color, args=(g,), daemon=True).start()
        else:
            self.is_drawing = False
            self.root.deiconify()

    def _draw_color(self, g):
        positions, count = g["positions"], g["count"]
        for i, (px, py) in enumerate(positions):
            if not self.is_drawing:
                return
            sx = self.ox + px * self.step_x
            sy = self.oy + py * self.step_y
            draw_pixel(sx, sy)
            if (i + 1) % 50 == 0 or i == count - 1:
                self.root.after(0, lambda v=i + 1, c=count: self._update_progress(v, c))
        self.root.after(0, self._color_done)

    def _update_progress(self, val, total):
        self.progress["value"] = val
        self.status_var.set(f'进度：{val}/{total} ({100 * val / total:.0f}%)')

    def _color_done(self):
        self.current_color_idx += 1
        self._draw_next_color()

    def _finish(self):
        self.is_drawing = False
        self.root.deiconify()
        self.progress["value"] = self.progress["maximum"]
        self.status_var.set('🎉 全部绘制完成！')
        self.color_label.config(text="")
        messagebox.showinfo("完成", "🎉 全部绘制完成！\n感谢使用 PixelCraft")

    def _emergency_stop(self):
        self.is_drawing = False
        self.status_var.set('⚠️ 已停止')
        self.root.deiconify()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    PixelCraftGUI().run()
