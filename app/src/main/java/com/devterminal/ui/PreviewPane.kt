package com.devterminal.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.devterminal.ui.components.QuietIconButton
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted
import com.devterminal.ui.theme.warning
import java.io.File

/**
 * 实时预览面板（编辑器分屏的下半区）：Markdown / HTML 渲染结果。
 *
 * 为什么用独立 WebView：
 * 预览只需要渲染静态 Markdown / HTML，与执行引擎互不干扰，
 * 预览刷新不会打断正在运行的程序，各用各的最省心。
 *
 * 刷新策略：外层用 collectLatest + delay 做防抖，这里收到新 html 就整体重载。
 * loadDataWithBaseURL 的 baseURL 传 null——预览不需要相对路径解析能力，
 * 同时断掉页面反查 file:// 的可能。
 */
@Composable
fun PreviewPane(
    html: String,
    darkTheme: Boolean,
    truncated: Boolean = false,
    modifier: Modifier = Modifier
) {
    val cs = MaterialTheme.colorScheme
    val context = LocalContext.current
    // WebView 实例随面板存续，html 变化只走 loadData，不重建（重建会闪白屏）
    val webView = remember(context) {
        @SuppressLint("SetJavaScriptEnabled")
        WebView(context).apply {
            settings.javaScriptEnabled = false   // 静态渲染，不执行脚本
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            // 预览只允许内联 data: 内容；远程图片/CSS/iframe 一律不加载。
            // 否则 Markdown 里一个 ![](https://...) 就能把用户 IP 和打开时间发出去。
            settings.blockNetworkLoads = true
            settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            isVerticalScrollBarEnabled = true
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    val scheme = request.url.scheme.orEmpty().lowercase()
                    return if (scheme == "data" || scheme == "about") null else blockedResponse()
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    // 预览内不跳转，外部链接交给用户手动“浏览器打开”。
                    return true
                }
            }
        }
    }
    val bg = cs.surface.toArgb()

    // 离开预览分屏时销毁 WebView：否则其内核/渲染线程会随 Activity 泄漏
    DisposableEffect(webView) {
        onDispose { runCatching { webView.destroy() } }
    }

    Surface(color = cs.surface, modifier = modifier) {
        Column(Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .padding(start = Dimens.md, end = Dimens.md, top = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "实时预览",
                    style = MaterialTheme.typography.labelMedium,
                    color = cs.muted
                )
                Spacer(Modifier.weight(1f))
                QuietIconButton(
                    icon = Icons.Outlined.OpenInBrowser,
                    contentDescription = "在外部浏览器打开",
                    onClick = {
                        runCatching {
                            val dir = File(context.cacheDir, "shared").apply { mkdirs() }
                            val f = File(dir, "preview.html").apply { writeText(html) }
                            val uri: Uri = FileProvider.getUriForFile(
                                context, "${context.packageName}.fileprovider", f
                            )
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(uri, "text/html")
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(intent)
                        }
                    },
                    size = 18.dp
                )
            }
            if (truncated) {
                Text(
                    "预览仅显示前 512K 字符；编辑器原文未改动，完整内容请在浏览器打开。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.warning,
                    modifier = Modifier.padding(horizontal = Dimens.md, vertical = 4.dp)
                )
            }
            Spacer(Modifier.height(6.dp))
            AndroidView(
                factory = { view ->
                    webView.apply {
                        setBackgroundColor(bg)
                        loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
                    }
                },
                update = { view ->
                    view.setBackgroundColor(bg)
                    view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

/** 把预览里所有非 data/about 请求替换成空响应，彻底断网。 */
private fun blockedResponse(): WebResourceResponse =
    WebResourceResponse("text/plain", "utf-8", java.io.ByteArrayInputStream(ByteArray(0)))
