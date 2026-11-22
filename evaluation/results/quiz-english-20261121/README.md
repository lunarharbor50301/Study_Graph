# Test Question-Generation Capability Evaluation · English Expanded Version

2026-11-21, the current workspace's DeepSeek backend after fixing the synonym-answer upper-limit prompt and retry feedback. L1 and L2 each have 10 independent English tasks, with one question generated per task, for a total of 20 questions: 10 short-answer, 6 multiple-choice, and 4 true-false. Each handout uses real retrieval and model calls. The run saved the actual requests, raw model replies, validation status, and web question fields.

| Metric | L1 | L2 | Total |
|---|---:|---:|---:|
| Successfully delivered English questions with correct question type | 10/10 | 10/10 | 20/20 |
| Passed backend validation on first attempt | 10/10 | 10/10 | 20/20 |
| Returned citations fall within the specified physical pages | 10/10 | 10/10 | 20/20 |
| Fully implemented task requirements in terms of question stem, answer, and explanation | 8/10 | 9/10 | 17/20 |

## Evaluation Criteria

Each task specifies the knowledge point, question type, difficulty, physical page, and specific action. Tasks run independently, and retrieval terms use English topics; the product backend is used to retrieve within the entire handout, and then the citation pages actually selected by the model are checked. Spot-checking web operations and grading student answers are outside the scope of this round. Full implementation is judged by checking each question's content: the question stem should cover the specified scenario and each sub-question, and the answer and explanation should give the corresponding conclusions. Page-number hits only check the range; evidence deficiencies are listed separately below. Answer checking compares against the handout and the question setup, and calculation questions are independently recomputed. No clear errors were found in core conclusions, but the standalone answer field for L1-EN07 answered only half of the question.


## Ten-Point Automatic Scoring

The judge model is deepseek-flash, with a maximum of 10 points per question. The following is automatic scoring; undelivered questions are scored zero.

| Handout | Delivered | Average score /10 | Knowledge point coverage /3 | Answer correctness /3 | Citation support /2 | Answerability /2 |
|---|---:|---:|---:|---:|---:|---:|
| ACS-L1 | 10/10 | 9.80 | 2.80 | 3.00 | 2.00 | 2.00 |
| ACS-L2 | 10/10 | 9.90 | 2.90 | 3.00 | 2.00 | 2.00 |
| Overall | 20/20 | 9.85 | 2.85 | 3.00 | 2.00 | 2.00 |

[Per-question scores and judge reasons](scores.json). Page 48 of L2-EN04 only supports global memory coalescing, but the automatic judge still gave full citation marks; the per-question record retains this review comment.

## Per-Question Records

### L1-EN01 · Instruction pipeline throughput (automatic score 8/10)

**Task**　Write one English short-answer question using only physical PDF pages 16,17. Ask the student to distinguish steady-state throughput from the latency of a single instruction in a five-stage pipeline.

**Actual question**　In a five-stage instruction pipeline, what is the steady-state throughput (in instructions per cycle) after the pipeline is filled, assuming no bubbles?

**Answer**　1

**Check**　Partially satisfied. It only asks about throughput after the pipeline is filled, and omits asking about single-instruction latency. [Raw reply and citation (p. 17)](L1-EN01.json)

### L1-EN02 · Data hazards and forwarding (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 18,22. Present a dependent instruction pair. Ask which mechanism delivers an earlier result directly to the dependent operation and explain why.

**Actual question**　Consider a dependent instruction pair where the second instruction needs the result of the first. Which mechanism delivers the earlier result directly to the dependent operation, and why is this beneficial?

**Options**　Data forwarding, because it passes the result directly from a pipeline register to the ALU input, allowing the consumer to execute earlier and reducing stalls. / Register renaming, because it eliminates false dependencies by using additional registers. / Pipeline stalling, because it ensures the dependent instruction waits until the result is written back. / Out-of-order execution, because it allows the dependent instruction to execute before its operands are ready.

**Answer**　Data forwarding, because it passes the result directly from a pipeline register to the ALU input, allowing the consumer to execute earlier and reducing stalls.

**Check**　Satisfied. It uses a dependent instruction pair to test forwarding, and the answer explains why stalls are reduced. [Raw reply and citation (p. 22)](L1-EN02.json)

### L1-EN03 · Amdahl's law (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 66. Give a fixed-size workload with 80% parallel work and four processors. Ask for both the finite speedup and the infinite-processor limit.

**Actual question**　Using Amdahl's law for a fixed-size workload where 80% of the work is parallelizable (f = 0.8) and p = 4 processors, what is the finite speedup S(4), and what is the speedup limit as the number of processors goes to infinity? Give both values.

**Answer**　S(4) = 2.5; infinite-processor limit = 5

**Check**　Satisfied. Recomputed 1/(0.2+0.8/4)=2.5, and the limit is 1/0.2=5. [Raw reply and citation (p. 66)](L1-EN03.json)

### L1-EN04 · Warp branch divergence (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 44,45. Give a warp whose even and odd lanes take different branches. Ask for the effect on SIMD utilization and the reason.

**Actual question**　In the example where even and odd lanes take different branches, what is the effect on SIMD utilization and why?

**Answer**　Only a subset of threads execute, wasting SIMD pipeline utilization

**Check**　Satisfied. It gives the even/odd lane scenario and asks for an explanation of reduced utilization; the cited excerpt shows code, and the mechanism explanation could also cite page 44. [Raw reply and citation (p. 45)](L1-EN04.json)

### L1-EN05 · Simultaneous multithreading (automatic score 10/10)

**Task**　Write one English true-false question using only physical PDF pages 29. Test whether logical threads share all architectural state. In the explanation distinguish private state from shared execution resources.

**Actual question**　In simultaneous multithreading (SMT), each logical thread shares the same architectural state with the other logical threads on the physical core.

**Answer**　False

**Check**　Satisfied. The judgment and explanation separately describe logical-thread private state and shared execution resources. [Raw reply and citation (p. 29)](L1-EN05.json)

### L1-EN06 · Data versus task parallelism (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 33. Describe the same operation applied independently to different array elements. Ask the learner to classify the parallelism.

**Actual question**　According to the passage, which type of parallelism is described as applying the same operation independently to different array elements?

**Options**　Data parallelism / Task parallelism / Thread parallelism / Instruction-level parallelism

**Answer**　Data parallelism

**Check**　Satisfied. It tests data parallelism using independent operations on array elements. [Raw reply and citation (p. 33)](L1-EN06.json)

### L1-EN07 · Protecting a shared counter (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 57,58. Describe two threads losing an update to a shared sum. Ask for a synchronization mechanism and what it protects.

**Actual question**　In the context of two threads updating a shared sum, what synchronization mechanism is used to protect the critical section, and what does it protect?

**Answer**　Mutex

**Check**　Partially satisfied. It does not explicitly describe the lost update, and the answer field only gives Mutex; the explanation supplements what is protected. [Raw reply and citation (p. 58)](L1-EN07.json)

### L1-EN08 · CUDA global thread index (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 61,62. Give blockIdx.x=2, blockDim.x=64 and threadIdx.x=3. Ask for the one-dimensional global index.

**Actual question**　Given blockIdx.x = 2, blockDim.x = 64, and threadIdx.x = 3, what is the one-dimensional global index i computed by the formula i = blockIdx.x * blockDim.x + threadIdx.x?

**Options**　131 / 128 / 67 / 192

**Answer**　131

**Check**　Satisfied. Recomputed as 2×64+3 = 131. [Raw reply and citation (p. 62)](L1-EN08.json)

### L1-EN09 · Scope of CUDA synchronization (automatic score 10/10)

**Task**　Write one English true-false question using only physical PDF pages 63. Test whether __syncthreads() synchronizes all blocks of a kernel. Explain its actual scope.

**Actual question**　__syncthreads() synchronizes all blocks of a kernel.

**Answer**　False

**Check**　Satisfied. It correctly points out that the barrier synchronizes only one block. [Raw reply and citation (p. 63)](L1-EN09.json)

### L1-EN10 · Roofline throughput bound (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 67. Give arithmetic intensity of 2 FLOPs/byte, bandwidth of 100 GB/s and peak compute of 500 GFLOP/s. Ask for the throughput bound and the limiting resource.

**Actual question**　Using the Roofline model, with an arithmetic intensity of 2 FLOPs/byte, memory bandwidth of 100 GB/s, and peak compute of 500 GFLOP/s, what is the throughput bound (in GFLOP/s) and which resource limits performance? Provide the bound and the limiting resource concisely.

**Answer**　200 GFLOP/s, memory-bound

**Check**　Satisfied. Recomputed min(500,2×100)=200 GFLOP/s, limited by bandwidth. [Raw reply and citation (p. 67)](L1-EN10.json)

### L2-EN01 · Temporal and spatial locality (automatic score 9/10)

**Task**　Write one English short-answer question using only physical PDF pages 22,24. Ask the learner to identify the locality of repeated scalar use and of sequential array traversal. Require both labels.

**Actual question**　Based on the locality diagram, what type of locality describes a piece of data being quickly reused in the future, and what type describes neighbors of the current data access being accessed in the future? Give both labels.

**Answer**　Temporal locality; Spatial locality

**Check**　Partially satisfied. The two locality labels are correct, but the specified scenarios of scalar reuse and array traversal were replaced with definitions. [Raw reply and citation (p. 22)](L2-EN01.json)

### L2-EN02 · CUDA local memory (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 45,46. Ask which option correctly pairs CUDA local memory scope with its usual physical placement. Include exactly one correct pair.

**Actual question**　According to the passage, which option correctly pairs CUDA local memory's scope with its usual physical placement?

**Options**　Thread-private scope; usually resides in device DRAM and passes through L1/L2 / Block-shared scope; usually resides in shared memory on the SM / Thread-private scope; usually resides in registers with no DRAM access / Grid-wide scope; usually resides in host CPU memory

**Answer**　Thread-private scope; usually resides in device DRAM and passes through L1/L2

**Check**　Satisfied. The correct option includes both thread-private scope and device DRAM placement. [Raw reply and citation (p. 46)](L2-EN02.json)

### L2-EN03 · Average memory access time (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 26,27. Give a hit time of 2 cycles, miss rate of 4% and additional miss penalty of 100 cycles. Ask for AMAT in cycles.

**Actual question**　Using the AMAT formula, compute the average memory access time in cycles for a cache with a hit time of 2 cycles, a miss rate of 4%, and an additional miss penalty of 100 cycles.

**Answer**　6 cycles

**Check**　Satisfied. Recomputed 2+0.04×100=6 cycles. [Raw reply and citation (p. 26)](L2-EN03.json)

### L2-EN04 · Coalescing versus bank conflicts (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 48,51. Ask the learner to distinguish a contiguous global warp load from a shared-memory warp load in which all lanes read the same word. Require both mechanisms.

**Actual question**　Using the supplied passages, distinguish how a contiguous global-memory warp load is handled versus a shared-memory warp load in which all lanes read the same word. Name the mechanism used in each case.

**Answer**　Coalescing for the contiguous global load; broadcast for the same-address shared load

**Check**　Satisfied. The question stem and answer distinguish coalescing from broadcast; the citation to page 48 only supports the former, and the latter requires page 51. [Raw reply and citation (p. 48)](L2-EN04.json)

### L2-EN05 · DRAM bank parallelism (automatic score 10/10)

**Task**　Write one English true-false question using only physical PDF pages 36,37. Test whether independent banks can overlap work. Explain what can overlap.

**Actual question**　True or False: In a multi-banked DRAM chip, work in one bank can overlap with preparation in another bank.

**Answer**　True

**Check**　Satisfied. It correctly states that preparation and access in different banks can overlap. [Raw reply and citation (p. 36)](L2-EN05.json)

### L2-EN06 · Independent memory channels (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 39,40. Present a workload issuing requests concurrently across independent channels. Ask how this affects aggregate bandwidth.

**Actual question**　A workload issues requests concurrently across multiple independent memory channels. According to the passage, how does this affect aggregate bandwidth?

**Options**　Aggregate bandwidth is the sum across independent channels when requests use them concurrently. / Aggregate bandwidth stays fixed because all channels share a single data bus. / Aggregate bandwidth doubles automatically because DDR5 splits 64 data bits into two 32-bit subchannels. / Aggregate bandwidth decreases because bank scheduling reduces bus utilization.

**Answer**　Aggregate bandwidth is the sum across independent channels when requests use them concurrently.

**Check**　Satisfied. It correctly states that total bandwidth can be summed when independent channels are used in parallel. [Raw reply and citation (p. 40)](L2-EN06.json)

### L2-EN07 · HBM packaging (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 55,57. Ask how dense, short interposer connections between HBM and the processor affect bandwidth and energy per bit. Require both effects.

**Actual question**　According to the passage, how do dense, short interposer connections between HBM and the processor affect bandwidth and energy per bit? Name both effects.

**Answer**　They improve both bandwidth and energy per bit.

**Check**　Satisfied. It covers both effects; "improve energy per bit" would be clearer if explicitly written as reducing energy per bit. [Raw reply and citation (p. 55)](L2-EN07.json)

### L2-EN08 · DDR, GDDR and HBM trade-offs (automatic score 10/10)

**Task**　Write one English multiple-choice question using only physical PDF pages 59. Ask which technology is favored for inexpensive expandable capacity. Explain the reason for the correct choice.

**Actual question**　According to the passage on page 59, which memory technology is favored for inexpensive, expandable capacity?

**Options**　DDR / GDDR / HBM / Shared LLC

**Answer**　DDR

**Check**　Satisfied. It correctly selects DDR, and the explanation gives the scalability and cost reasons. [Raw reply and citation (p. 59)](L2-EN08.json)

### L2-EN09 · CXL pooling versus coherent sharing (automatic score 10/10)

**Task**　Write one English true-false question using only physical PDF pages 66,67. Test the claim that assigning separate pooled capacity to hosts automatically gives them coherent shared access. Explain the distinction.

**Actual question**　True or False: Assigning separate pooled CXL memory capacity to different hosts automatically provides those hosts with coherent shared access to that memory.

**Answer**　False

**Check**　Satisfied. It correctly distinguishes capacity pooling from coherent sharing. [Raw reply and citation (p. 67)](L2-EN09.json)

### L2-EN10 · HBM tier placement (automatic score 10/10)

**Task**　Write one English short-answer question using only physical PDF pages 68,69. Present a frequently reused object in LPDDR. Ask when promotion to HBM is worth the transfer and bookkeeping costs.

**Actual question**　According to the passage, when is promoting a frequently reused object from the LPDDR tier to HBM worth the transfer and bookkeeping costs?

**Answer**　When future reuse saves more than the transfer and bookkeeping cost

**Check**　Satisfied. It correctly gives the condition that future reuse benefit exceeds migration and management costs. [Raw reply and citation (p. 69)](L2-EN10.json)

## Run Instructions

Load the backend environment variables at the repository root and then run. By default, it reads the 20 tasks in english-20. Generation uses the real handout library and the current generation model; scoring uses a separate DeepSeek call and requires DEEPSEEK_API_KEY. Choose a new output directory each time.

```sh
set -a
source .env
set +a
STUDYGRAPH_GENERATION_PROVIDER=deepseek .venv/bin/python -m evaluation.runners.quiz \
  --output-dir evaluation/results/quiz-quality-new
```

When scoring existing questions, add `--predictions evaluation/results/quiz-english-20261121`. The output includes frozen predictions, per-question scores.json, and a Markdown report. The judge scores separately using the handout physical pages, actual citations, question setup, and answer, with caps of 3 for knowledge point and instruction coverage, 3 for answer and explanation correctness, 2 for citation support, and 2 for answerability. Undelivered questions score zero on all items; judge call or scoring format errors will abort and retain previously completed records.

To generate questions only, run `python -m evaluation.runners.quiz.generate --help` to view parameters.

### Regenerate only these 20 questions

Run from the repository root, use a local document library containing the two original handouts, and first load the environment variables required by the backend. Use a new path for the output directory.

```sh
set -a
source .env
set +a
STUDYGRAPH_GENERATION_PROVIDER=deepseek .venv/bin/python -m evaluation.runners.quiz.generate \
  evaluation/03_question_generation/english-20/*.json \
  --output-dir evaluation/results/quiz-english-rerun
```

## Switching TACC / DeepSeek to Run the Evaluation

The following is how the current code runs; model names and scores in historical reports remain as-is; after switching models, save to a new results directory and re-score. [Full configuration, parameters, and run instructions](../../runners/README.md). All commands are executed from the repository root.

First start the TACC model and SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not need a DeepSeek API key. When switching to DeepSeek, configure `DEEPSEEK_API_KEY` in the current process. If the key is already saved in the project's `.env`, you can load it:

```bash
set -a
source .env
set +a
```

Question generation and the default judge both use TACC:

```bash
.venv/bin/python -m evaluation.runners.quiz --provider tacc --output-dir evaluation/results/quiz-tacc-new
```

When only re-scoring existing questions, add `--predictions evaluation/results/quiz-english-20261121`. You can add `--judge-provider deepseek` to use TACC for question generation and DeepSeek for scoring; `--provider deepseek` switches back to DeepSeek. Recomputing only the saved score numbers does not require calling the model.
