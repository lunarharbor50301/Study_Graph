# StudyGraph 评测入口

当前状态：候选参考集已按功能拆分；未人工审核、未冻结开发/测试划分，尚无模型评测成绩。

## 先选板块，再选课件

1. [概念图与Study Notes](01_knowledge/README.md)：各自lecture1.json / lecture2.json。
2. [AI Tutor](02_ai_tutor/README.md)：single_turn单轮，multi_turn新增连续对话。
3. [出题能力](03_question_generation/README.md)：每课件5任务，要求7题。
4. [学生答案批改](04_answer_grading/README.md)：每课件20例。
5. [回答固定习题](05_question_answering/README.md)：课件1有12题，课件2有14题。

Tutor单轮分别14、16题；多轮每份3段×4轮，共24轮。习题与Tutor复用题库，不当作独立样本重复统计。

## 使用顺序

- 核对sources/documents.json中的PDF版本，只导入对应课件。
- 阅读板块README与[共用评分规则](shared/scoring.md)。问答答案统一存于shared/question_bank.json。
- 人工核实参考标准，再冻结shared/split_manifest.json。
- 只发送input给agent，保存原始输出到results/实验编号/。
- 分别评正确性、完整性、引用、错误定位；按课件/模块分别报告。

archive只保留历史快照，不参与新评测。runners的历史脚本不直接兼容新版数据格式。概念图与学习指南的新版导出、语义评分和离线复算命令见 [运行说明](runners/README.md)。当前没有正式模型成绩，不能把结构验证当作性能验证。

