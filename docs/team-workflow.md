# 三个人如何并行开发 StudyGraph

按[三周分工表](../StudyGraph_三周计划与分工.docx)安排。蓝色 **A** 负责学生看见和操作的界面，绿色 **B** 负责讲义证据、检索与模型调用，紫色 **C** 负责概念关系、练习与反馈。灰色节点是共同验收点。各角色从 D1 商定的同一份样例开始。

```mermaid
flowchart TD
  start["D1 · 共同选一份讲义，约定页码、ID、接口和固定 JSON"]
  start --> a1["A · 用固定 JSON 做概念图、对话框和讲义 viewer"]
  start --> b1["B · 解析 PDF/PPTX，保留片段和页码，按问题检索"]
  start --> c1["C · 用核验过的片段提取概念、关系和来源"]
  b1 -->|真实片段替换固定片段| c1
  a1 --> join["D4 · 点真实概念 → 提问 → 引用打开正确原页"]
  b1 --> join
  c1 --> join
  join --> a2["A · 接题目、提交、提示和重答交互"]
  join --> b2["B · 接入 TACC；校验回答引用和证据不足分支"]
  join --> c2["C · 设计练习与评分标准，保存反馈和历次作答"]
  a2 --> demo["D7 · 用一份讲义演示从选概念到重答"]
  b2 --> demo
  c2 --> demo
  demo --> a3["A · Tests 页面、多轮交互、导航任务与演示"]
  demo --> b3["B · 扩到多份讲义，完成 baseline、引用和延迟评测"]
  demo --> c3["C · 完善学习记录，评测关系与错答反馈，汇总结果"]
  a3 --> freeze["D14 · 冻结核心功能、测试集与展示提纲"]
  b3 --> freeze
  c3 --> freeze
  freeze --> endnode["D15–21 · 正式评测、交叉复核、修复、报告、排练和提交"]
  classDef a fill:#e6f0ff,stroke:#2970b8,color:#112d50;
  classDef b fill:#e1f4eb,stroke:#287650,color:#103d29;
  classDef c fill:#f2eafb,stroke:#8050a1,color:#42235a;
  classDef shared fill:#f0f2f4,stroke:#657380,color:#25323d;
  class a1,a2,a3 a;
  class b1,b2,b3 b;
  class c1,c2,c3 c;
  class start,join,demo,freeze,endnode shared;
```

| 交接方向 | 以“带宽上限”为例 | 接收方如何验收 |
|---|---|---|
| B → C、A | 提供文档 `roofline`、片段 `roofline-p2`、页码 2 和原文 | C 能给概念挂上证据；A 能打开同一份讲义的第 2 页 |
| C → A、B | 提供概念 `bandwidth`、关系两端的概念 ID、来源片段 ID 和推断标记 | A 能画出关系；B 能从选中的概念找到候选片段 |
| A ↔ B | A 通过 `POST /api/ask` 传会话、问题及可选概念；B 返回回答、证据状态和引用列表 | 有依据时能跳页，超出讲义范围时能说明证据不足 |
| A ↔ C | A 取题并提交作答；C 返回反馈、作答 ID 和尝试次数 | 重答沿用题目和会话 ID，前一次错答可追溯 |
| C ↔ B | C 提供目标概念、片段和评分标准；B 提供共用的模型调用入口 | C 可先用固定输出开发；接入真实模型后用同一组错答检查反馈 |

**开会时决定**：填上 A/B/C 姓名，选定第一份讲义，约好 D4 与 D7 的联调时间。每人提交自己的测试、报告段落和 slides，交叉核验标注。第三周由 A 展示问答与引用，B 讲架构和 TACC，C 展示错答反馈并讲评测局限。接口字段见[接口约定](interfaces.md)，会议步骤见[开工会议程](kickoff.md)。
