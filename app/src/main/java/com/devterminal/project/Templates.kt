package com.devterminal.project

import com.devterminal.engine.LanguageRegistry

/** 项目模板 */
data class ProjectTemplate(
    val id: String,
    val title: String,
    val description: String,
    val languageId: String,
    /** 相对路径 -> 初始内容 */
    val files: Map<String, String>
)

object Templates {

    val PYTHON_HELLO = ProjectTemplate(
        id = "python-hello",
        title = "Python 空白项目",
        description = "一个 main.py，点击运行即可看到输出",
        languageId = LanguageRegistry.PYTHON.id,
        files = mapOf(
            "main.py" to """
                # -*- coding: utf-8 -*-
                # CodePocket 离线 Python 模板
                def main():
                    print("Hello from CodePocket!")
                    total = sum(i * i for i in range(1, 11))
                    print(f"1^2 + 2^2 + ... + 10^2 = {total}")

                if __name__ == "__main__":
                    main()
            """.trimIndent()
        )
    )

    val PYTHON_DATA = ProjectTemplate(
        id = "python-data",
        title = "Python 数据处理",
        description = "纯标准库 statistics 模块统计示例",
        languageId = LanguageRegistry.PYTHON.id,
        files = mapOf(
            "analyze.py" to """
                # -*- coding: utf-8 -*-
                # 纯标准库示例：statistics 模块，离线开箱即用，无需安装第三方库
                import statistics

                def main():
                    data = [52, 48, 55, 61, 49, 53, 58, 47, 60, 54, 57, 50, 62, 46, 59, 51]
                    print(f"样本数: {len(data)}")
                    print(f"均值:   {statistics.mean(data):.2f}")
                    print(f"标准差: {statistics.stdev(data):.2f}")
                    print(f"中位数: {statistics.median(data):.2f}")
                    print(f"最小/最大: {min(data)} / {max(data)}")

                if __name__ == "__main__":
                    main()
            """.trimIndent()
        )
    )

    val PYTHON_INTERACTIVE = ProjectTemplate(
        id = "python-interactive",
        title = "Python 交互输入",
        description = "演示 input() 交互：猜数字游戏（练习标准输入）",
        languageId = LanguageRegistry.PYTHON.id,
        files = mapOf(
            "main.py" to """
                # -*- coding: utf-8 -*-
                # 演示：运行后用底部输入行回答，程序会实时响应
                import random

                def guess_game():
                    secret = random.randint(1, 100)
                    tries = 0
                    print("我在想一个 1-100 的数字，猜猜看？")
                    while True:
                        raw = input("请输入: ")
                        if not raw.strip().lstrip("-").isdigit():
                            print("请输入一个整数")
                            continue
                        guess = int(raw)
                        tries += 1
                        if guess < secret:
                            print("太小了！")
                        elif guess > secret:
                            print("太大了！")
                        else:
                            print(f"猜对了！用了 {tries} 次")
                            break

                if __name__ == "__main__":
                    guess_game()
            """.trimIndent()
        )
    )

    val PYTHON_MULTI = ProjectTemplate(
        id = "python-multi",
        title = "Python 多模块",
        description = "演示多文件协作：main.py 导入同目录的 utils.py",
        languageId = LanguageRegistry.PYTHON.id,
        files = mapOf(
            "utils.py" to """
                # -*- coding: utf-8 -*-
                def fib(n: int) -> list:
                    seq = [0, 1]
                    while len(seq) < n:
                        seq.append(seq[-1] + seq[-2])
                    return seq[:n]

                def is_prime(n: int) -> bool:
                    if n < 2:
                        return False
                    for i in range(2, int(n ** 0.5) + 1):
                        if n % i == 0:
                            return False
                    return True
            """.trimIndent(),
            "main.py" to """
                # -*- coding: utf-8 -*-
                # 演示多文件：直接 import 同目录模块（离线可用）
                from utils import fib, is_prime

                def main():
                    print("前 10 个斐波那契数:", fib(10))
                    primes = [n for n in range(2, 50) if is_prime(n)]
                    print("50 以内的素数:", primes)

                if __name__ == "__main__":
                    main()
            """.trimIndent()
        )
    )

    val JAVASCRIPT_HELLO = ProjectTemplate(
        id = "javascript-hello",
        title = "JavaScript 空白项目",
        description = "一个 main.js，Rhino 运行时，支持 console.log 与 input",
        languageId = LanguageRegistry.JAVASCRIPT.id,
        files = mapOf(
            "main.js" to """
                // CodePocket 离线 JavaScript 模板
                function main() {
                    console.log("Hello from CodePocket!");
                    const nums = [1, 2, 3, 4, 5];
                    const total = nums.reduce((a, b) => a + b, 0);
                    console.log("1 + 2 + ... + 5 = " + total);
                }

                main();
            """.trimIndent()
        )
    )

    val JAVASCRIPT_ALGO = ProjectTemplate(
        id = "javascript-algo",
        title = "JavaScript 算法练习",
        description = "数组、函数、循环，适合刷基础题",
        languageId = LanguageRegistry.JAVASCRIPT.id,
        files = mapOf(
            "main.js" to """
                // 斐波那契 + 素数筛选
                function fib(n) {
                    const seq = [0, 1];
                    while (seq.length < n) {
                        seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
                    }
                    return seq.slice(0, n);
                }

                function isPrime(n) {
                    if (n < 2) return false;
                    for (let i = 2; i * i <= n; i++) {
                        if (n % i === 0) return false;
                    }
                    return true;
                }

                console.log("fib(10):", fib(10));
                console.log("primes < 50:", Array.from({length: 50}, (_, i) => i).filter(isPrime));
            """.trimIndent()
        )
    )

    val LUA_HELLO = ProjectTemplate(
        id = "lua-hello",
        title = "Lua 空白项目",
        description = "一个 main.lua，LuaJ 运行时，支持 print 与 input",
        languageId = LanguageRegistry.LUA.id,
        files = mapOf(
            "main.lua" to """
                -- CodePocket 离线 Lua 模板
                local function main()
                    print("Hello from CodePocket!")
                    local total = 0
                    for i = 1, 10 do
                        total = total + i * i
                    end
                    print("1^2 + 2^2 + ... + 10^2 = " .. total)
                end

                main()
            """.trimIndent()
        )
    )

    val LUA_TABLE = ProjectTemplate(
        id = "lua-table",
        title = "Lua 表与函数",
        description = "table、函数、循环，适合写小游戏逻辑",
        languageId = LanguageRegistry.LUA.id,
        files = mapOf(
            "main.lua" to """
                -- Lua table + function 示例
                local function fib(n)
                    local seq = {0, 1}
                    while #seq < n do
                        seq[#seq + 1] = seq[#seq] + seq[#seq - 1]
                    end
                    return seq
                end

                local function is_prime(n)
                    if n < 2 then return false end
                    for i = 2, math.floor(math.sqrt(n)) do
                        if n % i == 0 then return false end
                    end
                    return true
                end

                print("fib(10):", fib(10))
                local primes = {}
                for i = 2, 49 do
                    if is_prime(i) then primes[#primes + 1] = i end
                end
                print("primes < 50:", primes)
            """.trimIndent()
        )
    )

    /** 只放能运行的模板；编辑级语言不提供“新建项目”入口。 */
    val all: List<ProjectTemplate> = listOf(
        PYTHON_HELLO, PYTHON_INTERACTIVE, PYTHON_MULTI, PYTHON_DATA,
        JAVASCRIPT_HELLO, JAVASCRIPT_ALGO, LUA_HELLO, LUA_TABLE
    )
}
