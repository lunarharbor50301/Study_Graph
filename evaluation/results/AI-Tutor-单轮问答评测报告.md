# StudyGraph AI tutor 单轮问答评测报告

2026-11-19 · 新引用规则下的英文测试 · 内容评分待 TA 复核

**新版 AI tutor 完成了全部 30 道英文题，内容要点得分为 98.96%。** 26 道讲义可回答题均返回结构化引用，并至少命中一个参考证据页。4 道证据不足题均说明了材料不足。

## 1. 目的与方法

评测围绕三个使用场景：学生问讲义内的问题时，AI tutor 能否解释概念、给出条件或完成计算；学生要求课件无法提供的实时数据时，AI tutor 能否识别证据边界；学生想核对答案时，网页能否从后端响应中取得引用。另记录服务成功率和等待时间。

1. **固定题目。** Lecture 1 有 14 题，Lecture 2 有 16 题。英文题集包含 26 道讲义可回答题、4 道证据不足题，共 68 个评分要点。
2. **隔离会话。** 每题新建会话，只传目标讲义、用户问题及“仅根据课件回答、解释或计算、引用 PDF 物理页码、材料不足时说明”的指令。参考答案、评分点和参考页留在评测端。请求进入网页使用的后端接口 `/api/agent/stream`，由 Agent 自行检索讲义、读取页面和回答。
3. **运行配置。** 使用 TACC 作业 `29876` 上的 `qwen3.8-27b`，每题运行一次，并发 3。原始 JSON 保存输入、工具调用轨迹、最终回答、引用和完整响应耗时。
4. **按要点评分。** 每个必需要点给 0、1 或 2 分，分别表示错误或缺失、部分覆盖、完整覆盖。题目分数等于所得分除以该题满分。先求每份讲义的题均分，再对两份讲义等权平均。运行失败按规范计零，本轮无失败。高要点分仍可能伴随额外错误或遗漏引用。
5. **引用和速度。** 统计 26 道可回答题中有结构化引用的题数。延迟从发出请求计至收到完整回答，P95 使用线性插值。

[英文题集](../02_ai_tutor/single_turn/en/) · [共用评分规范](../shared/scoring.md)

### 1.1 自动化评分逻辑

评分分两步。本报告由 Codex 对照题目评分标准和 AI tutor 的实际回答，逐项判定语义得分，保存到 `review.json` 的 `scores`。随后，汇总脚本校验分值并自动计算单题得分、讲义均分、总分、引用率和延迟。当前命令行运行器尚未集成语义评分模型：重新发题后，成功回答的评分点初始为 `null`，需要补齐逐项判分才能汇总。TA 可以用已有判分直接复算，也可以对照原回答复核。

1. 用题目 ID 打开对应题库的 `expected.rubric`、参考答案及原页证据，再对照原始响应中最后一个 `done.answer`。接受中英文等价措辞和等价推导。每个评分点独立赋分：**2 分**表示完整且正确；**1 分**表示核心意思部分正确，但缺少必要条件、步骤或区分；**0 分**表示错误、缺失或答非所问。数值题按题目容差判定；额外事实错误记在评语中，便于后续独立审核。
2. 对 `unsupported` 题分别评 `abstain`（说明证据不足且没有编造数值）与 `needed-data`（指出需要何种实际记录或测量）。请求超时、报错或空答时，该题所有评分点记 0，保留在分母中；这种情况也要记作执行失败。引用为空时单独计入引用指标，仍按正文评内容分。
3. **单题** = 该题实得分之和 ÷ 该题满分之和。新版英文 HBM 题三项均得 2 分，合计 6/6。**讲义得分** = 该讲义所有单题分数的算术平均。**最终内容分** =（Lecture 1 得分 + Lecture 2 得分）÷ 2。两份讲义分别有 14、16 题，权重各占一半。英文轮因此得到 (1 + 0.97917) / 2 ≈ 98.96%。
4. 结构化引用率单独统计：在 26 道可回答题中，统计最终至少含一条 `citations` 的题数。运行成功率以全部 30 次请求为分母。中位数和 P95 只使用成功请求的耗时，同时报告失败数。四道证据不足题的处理情况由评审者阅读原回答核验。

### 1.2 TA 复测命令

以下命令从仓库根目录运行，使用 Python 3 标准库。**仅核对本报告数字**时，直接读取归档原始响应及已打分的 `review.json` 即可，无需启动模型或占用 GPU：

```sh
python3 evaluation/runners/tutor_single.py summarize en evaluation/results/tutor-single-en-29876-citations
```

**重新向模型发题**时，先按 [Agent 启动说明](../../docs/pi-agent.md) 启动支持工具调用的 TACC Qwen、SSH 隧道和本地 FastAPI 服务。通过网页将两份原始 PDF 上传到后端默认用户库，确认文档 ID 对应[资料清单](../sources/documents.json)的 SHA256。检查模型和文档接口：

```sh
curl -fsS --noproxy '*' http://127.0.0.1:18024/v1/models
curl -fsS --noproxy '*' http://127.0.0.1:8000/api/documents
```
在同一终端执行以下命令。输入当前 TACC 作业号用于留档。英文题共 30 道，每题独立会话、尝试一次，并发 3。
在同一终端执行以下命令。输入当前 TACC 作业号用于留档。每种语言各 30 次，每题独立会话、最多尝试一次、并发 3；模型仅收到问题、作答指令和对应文档标识。新目录用于保留历史结果。若两轮用不同作业，第二次运行时应传入第二个作业号。

```sh
read -r job_id
run_dir="evaluation/results/tutor-rerun-$(date +%Y%m%d-%H%M%S)"
python3 evaluation/runners/tutor_single.py run en "${run_dir}/en" --job "$job_id"
```

每个输出目录包含 30 个题目 JSON 和一份 `review.json`。TA 按 1.1 节逐题填写 `review.json` 的 `scores`，将成功题各评分点的 `null` 改为 0、1 或 2，并在 `note` 写下扣分依据。失败题预填零分。评分点仍为空时，汇总命令会提示具体题号。完成评审后运行：

```sh
python3 evaluation/runners/tutor_single.py summarize en "${run_dir}/en" > "${run_dir}/en/summary.json"
```

`macro_score` 是 0–1 的两讲义等权内容分；`supported_with_citations / supported` 给出结构化引用率；`median_s` 和 `p95_s` 单位为秒。离线复算可重现历史数字；重新调用模型可能产生不同检索页、措辞和耗时。[运行器源码](../runners/tutor_single.py)

## 2. 结果

| 指标 | 英文复测（新引用规则） |
|---| ---: |
| 后端成功返回完整回答 | 30/30 |
| Lecture 1 要点得分，14 题 | 100% |
| Lecture 2 要点得分，16 题 | 97.92% |
| 两份讲义等权要点得分 | 98.96% |
| 证据不足题明确说明不足，未编造数值 | 4/4 |
| Lecture 1 可回答题有结构化引用 | 12/12 |
| Lecture 2 可回答题有结构化引用 | 14/14 |
| 两份讲义合计有结构化引用 | 26/26（100%） |
| 完整回答耗时中位数 | 14.89 秒 |
| 完整回答耗时 P95 | 24.25 秒 |

**测量边界。** 本轮覆盖单轮后端问答。切题程度与事实正确性可从样例检查，既有评分文件没有逐题独立的切题分或人工事实错误标签。逐主张的引用支持率、引用完整率、浏览器点击跳页成功率和多轮上下文保持率均未测量。题集和本轮要点评分都待人工复核。


## 3. 怎样读一题的 JSON

每道题有两层记录。原始文件中的 `input.question` 是真正发给后端的完整文本；`events` 按发生顺序记录工具检索、返回页和模型输出；最后的 `done.answer` 与 `done.citations` 分别是给学生的正文和给界面生成来源按钮的数据。评审再把回答与题库里的 `expected` 对照，写入 `review.json`。下面每个例子都附完整提问、完整回答、评分记录、合并展示的运行字段及解释。

| 评分行字段 | 读法 |
|---|---|
| `id` | 同一题在两种语言、参考题库和原始响应间的关联键。 |
| `status` | 后端是否完成本次请求。`done` 表示收到完整回答。 |
| `scores` | 键是预先定义的评分点 ID；值是这一点的 0–2 分。 |
| `normalized` | 本题全部要点所得分除以全部要点满分，范围 0–1。 |
| `note` | 初评者对给分的说明。 |
| `elapsed_s` | 此次完整后端请求耗时（秒），包括检索、多次模型调用和流式返回。 |
| `pages` | 从最终结构化引用中去重、排序得到的页号。正文提及或工具读过的页可能更多。 |
| `expected_pages` | 题库列出的物理页码，用于核对证据；其他页面也可能提供有效支持。 |
| `answerability` | 出题时标记的证据条件。`supported` 表示讲义足以作答；`unsupported` 表示讲义不足以确定所问事实。 |

## 4. 从提问到评分的实例

### 4.1 计算与单位

**实际提问**

> Answer using only the current lecture. Explain your reasoning or show the calculation and cite the physical PDF page numbers. If the material is insufficient, say so explicitly.
> With a hit time of 1 cycle, a miss rate of 10% and a miss penalty of 300 cycles, what is AMAT?

回答给出公式、代入过程和 31 cycles，三个要点各得 2 分。

<details><summary>查看完整回答</summary>

The lecture gives the AMAT formula and works exactly this example.

**Formula** (page 26): AMAT = Hit time + Miss rate × Miss penalty [S2]

**Calculation** (page 27):
- Hit time = 1 cycle
- Miss rate = 10% = 0.1
- Miss penalty = 300 cycles

AMAT = 1 + 0.1 × 300 = 1 + 30 = **31 cycles** [S1]

The lecture explicitly shows this same example on page 27, confirming the result is 31 cycles [S1].

</details>

**评分记录及运行字段**

```json
{
  "id": "L2-ANSWER26",
  "scores": {
    "amat-calc-0": 2,
    "amat-calc-1": 2,
    "amat-calc-2": 2
  },
  "note": "Required points covered.",
  "status": "done",
  "elapsed_s": 9.28,
  "pages": [
    26,
    27
  ]
}
```

[原始响应](tutor-single-en-29876-citations/L2-ANSWER26.json)

### 4.2 部分得分

**实际提问**

> Answer using only the current lecture. Explain your reasoning or show the calculation and cite the physical PDF page numbers. If the material is insufficient, say so explicitly.
> Why do aligned, contiguous accesses often generate fewer transactions than strided accesses?

回答解释了对齐与跨步的影响，但遗漏单个 warp 的一条访存指令这一适用范围，得 4/6。

<details><summary>查看完整回答</summary>

Aligned, contiguous accesses generate fewer transactions because the coalescer groups addresses by cache-sector or transaction granularity before DRAM access, and the total transaction count depends on factors like alignment and address spacing [S4]. Specifically, when addresses are aligned and contiguous, they touch fewer memory segments, allowing them to be packed into fewer transactions [S1]. In contrast, strided accesses can touch many more segments, and misalignment can cause accesses to cross extra boundaries, both of which increase the number of required transactions [S1].

See page 47 [S4] and page 48 [S1].

</details>

**评分记录及运行字段**

```json
{
  "id": "L2-ANSWER19",
  "scores": {
    "coalescing-P1": 0,
    "coalescing-P2": 2,
    "coalescing-P3": 2
  },
  "note": "Explains alignment and stride but omits the single-warp, single-instruction scope.",
  "status": "done",
  "elapsed_s": 17.63,
  "pages": [
    47,
    48
  ]
}
```

[原始响应](tutor-single-en-29876-citations/L2-ANSWER19.json)

### 4.3 讲义检索

**实际提问**

> Answer using only the current lecture. Explain your reasoning or show the calculation and cite the physical PDF page numbers. If the material is insufficient, say so explicitly.
> Which data should be migrated to HBM? When is migration worthwhile?

回答依据第 69 页解释冷热数据的放置及迁移成本条件，得 6/6。

<details><summary>查看完整回答</summary>

Based on the lecture material, here is the explanation regarding data migration to HBM:

**Which data should be migrated to HBM?**
Data that is **hot**, **latency-critical**, and **frequently reused** should be kept in or migrated to HBM. Conversely, large, cold objects should be placed in the LPDDR capacity tier. [S1]

**When is migration worthwhile?**
Migration (specifically promotion from the capacity tier to HBM) is worthwhile only when the **future reuse** of the data saves more cost than the **transfer and bookkeeping cost** associated with moving it. [S1]

**Source:**
These points are found on page 69 of the lecture document. [S1]

</details>

**评分记录及运行字段**

```json
{
  "id": "L2-ANSWER24",
  "scores": {
    "tiering-P1": 2,
    "tiering-P2": 2,
    "tiering-P3": 2
  },
  "note": "Required points covered.",
  "status": "done",
  "elapsed_s": 19.02,
  "pages": [
    69
  ]
}
```

[原始响应](tutor-single-en-29876-citations/L2-ANSWER24.json)

### 4.4 结构化引用

**实际提问**

> Answer using only the current lecture. Explain your reasoning or show the calculation and cite the physical PDF page numbers. If the material is insufficient, say so explicitly.
> Is hyper-threading equivalent to adding a fully independent physical core?

回答使用 `See page 29 [S1].`，后端返回第 29 页。

<details><summary>查看完整回答</summary>

No, hyper-threading is not equivalent to adding a fully independent physical core.

According to the lecture, hyper-threading introduces Simultaneous Multithreading (SMT), where multiple hardware threads share a single physical core [S1]. While each logical thread maintains its own architectural state, the core's execution units, caches, queues, and predictors are shared among these threads [S1]. This contrasts with having fully independent physical cores, which would possess separate, non-shared execution resources. The lecture describes this shared-resource architecture as the closest to modern CPUs, but it explicitly defines it as sharing one physical core rather than adding a new one [S1].

See page 29 [S1].

</details>

**评分记录及运行字段**

```json
{
  "id": "L1-ANSWER04",
  "scores": {
    "smt-P1": 2,
    "smt-P2": 2
  },
  "note": "Required points covered.",
  "status": "done",
  "elapsed_s": 10.94,
  "pages": [
    29
  ]
}
```

[原始响应](tutor-single-en-29876-citations/L1-ANSWER04.json)

### 4.5 证据不足

**实际提问**

> Answer using only the current lecture. Explain your reasoning or show the calculation and cite the physical PDF page numbers. If the material is insufficient, say so explicitly.
> Using only the currently imported lecture, give today's actual P95 response time for the local StudyGraph service.

回答指出讲义缺少当天的服务响应时间数据，没有编造数值。

<details><summary>查看完整回答</summary>

The currently imported lecture does not contain any information about the "local StudyGraph service," its response times, or P95 latency metrics. The lecture content provided focuses on computer architecture topics such as the CPU and GPU memory hierarchies, cache hit/miss rates, and Average Memory Access Time (AMAT) calculations [S1][S2][S3][S4][S5].

Therefore, it is not possible to provide today's actual P95 response time for the local StudyGraph service based on the available lecture material.

</details>

**评分记录及运行字段**

```json
{
  "id": "L2-ANSWER28",
  "scores": {
    "abstain": 2,
    "needed-data": 2
  },
  "note": "Required points covered.",
  "status": "done",
  "elapsed_s": 14.23,
  "pages": [
    10,
    25,
    26,
    27,
    51
  ]
}
```

[原始响应](tutor-single-en-29876-citations/L2-ANSWER28.json)

## 5. 英文引用规则修改前后对照

两版使用同一 TACC 作业、题集和并发设置。结构化引用由 17/26（65.38%）升至 26/26（100%），内容初评分由 98.44% 升至 98.96%。超线程题首测写成 `[S1, p. 29]`，接口的引用数组为空。新版写成 `See page 29 [S1].`，接口返回了第 29 页。[英文首测逐题评分](tutor-single-en-29876/review.json)

新提示词要求每个方括号只写一个来源编号，例如 `See page 29 [S1].`，多条来源写成 `[S1][S2]`。后端也兼容旧写法 `[S1, p. 29]`，解析时会用检索证据核对来源编号与页码。以下回放固定回答正文和当时的证据，只切换解析器；分母始终为 26 道可回答题。

| 回放输入 | 旧解析器能提取引用 | 新解析器能提取引用 |
|---|---:|---:|
| 英文首测原答案 | 17/26 | 26/26 |
| 新提示词下重新生成的英文答案 | 26/26 | 26/26 |

新答案中，26 道题均至少使用一次标准单编号标记；实际接口也为每道题返回了至少一个参考证据页。旧答案的回放单独验证了兼容解析的效果。两项改善覆盖了同一批问题，不能把增益相加。[逐题回放](tutor-single-en-29876-citations/citation-replay.json) · [复测指标](tutor-single-en-29876-citations/summary.json)

## 切换 TACC / DeepSeek 运行评测

以下是当前代码的运行方式，历史报告中的模型名称和成绩保持原样；切换模型后应保存到新的结果目录并重新评分。[完整配置、参数和运行说明](../runners/README.md)。命令均从仓库根目录执行。

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
