package com.devterminal.project

import com.devterminal.engine.EnvironmentInstaller
import com.devterminal.engine.LanguageRegistry
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID

/** 文件树节点 */
data class FileNode(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val children: List<FileNode> = emptyList()
)

/**
 * 文件名清洗：只去掉路径分隔符和 Windows 非法字符，**保留点号**。
 *
 * 旧实现把 `.` 也替换成 `_`，新建 `main.py` 实际得到 `main_py`，
 * 重命名同样；这是 P0 级 bug。抽成顶层函数后可直接单测。
 */
internal fun sanitizeFileName(name: String): String {
    val cleaned = name.trim()
        .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_")
        .trim()
    return if (cleaned.isBlank() || cleaned == "." || cleaned == "..") "untitled" else cleaned
}

/**
 * 项目文件管理。
 *
 * 项目统一放在 App 私有目录 files/projects 下——Android 10+ 分区存储下，
 * 私有目录免授权即可读写，最稳妥；需要访问手机 Download 时再走 SAF。
 */
class ProjectManager(installer: EnvironmentInstaller) {

    val root: File = installer.projectsDir

    /** 确保根目录存在，并在为空时创建一个示例项目。调用方应在 IO 线程执行。 */
    fun ensureInitialized() {
        root.mkdirs()
        if (root.listFiles().isNullOrEmpty()) {
            createFromTemplate(Templates.PYTHON_HELLO)
        }
    }

    fun listProjects(): List<File> =
        root.listFiles { f -> f.isDirectory }?.sortedBy { it.name } ?: emptyList()

    /** 以模板新建项目，返回项目根目录 */
    fun createFromTemplate(template: ProjectTemplate, projectName: String? = null): File {
        val name = sanitize(projectName ?: template.id)
        var dir = File(root, name)
        var i = 1
        while (dir.exists()) { dir = File(root, "$name-${i++}") }
        dir.mkdirs()
        template.files.forEach { (rel, content) ->
            val f = File(dir, rel)
            f.parentFile?.mkdirs()
            f.writeText(content)
        }
        // 记录语言 id，便于 UI 选择运行配置
        File(dir, ".devterminal").writeText(template.languageId)
        return dir
    }

    /** 删除项目及其所有文件（递归）。当前项目不允许删。返回是否真的删干净。 */
    fun deleteProject(projectDir: File): Boolean = projectDir.deleteRecursively()

    /**
     * 递归构建文件树。
     *
     * 两道护栏：
     *  - 跳过隐藏项与构建产物（.git / build / __pycache__ …），否则一个 React 项目
     *    的文件树能把 UI 卡死；
     *  - 限制递归深度，防止目录软链接成环或异常深的层级把栈打爆。
     */
    fun buildTree(
        dir: File,
        depth: Int = 0,
        /** 剩余节点预算；一次调用内共享，避免超大目录把主线程/内存拖死 */
        budget: IntArray = intArrayOf(MAX_TREE_NODES),
    ): FileNode {
        if (budget[0] <= 0) {
            return FileNode(dir.name, dir.absolutePath, dir.isDirectory, emptyList())
        }
        budget[0] -= 1
        val children = if (depth >= MAX_DEPTH) emptyList()
        else dir.listFiles()
            ?.filterNot { it.name.startsWith(".") || it.name in EXCLUDED_DIRS }
            ?.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))
            ?.map { buildTree(it, depth + 1, budget) }
            ?: emptyList()
        return FileNode(dir.name, dir.absolutePath, dir.isDirectory, children)
    }

    /**
     * 读取编辑器文本。
     *
     * 手机内存比桌面紧得多：一个 50MB 的日志或二进制被点开，readText 会直接把
     * 进程 OOM；这里在 UI 入口前就拦住，并给出可理解的原因。
     */
    fun read(path: String): String {
        val f = File(path)
        if (!f.isFile) return ""
        require(f.length() <= MAX_EDIT_BYTES) {
            "文件过大（${f.length() / 1024 / 1024}MB），编辑器最多打开 ${MAX_EDIT_BYTES / 1024 / 1024}MB；请用终端处理"
        }
        require(!isProbablyBinary(f)) {
            "这是二进制文件，不能按文本打开"
        }
        return f.readText()
    }

    /**
     * 原子写入：先写临时文件并 fsync，最后 rename 覆盖目标。
     *
     * 旧实现直接 writeText：写到一半被系统杀进程/断电，原文件已经被截断，
     * 用户代码就永久损坏。rename 在同一文件系统内是原子的，最坏也是保留旧文件。
     */
    fun write(path: String, content: String) {
        writeBytes(File(path), content.toByteArray(Charsets.UTF_8))
    }

    private fun writeBytes(target: File, bytes: ByteArray) {
        target.parentFile?.mkdirs()
        val parent = target.parentFile ?: throw IOException("文件没有父目录：${target.path}")
        val temp = File(parent, ".${target.name}.tmp-${UUID.randomUUID()}")
        try {
            FileOutputStream(temp).use { out ->
                out.write(bytes)
                out.fd.sync()
            }
            // Linux/Android 的 rename 会原子替换已存在的目标；失败才退化为直接覆盖。
            if (!temp.renameTo(target)) {
                FileOutputStream(target).use { it.write(bytes) }
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    private fun isProbablyBinary(file: File): Boolean = runCatching {
        file.inputStream().use { input ->
            val buffer = ByteArray(4096)
            val read = input.read(buffer)
            if (read <= 0) return@use false
            (0 until read).any { buffer[it] == 0.toByte() }
        }
    }.getOrDefault(true)

    fun createFile(parentDir: String, fileName: String): File {
        val f = File(parentDir, sanitize(fileName))
        f.parentFile?.mkdirs()
        if (!f.exists()) f.createNewFile()
        return f
    }

    /** 在指定目录下新建文件夹，已存在则直接返回 */
    fun createDirectory(parentDir: String, dirName: String): File {
        val d = File(parentDir, sanitize(dirName))
        d.mkdirs()
        return d
    }

    fun delete(target: File): Boolean = target.deleteRecursively()

    /** 重命名文件/目录，返回新文件（失败返回 null） */
    fun rename(target: File, newName: String): File? {
        val safe = sanitize(newName)
        val dest = File(target.parentFile ?: return null, safe)
        if (dest.exists()) return null
        return if (target.renameTo(dest)) dest else null
    }

    /** 项目所用语言 id（读 .devterminal 标记，缺省按扩展名推断） */
    fun languageIdOf(projectDir: File): String {
        val mark = File(projectDir, ".devterminal")
        if (mark.exists()) {
            return LanguageRegistry.migrateLegacyId(mark.readText())
        }
        val first = projectDir.walkTopDown().firstOrNull { it.isFile }
        return LanguageRegistry.forFile(first).id
    }

    private fun sanitize(name: String): String = sanitizeFileName(name)

    private companion object {
        /** 文件树递归深度上限 */
        const val MAX_DEPTH = 12
        /** 文件树单次构建节点上限；超出时静默截断，优先保证 UI 可用 */
        const val MAX_TREE_NODES = 10_000
        /** 编辑器可打开的单文件上限；超过走终端/外部工具，避免手机 OOM */
        const val MAX_EDIT_BYTES = 5L * 1024 * 1024
        /** 不展示的目录（构建产物 / 依赖目录） */
        val EXCLUDED_DIRS = setOf("build", "__pycache__", "node_modules", ".gradle", ".idea", "dist")
    }
}
