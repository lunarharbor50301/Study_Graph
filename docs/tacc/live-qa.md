# 在本地工作台使用 TACC 模型

开发环境为 Windows + WSL Ubuntu。先按仓库 README 安装依赖并构建前端，确认 Ubuntu 里能用登记过的 SSH 密钥登录课程网关。

1. 在 Ubuntu 的课程包 `qwen-public-serve` 目录运行 `tcloud submit`，记下 GPU 作业 ID。
2. 运行 `tcloud cat slurm_log/qwen-public-serve-JOB_ID.log`，等到 `Application startup complete`，复制本次的 `SERVICE_BASE_URL`。
3. 在仓库根目录的 PowerShell 设置后端环境变量，再启动服务。用自己的用户名、网关端口和 WSL 私钥路径替换占位值。

```powershell
$env:STUDYGRAPH_TUTOR_PROVIDER = 'tacc'
$env:QWEN_BASE_URL = 'http://NODE:8000/v1'
$env:TACC_SSH_TARGET = 'YOUR_USERNAME@gw.turing.ust.hk'
$env:TACC_SSH_PORT = '30041'
$env:TACC_SSH_KEY = '/home/YOUR_WSL_USER/.ssh/tacc/id_ed25519'
.\.venv\Scripts\python -m uvicorn backend.main:app --port 8016
```

打开 http://127.0.0.1:8016 ，在 Learning 选择 ACS 讲义，输入 “What is the Roofline model?”，点击 Ask。点击回答下的页码可查看原文。默认 provider 是 DeepSeek；本页只在 `STUDYGRAPH_LLM_PROVIDER=tacc`（或 `STUDYGRAPH_TUTOR_PROVIDER=tacc`）时使用 TACC。生成题目默认走 DeepSeek，不需要 TACC。后端通过 WSL SSH 在网关向计算节点发送请求，推理在 GPU 节点运行。

在浏览器开发者工具里查看 `POST /api/ask` 的响应。模型成功回答时 `provider` 为 `tacc` 或 `deepseek`，引用由检索端返回。连接失败返回 HTTP 502。未配置当前 provider 时使用原有的离线样例。如果后端所在环境可直接访问计算节点，只需设置 `QWEN_BASE_URL`。

用完按 Ctrl+C 停止本地服务，在 Ubuntu 运行 `tcloud cancel -j JOB_ID` 释放 GPU。下次启动时读取新作业的服务地址。
