package com.devterminal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted
import java.io.File

/**
 * 顶部文件 Tab 条。
 *
 * 重构要点：原来是「底部对齐的色块 Tab」，激活态靠背景明度区分，在浅色下几乎看不出。
 * 改为和 VS Code 一致的**底部强调线**：2dp 的细线足够指明当前文件，
 * 其余交给文字亮度，整体轻很多。
 */
@Composable
fun FileTabs(
    tabs: List<File>,
    activePath: String?,
    onSelect: (File) -> Unit,
    onClose: (File) -> Unit,
    /** 未保存（脏）的文件绝对路径集合，用于在 Tab 名旁显示小圆点 */
    dirtyPaths: Set<String> = emptySet(),
    modifier: Modifier = Modifier
) {
    if (tabs.isEmpty()) return
    val cs = MaterialTheme.colorScheme
    Row(
        modifier = modifier
            .background(cs.surface)
            .horizontalScroll(rememberScrollState()),
        verticalAlignment = Alignment.CenterVertically
    ) {
        tabs.forEach { tab ->
            val active = tab.absolutePath == activePath
            Column(
                modifier = Modifier
                    .clickable { onSelect(tab) }
                    .padding(start = 12.dp, end = 4.dp, top = 8.dp, bottom = 6.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MonoText(
                        tab.name,
                        modifier = Modifier.widthIn(max = 180.dp),
                        color = if (active) cs.onSurface else cs.muted,
                        fontSize = 12,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    // 脏 Tab：未保存的小圆点（与顶栏标题旁的 dirty dot 同一语义色）
                    if (tab.absolutePath in dirtyPaths) {
                        Box(
                            Modifier
                                .padding(start = 4.dp)
                                .size(6.dp)
                                .background(cs.secondary, CircleShape)
                        )
                    }
                    // 关闭按钮：视觉图标 11dp，但可点区撑到 32dp，避免误点相邻 Tab
                    Box(
                        modifier = Modifier
                            .padding(start = 2.dp)
                            .defaultMinSize(minWidth = 32.dp, minHeight = 32.dp)
                            .clip(CircleShape)
                            .clickable { onClose(tab) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "关闭 ${tab.name}",
                            modifier = Modifier.size(11.dp),
                            tint = if (active) cs.muted else cs.faint
                        )
                    }
                }
                // 激活指示线：只在激活时绘制，非激活态保持干净
                Box(
                    modifier = Modifier
                        .padding(top = 5.dp)
                        .fillMaxWidth()
                        .height(2.dp)
                        .background(
                            if (active) cs.primary else Color.Transparent,
                            CircleShape
                        )
                )
            }
        }
    }
}
