# Baseline 与 pi Agent 对照

运行前按 [pi 接入说明](pi-agent.md) 启动同一后端，导入同一份讲义。Baseline 调用现有 POST /api/ask，参数不含 tutor_context，执行一次 BM25 检索后生成答案。Agent 调用 POST /api/agent/stream，由模型决定是否检索或读页。前端 V1 助教的自主检索路径与这个单轮 Baseline 的参数有所区别，实验报告需要写明。

```powershell
.\.venv\Scripts\python -m evaluation.compare_agents http://127.0.0.1:8023 DOCUMENT_ID evaluation/agent-dev.json --output agent-dev-run.jsonl --repeats 3
```

脚本为每个系统、每道题和每次重复建立独立会话。同一题的 turns 按顺序运行，Agent 的追问复用该题的上下文。单轮 Baseline 按原行为逐条回答，使用相同会话 ID 不会增加记忆。某轮服务失败后跳过该会话后续追问，保留错误记录。系统执行顺序交替，减轻固定先后顺序对缓存和等待时间的影响。

每行 JSON 包含问题、完整答案、引用原文、实际工具过程、模型调用次数、服务端耗时、客户端耗时和首段文本等待时间。首段文本可能是 Agent 的中间说明，它与完整回答耗时分别记录。多轮上下文和追加检索同时变化，因此这项实验衡量整体系统收益，不能单独归因于某一种检索优化。单轮题可单独汇总。

题目支持 evidence_groups，例如 [[66],[67]] 表示两个要点各需一个来源；[[65,66],[67]] 表示第一个要点可由第 65 或 66 页支持。脚本检查所有组是否覆盖，并把结果写入 required_evidence_covered。旧的 pages 字段只记录任一参考页命中。页码覆盖无法证明答案正确或引用支持结论，人工继续填写 review 中的答案完整性、引用支持度、拒答是否合适和备注。一般知识回答没有引用时，应结合题目用途判定。

agent-dev.json 是根据已用的 ACS 讲义准备的候选开发题，参考要点需要组员复核。它们属于开发材料。正式保留题由评测组维护，执行时仅将 question、context 和 page 发给服务端，key_points、evidence_groups 等评审字段只保留在本地结果中。

结果文件使用独占创建模式，已存在的文件会报错，防止覆盖之前的实验。终端输出各系统成功与失败轮数、成功轮次的中位数与最大耗时。正式实验还应记录代码提交号、模型名、pi 版本、vLLM 配置、GPU 作业、预热方式和文档版本，以便复现。

2026-11-15 在 TACC 作业 `29134`（两张 RTX 3090，vLLM 0.26.0，`qwen3.8-27b`）完成真实模型联调。使用 `evaluation/agent-smoke.json` 和 `--systems agent` 测试 ACS Lecture 1。问候和身份问题均直接作答，完整用时 1.9–2.8 秒。读页、检索和追问三轮完整用时 6.8–9.0 秒，首段正文 4.5–5.5 秒。浏览器验证了查看检索记录、跳转到引用页和刷新恢复会话。

开发题 `evaluation/agent-dev.json` 的一次复测中，Baseline 与 Agent 各完成 4 轮，完整响应的中位数约为 2.4 秒和 12.1 秒。Agent 的跨页题用了 3 次模型调用，耗时约 31 秒。该批次样本少，包含一次冷启动后的服务进程和前缀缓存，适合验证流程。正式评测应单独记录预热方式，扩大题目数和重复次数。

联调中发现两处兼容问题。第三次模型调用改用纯回答请求后，缺少证据的价格题能明确说明无法从讲义确认。解析同一括号中的多个来源 ID 后，跨页题再次实测耗时 29.9 秒，返回第 65、66、67 页，覆盖两个要求的证据页。

## 证据复用对照

在相同代码上启动两个本地后端并连接同一个 TACC 模型。对照组把 `STUDYGRAPH_AGENT_REUSE_EVIDENCE` 设为 `0`，实验组设为 `1`。实验组提示 Qwen 在已有原文足以回答时直接作答，仍允许为缺少的细节调用工具。两组使用独立会话，每道题先后顺序交替，追问保留本组的历史。分别预热后运行：

```powershell
.\.venv\Scripts\python -m evaluation.compare_agents http://127.0.0.1:8031 DOCUMENT_ID evaluation/agent-dev.json --systems agent --agent-candidate-url http://127.0.0.1:8032 --repeats 2 --output evidence-ab.jsonl
```

评测 JSONL 的 `events` 现在包含每次调用的 `model_end`。其中 `duration_ms` 是模型调用从启动到结束的耗时，`first_text_ms` 从本次模型调用开始计时，无文字时为 `null`，`stop_reason` 区分工具调用和作答结束。`tool_result` 的 `model_call` 标明工具属于哪次模型调用。`client_total_ms` 包括完整往返，记录顶层 `first_text_ms` 时仍可能先收到模型的中间说明。

在 TACC 作业 `29134` 上对 ACS 开发题执行了两轮，每组完成 8 次回答。以下时间为完整回答中位数。

| 题目 | 现有 Agent | 证据复用提示 |
|---|---:|---:|
| 全部 | 11.0 秒 | 8.4 秒 |
| Amdahl 和 Roofline 跨页比较 | 29.3 秒 | 27.2 秒 |
| Roofline 概念题 | 10.2 秒 | 7.0 秒 |
| Roofline 追问 | 9.9 秒 | 7.3 秒 |
| 讲义未给出 GPU 价格 | 11.7 秒 | 9.7 秒 |

两组各调用模型 20 次，实际工具执行从 18 次降到 14 次。两组的 6 次有参考页的回答都覆盖所需页码，且两次价格题都说明证据不足。实验组跨页题仍需三次模型调用，最后一次生成约 16–17 秒，接下来可以单独测试限制回答篇幅的影响。实验组在本批题上的总耗时较低，尚需用其他讲义和保留题检查质量与延迟，因此提示保持可选。原始记录保存在本地 `.venv/agent-evidence-ab-29134.jsonl`。

## 简洁回答对照

两个后端都设置 `STUDYGRAPH_AGENT_REUSE_EVIDENCE=1`。对照组使用 `STUDYGRAPH_AGENT_CONCISE_ANSWERS=0`，实验组设为 `1`。实验组建议先给结论，普通题约 60–120 个英文词，比较题为每个要点保留引用，公式、推导和学生明确要求的细节按需展开。长度由提示引导。

分别预热后，用上一节的命令把端口换成 `8033` 和 `8034`，仍使用 `evaluation/agent-dev.json` 和 `--repeats 2`。`model_end.output_tokens` 来自模型服务的使用量回报，用于检查回答变短了多少。原始记录保存在本地 `.venv/agent-concise-ab-29134.jsonl`。

在 TACC 作业 `29134` 上，两组各完成 8 次回答。跨页题的完整回答中位数从 26.8 秒降至 12.5 秒，两次都从三次模型调用降到两次，最终输出从 640 tokens 降到 264–278 tokens，同时保留第 66、67 页引用和两种性能上限的区别。Roofline 追问则从 9.1 秒升至 12.0 秒，两次都多调用了一次模型。两组有参考页的回答均命中所需页码，缺少证据的价格题均说明无法确认。整批中位数从 9.0 秒升至 10.0 秒，因此简洁提示保持可选。下一次实验应检查追问能否直接使用会话里已有的证据，并用需要新证据的追问验证仍能继续检索。

## 追问复用上一轮引用

两组都开启 `STUDYGRAPH_AGENT_REUSE_EVIDENCE` 和 `STUDYGRAPH_AGENT_CONCISE_ANSWERS`。只在实验组设置 `STUDYGRAPH_AGENT_FOLLOWUP_EVIDENCE=1`。实验组把上一条回答引用过的同一讲义原文交给模型，每次最多四条、每条最多 1800 字符。模型仍有工具可用，旧工具记录从本次请求中省略，本轮的工具调用和工具结果继续保留。

两个会话都从算术强度的定义问起。第一个追问可以用第 67 页的公式推导。第二个追问引入 Amdahl 定律，需要补找第 66 页。

```powershell
.\.venv\Scripts\python -m evaluation.compare_agents http://127.0.0.1:8037 DOCUMENT_ID evaluation/agent-followup-dev.json --systems agent --agent-candidate-url http://127.0.0.1:8038 --repeats 2 --output followup-ab.jsonl
```

TACC 作业 `29155` 上两组各完成 8 次回答。证据足够的追问从 10.8 秒降到 2.9 秒，两次都从三次调用降到一次，无需再检索，答出了带宽不变时上限翻倍并引用第 67 页。需要新资料的追问从 14.0 秒升到 14.5 秒，两组每次都用了两次模型调用，并找到第 66 和 67 页。实验组第二次将引用写成 `(S4, p. 66)` 形式，旧解析器未暴露可点击引用。解析器现在接收这种格式，并按实际证据核对来源 ID 和页码。追问优化保持可选，原始对照记录位于本地 `.venv/agent-followup-ab-29155.jsonl`。

修正解析器后在同一作业复测。已有证据的追问仍只调用一次模型并引用第 67 页，实测 5.7 秒。需要新证据的追问调用两次模型并返回第 66、67 页引用，实测 16.0 秒。本地回归验证组合引用、括号式引用和页码不匹配的情况。

## 切换 TACC / DeepSeek 运行评测

以下是当前代码的运行方式，历史报告中的模型名称和成绩保持原样；切换模型后应保存到新的结果目录并重新评分。[完整配置、参数和运行说明](../evaluation/runners/README.md)。命令均从仓库根目录执行。

先启动 TACC 模型及 SSH 隧道，然后在运行评测脚本的终端设置地址并检查接口：

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

直接调用 TACC 的评测脚本不需要 DeepSeek API key。改用 DeepSeek 时，需要在当前进程配置 `DEEPSEEK_API_KEY`。如果密钥已保存在项目 `.env` 中，可以加载：

```bash
set -a
source .env
set +a
```

AI tutor 运行器通过 HTTP 访问后端，没有 `--provider` 参数。在**后端终端**加载配置后启动一个独立的 TACC 后端（端口需空闲）：

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
export STUDYGRAPH_TUTOR_PROVIDER=tacc
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18031
```

确认两份讲义已导入该后端，在另一终端选择单轮或多轮运行；`CURRENT_JOB_ID` 替换为实际作业号：

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en evaluation/results/tutor-single-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
.venv/bin/python -m evaluation.runners.tutor_multi evaluation/results/tutor-multi-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
```

改用 DeepSeek 时，在后端启动环境配置 key，并设 `STUDYGRAPH_TUTOR_PROVIDER=deepseek` 后重启；不要把 TACC 作业号当作 DeepSeek 模型信息。仅在评测脚本终端改变量不会改变已运行后端。上述命令只生成回答，语义评分仍需另行审核；固定习题已包含在单轮中，不重复计数。历史压缩在满足条件且存在 DeepSeek key 时仍可能调用 DeepSeek；要求仅用 TACC 时，应在后端进程中取消该 key，使该可选压缩不执行。
