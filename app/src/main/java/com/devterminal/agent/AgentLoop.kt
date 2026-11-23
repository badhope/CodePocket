package com.devterminal.agent

import com.devterminal.model.ModelMessage
import com.devterminal.model.ModelProvider
import com.devterminal.workspace.Workspace
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 写操作审批策略。读操作默认自动，写操作必须由 UI 或调用方显式批准。
 */
class ApprovalPolicy(
    val autoApproveReadOnly: Boolean = true,
    val autoApproveWrites: Boolean = false,
) {
    fun requiresApproval(spec: ToolSpec): Boolean =
        (spec.mutatesWorkspace || spec.executesCommand) && !autoApproveWrites
}

fun interface ApprovalHandler {
    suspend fun approve(call: ToolCall): Boolean
}

data class AgentRunResult(
    val success: Boolean,
    val summary: String,
    val steps: Int,
)

/**
 * 最小可用的 Agent 循环：
 * 模型决策 → 工具调用 → 观察写回 → 再决策，直到 final 或触顶。
 *
 * 所有事件通过 emit 回调输出，UI 只消费事件，不反向驱动循环。
 */
class AgentLoop(
    private val workspace: Workspace,
    private val tools: ToolRegistry,
    private val provider: ModelProvider,
    private val parser: AgentDecisionParser = JsonAgentDecisionParser(),
    private val checkpoints: CheckpointStore? = null,
    private val approvalPolicy: ApprovalPolicy = ApprovalPolicy(),
    private val approve: ApprovalHandler = ApprovalHandler { false },
    private val maxSteps: Int = 8,
    private val contextBuilder: ContextBuilder = ContextBuilder(),
    /** 先输出计划、等用户批准后才调用工具；对标 Cursor / Claude Code 的 Plan 模式。 */
    private val planFirst: Boolean = false,
    private val approvePlan: suspend (AgentEvent.Plan) -> Boolean = { true },
    /** 子 Agent 等场景可替换系统提示词；null 时用默认代码 Agent 提示词。 */
    private val systemPromptOverride: String? = null,
) {
    suspend fun run(
        task: String,
        priorMessages: List<ModelMessage> = emptyList(),
        emit: suspend (AgentEvent) -> Unit,
    ): AgentRunResult {
        require(task.isNotBlank()) { "Agent task is blank" }
        emit(AgentEvent.SessionStarted(workspace.root.absolutePath))
        emit(AgentEvent.UserMessage(task))

        val repoMap = withContext(Dispatchers.IO) {
            runCatching {
                RepoMapBuilder(workspace).build(task, contextBuilder.repoMapMaxChars)
            }.getOrNull()
        }
        val rules = withContext(Dispatchers.IO) {
            runCatching { ProjectRules.read(workspace) }.getOrNull()
        }
        val systemPrompt = contextBuilder.systemPrompt(
            (systemPromptOverride ?: SYSTEM_PROMPT) + if (planFirst) PLAN_INSTRUCTION else "",
            repoMap?.text,
            rules,
        )
        repoMap?.let {
            emit(AgentEvent.ContextBuilt(
                it.files.size,
                it.totalFiles,
                it.text.length,
                tokens = contextBuilder.estimateTokens(systemPrompt),
            ))
        }

        val history = priorMessages.toMutableList()
        history += ModelMessage("user", task)
        var lastFailure = ""

        if (planFirst) {
            val planRaw = try {
                provider.complete(
                    systemPrompt = systemPrompt,
                    messages = contextBuilder.compactHistoryFor(history, systemPrompt),
                    tools = tools.specs(),
                    maxTokens = provider.maxOutputTokens,
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val message = "计划生成失败：${e.message ?: e::class.simpleName}"
                emit(AgentEvent.Failure(message))
                return AgentRunResult(false, message, 0)
            }
            val plan = when (val decision = parser.parse(planRaw)) {
                is AgentDecision.Plan -> decision
                is AgentDecision.Final -> {
                    val message = "计划模式要求先输出计划 JSON，模型却直接给了最终答案。请重试，或在面板关闭计划模式。"
                    emit(AgentEvent.Failure(message))
                    return AgentRunResult(false, message, 0)
                }
                is AgentDecision.Invalid -> {
                    val message = "计划无法解析：${decision.reason}"
                    emit(AgentEvent.Failure(message))
                    return AgentRunResult(false, message, 0)
                }
                is AgentDecision.ToolCall -> {
                    val message = "计划阶段不允许调用工具，模型却请求了 ${decision.tool}"
                    emit(AgentEvent.Failure(message))
                    return AgentRunResult(false, message, 0)
                }
            }
            val planEvent = AgentEvent.Plan(plan.steps)
            emit(planEvent)
            val approved = try {
                approvePlan(planEvent)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val message = "计划审批失败：${e.message}"
                emit(AgentEvent.Failure(message))
                return AgentRunResult(false, message, 0)
            }
            emit(AgentEvent.Approval(planEvent.id, approved))
            if (!approved) {
                val message = "用户拒绝了计划"
                emit(AgentEvent.Failure(message))
                return AgentRunResult(false, message, 0)
            }
            history += ModelMessage("assistant", planRaw.take(1200))
            history += ModelMessage("user", "计划已批准，请开始执行。每完成一步就继续下一步，全部完成后给出 final。")
        }

        for (step in 1..maxSteps) {
            val raw = try {
                provider.complete(
                    systemPrompt = systemPrompt,
                    messages = contextBuilder.compactHistoryFor(history, systemPrompt),
                    tools = tools.specs(),
                    maxTokens = provider.maxOutputTokens,
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val message = "模型调用失败：${e.message ?: e::class.simpleName}"
                emit(AgentEvent.Failure(message))
                return AgentRunResult(false, message, step)
            }

            when (val decision = parser.parse(raw)) {
                is AgentDecision.Final -> {
                    emit(AgentEvent.SessionFinished(decision.answer))
                    return AgentRunResult(true, decision.answer, step)
                }

                is AgentDecision.Invalid -> {
                    lastFailure = "模型输出无法解析：${decision.reason}"
                    emit(AgentEvent.Failure(lastFailure))
                    history += ModelMessage("assistant", raw.take(1200))
                    history += ModelMessage("user", "上一条不是合法 JSON。请只输出一个 JSON 对象。")
                }

                is AgentDecision.Plan -> {
                    lastFailure = "计划已批准，执行阶段请直接调用工具或 final"
                    emit(AgentEvent.Failure(lastFailure))
                    history += ModelMessage("assistant", raw.take(1200))
                    history += ModelMessage("user", lastFailure)
                }

                is AgentDecision.ToolCall -> {
                    val call = ToolCall(
                        id = "call-$step-${decision.tool}",
                        name = decision.tool,
                        arguments = decision.arguments,
                    )
                    val tool = tools.get(call.name)
                    if (tool == null) {
                        lastFailure = "未知工具：${call.name}"
                        emit(AgentEvent.ToolCall(call.id, call.name, call.arguments))
                        emit(AgentEvent.ToolResult(
                            callId = call.id,
                            ok = false,
                            output = lastFailure,
                        ))
                        history += ModelMessage("assistant", raw.take(1200))
                        history += ModelMessage("user", "工具结果：$lastFailure")
                        continue
                    }

                    emit(AgentEvent.ToolCall(call.id, call.name, call.arguments))

                    if (approvalPolicy.requiresApproval(tool.spec)) {
                        val proposal = buildProposal(call)
                        emit(proposal)
                        val approved = try {
                            approve.approve(call)
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            emit(AgentEvent.Failure("审批失败：${e.message}"))
                            return AgentRunResult(false, "审批失败", step)
                        }
                        emit(AgentEvent.Approval(proposal.proposalId, approved))
                        if (!approved) {
                            val message = "用户拒绝了 ${call.name}"
                            emit(AgentEvent.Failure(message))
                            return AgentRunResult(false, message, step)
                        }
                    }

                    if (tool.spec.mutatesWorkspace && checkpoints != null) {
                        val path = call.arguments["path"]
                        if (path.isNullOrBlank()) {
                            val message = "${call.name} 缺少 path，无法创建检查点"
                            emit(AgentEvent.Failure(message))
                            return AgentRunResult(false, message, step)
                        }
                        val checkpoint = try {
                            withContext(Dispatchers.IO) {
                                checkpoints.snapshot("${call.name}: $path", listOf(path))
                            }
                        } catch (e: Exception) {
                            val message = "创建检查点失败：${e.message}"
                            emit(AgentEvent.Failure(message))
                            return AgentRunResult(false, message, step)
                        }
                        emit(AgentEvent.Checkpoint(checkpoint.id, checkpoint.label))
                    }

                    val result = withContext(Dispatchers.IO) {
                        tools.execute(call, workspace)
                    }
                    emit(AgentEvent.ToolResult(call.id, result.ok, result.output, result.truncated))
                    if (call.name == "apply_patch" && result.ok) {
                        emit(AgentEvent.PatchApplied(call.id, listOfNotNull(call.arguments["path"])))
                    }

                    history += ModelMessage("assistant", raw.take(1200))
                    history += ModelMessage(
                        "user",
                        "工具结果（${call.name}，ok=${result.ok}，truncated=${result.truncated}）：\n" +
                            result.output.take(3000),
                    )
                    if (!result.ok) lastFailure = result.output
                }
            }
        }

        val message = if (lastFailure.isBlank()) {
            "超过最大步数（$maxSteps），已停止"
        } else {
            "超过最大步数（$maxSteps），最后错误：$lastFailure"
        }
        emit(AgentEvent.Failure(message))
        return AgentRunResult(false, message, maxSteps)
    }

    private fun buildProposal(call: ToolCall): AgentEvent.PatchProposed {
        val path = call.arguments["path"].orEmpty()
        if (call.name != "apply_patch") {
            val detail = call.arguments.entries.joinToString("\n") { "${it.key}=${it.value.take(200)}" }
            return AgentEvent.PatchProposed(
                proposalId = call.id,
                paths = listOfNotNull(path.takeIf { it.isNotBlank() }),
                diff = "工具：${call.name}\n$detail",
            )
        }
        val start = call.arguments["start"]?.toIntOrNull()
        val end = call.arguments["end"]?.toIntOrNull()
        val replacement = call.arguments["replacement"].orEmpty()
        val old = if (path.isNotBlank() && start != null && end != null) {
            runCatching { workspace.readText(path, start.coerceAtLeast(1), 60).numbered() }
                .getOrElse { "(无法读取原文件：${it.message})" }
        } else {
            "(缺少 path/start/end)"
        }
        val diff = buildString {
            append("路径：$path\n")
            append("替换行：${start ?: "?"}-${end ?: "?"}\n")
            append("--- 原内容 ---\n").append(old.take(2500)).append('\n')
            append("+++ 替换为 +++\n").append(replacement.take(2500))
        }
        return AgentEvent.PatchProposed(
            proposalId = call.id,
            paths = listOfNotNull(path.takeIf { it.isNotBlank() }),
            diff = diff,
        )
    }

    companion object {
        const val SYSTEM_PROMPT =
            "你是 CodePocket 的代码 Agent。你可以读取、搜索、按行修改当前项目，并依据工具结果继续决策。" +
                "不要臆测文件内容；修改前先读取。回答中文、简短。" +
                "改完代码必须调用 run_tests 验证；项目没有测试时至少用 run_file 跑一次被改动的入口。" +
                "只有工具结果 ok=true 才能说验证通过，不要凭空声称已验证。" +
                "遇到需要先读很多文件才能回答的独立探索，可调用 delegate_task 交给只读子 Agent，拿结论后再动手。"

        const val PLAN_INSTRUCTION =
            "当前是计划模式。先不要调用任何工具，只输出一个计划 JSON：" +
                "{\"action\":\"plan\",\"steps\":[\"步骤1\",\"步骤2\"]}。" +
                "步骤要具体到文件与动作，最多 6 步；等用户批准后再执行。"
    }
}
