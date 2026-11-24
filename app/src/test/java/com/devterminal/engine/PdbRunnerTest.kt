package com.devterminal.engine

import org.junit.Assert.assertTrue
import org.junit.Test

class PdbRunnerTest {
    @Test
    fun `runner drives pdb and preserves main semantics`() {
        val script = PdbRunner.SCRIPT
        assertTrue(script.contains("import pdb"))
        assertTrue(script.contains("pdb.run("))
        assertTrue(script.contains("\"__name__\": \"__main__\""))
        assertTrue(script.contains("\"__file__\": _target"))
        assertTrue(script.contains("sys.argv[1]"))
        assertTrue(script.contains("sys.argv = [_target] + _args"))
    }
}
