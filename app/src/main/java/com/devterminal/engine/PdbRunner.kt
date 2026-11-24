package com.devterminal.engine

/**
 * pdb 包装器脚本。
 *
 * 不能直接把目标文件交给 `PyRun_FileExFlags`：那样没有调试钩子。这里先 compile
 * 目标源码，再交给 `pdb.run`，由 pdb 安装 trace 并在第一行停住。
 *
 * 目标路径通过 argv[1] 传入，不拼进 Python 字符串，避免引号/反斜杠转义问题。
 * `__name__` 设为 `__main__`、`__file__` 指向真实文件，保持 if __name__ 与
 * traceback 行号语义；`sys.argv` 还原为目标脚本 + 用户参数。
 */
object PdbRunner {
    const val FILE_NAME = "cp-pdb-runner.py"

    val SCRIPT: String = """
        import sys
        import pdb

        _target = sys.argv[1]
        _args = sys.argv[2:]
        sys.argv = [_target] + _args
        _code = compile(open(_target, encoding="utf-8").read(), _target, "exec")
        _globals = {
            "__name__": "__main__",
            "__file__": _target,
            "__builtins__": __builtins__,
        }
        pdb.run(_code, _globals, _globals)
    """.trimIndent() + "\n"
}
