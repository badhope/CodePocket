package com.devterminal.agent

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class SemanticIndexTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `finds related code block by concept`() {
        val root = temp.newFolder("project")
        File(root, "auth.kt").writeText(
            """
            fun login(user: String, password: String) {
                checkPassword(user, password)
                issueToken(user)
            }
            fun issueToken(user: String) = "token-${'$'}user"
            """.trimIndent()
        )
        File(root, "ui.kt").writeText("fun drawButton() { paintRed() }")
        val index = SemanticIndex(LocalWorkspace(root))
        val hits = index.search("登录 校验 token")
        assertTrue(hits.isNotEmpty())
        assertTrue(hits.first().path == "auth.kt")
    }
}
