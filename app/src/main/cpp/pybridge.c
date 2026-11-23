/*
 * pybridge.c —— DevTerminal 原生 Python 引擎的 JNI 桥
 *
 * 设计原则（贴合正常人思维，不重复造轮子）：
 * 1. stdin/stdout/stderr 全部在 Python 层桥接：Python 侧挂自定义 file-like 对象，
 *    其 write/readline 方法调用本桥暴露的 C 函数，C 函数再回调 Java。
 *    不碰 C 管道、不碰文件描述符，语义清晰且无泄漏。
 * 2. 中断走 CPython 官方的 Py_AddPendingCall（线程安全、对死循环有效——
 *    解释器每 N 条字节码检查一次 pending call，回调里抛 KeyboardInterrupt）。
 *    这是 Chaquopy 同款机制，不自己造轮子。注意：Py_AddPendingCall 本就支持
 *    无 GIL 调用，因此 requestInterrupt 绝不 PyGILState_Ensure——否则一旦用户
 *    代码正阻塞在 input()（持着 GIL），stop() 会在 Ensure 上永久死锁。
 * 3. 解释器在专用线程里跑（Py_Initialize 必须在持 GIL 的线程完成）；
 *    Kotlin 侧通过 JNI 调用时用 PyGILState_Ensure/Release 临时拿 GIL。
 *
 * 运行时约束：libpython3.13.so、libpybridge.so 以及依赖库（libssl_python.so /
 * libcrypto_python.so / libsqlite3_python.so）都放 jniLibs/arm64-v8a，由 Android
 * linker 自动解析。Python C 扩展（math.cpython-...so 等）不满足 PackageManager
 * 的 lib<name>.so 规则，由 NativeEngine 首启从 APK 抽到
 * python-stdlib/lib/python3.13/lib-dynload，再随标准库加入 sys.path。
 * 初始化时把 nativeLibraryDir insert 进 sys.path，CPython 即可加载依赖库；
 * 纯 Python 扩展（math/random/json/datetime/socket/ctypes/_ssl/_sqlite3 等）
 * 从 lib-dynload 读取。
 */
#include <jni.h>
#include <Python.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unwind.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdint.h>
#include <limits.h>

/* ---------------- 与 Java 侧的回调（见 NativeBridge.kt） ---------------- */

typedef struct {
    JavaVM *jvm;
    jobject bridge;          /* NativeBridge 实例（全局引用） */
    jmethodID onOutput;      /* (String stream, String text) -> void */
    jmethodID onInputLine;   /* () -> String；阻塞等待用户输入，返回 null 表示 EOF */
    jmethodID onState;       /* (String state, String msg) -> void */
} BridgeCtx;

static BridgeCtx g_ctx = {0};

/* native crash 日志路径（由 initialize 注入，信号 handler 异步写入） */
static char g_crash_log_path[PATH_MAX] = {0};

/* P2-6：inittab 只允许注册一次（Py_Initialize 后再 AppendInittab 会报错）。 */
static int g_dtbridge_registered = 0;


/* P1-4：Python 字符串是 UTF-8，JNI NewStringUTF 只接受 modified UTF-8，
 * emoji / 4 字节字符会触发 JNI 异常并让输出变成乱码。统一走 UTF-16：
 * PyUnicode_AsUTF16String 产出带 BOM 的 UTF-16LE，NewString 会复制 jchar 数组。 */
static jstring cp_new_string(JNIEnv *env, const char *utf8) {
    if (!utf8) return NULL;
    PyObject *u = PyUnicode_DecodeUTF8(utf8, strlen(utf8), "replace");
    if (!u) { PyErr_Clear(); return (*env)->NewStringUTF(env, utf8); }
    PyObject *b = PyUnicode_AsUTF16String(u);
    Py_DECREF(u);
    if (!b) { PyErr_Clear(); return (*env)->NewStringUTF(env, utf8); }
    Py_ssize_t n = PyBytes_GET_SIZE(b);
    jstring out = NULL;
    if (n >= 2) {
        out = (*env)->NewString(env, (const jchar *)(PyBytes_AS_STRING(b) + 2),
                                (jsize)((n - 2) / 2));
    }
    Py_DECREF(b);
    return out;
}


/* P2：把 Python 异常格式化成完整 traceback（含文件名/行号/调用栈）。
 * 只返回 PyObject（新引用），由调用方转 jstring 并 DECREF。 */
static PyObject *cp_format_exception(PyObject *ptype, PyObject *pvalue, PyObject *ptb) {
    PyObject *mod = PyImport_ImportModule("traceback");
    if (!mod) { PyErr_Clear(); return NULL; }
    PyObject *fn = PyObject_GetAttrString(mod, "format_exception");
    Py_DECREF(mod);
    if (!fn) { PyErr_Clear(); return NULL; }
    PyObject *list = PyObject_CallFunctionObjArgs(fn, ptype, pvalue, ptb ? ptb : Py_None, NULL);
    Py_DECREF(fn);
    if (!list) { PyErr_Clear(); return NULL; }
    PyObject *sep = PyUnicode_FromString("");
    PyObject *joined = sep ? PyUnicode_Join(sep, list) : NULL;
    Py_XDECREF(sep);
    Py_DECREF(list);
    if (!joined) { PyErr_Clear(); return NULL; }
    return joined;
}
/* P1-5：每次运行后清掉用户脚本新增的模块与 sys.path 改动。
 * 基线在 initialize 末尾抓取，存于 __main__；脚本自身不共享该 dict，
 * 但 PyRun_SimpleString 的清理代码运行在 __main__，可直接读到。 */
static void cp_reset_after_run(void) {
    PyObject *main = PyImport_AddModule("__main__"); /* borrowed */
    if (!main) { PyErr_Clear(); return; }
    PyObject *d = PyModule_GetDict(main);
    if (!d || !PyDict_GetItemString(d, "_CP_BASELINE_MODULES")) {
        PyErr_Clear();
        return;
    }
    PyRun_SimpleString(
        "import sys as _cp_sys\n"
        "for _cp_name in list(_cp_sys.modules):\n"
        "    if _cp_name not in _CP_BASELINE_MODULES:\n"
        "        del _cp_sys.modules[_cp_name]\n"
        "_cp_sys.path[:] = _CP_BASELINE_PATH\n"
    );
    PyErr_Clear();
}

/* ---------------- Python 侧桥接函数 ---------------- */

static PyObject *bridge_output(PyObject *self, PyObject *args) {
    const char *text;
    const char *stream;
    if (!PyArg_ParseTuple(args, "ss", &stream, &text)) return NULL;
    if (g_ctx.jvm && g_ctx.bridge) {
        JNIEnv *env = NULL;
        jboolean needDetach = JNI_FALSE;
        if ((*g_ctx.jvm)->GetEnv(g_ctx.jvm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) {
            if ((*g_ctx.jvm)->AttachCurrentThread(g_ctx.jvm, &env, NULL) == JNI_OK) {
                needDetach = JNI_TRUE;
            }
        }
        if (env) {
            jstring jStream = cp_new_string(env, stream);
            jstring jText = cp_new_string(env, text);
            (*env)->CallVoidMethod(env, g_ctx.bridge, g_ctx.onOutput, jStream, jText);
            (*env)->DeleteLocalRef(env, jStream);
            (*env)->DeleteLocalRef(env, jText);
        }
        /* P2-4：若本线程是 Attach 上来的，回调结束后必须 Detach，否则泄漏。 */
        if (needDetach) (*g_ctx.jvm)->DetachCurrentThread(g_ctx.jvm);
    }
    Py_RETURN_NONE;
}

static PyObject *bridge_input(PyObject *self, PyObject *args) {
    (void)args;
    if (!g_ctx.jvm || !g_ctx.bridge) {
        PyErr_SetString(PyExc_EOFError, "bridge not ready");
        return NULL;
    }
    JNIEnv *env = NULL;
    jboolean needDetach = JNI_FALSE;
    if ((*g_ctx.jvm)->GetEnv(g_ctx.jvm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*g_ctx.jvm)->AttachCurrentThread(g_ctx.jvm, &env, NULL) == JNI_OK) {
            needDetach = JNI_TRUE;
        }
    }
    if (!env) {
        PyErr_SetString(PyExc_RuntimeError, "cannot attach JVM");
        return NULL;
    }
    /* 阻塞等待 Kotlin 侧返回一行输入（内部用协程 + 输入队列） */
    jstring line = (jstring)(*env)->CallObjectMethod(env, g_ctx.bridge, g_ctx.onInputLine);
    if (line == NULL) {
        /* Kotlin 侧 pushEof()：Python 层表现为 EOFError */
        PyErr_SetString(PyExc_EOFError, "EOF when reading a line");
        if (needDetach) (*g_ctx.jvm)->DetachCurrentThread(g_ctx.jvm);
        return NULL;
    }
    /* 必须先 GetStringUTFChars 再 Detach：JNIEnv 在 Detach 后失效，
     * 提前 detach 再使用 env/line 是另一个 native 野指针。 */
    const char *utf = (*env)->GetStringUTFChars(env, line, NULL);
    PyObject *result = PyUnicode_FromString(utf ? utf : "");
    if (utf) (*env)->ReleaseStringUTFChars(env, line, utf);
    (*env)->DeleteLocalRef(env, line);
    if (needDetach) (*g_ctx.jvm)->DetachCurrentThread(g_ctx.jvm);
    return result;
}

static PyMethodDef bridge_methods[] = {
    {"_output", bridge_output, METH_VARARGS, "forward output to Kotlin"},
    {"_input",  bridge_input,  METH_VARARGS, "read one line from Kotlin"},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef bridge_module = {
    PyModuleDef_HEAD_INIT, "dtbridge", NULL, -1, bridge_methods
};

static PyObject *module_init(void) {
    return PyModule_Create(&bridge_module);
}

/* ---------------- 中断：Py_AddPendingCall 抛 KeyboardInterrupt ---------------- */

static int interrupt_callback(void *unused) {
    (void)unused;
    PyErr_SetInterrupt();
    return 0;
}

/* ---------------- Native crash 捕获（P2-2） ----------------
 * SIGSEGV/SIGBUS/SIGABRT 时把信号名与调用栈 PC 写入 files/crash-native.log。
 * minSdk=21，bionic 的 backtrace() 需 API33 不可用，故用 clang 内置
 * _Unwind_Backtrace dump 原始返回地址（后续可用 ndk-stack / addr2line 符号化）。
 * 仅使用 async-signal-safe 调用（open/write/close）。 */
typedef struct {
    void **cur;
    void **end;
} DtUnwind;

static _Unwind_Reason_Code dt_unwind_cb(struct _Unwind_Context *ctx, void *arg) {
    DtUnwind *s = (DtUnwind *)arg;
    uintptr_t pc = _Unwind_GetIP(ctx);
    if (pc) {
        if (s->cur >= s->end) return _URC_END_OF_STACK;
        *s->cur++ = (void *)(uintptr_t)pc;
    }
    return _URC_NO_REASON;
}

static void crash_handler(int sig, siginfo_t *info, void *uctx) {
    (void)uctx;
    int fd = -1;
    if (g_crash_log_path[0]) {
        fd = open(g_crash_log_path, O_WRONLY | O_CREAT | O_APPEND, 0644);
    }
    if (fd < 0) _exit(128 + sig);

    const char *signame = "UNKNOWN";
    switch (sig) {
        case SIGSEGV: signame = "SIGSEGV"; break;
        case SIGBUS:  signame = "SIGBUS";  break;
        case SIGABRT: signame = "SIGABRT"; break;
    }
    char hdr[160];
    int n = snprintf(hdr, sizeof(hdr),
                     "\n===== NATIVE CRASH =====\nsignal=%s(%d) addr=%p pid=%d\n",
                     signame, sig, info ? info->si_addr : NULL, (int)getpid());
    if (n > 0) write(fd, hdr, (size_t)n);

    void *bt[40];
    DtUnwind s = {bt, bt + 40};
    _Unwind_Backtrace(dt_unwind_cb, &s);
    int frames = (int)(s.cur - bt);
    for (int i = 0; i < frames; i++) {
        char line[64];
        int m = snprintf(line, sizeof(line), "  #%02d pc %p\n", i, bt[i]);
        if (m > 0) write(fd, line, (size_t)m);
    }
    write(fd, "\n", 1);
    close(fd);

    /* 交回默认处理，让系统完成 tombstone / 崩溃流程 */
    signal(sig, SIG_DFL);
    raise(sig);
}

static void install_crash_handlers(void) {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_sigaction = crash_handler;
    sa.sa_flags = SA_SIGINFO;
    sigemptyset(&sa.sa_mask);
    sigaction(SIGSEGV, &sa, NULL);
    sigaction(SIGBUS, &sa, NULL);
    sigaction(SIGABRT, &sa, NULL);
}

/* ---------------- JNI 入口 ---------------- */

static JavaVM *g_jvm = NULL;

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    (void)reserved;
    g_jvm = vm;
    return JNI_VERSION_1_6;
}

JNIEXPORT void JNICALL
Java_com_devterminal_engine_NativeBridge_attach(
    JNIEnv *env, jobject thiz, jobject bridge)
{
    if (g_ctx.bridge) {
        (*env)->DeleteGlobalRef(env, g_ctx.bridge);
        g_ctx.bridge = NULL;
    }
    g_ctx.jvm = g_jvm;
    g_ctx.bridge = (*env)->NewGlobalRef(env, bridge);
    jclass cls = (*env)->GetObjectClass(env, bridge);
    g_ctx.onOutput   = (*env)->GetMethodID(env, cls, "onOutput",   "(Ljava/lang/String;Ljava/lang/String;)V");
    g_ctx.onInputLine = (*env)->GetMethodID(env, cls, "onInputLine", "()Ljava/lang/String;");
    g_ctx.onState    = (*env)->GetMethodID(env, cls, "onState",    "(Ljava/lang/String;Ljava/lang/String;)V");
    (*env)->DeleteLocalRef(env, cls);
}

JNIEXPORT void JNICALL
Java_com_devterminal_engine_NativeBridge_detach(JNIEnv *env, jobject thiz)
{
    (void)thiz;
    if (g_ctx.bridge) {
        (*env)->DeleteGlobalRef(env, g_ctx.bridge);
        g_ctx.bridge = NULL;
    }
    memset(&g_ctx, 0, sizeof(g_ctx));
}

/* 初始化解释器：必须在持有 GIL 的线程调用（专用 Python 线程）
 * stdlibPath  : files/python-stdlib（PYTHONHOME/PYTHONPATH）
 * nativeLibDir: context.applicationInfo.nativeLibraryDir（依赖库 .so 所在目录；
 *               Python C 扩展在 python-stdlib/lib/python3.13/lib-dynload）
 * crashLogPath: files/crash-native.log（native crash 日志） */
JNIEXPORT jboolean JNICALL
Java_com_devterminal_engine_NativeBridge_initialize(
    JNIEnv *env, jobject thiz,
    jstring stdlibPath, jstring nativeLibDir, jstring crashLogPath)
{
    (void)thiz;
    if (Py_IsInitialized()) return JNI_TRUE;

    const char *sp = stdlibPath ? (*env)->GetStringUTFChars(env, stdlibPath, NULL) : NULL;
    if (sp) {
        /* 让标准库从 APK 解压目录加载：/data/user/0/.../files/python-stdlib */
        setenv("PYTHONHOME", sp, 1);
        setenv("PYTHONPATH", sp, 1);
        /* 不能在这里 Release：后面拼 lib-dynload/site-packages 路径还要用 sp。
         * 提前释放会造成 JNI 字符串野指针，是初始化阶段随机闪退的根因之一。 */
    }

    /* 记录 native crash 日志路径 */
    const char *cp = crashLogPath ? (*env)->GetStringUTFChars(env, crashLogPath, NULL) : NULL;
    if (cp) {
        snprintf(g_crash_log_path, sizeof(g_crash_log_path), "%s", cp);
        (*env)->ReleaseStringUTFChars(env, crashLogPath, cp);
    }
    install_crash_handlers();

    /* 注入桥模块：必须放在 Py_Initialize 之前，否则 inittab 不生效。
     * P2-6：重复 initialize（如 release 后重建）时跳过，避免 AppendInittab 报错。 */
    if (!g_dtbridge_registered) {
        if (PyImport_AppendInittab("dtbridge", module_init) != 0) return JNI_FALSE;
        g_dtbridge_registered = 1;
    }
    Py_Initialize();
    PyEval_SaveThread();  /* 释放 GIL，允许其他线程进入 */

    PyGILState_STATE gil = PyGILState_Ensure();
    PyObject *mod = PyImport_ImportModule("dtbridge");
    if (!mod) {
        PyErr_Print();
        PyGILState_Release(gil);
        return JNI_FALSE;
    }

    /* 注入 nativeLibDir 到 sys.path：依赖库（libpython/libssl 等）从此加载；
     * C 扩展本体在 stdlib/lib/python3.13/lib-dynload（NativeEngine 首启从 APK 抽出）。
     * 同时把 site-packages 加进 sys.path（P2-4）。路径均为 Android 文件系统路径，
     * 不含引号/反斜杠，无需转义。 */
    const char *nld = nativeLibDir ? (*env)->GetStringUTFChars(env, nativeLibDir, NULL) : NULL;
    if (nld) {
        char pathInject[PATH_MAX * 2];
        snprintf(pathInject, sizeof(pathInject),
                 "import sys\n"
                 "sys.path.insert(0, '%s')\n",
                 nld);
        PyRun_SimpleString(pathInject);
        (*env)->ReleaseStringUTFChars(env, nativeLibDir, nld);
    }
    if (sp) {
        char spInject[PATH_MAX * 2];
        snprintf(spInject, sizeof(spInject),
                 "import sys, os\n"
                 "_sp = os.path.join('%s', 'lib', 'python3.13', 'site-packages')\n"
                 "_dyn = os.path.join('%s', 'lib', 'python3.13', 'lib-dynload')\n"
                 "if os.path.isdir(_dyn): sys.path.insert(0, _dyn)\n"
                 "if os.path.isdir(_sp): sys.path.append(_sp)\n",
                 sp, sp);
        PyRun_SimpleString(spInject);
        (*env)->ReleaseStringUTFChars(env, stdlibPath, sp);
    }

    /* 挂载自定义 stdin/stdout/stderr（纯 Python，不碰 C 层）
     * P2-6: readline/read 正确处理 size，EOFError 捕获后返回空串 */
    PyRun_SimpleString(
        "import sys, io\n"
        "class _DtOut(io.TextIOBase):\n"
        "    def write(self, s):\n"
        "        import dtbridge as _d\n"
        "        _d._output('stdout', s)\n"
        "        return len(s)\n"
        "    def flush(self):\n"
        "        pass\n"
        "class _DtErr(io.TextIOBase):\n"
        "    def write(self, s):\n"
        "        import dtbridge as _d\n"
        "        _d._output('stderr', s)\n"
        "        return len(s)\n"
        "    def flush(self):\n"
        "        pass\n"
        "class _DtIn(io.TextIOBase):\n"
        "    def _read_line(self):\n"
        "        import dtbridge as _d\n"
        "        try:\n"
        "            line = _d._input()\n"
        "        except EOFError:\n"
        "            return ''\n"
        "        return line + '\\n'\n"
        "    def readline(self, size=-1):\n"
        "        line = self._read_line()\n"
        "        if size and size > 0 and len(line) > size:\n"
        "            return line[:size]\n"
        "        return line\n"
        "    def read(self, size=-1):\n"
        "        if size == 0:\n"
        "            return ''\n"
        "        parts = []\n"
        "        total = 0\n"
        "        while size < 0 or total < size:\n"
        "            line = self._read_line()\n"
        "            if line == '':\n"
        "                break\n"
        "            parts.append(line)\n"
        "            total += len(line)\n"
        "        data = ''.join(parts)\n"
        "        if size and size > 0 and len(data) > size:\n"
        "            return data[:size]\n"
        "        return data\n"
        "sys.stdout = _DtOut()\n"
        "sys.stderr = _DtErr()\n"
        "sys.stdin = _DtIn()\n"
        "sys.stdout.flush()\n"
        "import os as _os, sys as _sys\n"
        "_sys.argv = ['']\n"
        "_CP_BASELINE_MODULES = set(_sys.modules)\n"
        "_CP_BASELINE_PATH = list(_sys.path)\n"
    );
    PyGILState_Release(gil);
    return Py_IsInitialized() ? JNI_TRUE : JNI_FALSE;
}

/* 在专用线程里执行一段脚本文件（调用前无需持有 GIL，内部自管）
 * path       : 脚本绝对路径
 * workingDir : 用户工作目录（os.chdir 到此）
 * scriptDir  : 脚本所在目录（去重后 insert 进 sys.path，支持同目录 import）
 * args       : 命令行参数数组（Set 为 sys.argv[1:]，argv[0]=脚本路径） */
JNIEXPORT jstring JNICALL
Java_com_devterminal_engine_NativeBridge_execFile(
    JNIEnv *env, jobject thiz, jstring path, jstring workingDir,
    jstring scriptDir, jobjectArray args)
{
    (void)thiz;
    const char *p = (*env)->GetStringUTFChars(env, path, NULL);
    const char *wd = workingDir ? (*env)->GetStringUTFChars(env, workingDir, NULL) : NULL;
    const char *sd = scriptDir ? (*env)->GetStringUTFChars(env, scriptDir, NULL) : NULL;
    PyGILState_STATE gil = PyGILState_Ensure();
    jstring result = NULL;
    if (p) {
        FILE *fp = fopen(p, "r");
        if (!fp) {
            char buf[512];
            snprintf(buf, sizeof(buf), "无法打开文件：%s", p);
            result = cp_new_string(env, buf);
        } else {
            /* FILE 模式：保持用户代码的 __file__ / traceback 行号语义 */
            PyObject *globals = PyDict_New();
            PyObject *name = PyUnicode_FromString("__main__");
            PyDict_SetItemString(globals, "__name__", name);
            Py_DECREF(name);
            PyObject *builtins = PyImport_ImportModule("builtins");
            PyDict_SetItemString(globals, "__builtins__", builtins);
            Py_DECREF(builtins);

            /* P4-1：对齐 CPython 标准运行环境，注入模块元属性。
             * PyRun_FileExFlags 不会像 PyRun_SimpleFileObject 那样自动设置
             * __file__/__cached__/__loader__/__spec__——缺 __file__ 时，用户脚本里
             * os.path.dirname(__file__) / Path(__file__) 等高频写法会抛
             * NameError: name '__file__' is not defined，导致脚本"跑不起来"。 */
            {
                PyObject *fileAttr = PyUnicode_FromString(p);
                if (fileAttr) {
                    PyDict_SetItemString(globals, "__file__", fileAttr);
                    Py_DECREF(fileAttr);
                }
                PyDict_SetItemString(globals, "__cached__", Py_None);
                PyDict_SetItemString(globals, "__loader__", Py_None);
                PyDict_SetItemString(globals, "__spec__", Py_None);
            }

            /* P1-2/P2-5: 切工作目录；脚本目录先去重再 insert（避免跨脚本 import 串扰） */
            {
                char pre[PATH_MAX * 3];
                snprintf(pre, sizeof(pre),
                         "import os, sys\n"
                         "os.chdir('%s')\n"
                         "_sd = '%s'\n"
                         "if _sd in sys.path:\n"
                         "    sys.path.remove(_sd)\n"
                         "sys.path.insert(0, _sd)\n",
                         wd ? wd : "", sd ? sd : "");
                PyRun_String(pre, Py_file_input, globals, globals);
                if (PyErr_Occurred()) PyErr_Clear();
            }

            /* P1-2：用 C API 构造 sys.argv = [scriptPath, ...args]（避免字符串转义问题） */
            {
                jsize n = args ? (*env)->GetArrayLength(env, args) : 0;
                PyObject *argv = PyList_New(n + 1);
                if (argv) {
                    PyList_SetItem(argv, 0, PyUnicode_FromString(p));
                    for (jsize i = 0; i < n; i++) {
                        jstring je = (jstring)(*env)->GetObjectArrayElement(env, args, i);
                        const char *arg = je ? (*env)->GetStringUTFChars(env, je, NULL) : "";
                        PyList_SetItem(argv, i + 1, PyUnicode_FromString(arg ? arg : ""));
                        if (je) {
                            if (arg) (*env)->ReleaseStringUTFChars(env, je, arg);
                            (*env)->DeleteLocalRef(env, je);
                        }
                    }
                    PyObject *sysmod = PyImport_ImportModule("sys");
                    if (sysmod) {
                        PyObject_SetAttrString(sysmod, "argv", argv);
                        Py_DECREF(sysmod);
                    } else {
                        PyErr_Clear();
                    }
                    Py_DECREF(argv);
                } else {
                    PyErr_Clear();
                }
            }

            PyObject *rv = PyRun_FileExFlags(fp, p, Py_file_input, globals, globals, 0, NULL);
            if (rv) {
                Py_DECREF(rv);
                /* P3-4: 成功路径后主动回收，避免长跑内存缓增 */
                PyRun_SimpleString("import gc; gc.collect()");
            } else {
                /* 取异常文本（含 traceback），交给 Kotlin 侧展示 */
                PyObject *ptype, *pvalue, *ptb;
                PyErr_Fetch(&ptype, &pvalue, &ptb);
                PyErr_NormalizeException(&ptype, &pvalue, &ptb);
                PyObject *str = cp_format_exception(ptype, pvalue, ptb);
                if (!str) str = PyObject_Str(pvalue); /* 兜底：至少给出异常消息 */
                const char *msg = str ? PyUnicode_AsUTF8(str) : "Unknown error";
                result = cp_new_string(env, msg ? msg : "Unknown error");
                Py_XDECREF(str);
                Py_XDECREF(ptype); Py_XDECREF(pvalue); Py_XDECREF(ptb);
            }
            cp_reset_after_run();
            Py_DECREF(globals);
            fclose(fp);
        }
        (*env)->ReleaseStringUTFChars(env, path, p);
        if (wd) (*env)->ReleaseStringUTFChars(env, workingDir, wd);
        if (sd) (*env)->ReleaseStringUTFChars(env, scriptDir, sd);
    }
    PyGILState_Release(gil);
    return result;  /* NULL = 执行成功；非 NULL = 错误消息 */
}

/* 请求中断：Py_AddPendingCall 在解释器字节码检查点抛 KeyboardInterrupt。
 * P0-2: 不拿 GIL——若用户代码正阻塞在 input()（持 GIL），PyGILState_Ensure
 *       会让 stop() 永远等不到 GIL，pushEof() 也执行不到，形成死锁。
 *       Py_AddPendingCall 本身线程安全、可在无 GIL 下调用。 */
JNIEXPORT void JNICALL
Java_com_devterminal_engine_NativeBridge_requestInterrupt(JNIEnv *env, jobject thiz)
{
    (void)env; (void)thiz;
    Py_AddPendingCall(interrupt_callback, NULL);
}

/* 关闭解释器 */
JNIEXPORT void JNICALL
Java_com_devterminal_engine_NativeBridge_shutdown(JNIEnv *env, jobject thiz)
{
    (void)env; (void)thiz;
    if (Py_IsInitialized()) {
        /* Py_FinalizeEx 会销毁当前 thread state；之后不能再 PyGILState_Release，
         * 否则会访问已释放的 thread state。这里只 Ensure 拿 GIL，让 Finalize 自己收尾。 */
        PyGILState_Ensure();
        Py_FinalizeEx();
        /* 允许同一进程内重建解释器：inittab 只对下一次 Py_Initialize 生效，
         * 若这里不复位，release 后重新 prepare 会因 dtbridge 未注册而初始化失败。 */
        g_dtbridge_registered = 0;
    }
}
