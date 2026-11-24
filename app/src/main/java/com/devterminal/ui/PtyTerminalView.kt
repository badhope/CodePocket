package com.devterminal.ui

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

/**
 * 真 PTY 的终端视图：WebView 内跑本地 xterm.js，PTY 原始字节经 base64 写入 xterm。
 *
 * xterm.js 是 MIT 许可的终端模拟器（assets/terminal/），负责 ANSI/VT 序列、
 * 光标定位、颜色、备用屏与全屏重绘；Kotlin 只做字节搬运和键盘回传。
 * 这比自研 VT100 解析器更可靠，也不引入网络依赖。
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PtyTerminalView(
    bytes: Flow<ByteArray>,
    onData: (String) -> Unit,
    onResize: (Int, Int) -> Unit,
    modifier: Modifier = Modifier,
    darkTheme: Boolean = true,
) {
    val context = LocalContext.current
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var ready by remember { mutableStateOf(false) }
    var webView by remember { mutableStateOf<WebView?>(null) }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = {
            WebView(context).apply {
                setBackgroundColor(Color.parseColor("#0b0e14"))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                settings.allowContentAccess = false
                settings.blockNetworkLoads = true
                settings.textZoom = 100
                webViewClient = object : WebViewClient() {
                    // 本地终端页不承载任何外链，任何跳转都拦掉，保证离线。
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean = true
                }
                addJavascriptInterface(
                    TerminalBridge(
                        dataCallback = onData,
                        resizeCallback = onResize,
                        readyCallback = { mainHandler.post { ready = true } },
                    ),
                    "Android",
                )
                loadUrl(
                    "file:///android_asset/terminal/index.html?dark=" + if (darkTheme) "1" else "0"
                )
                webView = this
            }
        },
    )

    // 页面 ready 后再收：SharedFlow 的 replay 缓存会把启动 banner / 首个提示符补上。
    LaunchedEffect(webView, ready) {
        val view = webView ?: return@LaunchedEffect
        if (!ready) return@LaunchedEffect
        runCatching { view.evaluateJavascript("window.termFocus()", null) }
        bytes.collect { data ->
            val b64 = withContext(Dispatchers.Default) {
                Base64.encodeToString(data, Base64.NO_WRAP)
            }
            withContext(Dispatchers.Main) {
                runCatching {
                    view.evaluateJavascript("window.termWriteB64('$b64')", null)
                }
            }
        }
    }

    LaunchedEffect(webView, ready, darkTheme) {
        if (ready) {
            runCatching {
                webView?.evaluateJavascript(
                    "window.termSetTheme(${if (darkTheme) "true" else "false"})",
                    null,
                )
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            ready = false
            webView?.apply {
                removeJavascriptInterface("Android")
                stopLoading()
                destroy()
            }
            webView = null
        }
    }
}

/** WebView JS 桥。方法名被 xterm 页面的 Android.onXxx 直接调用，R8 需保留。 */
@Keep
class TerminalBridge(
    private val dataCallback: (String) -> Unit,
    private val resizeCallback: (Int, Int) -> Unit,
    private val readyCallback: () -> Unit,
) {
    @JavascriptInterface
    fun onData(data: String) = dataCallback(data)

    @JavascriptInterface
    fun onResize(cols: Int, rows: Int) = resizeCallback(cols, rows)

    @JavascriptInterface
    fun onReady() = readyCallback()
}
