# 评测脚本

english_qa.py与retrieval.py为历史脚本，仅兼容archive/legacy的数据格式，不能直接读取新版嵌套JSON，也不能评测多轮对话或语义正确性。

knowledge.py 支持后端概念图导出和语义评分，完整命令见下文。其他新版板块仍需人工执行与审核；validate_dataset.py用于检查结构及引用，不调用模型。

共用评分规则见 evaluation/shared/scoring.md。

## 概念图与学习笔记：可复现命令

运行位置：仓库根目录。Python 使用项目 `.venv`，依赖同后端，无新增第三方包。

### 被测路径和边界

`generate` 调用新增的 `POST /api/documents/{doc}/knowledge`，内部直接复用网页上传后调用的 `study-guide` 生成函数，不向生成器发送参考概念或参考 Facts。输出与 `01_knowledge/lecture1.json`、`lecture2.json` 相同的顶层结构：`document_id / concepts / relations / study_notes`；额外的 `generation`、`run` 字段记录配置与来源。

- 本命令测的是**后端概念图/学习指南**，不是 Tutor 的 pi Agent。网页与命令行共用同一生成路径；网页不填偏好或命令省略 `--instructions` 时，都使用 `backend/study_guide.py` 中的 `DEFAULT_INSTRUCTIONS`。自定义偏好时两端使用相同文本。旧标题分组图谱直接从课程架恢复，不会自动重新生成。
- 导出模型实际返回的 summary、detail、keyPoints、formula，作为概念 facts 和笔记点；`required_points` 在预测文件中是生成的知识陈述，不是真值。source quote 不算生成的解释。
- 后端默认使用 V3 staged：全页索引、骨架、按主题分批笔记和覆盖检查；不设 5×4，节点数由讲义内容和调用预算决定。`single` 回滚路径仍是 32 页 × 700 字、4400 输出。
- `relations` 保持空数组，因为该产品路径不生成语义关系。参考关系非空时 Recall=0、Precision=N/A，不把页面布局连接当成知识关系。
- 网页打开节点时会另外调用 `/study-note/stream`；本流程导出的是 `study-guide` 自带笔记，不能宣称评测了该延迟生成接口。

### 1. 启动后端

先按项目 README 安装 Python 依赖。以下为 macOS/Linux 的 Bash/zsh 命令。在本地 `.env` 设置自己的 DeepSeek key。不要提交密钥。后端不会自动读取 `.env`，需要在同一终端加载：

```bash
set -a
source .env
set +a
.venv/bin/python -m uvicorn backend.main:app --port 8000
```

已启动旧后端时先停止并重启，以加载新接口。生成固定使用 DeepSeek；TACC 只给 AI tutor/Agent，不再用于概念图生成。评分器的 `--judge deepseek` 单独使用 DeepSeek 配置。

### 2. 生成 Lecture 1 预测

另开终端，在仓库根目录执行。`--pdf` 换成实际 PDF 路径；清单校验 SHA256，防止误用 Lecture 2 或不同版本 PDF。无需模型密钥的客户端调用后端；生成使用后端进程环境。

```bash
.venv/bin/python -m evaluation.runners.knowledge generate \
  --pdf /Users/yushare/Desktop/hkust_it/CSIT6000V/ACS_Lecture_1_2026F.pdf \
  --dataset-id ACS-L1 \
  --document-manifest evaluation/sources/documents.json \
  --output evaluation/results/l1-run1/prediction.json
```

预期输出 `Saved N concepts and N notes to ...`。实际节点数由生成结果决定，不预设成绩。支持 `--document-id 后端文档ID` 替代 `--pdf`，但该模式无法核验原 PDF 哈希；后端 ID 和 `ACS-L1` 是不同用途。

Lecture 2 使用同一命令，替换为：

```text
--pdf /Users/yushare/Desktop/hkust_it/CSIT6000V/ACS_lecture_2_2026F.pdf
--dataset-id ACS-L2
--output evaluation/results/l2-run1/prediction.json
```

之后评分参考集也改为 `evaluation/01_knowledge/lecture2.json`。

输出包含完整页证据、模型和 instructions、PDF 哈希、后端文档 ID、时间及命令所在工作树 Git 提交号/是否有未提交修改。远端后端部署时需另行记录其代码版本。每次实验使用新输出目录，命令拒绝覆盖已有文件。生成失败以非零退出，并保存 `prediction.json.failure.json`，不可从实验中静默剔除。正式调用一次，不自动重试；诊断重试另起实验目录。

### 3. 语义评分（需要一次付费 DeepSeek 请求）

在评分终端加载 `.env` 后执行。只在此阶段读取参考答案，生成器不接触真值。

```bash
set -a
source .env
set +a
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --judge deepseek \
  --save-review evaluation/results/l1-run1/review.json \
  --output evaluation/results/l1-run1/metrics.json
```

产物：`review.json.raw.json` 为判分服务原始响应，`review.json` 保存逐概念/关系判定、别名语义匹配、重复项、逐笔记要点 0/1/2 分及理由，`metrics.json` 保存汇总指标。失败不自动重试。LLM 评分只是待人工复核的自动判分，不等于客观真值；模型可受表述、提示和采样影响。请保留原始判分，人工校订另存 `review.human.json`，修改 reviewer/date/review_type 为实际人员、日期、`human`，并说明裁定理由。

指标沿用 `evaluation/shared/scoring.md`：

- concepts.precision：正确且在范围内的生成概念 / 去重生成概念。有效新增概念计正确，不要求出现在参考集中。
- concepts.core_recall：匹配到的核心参考概念 / 固定核心概念数（L1=18，L2=20）。
- relations.precision / core_recall：关系端点、方向和语义匹配；按一对一匹配。
- study_notes.mean_point_score：各参考笔记的要点归一得分的等权均值，缺失为0。micro_point_score 为累计得分/累计满分。
- study_notes.fully_covered_points：获得满分的必要要点数 / 全部必要要点数。这是严格要点覆盖率，不是全部生成事实正确率。

比率保存为0–1；分母0记null / not_applicable。未覆盖核心 ID 单列。输入文件哈希绑定审核记录，防止拿旧评分评新输出。语义去重由审核者/判分模型显式标记，不能依赖字符串去重。事实错误、超范围和参考遗漏需要结合导出页证据及原 PDF 人工核查。参考集当前仍标记 human_review_pending，审核前只能报告候选参考集下的初步结果。

### 4. 不调用模型复算成绩 / 纯人工评分

复算已冻结的判定记录，不再需要 API key，也不需要启动后端：

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --review evaluation/results/l1-run1/review.json \
  --output evaluation/results/l1-run1/metrics-recomputed.json
```

也可以不使用 LLM，先创建待填写的人工模板：

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --template evaluation/results/l1-run1/review.human.json
```

填写所有 correct、reason、matches、duplicate_of，以及每个参考笔记要点的 score、prediction_ids、reason；未覆盖要点填0并说明缺失。`prediction_ids` 是生成概念 ID。重复概念指向非重复概念，matches 为空，correct 一致。正确但非参考核心的新增概念 matches 为空。每个核心概念允许多个不同节点共同覆盖，但需审核其语义是否充分。再用 `--review review.human.json` 计算；未审核、非法 ID 或不匹配哈希会失败，不会默认为通过。

课程提交需一起保存 prediction、review、metrics 和最终代码版本，在报告中注明对应结果表格、生成配置和审核方法。相同冻结 prediction/review 可精确复算指标；重新请求模型不保证完全相同。此功能不含已有正式模型成绩。

本地回归检查（不调用真实模型）：

```bash
.venv/bin/python -m unittest backend.test_knowledge backend.test_smoke
.venv/bin/python evaluation/runners/validate_dataset.py
```
