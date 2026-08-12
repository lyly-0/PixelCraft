# PixelCraft 像素工坊

纯前端像素艺术工具集，部署于 GitHub Pages。

## 功能模块

### 1. 像素画缩放器
上传图片 → 最邻近算法缩放 → 左右并排预览 → 下载 PNG

### 2. 自动绘画助手
分析图片颜色 → 生成 JSON 指令 → 下载 EXE → 本地双击运行自动绘制

## 文件结构

```
pixelcraft/
├── index.html          # 主页面（双标签切换）
├── css/
│   └── style.css       # 样式
├── js/
│   ├── app.js          # 主逻辑 + 标签切换 + 下载功能
│   ├── scaler.js       # 最邻近缩放算法
│   └── painter.js      # 颜色分析 + JSON 生成 + 颜色命名
├── draw_gui.py         # GUI 自动绘画脚本（源码）
├── build.py            # 一键打包脚本 → PixelCraft.exe
├── PixelCraft.exe      # 打包后的可执行文件（用户下载）
└── README.md
```

## 使用流程

### 像素画缩放器
1. 打开网页 → 上传图片
2. 设置目标尺寸 → 点击「生成像素画」
3. 选择导出倍数 → 点击「下载图片」

### 自动绘画助手
1. 上传图片 → 点击「分析颜色」
2. 可选：勾选「方舟像素」限定为明日方舟风格 40 色
3. 下载 `action.json`
4. 首次使用：下载 `PixelCraft.exe`
5. 双击 EXE → 加载 JSON → 标定画布 → 自动绘制

## 构建 EXE

```powershell
python build.py
# 输出：PixelCraft.exe
```

## 技术栈

- HTML5 + CSS3 + Vanilla JavaScript
- HTML5 Canvas API（最邻近插值缩放）
- Python 3 + tkinter + PyAutoGUI（GUI 自动绘画）
- PyInstaller（打包为独立 EXE）
