/*
 * ptybridge.c —— Android 真 PTY 终端后端
 *
 * 只做一件事：用 forkpty 起一个交互式 shell，把 master fd 的字节流回传 Kotlin，
 * 把 Kotlin 的输入写回 master。Kotlin 侧负责 UTF-8 解码与行缓冲；这里不解析 ANSI。
 *
 * 约束：
 *  - 单例会话。同一时间只允许一个 PTY，避免多个 shell 抢同一个回调。
 *  - stop 只关闭 fd + 发 SIGHUP/SIGTERM，不 join 读线程；读线程自然退出并回收 child。
 *  - 回调对象用 NewGlobalRef 持有，读线程退出时释放；不要在 stop 里提前 Delete。
 */
#include <jni.h>
#include <android/log.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <pty.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

#define TAG "PtyBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static JavaVM *g_vm = NULL;
static pthread_mutex_t g_lock = PTHREAD_MUTEX_INITIALIZER;
static int g_master = -1;
static pid_t g_child = -1;
static jobject g_callback = NULL;
static jmethodID g_on_bytes = NULL;
static jmethodID g_on_exit = NULL;
static volatile int g_closing = 0;
static int g_thread_started = 0;

/*
 * fork 之后子进程只能调用 async-signal-safe 函数；setenv 会 malloc，
 * 多线程进程 fork 后可能卡在 malloc 锁上。这里在 fork 之前把 argv/envp
 * 全部构造好，子进程只做 chdir + execve。
 */
extern char **environ;

static int env_is_key(const char *entry, const char *key) {
    size_t n = strlen(key);
    return strncmp(entry, key, n) == 0 && entry[n] == '=';
}

static char **build_child_env(void) {
    int count = 0;
    while (environ && environ[count]) count++;
    char **envp = (char **)calloc((size_t)count + 3, sizeof(char *));
    if (!envp) return NULL;
    int out = 0;
    for (int i = 0; i < count; i++) {
        if (env_is_key(environ[i], "TERM") || env_is_key(environ[i], "PS1")) continue;
        envp[out] = strdup(environ[i]);
        if (!envp[out]) {
            for (int j = 0; j < out; j++) free(envp[j]);
            free(envp);
            return NULL;
        }
        out++;
    }
    envp[out++] = strdup("TERM=xterm-256color");
    envp[out++] = strdup("PS1=\\w $ ");
    envp[out] = NULL;
    if (!envp[out - 2] || !envp[out - 1]) {
        for (int j = 0; j < out; j++) free(envp[j]);
        free(envp);
        return NULL;
    }
    return envp;
}

static void free_child_env(char **envp) {
    if (!envp) return;
    for (int i = 0; envp[i]; i++) free(envp[i]);
    free(envp);
}

static char **build_child_argv(const char *shell) {
    char **argv = (char **)calloc(3, sizeof(char *));
    if (!argv) return NULL;
    argv[0] = strdup(shell);
    argv[1] = strdup("-i");
    argv[2] = NULL;
    if (!argv[0] || !argv[1]) {
        free(argv[0]);
        free(argv[1]);
        free(argv);
        return NULL;
    }
    return argv;
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    (void)reserved;
    g_vm = vm;
    return JNI_VERSION_1_6;
}

static void call_bytes(JNIEnv *env, const char *buf, int len) {
    jbyteArray arr = (*env)->NewByteArray(env, len);
    if (!arr) return;
    (*env)->SetByteArrayRegion(env, arr, 0, len, (const jbyte *)buf);
    (*env)->CallVoidMethod(env, g_callback, g_on_bytes, arr);
    // Kotlin 回调一旦抛异常，异常会挂在 native 线程上；不清理会让后续所有
    // JNI 调用（包括 on_exit）失败。终端已经出错时静默丢弃本次回调即可。
    if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
    (*env)->DeleteLocalRef(env, arr);
}

static void *reader_main(void *arg) {
    (void)arg;
    JNIEnv *env = NULL;
    if ((*g_vm)->AttachCurrentThread(g_vm, &env, NULL) != JNI_OK || !env) {
        LOGE("attach reader thread failed");
        return NULL;
    }

    char buf[4096];
    int fd;
    pid_t child;
    pthread_mutex_lock(&g_lock);
    fd = g_master;
    child = g_child;
    pthread_mutex_unlock(&g_lock);

    while (!g_closing && fd >= 0) {
        ssize_t n = read(fd, buf, sizeof(buf));
        if (n > 0) {
            if (g_callback && g_on_bytes) call_bytes(env, buf, (int)n);
            continue;
        }
        if (n == 0) break;
        if (errno == EINTR) continue;
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            usleep(5000);
            continue;
        }
        break;
    }

    int status = 0;
    if (child > 0) {
        // 子进程退出后 waitpid 立即返回；若 stop 先发信号，这里负责回收僵尸。
        waitpid(child, &status, 0);
    }
    int code = -1;
    if (WIFEXITED(status)) code = WEXITSTATUS(status);
    else if (WIFSIGNALED(status)) code = 128 + WTERMSIG(status);

    if (g_callback && g_on_exit) {
        (*env)->CallVoidMethod(env, g_callback, g_on_exit, code);
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
    }

    pthread_mutex_lock(&g_lock);
    if (g_master >= 0) {
        close(g_master);
        g_master = -1;
    }
    g_child = -1;
    g_thread_started = 0;
    if (g_callback) {
        (*env)->DeleteGlobalRef(env, g_callback);
        g_callback = NULL;
    }
    pthread_mutex_unlock(&g_lock);

    (*g_vm)->DetachCurrentThread(g_vm);
    return NULL;
}

JNIEXPORT jint JNICALL
Java_com_devterminal_engine_PtyBridge_nativeStart(
    JNIEnv *env, jobject thiz, jstring cwd, jstring shell,
    jint cols, jint rows, jobject callback) {
    (void)thiz;
    if (!callback) return -EINVAL;

    pthread_mutex_lock(&g_lock);
    if (g_master >= 0 || g_thread_started) {
        pthread_mutex_unlock(&g_lock);
        return -EBUSY;
    }

    const char *cwd_s = (*env)->GetStringUTFChars(env, cwd, NULL);
    const char *shell_s = (*env)->GetStringUTFChars(env, shell, NULL);
    const char *shell_path = shell_s ? shell_s : "/system/bin/sh";
    char **child_env = build_child_env();
    char **child_argv = build_child_argv(shell_path);
    if (!child_env || !child_argv) {
        LOGE("build child env/argv failed");
        free_child_env(child_env);
        free(child_argv);
        if (cwd_s) (*env)->ReleaseStringUTFChars(env, cwd, cwd_s);
        if (shell_s) (*env)->ReleaseStringUTFChars(env, shell, shell_s);
        pthread_mutex_unlock(&g_lock);
        return -ENOMEM;
    }
    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_col = (unsigned short)(cols > 0 ? cols : 80);
    ws.ws_row = (unsigned short)(rows > 0 ? rows : 24);

    int master = -1;
    pid_t pid = forkpty(&master, NULL, NULL, &ws);
    if (pid < 0) {
        int err = errno;
        LOGE("forkpty failed: %s", strerror(err));
        free_child_env(child_env);
        free(child_argv[0]);
        free(child_argv[1]);
        free(child_argv);
        if (cwd_s) (*env)->ReleaseStringUTFChars(env, cwd, cwd_s);
        if (shell_s) (*env)->ReleaseStringUTFChars(env, shell, shell_s);
        pthread_mutex_unlock(&g_lock);
        return -err;
    }

    if (pid == 0) {
        // 子进程：forkpty 已建立控制终端；这里只做 async-signal-safe 的
        // chdir + execve，环境变量在 fork 前已构造好，不再调用 setenv。
        if (cwd_s && chdir(cwd_s) != 0) _exit(127);
        execve(shell_path, child_argv, child_env);
        _exit(127);
    }

    // 父进程：子进程 fork 后拥有自己的地址空间，这里可以安全释放构造的数组。
    free_child_env(child_env);
    free(child_argv[0]);
    free(child_argv[1]);
    free(child_argv);

    // 父进程
    g_master = master;
    g_child = pid;
    g_closing = 0;
    g_callback = (*env)->NewGlobalRef(env, callback);
    jclass cls = (*env)->GetObjectClass(env, callback);
    g_on_bytes = (*env)->GetMethodID(env, cls, "onBytes", "([B)V");
    g_on_exit = (*env)->GetMethodID(env, cls, "onExit", "(I)V");
    (*env)->DeleteLocalRef(env, cls);
    if (!g_on_bytes || !g_on_exit) {
        LOGE("callback methods missing");
        kill(pid, SIGKILL);
        close(master);
        g_master = -1;
        g_child = -1;
        if (g_callback) (*env)->DeleteGlobalRef(env, g_callback);
        g_callback = NULL;
        if (cwd_s) (*env)->ReleaseStringUTFChars(env, cwd, cwd_s);
        if (shell_s) (*env)->ReleaseStringUTFChars(env, shell, shell_s);
        pthread_mutex_unlock(&g_lock);
        return -EINVAL;
    }

    pthread_t thread;
    if (pthread_create(&thread, NULL, reader_main, NULL) != 0) {
        LOGE("pthread_create failed");
        kill(pid, SIGKILL);
        close(master);
        g_master = -1;
        g_child = -1;
        if (g_callback) (*env)->DeleteGlobalRef(env, g_callback);
        g_callback = NULL;
        if (cwd_s) (*env)->ReleaseStringUTFChars(env, cwd, cwd_s);
        if (shell_s) (*env)->ReleaseStringUTFChars(env, shell, shell_s);
        pthread_mutex_unlock(&g_lock);
        return -EAGAIN;
    }
    pthread_detach(thread);
    g_thread_started = 1;

    if (cwd_s) (*env)->ReleaseStringUTFChars(env, cwd, cwd_s);
    if (shell_s) (*env)->ReleaseStringUTFChars(env, shell, shell_s);
    pthread_mutex_unlock(&g_lock);
    LOGI("pty started pid=%d fd=%d", (int)pid, master);
    return 0;
}

JNIEXPORT jint JNICALL
Java_com_devterminal_engine_PtyBridge_nativeWrite(
    JNIEnv *env, jobject thiz, jbyteArray data) {
    (void)thiz;
    if (!data) return -EINVAL;
    jsize len = (*env)->GetArrayLength(env, data);
    if (len <= 0) return 0;
    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) return -ENOMEM;

    pthread_mutex_lock(&g_lock);
    int fd = g_master;
    pthread_mutex_unlock(&g_lock);
    if (fd < 0) {
        (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
        return -EBADF;
    }

    int total = 0;
    while (total < len) {
        ssize_t n = write(fd, bytes + total, (size_t)(len - total));
        if (n > 0) { total += (int)n; continue; }
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            usleep(2000);
            continue;
        }
        total = n < 0 ? -errno : total;
        break;
    }
    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
    return total;
}

JNIEXPORT void JNICALL
Java_com_devterminal_engine_PtyBridge_nativeResize(
    JNIEnv *env, jobject thiz, jint cols, jint rows) {
    (void)env;
    (void)thiz;
    pthread_mutex_lock(&g_lock);
    int fd = g_master;
    pthread_mutex_unlock(&g_lock);
    if (fd < 0) return;
    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_col = (unsigned short)(cols > 0 ? cols : 80);
    ws.ws_row = (unsigned short)(rows > 0 ? rows : 24);
    ioctl(fd, TIOCSWINSZ, &ws);
}

JNIEXPORT void JNICALL
Java_com_devterminal_engine_PtyBridge_nativeStop(
    JNIEnv *env, jobject thiz) {
    (void)env;
    (void)thiz;
    pthread_mutex_lock(&g_lock);
    g_closing = 1;
    int fd = g_master;
    pid_t pid = g_child;
    g_master = -1;
    g_child = -1;
    pthread_mutex_unlock(&g_lock);

    if (fd >= 0) close(fd);
    if (pid > 0) {
        kill(pid, SIGHUP);
        usleep(10000);
        kill(pid, SIGTERM);
    }
    LOGI("pty stop requested");
}
