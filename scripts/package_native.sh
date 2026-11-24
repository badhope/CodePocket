#!/bin/bash
# 打包原生 CPython 运行产物到 dev-terminal APK 结构
# 用法：ABI=x86_64 bash scripts/package_native.sh <cpython-cross-dir>
#
# 依赖环境变量（都可选）：
#   CPYTHON_CROSS_DIR  CPython 交叉编译产物目录（等价于第一个参数）
#   ANDROID_NDK_HOME   指定 NDK；未设置时自动探测 $ANDROID_HOME/ndk 下最新版本
#   APP_DIR            目标 app 模块目录，默认 <仓库根>/app
#   ABI                目标 ABI：arm64-v8a（默认）或 x86_64
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SRC="${1:-${CPYTHON_CROSS_DIR:-}}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "用法: bash scripts/package_native.sh <cpython-cross-dir>（或设置 CPYTHON_CROSS_DIR）" >&2
  echo "示例: bash scripts/package_native.sh ~/tools/cpython-3.13.9/cross-build/aarch64-linux-android" >&2
  exit 2
fi
PREFIX="$SRC/prefix"
APP="${APP_DIR:-$ROOT/app}"
ABI="${ABI:-arm64-v8a}"
case "$ABI" in
  arm64-v8a) HOST_TRIPLE="aarch64-linux-android" ;;
  x86_64)    HOST_TRIPLE="x86_64-linux-android" ;;
  *) echo "不支持的 ABI: $ABI（只支持 arm64-v8a / x86_64）" >&2; exit 2 ;;
esac

NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [ -z "$NDK" ]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
  NDK="$(ls -d "$SDK"/ndk/* 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$NDK" ] || [ ! -d "$NDK" ]; then
  echo "未找到 Android NDK，请设置 ANDROID_NDK_HOME" >&2
  exit 2
fi
TC="$NDK/toolchains/llvm/prebuilt/linux-x86_64"
JDIR="$APP/src/main/jniLibs/$ABI"

echo "== 1. 拷贝 libpython3.13.so 到 jniLibs =="
mkdir -p "$JDIR"
ls -la "$PREFIX/lib/libpython3.13.so"
cp "$PREFIX/lib/libpython3.13.so" "$JDIR/"

echo "== 2. 拷贝 C 扩展（lib-dynload）与依赖库到 jniLibs =="
# C 扩展（math.cpython-...so 等）放进 jniLibs/$ABI；
# 但 Android PackageManager 只解压 lib<name>.so，非 lib 前缀的扩展不会出现在
# nativeLibraryDir。NativeEngine 首启会从 APK 把它们抽到
# files/python-stdlib/lib/python3.13/lib-dynload，再交给 CPython 加载。
# 过滤测试模块（_test* / _ctypes_test / xxlimited* / xxsubtype / _xxtestfuzz）。
DYLOAD="$PREFIX/lib/python3.13/lib-dynload"
copied=0
for f in "$DYLOAD"/*.so; do
  base=$(basename "$f")
  case "$base" in
    _test*|_ctypes_test*|xxlimited*|xxsubtype*|_xxtestfuzz*) ;;  # skip
    *) cp "$f" "$JDIR/"; copied=$((copied+1)) ;;
  esac
done
echo "    copied $copied extension modules"
# 依赖库：_ssl/_hashlib 依赖 libcrypto_python(+libssl_python)，_sqlite3 依赖 libsqlite3_python
cp "$PREFIX/lib/libssl_python.so"      "$JDIR/"
cp "$PREFIX/lib/libcrypto_python.so"   "$JDIR/"
cp "$PREFIX/lib/libsqlite3_python.so"  "$JDIR/"

# 去掉调试符号，体积约降 80%；动态符号表保留，CPython C API 仍可导出
STRIP="$TC/bin/llvm-strip"
if [ -x "$STRIP" ]; then
  "$STRIP" --strip-unneeded "$JDIR/libpython3.13.so" 2>/dev/null || true
fi

echo "== 3. 编译 libpybridge.so（JNI 桥） =="
ls "$PREFIX/include/python3.13/Python.h" >/dev/null
"$TC/bin/${HOST_TRIPLE}21-clang" \
  -I"$PREFIX/include/python3.13" \
  -shared -fPIC -O2 \
  -o "$JDIR/libpybridge.so" \
  "$APP/src/main/cpp/pybridge.c" \
  -L"$JDIR" -lpython3.13 \
  -lm -ldl -llog -Wl,--no-undefined \
  -Wl,-z,max-page-size=16384
if [ -x "$STRIP" ]; then
  "$STRIP" --strip-unneeded "$JDIR/libpybridge.so" 2>/dev/null || true
fi
ls -la "$JDIR/libpybridge.so"

echo "== 4. 打包纯 .py 标准库到 assets/python-stdlib.zip =="
# 注意：C 扩展（lib-dynload 下的 .so）不进 zip——它们走 jniLibs（见步骤 2）。
# 这里只打纯 Python 标准库，解压后落在 files/python-stdlib/lib/python3.13/。
STDLIB="$PREFIX/lib/python3.13"
python3 - "$STDLIB" "$APP/src/main/assets/python-stdlib.zip" <<'PY'
import sys, zipfile, os
src, out = sys.argv[1], sys.argv[2]
count = 0
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        # __pycache__ 是字节码缓存，占标准库体积 3/4，却能在首次 import 时自动重建；
        # 不进 zip 可把 60MB 降到 12MB 左右，显著缩短首启解压时间。
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        if "lib-dynload" in root:
            continue  # C 扩展走 jniLibs，不进 zip
        for f in files:
            if f.endswith(".pyc"):
                continue
            p = os.path.join(root, f)
            arc = "lib/python3.13/" + os.path.relpath(p, src)
            z.write(p, arc)
            count += 1
print(f"packed {count} pure-python files (pycache excluded)")
PY
ls -la "$APP/src/main/assets/python-stdlib.zip"

echo "== 完成 =="