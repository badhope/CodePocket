package com.devterminal.engine

/**
 * 内置代码片段库：命令面板可达，插入到光标处。
 *
 * 只收录「手写麻烦、复用率高」的骨架代码——这是移动端输入效率的杠杆。
 * 语言用 id 关联，新增语言只改这里和 LanguageRegistry。
 */
object Snippets {

    data class Snippet(
        val id: String,
        val title: String,
        val description: String,
        val languageId: String,
        val code: String
    )

    val all: List<Snippet> = listOf(
        // ---------- Python ----------
        Snippet("py-main", "Python 主入口", "if __name__ == \"__main__\" 守卫", LanguageRegistry.PYTHON.id,
            "def main():\n    pass\n\nif __name__ == \"__main__\":\n    main()\n"),
        Snippet("py-class", "Python 类骨架", "含 __init__ 与 __repr__", LanguageRegistry.PYTHON.id,
            "class MyClass:\n    def __init__(self, name: str):\n        self.name = name\n\n    def __repr__(self) -> str:\n        return f\"MyClass(name={self.name!r})\"\n"),
        Snippet("py-open", "读文件（with）", "自动关闭文件句柄", LanguageRegistry.PYTHON.id,
            "with open(\"data.txt\", \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n"),
        Snippet("py-try", "异常处理", "try / except / else / finally", LanguageRegistry.PYTHON.id,
            "try:\n    risky()\nexcept ValueError as e:\n    print(f\"非法输入: {e}\")\nexcept Exception as e:\n    print(f\"出错了: {e}\")\nelse:\n    print(\"成功\")\nfinally:\n    cleanup()\n"),
        Snippet("py-deco", "装饰器", "计时装饰器模板", LanguageRegistry.PYTHON.id,
            "import functools, time\n\ndef timer(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        result = func(*args, **kwargs)\n        print(f\"{func.__name__} 耗时 {time.perf_counter() - start:.3f}s\")\n        return result\n    return wrapper\n"),
        Snippet("py-dataclass", "数据类", "dataclass 定义", LanguageRegistry.PYTHON.id,
            "from dataclasses import dataclass\n\n@dataclass\nclass Point:\n    x: float\n    y: float\n"),

        // ---------- JavaScript ----------
        Snippet("js-main", "JS 主函数", "function main() + 调用", LanguageRegistry.JAVASCRIPT.id,
            "function main() {\n    console.log(\"Hello\");\n}\n\nmain();\n"),
        Snippet("js-arrow", "箭头函数 + 数组", "map / filter / reduce", LanguageRegistry.JAVASCRIPT.id,
            "const nums = [1, 2, 3, 4, 5];\nconst doubled = nums.map(n => n * 2);\nconst evens = nums.filter(n => n % 2 === 0);\nconst total = nums.reduce((a, b) => a + b, 0);\nconsole.log(doubled, evens, total);\n"),
        Snippet("js-class", "JS 类骨架", "constructor + 方法", LanguageRegistry.JAVASCRIPT.id,
            "class User {\n    constructor(name, age) {\n        this.name = name;\n        this.age = age;\n    }\n\n    greet() {\n        return \"Hello, \" + this.name;\n    }\n}\n"),
        Snippet("js-try", "JS 异常处理", "try / catch / finally", LanguageRegistry.JAVASCRIPT.id,
            "try {\n    risky();\n} catch (e) {\n    console.log(\"出错了:\", e.message);\n} finally {\n    console.log(\"cleanup\");\n}\n"),
        Snippet("js-input", "JS 交互输入", "input() 读取一行", LanguageRegistry.JAVASCRIPT.id,
            "const name = input(\"请输入姓名: \");\nconsole.log(\"你好, \" + name);\n"),

        // ---------- Lua ----------
        Snippet("lua-main", "Lua 主函数", "local function main()", LanguageRegistry.LUA.id,
            "local function main()\n    print(\"Hello\")\nend\n\nmain()\n"),
        Snippet("lua-table", "Lua 表遍历", "ipairs / pairs", LanguageRegistry.LUA.id,
            "local items = {\"a\", \"b\", \"c\"}\nfor i, v in ipairs(items) do\n    print(i, v)\nend\n"),
        Snippet("lua-class", "Lua 面向对象", "metatable + __index", LanguageRegistry.LUA.id,
            "local User = {}\nUser.__index = User\n\nfunction User.new(name)\n    return setmetatable({name = name}, User)\nend\n\nfunction User:greet()\n    return \"Hello, \" .. self.name\nend\n"),
        Snippet("lua-try", "Lua 错误处理", "pcall / xpcall", LanguageRegistry.LUA.id,
            "local ok, err = pcall(function()\n    error(\"boom\")\nend)\nif not ok then\n    print(\"出错了:\", err)\nend\n"),
        Snippet("lua-input", "Lua 交互输入", "input() 读取一行", LanguageRegistry.LUA.id,
            "local name = input(\"请输入姓名: \")\nprint(\"你好, \" .. name)\n")
    )

    fun forLanguage(languageId: String): List<Snippet> =
        all.filter { it.languageId == languageId }
}
