# ACS 两份课件参考集 v0.1

状态：已由助手核对所引用的提取文本，并抽查 8 页图像；尚未经团队人工审核，不是最终金标准。

范围：核心知识初始子集，并非穷尽所有概念、图表、代码和练习。文件名映射与 SHA256 见 manifest.json。统一使用从 1 开始的 PDF 物理页码。

## 使用与评分
- concepts.json：同义名称先映射 ID；评核心概念覆盖率和事实正确性。有效新增概念单独核实，不自动判错。
- relations.json：比较方向、端点和关系语义；跨课件综合关系需人工复核。
- study_notes.json：各要点 0=缺失/错误，1=部分正确，2=完整正确；额外错误另记，不能用高覆盖掩盖错误。
- qa.json：逐项评分，接受中英文等价表达；引用既要可打开，也必须支持对应结论。列出的页面是已知证据，不是唯一允许页。
- feedback.json：初始 18 条受控示例，三类各 6 条；目前不提供伪精确人工分数。后续补充混合正误、多错误及答非所问。
- lecture*_pages.json：136 页原始提取文本，便于定位；图片、公式和代码不可仅凭提取文本判定。
- 不按条目随机拆分：同一概念、数值变体、错误答案与强关联关系应按题目家族整体分组，再冻结开发/测试划分。本版尚未划分。
- 本版未包含完整多轮任务与生成题目的评审结果；不要将候选参考数据的数量当作系统成绩。

## 人工审核清单
- [ ] 双人抽查定义、公式、引用与关系；记录审核者及日期。
- [ ] 确认课件简化表述、架构特定限制；若与专业知识有冲突，保留争议而非直接作为标准。
- [ ] 为学生答案逐条补齐评分要点得分、遗漏与误解类型。
- [ ] 确定知识粒度与评测范围，冻结题目家族划分。

## 概念与笔记参考

### hierarchy · 计算抽象层次
来源：ACS-L1，PDF 第 6 页。
- 应用问题确定目标
- 算法确定方法和并行性
- 微架构执行指令和移动数据

### pipeline · 五级流水线
来源：ACS-L1，PDF 第 16 页。
- 五阶段为 IF、ID、EX、MEM、WB
- 通过阶段重叠提高吞吐

### ideal-pipeline · 理想流水线性能
来源：ACS-L1，PDF 第 17 页。
- N 条指令、M 个阶段共需 M+N-1 周期
- 假设无气泡且填满后每周期完成一条

### hazard · 流水线冒险
来源：ACS-L1，PDF 第 18 页。
- 数据冒险来自数据依赖
- 控制冒险来自分支等
- 结构冒险来自硬件资源争用

### forwarding · 数据转发
来源：ACS-L1，PDF 第 22 页。
- 结果可直接从流水线寄存器送至 ALU 输入
- 消费者更早执行并减少停顿

### ooo · 乱序执行
来源：ACS-L1，PDF 第 25 页。
- 区分程序顺序、执行顺序和提交顺序
- 硬件可以在其他指令等待时调度独立指令

### superscalar · 超标量
来源：ACS-L1，PDF 第 26 页。
- 尝试每周期执行多条指令
- 需要宽取指译码和多个执行单元

### smt · 同时多线程
来源：ACS-L1，PDF 第 29 页。
- 多个硬件线程共享一个物理核
- 逻辑线程各有架构状态但共享执行单元等资源

### parallelism · 数据与任务并行
来源：ACS-L1，PDF 第 33 页。
- 数据并行处理不同数据
- 任务并行并发执行不同任务

### sm · 流式多处理器
来源：ACS-L1，PDF 第 35 页。
- 包含处理单元、warp 调度器和共享内存等
- 一个 warp 等待时可以调度另一个就绪 warp

### warp · Warp 与 SIMT
来源：ACS-L1，PDF 第 37 页。
- 课件中的 NVIDIA warp 包含 32 个线程
- 线程块分配至一个 SM
- Fermi 的驻留上限是架构特定示例

### latency-hiding · 延迟隐藏
来源：ACS-L1，PDF 第 41 页。
- 交错执行不同 warp 隐藏等待延迟
- 不等于消除一次访存本身的延迟

### divergence · 分支分歧
来源：ACS-L1，PDF 第 44 页。
- 同一 warp 内线程走不同执行路径
- 部分线程执行会降低 SIMD 利用率

### atomic · 原子操作
来源：ACS-L1，PDF 第 49 页。
- 并发更新同一内存位置需要原子性等正确同步
- 课件展示 atomicAdd 和同址原子冲突

### mutex · 互斥锁
来源：ACS-L1，PDF 第 58 页。
- 保护共享状态的临界区串行访问
- 锁竞争会产生代价

### block-sync · 块内同步
来源：ACS-L1，PDF 第 63 页。
- __syncthreads 作用域是一个 CUDA block
- 可用于共享内存装载后的线程协调

### amdahl · Amdahl 定律
来源：ACS-L1，PDF 第 66 页。
- 固定问题规模时 S(p)=1/((1-f)+f/p)
- f 为可并行比例
- 串行部分限制最大加速比

### roofline · Roofline 与算术强度
来源：ACS-L1，PDF 第 67 页。
- 算术强度为 FLOPs 除以从内存搬运的字节数
- 内存受限时带宽乘算术强度构成性能上界
- 峰值不保证实际性能

### memory-hierarchy · 存储层次
来源：ACS-L2，PDF 第 21 页。
- 频繁访问数据适合快速小容量存储
- 低频数据适合较慢大容量存储

### locality · 局部性
来源：ACS-L2，PDF 第 22 页。
- 空间局部性是邻近数据可能被访问
- 时间局部性是同一数据短期内被复用

### cache-hit · 缓存命中与未命中
来源：ACS-L2，PDF 第 25 页。
- 命中要求当前缓存层存在有效匹配
- miss rate=1-hit rate
- 未命中需要更低层服务

### amat · 平均访存时间
来源：ACS-L2，PDF 第 26 页。
- AMAT=hit time+miss rate×miss penalty
- miss penalty 包含访问延迟和传输时间

### tlb · TLB 与缓存未命中
来源：ACS-L2，PDF 第 30 页。
- TLB miss 涉及地址翻译
- cache miss 涉及从更低层获取数据
- 两者不同

### sram-dram · SRAM 与 DRAM
来源：ACS-L2，PDF 第 32 页。
- SRAM 用稳定晶体管电路保存状态，常用于缓存和寄存器
- DRAM 用电容保存数据，需要刷新和读取后恢复

### banks · DRAM 多 bank
来源：ACS-L2，PDF 第 36 页。
- 独立 bank 的工作可以重叠
- 共享数据总线仍限制同时返回的数据量

### channels · 内存通道
来源：ACS-L2，PDF 第 40 页。
- 独立通道并发使用可增加带宽
- DDR5 将 64 位分成两个 32 位子通道不会单独使总位宽翻倍

### gpu-memory · GPU 存储层次
来源：ACS-L2，PDF 第 43 页。
- 寄存器按线程分配
- 共享内存与 L1 位于 SM 层
- L2 为设备级共享
- GDDR/HBM 是片外存储

### local-memory · CUDA local memory
来源：ACS-L2，PDF 第 46 页。
- 作用域是线程私有
- 通常位于设备 DRAM 并经过 L1/L2
- 不能因 local 名称就认为位于寄存器

### coalescing · 访存合并
来源：ACS-L2，PDF 第 48 页。
- 针对单个 warp 的一条访存指令
- 对齐连续地址通常减少事务
- 跨界或跨步访问可能增加事务

### shared-memory · 共享内存数据暂存
来源：ACS-L2，PDF 第 50 页。
- 软件显式安排数据暂存和同步
- 片上重复复用可以减少 DRAM 流量并提高算术强度

### bank-conflict · 共享内存 bank 冲突
来源：ACS-L2，PDF 第 51 页。
- 同 bank 不同地址需要多个服务轮次
- 同地址读取可以广播
- 与全局访存合并是不同问题

### hbm · HBM 封装
来源：ACS-L2，PDF 第 57 页。
- HBM 通常在 interposer 上位于 XPU 旁边
- 高密度连接提高带宽和每比特能效但有封装等代价

### memory-tradeoff · DDR/GDDR/HBM 权衡
来源：ACS-L2，PDF 第 59 页。
- DDR 偏容量扩展和成本
- GDDR 权衡引脚带宽和板级成本
- HBM 偏封装带宽与能效

### coherence · 缓存一致性
来源：ACS-L2，PDF 第 63 页。
- 写传播要求其他处理器最终观察写入
- 写串行化要求对同一地址写入顺序一致

### coherence-protocol · 侦听与目录
来源：ACS-L2，PDF 第 64 页。
- 侦听广播请求，目录记录拥有者和共享者以定向发送
- MESI 描述权限而非消息路由方式

### cxl · CXL 扩容与池化
来源：ACS-L2，PDF 第 67 页。
- 扩容为一个主机增加容量
- 池化将设备容量分配给不同主机
- 一致性共享不同于仅映射相同区域

### lpddr · LPDDR 容量扩展
来源：ACS-L2，PDF 第 68 页。
- Grace 经 NVLink-C2C 连接 LPDDR5X
- 扩展加速器可寻址容量，不增大 HBM 本身

### tiering · 分层内存管理
来源：ACS-L2，PDF 第 69 页。
- 热且延迟敏感的数据优先放 HBM
- 大且冷的数据可放 LPDDR
- 迁移收益必须超过搬运和管理成本

## 关系参考
- R01: hazard — reduces_efficiency_of → pipeline
- R02: forwarding — mitigates_stalls_in → pipeline
- R03: ooo — mitigates_stalls_in → pipeline
- R04: superscalar — widens → pipeline
- R05: sm — schedules → warp
- R06: latency-hiding — interleaves → warp
- R07: divergence — reduces_utilization_of → warp
- R08: block-sync — coordinates_access_to → shared-memory
- R09: roofline — depends_on_reuse_enabled_by → shared-memory
- R10: memory-hierarchy — exploits → locality
- R11: cache-hit — determines_miss_rate_in → amat
- R12: sram-dram — provides_storage_technologies_for → memory-hierarchy
- R13: banks — shares_bandwidth_within → channels
- R14: local-memory — maps_to_device_DRAM_in → gpu-memory
- R15: coalescing — optimizes_transactions_for → warp
- R16: bank-conflict — can_serialize_access_to → shared-memory
- R17: coherence-protocol — implements → coherence
- R18: lpddr — provides_capacity_tier_for → tiering
- R19: hbm — provides_hot_data_tier_for → tiering

## 固定问答与评分要点

### Q01 列出五级流水线阶段，并解释流水线的主要作用。
参考答案：五阶段为 IF、ID、EX、MEM、WB；通过阶段重叠提高吞吐。
评分点：五阶段为 IF、ID、EX、MEM、WB；通过阶段重叠提高吞吐
来源：ACS-L1 p.16

### Q02 理想流水线执行 N 条指令、具有 M 个阶段，共需多少周期？说明条件。
参考答案：N 条指令、M 个阶段共需 M+N-1 周期；假设无气泡且填满后每周期完成一条。
评分点：N 条指令、M 个阶段共需 M+N-1 周期；假设无气泡且填满后每周期完成一条
来源：ACS-L1 p.17

### Q03 数据、控制和结构冒险有什么区别？
参考答案：数据冒险来自数据依赖；控制冒险来自分支等；结构冒险来自硬件资源争用。
评分点：数据冒险来自数据依赖；控制冒险来自分支等；结构冒险来自硬件资源争用
来源：ACS-L1 p.18

### Q04 超线程是否等于增加一个完全独立的物理核？
参考答案：多个硬件线程共享一个物理核；逻辑线程各有架构状态但共享执行单元等资源。
评分点：多个硬件线程共享一个物理核；逻辑线程各有架构状态但共享执行单元等资源
来源：ACS-L1 p.29

### Q05 比较数据并行与任务并行。
参考答案：数据并行处理不同数据；任务并行并发执行不同任务。
评分点：数据并行处理不同数据；任务并行并发执行不同任务
来源：ACS-L1 p.33

### Q06 所有 GPU 的 SM 都最多容纳 1536 个线程吗？请依据课件说明。
参考答案：课件中的 NVIDIA warp 包含 32 个线程；线程块分配至一个 SM；Fermi 的驻留上限是架构特定示例。
评分点：课件中的 NVIDIA warp 包含 32 个线程；线程块分配至一个 SM；Fermi 的驻留上限是架构特定示例
来源：ACS-L1 p.37

### Q07 什么是分支分歧，为什么会降低利用率？
参考答案：同一 warp 内线程走不同执行路径；部分线程执行会降低 SIMD 利用率。
评分点：同一 warp 内线程走不同执行路径；部分线程执行会降低 SIMD 利用率
来源：ACS-L1 p.44

### Q08 __syncthreads 能否同步不同 block？
参考答案：__syncthreads 作用域是一个 CUDA block；可用于共享内存装载后的线程协调。
评分点：__syncthreads 作用域是一个 CUDA block；可用于共享内存装载后的线程协调
来源：ACS-L1 p.63

### Q09 为什么固定规模程序不能靠无限增加处理器获得无限加速？
参考答案：固定问题规模时 S(p)=1/((1-f)+f/p)；f 为可并行比例；串行部分限制最大加速比。
评分点：固定问题规模时 S(p)=1/((1-f)+f/p)；f 为可并行比例；串行部分限制最大加速比
来源：ACS-L1 p.66

### Q10 什么是算术强度？内存带宽如何限制性能？
参考答案：算术强度为 FLOPs 除以从内存搬运的字节数；内存受限时带宽乘算术强度构成性能上界；峰值不保证实际性能。
评分点：算术强度为 FLOPs 除以从内存搬运的字节数；内存受限时带宽乘算术强度构成性能上界；峰值不保证实际性能
来源：ACS-L1 p.67

### Q11 互斥锁如何保护共享状态，有什么代价？
参考答案：保护共享状态的临界区串行访问；锁竞争会产生代价。
评分点：保护共享状态的临界区串行访问；锁竞争会产生代价
来源：ACS-L1 p.58

### Q12 区分空间局部性和时间局部性。
参考答案：空间局部性是邻近数据可能被访问；时间局部性是同一数据短期内被复用。
评分点：空间局部性是邻近数据可能被访问；时间局部性是同一数据短期内被复用
来源：ACS-L2 p.22

### Q13 写出 AMAT 公式，并解释 miss penalty。
参考答案：AMAT=hit time+miss rate×miss penalty；miss penalty 包含访问延迟和传输时间。
评分点：AMAT=hit time+miss rate×miss penalty；miss penalty 包含访问延迟和传输时间
来源：ACS-L2 p.26

### Q14 TLB miss 和 cache miss 是同一件事吗？
参考答案：TLB miss 涉及地址翻译；cache miss 涉及从更低层获取数据；两者不同。
评分点：TLB miss 涉及地址翻译；cache miss 涉及从更低层获取数据；两者不同
来源：ACS-L2 p.30

### Q15 比较 SRAM 和 DRAM 的存储方式及典型用途。
参考答案：SRAM 用稳定晶体管电路保存状态，常用于缓存和寄存器；DRAM 用电容保存数据，需要刷新和读取后恢复。
评分点：SRAM 用稳定晶体管电路保存状态，常用于缓存和寄存器；DRAM 用电容保存数据，需要刷新和读取后恢复
来源：ACS-L2 p.32

### Q16 增加 bank 后，一个通道的返回带宽是否无限增长？
参考答案：独立 bank 的工作可以重叠；共享数据总线仍限制同时返回的数据量。
评分点：独立 bank 的工作可以重叠；共享数据总线仍限制同时返回的数据量
来源：ACS-L2 p.36

### Q17 DDR5 两个 32 位子通道是否意味着总位宽翻倍？
参考答案：独立通道并发使用可增加带宽；DDR5 将 64 位分成两个 32 位子通道不会单独使总位宽翻倍。
评分点：独立通道并发使用可增加带宽；DDR5 将 64 位分成两个 32 位子通道不会单独使总位宽翻倍
来源：ACS-L2 p.40

### Q18 CUDA local memory 一定在片上吗？
参考答案：作用域是线程私有；通常位于设备 DRAM 并经过 L1/L2；不能因 local 名称就认为位于寄存器。
评分点：作用域是线程私有；通常位于设备 DRAM 并经过 L1/L2；不能因 local 名称就认为位于寄存器
来源：ACS-L2 p.46

### Q19 为什么对齐连续访问往往比跨步访问产生更少事务？
参考答案：针对单个 warp 的一条访存指令；对齐连续地址通常减少事务；跨界或跨步访问可能增加事务。
评分点：针对单个 warp 的一条访存指令；对齐连续地址通常减少事务；跨界或跨步访问可能增加事务
来源：ACS-L2 p.48

### Q20 同一个 bank 的所有访问都会发生冲突吗？
参考答案：同 bank 不同地址需要多个服务轮次；同地址读取可以广播；与全局访存合并是不同问题。
评分点：同 bank 不同地址需要多个服务轮次；同地址读取可以广播；与全局访存合并是不同问题
来源：ACS-L2 p.51

### Q21 比较 snooping、directory 和 MESI 的角色。
参考答案：侦听广播请求，目录记录拥有者和共享者以定向发送；MESI 描述权限而非消息路由方式。
评分点：侦听广播请求，目录记录拥有者和共享者以定向发送；MESI 描述权限而非消息路由方式
来源：ACS-L2 p.64

### Q22 为什么不能简单认为 HBM 对所有系统都是最佳选择？
参考答案：DDR 偏容量扩展和成本；GDDR 权衡引脚带宽和板级成本；HBM 偏封装带宽与能效。
评分点：DDR 偏容量扩展和成本；GDDR 权衡引脚带宽和板级成本；HBM 偏封装带宽与能效
来源：ACS-L2 p.59

### Q23 Grace 的 LPDDR 扩展是否增大了 GPU 的 HBM？
参考答案：Grace 经 NVLink-C2C 连接 LPDDR5X；扩展加速器可寻址容量，不增大 HBM 本身。
评分点：Grace 经 NVLink-C2C 连接 LPDDR5X；扩展加速器可寻址容量，不增大 HBM 本身
来源：ACS-L2 p.68

### Q24 哪些数据适合迁移至 HBM？迁移何时值得？
参考答案：热且延迟敏感的数据优先放 HBM；大且冷的数据可放 LPDDR；迁移收益必须超过搬运和管理成本。
评分点：热且延迟敏感的数据优先放 HBM；大且冷的数据可放 LPDDR；迁移收益必须超过搬运和管理成本
来源：ACS-L2 p.69

### Q25 固定规模程序 f=0.9，使用 10 个处理器时的理论加速比是多少？处理器无限多时上限是多少？
参考答案：S(10)=1/(0.1+0.9/10)=100/19≈5.263；极限为 10。
评分点：正确代入公式；有限处理器结果约 5.263；无限处理器上限为 10
来源：ACS-L1 p.66

### Q26 命中耗时 1 周期、miss rate=10%、miss penalty=300 周期，AMAT 是多少？
参考答案：1+0.1×300=31 cycles。
评分点：使用额外 miss penalty 的公式；结果 31；单位 cycles
来源：ACS-L2 p.27

### Q27 仅根据这两份课件，给出 yuxinye 当前 TACC 作业的实时 GPU 利用率。
参考答案：课件没有运行时测量数据，无法据此给出数值；需要对应作业或服务的监控记录。
评分点：说明证据不足，不编造数值；指出需要实际监控或测量数据
来源：两份固定 PDF 不包含当前运行时数据

### Q28 仅根据这两份课件，给出本地 StudyGraph 服务今天的实际 P95 响应时间。
参考答案：课件没有运行时测量数据，无法据此给出数值；需要对应作业或服务的监控记录。
评分点：说明证据不足，不编造数值；指出需要实际监控或测量数据
来源：两份固定 PDF 不包含当前运行时数据

## 学生答案受控示例

- F01 / Q07 / correct：同一个 warp 的线程走不同分支，导致部分线程执行，降低利用率。
  反馈要求：认可正确内容，不捏造错误。

- F02 / Q07 / partial_missing：同一个 warp 的线程走不同分支。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F03 / Q07 / incorrect：分歧是不同 GPU 使用不同程序，只会增加显存容量。
  反馈要求：明确纠正该错误，并基于参考要点给提示。

- F04 / Q08 / correct：它同步一个 block 内的线程，不能同步不同 block。
  反馈要求：认可正确内容，不捏造错误。

- F05 / Q08 / partial_missing：它是一种线程同步操作。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F06 / Q08 / incorrect：它会同步整台 GPU 上的所有 block。
  反馈要求：明确纠正该错误，并基于参考要点给提示。

- F07 / Q18 / correct：local memory 是线程私有，但通常在设备 DRAM 中并通过缓存访问。
  反馈要求：认可正确内容，不捏造错误。

- F08 / Q18 / partial_missing：local memory 的作用域是线程私有。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F09 / Q18 / incorrect：local memory 总是存放在寄存器中。
  反馈要求：明确纠正该错误，并基于参考要点给提示。

- F10 / Q20 / correct：同 bank 不同地址需要多个服务轮次，同地址读可以广播。
  反馈要求：认可正确内容，不捏造错误。

- F11 / Q20 / partial_missing：同 bank 不同地址需要多个服务轮次。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F12 / Q20 / incorrect：同地址读取一定比不同地址的冲突更严重。
  反馈要求：明确纠正该错误，并基于参考要点给提示。

- F13 / Q23 / correct：LPDDR 扩展可寻址容量，不会增大 HBM 本身。
  反馈要求：认可正确内容，不捏造错误。

- F14 / Q23 / partial_missing：LPDDR 可以扩展可寻址容量。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F15 / Q23 / incorrect：连接 LPDDR 会直接增加 HBM 芯片容量。
  反馈要求：明确纠正该错误，并基于参考要点给提示。

- F16 / Q24 / correct：热数据优先放 HBM，但迁移收益必须超过传输和管理成本。
  反馈要求：认可正确内容，不捏造错误。

- F17 / Q24 / partial_missing：热数据优先放 HBM。
  反馈要求：指出缺少的必要要点，不将已有正确陈述判错。

- F18 / Q24 / incorrect：所有数据都应该立即迁移到 HBM，迁移没有成本。
  反馈要求：明确纠正该错误，并基于参考要点给提示。
