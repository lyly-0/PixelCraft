document.addEventListener('DOMContentLoaded', () => {
    // ==================== 标签切换 ====================
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // ==================== 缩放器模块 ====================
    const uploadSection = document.getElementById('uploadSection');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const workspace = document.getElementById('workspace');
    const originalCanvas = document.getElementById('originalCanvas');
    const resultCanvas = document.getElementById('resultCanvas');
    const origCtx = originalCanvas.getContext('2d');
    const resultCtx = resultCanvas.getContext('2d');
    const originalInfo = document.getElementById('originalInfo');
    const resultInfo = document.getElementById('resultInfo');
    const targetWidth = document.getElementById('targetWidth');
    const targetHeight = document.getElementById('targetHeight');
    const processBtn = document.getElementById('processBtn');
    const exportScale = document.getElementById('exportScale');
    const downloadBtn = document.getElementById('downloadBtn');

    let originalImage = null;
    let pixelArtData = null;
    let currentDisplayScale = 1;

    // 上传
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) loadImage(file);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadImage(e.target.files[0]);
    });

    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                onImageLoaded(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function onImageLoaded(img) {
        uploadSection.style.display = 'none';
        workspace.style.display = 'block';
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        origCtx.drawImage(img, 0, 0);
        originalInfo.textContent = `${img.width} × ${img.height} px`;

        const maxPixel = 64;
        let w, h;
        if (img.width >= img.height) {
            w = maxPixel;
            h = Math.max(1, Math.round(img.height * maxPixel / img.width));
        } else {
            h = maxPixel;
            w = Math.max(1, Math.round(img.width * maxPixel / img.height));
        }
        targetWidth.value = w;
        targetHeight.value = h;

        pixelArtData = null;
        downloadBtn.disabled = true;
        generatePixelArt();

        // 通知绘画助手
        updatePainterImage(img);
    }

    processBtn.addEventListener('click', generatePixelArt);

    function generatePixelArt() {
        if (!originalImage) return;
        const tw = parseInt(targetWidth.value);
        const th = parseInt(targetHeight.value);
        if (isNaN(tw) || isNaN(th) || tw < 1 || th < 1 || tw > 2048 || th > 2048) return;

        const srcData = origCtx.getImageData(0, 0, originalImage.width, originalImage.height);
        pixelArtData = nearestNeighborScale(srcData, originalImage.width, originalImage.height, tw, th);
        currentDisplayScale = calcDisplayScale(tw, th, originalImage.width, originalImage.height);
        renderResult();
        downloadBtn.disabled = false;

        // 同步到绘画助手
        syncPixelDataToPainter();
    }

    function calcDisplayScale(pixelW, pixelH, origW, origH) {
        return Math.max(1, Math.min(Math.floor(origW / pixelW), Math.floor(origH / pixelH)));
    }

    function renderResult() {
        if (!pixelArtData) return;
        drawPixelArtScaled(resultCtx, pixelArtData, currentDisplayScale);
        resultInfo.textContent = `${pixelArtData.width} × ${pixelArtData.height} px → 显示 ${pixelArtData.width * currentDisplayScale} × ${pixelArtData.height * currentDisplayScale} (${currentDisplayScale}x)`;
    }

    downloadBtn.addEventListener('click', () => {
        if (!pixelArtData) return;
        const expScale = parseInt(exportScale.value);
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = pixelArtData.width * expScale;
        exportCanvas.height = pixelArtData.height * expScale;
        drawPixelArtScaled(exportCanvas.getContext('2d'), pixelArtData, expScale);
        exportCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixel_${pixelArtData.width}x${pixelArtData.height}_${expScale}x.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    });

    // ==================== 绘画助手模块 ====================
    const painterCanvas = document.getElementById('painterCanvas');
    const painterCtx = painterCanvas.getContext('2d');
    const painterInfo = document.getElementById('painterInfo');
    const painterStats = document.getElementById('painterStats');
    const colorList = document.getElementById('colorList');
    const useScalerImageBtn = document.getElementById('useScalerImageBtn');
    const painterUploadBtn = document.getElementById('painterUploadBtn');
    const painterFileInput = document.getElementById('painterFileInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const downloadExeBtn = document.getElementById('downloadExeBtn');
    const downloadPyLink = document.getElementById('downloadPyLink');
    const painterTargetWidth = document.getElementById('painterTargetWidth');
    const painterTargetHeight = document.getElementById('painterTargetHeight');
    const colorTolerance = document.getElementById('colorTolerance');
    const toleranceValue = document.getElementById('toleranceValue');
    const arkPixelCheckbox = document.getElementById('arkPixelCheckbox');

    let painterImage = null;
    let painterPixelData = null;
    let currentColorAnalysis = null;

    function updatePainterImage(img) {
        painterImage = img;
        useScalerImageBtn.style.display = 'inline-block';
        painterTargetWidth.value = targetWidth.value;
        painterTargetHeight.value = targetHeight.value;
    }

    useScalerImageBtn.addEventListener('click', () => {
        if (!painterImage) return;
        loadPainterImage(painterImage);
    });

    painterUploadBtn.addEventListener('click', () => painterFileInput.click());

    painterFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    painterImage = img;
                    loadPainterImage(img);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    function loadPainterImage(img) {
        painterCanvas.width = img.width;
        painterCanvas.height = img.height;
        painterCtx.drawImage(img, 0, 0);
        painterInfo.textContent = `${img.width} × ${img.height} px`;
        painterTargetWidth.value = targetWidth.value;
        painterTargetHeight.value = targetHeight.value;
        analyzeBtn.disabled = false;
    }

    function syncPixelDataToPainter() {
        if (!pixelArtData) return;
        painterPixelData = pixelArtData;

        // 预览
        const scale = Math.max(1, Math.floor(200 / pixelArtData.width));
        drawPixelArtScaled(painterCtx, pixelArtData, scale);
        painterInfo.textContent = `${pixelArtData.width} × ${pixelArtData.height} px`;
        painterTargetWidth.value = pixelArtData.width;
        painterTargetHeight.value = pixelArtData.height;
        analyzeBtn.disabled = false;
    }

    analyzeBtn.addEventListener('click', () => {
        let sourceData;
        let w, h;

        if (painterPixelData) {
            sourceData = painterPixelData;
            w = sourceData.width;
            h = sourceData.height;
        } else if (painterImage) {
            const tw = parseInt(painterTargetWidth.value);
            const th = parseInt(painterTargetHeight.value);

            painterCtx.clearRect(0, 0, painterCanvas.width, painterCanvas.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = painterImage.width;
            tempCanvas.height = painterImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(painterImage, 0, 0);
            const srcData = tempCtx.getImageData(0, 0, painterImage.width, painterImage.height);
            sourceData = nearestNeighborScale(srcData, painterImage.width, painterImage.height, tw, th);
            w = tw;
            h = th;
        } else {
            return;
        }

        const tolerance = parseInt(colorTolerance.value);
        const useArk = arkPixelCheckbox.checked; // ★ 获取复选框状态
        currentColorAnalysis = analyzeColors(sourceData, tolerance, useArk);

        // 如果启用了方舟模式，禁用容差滑块
        if (useArk) {
            colorTolerance.disabled = true;
            colorTolerance.value = 0;
            toleranceValue.textContent = '0';
        } else {
            colorTolerance.disabled = false;
        }

        // 显示统计，增加模式提示
        const modeLabel = useArk ? '（方舟像素模式）' : '';
        painterStats.innerHTML = `
            图片尺寸：<span>${w} × ${h}</span> 像素<br>
            颜色数量：<span>${currentColorAnalysis.uniqueColors}</span> 种${modeLabel}<br>
            总像素数：<span>${currentColorAnalysis.totalPixels}</span> 个
        `;

        // 显示颜色列表
        colorList.innerHTML = currentColorAnalysis.colorGroups.map(g => `
            <div class="color-item">
                <div class="color-swatch" style="background-color:${g.color};"></div>
                <div class="color-info">
                    <div class="color-name">${g.colorName}</div>
                    <div class="color-hex">${g.color}</div>
                </div>
                <div class="color-count">${g.count} 个像素</div>
            </div>
        `).join('');

        downloadJsonBtn.disabled = false;

        // 更新预览
        const scale = Math.max(1, Math.floor(200 / w));
        drawPixelArtScaled(painterCtx, sourceData, scale);
        painterInfo.textContent = `${w} × ${h} px`;
    });

    colorTolerance.addEventListener('input', () => {
        toleranceValue.textContent = colorTolerance.value;
    });

    // 方舟像素复选框变化时自动重新分析
    arkPixelCheckbox.addEventListener('change', () => {
        if (arkPixelCheckbox.checked) {
            colorTolerance.disabled = true;
            colorTolerance.value = 0;
            toleranceValue.textContent = '0';
        } else {
            colorTolerance.disabled = false;
        }
        // 如果已经有分析结果，自动重新分析
        if (painterImage || painterPixelData) {
            analyzeBtn.click();
        }
    });

    // 下载 JSON
    downloadJsonBtn.addEventListener('click', () => {
        if (!currentColorAnalysis) return;
        const json = generateJson(currentColorAnalysis);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'action.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // 下载 EXE 程序
    downloadExeBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = 'PixelCraft.exe';
        a.download = 'PixelCraft.exe';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // 下载 PY 脚本（备用）
    downloadPyLink.addEventListener('click', (e) => {
        e.preventDefault();
        const script = getGuiPythonScript();
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'draw_gui.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function getGuiPythonScript() {
        return "#!" + "/usr/bin/env python3\n" +
            '"""PixelCraft 自动绘画脚本（GUI版）\n' +
            '双击运行，图形界面操作\n' +
            '用法：python draw_gui.py\n' +
            '打包：python build.py\n' +
            '输出：PixelCraft.exe"""\n' +
            '\n' +
            'import json\n' +
            'import time\n' +
            'import sys\n' +
            'import os\n' +
            'import threading\n' +
            'import tkinter as tk\n' +
            'from tkinter import filedialog, messagebox, ttk\n' +
            'import pyautogui\n' +
            '\n' +
            'pyautogui.FAILSAFE = True\n' +
            'pyautogui.PAUSE = 0\n' +
            '\n' +
            '# ========== 可调参数 ==========\n' +
            'DOUBLE_CLICK_INTERVAL = 0.05\n' +
            'CLICK_AFTER_DELAY = 0.03\n' +
            '\n' +
            'COLOR_NAMES = {\n' +
            "    '#000000': '黑色', '#ffffff': '白色', '#ff0000': '红色',\n" +
            "    '#00ff00': '绿色', '#0000ff': '蓝色', '#ffff00': '黄色',\n" +
            "    '#ff00ff': '品红/洋红', '#00ffff': '青色', '#808080': '灰色',\n" +
            "    '#800000': '栗色/深红', '#808000': '橄榄色', '#008000': '深绿色',\n" +
            "    '#800080': '紫色', '#008080': '蓝绿色', '#000080': '海军蓝',\n" +
            "    '#c0c0c0': '银色', '#ffa500': '橙色', '#a52a2a': '棕色',\n" +
            "    '#ffc0cb': '粉色', '#ffd700': '金色', '#4b0082': '靛蓝色',\n" +
            "    '#7fffd4': '碧绿色', '#ff6347': '番茄红', '#40e0d0': '绿松色',\n" +
            "    '#ee82ee': '紫罗兰', '#dda0dd': '梅红色', '#fa8072': '鲑鱼色',\n" +
            "    '#87ceeb': '天蓝', '#ffb6c1': '浅粉', '#d2b48c': '棕褐色',\n" +
            "    '#f0e68c': '卡其色', '#98fb98': '淡绿色',\n" +
            '}\n' +
            '\n' +
            'def get_color_name(hex_color):\n' +
            '    h = hex_color.upper()\n' +
            '    if h in COLOR_NAMES: return COLOR_NAMES[h]\n' +
            '    r1, g1, b1 = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)\n' +
            "    best, best_dist = '自定义颜色', float('inf')\n" +
            '    for kh, name in COLOR_NAMES.items():\n' +
            '        r2, g2, b2 = int(kh[1:3], 16), int(kh[3:5], 16), int(kh[5:7], 16)\n' +
            '        d = (r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2\n' +
            '        if d < best_dist: best_dist, best = d, name\n' +
            '    return best\n' +
            '\n' +
            'def merge_colors(data):\n' +
            '    cm = {}\n' +
            "    for g in data['colorGroups']:\n" +
            "        c = g['color']\n" +
            "        cn = g.get('colorName', get_color_name(c))\n" +
            "        ps = g['positions']\n" +
            '        if not ps: continue\n' +
            '        if isinstance(ps[0], list): pl = [tuple(p) for p in ps]\n' +
            '        elif isinstance(ps[0], (int, float)):\n' +
            '            pl = [(int(ps[i]), int(ps[i+1])) for i in range(0, len(ps), 2) if i+1 < len(ps)]\n' +
            '        else: continue\n' +
            '        if c not in cm: cm[c] = {\'color\': c, \'colorName\': cn, \'positions\': []}\n' +
            "        cm[c]['positions'].extend(pl)\n" +
            '    r = []\n' +
            '    for c, info in cm.items():\n' +
            "        info['count'] = len(info['positions']); r.append(info)\n" +
            "    r.sort(key=lambda x: x['count'], reverse=True)\n" +
            '    return r\n' +
            '\n' +
            'def draw_pixel(x, y, double_click=True):\n' +
            '    pyautogui.moveTo(x, y); time.sleep(0.003)\n' +
            '    pyautogui.click(x, y)\n' +
            '    if double_click: time.sleep(DOUBLE_CLICK_INTERVAL); pyautogui.click(x, y)\n' +
            '    time.sleep(CLICK_AFTER_DELAY)\n' +
            '\n' +
            'class PixelCraftGUI:\n' +
            '    def __init__(self):\n' +
            '        self.root = tk.Tk()\n' +
            '        self.root.title("PixelCraft 自动绘画")\n' +
            '        self.root.geometry("520x480")\n' +
            '        self.root.resizable(True, True)\n' +
            '        self.data = None\n' +
            '        self.color_groups = None\n' +
            '        self.ox = self.oy = self.ex = self.ey = None\n' +
            '        self.step_x = self.step_y = 0\n' +
            '        self.is_drawing = False\n' +
            '        self.current_color_idx = 0\n' +
            '        self._setup_ui()\n' +
            '\n' +
            '    def _setup_ui(self):\n' +
            '        f = tk.Frame(self.root, padx=15, pady=10)\n' +
            '        f.pack(fill=tk.BOTH, expand=True)\n' +
            '        tk.Label(f, text="PixelCraft 自动绘画助手", font=("", 14, "bold")).pack(pady=5)\n' +
            '        tk.Label(f, text="1. 选择从网页下载的 action.json 文件", anchor="w").pack(fill=tk.X)\n' +
            '        bf = tk.Frame(f)\n' +
            '        bf.pack(fill=tk.X, pady=5)\n' +
            '        self.path_var = tk.StringVar(value="未选择文件...")\n' +
            '        tk.Entry(bf, textvariable=self.path_var, state="readonly").pack(side=tk.LEFT, fill=tk.X, expand=True)\n' +
            '        tk.Button(bf, text="浏览...", command=self._load_json).pack(side=tk.RIGHT, padx=(5, 0))\n' +
            '        # 复选框参数\n' +
            '        tk.Label(f, text="2. 绘图参数设置", anchor="w").pack(fill=tk.X, pady=(10, 0))\n' +
            '        cbf = tk.Frame(f)\n' +
            '        cbf.pack(fill=tk.X, pady=3)\n' +
            '        self.dbl_click_var = tk.BooleanVar(value=True)\n' +
            '        tk.Checkbutton(cbf, text="双击绘制（每像素点击两次）",\n' +
            '                       variable=self.dbl_click_var).pack(anchor="w")\n' +
            '        self.activate_var = tk.BooleanVar(value=True)\n' +
            '        tk.Checkbutton(cbf, text="自动激活画图窗口（绘制前点击窗口）",\n' +
            '                       variable=self.activate_var).pack(anchor="w")\n' +
            '\n' +
            '        tk.Label(f, text="3. 标定画布位置", anchor="w").pack(fill=tk.X, pady=(10, 0))\n' +
            '        cf = tk.Frame(f)\n' +
            '        cf.pack(fill=tk.X, pady=3)\n' +
            '        tk.Button(cf, text="左上角", command=self._calibrate_tl).pack(side=tk.LEFT, padx=2)\n' +
            '        tk.Button(cf, text="右下角", command=self._calibrate_br).pack(side=tk.LEFT, padx=2)\n' +
            '        self.calib_var = tk.StringVar(value="未标定")\n' +
            '        tk.Label(cf, textvariable=self.calib_var, fg="gray").pack(side=tk.LEFT, padx=10)\n' +
            '        tk.Label(f, text="4. 开始自动绘制", anchor="w").pack(fill=tk.X, pady=(10, 0))\n' +
            '        self.info_var = tk.StringVar(value="")\n' +
            '        tk.Label(f, textvariable=self.info_var, fg="blue").pack(anchor="w")\n' +
            '        self.progress = ttk.Progressbar(f, mode="determinate", length=450)\n' +
            '        self.progress.pack(fill=tk.X, pady=5)\n' +
            '        self.status_var = tk.StringVar(value="等待开始...")\n' +
            '        tk.Label(f, textvariable=self.status_var, fg="gray").pack(anchor="w")\n' +
            '        self.color_label = tk.Label(f, text="", font=("", 11))\n' +
            '        self.color_label.pack(pady=5)\n' +
            '        bbf = tk.Frame(f)\n' +
            '        bbf.pack(pady=10)\n' +
            '        self.start_btn = tk.Button(bbf, text="▶ 开始绘制", bg="#4CAF50", fg="white",\n' +
            '            font=("", 12, "bold"), width=15, state=tk.DISABLED, command=self._start_drawing)\n' +
            '        self.start_btn.pack(side=tk.LEFT, padx=5)\n' +
            '        tk.Button(bbf, text="⏹ 紧急停止", bg="#f44336", fg="white",\n' +
            '            font=("", 10), width=12, command=self._emergency_stop).pack(side=tk.LEFT, padx=5)\n' +
            '\n' +
            '    def _load_json(self):\n' +
            '        fp = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])\n' +
            '        if not fp: return\n' +
            '        try:\n' +
            '            with open(fp, "r", encoding="utf-8") as f: self.data = json.load(f)\n' +
            '            self.color_groups = merge_colors(self.data)\n' +
            '            self.path_var.set(os.path.basename(fp))\n' +
            '            w, h = self.data["image"]["width"], self.data["image"]["height"]\n' +
            '            nc = len(self.color_groups)\n' +
            '            tp = self.data["totalPixels"]\n' +
            "            self.info_var.set(f'画布: {w}×{h} | 颜色: {nc} 种 | 总像素: {tp}')\n" +
            '            if self.ox is not None and self.ey is not None:\n' +
            '                self.start_btn.config(state=tk.NORMAL)\n' +
            '            messagebox.showinfo("加载成功", f"已加载 {nc} 种颜色\\n画布 {w}×{h} 像素")\n' +
            '        except Exception as ex:\n' +
            '            messagebox.showerror("错误", f"加载失败：{ex}")\n' +
            '\n' +
            '    def _calibrate_tl(self):\n' +
            '        self.root.iconify(); time.sleep(0.5)\n' +
            '        messagebox.showinfo("标定", "移动鼠标到画布左上角第一个像素中心\\n然后回到此处按确定")\n' +
            '        self.ox, self.oy = pyautogui.position()\n' +
            '        self.root.deiconify()\n' +
            '        self.calib_var.set(f"左上({self.ox},{self.oy})")\n' +
            '        self._check_ready()\n' +
            '\n' +
            '    def _calibrate_br(self):\n' +
            '        self.root.iconify(); time.sleep(0.5)\n' +
            '        messagebox.showinfo("标定", "移动鼠标到画布右下角最后一个像素中心\\n然后回到此处按确定")\n' +
            '        self.ex, self.ey = pyautogui.position()\n' +
            '        self.root.deiconify()\n' +
            '        self.calib_var.set(f"右下({self.ex},{self.ey})")\n' +
            '        self._check_ready()\n' +
            '\n' +
            '    def _check_ready(self):\n' +
            '        if self.ox is not None and self.ey is not None and self.data:\n' +
            '            w, h = self.data["image"]["width"], self.data["image"]["height"]\n' +
            "            self.step_x = (self.ex - self.ox) / max(w - 1, 1)\n" +
            "            self.step_y = (self.ey - self.oy) / max(h - 1, 1)\n" +
            '            self.calib_var.set(f"步长 X:{self.step_x:.1f} Y:{self.step_y:.1f}")\n' +
            '            self.start_btn.config(state=tk.NORMAL)\n' +
            '\n' +
            '    def _start_drawing(self):\n' +
            '        if self.is_drawing: return\n' +
            '        self.is_drawing = True\n' +
            '        self.current_color_idx = 0\n' +
            "        self.root.iconify()\n" +
            '        time.sleep(0.3)\n' +
            '        # 激活窗口\n' +
            '        cx, cy = (self.ox + self.ex)//2, (self.oy + self.ey)//2\n' +
            '        pyautogui.click(cx - 100, cy); time.sleep(0.2)\n' +
            '        pyautogui.click(cx, cy); time.sleep(0.3)\n' +
            '        self._draw_next_color()\n' +
            '\n' +
            '    def _draw_next_color(self):\n' +
            '        if not self.is_drawing or self.current_color_idx >= len(self.color_groups):\n' +
            '            self._finish()\n' +
            '            return\n' +
            '        g = self.color_groups[self.current_color_idx]\n' +
            '        color, name, positions, count = g["color"], g["colorName"], g["positions"], g["count"]\n' +
            '        self.root.deiconify()\n' +
            '        self.progress["value"] = 0\n' +
            '        self.progress["maximum"] = count\n' +
            '        self.color_label.config(text=f"🎨 {color}（{name}）- {count} 个像素", fg=color)\n' +
            "        self.status_var.set(f'请将画笔切换为 {color}（{name}），然后按确定')\n" +
            '        if messagebox.askokcancel("切换颜色",\n' +
            '            f"请将画笔颜色切换为：\\n{color}（{name}）\\n\\n共 {count} 个像素\\n\\n按「确定」开始绘制"):\n' +
            '            self.root.iconify()\n' +
            '            time.sleep(0.3)\n' +
            '            # 在后台线程绘制\n' +
            '            threading.Thread(target=self._draw_color, args=(g,), daemon=True).start()\n' +
            '        else:\n' +
            '            self.is_drawing = False\n' +
            '            self.root.deiconify()\n' +
            '\n' +
            '    def _draw_color(self, g):\n' +
            '        positions, count = g["positions"], g["count"]\n' +
            '        for i, (px, py) in enumerate(positions):\n' +
            '            if not self.is_drawing: return\n' +
            '            sx = self.ox + px * self.step_x\n' +
            '            sy = self.oy + py * self.step_y\n' +
            '            draw_pixel(sx, sy)\n' +
            '            if (i + 1) % 50 == 0 or i == count - 1:\n' +
            "                self.root.after(0, lambda v=i+1, c=count: self._update_progress(v, c))\n" +
            "        self.root.after(0, self._color_done)\n" +
            '\n' +
            '    def _update_progress(self, val, total):\n' +
            '        self.progress["value"] = val\n' +
            "        self.status_var.set(f'进度：{val}/{total} ({100*val/total:.0f}%)')\n" +
            '\n' +
            '    def _color_done(self):\n' +
            '        self.current_color_idx += 1\n' +
            '        self._draw_next_color()\n' +
            '\n' +
            '    def _finish(self):\n' +
            '        self.is_drawing = False\n' +
            '        self.root.deiconify()\n' +
            '        self.progress["value"] = self.progress["maximum"]\n' +
            "        self.status_var.set('🎉 全部绘制完成！')\n" +
            '        self.color_label.config(text="")\n' +
            '        messagebox.showinfo("完成", "🎉 全部绘制完成！\\n感谢使用 PixelCraft")\n' +
            '\n' +
            '    def _emergency_stop(self):\n' +
            '        self.is_drawing = False\n' +
            "        self.status_var.set('⚠️ 已停止')\n" +
            '        self.root.deiconify()\n' +
            '\n' +
            '    def run(self):\n' +
            '        self.root.mainloop()\n' +
            '\n' +
            'if __name__ == "__main__":\n' +
            '    PixelCraftGUI().run()\n';
    }
});
