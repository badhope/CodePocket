package com.devterminal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.devterminal.engine.CrashLogger
import com.devterminal.ui.EditorScreen
import com.devterminal.ui.EditorViewModel
import com.devterminal.ui.theme.CodePocketTheme

class MainActivity : ComponentActivity() {

    private val viewModel: EditorViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // 启动屏：在 super.onCreate 之前安装，图标在深色背景上展示
        installSplashScreen()
        // 沉浸到状态栏/导航栏：顶栏与编辑器连成一片，视觉更完整
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // 开启全局崩溃捕获，崩溃堆栈写入 App 私有目录便于排查（内部已做幂等）
        CrashLogger.install(this)

        setContent {
            // 主题跟随用户设置（跟随系统/浅色/深色），设置页可实时切换
            val ui by viewModel.ui.collectAsStateWithLifecycle()
            CodePocketTheme(themeMode = ui.settings.themeMode) {
                // safeDrawingPadding：edge-to-edge 下吃掉系统栏与软键盘(IME) inset，
                // 软键盘弹出时整屏内容随之上推，输入框/编辑器不被遮挡。
                Surface(
                    modifier = Modifier.fillMaxSize().safeDrawingPadding(),
                    color = androidx.compose.material3.MaterialTheme.colorScheme.background
                ) {
                    EditorScreen(viewModel)
                }
            }
        }
    }
}
