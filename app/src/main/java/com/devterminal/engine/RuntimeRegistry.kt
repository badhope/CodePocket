package com.devterminal.engine

/**
 * 运行时路由：languageId -> RunEngine。
 *
 * Python 继续走现有原生的 NativeEngine；JavaScript/Lua 是纯 Java，
 * 按需懒加载，避免不用 JS/Lua 的用户承担启动成本。
 */
class RuntimeRegistry(
    /** Python 是可选运行时：原生库缺失时 JS/Lua 仍可用。 */
    private val python: RunEngine?
) {
    private val javascript: RunEngine by lazy { JavaScriptEngine() }
    private val lua: RunEngine by lazy { LuaEngine() }

    fun engineFor(languageId: String): RunEngine? = when (languageId) {
        LanguageRegistry.PYTHON.id -> python
        LanguageRegistry.JAVASCRIPT.id -> javascript
        LanguageRegistry.LUA.id -> lua
        else -> null
    }

    fun isAvailable(languageId: String): Boolean = engineFor(languageId) != null

    fun warmup() {
        python?.warmup()
        // JS/Lua 是纯 Java，首次运行初始化在毫秒级；这里不抢主线程。
        Thread {
            runCatching { javascript.warmup() }
            runCatching { lua.warmup() }
        }.apply { isDaemon = true }.start()
    }

    fun release() {
        runCatching { python?.release() }
        runCatching { javascript.release() }
        runCatching { lua.release() }
    }
}
