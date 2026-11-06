# StudyGraph 如何把讲义变成一次有依据的学习对话

[提案第 2 页图 3](../StudyGraph_Project_Proposal%281%29.pdf) 给出了四个环节：讲义解析、知识层、学习 Agent、TACC 推理。下图把它展开为两段：上课前处理一次讲义，学习时循环处理学生的请求。实线表示数据或操作的去向，虚线表示调用模型辅助生成或分析。

```mermaid
flowchart TD
  subgraph prep["① 准备讲义"]
    pdf["上传 PDF 或 PPTX"] --> parse["按页或幻灯片解析文本"]
    parse --> chunks["保存原文片段、文档 ID、页码及可用的位置坐标"]
    chunks --> idx["建立关键词与向量索引"]
    chunks --> extract["提取概念、定义、公式、例题和关系"]
    extract --> graph["概念图关联来源片段；区分明示关系与推断关系"]
  end
  subgraph learn["② 学生学习，可在同一会话中多次往返"]
    graph --> select["点选概念"]
    select --> ask["提问、追问或请求举例"]
    direct["直接针对讲义提问"] --> ask
    ask --> retrieve["结合会话和当前概念检索原文"]
    idx --> retrieve
    graph --> retrieve
    retrieve --> evidence{"讲义证据足够？"}
    evidence -->|否| clarify["说明缺少什么证据，邀请补充问题"] --> ask
    evidence -->|是| explain["Agent 组织解释并核对引用"]
    explain --> reply["显示回答，区分讲义原文、解释和外部补充"]
    reply -->|点击引用| viewer["按文档 ID 和页码打开原页；有坐标时高亮"]
    viewer --> ask
    reply -->|继续追问| ask
    select --> practice["请求练习"]
    reply --> practice
    tests["Tests 页面选跨概念练习"] --> practice
    practice --> question["按目标概念和来源出题，保留参考答案与评分标准"]
    graph --> question
    question --> attempt["学生作答并说明理由"]
    attempt --> assess["对照讲义证据与评分标准，定位错误或缺失步骤"]
    assess --> feedback["给出反馈：追问理由、提示、例题或完整解释"]
    feedback -->|提示后重答| attempt
    feedback -->|推荐关联概念| select
    feedback -->|下一题| practice
    attempt --> record["按会话和题目保存每次作答、提示与重试"]
    feedback --> record
  end
  model["③ TACC · Qwen 推理服务"]
  extract -.-> model
  explain -.-> model
  question -.-> model
  assess -.-> model
```

**一次联调怎么走。** 选择“带宽上限” → 请求解释 → 点击回答中的“第 2 页”核对公式 → 做同概念练习 → 先答 50，得到乘法提示 → 重答 100。两次作答共享会话和题目 ID，各有自己的作答 ID。

**实现进度。** 本地样例已经能演示这条路径，使用固定片段与规则评分。TACC 集群内的真实推理已单独验证。图中的真实文档解析、向量检索、模型辅助生成、多轮策略及 Tests 页面属于目标实现。
