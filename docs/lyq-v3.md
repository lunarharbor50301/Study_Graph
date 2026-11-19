# lyq-v3 改动说明

分支：`lyq-v3`（从 `v3-on-yxy` 的 `02ac867` 拉出，未合并回 `team/yxy-2.0` 或 `lyq-v2`）

## 一句话

把概念图生成从“一次调用出整张图”改成 V3 staged 流水线，同时保留单次回滚；AI Tutor 固定 TACC Qwen，生成模型可切 DeepSeek / TACC；并补上 AI Tutor 会话持久化、摘要压缩和会话管理。

## 1. V3 staged 概念图

入口不变：

```text
POST /api/documents/{doc}/study-guide
```

默认流程：

1. 按页读取并压缩页面索引；
2. 先生成大纲（topics + concepts + 页码范围）；
3. 按页码/字符预算分批写 notes，支持并行；
4. 检查未覆盖页面，补 gap notes；
5. 合并、去重、按页码排序。

特点：

- 取消 5×4 节点上限，节点数随讲义规模；
- 总调用上限 18，总输出预算 24000 tokens；
- 单次请求 600 秒、单次调用 180 秒；
- 部分批次失败时保留已有节点；
- 缓存 key 包含文档、instructions、provider、model。

回滚：

```text
STUDYGRAPH_CONCEPT_MAP_MODE=single
```

## 2. 模型 provider

| 功能 | provider |
|---|---|
| 概念图、study note、练习题 | 默认 DeepSeek，可切 TACC |
| AI Tutor | 固定 TACC Qwen |

相关环境变量：

```text
STUDYGRAPH_LLM_PROVIDER=deepseek
STUDYGRAPH_GENERATION_PROVIDER=
STUDYGRAPH_TUTOR_PROVIDER=tacc
```

侧栏 `Generation model` 可在运行时切换生成 provider；切 TACC 前会检查 `/v1/models`，不可用快速返回 503。AI Tutor 不使用这个下拉。

## 3. AI Tutor 会话

- 完整对话存入 SQLite，不再只保留最近 4 轮；
- 超过 8 轮时，把最近 6 轮之前的内容用 DeepSeek 压缩成摘要；
- 界面可恢复完整历史，模型只收到“摘要 + 最近 6 轮”；
- 会话下拉合并在一个菜单里：
  - 顶部 `New conversation`；
  - 每个历史会话可切换；
  - 每个会话右侧垃圾桶可删除；
  - 删除当前会话后自动切到下一个或新建空会话。

## 4. 接口变化

```text
GET    /api/agent/conversations?document_id=...
DELETE /api/agent/conversations/{session_id}?document_id=...
GET    /api/config/generation-provider
POST   /api/config/generation-provider
```

`GET /api/agent/history` 仍返回该会话全部成功轮次。

## 5. 验证

- 后端 37 个测试通过；
- `npm run build --prefix frontend` 通过；
- V3 默认指令一次 54 节点结果：核心概念 20/20、Precision 54/54、笔记 96.25%（LLM judge，参考集仍待人工复核；同配置另一次 49 节点，波动未消）。

## 6. 注意

- V3 是流水线版本号，不是 DeepSeek V3 模型；
- TACC 作业通常 1 小时结束，隧道失效后 AI Tutor 会报连接错误，生成仍可用 DeepSeek；
- 没有浏览器 E2E；会话删除立即执行，无二次确认；
- 本分支没有修改 `team/yxy-2.0` / `lyq-v2` 分支本身，但共享后端文件按上述内容做了有意修改。
