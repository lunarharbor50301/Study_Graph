# Lecture 2 同一概念图在两版参考集下的评分变化

2026-11-18，使用两份参考集评估了同一份 [Lecture 2 预测](prediction.json)。该预测包含 20 个概念节点。评分器记录的预测内容 SHA256 均为 `acf78f82b5f563fdd2c937f2891cc4eb04c7ff2affdb84707eae962540739bd4`。

**修订参考集并重新判分后，核心概念覆盖率从 25% 升至 40%，概念准确率保持 100%。** 该差值反映同一预测在两套评测口径下的表现。参考内容、语言和评分提示词同时变化，无法分离各因素的贡献，也不能据此推断生成系统的性能提升。两套参考集均待人工审核。

| 指标 | 原参考集 | v0.4-en | 变化（百分点） |
|---|---:|---:|---:|
| 核心概念覆盖率 | 5/20 = 25% | 8/20 = 40% | +15 |
| 生成概念准确率（Precision） | 20/20 = 100% | 20/20 = 100% | 0 |
| 核心关系覆盖率 | 0/9 = 0% | 0/9 = 0% | 0 |
| 关系准确率 | 0/0，N/A | 0/0，N/A | N/A |
| 笔记得分（按参考笔记等权平均） | 28.75% | 34.17% | +5.42 |
| 笔记得分（累计得分 / 累计满分） | 30/100 = 30% | 36/104 = 34.62% | +4.62 |
| 完全覆盖的笔记要点 | 13/50 = 26% | 15/52 = 28.85% | +2.85 |

原始分子、分母及各笔记分数见[旧版汇总](metrics.json)和[新版汇总](v04/metrics.json)。笔记指标衡量图谱生成时附带的学习要点。预测中没有生成概念间的语义关系。

## 哪些判定发生了变化

- 两次都命中的五项是局部性、平均访存时间（AMAT）、访存合并、DDR/GDDR/HBM 权衡和 CXL。
- 新命中的三项是 Memory Wall、内存通道和 GPU 存储层次。Memory Wall 是新参考项，后两项在旧参考集中已存在，本次被评分器认定为覆盖。
- 笔记累计得分增加的 6 分可逐项追溯。新增的 Memory Wall 笔记得到 5/6，DRAM 多 bank 从 0/4 变成 1/4。内存通道的笔记仍为 0/4，GPU 存储层次仍为 2/8。这说明评分器分别判断了概念是否出现和必要 Facts 是否讲全；内存通道的两项判定尤其值得人工复核。
- SRAM 与 DRAM 仍未获得完整核心概念匹配，其笔记两次均得 2/4。

具体匹配 ID、节点理由及逐 Fact 分数可对照[旧版判定](review.json)和[新版判定](v04/review.json)。

## 评测口径与复算

[旧参考集](../../01_knowledge/lecture2.json)使用中文概念名、Facts 和英文别名。评分器通过语义匹配评估英文预测。[英文参考集](../../01_knowledge/v0.4-en/lecture2.json)加入 Memory Wall，将 LPDDR 案例并入分层内存管理，拓宽 CUDA 内存空间的考查范围。两次均使用 deepseek-flash，temperature 为 0。新版评分提示词从 v1 更新为 v2，明确允许多个正确节点共同覆盖一个核心概念。这里仅报告 Lecture 2 的一次预测。

从仓库根目录执行以下命令，可使用保存的判定离线复算两套指标。每次使用新的临时目录保存输出。

```bash
run=evaluation/results/l2-run1
out=$(mktemp -d)
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture2.json --prediction "$run/prediction.json" \
  --review "$run/review.json" --output "$out/original.json"
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/v0.4-en/lecture2.json --prediction "$run/prediction.json" \
  --review "$run/v04/review.json" --output "$out/v04.json"
```
