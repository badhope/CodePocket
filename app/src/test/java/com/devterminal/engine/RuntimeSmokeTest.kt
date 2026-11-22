package com.devterminal.engine

import com.devterminal.project.Templates
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 纯 JVM 冒烟：Rhino / LuaJ 都是纯 Java，不依赖 Android 运行时。
 * 只验证「能跑、能拿到 stdout、能收尾」，不覆盖 UI 交互。
 */
class RuntimeSmokeTest {

    @Test
    fun `javascript prints and finishes`() = runBlocking {
        val file = File.createTempFile("codepocket-js-", ".js").apply {
            writeText("console.log('hi'); console.log(1 + 2);")
        }
        try {
            val events = JavaScriptEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "javascript"),
                5_000L
            ).toList()
            assertTrue("缺少 hi: $events", events.any { it is RunEvent.Stdout && it.line == "hi" })
            assertTrue("缺少 3: $events", events.any { it is RunEvent.Stdout && it.line == "3" })
            assertTrue("缺少 Finished: $events", events.last() is RunEvent.Finished)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `lua prints and finishes`() = runBlocking {
        val file = File.createTempFile("codepocket-lua-", ".lua").apply {
            writeText("print('hi')\nprint(1 + 2)")
        }
        try {
            val events = LuaEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "lua"),
                5_000L
            ).toList()
            assertTrue("缺少 hi: $events", events.any { it is RunEvent.Stdout && it.line == "hi" })
            assertTrue("缺少 3: $events", events.any { it is RunEvent.Stdout && it.line == "3" })
            assertTrue("缺少 Finished: $events", events.last() is RunEvent.Finished)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `javascript reads stdin`() = runBlocking {
        val file = File.createTempFile("codepocket-js-stdin-", ".js").apply {
            writeText("const name = input('name? '); console.log('got ' + name);")
        }
        try {
            val engine = JavaScriptEngine()
            val events = mutableListOf<RunEvent>()
            val job = launch {
                engine.run(
                    RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "javascript"),
                    5_000L
                ).collect { events += it }
            }
            delay(300)
            engine.writeStdin("Ada")
            engine.closeStdin()
            job.join()
            assertTrue("缺少返回值: $events", events.any { it is RunEvent.Stdout && it.line == "got Ada" })
            assertTrue("缺少 Finished: $events", events.last() is RunEvent.Finished)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `lua reads stdin`() = runBlocking {
        val file = File.createTempFile("codepocket-lua-stdin-", ".lua").apply {
            writeText("local name = input('name? ')\nprint('got ' .. name)")
        }
        try {
            val engine = LuaEngine()
            val events = mutableListOf<RunEvent>()
            val job = launch {
                engine.run(
                    RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "lua"),
                    5_000L
                ).collect { events += it }
            }
            delay(300)
            engine.writeStdin("Ada")
            engine.closeStdin()
            job.join()
            assertTrue("缺少返回值: $events", events.any { it is RunEvent.Stdout && it.line == "got Ada" })
            assertTrue("缺少 Finished: $events", events.last() is RunEvent.Finished)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `javascript template runs`() = runBlocking {
        val file = File.createTempFile("codepocket-js-template-", ".js").apply {
            writeText(Templates.JAVASCRIPT_HELLO.files.getValue("main.js"))
        }
        try {
            val events = JavaScriptEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "javascript"),
                5_000L
            ).toList()
            assertTrue(
                "模板输出不符合预期: $events",
                events.any { it is RunEvent.Stdout && it.line.contains("Hello from CodePocket!") }
            )
            assertTrue("模板缺少 Finished: $events", events.last() is RunEvent.Finished && (events.last() as RunEvent.Finished).exitCode == 0)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `lua template runs`() = runBlocking {
        val file = File.createTempFile("codepocket-lua-template-", ".lua").apply {
            writeText(Templates.LUA_TABLE.files.getValue("main.lua"))
        }
        try {
            val events = LuaEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "lua"),
                5_000L
            ).toList()
            assertTrue(
                "模板输出不符合预期: $events",
                events.any { it is RunEvent.Stdout && it.line.startsWith("fib(10):") }
            )
            assertTrue("模板缺少 Finished: $events", events.last() is RunEvent.Finished && (events.last() as RunEvent.Finished).exitCode == 0)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `lua cannot reach java bridge`() = runBlocking {
        val file = File.createTempFile("codepocket-lua-sandbox-", ".lua").apply {
            writeText("print(type(luajava))\nlocal ok = pcall(function() return require('luajava') end)\nprint(ok)")
        }
        try {
            val events = LuaEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "lua"),
                5_000L
            ).toList()
            assertTrue("luajava 仍是全局: $events", events.any { it is RunEvent.Stdout && it.line == "nil" })
            assertTrue("require('luajava') 未被拦住: $events", events.any { it is RunEvent.Stdout && it.line == "false" })
            assertTrue("缺少 Finished: $events", events.last() is RunEvent.Finished)
        } finally {
            file.delete()
        }
    }

    @Test
    fun `javascript timeout stops`() = runBlocking {
        val file = File.createTempFile("codepocket-js-timeout-", ".js").apply {
            writeText("while (true) {}")
        }
        try {
            val events = JavaScriptEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "javascript"),
                800L
            ).toList()
            assertTrue("超时未收尾: $events", events.last() is RunEvent.Finished)
            assertTrue(
                "超时没有提示: $events",
                events.any { it is RunEvent.Stderr && (it.line.contains("已停止") || it.line.contains("超时")) }
            )
        } finally {
            file.delete()
        }
    }

    @Test
    fun `lua timeout stops`() = runBlocking {
        val file = File.createTempFile("codepocket-lua-timeout-", ".lua").apply {
            writeText("while true do end")
        }
        try {
            val events = LuaEngine().run(
                RunRequest(file.absolutePath, file.parentFile!!.absolutePath, languageId = "lua"),
                800L
            ).toList()
            assertTrue("超时未收尾: $events", events.last() is RunEvent.Finished)
            assertTrue(
                "超时没有提示: $events",
                events.any { it is RunEvent.Stderr && (it.line.contains("已停止") || it.line.contains("超时")) }
            )
        } finally {
            file.delete()
        }
    }
}
