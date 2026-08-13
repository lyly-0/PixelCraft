"""PixelCraft 精简打包脚本
在虚拟环境中运行：python build.py
输出：dist/PixelCraft.exe"""

import subprocess
import sys
import os


def build():
    print("=" * 50)
    print(" PixelCraft 精简打包工具")
    print("=" * 50)

    # 检查是否在虚拟环境中
    in_venv = hasattr(sys, 'real_prefix') or sys.base_prefix != sys.prefix
    if not in_venv:
        print("⚠️ 建议在虚拟环境中运行：")
        print("  python -m venv env")
        print("  env\\Scripts\\activate")
        print("  pip install pyautogui pyinstaller")
        print("  python build.py")
        print()

    print("开始打包...")
    print()

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--windowed",
        "--name", "PixelCraft",
        "--clean",
        "--noconfirm",
        "--strip",
        # 排除不需要的模块
        "--exclude-module", "matplotlib",
        "--exclude-module", "numpy",
        "--exclude-module", "pandas",
        "--exclude-module", "PIL",
        "--exclude-module", "Pillow",
        "--exclude-module", "cv2",
        "--exclude-module", "cffi",
        "--exclude-module", "setuptools",
        "--exclude-module", "distutils",
        "--exclude-module", "pkg_resources",
        "--exclude-module", "scipy",
        "--exclude-module", "lxml",
        "--exclude-module", "sqlalchemy",
        "--exclude-module", "PyQt5",
        "--exclude-module", "wx",
        "--exclude-module", "IPython",
        "--exclude-module", "jupyter",
        "draw_gui.py"
    ]
    subprocess.check_call(cmd)

    exe_path = os.path.join("dist", "PixelCraft.exe")
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / 1024 / 1024
        print()
        print("=" * 50)
        print(" [OK] 打包完成!")
        print(f" 输出文件：{exe_path}")
        print(f" 文件大小：{size_mb:.1f} MB")
        if size_mb <= 25:
            print(f" [OK] 可以上传到 GitHub!")
        else:
            print(f" [WARN] 仍超过 25MB")
            print(f" 请尝试：")
            print(f" 1. 下载 UPX 并放到项目目录")
            print(f" 2. 重新运行 python build.py")
        print("=" * 50)
    else:
        print("[ERROR] 打包失败，请检查错误信息")


if __name__ == "__main__":
    build()
