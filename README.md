# Study-Graph

StudyGraph 帮助学生从课程讲义的概念图出发，提问、回到原页核对解释，并在同一会话中练习、查看提示和重答。

## 评审快速开始

课程项目不评估界面体验，重点是可运行、结果可复现。生成（概念图、study note、练习题）默认使用 **DeepSeek 公共 API**，不需要 TACC；AI Tutor 固定使用 **TACC Qwen**，需要可用的 TACC 服务或隧道。

依赖：Python 3.12、Node.js 22.19+（建议 24）。首次安装需要联网。

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm ci --prefix agent --ignore-scripts
npm run build --prefix frontend
```

在仓库根目录创建 `.env`（不要提交），最小配置：

```text
STUDYGRAPH_LLM_PROVIDER=deepseek
STUDYGRAPH_TUTOR_PROVIDER=tacc
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash

# AI Tutor 固定走 TACC；没有 TACC 时生成仍可用，只有 tutor 不可用
QWEN_BASE_URL=http://127.0.0.1:18029/v1
QWEN_MODEL=qwen3.8-27b
```

启动后端和前端开发服务器：

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
}
.\.venv\Scripts\python -m uvicorn backend.main:app --port 8000
# 另一个终端
npm run dev --prefix frontend
```

打开 Vite 打印的地址（默认 `http://127.0.0.1:5173/`）。接口文档在 `http://127.0.0.1:8000/docs`。

### 模型供应商

AI Tutor 固定使用 TACC Qwen；可切换的是**生成模型**（概念图、study note、练习题）。

```text
# 生成模型默认：deepseek；也可设为 tacc
STUDYGRAPH_LLM_PROVIDER=deepseek
STUDYGRAPH_GENERATION_PROVIDER=

# AI Tutor 固定 TACC
STUDYGRAPH_TUTOR_PROVIDER=tacc
```

- `deepseek`：使用 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`。
- `tacc`：使用 `QWEN_BASE_URL`（必须带 `/v1`）、`QWEN_MODEL`（默认 `qwen3.8-27b`）、`QWEN_API_KEY`（本地服务可省略）；AI tutor 还需要持久 SSH 隧道。
- 侧栏的 **Generation model** 下拉可现场切换生成 provider（DeepSeek API / TACC Qwen）。它只改当前后端进程，重启后回到 `.env`；API key 始终留在后端；AI Tutor 不受这个下拉影响。
- 切到 TACC 前会先请求 `QWEN_BASE_URL/models`（2.5 秒超时），TACC 不可用时快速返回 503，不切换； tutor 每轮开始前也做同样 preflight，不会等满 180 秒。

TACC 作业通常只有 1 小时时限，作业结束后隧道会失效，AI Tutor 会报连接错误。生成可以继续用 DeepSeek；需要 TACC tutor 时按 [TACC 连接步骤](docs/tacc/live-qa.md)重新提交并更新 `QWEN_BASE_URL`。

## 组员从这里开始

第一次开会请用[25 分钟议程与演示步骤](docs/kickoff.md)。当前底座采用 React、TypeScript、FastAPI 和 SQLite；安装、启动和 provider 配置以上面的“评审快速开始”为准。后端检查运行：

```powershell
.\.venv\Scripts\python -m unittest discover -s backend -p 'test_*.py' -q
```

前端开发服务器用 `npm run dev --prefix frontend`；前端有改动时再跑 `npm run build --prefix frontend`。

从 Learning 上传 PDF 或 PPTX，生成概念图后可在助教面板提问，点击引用打开讲义原页。Test 支持上传多份讲义，选题型和难度后生成练习。课程架保存概念图、测验和作答进度，也可以直接打开内置样例。浏览器保存课程架与普通问答，Agent 对话保存在后端。真实模型配置见 [TACC 连接步骤](docs/tacc/live-qa.md)和 [pi Agent 接入说明](docs/pi-agent.md)。

上传资料后，后端解析课件并调用模型生成主题、概念节点及初始学习要点。不填写学习偏好时使用后端统一的默认指令，填写后使用用户偏好；需要配置可用的生成模型。前端负责转换并展示图谱。已保存图谱（包括旧标题分组图谱）直接恢复，不在重新打开时自动生成或分组。点击节点后的详细学习笔记仍由独立接口按需生成。

| 负责人 | 开工任务 | 第一次交接 |
|---|---|---|
| 底座负责人（兼任） | 准备前后端入口、锁定依赖、配置样例和 Windows 启动说明 | 另一名组员按 README 独立启动并打开样例讲义 |
| A 前端 | 用固定样例连接概念图、对话框和讲义 viewer | 点击引用能打开指定文档的指定页 |
| B 检索与模型 | 解析讲义并保留页码，核实 TACC 使用方式 | 给 A、C 提供真实片段，跑通并记录一次真实模型调用 |
| C 图谱与反馈 | 将概念、关系、练习和反馈关联到同一组片段 | 提供样例图谱，以及一次答错、提示、重答的记录 |

## 第一周交接

- **D1**：底座负责人组织 2–3 小时对齐接口。计划用 `frontend/` 放前端，`backend/` 放后端，`examples/` 放共享讲义和样例。实现入口时同步补上依赖版本、PowerShell 安装与启动命令、访问地址和成功标志。样例模式应能在没有 TACC 凭据时运行。
- **D2–D3**：三人按样例并行。B 优先参考课程通知中的公共 vLLM 环境示例，按包内 README 在 TACC 启动推理服务，用配套客户端完成一次请求，再把同一调用接入应用后端。记录实际模型名、连接配置和服务重启步骤。课程提供的两个包均为可选参考；私有环境示例适用于需要修改并重新构建 vLLM 的场景。
- **D4**：用一份真实讲义联调选概念、提问、打开引用页。检查引用位置和原文能否支撑回答。
- **D7**：在同一会话完成出题、作答、提示和重答，保留两次作答。第二周再扩至 2–3 份讲义，并在独立 Tests 页面完成选范围、生成整套题、逐题练习和查看结果。

## 协作方式

每项任务从 main 开分支，通过 PR 合并。PR 写明改动、复现步骤和结果。改共享字段时同时更新接口说明、样例，并请使用该字段的组员审阅。每人负责自己模块的检查；A 汇总导航结果，B 汇总引用、耗时和 baseline 对比，C 汇总图谱、反馈及三方评测结果。

搭建时补齐依赖锁文件、自动检查、只含占位值的 `.env.example` 和忽略规则。真实凭据仅由后端读取，本地配置、数据库和构建产物排除在版本控制之外。

## 项目材料

概念图与学习指南评测支持命令行导出、语义判分及离线复算，完整命令见 [评测运行说明](evaluation/runners/README.md#概念图与学习笔记可复现命令)。该流程复用网页的后端学习指南生成路径；省略 instructions 时与网页不填偏好使用同一默认指令。按需生成笔记的范围区别见说明。参考集仍待人工审核，尚无正式成绩。

本地工作台接入真实模型的步骤见 [TACC 问答配置](docs/tacc/live-qa.md)。

- [课程要求](docs/project/course_project.pdf)
- [项目提案](docs/project/StudyGraph_Project_Proposal%281%29.pdf)
- [团队分工与里程碑](docs/kickoff.md)
- [TACC 教程](docs/tacc/TACC_Toturial.pdf) · [公共环境参考包](docs/tacc/project-release-1.zip)

上传讲义、检索与引用跳页见[前端接入文档](docs/document-api.md)。
