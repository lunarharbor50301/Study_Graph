# 回答固定习题

通过question_ids引用shared/question_bank.json，避免重复维护答案。只含可依据课件作答的题目；证据不足题在Tutor模块。逐要点评分，额外错误和引用单列统计。

唯一指标定义：[共用评分规范 v1.0](../shared/scoring.md)。分母为0记N/A，未执行检查记未测；失败不能静默剔除。
