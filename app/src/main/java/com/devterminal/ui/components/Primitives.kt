package com.devterminal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxWithConstraintsScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.MonoFamily
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.hairline
import com.devterminal.ui.theme.muted

/**
 * 这套基础件的共同目标：**降低视觉噪音**。
 *
 * 具体做法：
 *  - 分割线用 1px 半透明「发丝线」而不是 Material 默认的分隔条；
 *  - 按钮去掉背景块与描边，只留图标 + 文字，靠留白建立节奏；
 *  - 输入框边框减淡，聚焦时才显现，未聚焦时几乎融进背景；
 *  - 对话框统一 26dp 圆角、左对齐标题、按钮组右对齐。
 */

/** 发丝分割线：只在必要时出现，颜色极淡 */
@Composable
fun Hairline(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.hairline
) {
    Box(modifier = modifier.fillMaxWidth().height(1.dp).background(color))
}

/** 分区小标题：字重 + 字间距建立层级，不加色块 */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.muted
    )
}

/** 空态 / 占位提示 */
@Composable
fun QuietHint(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.faint
    )
}

/** 等宽正文（代码、路径、命令一律用它） */
@Composable
fun MonoText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
    fontSize: Int = 12,
    fontWeight: FontWeight? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip
) {
    Text(
        text,
        modifier = modifier,
        fontFamily = MonoFamily,
        // 9/10sp 在 200% 系统字体缩放下仍可能过小；统一抬到 11sp 下限。
        fontSize = fontSize.coerceAtLeast(11).sp,
        fontWeight = fontWeight,
        color = color,
        maxLines = maxLines,
        overflow = overflow
    )
}

/**
 * 无背景的图标按钮：不抢视觉焦点。
 *
 * 触控尺寸说明：图标本身可以画得很小（22dp 视觉上够清晰），但**点击区域**必须够大。
 * 原先 contentPadding 为 8/6dp，加 22dp 图标总共才 38dp，低于 Material 与
 * Android 无障碍指南要求的 48dp —— 顶栏图标在单手持机时很容易点空或者点错邻居。
 * 这里用 [defaultMinSize] 把可点区撑到 48dp，同时保持图标视觉尺寸不变：
 * 看起来没变，但手指落点范围大了一圈。
 */
@Composable
fun QuietIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f),
    size: Dp = 22.dp
) {
    TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minWidth = Dimens.touch, minHeight = Dimens.touch),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
    ) {
        Icon(icon, contentDescription, modifier = Modifier.size(size), tint = tint)
    }
}

/** 图标 + 文字的轻量按钮，用于抽屉和对话框底部动作 */
@Composable
fun QuietAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f)
) {
    TextButton(onClick = onClick, enabled = enabled, modifier = modifier) {
        Icon(icon, null, modifier = Modifier.size(17.dp), tint = tint)
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

/**
 * 抽屉里的九宫格式动作入口。
 * 图标走描边风格（用 0.08 透明度的容器衬托），文字在下方，比三行挤在一起的文字按钮清爽得多。
 */
@Composable
fun ActionTile(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    accent: Color = MaterialTheme.colorScheme.primary
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(
                if (enabled) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f)
            )
            .then(
                if (enabled) Modifier.clickable(onClick = onClick) else Modifier
            )
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, null, modifier = Modifier.size(19.dp), tint = accent)
        Spacer(Modifier.height(6.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = if (enabled) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            else MaterialTheme.colorScheme.faint
        )
    }
}

/** 统一的输入框：边框极淡，圆角偏大 */
@Composable
fun QuietTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    label: String? = null,
    mono: Boolean = true,
    singleLine: Boolean = true,
    enabled: Boolean = true,
    imeAction: ImeAction = ImeAction.Done,
    onImeAction: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        keyboardActions = KeyboardActions(
            onAny = { if (onImeAction != null) onImeAction() }
        ),
        textStyle = TextStyle(
            fontSize = 13.sp,
            fontFamily = if (mono) MonoFamily else androidx.compose.ui.text.font.FontFamily.Default
        ),
        placeholder = placeholder?.let { { Text(it, fontSize = 12.5.sp) } },
        label = label?.let { { Text(it, fontSize = 11.sp) } },
        singleLine = singleLine,
        visualTransformation = visualTransformation,
        trailingIcon = trailing,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = MaterialTheme.colorScheme.hairline,
            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.75f),
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
            cursorColor = MaterialTheme.colorScheme.primary
        )
    )
}

/** 圆角卡片容器：用于对话框内的分组 */
@Composable
fun QuietCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    ) {
        Column(Modifier.padding(Dimens.md), content = content)
    }
}

/**
 * Edge-to-edge 对话框窗口。
 *
 * Android 的普通 Dialog 窗口默认会自己收缩/平移，和 Compose 的 IME inset 叠加后
 * 经常出现「键盘挡住了输入框」或「弹窗被顶出屏幕」。这里统一关掉平台默认宽度，
 * 让内容占满窗口，再用 safeDrawingPadding 一次性吃掉状态栏、导航栏和 IME：
 *  - 对话框卡片始终在键盘上方；
 *  - 横竖屏切换时重新按可用区域布局；
 *  - 所有面板共用同一套规则，不再各自写 inset。
 */
@Composable
fun EdgeToEdgeDialog(
    onDismiss: () -> Unit,
    contentAlignment: Alignment = Alignment.Center,
    content: @Composable BoxWithConstraintsScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .padding(horizontal = Dimens.gutter, vertical = Dimens.md),
            contentAlignment = contentAlignment,
            content = content,
        )
    }
}

/**
 * 全应用统一的对话框外观。
 *
 * 标题左对齐、正文留足呼吸、按钮右对齐且不带多余强调，
 * 目的是让用户「读完就关」，而不是被一堆彩色按钮牵着走。
 *
 * 布局规则：
 *  - 卡片宽度上限 560dp，手机上占满左右边距；
 *  - 卡片高度上限 = 键盘上方的可用高度；
 *  - 只有正文滚动，标题、footer（输入框）和底部按钮永远固定可见。
 */
@Composable
fun QuietDialog(
    onDismiss: () -> Unit,
    title: String,
    confirmLabel: String? = null,
    onConfirm: (() -> Unit)? = null,
    dismissLabel: String = "关闭",
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    EdgeToEdgeDialog(onDismiss = onDismiss) {
        Surface(
            modifier = Modifier
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .heightIn(max = maxHeight),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 8.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp)
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.height(Dimens.md))

                // 正文可以滚动；权重让长内容吃掉剩余高度，短内容仍保持紧凑卡片。
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                ) {
                    content()
                }

                footer?.let {
                    Spacer(Modifier.height(Dimens.sm))
                    Column(Modifier.fillMaxWidth()) { it() }
                }

                Spacer(Modifier.height(Dimens.xs))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (confirmLabel != null && onConfirm != null) {
                        TextButton(onClick = onConfirm) {
                            Text(
                                confirmLabel,
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    TextButton(onClick = onDismiss) {
                        Text(
                            dismissLabel,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.muted,
                        )
                    }
                }
            }
        }
    }
}

/** 一行「标签 + 说明 + 开关」的设置项 */
@Composable
fun QuietSwitchRow(
    label: String,
    hint: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium)
            Text(hint, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.muted)
        }
        Spacer(Modifier.width(Dimens.sm))
        androidx.compose.material3.Switch(checked = checked, onCheckedChange = onChange)
    }
}

/** 状态徽标：一个色点 + 文字，比实心药丸轻盈 */
@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(6.dp)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .background(color)
    )
}

/** 行内左右分布的小工具 */
@Composable
fun RowScope.SpacerWeight() {
    Spacer(Modifier.weight(1f))
}
