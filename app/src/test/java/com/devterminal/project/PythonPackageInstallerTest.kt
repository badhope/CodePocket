package com.devterminal.project

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class PythonPackageInstallerTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun zip(vararg entries: Pair<String, String>): File {
        val f = tmp.newFile("pkg-${System.nanoTime()}.whl")
        ZipOutputStream(f.outputStream()).use { out ->
            entries.forEach { (name, body) ->
                out.putNextEntry(ZipEntry(name))
                out.write(body.toByteArray())
                out.closeEntry()
            }
        }
        return f
    }

    @Test
    fun `纯 Python wheel 安装后可读元数据并导入`() {
        val site = tmp.newFolder("site-packages")
        val installer = PythonPackageInstaller(site)
        val wheel = zip(
            "demo/__init__.py" to "VALUE = 42\n",
            "demo-1.0.dist-info/METADATA" to "Metadata-Version: 2.1\nName: demo\nVersion: 1.0\n"
        )

        val result = installer.install(wheel)
        assertTrue(result.message, result.ok)
        assertEquals("demo", result.packageName)
        assertEquals("1.0", result.version)
        assertEquals("VALUE = 42\n", File(site, "demo/__init__.py").readText())

        val installed = installer.installed()
        assertEquals(listOf(PythonPackageInstaller.InstalledPackage("demo", "1.0")), installed)
    }

    @Test
    fun `含原生 so 的包在安装前被拒绝且不落盘`() {
        val site = tmp.newFolder("site-packages")
        val installer = PythonPackageInstaller(site)
        val wheel = zip(
            "demo/__init__.py" to "",
            "demo/native.cpython-313-aarch64-linux-android.so" to "fake"
        )

        val result = installer.install(wheel)
        assertFalse(result.ok)
        assertTrue(result.message, result.message.contains("原生"))
        assertFalse(File(site, "demo").exists())
    }

    @Test
    fun `第二个顶层条目替换失败时回滚已写入的第一项`() {
        val site = tmp.newFolder("site-packages")
        val installer = PythonPackageInstaller(site) { from, to ->
            if (to.parentFile?.canonicalFile == site.canonicalFile && to.name == "two.py") {
                false
            } else {
                from.renameTo(to)
            }
        }
        val wheel = zip(
            "one.py" to "ONE = 1\n",
            "two.py" to "TWO = 2\n",
            "demo-1.0.dist-info/METADATA" to "Name: demo\nVersion: 1.0\n"
        )

        val result = installer.install(wheel)
        assertFalse(result.ok)
        assertTrue(result.message, result.message.contains("安装失败"))
        assertFalse(File(site, "one.py").exists())
        assertFalse(File(site, "two.py").exists())
        assertFalse(File(site, "demo-1.0.dist-info").exists())
        assertTrue(site.listFiles().isNullOrEmpty())
    }

    @Test
    fun `超过 100MB 的安装包在解压前被拒绝`() {
        val site = tmp.newFolder("site-packages")
        val big = tmp.newFile("big.whl")
        java.io.RandomAccessFile(big, "rw").use { it.setLength(101L * 1024 * 1024) }
        val result = PythonPackageInstaller(site).install(big)
        assertFalse(result.ok)
        assertTrue(result.message, result.message.contains("100MB"))
        assertTrue(site.listFiles().isNullOrEmpty())
    }

    @Test
    fun `路径穿越被拒绝`() {
        val site = tmp.newFolder("site-packages")
        val installer = PythonPackageInstaller(site)
        val wheel = zip("../evil.py" to "boom")

        val result = installer.install(wheel)
        assertFalse(result.ok)
        assertTrue(result.message, result.message.contains("非法路径"))
        assertFalse(File(tmp.root, "evil.py").exists())
    }
}
