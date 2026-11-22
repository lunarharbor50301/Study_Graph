# StudyGraph · B 检索与模型 — Progress

**Overall:** 65%  
**Updated:** 2026-11-10 04:44 UTC

11 月 10 日，lyq 分支 f034a52。真实英文讲义问答已跑通，65% 为 B 岗三周里程碑估算。

| Item | Progress | Status | Evidence / note |
| --- | ---: | --- | --- |
| 文件导入与检索 | 85% | in progress | PDF/PPTX 已实测；13 道英文开发题 Top1 12/13，Top4 13/13。复杂课件、扫描页和更多讲义待验证。 |
| 真实模型问答 | 100% | complete | TACC 模型复测三道改写题引用正确，两道范围外问题均返回证据不足。 |
| 团队集成 | 50% | in progress | 已有 API 和参考页面，概念映射、多轮上下文和 Tests 出题调用待对接。 |
| 性能与正式评测 | 45% | in progress | 五题检索 1.46–3.39 ms，模型往返 4.03–9.48 s；待拆分耗时并做对照。 |
| 报告与展示 | 0% | pending | 待正式实验结果。 |

## Next actions

- 接入 C 的概念来源映射，与 A 验收点击概念、提问、跳页和追问
- 准备独立保留集与直接问答对照，测量一次优化前后的质量及耗时

## 切换 TACC / DeepSeek 运行评测

以下是当前代码的运行方式，历史报告中的模型名称和成绩保持原样；切换模型后应保存到新的结果目录并重新评分。[完整配置、参数和运行说明](evaluation/runners/README.md)。命令均从仓库根目录执行。

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

按评测角色选择以下命令。所有命令均使用项目的 `.venv/bin/python`，输出路径需尚未存在。

**1. TACC 出题，并使用 TACC 评分**

```bash
.venv/bin/python -m evaluation.runners.quiz \
  --provider tacc \
  --output-dir evaluation/results/quiz-tacc-new
```

如果希望由 TACC 出题、DeepSeek 担任裁判：

```bash
.venv/bin/python -m evaluation.runners.quiz \
  --provider tacc \
  --judge-provider deepseek \
  --output-dir evaluation/results/quiz-tacc-deepseek-new
```

**2. TACC 批改学生答案**

```bash
.venv/bin/python -m evaluation.runners.grading_feedback \
  --provider tacc \
  --workers 1 \
  --output-dir evaluation/results/grading-tacc-new
```

**3. TACC 对已有概念图进行语义评分**

以下以 Lecture 1 的现有预测为例，只重新评分，不重新生成概念图：

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/v0.5-en/lecture1.json \
  --prediction evaluation/results/v0.5-en-20261119/l1/prediction.json \
  --judge tacc \
  --output evaluation/results/l1-tacc-metrics-new.json
```

**4. 概念图生成与 AI tutor：切换后端模型**

在后端终端中加载配置后，设置模型并启动后端。示例端口 `18031` 必须空闲；若后端已经运行，需要停止旧进程后重新启动，或选择另一个空闲端口。

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
export STUDYGRAPH_GENERATION_PROVIDER=tacc
export STUDYGRAPH_TUTOR_PROVIDER=tacc

.venv/bin/python -m uvicorn backend.main:app \
  --host 127.0.0.1 \
  --port 18031
```

在另一终端运行 HTTP 评测时，将 `--base-url` 指向这个后端，例如：

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en \
  evaluation/results/tutor-single-tacc-new \
  --base-url http://127.0.0.1:18031 \
  --job CURRENT_JOB_ID
```

将 `CURRENT_JOB_ID` 替换为实际 TACC 作业号，并确保两份讲义已导入该后端。此命令生成回答，语义评分仍需另行审核。

切回 DeepSeek 时，将相应命令参数中的 `tacc` 改为 `deepseek`。对于 HTTP 评测，要修改后端终端中的配置并重启后端：

```bash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_TUTOR_PROVIDER=deepseek
```

题集校验、页码覆盖检查、基于保存评分的汇总不调用模型，无需切换。
