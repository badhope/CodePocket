package com.devterminal.ui

import androidx.compose.foundation.layout.Arrangement
import android.content.ClipData
import android.content.ClipboardManager
import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.NoteAdd
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.devterminal.BuildConfig
import com.devterminal.project.Templates
import com.devterminal.model.ProviderPresets
import com.devterminal.settings.AppSettings
import com.devterminal.settings.ThemeModes
import com.devterminal.engine.CrashLogger
import com.devterminal.engine.EnvReport
import com.devterminal.engine.EnvDiagnostics
import com.devterminal.ui.components.Hairline
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietSwitchRow
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.components.StatusDot
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.hairline
import com.devterminal.ui.theme.muted
import java.io.File
import kotlin.math.roundToInt

/*
 * 所有对话框集中在这里，主界面只负责调度。
 *
 * 统一规则：
 *  - 用 QuietDialog（26dp 圆角、左对齐标题、右对齐按钮），不再各自为政；
 *  - 分区用 SectionLabel + 留白，不再画分割线；
 *  - 危险操作（删除）必须先点一次再确认，且用 error 色但不加背景块。
 */

/** 设置页 */
@Composable
fun SettingsDialog(
    settings: AppSettings,
    onThemeModeChange: (String) -> Unit,
    onFontSizeChange: (Int) -> Unit,
    onAutoSaveChange: (Boolean) -> Unit,
    onTimeoutChange: (Int) -> Unit,
    onEditorThemeChange: (String) -> Unit,
    onWordWrapChange: (Boolean) -> Unit,
    onAutoCloseChange: (Boolean) -> Unit,
    onShowLineNumbersChange: (Boolean) -> Unit,
    onAiConfigChange: (url: String, key: String, model: String) -> Unit,
    onMcpConfigChange: (enabled: Boolean, endpoint: String) -> Unit,
    onPluginsEnabledChange: (Boolean) -> Unit,
    onAgentPlanFirstChange: (Boolean) -> Unit,
    onDismiss: () -> Unit,
    onOpenLocalModels: () -> Unit = {},
) {
    val cs = MaterialTheme.colorScheme
    var aiUrl by remember { mutableStateOf(settings.aiBaseUrl) }
    var aiKey by remember { mutableStateOf(settings.aiApiKey) }
    var aiModel by remember { mutableStateOf(settings.aiModel) }
    var mcpEnabled by remember { mutableStateOf(settings.mcpEnabled) }
    var mcpEndpoint by remember { mutableStateOf(settings.mcpEndpoint) }

    QuietDialog(onDismiss = onDismiss, title = "设置") {
        Spacer(Modifier.height(Dimens.xs))
        SectionLabel("主题外观")
        Spacer(Modifier.height(6.dp))
        Text(
            "「跟随系统」随手机系统深浅自动切换，其余为固定配色。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.sm))
        // 三态选择器：跟随系统 / 浅色 / 深色，与下方「编辑器主题」同款 chip 样式
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Dimens.sm)
        ) {
            ThemeModes.ALL.forEach { mode ->
                val selected = settings.themeMode == mode
                Surface(
                    onClick = { onThemeModeChange(mode) },
                    shape = RoundedCornerShape(10.dp),
                    color = if (selected) cs.primary.copy(alpha = 0.14f) else cs.surfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        ThemeModes.label(mode),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (selected) cs.primary else cs.muted,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp)
                    )
                }
            }
        }

        Spacer(Modifier.height(Dimens.md))
        QuietSwitchRow(
            label = "切换文件时自动保存",
            hint = "避免忘记保存导致改动丢失",
            checked = settings.autoSave,
            onChange = onAutoSaveChange
        )

        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("编辑器字号 · ${settings.editorFontSize} sp")
        Slider(
            value = settings.editorFontSize.toFloat(),
            onValueChange = { onFontSizeChange(it.roundToInt()) },
            valueRange = 10f..24f,
            steps = 13,
            colors = SliderDefaults.colors(
                activeTrackColor = cs.primary,
                inactiveTrackColor = cs.hairline,
                thumbColor = cs.primary
            )
        )

        Spacer(Modifier.height(Dimens.lg))
        SectionLabel("运行超时 · ${settings.timeoutSeconds} 秒")
        Slider(
            value = settings.timeoutSeconds.toFloat(),
            onValueChange = { onTimeoutChange(it.roundToInt()) },
            valueRange = 10f..600f,
            steps = 58,
            colors = SliderDefaults.colors(
                activeTrackColor = cs.primary,
                inactiveTrackColor = cs.hairline,
                thumbColor = cs.primary
            )
        )
        Text(
            "超时后进程会被强制结束，防止死循环耗尽电量。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )

        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("编辑器主题")
        Spacer(Modifier.height(6.dp))
        Text(
            "「跟随明暗」随系统深浅自动切换，其余为固定配色。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.sm))
        // 两列 chips：一行放不下 7 个选项，竖排又太占高
        EDITOR_THEMES.chunked(2).forEach { rowThemes ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Dimens.sm)
            ) {
                rowThemes.forEach { theme ->
                    val selected = settings.editorTheme == theme
                    Surface(
                        onClick = { onEditorThemeChange(theme) },
                        shape = RoundedCornerShape(10.dp),
                        color = if (selected) cs.primary.copy(alpha = 0.14f) else cs.surfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            when (theme) {
                                "auto" -> "跟随明暗"
                                "darcula" -> "Darcula"
                                "monokai" -> "Monokai"
                                "tomorrow-night-blue" -> "明日蓝"
                                "solarized-dark" -> "Solarized 暗"
                                "solarized-light" -> "Solarized 亮"
                                else -> theme
                            },
                            style = MaterialTheme.typography.labelMedium,
                            color = if (selected) cs.primary else cs.muted,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp)
                        )
                    }
                }
                // 最后一行可能只有 1 个，补一个空位保持对齐
                if (rowThemes.size == 1) Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(Dimens.sm))
        }

        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "自动换行",
            hint = "长行折到下一行，不超出屏幕宽度",
            checked = settings.wordWrap,
            onChange = onWordWrapChange
        )

        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "自动闭合括号",
            hint = "输入 ( [ { \" ' 时自动补全闭合符号",
            checked = settings.autoCloseBrackets,
            onChange = onAutoCloseChange
        )

        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "行号",
            hint = "编辑器左侧显示行号",
            checked = settings.showLineNumbers,
            onChange = onShowLineNumbersChange
        )

        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("AI 助手（可选）")
        Spacer(Modifier.height(6.dp))
        Text(
            "填写你自己的 OpenAI 兼容端点与密钥（BYOK）。默认值为占位示例，需改成实际可用的地址；不配置不影响其他功能。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.sm))
        Text(
            "常用预设（只带端点和模型名，密钥仍需自己填）",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted,
        )
        ProviderPresets.all.chunked(3).forEach { rowPresets ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Dimens.xs),
            ) {
                rowPresets.forEach { preset ->
                    TextButton(
                        onClick = {
                            aiUrl = preset.baseUrl
                            aiModel = preset.model
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            preset.label,
                            style = MaterialTheme.typography.labelSmall,
                            maxLines = 1,
                            color = cs.primary,
                        )
                    }
                }
                repeat(3 - rowPresets.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = aiUrl,
            onValueChange = { aiUrl = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "端点 URL（OpenAI 兼容，/v1 结尾）"
        )
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = aiModel,
            onValueChange = { aiModel = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "模型名"
        )
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = aiKey,
            onValueChange = { aiKey = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "API Key（本地端点可留空）",
            keyboardType = KeyboardType.Password,
            visualTransformation = PasswordVisualTransformation()
        )
        if (settings.encryptionFallback) {
            Spacer(Modifier.height(Dimens.sm))
            Text(
                "⚠️ 当前设备 Keystore 不可用，API Key 与 Git Token 只能以明文保存在应用私有目录。" +
                    "请勿在共用设备上保存密钥；修复系统安全组件后重新保存即可恢复加密。",
                style = MaterialTheme.typography.labelSmall,
                color = cs.error
            )
        }
        Spacer(Modifier.height(Dimens.sm))
        TextButton(
            onClick = { onAiConfigChange(aiUrl.trim(), aiKey.trim(), aiModel.trim()) },
            enabled = aiUrl.isNotBlank()
        ) {
            Text("保存 AI 配置", style = MaterialTheme.typography.labelLarge,
                color = if (aiUrl.isNotBlank()) cs.primary else cs.faint)
        }
        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "Agent 先计划后执行",
            hint = "开启后先列出步骤，等你批准再改文件；对标 Cursor / Claude Code 的 Plan 模式",
            checked = settings.agentPlanFirst,
            onChange = onAgentPlanFirstChange,
        )
        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("本地模型")
        Spacer(Modifier.height(6.dp))
        Text(
            "下载 MiniCPM5-1B / 2B 后，Agent 可完全离线运行，不再发网络请求。模型权重不打包进 APK。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.sm))
        TextButton(onClick = onOpenLocalModels) { Text("打开本地模型管理") }

        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("MCP / 项目插件")
        Spacer(Modifier.height(6.dp))
        QuietSwitchRow(
            label = "启用 MCP 工具",
            hint = "连接 Streamable HTTP MCP 服务，只读工具自动执行，带副作用工具仍需审批",
            checked = mcpEnabled,
            onChange = { mcpEnabled = it },
        )
        QuietTextField(
            value = mcpEndpoint,
            onValueChange = { mcpEndpoint = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "https://example.com/mcp",
            mono = true,
        )
        Text(
            "端点可能包含 token，已存入加密偏好；留空则不连接。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted,
        )
        TextButton(
            onClick = { onMcpConfigChange(mcpEnabled, mcpEndpoint.trim()) },
            enabled = mcpEndpoint.isBlank() || mcpEndpoint.startsWith("http"),
        ) { Text("保存 MCP 配置") }
        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "启用项目 JS 插件",
            hint = "执行 .codepocket/plugins 下的 run(input)，沙箱禁止 Java/文件/网络访问",
            checked = settings.pluginsEnabled,
            onChange = onPluginsEnabledChange,
        )
    }
}

/** 新手引导：第一次打开 App 时最缺的不是功能，而是「我现在该点哪」。 */
@Composable
fun OnboardingDialog(
    onDismiss: () -> Unit,
    onNewProject: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    QuietDialog(
        onDismiss = onDismiss,
        title = "先花 1 分钟看懂 CodePocket",
        confirmLabel = "新建项目",
        onConfirm = onNewProject,
        dismissLabel = "先自己逛逛",
    ) {
        Text(
            "CodePocket 是装进口袋的离线代码工作台：编辑、运行、Git、AI/Agent 都在本机完成，不需要云端 IDE。",
            style = MaterialTheme.typography.bodySmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.lg))

        SectionLabel("三步开始")
        Spacer(Modifier.height(6.dp))
        GuideStep("1", "新建项目", "点「新建项目」选 Python / JavaScript / Lua 模板；已有代码用「导入」。")
        GuideStep("2", "打开并运行", "左侧文件树点文件，顶栏 ▶ 运行，底部面板看输出。Python 是原生 CPython，JS 是 Rhino，Lua 是 LuaJ。")
        GuideStep("3", "想用 AI / Agent", "设置里填 OpenAI 兼容端点（BYOK），或下载本地模型；Agent 读写文件前会等你批准。")

        Spacer(Modifier.height(Dimens.lg))
        SectionLabel("界面在哪")
        Spacer(Modifier.height(6.dp))
        Text(
            "左上角菜单 = 文件树 / 项目 / Git / 自检；顶栏 = 保存 / 命令面板 / 运行；底部 = 输出与输入。",
            style = MaterialTheme.typography.bodySmall,
            color = cs.muted
        )

        Spacer(Modifier.height(Dimens.lg))
        SectionLabel("如果一运行就退出")
        Spacer(Modifier.height(6.dp))
        Text(
            "先点底部「自检」→「重新检测」。如果仍报解释器 / JNI / C 扩展缺失，说明 APK 的原生库没有解压：卸载旧版，安装最新 APK；还不行就到「关于」复制崩溃日志。",
            style = MaterialTheme.typography.bodySmall,
            color = cs.muted
        )
    }
}

@Composable
private fun GuideStep(number: String, title: String, body: String) {
    val cs = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.Top) {
        Text(
            number,
            style = MaterialTheme.typography.labelMedium,
            color = cs.primary,
            modifier = Modifier.width(22.dp)
        )
        Column {
            Text(title, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
            Text(body, style = MaterialTheme.typography.labelSmall, color = cs.muted)
        }
    }
}

/** 关于页：版本与开源许可 */
@Composable
fun AboutDialog(onDismiss: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val context = LocalContext.current
    var crashLog by remember { mutableStateOf(CrashLogger.readAll(context)) }
    QuietDialog(onDismiss = onDismiss, title = "关于") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Terminal, null, tint = cs.primary, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(Dimens.sm))
            Column {
                Text("CodePocket", style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold)
                MonoText("版本 ${BuildConfig.VERSION_NAME}", color = cs.muted, fontSize = 10)
            }
        }
        Spacer(Modifier.height(Dimens.md))
        Text(
            "完全离线的安卓多语言 IDE。Python 由原生 CPython 执行，" +
                "JavaScript 由 Rhino、Lua 由 LuaJ 执行；另有 17 种语言支持编辑、语法高亮与补全。",
            style = MaterialTheme.typography.bodySmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.xl))
        SectionLabel("开源许可")
        Spacer(Modifier.height(Dimens.sm))
        listOf(
            "SoraEditor — LGPL-2.1（代码编辑器）",
            "Python 3.13 — PSF License",
            "Rhino — MPL-2.0（JavaScript 运行时）",
            "LuaJ — MIT（Lua 运行时）",
            "Jetpack Compose — Apache-2.0",
            "AndroidX — Apache-2.0"
        ).forEach {
            MonoText("· $it", color = cs.muted, fontSize = 10,
                modifier = Modifier.padding(vertical = 2.dp))
        }
        Spacer(Modifier.height(Dimens.md))
        Text(
            "Python 能力由原生 CPython 3.13.9 提供，遵循 PSF 许可；" +
                "SoraEditor 以 LGPL 授权，用户可自行替换该库。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.faint
        )
        if (crashLog.isNotBlank()) {
            Spacer(Modifier.height(Dimens.xl))
            SectionLabel("最近崩溃日志")
            Spacer(Modifier.height(Dimens.sm))
            MonoText(crashLog.takeLast(900), color = cs.muted, fontSize = 9)
            Row(horizontalArrangement = Arrangement.spacedBy(Dimens.sm)) {
                TextButton(onClick = {
                    context.getSystemService(ClipboardManager::class.java)
                        ?.setPrimaryClip(ClipData.newPlainText("CodePocket crash", crashLog))
                }) { Text("复制日志", style = MaterialTheme.typography.labelMedium) }
                TextButton(onClick = {
                    CrashLogger.clear(context)
                    crashLog = ""
                }) { Text("清空", style = MaterialTheme.typography.labelMedium, color = cs.error) }
            }
        }
    }
}

/** 运行配置：只保留命令行参数；语言差异由 LanguageRegistry 处理 */
@Composable
fun RunConfigDialog(
    args: String,
    onArgsChange: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    QuietDialog(onDismiss = onDismiss, title = "运行配置") {
        SectionLabel("命令行参数")
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = args,
            onValueChange = onArgsChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = "如: --name \"hello world\" -v"
        )
        Spacer(Modifier.height(Dimens.md))
        Text(
            "参数按空格切分，含空格的参数用双引号包起来。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
    }
}

/** 环境自检结果对话框：展示每个工具是否可用 */
@Composable
fun DiagnosticsDialog(
    diagnostics: EnvReport?,
    onRefresh: () -> Unit,
    onDismiss: () -> Unit,
    onOpenGuide: () -> Unit = {}
) {
    val cs = MaterialTheme.colorScheme
    QuietDialog(
        onDismiss = onDismiss,
        title = "离线环境自检",
        confirmLabel = "重新检测",
        onConfirm = onRefresh
    ) {
        if (diagnostics == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = cs.primary)
                Spacer(Modifier.width(Dimens.sm))
                Text("检测中…", style = MaterialTheme.typography.bodySmall, color = cs.muted)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val allOk = diagnostics.allCriticalAvailable
                StatusDot(if (allOk) cs.primary else cs.error)
                Spacer(Modifier.width(Dimens.sm))
                Text(
                    when {
                        allOk -> "工具链已安装"
                        !diagnostics.prefixReady -> "工具链缺失"
                        else -> "工具链已安装 · 部分能力缺失"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            Spacer(Modifier.height(6.dp))
            MonoText(
                "占用空间：" + EnvDiagnostics.formatSize(diagnostics.installedSizeBytes),
                color = cs.muted, fontSize = 11
            )
            Spacer(Modifier.height(Dimens.md))
            diagnostics.tools.forEach { t ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        if (t.available) Icons.Filled.CheckCircle else Icons.Outlined.Cancel,
                        null,
                        tint = if (t.available) cs.primary else cs.error,
                        modifier = Modifier
                            .size(14.dp)
                            .padding(top = 3.dp)
                    )
                    Spacer(Modifier.width(Dimens.sm))
                    Column {
                        Text(t.name, style = MaterialTheme.typography.bodySmall)
                        MonoText(t.detail, color = cs.faint, fontSize = 10)
                    }
                }
            }
            if (!diagnostics.allCriticalAvailable) {
                Spacer(Modifier.height(Dimens.md))
                Text(
                    "如果是刚安装的 APK，先点「重新检测」；仍缺失就卸载旧版、安装最新 APK，再到「指南」按步骤排查。",
                    style = MaterialTheme.typography.labelSmall,
                    color = cs.muted
                )
                TextButton(onClick = onOpenGuide) {
                    Text("查看使用指南", style = MaterialTheme.typography.labelMedium, color = cs.primary)
                }
            }
        }
    }
}

/** 新建项目：模板列表 */
@Composable
fun NewProjectDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    val cs = MaterialTheme.colorScheme
    QuietDialog(onDismiss = onDismiss, title = "新建项目") {
        Templates.all.forEach { tpl ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onCreate(tpl.id) }
                    .padding(horizontal = 6.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Outlined.Code, null, tint = cs.primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Dimens.md))
                Column {
                    Text(tpl.title, style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium)
                    Text(tpl.description, style = MaterialTheme.typography.labelSmall,
                        color = cs.muted)
                }
            }
        }
    }
}

/** 从 Git 远程克隆：URL 可内嵌 https token，token 不落盘。 */
@Composable
fun CloneProjectDialog(onDismiss: () -> Unit, onClone: (String, String) -> Unit) {
    val cs = MaterialTheme.colorScheme
    var url by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    QuietDialog(
        onDismiss = onDismiss,
        title = "从 Git 克隆",
        confirmLabel = if (url.isNotBlank()) "克隆" else null,
        onConfirm = if (url.isNotBlank()) { { onClone(url.trim(), name.trim()) } } else null
    ) {
        QuietTextField(
            value = url,
            onValueChange = { url = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "https://github.com/user/repo.git"
        )
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = name,
            onValueChange = { name = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "项目名（留空用仓库名）"
        )
        Spacer(Modifier.height(Dimens.md))
        Text(
            "只支持 https 远程。如需认证，在地址里填写用户名与访问令牌即可。" +
                "令牌只用于本次克隆，不写入项目配置；克隆在后台进行，大仓库请耐心等待。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
    }
}

/** 文件操作：重命名 / 删除（删除需二次确认） */
@Composable
fun FileActionDialog(
    target: File,
    onRename: (String) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    var name by remember { mutableStateOf(target.name) }
    var confirmDelete by remember { mutableStateOf(false) }

    QuietDialog(
        onDismiss = onDismiss,
        title = target.name,
        confirmLabel = if (name.isNotBlank() && name != target.name) "重命名" else null,
        onConfirm = if (name.isNotBlank() && name != target.name) {
            { onRename(name) }
        } else null
    ) {
        SectionLabel("重命名")
        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = name,
            onValueChange = { name = it },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(Dimens.lg))
        Hairline()
        Spacer(Modifier.height(Dimens.md))
        if (confirmDelete) {
            Text(
                "确认删除？此操作不可恢复（目录会连同内容一起删除）。",
                style = MaterialTheme.typography.bodySmall,
                color = cs.error
            )
            Spacer(Modifier.height(Dimens.sm))
            TextButton(onClick = onDelete) {
                Text("确认删除", style = MaterialTheme.typography.labelLarge, color = cs.error)
            }
        } else {
            TextButton(onClick = { confirmDelete = true }) {
                Text("删除此文件", style = MaterialTheme.typography.labelLarge, color = cs.error)
            }
        }
    }
}

/** 新建文件 / 文件夹共用的命名输入；两个入口只差标题、占位符和提示。 */
@Composable
fun NameInputDialog(
    title: String,
    placeholder: String,
    hint: String? = null,
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    QuietDialog(
        onDismiss = onDismiss,
        title = title,
        confirmLabel = if (name.isNotBlank()) "创建" else null,
        onConfirm = if (name.isNotBlank()) { { onCreate(name.trim()) } } else null
    ) {
        QuietTextField(
            value = name,
            onValueChange = { name = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder
        )
        if (hint != null) {
            Spacer(Modifier.height(Dimens.sm))
            Text(
                hint,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.muted
            )
        }
    }
}

/** 新建文件：输入文件名 */
@Composable
fun NewFileDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    NameInputDialog(
        title = "新建文件",
        placeholder = "如: main.py / app.js / main.lua",
        hint = "文件创建在当前项目根目录，创建后自动打开。",
        onDismiss = onDismiss,
        onCreate = onCreate
    )
}

/** 新建文件夹：输入文件夹名 */
@Composable
fun NewFolderDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    NameInputDialog(
        title = "新建文件夹",
        placeholder = "如: utils",
        onDismiss = onDismiss,
        onCreate = onCreate
    )
}

/** 切换项目：列出所有已有项目，点一个就切过去；底部可新建项目 */
@Composable
@OptIn(ExperimentalFoundationApi::class)
fun SwitchProjectDialog(
    projects: List<java.io.File>,
    currentPath: String?,
    onSelect: (java.io.File) -> Unit,
    onNewProject: () -> Unit,
    onCloneProject: () -> Unit,
    onImportZip: () -> Unit,
    onExportZip: () -> Unit,
    onDelete: (java.io.File) -> Unit,
    onDismiss: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    // P2-8：长按删项目先二次确认，避免误删整目录
    var confirmDelete by remember { mutableStateOf<java.io.File?>(null) }
    QuietDialog(onDismiss = onDismiss, title = "项目") {
        if (projects.isEmpty()) {
            QuietHint("还没有项目。")
        } else {
            projects.forEach { p ->
                val isCurrent = p.absolutePath == currentPath
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .combinedClickable(
                            onClick = { onSelect(p) },
                            onLongClick = { if (!isCurrent) confirmDelete = p }
                        )
                        .padding(horizontal = 6.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Outlined.Folder, null,
                        tint = if (isCurrent) cs.primary else cs.muted,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(Dimens.md))
                    Column(Modifier.weight(1f)) {
                        Text(p.name, style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal)
                        if (isCurrent) {
                            Text("当前项目", style = MaterialTheme.typography.labelSmall,
                                color = cs.primary)
                        }
                    }
                    if (isCurrent) StatusDot(cs.primary)
                }
            }
        }
        Spacer(Modifier.height(Dimens.md))
        Hairline()
        Spacer(Modifier.height(Dimens.sm))
        TextButton(onClick = onNewProject) {
            Icon(Icons.Filled.Add, null, tint = cs.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("新建项目", style = MaterialTheme.typography.labelLarge, color = cs.primary)
        }
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Dimens.xs)
        ) {
            TextButton(onClick = onCloneProject) {
                Icon(Icons.Outlined.CloudDownload, null, tint = cs.muted,
                    modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("从 Git 克隆", style = MaterialTheme.typography.labelMedium, color = cs.muted)
            }
            TextButton(onClick = onImportZip) {
                Icon(Icons.Outlined.Folder, null, tint = cs.muted,
                    modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("导入 ZIP", style = MaterialTheme.typography.labelMedium, color = cs.muted)
            }
            if (currentPath != null) {
                TextButton(onClick = onExportZip) {
                    Icon(Icons.Outlined.Folder, null, tint = cs.muted,
                        modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("导出当前项目", style = MaterialTheme.typography.labelMedium, color = cs.muted)
                }
            }
        }
    }

    // P2-8：删除确认弹层（覆盖在项目列表之上）
    confirmDelete?.let { target ->
        QuietDialog(
            onDismiss = { confirmDelete = null },
            title = "删除项目",
            confirmLabel = "删除",
            onConfirm = { onDelete(target); confirmDelete = null }
        ) {
            Text(
                "确定删除项目「${target.name}」？其下所有文件将被永久删除，此操作不可恢复。",
                style = MaterialTheme.typography.bodySmall,
                color = cs.muted
            )
        }
    }
}

/** 跳转到行：输入行号 */
@Composable
fun GotoLineDialog(onDismiss: () -> Unit, onGo: (Int) -> Unit) {
    var text by remember { mutableStateOf("") }
    QuietDialog(
        onDismiss = onDismiss,
        title = "跳转到行",
        confirmLabel = if (text.toIntOrNull() != null) "跳转" else null,
        onConfirm = text.toIntOrNull()?.let { { onGo(it) } }
    ) {
        QuietTextField(
            value = text,
            onValueChange = { text = it.filter { c -> c.isDigit() } },
            modifier = Modifier.fillMaxWidth(),
            placeholder = "行号（如 12）"
        )
    }
}

/** 离线包管理：展示原生引擎内置能力（C 扩展 + site-packages），支持导入纯 Python 包（.zip） */
private data class BuiltinLibs(
    val extensions: List<String>,
    val purePackages: List<String>
)

private fun scanBuiltin(context: android.content.Context): BuiltinLibs {
    val extensions = runCatching {
        // C 扩展由 NativeEngine 从 APK 抽到标准库的 lib-dynload；
        // 文件名是 math.cpython-313-aarch64-linux-android.so，不能拿 lib 前缀去猜模块名。
        File(context.filesDir, "python-stdlib/lib/python3.13/lib-dynload").listFiles()
            ?.filter { it.isFile && it.name.endsWith(".so") && it.name.contains(".cpython-") }
            ?.map { it.name.substringBefore(".cpython-") }
            ?.filter { it.isNotBlank() }
            ?.sorted() ?: emptyList()
    }.getOrDefault(emptyList())
    val pure = runCatching {
        // 与引擎实际挂载路径一致（pybridge.c / NativeEngine）：
        // filesDir/python-stdlib/lib/python3.13/site-packages
        File(context.filesDir, "python-stdlib/lib/python3.13/site-packages").listFiles()
            ?.filter { it.isDirectory }?.map { it.name }?.sorted() ?: emptyList()
    }.getOrDefault(emptyList())
    return BuiltinLibs(extensions, pure)
}

/** 导入纯 Python 包：仅接受 .zip（内容不含 .so/.wasm/.dll/.pyd 及 pyodide 痕迹），
 *  解压到 site-packages（pybridge 初始化时已把该目录加入 sys.path）。 */
private fun importPurePythonPackage(context: android.content.Context, uri: Uri): Boolean {
    val tmp = File(context.cacheDir, "import_pkg.zip")
    context.contentResolver.openInputStream(uri)?.use { input ->
        tmp.outputStream().use { out -> input.copyTo(out) }
    } ?: return false
    val zf = runCatching { java.util.zip.ZipFile(tmp) }.getOrNull() ?: return false
    try {
        val it = zf.entries()
        while (it.hasMoreElements()) {
            val n = it.nextElement().name.lowercase()
            if (n.endsWith(".so") || n.endsWith(".wasm") || n.endsWith(".dll") ||
                n.endsWith(".pyd") || n.contains("pyodide")) return false
        }
        // 解压到引擎实际挂载的 site-packages 目录
        val dest = File(context.filesDir, "python-stdlib/lib/python3.13/site-packages").apply { mkdirs() }
        val eit = zf.entries()
        var totalBytes = 0L
        var entryCount = 0
        while (eit.hasMoreElements()) {
            val e = eit.nextElement()
            if (e.isDirectory) continue
            entryCount++
            if (entryCount > 5000) return false
            totalBytes += e.size.coerceAtLeast(0)
            if (totalBytes > 100L * 1024 * 1024) return false
            val relative = e.name.replace('\\', '/')
            if (relative.startsWith("/") || relative.contains("..")) return false
            val f = File(dest, relative)
            val root = dest.canonicalFile
            val rootPrefix = root.path + File.separator
            val target = f.canonicalFile.path
            if (target != root.path && !target.startsWith(rootPrefix)) return false
            f.parentFile?.mkdirs()
            zf.getInputStream(e).use { inp -> f.outputStream().use { out -> inp.copyTo(out) } }
        }
        tmp.delete()
        return true
    } finally {
        zf.close()
        tmp.delete()
    }
}

/** 离线包管理：列出内置能力，支持导入纯 Python 包 */
@Composable
fun PackagesDialog(
    context: android.content.Context,
    onToast: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    var refresh by remember { mutableStateOf(0) }
    val libs = remember(refresh) { scanBuiltin(context) }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val ok = runCatching { importPurePythonPackage(context, uri) }.getOrElse { false }
        onToast(if (ok) "已导入 site-packages（纯 Python 包，可直接 import）"
                    else "导入失败：仅支持纯 Python 包（.zip，内容不含 .so/.wasm）")
        refresh++
    }
    QuietDialog(onDismiss = onDismiss, title = "离线 Python 包") {
        Text(
            "以下能力随 APK 内置，代码里直接 import 即可，全程无需联网。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        if (libs.extensions.isNotEmpty()) {
            Spacer(Modifier.height(Dimens.md))
            Text("C 扩展（原生编译）", style = MaterialTheme.typography.labelMedium, color = cs.primary)
            libs.extensions.chunked(4).forEach { rowNames ->
                Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
                    rowNames.forEach { name ->
                        Row(Modifier.weight(1f)) {
                            Icon(Icons.Filled.CheckCircle, null, tint = cs.primary, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(name, style = MaterialTheme.typography.bodySmall, color = cs.muted)
                        }
                    }
                    repeat(4 - rowNames.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        if (libs.purePackages.isNotEmpty()) {
            Spacer(Modifier.height(Dimens.md))
            Text("已安装的纯 Python 包", style = MaterialTheme.typography.labelMedium, color = cs.primary)
            libs.purePackages.forEach { name ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                    Icon(Icons.Filled.CheckCircle, null, tint = cs.primary, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(name, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        Spacer(Modifier.height(Dimens.md))
        Hairline()
        Spacer(Modifier.height(Dimens.sm))
        Text(
            "标准库（math/random/json/socket/ctypes/ssl/sqlite3 等）内置于 python-stdlib.zip，无需安装。",
            style = MaterialTheme.typography.labelSmall,
            color = cs.muted
        )
        Spacer(Modifier.height(Dimens.sm))
        TextButton(onClick = { importLauncher.launch(arrayOf("application/zip", "application/octet-stream")) }) {
            Icon(Icons.Filled.NoteAdd, null, tint = cs.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("导入纯 Python 包（.zip）", style = MaterialTheme.typography.labelLarge, color = cs.primary)
        }
    }
}

/** 关闭自动保存后，切文件/关 Tab/切项目前的显式确认。 */
@Composable
fun UnsavedChangesDialog(
    pending: PendingNavigation,
    onSave: () -> Unit,
    onDiscard: () -> Unit,
    onCancel: () -> Unit,
) {
    val action = when (pending) {
        is PendingNavigation.OpenFile -> "打开「${pending.file.name}」"
        is PendingNavigation.CloseTab -> "关闭「${pending.file.name}」"
        is PendingNavigation.OpenProject -> "切换到项目「${pending.dir.name}」"
    }
    QuietDialog(
        onDismiss = onCancel,
        title = "有未保存的修改",
        confirmLabel = "保存并继续",
        onConfirm = onSave,
        dismissLabel = "取消",
    ) {
        Text("当前文件有未保存的修改。", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(Dimens.sm))
        Text(
            "继续$action 后，这些改动会丢失。",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.muted,
        )
        Spacer(Modifier.height(Dimens.md))
        TextButton(onClick = onDiscard) {
            Text(
                "不保存，直接继续",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
