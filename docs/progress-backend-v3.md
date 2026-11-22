# 概念图 V3 后端进度

最后更新：2026-11-19
当前状态：V3 已移植到 yxy-2.0（V2.5）基线；默认指令、generated-only 前端、knowledge 导出和评测数据保留 yxy；V3 staged、无 5×4 保留我们的实现。模型不再全部写死：AI Tutor 固定 TACC Qwen，生成（概念图、study note、练习题）可在 DeepSeek 公共 API 和 TACC Qwen 间切换，默认 DeepSeek。V3 默认指令的一次 54 节点结果已用 v0.4-en + DeepSeek judge 评分：核心概念 20/20、Precision 54/54、笔记 96.25%；仍需人工复核和重复运行。AI tutor 的 New conversation 已改为新建线程并保留旧线程，完整对话入库，超过 8 轮时用摘要压缩送入模型的上下文。

## 给前端和测试的对接摘要

### 接口

- 入口不变：`POST /api/documents/{doc}/study-guide`，请求体 `{"instructions": "..."}`；省略、空串或纯空白时使用 `DEFAULT_INSTRUCTIONS`（yxy 的整份讲义默认要求）。
- 前端已改为 generated-only：上传后一律调模型，不再走本地标题分组；旧的 `createSlideOutline`/重新分组已删除。
- 响应结构不变：`{title, topics: [{title, notes: [{page, title, summary, detail, keyPoints, formula}]}], sources}`。
- `topics` 和 `notes` 不再限制 5×4；节点数随讲义规模，实测同一份 69 页讲义 60–62 个节点。
- notes 按页码排序，topics 按首个 note 的页码排序；`formula` 为字符串或 `null`；`sources` 仍取每页正文前 700 字。
- 默认走 `staged`；设 `STUDYGRAPH_CONCEPT_MAP_MODE=single` 回到旧的一次调用实现。
- 目前没有流式骨架：接口在整张图完成后一次返回。DeepSeek 约 19 秒；Qwen 只用于实验对照，全量预计 8–12 分钟（估算，未跑完）。
- 部分失败时返回已有节点，响应里**没有** `incomplete` 字段，前端无法区分“完整图”和“缺了一部分”；只有日志里有。
- 只有骨架失败或零笔记才返回 502；单条笔记坏掉只丢那一条。

### 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `STUDYGRAPH_LLM_PROVIDER` | `deepseek` | 生成默认 provider（`deepseek`/`tacc`） |
| `STUDYGRAPH_GENERATION_PROVIDER` | 空 | 覆盖概念图、笔记、出题；空则跟随全局 |
| `STUDYGRAPH_TUTOR_PROVIDER` | `tacc` | AI tutor；固定 TACC，前端不提供切换 |
| `DEEPSEEK_API_KEY` | — | DeepSeek provider 必需 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek provider |
| `DEEPSEEK_MODEL` | `deepseek-flash` | DeepSeek provider |
| `QWEN_BASE_URL` | — | TACC provider 必需，带 `/v1` |
| `QWEN_MODEL` | `qwen3.8-27b` | TACC provider |
| `QWEN_API_KEY` | `local` | 本地隧道可省略 |
| `STUDYGRAPH_CONCEPT_MAP_MODE` | `staged` | `single` 回滚 |
| `STUDYGRAPH_CONCEPT_MAP_CACHE` | `1` | 评测时设 `0` |
| `STUDYGRAPH_CONCEPT_MAP_TIMEOUT` | `600` | 单次请求总时长，秒 |
| `STUDYGRAPH_CONCEPT_MAP_CALL_TIMEOUT` | `180` | 单次模型调用超时，秒 |
| `STUDYGRAPH_CONCEPT_MAP_MAX_CALLS` | `18` | 总调用上限 |
| `STUDYGRAPH_CONCEPT_MAP_OUTPUT_TOKENS` | `24000` | 总输出预算 |
| `STUDYGRAPH_CONCEPT_MAP_NOTES_TOKENS` | `2400` | 每批笔记输出上限 |
| `STUDYGRAPH_CONCEPT_MAP_BATCH_CONCEPTS` | `12` | 每批节点数 |
| `STUDYGRAPH_CONCEPT_MAP_BATCH_CHARS` | `6000` | 每批页面正文上限 |
| `STUDYGRAPH_CONCEPT_MAP_GAP_GROUPS` | `4` | 覆盖检查组数 |
| `STUDYGRAPH_CONCEPT_MAP_CONCURRENCY` | `4` | 分批并发 |

`STUDYGRAPH_GENERATION_PROVIDER` / `STUDYGRAPH_TUTOR_PROVIDER` 是新的覆盖项；评审默认 DeepSeek，不依赖 TACC。TACC 作业通常 1 小时结束，隧道失效后需重新提交并更新 `QWEN_BASE_URL`。

### 已知限制

- 已有一次 54 节点的 v0.4-en + DeepSeek judge 评分（20/20、54/54、笔记 96.25%），但参考集仍是 `human_review_pending`，LLM 判定需人工复核；同配置另一次 49 节点，波动明显。
- 60–62/69 是“被引用的页数”，不是核心概念覆盖率；yxy 的 20 节点基线是 v0.4-en 8/20、Precision 20/20、笔记 34.17%。
- 没有测首屏、点击到可交互图和缓存命中；V3 响应不流式。
- 没有 Qwen 69 页全量结果；8–12 分钟是按 13 tokens/秒估算。
- 部分结果没有响应字段标记，前端只能看到节点变少。
- 真实模型只跑了 DeepSeek 2 次；重复运行的节点数和主题划分波动还没统计。

### 产物

- DeepSeek 全量结果（自定义偏好）：[concept-map-v3-deepseek-flash.json](../evaluation/archive/concept-map-v3-deepseek-flash.json)
- DeepSeek 默认指令结果（54 节点，评分用）：[concept-map-v3-deepseek-default.json](../evaluation/archive/concept-map-v3-deepseek-default.json)
- V3 评分预测/指标/判定：[prediction.json](../evaluation/results/v3-default/prediction.json)、[metrics.json](../evaluation/results/v3-default/metrics.json)、[review](../evaluation/results/v3-default/metrics.review.json)
- Qwen 6 页小讲义结果：[concept-map-v3-qwen-small.json](../evaluation/archive/concept-map-v3-qwen-small.json)
- 实现：[backend/concept_map.py](../backend/concept_map.py)、[backend/study_guide.py](../backend/study_guide.py)
- 测试：[backend/test_concept_map.py](../backend/test_concept_map.py)、[backend/test_study_guide.py](../backend/test_study_guide.py)
- 评测基线：[evaluation/results/l2-run1/comparison.md](../evaluation/results/l2-run1/comparison.md)
- 设计计划：[docs/概念图V3后端修改计划.md](概念图V3后端修改计划.md)

## 变更与实验记录

## 2026-11-19 — 会话下拉合并新建与删除

- **类型**：功能 / 界面
- **范围**：`frontend/src/main.tsx`、`frontend/src/api.ts`、`frontend/src/Layout.tsx`、`frontend/src/style.css`、`backend/agent_api.py`、`backend/test_agent_history.py`。
- **改动**：
  - 删除聊天头部单独的 `＋ New` 按钮；会话下拉触发器内合并“New conversation”入口和已保存会话列表。
  - 每个会话行右侧有垃圾桶按钮；点击调用 `DELETE /api/agent/conversations/{session_id}?document_id=...`，删除该会话的 `agent_turns` 和 `agent_conversations` 行，不影响其他会话。
  - 删除当前会话时自动切到剩余最新会话；没有剩余则新建空会话。课程架里对应的 setup 消息也会清掉。
  - 下拉支持点击外部或 Esc 关闭；删除按钮在回答进行中禁用。
- **结果**：新增删除用例；后端 37 个测试通过；前端 build 通过。未做浏览器 E2E。
- **对前端**：聊天头部不再有独立 New 按钮；会话菜单为自定义下拉，样式沿用现有配色。
- **对测试**：`test_agent_history.test_delete_removes_one_thread_only` 覆盖单会话删除和重复删除返回 false。
- **局限/下一步**：删除立即执行，没有二次确认；删除的是后端 Agent 会话，普通问答 setup 消息随课程架条目清理。
- **产物**：[backend/agent_api.py](../backend/agent_api.py)、[frontend/src/main.tsx](../frontend/src/main.tsx)、[backend/test_agent_history.py](../backend/test_agent_history.py)

## 2026-11-19 — 公共 API / TACC provider 开关与 README

- **类型**：配置 / 重构
- **范围**：新增 `backend/llm_provider.py`；改 `backend/deepseek_client.py`、`concept_map.py`、`study_guide.py`、`study_notes.py`、`quiz.py`、`knowledge_export.py`、`agent_api.py`、`main.py`、`agent/runner.mjs`、`README.md`、`.env.example`、`backend/test_quiz.py`、`backend/test_study_guide.py`、`backend/test_agent.py`。
- **改动**：
  - `STUDYGRAPH_LLM_PROVIDER=deepseek|tacc` 统一选择；`STUDYGRAPH_GENERATION_PROVIDER`、`STUDYGRAPH_TUTOR_PROVIDER` 可分别覆盖。
  - 默认改为 `deepseek` 公共 API，评审不需要 TACC 账号；TACC 仍可用 `QWEN_BASE_URL` + 隧道。
  - `agent/runner.mjs` 的模型 id、显示名、endpoint、API key 从输入/环境变量读取；只有 TACC 请求附加 `chat_template_kwargs`。
  - DeepSeek tutor 使用非 JSON 模式；生成仍使用 JSON 模式。概念图、单概念笔记、出题、knowledge 导出都走同一 provider 配置。
  - `/api/ask` 和 `/api/agent/stream` 的 `provider` 字段返回实际 provider（`deepseek`/`tacc`），不再写死 `tacc`。
  - 新增 `GET/POST /api/config/generation-provider`；侧栏的 **Generation model** 下拉切换概念图/study note/练习题 provider，只覆盖当前后端进程，重启回到 `.env`；API key 不下发前端。AI Tutor 固定 TACC，不受该下拉影响。
  - 切 TACC 前请求 `QWEN_BASE_URL/models`（2.5 秒超时）；tutor 每轮开始前也做同样 preflight，TACC 不可用直接 503，避免等满 180 秒。可用 `STUDYGRAPH_PROVIDER_HEALTHCHECK=0` 关闭。
  - README 增加快速启动、环境变量表、DeepSeek/TACC 切换、TACC 1 小时限制；`.env.example` 同步。
- **实验设置**：本机 `.env` 设 `STUDYGRAPH_LLM_PROVIDER=deepseek`；ACS Lecture 2（69 页）实际跑 DeepSeek tutor 两轮，其中一轮 2 次模型调用 + `search_lecture`/`read_page` 工具后完成；另一轮 3 次调用后返回 error（未保留完整错误，未计入通过）。`/api/ask` 的 general tutor 也返回 DeepSeek 答案。
- **结果**：生成 provider 可切换；DeepSeek tutor（临时测试配置）和 TACC mock 均回归。新增 `test_llm_provider.py`，后端 37 个测试通过；前端新增侧栏 Generation model 下拉，`npm run build --prefix frontend` 通过；`GET/POST /api/config/generation-provider` 实测可切到 tacc 再切回 deepseek。TACC 当前不可用时，切换在 0.52 秒内返回 503，provider 保持 deepseek。
- **对前端**：接口形状不变；`provider` 值可能从 `tacc` 变成 `deepseek`（仅生成）。侧栏新增 Generation model 下拉，值来自 `/api/config/generation-provider`；AI Tutor 头部不再有 provider 切换；切换失败时下拉保持旧值并显示后端错误。
- **对测试**：`test_agent` 显式设 `STUDYGRAPH_TUTOR_PROVIDER=tacc`；`test_quiz`/`test_study_guide` 改为 patch `backend.llm_provider.deepseek_client.chat`；`test_llm_provider` 覆盖 env、运行时覆盖和未知 provider。全量命令不变。
- **局限/下一步**：preflight 只证明 `/models` 可达，不保证排队/生成速度；TACC 在切换后挂掉时，生成类请求仍可能等到各自超时（tutor 有每轮 preflight）。前端开关是进程级全局状态，不适合多用户并发。DeepSeek tutor 一次 3 调用失败的原因未查；TACC 真实链路未重测；provider 选择不影响 V3 评分数据，不应用本次改动重算指标。
- **产物**：[backend/llm_provider.py](../backend/llm_provider.py)、[backend/test_llm_provider.py](../backend/test_llm_provider.py)、[README.md](../README.md)、[.env.example](../.env.example)

## 2026-11-19 — 对话线程保存与上下文压缩

- **类型**：功能
- **范围**：`backend/agent_api.py`、`agent/runner.mjs`、`frontend/src/main.tsx`、`frontend/src/api.ts`、`frontend/src/courseStore.ts`、`frontend/src/types.ts`、`frontend/src/style.css`。
- **改动**：
  - 新增 `agent_conversations` 表：按 `session_id + document_id` 保存标题、时间、轮数、摘要和摘要覆盖到的 turn id。
  - `agent_turns` 不再删除旧轮次；`GET /api/agent/history` 返回该会话全部成功轮次，供界面恢复。
  - 新增 `GET /api/agent/conversations?document_id=...`，按更新时间列出已保存会话。
  - 模型上下文改为“更早轮次摘要 + 最近 6 轮”；超过 8 轮时用 `deepseek-flash` 生成摘要，完整原文仍保留。
  - `agent/runner.mjs` 把摘要作为参考数据追加到 system prompt。
  - 前端 `New conversation` 现在新建线程、不删除旧线程；聊天头部新增会话下拉，保持原按钮位置和现有配色。
  - 上传页产生的 setup 消息写入 `sessionId`；切回旧线程时仍显示原来的 setup 消息。
- **对前端**：已有课程架条目会在读取时把旧 `messages` 迁移到当时的 `agentSessionId`；新条目在创建时写入会话 ID。会话下拉的宽度上限 150px，随头部换行。
- **对测试**：新增 `backend/test_agent_history.py`，覆盖会话列表、完整历史、摘要只压缩模型上下文不删 UI 历史；后端 31 个用例通过，`npm run build --prefix frontend` 通过。
- **局限/下一步**：没有浏览器 E2E 和真实 pi 多轮摘要测试；会话暂不支持重命名/删除；摘要依赖 `DEEPSEEK_API_KEY`，失败时退回最近 6 轮。
- **产物**：[backend/agent_api.py](../backend/agent_api.py)、[agent/runner.mjs](../agent/runner.mjs)、[backend/test_agent_history.py](../backend/test_agent_history.py)

## 2026-11-19 — V3 默认指令的 v0.4-en 评分（54 节点）

- **类型**：实验
- **设置**：Lecture 2（69 页，doc id `ad66f2...`）；`StudyRequest()` 默认指令；staged；DeepSeek `deepseek-flash`；缓存关闭；1 次生成；54 个概念/54 条笔记。评分使用 `evaluation.runners.knowledge score --judge deepseek`，参考集 `evaluation/01_knowledge/v0.4-en/lecture2.json`，judge 为 `deepseek-flash`、temperature 0、prompt v2。
- **结果**：
  - 核心概念召回：20/20 = 100%（基线 20 节点为 8/20 = 40%）。
  - 概念 Precision：54/54 = 100%；judge 把 54 个节点全部判为正确，0 个重复，27 个节点带有 reference match。
  - 笔记等权平均：19.25/20 = 96.25%（基线 34.17%）。
  - 笔记累计：100/104 = 96.15%；完全覆盖要点 48/52 = 92.31%（基线 36/104、15/52）。
  - 关系：生成为 0，参考 9 条，Recall 0/9；Precision N/A。V3 不生成关系，这是产品范围。
- **对前端**：54 个节点比 yxy 基线的 20 个多；需确认主题总览和长图滚动体验。
- **对测试**：评分产物可离线复算；参考集仍是 `human_review_pending`，LLM judge 的 20/20 不能直接当正式成绩。
- **局限/下一步**：同配置另一次运行是 49 节点，节点数和主题划分波动明显；需要 3 次重复 + 人工抽查关键匹配（尤其“多个节点共同覆盖一个概念”的判定）。
- **产物**：[prediction.json](../evaluation/results/v3-default/prediction.json)、[metrics.json](../evaluation/results/v3-default/metrics.json)、[metrics.review.json](../evaluation/results/v3-default/metrics.review.json)

## 2026-11-19 — 合并 yxy-2.0（V2.5）并移植 V3

- **类型**：合并/改动
- **基线**：`team/yxy-2.0`（在 `b27b347` 上多 7 个提交）。
- **保留 yxy 的部分**：
  - `StudyRequest` 的 `DEFAULT_INSTRUCTIONS`：省略、空串、纯空白都走默认指令；
  - 概念图选材提示词（定义/机制/例题/公式、先主主题、跳过 agenda、合并别名、最佳页）；
  - 单概念笔记提示词和 `NOTE_CACHE_VERSION=3`；
  - 前端 generated-only：删除本地 `createSlideOutline` 和重新分组；
  - `/knowledge` 导出、knowledge 评分脚本、v0.4-en 和 l2-run1 评测数据。
- **保留我们的部分**：
  - `backend/concept_map.py` 的 staged 流水线、分批笔记、覆盖检查、`need_pages`；
  - 不限制 5×4；
  - 概念图、笔记、出题固定 DeepSeek；TACC 只给 AI tutor；
  - `STUDYGRAPH_CONCEPT_MAP_MODE=single` 回滚。
- **冲突处理**：`study_guide.py` 手工合并为“yxy 默认指令 + 选材提示词 + V3 路由”；`knowledge_export` 的 provider/limitations 改为 DeepSeek/V3；yxy 的 `test_study_guide.py` 保留并把环境设为 `single`，我们的测试改名为 `test_concept_map.py`。
- **对前端**：前端以 yxy 的 generated-only 版本为准；空偏好由后端补默认指令，不再有本地分组路径。
- **默认指令实跑**：Lecture 2，2 次，20.9 秒/11 主题/49 节点/49 页，26.5 秒/7 主题/54 节点/54 页；波动明显，尚未按 v0.4-en 评分。
- **对测试**：`python -m unittest discover -s backend -p 'test_*.py'` 共 29 个用例通过。
- **局限/下一步**：V3 的 60–62 节点还没按 v0.4-en 评分；需要用 `/knowledge` 导出后跑 `evaluation.runners.knowledge`。
- **产物**：[backend/study_guide.py](../backend/study_guide.py)、[backend/concept_map.py](../backend/concept_map.py)、[backend/test_concept_map.py](../backend/test_concept_map.py)

## 2026-11-18 — 生成统一走 DeepSeek，TACC 只给 AI tutor

- **类型**：配置/改动
- **范围**：`backend/concept_map.py`、`backend/study_guide.py`、`backend/study_notes.py`、`backend/quiz.py`；AI tutor 的 `backend/main.py` 和 `backend/agent_api.py` 不改。
- **改动**：
  - 概念图、单概念流式笔记、出题固定使用 `deepseek-flash`，不再读取 `STUDYGRAPH_GENERATION_PROVIDER`。
  - 只有 AI tutor（上传页 `/api/ask`、学习/测验页 Agent）继续用 `QWEN_BASE_URL` 连接 TACC Qwen。
  - 生成侧缺 `DEEPSEEK_API_KEY` 时返回 503；tutor 缺 `QWEN_BASE_URL` 时仍返回 503。
  - `.env` / `.env.example`：增加 tutor 用的 `QWEN_BASE_URL` 和 `NO_PROXY`，删除已失效的 `STUDYGRAPH_GENERATION_PROVIDER`；`docs/pi-agent.md` 同步改成“生成 DeepSeek，tutor TACC”。
- **对前端**：接口和响应字段不变；出题响应里的 `provider` 现在固定为 `deepseek`，前端没有使用该字段。
- **对测试**：`backend/test_quiz.py` 改为 patch `quiz.deepseek_client.chat`；概念图测试仍注入假 generate。15 个用例通过。
- **局限/下一步**：真实 DeepSeek 出题已跑通一次（1.1 秒，短答题），单概念笔记没有另跑；出题/笔记的真实模型回归和前端联调还要补。
- **产物**：[backend/concept_map.py](../backend/concept_map.py)、[backend/study_notes.py](../backend/study_notes.py)、[backend/quiz.py](../backend/quiz.py)

## 2026-11-18 — V3 后端实现

- **类型**：改动
- **版本/范围**：`concept_map.VERSION = 3`，staged 流水线。
- **改动**：
  - 新增 `backend/concept_map.py`：Phase 0 全页索引 → Phase 1 骨架 → Phase 2 按主题分批写笔记 → Phase 3 覆盖检查；覆盖检查里支持 `need_pages` 补读。
  - `backend/study_guide.py` 改成薄路由：默认 staged，`STUDYGRAPH_CONCEPT_MAP_MODE=single` 走旧的 32 页 × 700 字实现。
  - `deepseek_client.chat` 和 `qwen_client.chat` 增加可选 `timeout` 参数，默认 90，原有调用不变。
  - 节点上限从 `5 主题 × 4 节点` 改为不设上限；只保留调用次数、输出 token、总时长预算。
  - 新增 `study_guides` 缓存表、同一 key 的锁、结构化日志。
- **对前端**：接口和响应字段不变，前端不需要改；节点数可能明显超过 20，`mapLayout` 已支持超过 8 个节点自动加行。
- **对测试**：新增 `backend/test_study_guide.py`，覆盖无节点上限、分批失败、标题/页码不匹配、quote 校验、JSON 重试、`need_pages`、缓存、预算和覆盖组截断。
- **局限/下一步**：前端联调、真实模型质量评分、Qwen 全量仍未做。
- **产物**：[backend/concept_map.py](../backend/concept_map.py)、[backend/study_guide.py](../backend/study_guide.py)、[backend/test_study_guide.py](../backend/test_study_guide.py)

## 2026-11-18 — DeepSeek 全量实验

- **类型**：实验
- **设置**：Lecture 2（`ACS_lecture_2_2026F.pdf`，doc id `ad66f2c8360da43ea0981bffa549956185949044062a0abe4689381ced423402`，69 页）；provider `deepseek-flash`；staged；缓存关闭；并发 4；调用上限 18；学生要求为“Create a study guide for this lecture that follows the student's learning preferences where the source allows.”；同一配置跑 2 次。
- **结果**：
  - 第 1 次：18.4 秒；8 个主题、60 个节点；覆盖 60/69 页；8 次调用；约 12k 输出 tokens。
  - 第 2 次：18.9 秒；9 个主题、62 个节点；覆盖 62/69 页。
  - 第 1 次记录 `dropped=0`、`incomplete=false`；第 2 次只记录了结果，没有打印 metrics。两次都没有整图 502。
  - 第 2 次未覆盖页：1、2、11、20、23、42、60；第 1 次还多出 5、6。未逐页核对是否都是封面、目录或过渡页。
- **对前端**：一次响应会包含 60+ 条笔记和 60+ 页 `sources`，比旧图大；组图逻辑不用改，但需要确认大图滚动和主题总览的实际体验。
- **对测试**：这是目前唯一实测的“69 页完整图”；复现要关缓存、固定讲义和 provider，并记录调用次数。
- **局限/下一步**：没有按 v0.4-en 评覆盖率、准确率和笔记得分；不能据此说 V3 比 V0 质量好。
- **产物**：[concept-map-v3-deepseek-flash.json](../evaluation/archive/concept-map-v3-deepseek-flash.json)

## 2026-11-18 — TACC Qwen 吞吐、骨架和小讲义

- **类型**：实验
- **设置**：本机 TACC Qwen 服务 `http://127.0.0.1:18029/v1`，模型 `qwen3.8-27b`，`max_model_len=8192`。测了三项：长输出吞吐、Lecture 2 骨架、6 页小讲义完整图。
- **结果**：
  - 长输出：900 tokens / 70.5 秒，约 13 tokens/秒。
  - Lecture 2 骨架（只跑 Phase 1）：3438 prompt tokens + 1564 completion tokens，121 秒，7 个主题/31 个节点，JSON 有效。**这只是骨架，不是完整图。**
  - 6 页小讲义完整图：83.5 秒，2 个主题/5 个节点。
  - Lecture 2 全量：没有跑完，主动停止；按 13 tokens/秒、6 节点/批、1200 输出、2 组缺口估算 8–12 分钟，**不是实测**。
- **对前端**：Qwen 全量不适合放在同步点击路径；如果必须用，需要后台生成 + 通知/轮询，不能沿用当前“等完整图”的交互。
- **对测试**：Qwen 的默认 180 秒单次超时够跑骨架，但默认 2400 输出/12 节点批会显著拉长；测 Qwen 时用上面的 Qwen 预设。
- **局限/下一步**：Qwen 全量、Qwen 与 DeepSeek 的质量对比都没做。
- **产物**：[concept-map-v3-qwen-small.json](../evaluation/archive/concept-map-v3-qwen-small.json)

## 2026-11-18 — 测试状态

- **类型**：验证
- **结果**：`backend.test_study_guide` 13 个用例 + `backend.test_quiz` 2 个用例通过，共 15 个。
- **未通过的环境问题**：`backend.test_smoke`、`backend.test_documents`、`backend.test_agent` 在当前 Windows 沙箱里失败在 `tempfile.TemporaryDirectory()` 和临时 SQLite 的目录权限上，失败点在测试基础设施，不在这次 V3 代码；普通终端还需复跑确认。
- **对测试**：新增用例见 `backend/test_study_guide.py`；真实模型测试需要单独跑，并关闭缓存。
- **局限/下一步**：没有前端 E2E，没有真实模型的部分失败注入。

## 待补实验

- 人工抽查 V3 的 54 节点判定，尤其是“多个节点共同覆盖一个概念”的 27 个 match；参考集仍待人工审核。
- 用同一默认指令重复 3 次，统计节点数、主题数和覆盖率波动（已有 49 和 54 两次）。
- 按 Qwen 预设跑一次 69 页全量，仅用于历史/成本对照，不作为生产路径。
- DeepSeek 单概念流式笔记的真实回归；出题已跑通一次（1.1 秒，短答题）。
- 前端点击到完整图的实测耗时，以及 49–62 节点时的主题总览体验。
- 缓存命中耗时；DeepSeek 重复 3 次以上的节点数/主题数波动。
- 真实模型的部分失败（单批超时、单批 JSON 坏）是否按预期返回剩余节点。
- TACC SSH 网关模式下的并发表现；目前测的是直连 `127.0.0.1:18029`。
