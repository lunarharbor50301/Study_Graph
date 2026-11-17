# pi Agent 接入

基于 earendil-works/pi 的 pi-agent-core 和 pi-ai 1.5.2，依赖版本由 agent/package-lock.json 固定。FastAPI 启动 Node 子进程运行 pi，工具通过标准输入输出返回到 Python 执行。需要 Node.js 22.19+。

```powershell
npm ci --prefix agent --ignore-scripts
npm ci --prefix frontend
npm run build --prefix frontend
```

模型必须支持原生 function calling 和流式 Chat Completions。已核对课程公共环境：vLLM 0.26.0，模型模板使用 XML 工具格式，但公共 serve.sh 没有开启自动工具调用。项目的 deploy/tacc-agent/job.sh 复用公共环境和权重，并增加 --enable-auto-tool-choice --tool-call-parser qwen3_xml。无需编译私有 vLLM。

在已配置 tcloud 的 WSL 中提交（将 tcloud 加入 PATH，或使用其完整路径）：

```bash
cd /mnt/e/6000vproject/deploy/tacc-agent
tcloud submit
tcloud cat slurm_log/studygraph-agent-JOB_ID.log
```

等待 Application startup complete，再按日志中的 SERVICE_BASE_URL 配置隧道。独立服务默认使用 18231 端口，避免与节点已有的 8000 服务冲突。作业时限一小时；用完执行 tcloud cancel -j JOB_ID。

2026-11-15 联调时，10-0-1-10 虽显示 idle，但出现端口占用及 CUDA 初始化显存不足。tuxiv.conf 暂时排除此节点；管理员处理后可删除 exclude 配置。脚本保留 Slurm 提供的 CUDA_VISIBLE_DEVICES，并记录 nvidia-smi，避免硬编码 GPU 编号。

本地开发使用持久 SSH 隧道。在 WSL 保持以下命令运行，把 NODE 换成当前作业日志中的节点。

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -i ~/.ssh/tacc/id_ed25519 -p 30041 \
  -L 127.0.0.1:18024:NODE:18231 liuyueqi@gw.turing.ust.hk
```

在 Windows PowerShell 设置后端，然后启动。

```powershell
$env:QWEN_BASE_URL='http://127.0.0.1:18024/v1'
$env:NO_PROXY='localhost,127.0.0.1'
Remove-Item Env:TACC_SSH_TARGET -ErrorAction SilentlyContinue
.\.venv\Scripts\python -m uvicorn backend.main:app --port 8024
```

助教统一调用 POST /api/agent/stream，响应为逐行 JSON。单轮问答接口保留用于对照评测。Agent 会收到当前页、选中概念或题目，以及同一会话、同一讲义最近四轮成功的对话。对话存入本地 SQLite，失败和中止的轮次不进入后续上下文。超过上下文预算时按整轮丢弃旧记录。此开发服务使用单个 Uvicorn worker，同一会话串行执行。

出题和流式学习笔记可以使用 DeepSeek，AI 学习助手通过 `QWEN_BASE_URL` 连接 TACC Qwen。在仓库根目录的本地 `.env` 中设置 `STUDYGRAPH_GENERATION_PROVIDER=deepseek` 和 `DEEPSEEK_API_KEY`。官方服务默认使用 `https://api.deepseek.com` 和 `deepseek-flash`，可通过 `DEEPSEEK_BASE_URL` 与 `DEEPSEEK_MODEL` 指定。用 PowerShell 把这些配置加载到同一个终端，再运行上面的启动命令。

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*(STUDYGRAPH_GENERATION_PROVIDER|DEEPSEEK_API_KEY|DEEPSEEK_BASE_URL|DEEPSEEK_MODEL)\s*=\s*(.*?)\s*$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
}
```

浏览器在课程架中为每个概念图或测验保存一个 Agent 会话 ID。Agent 后端再按讲义 ID 分开保存对话。切换讲义或刷新时，Agent 用 GET /api/agent/history?session_id=...&document_id=... 恢复该讲义最近四轮成功对话及引用、检索记录。普通问答的显示记录保存在课程架，其模型调用仍按单轮执行。New conversation 为当前课程架条目创建新的 Agent 会话 ID。切换课程架条目或讲义会中止当前 Agent 请求。合并前按概念保存的旧会话仍保留在原存储中，新课程架使用新的会话 ID。

模型可以调用 search_lecture、read_page、list_documents。检索和读页限定为当前选中的讲义。读页提供最多 16000 字符，对更长页面暂时读取前段。最多调用模型三次、执行六个工具，整体超时 180 秒。第三次调用要求直接完成回答。最终引用必须匹配实际读到的来源 ID，页码和预览 URL 由后端提供。

事件包括 model_start、model_end、tool_start、tool_result、answer_start、delta、done 和 error。done 包含答案、引用、实际工具记录、模型调用次数和耗时。断开请求或按 Stop 会终止本次 Node 进程。前端可展开 Lecture lookups 核对检索词和页码。

```powershell
node agent/test-runner.mjs
.\.venv\Scripts\python -m unittest backend.test_agent backend.test_smoke backend.test_documents backend.test_quiz
```

测试使用本机模拟 OpenAI 服务，运行真正的 pi Agent，覆盖检索、读页、三次调用上限、流式输出、已知来源校验、跨轮上下文和会话隔离。第三次调用会把已找到的证据交给模型直接作答，避免 Qwen 沿着工具记录继续发起检索。真实模型复测命令和结果见 [Agent 评测说明](agent-evaluation.md)。
