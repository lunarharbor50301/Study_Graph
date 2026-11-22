# Test 模块代码逻辑

## 创建测验

1. 在 Test 页选择 1–5 份 PDF 或 PPTX，再设置选择题、判断题、简答题的数量和难度。整套最多 12 题，至少为每份讲义分配一道题。输入框里的文字可以作为出题偏好，例如优先考计算题。[创建页](../frontend/src/Documents.tsx)
2. 前端上传讲义并拿到文档 ID。后端解析课件并保存页码和文本索引。前端按题量从可读页中抽样，用各页开头的文字作为检索词，并在多份讲义之间轮流安排题目。[讲义上传](../backend/documents.py) · [抽样与排题](../frontend/src/createTest.ts)
3. 每题调用 `POST /api/documents/{doc}/practice-question`。后端用关键词检索讲义片段，把片段、题型、难度、出题偏好和已生成的题干一起交给当前的生成模型。模型返回题干、答案、提示、解析和来源 ID。后端检查来源 ID、重复题干和题型格式，再把实际讲义页码随题目返回。[出题接口](../backend/quiz.py)

## 失败重试和保存

出题按顺序执行，因为后一道题需要收到前面已经生成的题干以减少重复。前端保存本次的讲义、出题设置和已完成的题。某一道失败时可以点击 **Retry question N**，从该题继续。例如第 12 题失败后，重试会复用前 11 题和已经准备好的讲义页。更换讲义、题量、难度或出题偏好后按新配置生成。重试进度保存在当前页面会话中，刷新浏览器后会重置。[生成与重试](../frontend/src/createTest.ts) · [重试入口](../frontend/src/Documents.tsx)

全部题目生成后，应用把整套测验加入课程架。题目、当前题号和答题进度按演示用户分别保存在浏览器的 `localStorage` 中。[测验保存](../frontend/src/main.tsx) · [课程架存储](../frontend/src/courseStore.ts)

## 作答、引用和 AI Tutor

- 选择题和判断题显示选项，简答题显示文本框。提交时由前端评分。生成题的答案经过大小写、空白和部分标点规范化后，与参考答案或模型提供的同义答案逐项比对。提示、答案解析和每题进度也从测验记录读取。[答题和评分](../frontend/src/main.tsx)
- 点击题目或助教回复中的来源，可打开对应讲义页。聊天时把当前题干作为上下文，并传入当前题目所属讲义。已保存的测验使用固定的历史文档 ID，所以切到另一份讲义的题目时也能接着聊。助教的对话记录由后端保存在 SQLite 中，使用单独配置的 Tutor 模型。[测验界面](../frontend/src/main.tsx) · [助教接口](../backend/agent_api.py)

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

出题和默认裁判同时使用 TACC：

```bash
.venv/bin/python -m evaluation.runners.quiz --provider tacc --output-dir evaluation/results/quiz-tacc-new
```

只重评已有题目时增加 `--predictions evaluation/results/quiz-english-20261121`。可加 `--judge-provider deepseek` 实现 TACC 出题、DeepSeek 评分；`--provider deepseek` 则切回 DeepSeek。仅重算保存的评分数字无需调用模型。
