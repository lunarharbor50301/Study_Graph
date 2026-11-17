# Study-Graph

V2 的 pi Agent 在 `lyq-v2` 分支开发。安装运行依赖时增加 `npm ci --prefix agent --ignore-scripts`。助教默认使用 Agent，支持多轮对话、工具检索和流式回答，运行配置见 [pi Agent 接入说明](docs/pi-agent.md)。

StudyGraph 帮助学生从课程讲义的概念图出发，提问、回到原页核对解释，并在同一会话中练习、查看提示和重答。

## 组员从这里开始

第一次开会请用[25 分钟议程与演示步骤](docs/kickoff.md)。当前底座采用 React、TypeScript、FastAPI 和 SQLite。内置两页 Roofline 讲义，使用固定回答和规则评分。

在仓库根目录用 PowerShell 执行以下命令（Python 3.12、Node.js 24）。首次安装依赖需要联网。

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm run build --prefix frontend
.\.venv\Scripts\python -m uvicorn backend.main:app --port 8000
```

打开 http://127.0.0.1:8000 ，接口文档在 http://127.0.0.1:8000/docs 。前端开发可另开终端运行 `npm --prefix frontend run dev`，使用 Vite 打印的地址。后端检查运行 `.\.venv\Scripts\python -m unittest backend.test_smoke`。后续开会只需运行最后一条启动命令；前端有改动时先重新构建。

从 Learning 上传 PDF 或 PPTX，生成概念图后可在助教面板提问，点击引用打开讲义原页。Test 支持上传多份讲义，选题型和难度后生成练习。课程架保存概念图、测验和作答进度，也可以直接打开内置样例。浏览器保存课程架与普通问答，Agent 对话保存在后端。真实模型配置见 [TACC 连接步骤](docs/tacc/live-qa.md)和 [pi Agent 接入说明](docs/pi-agent.md)。

上传资料的概念图使用解析出的标题和小标题分组。同名知识点或共享标题前缀的内容可以合为一个节点，学习笔记保留各自的原页入口。生成图谱不需要模型。已保存的按页图谱会在重新打开时尝试重新分组。

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

本地工作台接入真实模型的步骤见 [TACC 问答配置](docs/tacc/live-qa.md)。

- [课程要求](docs/project/course_project.pdf)
- [项目提案](docs/project/StudyGraph_Project_Proposal%281%29.pdf)
- [团队分工与里程碑](docs/kickoff.md)
- [TACC 教程](docs/tacc/TACC_Toturial.pdf) · [公共环境参考包](docs/tacc/project-release-1.zip)

上传讲义、检索与引用跳页见[前端接入文档](docs/document-api.md)。
