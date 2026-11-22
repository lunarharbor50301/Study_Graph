# StudyGraph 下一阶段开发计划

这份计划用于安排接下来的开发和小组联调。分工沿用 [kickoff](kickoff.md)，阶段按交付物推进。团队可以在各模块完成联调后再决定版本名。

这一阶段要交付两条能演示的流程。Learning 中，学生用一份新上传的英文课件提问、追问，并从答案打开支持结论的原页。Tests 中，学生按概念生成一套题，逐题作答，获得针对错误的提示，重答后查看整套结果和复习页码。团队同时需要一份可复现的评测，说明 Agent 在哪些题上更有用、增加了多少等待时间。

## 从哪里接着做

- **Learning** 已用真实 TACC Qwen 验证流式回答、课件搜索、整页阅读、跨轮引用和刷新恢复。单次开发题复测中，Baseline 和 Agent 的完整回答中位数分别约为 2.4 秒和 12.1 秒，复杂跨页题约 30 秒。数据来自小样本，正式比较需要重新测量。详见 [Agent 评测说明](agent-evaluation.md)。
- **Tests** 已能按概念查找证据并生成套题草稿。真实套题的作答草稿目前由页面临时保留。接下来要把套题、每次作答、提示和整套结果串起来，支持刷新后继续。
- **课件导入** 已支持 PDF 和 PPTX。下一步用其他真实课件检验解析、预览和检索；以英文材料为主，优先覆盖团队能共享的课件。

## 开发顺序和交付

| 阶段 | 主要工作 | 完成标志 |
|---|---|---|
| 1. 定住基线 | B 保存当前 TACC 配置、代码版本和开发题结果，补齐首段文字、总耗时、模型调用次数及各轮工具耗时。C 和 B 确认评测分类和保留题划分。A 整理现有页面流程和接口差异。 | 同一条命令可在同一份讲义上复跑 Baseline 和当前 Agent。小组知道每个字段和指标的含义。 |
| 2. 优化 Learning | B 先减少重复工具调用，检查追问能否复用上一轮证据，再试控制证据输入和回答长度。A 可以并行核对等待状态、停止、刷新恢复和引用跳页。 | 普通题更早看到正文；跨页题仍答全要点并给出支持每个要点的引用。每项改动都用同一批开发题对比。 |
| 3. 验证导入和检索 | C 提供可共享课件及关键内容所在页。B 验证至少一份新 PDF 和一份 PPTX，覆盖多栏、图表、公式及扫描页；记录提取失败和预览差异。B 在英文术语、缩写、同义改写上对照 BM25 与英文向量或混合检索。 | 能用新课件完成预览、检索、问答和引用跳页。保留能改善参考页召回或回答的检索方案，并记录延迟和索引代价。 |
| 4. 串起 Tests | C 给出一套有评分依据、典型错答和分步提示的样例，定义作答记录及计分规则；B 提供题目证据和受评分依据约束的提示、解释接口；A 接套题进度、逐题提交、提示、重答和结果页。三人先对齐 ID 和返回样例，随后可与阶段 2、3 并行开发。 | 用真实课件生成一套有出处的题，学生答错、按提示重答，刷新后能继续，结果页能核对历次作答和对应讲义页。 |
| 5. 冻结并正式评测 | 三人冻结代码、课件、题目、模型和评测口径。B 跑两种问答模式，C 汇总人工核对和典型错误，A 验证完整学生操作路径并组织演示。 | 交付逐题记录、质量和耗时对照、典型失败案例，以及可以按文档复现的演示。 |

## 接口与小组协作

- **Learning**。A 沿用现有问答和 Agent 接口，传当前讲义、会话及页面上下文。B 返回流式事件、实际调用记录和可跳转引用。若优化需要新返回字段，先补文档和样例，再与 A 接入。
- **Tests**。以 `document_id`、套题 ID、题目 ID 和作答 ID 串起证据与学生记录。沿用现有套题生成入口；继续测验、提示、提交和完成等接口先参考 [接口草案](document-api.md)，由 A、B、C 对齐后落地。C 定义评分、提示层级和保存规则，B 负责从原页取证及调用模型，A 负责页面交互。首次提示指出错误方向，完整解答按 C 约定的时机展示。
- **并行开发**。涉及同一接口时，先在文档中写清输入、输出、缺证据与服务失败的示例。A、C 可以基于同一份样例开发，由 B 在联调时替换为真实接口。每阶段收尾时核对一次接口和演示流程。

## 怎么判断改动值不值得留

- **速度**。同一份讲义、同一模型和预热条件下，分别测首段正文和完整回答时间，报告中位数、慢请求和超时次数。普通讲义题完整回答先以 5–8 秒、复杂跨页题以约 15 秒作为优化目标，再根据实测调整。
- **质量**。B 与 C 逐题核对必答要点、原文是否支持引用，以及证据不足时的回答是否恰当。跨页题按每个必答要点及其出处核验。关键要点或引用明显退步时，即使更快也暂不采用。
- **评测集与操作验收**。先用开发题调试。正式评测按 kickoff 准备约 20 道讲义问答题并预留一部分作最终测试，覆盖直接查找、同义改写、跨页综合、追问和证据不足。A 另按学生操作任务验收，C 检查典型错答是否收到相应提示，及重答记录是否正确。

## 开工后的第一批任务

1. **B** 复跑已验证的真实问答和跨页题，补齐逐轮耗时，找出一次可省的检索或模型往返，再做单项前后对比。同步把目前的接口和运行方式整理给组员。
2. **C** 准备一份可共享的英文课件、对应的评测页码，以及一套带评分规则、错答和提示的样例题。课件和评测样例可以分批交付。
3. **A** 按套题样例梳理作答、提示、重答和恢复流程，与 B、C 确认字段及状态。可以先从当前的页面草稿接入。

第一轮小组验收各走一次真实路径：一题包含跨页证据的 Learning 问答，以及一道从错答到重答的 Tests 题。验收记录用来决定接下来优先修速度、证据覆盖，还是练习反馈。

B 已在 TACC 上补齐逐次模型计时，并完成首轮证据复用对照。跨页题最后一次生成仍占约 16–17 秒，下一项实验是控制回答篇幅，然后核对两页引用和必答要点。详见 [对照数据与复现方式](agent-evaluation.md#证据复用对照)。

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
