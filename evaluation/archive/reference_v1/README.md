# 单课件参考集入口

每次只导入一份 PDF 时，只使用对应的一个 JSON 文件；不要同时加载两个参考文件。

## Lecture 1
- 数据文件：[lecture1_reference.json](lecture1_reference.json)
- 包含：18 个概念、7 条关系、18 组笔记要点、14 道问答、6 条批改样例。

## Lecture 2
- 数据文件：[lecture2_reference.json](lecture2_reference.json)
- 包含：20 个概念、9 条关系、20 组笔记要点、16 道问答、12 条批改样例。

## 共用规则
见 [SCORING.md](SCORING.md)。两份文件均保持待人工审核状态，尚未划分开发集和测试集。

已将 3 条跨课件关系移到 cross_lecture_relations_optional.json，仅供未来多课件评测使用。每份文件中的无证据题均已改为当前单课件范围。

原 concepts.json、relations.json、study_notes.json、qa.json、feedback.json、manifest.json 及 combined_reference_archive.md 保留为 v0.1 构建来源，不再作为单课件评测入口。lecture1_pages.json 与 lecture2_pages.json 为各自原文提取索引。


## 练习模块专项评测（新增）

每份分为出题、批改、回答三模块，建议先阅读Markdown，程序运行使用同名JSON。

- [Lecture 1 可读版](lecture1_test_generation_eval.md) · [JSON](lecture1_test_generation_eval.json)
- [Lecture 2 可读版](lecture2_test_generation_eval.md) · [JSON](lecture2_test_generation_eval.json)

专项文件内的 evaluation_policy 是这次练习模块的评分规则。当前仅建立数据与标准，尚未运行 agent、未经人工审核。
