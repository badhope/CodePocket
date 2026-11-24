package com.devterminal.engine

/**
 * 把原始报错翻译成人话。
 *
 * 动机：手机上屏幕小、打字难，用户看到 `ModuleNotFoundError: No module named 'numpy'`
 * 或者一屏的 Java 编译栈，基本没法自救。这里把高频错误映射成**具体该怎么做**。
 */
object FriendlyError {

    /** 分析输出行，返回针对性的提示（无匹配则返回 null） */
    fun hint(lines: List<String>, languageId: String? = null): String? {
        val all = lines.joinToString("\n")
        // JavaScript / Lua 的错误文案和 Python 差异很大，先按语言分流
        if (languageId == LanguageRegistry.JAVASCRIPT.id) {
            return when {
                all.contains("SyntaxError") ->
                    "JavaScript 语法错误。检查括号、引号是否成对，以及是否漏了逗号/分号。"
                all.contains("ReferenceError") ->
                    "引用了未定义的变量或函数。先声明（let/const/function）再使用。"
                all.contains("TypeError") ->
                    "类型不匹配：常见于对 null/undefined 取属性、调用不存在的函数，或数组方法用错。"
                all.contains("RangeError") ->
                    "数值/递归超出范围。检查递归终止条件，或数组长度是否异常。"
                all.contains("EOFError") ->
                    "程序在等输入但读到了 EOF。在底部输入行输入内容后回车即可。"
                else -> null
            }
        }
        if (languageId == LanguageRegistry.LUA.id) {
            return when {
                all.contains("attempt to index") ->
                    "对一个 nil 值取字段/下标。先判断表是否存在，或初始化成 {}。"
                all.contains("attempt to call") ->
                    "调用了 nil 或非函数值。检查函数名拼写，以及是否 require/定义成功。"
                all.contains("unexpected symbol") || all.contains("syntax error") ->
                    "Lua 语法错误。检查 end/then/do 是否配对，字符串引号是否闭合。"
                all.contains("EOF") ->
                    "程序在等输入但读到了 EOF。在底部输入行输入内容后回车即可。"
                else -> null
            }
        }
        return when {
            // ---------- Python ----------
            all.contains("ModuleNotFoundError") || all.contains("ImportError") -> {
                val mod = Regex("""No module named ['"]([\w.]+)['"]""")
                    .find(all)?.groupValues?.get(1)
                buildString {
                    append("缺少模块")
                    if (mod != null) append("「$mod」") else append("")
                    append("。\n")
                    append("离线环境只带 Python 标准库（原生 CPython 3.13.9）。要用第三方库，\n")
                    append("需将对应 ABI 的 wheel 放入项目目录或安装到 site-packages。")
                }
            }

            all.contains("IndentationError") ->
                "缩进不一致。Python 对空格/Tab 混用很敏感，全文件统一用 4 个空格试试。"

            all.contains("SyntaxError") -> {
                val line = Regex("""line (\d+)""").find(all)?.groupValues?.get(1)
                "语法错误" + (line?.let { "（第 $it 行附近）" } ?: "") +
                    "。检查括号、引号是否成对，以及中英文标点是否混用。"
            }

            all.contains("EOFError") ->
                "程序在等输入但读到了文件结尾（EOF）。\n" +
                    "如果用了 input()，在底部输入行输入内容后回车即可。"

            all.contains("ZeroDivisionError") ->
                "除数为 0。检查分母是否可能为 0，加个判断更稳妥。"

            all.contains("IndexError") ->
                "下标越界。检查列表/字符串的索引是否超出长度（注意索引从 0 开始）。"

            all.contains("KeyError") ->
                "字典里没有这个键。可以用 dict.get(key, 默认值) 避免报错。"

            all.contains("UnicodeDecodeError") ->
                "文件编码不对。在脚本首行加 # -*- coding: utf-8 -*- 试试。"

            // ---------- Java ----------
            all.contains("cannot find symbol") ->
                "找不到符号：多半是类名/方法名拼错，或忘了 import。\n" +
                    "注意 Java 区分大小写。"

            all.contains("class, interface, or enum expected") ->
                "代码结构不对：检查大括号是否配对，以及 class 是否写在最外层。"

            all.contains("public class") && all.contains("should be declared in a file named") ->
                "文件名和 public 类名必须完全一致（含大小写）。"

            all.contains("error: package") && all.contains("does not exist") ->
                "引用了不存在的包。离线环境只带 JDK 标准库，第三方库需要自己打进工具链。"

            all.contains("Could not find or load main class") ->
                "找不到主类。确认文件里有 public static void main(String[] args) 方法。"

            // ---------- 通用 ----------
            all.contains("Permission denied") ->
                "权限不足。解压工具链时可能丢失了执行位，删掉 App 数据重新初始化试试。"

            all.contains("Exec format error") || all.contains("cannot execute") ->
                "二进制格式不匹配：内置工具链的 CPU 架构和本机不一致（如 arm64 包装到了 armv7 设备）。"

            all.contains("No space left") ->
                "存储空间不足。清理手机空间，或换用只含 Python 的轻量工具链。"

            all.contains("Killed") || all.contains("signal 9") ->
                "进程被系统杀掉了（Android 后台限制）。\n" +
                    "去 设置 → 应用 → CodePocket → 电池 改成「无限制」，并避免同时开太多 App。"

            else -> null
        }
    }
}
