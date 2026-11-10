# 前端接入文档与检索 API

按 [README](../README.md) 安装锁定依赖、构建前端并启动 FastAPI。打开 http://127.0.0.1:8000/?documents 使用参考页面，或打开 /docs 调试。/openapi.json 可用于生成客户端。开发模式使用 Vite 的 /api 代理。

## 从上传到打开引用

| 方法与路径 | 请求 | 成功结果 |
|---|---|---|
| POST /api/documents | multipart/form-data，字段 file，PDF 或 PPTX，最多 40 MiB | 201，保存 document_id、page_count、preview_mode、pages_without_text |
| GET /api/documents | 无 | 已导入的文档列表 |
| GET /api/documents/{id} | 路径带文档 ID | 文档信息和 original_url |
| GET /api/documents/{id}/original | 无 | 原文件字节 |
| GET /api/documents/{id}/pages/{n} | n 从 1 开始 | text、chunks、preview_url |
| GET /api/documents/{id}/pages/{n}/preview | 无 | page_image 用 img 显示 PNG；slide_content 用 sandbox iframe 显示 HTML |
| POST /api/documents/{id}/search | {"query":"arithmetic intensity","top_k":4} | 按相关度排序的片段数组，含 text、chunk_id、page、preview_url；无命中返回空数组 |
| POST /api/ask | {"session_id":"demo","document_id":"上传返回的 ID","question":"What is arithmetic intensity?"} | answer、provider、evidence、citations；点击引用读取其 preview_url |

浏览器上传时将 File 加入 FormData，由浏览器设置 Content-Type 和 boundary。提问时保留 document_id；省略会走旧演示接口。文档问答支持可选 retrieval_query 指定检索词。成功命中时未配置模型返回原文摘录（extractive），配置模型后返回生成回答（tacc）。证据不足时 citations 为空。加载和错误均应结束前端等待状态。

HTTP 404 表示文档或页不存在，413 为文件过大，415 为格式不支持，422 为输入、解析或转换错误，502 为模型请求或模型回复格式错误。错误说明在 detail 中。参考实现见 [Documents.tsx](../frontend/src/Documents.tsx)。

## 部署配置

默认使用 backend/lectures.sqlite3 持久化，可通过 STUDYGRAPH_DATABASE 指定文件路径。原文件内容不同即生成不同 ID。扫描 PDF 可显示原页；要提取扫描页文本，配置可用的 Tesseract 语言数据和 STUDYGRAPH_OCR_LANG（例如 eng 或 chi_sim+eng）。用 pages_without_text 提醒用户哪些页不能检索。

PPTX 默认显示文字、表格和支持的图片；版式、图表或字体保真需要安装 LibreOffice，令 soffice 位于 PATH 或设置 SOFFICE_PATH，并在首次导入前配置。模型配置见 [TACC 说明](tacc/live-qa.md)。本地参考页与正式前端可复用同一后端。
`POST /api/ask` 的文档问答成功响应包含 timing_ms（毫秒）：expansion 保留为 0（英文问题直接检索），retrieval 为检索，generation 为回答生成往返，total 为文档问答处理总耗时。未调用的阶段记为 0。

## Learning 与练习的交接约定

A 提交会话、问题和可选概念；B 返回答案、证据状态与页码从 1 开始的引用。C 用稳定的片段 ID 关联概念与来源，标明哪些关系属于推断。练习重答沿用会话和题目 ID，每次生成独立的作答 ID；参考答案和评分依据保存在后端。

## B 已提供的 Tests 出题接口

两个 POST 接口都接受 `{"concepts":["Amdahl's law","Roofline"]}`，每次选 1–5 个概念。

| 接口 | 返回内容 |
|---|---|
| `/api/documents/{doc}/concept-evidence` | 按输入顺序返回概念和各自最多两条候选引用。每条含 document_id、chunk_id、page、text 和 preview_url。概念找不到片段时 citations 为空。 |
| `/api/documents/{doc}/question-set` | TACC 为每个不同概念生成一道英文简答题，返回 provider 和有序 questions。每题含 concept、prompt 和 citations。后端校验题量、重复题干和引用归属。 |

缺少出题证据返回 422，未配置模型返回 503，模型调用失败或格式无效返回 502。C 可以用返回的题目建立测验记录，附上经核对的评分依据。

## Tests 作答与记录接口（待开发）

Learning 的单题练习通过会话关联。Tests 以 test_id 关联整套测验，建议接口如下。

| 操作 | 建议接口 | 交接内容 |
|---|---|---|
| 生成一套题 | POST /api/tests | A 提交讲义 ID、概念范围和题量；C 设计覆盖范围、题型和评分依据；B 提供每个概念的讲义证据和模型调用。返回 test_id、有序题目 ID、题量。 |
| 打开或继续测验 | GET /api/tests/{test_id} | 返回题目、当前题号、已答题数和测验状态。参考答案和评分依据由后端保管。 |
| 本题提示、作答或重答 | POST /api/tests/{test_id}/items/{item_id}/hints 或 /attempts | 每次操作归属具体测验和题目，返回本题反馈、可查看的讲义引用和最新进度；保留之前的尝试。 |
| 完成测验 | POST /api/tests/{test_id}/finish | 返回整套完成情况和逐题结果，包括涉及的概念、反馈和复习页码。 |

验收用例：生成 5 题，做完前两题后返回 Learning；再次打开同一场测验，仍可看到同样的题序与已答记录，从第 3 题继续。完成后能从结果页定位到每题的讲义依据。
