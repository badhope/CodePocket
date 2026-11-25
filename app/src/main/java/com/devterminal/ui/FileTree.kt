package com.devterminal.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.NoteAdd
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.devterminal.project.FileNode
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietIconButton
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted
import com.devterminal.ui.theme.success
import com.devterminal.ui.theme.warning

/**
 * 左侧项目文件树。
 *
 * 视觉重构：
 *  - 图标换成 **Outlined 线性风格**，比原来的实心图标轻一档，长时间看不累；
 *  - 选中态用「左侧 2dp 竖条 + 极低透明度底色」——竖条比整行高亮更能精确指向，
 *    也不会在文件多时形成一片色块；
 *  - 目录不再显示第二个文件夹图标，箭头 + 文件夹各司其职。
 *
 * 使用逻辑修正：
 *  - **默认展开前两层**。原先全部折叠，用户新建项目后看到的是一排关闭的文件夹，
 *    得挨个点开才知道里面有什么——「打开 App 就能看到文件」是文件管理的最低要求。
 *  - 给目录加上「文件数量」的次要信息，不用点开就能判断值不值得展开。
 */
@Composable
fun FileTree(
    root: FileNode?,
    selectedPath: String?,
    onFileClick: (FileNode) -> Unit,
    onFileLongPress: (FileNode) -> Unit,
    onNewFile: () -> Unit = {},
    onNewFolder: () -> Unit = {},
    /** P2-7：git 变更 path→状态码（M/A/??）。空则不显示状态点。 */
    gitStatus: Map<String, String> = emptyMap(),
    modifier: Modifier = Modifier
) {
    val cs = MaterialTheme.colorScheme
    val expanded = remember(root?.path) {
        mutableStateMapOf<String, Boolean>().apply {
            // 首屏就把浅层目录展开：让用户一进来就能看到真实文件
            root?.children?.forEach { child ->
                if (child.isDirectory) put(child.path, true)
            }
        }
    }

    Column(modifier = modifier.fillMaxHeight()) {
        Row(
            Modifier.fillMaxWidth().padding(start = Dimens.gutter, top = Dimens.lg, bottom = Dimens.sm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            SectionLabel("项目")
            if (root != null) {
                Spacer(Modifier.weight(1f))
                QuietIconButton(Icons.Filled.NoteAdd, "新建文件", onNewFile, size = 16.dp)
                QuietIconButton(Icons.Filled.CreateNewFolder, "新建文件夹", onNewFolder, size = 16.dp)
            }
        }
        if (root == null) {
            QuietHint("加载中…", modifier = Modifier.padding(Dimens.gutter))
        } else {
            if (root.truncated) {
                Text(
                    "文件过多，仅显示前 10,000 项；完整列表请在终端查看。",
                    style = MaterialTheme.typography.labelSmall,
                    color = cs.warning,
                    modifier = Modifier.padding(start = Dimens.gutter, end = Dimens.gutter, bottom = Dimens.sm)
                )
            }
            // weight(1f)：文件树要吃掉顶栏「项目」标签之外的剩余纵向空间，
            // 否则目录一长，底部文件就被裁在抽屉外。
            // 先摊平成可见列表再交给 LazyColumn：复用同一批 item，避免递归 emit 导致
            // 展开深层目录时整棵子树反复重组。
            val visible = remember(root, expanded.toMap()) { flattenVisible(root, expanded) }
            LazyColumn(modifier = Modifier.fillMaxWidth().weight(1f)) {
                items(visible, key = { it.node.path }) { flat ->
                    TreeNode(
                        node = flat.node,
                        depth = flat.depth,
                        expanded = expanded,
                        selectedPath = selectedPath,
                        onFileClick = onFileClick,
                        onFileLongPress = onFileLongPress,
                        gitStatus = gitStatus
                    )
                }
            }
        }
    }
}

private data class FlatNode(val node: FileNode, val depth: Int)

/**
 * 把「展开状态」翻译成一维可见列表。
 * 只遍历当前展开的分支，折叠目录的子树完全不进入 LazyColumn。
 */
private fun flattenVisible(root: FileNode, expanded: Map<String, Boolean>): List<FlatNode> {
    val out = ArrayList<FlatNode>()
    fun walk(node: FileNode, depth: Int) {
        out += FlatNode(node, depth)
        if (node.isDirectory && expanded[node.path] == true) {
            node.children.forEach { walk(it, depth + 1) }
        }
    }
    root.children.ifEmpty { listOf(root) }.forEach { walk(it, 0) }
    return out
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TreeNode(
    node: FileNode,
    depth: Int,
    expanded: MutableMap<String, Boolean>,
    selectedPath: String?,
    onFileClick: (FileNode) -> Unit,
    onFileLongPress: (FileNode) -> Unit,
    gitStatus: Map<String, String> = emptyMap()
) {
    val cs = MaterialTheme.colorScheme
    val isOpen = expanded[node.path] ?: false
    val isSelected = node.path == selectedPath

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = Dimens.sm, end = Dimens.sm, top = 1.dp, bottom = 1.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) cs.primary.copy(alpha = 0.08f) else Color.Transparent)
            .combinedClickable(
                onClick = {
                    if (node.isDirectory) expanded[node.path] = !isOpen
                    else onFileClick(node)
                },
                onLongClick = { onFileLongPress(node) }
            )
            .padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 选中指示竖条
        Box(
            Modifier
                .width(2.dp)
                .height(16.dp)
                .background(if (isSelected) cs.primary else Color.Transparent, RoundedCornerShape(1.dp))
        )
        Spacer(Modifier.width((6 + depth * 14).dp))
        if (node.isDirectory) {
            Icon(
                imageVector = if (isOpen) Icons.Filled.KeyboardArrowDown
                else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = cs.faint,
                modifier = Modifier.size(14.dp)
            )
            Spacer(Modifier.width(4.dp))
            Icon(
                imageVector = if (isOpen) Icons.Outlined.FolderOpen else Icons.Outlined.Folder,
                contentDescription = null,
                tint = if (isSelected) cs.primary else cs.muted,
                modifier = Modifier.size(16.dp)
            )
        } else {
            Spacer(Modifier.width(18.dp))
            Icon(
                imageVector = Icons.Outlined.Description,
                contentDescription = null,
                tint = if (isSelected) cs.primary else cs.faint,
                modifier = Modifier.size(15.dp)
            )
        }
        Spacer(Modifier.width(8.dp))
        MonoText(
            node.name,
            modifier = Modifier.weight(1f),
            color = if (isSelected) cs.primary else cs.onSurface.copy(alpha = 0.86f),
            fontSize = 12,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        // P2-7：文件旁的 git 状态小标（M 修改 / ?? 新增未跟踪 / A 已加入暂存）
        if (!node.isDirectory) {
            gitStatus[node.path]?.let { code ->
                val dotColor = when {
                    code.startsWith("??") -> cs.secondary
                    code.startsWith("A") -> cs.success
                    else -> cs.warning
                }
                MonoText(
                    code,
                    color = dotColor,
                    fontSize = 9,
                    modifier = Modifier.padding(end = 2.dp)
                )
            }
        }
        // 折叠的目录给出文件数量，不用展开就能判断值不值得点
        if (node.isDirectory && !isOpen && node.children.isNotEmpty()) {
            MonoText(
                "${node.children.size}",
                color = cs.faint,
                fontSize = 10,
                modifier = Modifier.padding(end = 2.dp)
            )
        }
    }
}
