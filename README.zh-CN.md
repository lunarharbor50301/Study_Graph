[English](README.md) · **简体中文**

# StudyGraph

StudyGraph 将课程讲义转成学习工作区。学生可以浏览概念图、对照讲义原页阅读笔记、向 AI 助教提问，也可以生成并完成练习测验。

## 快速开始（Getting Started Instructions）

### 安装与启动

在仓库根目录执行以下命令。使用 Python 3.12 和 Node.js 24，首次安装依赖需要联网。本地快速检查使用 SQLite 和仓库自带的 Lecture 1 PDF，无需模型密钥。启用模型生成需要 DeepSeek API Key 或可访问的 TACC Qwen 服务。报告中的助教实验使用 TACC Qwen。

**macOS / Linux（Bash）**

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm ci --prefix agent --ignore-scripts
npm run build --prefix frontend
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**Windows（PowerShell）**

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm ci --prefix agent --ignore-scripts
npm run build --prefix frontend
.\.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

打开 `http://127.0.0.1:8000/` 访问应用，或打开 `http://127.0.0.1:8000/docs` 查看接口。FastAPI 同时提供后端接口和构建好的 React 页面。上传文档、检索索引和 Agent 对话存入 SQLite，课程架、已保存测验和作答进度保存在浏览器本地。

### 最小端到端检查

保持服务运行，在第二个终端上传仓库自带的 Lecture 1 PDF。下方使用 Bash 的 `curl`，在 Windows PowerShell 中使用 `curl.exe`。

```bash
curl -fsS -F "file=@evaluation/ACS_Lecture_1_2026F.pdf" http://127.0.0.1:8000/api/documents
```

成功时接口返回 HTTP 201，JSON 中应有 `"page_count":67` 和文档 ID `34911c46e78edc833f283f8dd678b85d6f8c92d66859e6bf6886949181d95402`。用返回的文档 ID 打开同一服务的 `/api/documents/{document_id}/pages/67/preview`，应看到 Roofline Model 幻灯片。

也可以在网页里用 User A 打开课程架上的 **AI Computing Foundations**，选择第 5 题，点击 **Page 67** 查看来源。输入 `200 GFLOP/s memory-bound` 并提交，可检查评分和反馈。在项目虚拟环境中运行 `python -m unittest backend.test_smoke backend.test_documents`，预期输出 `OK`。

### 启用模型功能

从 `.env.example` 创建本地 `.env`，填入自己的 `DEEPSEEK_API_KEY`。助教测试设为 `STUDYGRAPH_TUTOR_PROVIDER=tacc`，并将 `QWEN_BASE_URL` 指向带 `/v1` 后缀且可访问的 OpenAI 兼容服务。Pi Agent 需要原生工具调用支持。使用有 GPU 权限的课程账号，在 `deploy/tacc-agent/` 运行 `tcloud submit`，查看作业日志。模型启动后，按 `docs/pi-agent.md` 里的持久 SSH 命令，把本地 18024 端口转发到作业日志给出的节点和端口。确认 `/v1/models` 返回 `qwen3.8-27b` 后再测助教。仓库中的作业配置申请两张 GPU，时限一小时。提交前按实际分配核对节点排除配置。

在后端终端加载 `.env` 后重启。Bash 依次运行 `set -a`、`source .env` 和 `set +a`。PowerShell 在执行上面的启动命令前运行：

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
}
```

Windows 安装依赖并构建后，也可用 `.\scripts\studygraph.cmd -NoTaccWait` 启动。启动脚本默认等待已提交的 TACC 服务。完整 PPTX 版式预览需要在后端机器安装 LibreOffice。若 `soffice` 不在 PATH，设置 `SOFFICE_PATH`。基础环境可提供 PDF 和简化后的 PPTX 预览。

配置 DeepSeek 后，在 **Test** 上传讲义并生成一道题，预期看到引用页、作答反馈和课程架中的测验条目。TACC 就绪后，用 User A 打开内置的 Lecture 1 概念图，向助教问 **What does the Roofline model explain?**，检查流式回答和可跳转的讲义引用。实现见 `docs/test-flow.md` 和 `docs/document-api.md`。

## 详细说明（Detailed Instructions）

### 数据和模型配置

安装依赖后，在仓库根目录用 Bash 或 Zsh 运行下列命令。PowerShell 的 Python UTF-8 设置为 `$env:PYTHONUTF8 = '1'`。

```bash
export PYTHONUTF8=1
export EVAL_PY=.venv/bin/python
export EVAL_RUN="evaluation/results/rerun-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVAL_RUN"

"$EVAL_PY" evaluation/runners/validate_dataset.py
shasum -a 256 evaluation/ACS_Lecture_1_2026F.pdf \
  evaluation/ACS_lecture_2_2026F.pdf
```

两份原始 PDF 都在仓库内。若系统没有 `shasum`，可对相同路径运行 `sha256sum`。把结果与 `evaluation/sources/documents.json` 核对。ACS-L1 有 67 页，ACS-L2 有 69 页。页码按 PDF 物理页从 1 开始，包含封面。提取后的逐页文本在 `evaluation/sources/`，失败和未测量项的统计口径见 `evaluation/shared/scoring.md`。

报告中的概念图、出题、题目质量判分和实验型答题批改使用 DeepSeek Flash，助教使用 TACC Qwen。把 `DEEPSEEK_API_KEY` 配进本地 `.env`，按上文启动支持工具调用的 TACC 作业并建立转发。在后端终端加载配置后启动服务：

```bash
set -a
source .env
set +a
export DEEPSEEK_MODEL=deepseek-flash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_CONCEPT_MAP_MODE=staged
export STUDYGRAPH_CONCEPT_MAP_CACHE=0
export STUDYGRAPH_TUTOR_PROVIDER=tacc
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 "$QWEN_BASE_URL/models"
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

在评测终端按上文设置 `EVAL_PY` 和 `EVAL_RUN`。需要直接调用 DeepSeek 的脚本也要在该终端加载 `.env` 并设置 `DEEPSEEK_MODEL=deepseek-flash`。将 `TACC_JOB_ID` 替换为当前 Slurm 作业号。向默认资料库上传两份讲义，供 Tutor 和本地出题评测使用。若配置了 `STUDYGRAPH_DATABASE`，两个终端须指向同一数据库。

```bash
export EVAL_BASE=http://127.0.0.1:8000
export TACC_JOB_ID=YOUR_JOB_ID
for pdf in evaluation/ACS_Lecture_1_2026F.pdf evaluation/ACS_lecture_2_2026F.pdf
do
  curl -fsS -F "file=@$pdf" "$EVAL_BASE/api/documents"
done
curl -fsS "$EVAL_BASE/api/documents"
```

核对上传返回的文档 ID 与清单中的哈希。对比模型时使用独立输出目录，记录 Git 提交、各环节的模型和服务提供方、TACC 作业、并发、缓存状态与重试策略。

### 主要评测结果

以下四张表与 `evaluation/README.md` 的结果表对应。每组复现步骤都注明了对应的输出文件。

#### 概念图和图内笔记

| 指标 | Lecture 1 | Lecture 2 |
|---|---:|---:|
| 生成节点数 | 24 | 29 |
| 核心概念覆盖 | 17/17 | 19/19 |
| 生成节点准确数 | 24/24 | 29/29 |
| 笔记平均得分 | 96.08% | 96.49% |
| 笔记要点累计得分 | 91/94 | 110/114 |
| 物理页覆盖 | 67/67 | 69/69 |
| 成功请求耗时（含上传） | 21.12 s | 30.78 s |
| 生成尝试次数 | 2 | 1 |

#### AI 助教和固定习题

| 评测 | 指标 | 结果 |
|---|---|---:|
| 单轮 | 完成回答 | 30/30 |
| 单轮 | 两份讲义的平均内容得分 | 98.96% |
| 单轮 | 中位数 / P95 延迟 | 14.89 s / 24.25 s |
| 固定习题 | 可回答题中含结构化引用 | 26/26 |
| 多轮 | 完成轮次 | 24/24 |
| 多轮 | 每轮平均得分 | 99.31% |
| 多轮 | 通过适用的上下文检查 | 18/18 |
| 多轮 | 严格标准下成功的对话 | 4/6 |

#### 英文出题

| 讲义 | 完成交付 | 均分 /10 | 覆盖 /3 | 正确性 /3 | 引用支持 /2 | 可答性 /2 |
|---|---:|---:|---:|---:|---:|---:|
| L1 | 10/10 | 9.80 | 2.80 | 3.00 | 2.00 | 2.00 |
| L2 | 10/10 | 9.90 | 2.90 | 3.00 | 2.00 | 2.00 |
| 总体 | 20/20 | 9.85 | 2.85 | 3.00 | 2.00 | 2.00 |

#### 学生答案批改和反馈

| 指标 | L1 | L2 | 总体 |
|---|---:|---:|---:|
| 有效批改响应 | 40/40 | 35/35 | 75/75 |
| 总分完全一致 | 40/40 | 34/35 | 74/75 |
| 平均绝对误差（分） | 0 | 0.0286 | 0.0133 |
| 明确错误的查准率 | 24/24 | 21/21 | 45/45 |
| 明确错误的查全率 | 24/24 | 21/21 | 45/45 |
| 遗漏要点的查准率 | 24/26 | 21/21 | 45/47 |
| 遗漏要点的查全率 | 24/24 | 21/21 | 45/45 |
| 对参考标注为完全正确的答案误报遗漏 | 0/8 | 1/7 | 1/15 |

网页基线在 15 份参考标注为完全正确的答案中判错 8 份。按答对 4 分、答错 0 分的代理评分，平均绝对误差为 1.227 分。

### 1. 概念图和图内笔记

使用 `evaluation/01_knowledge/v0.5-en/` 中的英文参考集，对每份 PDF 按默认指令生成整份讲义的概念图。L1 有 17 个参考概念和 47 个笔记要点，L2 有 19 个参考概念和 57 个笔记要点。

使用归档预测和已保存的语义判定复算结果。这一步无需启动模型。

```bash
for i in 1 2
do
  saved="evaluation/results/v0.5-en-20261119/l$i"
  "$EVAL_PY" -m evaluation.runners.knowledge score \
    --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
    --prediction "$saved/prediction.json" --review "$saved/review.json" \
    --output "$EVAL_RUN/map-l$i-recomputed.json"
done
```

重新生成和判分时保持缓存为空。下方以 Lecture 1 为例。Lecture 2 替换变量后再执行一次。

```bash
i=1
pdf=evaluation/ACS_Lecture_1_2026F.pdf
# For Lecture 2, set i=2 and pdf=evaluation/ACS_lecture_2_2026F.pdf.
"$EVAL_PY" -m evaluation.runners.knowledge generate \
  --base-url "$EVAL_BASE" --pdf "$pdf" --dataset-id "ACS-L$i" \
  --document-manifest evaluation/sources/documents.json \
  --output "$EVAL_RUN/map-l$i/prediction.json"

"$EVAL_PY" -m evaluation.runners.knowledge score \
  --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
  --prediction "$EVAL_RUN/map-l$i/prediction.json" --judge deepseek \
  --output "$EVAL_RUN/map-l$i/metrics.json"
```

`metrics.json` 对应「概念图和图内笔记」表中的语义指标。`evaluation/results/v0.5-en-20261119/` 各讲义目录里的 `guide.json` 和 `page_checks.json` 分别记录生成结构和页码检查。复核时检查每个节点的证据页是否连续，将所有节点页码取并集并与 PDF 总页数比对，同时单列遗漏和重复归属的页。L1 第二次才通过覆盖校验，表中的耗时只计成功请求。该评测统计随图返回的笔记，按需打开节点后的独立笔记接口和语义关系不在本次测量范围内。

### 2. AI 助教

#### 英文单轮

`evaluation/02_ai_tutor/single_turn/en/` 从 `evaluation/shared/question_bank.json` 选出 30 道题。L1 有 14 道，L2 有 16 道。其中 26 道可以依据讲义回答，4 道检查证据不足时的处理。每题使用新会话，最多同时处理 3 个请求。归档运行使用 TACC 作业 29876。

```bash
# Recompute the published metrics using the saved responses and review.
"$EVAL_PY" -m evaluation.runners.tutor_single summarize en \
  evaluation/results/tutor-single-en-29876-citations

# Collect fresh responses.
"$EVAL_PY" -m evaluation.runners.tutor_single run en "$EVAL_RUN/tutor-single" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"

# After completing review.json in the new directory:
"$EVAL_PY" -m evaluation.runners.tutor_single summarize en "$EVAL_RUN/tutor-single"
```

新跑的 `review.json` 需要依据参考评分点和最终回答填写 0、1 或 2 分，并记录扣分理由。汇总脚本计算两份讲义的等权内容得分、完成率、结构化引用数和延迟，对应「AI 助教和固定习题」表的单轮指标。是否带引用、是否命中参考页、每项主张是否有材料支持，应分别核对。

#### 英文多轮

`evaluation/02_ai_tutor/multi_turn/` 下有 6 段对话，每段 4 轮，主题包括流水线、并行与 SMT、Amdahl 定律、局部性与 AMAT、CUDA 内存以及 HBM/LPDDR。各段对话复用同一个会话 ID，按顺序发问。流开始前收到 HTTP 503 时可重试两次。归档运行使用 TACC 作业 30603，实际未触发 HTTP 重试。

```bash
"$EVAL_PY" -m evaluation.runners.tutor_multi "$EVAL_RUN/tutor-multi" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

逐轮对照评分点给 0–2 分，分别记录上下文保留、实质性错误和所需引用。按轮次归一化后取平均。只有四轮都满足报告标准才计为严格成功。脚本负责收集回答，新结果需另做语义复核和汇总。归档逐轮得分在 `evaluation/results/tutor-multi/scores.json`，对应「AI 助教和固定习题」表的多轮指标。上下文检查是在运行后标注的，未测浏览器引用跳转。

### 3. 英文出题

`evaluation/03_question_generation/english-20/` 有 20 项任务，每份讲义 10 项。任务要求生成 10 道简答、6 道选择和 4 道判断题。每项任务指定范围、难度和允许使用的页码，脚本使用已导入的本地讲义库。

```bash
# Regenerate questions and score them with the published provider configuration.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek --judge-provider deepseek \
  --output-dir "$EVAL_RUN/quiz"

# Evaluate the originally published questions with a fresh judge call.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek \
  --predictions evaluation/results/quiz-english-20261121 \
  --output-dir "$EVAL_RUN/quiz-rescore"
```

按覆盖 3 分、正确性 3 分、引用支持 2 分、可答性 2 分评分，未交付计零分。`evaluation/results/quiz-english-20261121/scores.json` 对应「英文出题」表，可直接核对 20/20 交付率和 9.85/10 均分。生成和判分使用同一服务提供方，判分独立性有限。报告记录了 L2-EN04 的引用得分偏高。

### 4. 学生答案批改和反馈

`evaluation/04_answer_grading/english-75/` 包含 15 道简答题，每题有 5 种作答变体，共 75 例。每份答案按两项标准评分，每项最高 2 分。脚本按候选参考标签评价模型批改，并用 Node.js 运行网页的文本规范化基线。

```bash
# The recorded run used a five-worker grading pool.
"$EVAL_PY" -m evaluation.runners.grading_feedback --provider deepseek --workers 5 \
  --output-dir "$EVAL_RUN/grading"
```

将新输出的 `summary.json`、`web-baseline.json` 和逐例记录与 `evaluation/results/grading-feedback-en-20261121/` 比对。它们对应「学生答案批改和反馈」表的准确匹配、绝对误差及错误和遗漏检测指标。L2-SA11 的文字反馈误报遗漏，复核时需要同时看结构化字段和反馈原文。网页基线使用一个参考答案和空同义答案列表。作答变体来自合成案例，参考标注仍属候选，结论适用范围限于这组数据。

### 5. 固定习题

`evaluation/05_question_answering/` 的 26 道固定习题来自英文助教单轮评测的可回答子集。用第 2 节的命令运行单轮评测，再按共享题库中 `answerability: supported` 的题目 ID 筛选响应和评分。4 道证据不足题参与 30 题的单轮内容评分，结构化引用统计只用 26 题子集。汇总样本量时，这 26 题只计一次。

### 模型切换和结果波动

直接用 TACC 出题或批改时，在评测终端设置 `QWEN_BASE_URL` 和 `--provider tacc`。让 TACC 担任出题裁判时用 `--judge-provider tacc`，让 TACC 给概念图评分时用 `--judge tacc`。HTTP 评测由后端进程的 `STUDYGRAPH_GENERATION_PROVIDER` 或 `STUDYGRAPH_TUTOR_PROVIDER` 决定，均可设为 `tacc` 或 `deepseek`，修改后重启后端。较长助教会话触发历史压缩且配置了 DeepSeek Key 时，摘要可能调用 DeepSeek。做纯 TACC 助教实验时可在独立后端进程中取消该密钥。更多参数见 `evaluation/runners/README.md`。

即使输入固定，模型重跑也可能改变措辞、检索页、引用、分数和延迟。对比耗时时记录缓存状态、预热和硬件条件。保留失败记录，单独标明诊断重试。当前结果只覆盖两份讲义，候选参考标签待人工复核，开发集与测试集划分尚未冻结。
