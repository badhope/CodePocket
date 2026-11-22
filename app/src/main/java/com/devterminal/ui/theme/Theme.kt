package com.devterminal.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.devterminal.settings.AppSettings
import com.devterminal.settings.ThemeModes
import com.devterminal.settings.resolvesDark

/*
 * 设计语言：Quiet（静谧）
 *
 * 三条准则：
 *  1. 留白代替分割线 —— 能用间距区分的，绝不画一条线。
 *  2. 层次靠明度，不靠色相 —— 全站只有一个强调色，其余都是中性灰阶，
 *     避免「每个按钮一种颜色」的廉价感。
 *  3. 圆角与字重承担质感 —— 大圆角 + 克制的字重阶梯，比描边和阴影更耐看。
 */

// ---------- 暗色：近黑冷调，文字用柔白而非纯白，长时间看代码不刺眼 ----------
private val QuietDark = darkColorScheme(
    primary = Color(0xFF8FA7F5),
    onPrimary = Color(0xFF101623),
    primaryContainer = Color(0xFF232C45),
    onPrimaryContainer = Color(0xFFCBD7FF),
    secondary = Color(0xFF6FD3C7),
    onSecondary = Color(0xFF0A2B27),
    secondaryContainer = Color(0xFF16332F),
    onSecondaryContainer = Color(0xFFB6EDE4),
    background = Color(0xFF0E1013),
    onBackground = Color(0xFFE7E9ED),
    surface = Color(0xFF15181D),
    onSurface = Color(0xFFE7E9ED),
    surfaceVariant = Color(0xFF1C2026),
    onSurfaceVariant = Color(0xFFA2AAB4),
    surfaceContainerHighest = Color(0xFF23272E),
    outline = Color(0xFF2A2F37),
    outlineVariant = Color(0xFF1E222A),
    scrim = Color(0xFF06070A),
    error = Color(0xFFF08A82),
    onError = Color(0xFF3A1512),
    errorContainer = Color(0xFF3A1B18),
    onErrorContainer = Color(0xFFFFD5D0)
    // 语义色 success/warning 通过文件末尾扩展属性提供（Material3 ColorScheme 无此构造参数）
)

// ---------- 浅色：暖白纸感，文字用墨黑而非纯黑 ----------
private val QuietLight = lightColorScheme(
    primary = Color(0xFF4A63D9),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE7EAFB),
    onPrimaryContainer = Color(0xFF2C3F8F),
    secondary = Color(0xFF2F8F86),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE2F1EF),
    onSecondaryContainer = Color(0xFF1C5B54),
    background = Color(0xFFFAF9F7),
    onBackground = Color(0xFF1B1F24),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1B1F24),
    surfaceVariant = Color(0xFFF1EFEB),
    onSurfaceVariant = Color(0xFF676E77),
    surfaceContainerHighest = Color(0xFFE9E6E1),
    outline = Color(0xFFE3E0DA),
    outlineVariant = Color(0xFFEDEBE6),
    scrim = Color(0xFF1B1F24),
    error = Color(0xFFB23B32),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFBE6E4),
    onErrorContainer = Color(0xFF7A211A)
    // 语义色 success/warning 通过文件末尾扩展属性提供
)

/** 大圆角：柔和、不锐利，是这套视觉的主要「性格」来源 */
private val QuietShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(18.dp),
    extraLarge = RoundedCornerShape(26.dp)
)

/** 字号整体收小一档，字重拉开层级；mono 用于一切代码相关文本 */
val MonoFamily = FontFamily.Monospace

private val QuietTypography = Typography(
    displaySmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 26.sp, letterSpacing = 0.sp),
    titleLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 19.sp, letterSpacing = 0.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 15.sp, letterSpacing = 0.sp),
    titleSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 13.sp, letterSpacing = 0.1.sp),
    bodyLarge = TextStyle(fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodyMedium = TextStyle(fontWeight = FontWeight.Normal, fontSize = 13.sp),
    bodySmall = TextStyle(fontWeight = FontWeight.Normal, fontSize = 12.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.Medium, fontSize = 13.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 10.5.sp, letterSpacing = 0.3.sp)
)

@Composable
fun CodePocketTheme(
    themeMode: String = ThemeModes.DARK,
    content: @Composable () -> Unit
) {
    // 三态解析：light 恒浅、dark 恒深、system 跟随系统
    val dark = when (themeMode) {
        ThemeModes.LIGHT -> false
        ThemeModes.DARK -> true
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(
        colorScheme = if (dark) QuietDark else QuietLight,
        shapes = QuietShapes,
        typography = QuietTypography,
        content = content
    )
}

/**
 * 把设置里的主题模式解析成「当前实际明暗」，供 Composable 层（编辑器/预览面板）使用。
 * 与 [resolvesDark] 的差别：system 分支在组合内读系统状态，切换系统深浅无需重启即生效。
 */
@Composable
fun AppSettings.effectiveDarkTheme(): Boolean = when (themeMode) {
    ThemeModes.LIGHT -> false
    ThemeModes.DARK -> true
    else -> isSystemInDarkTheme()
}

/** 统一间距：4dp 基准，避免各处随手写数字 */
object Dimens {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 22.dp
    val xxl = 30.dp
    /** 内容左右边距 */
    val gutter = 16.dp
    /** 可点击元素的最小触控尺寸 */
    val touch = 44.dp
}

/**
 * 发丝级分割线颜色：比 outline 更淡，用来「暗示」边界而不是强调边界。
 * 随明暗自动取色，调用方不用关心当前主题。
 */
val androidx.compose.material3.ColorScheme.hairline: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color(0x12000000) else Color(0x14FFFFFF)

/** 次级文字（说明、时间戳等），比 onSurfaceVariant 再退一档 */
val androidx.compose.material3.ColorScheme.muted: Color
    @Composable
    @ReadOnlyComposable
    get() = onSurface.copy(alpha = 0.58f)

/** 更弱的一档，用于占位/空态提示 */
val androidx.compose.material3.ColorScheme.faint: Color
    @Composable
    @ReadOnlyComposable
    get() = onSurface.copy(alpha = 0.38f)

/**
 * info：indigo 主色的浅变体，用于普通信息提示（介于 muted 与 primary 之间）。
 * M3 没有标准 info 角色，这里做成随明暗取色的扩展。
 */
val androidx.compose.material3.ColorScheme.info: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color(0xFF4A63D9) else Color(0xFF8FA7F5)

/**
 * success：teal 绿色，用于"已完成/成功"状态反馈，不参与主操作。
 * M3 无标准 success 角色，做成随明暗取色的扩展。
 */
val androidx.compose.material3.ColorScheme.success: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color(0xFF0D9488) else Color(0xFF2DD4BF)

val androidx.compose.material3.ColorScheme.onSuccess: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color.White else Color(0xFF06251F)

/**
 * warning：amber 琥珀色，用于"警告/需注意"状态反馈。
 */
val androidx.compose.material3.ColorScheme.warning: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color(0xFFB45309) else Color(0xFFFBBF24)

val androidx.compose.material3.ColorScheme.onWarning: Color
    @Composable
    @ReadOnlyComposable
    get() = if (background.luminance() > 0.5f) Color.White else Color(0xFF2B1D02)
