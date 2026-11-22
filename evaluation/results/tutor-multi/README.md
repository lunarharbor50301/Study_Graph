# AI tutor English multi-turn Q&A evaluation

Scoring date: 2026-11-22. TACC job 30603, model interface identifier qwen3.8-27b. This directory stores the complete output and per-turn scores of the current English test, replacing the previous Chinese results. The review is a Codex-assisted semantic review pending manual re-check; it is not an independent automated-judge model experiment.

## Purpose and test logic

The test consists of 6 dialogues drawn from two lecture sets, each with 4 turns, 24 turns in total. The inputs and required points have been translated into English in the original question-set directory, retaining question IDs, conditions, cited evidence, and scoring requirements. Topics cover pipelining, parallelism and SMT, Amdahl, locality and AMAT, CUDA memory, and HBM/LPDDR.

A new session is created for each dialogue, and within a dialogue the real /api/agent/stream is called in order; the backend uses its own history, and the evaluation side does not inject correct answers or scoring keys. Execution is serial to avoid multiple dialogues contending for the service simultaneously. The script retries HTTP 503 at most twice, but this run of 24 turns had no HTTP errors or retry records.

## Scoring logic

Each required point is scored 0 (wrong/missing), 1 (partial), or 2 (complete and correct). First the score obtained per turn / maximum score is computed, then turns are averaged with equal weight, and the two lecture sets are macro-averaged with equal weight; cumulative required-point scores are also reported. Semantic equivalence is allowed, with a numerical tolerance of 0.01; alternative citations must be checked for whether the passage actually supports the claim, not merely matched against the specified page number.

Additional errors are recorded separately from required points: even if the main answer is correct, an erroneous supplement still makes the strict dialogue fail. Strict success requires full required-point scores across all four turns, no substantive errors, passing context checks, and complete required evidence. The 18 context checks are explicitly annotated after the run based on the turn 2–4 questions and required points; the first turn does not apply. They are not a pre-registered independent 18-item test.

Citation checks are based on the returned body text and citation passages; not every claim was split out individually, and no claim-level citation support rate or completeness rate is reported. Web link navigation was not tested, and end-to-end success including navigation is untested. The candidate reference set has not yet been double-reviewed by humans, the exact model version and full service parameters are not all frozen, and the results represent only this small sample.

## Current English results

- **Overall**: execution success 24/24; per-turn average required-point score **99.31%**; cumulative required points 99/100; context 18/18; strict dialogue success 4/6; median latency 6.79s, P95 12.99s.
- **ACS-L1**: execution success 12/12; per-turn average required-point score **98.61%**; cumulative required points 47/48; context 9/9; strict dialogue success 2/3; median latency 7.75s, P95 14.34s.
- **ACS-L2**: execution success 12/12; per-turn average required-point score **100.00%**; cumulative required points 52/52; context 9/9; strict dialogue success 2/3; median latency 6.00s, P95 11.29s.

23/24 turns had full required-point scores, 1 turn had a partial score; 2 turns contained substantive errors (one of which was already penalized in required points, the other being an additional error), so a high required-point score does not mean all answers are reliable.

## Main issues and rulings

1. L1-MT01 turn 4: citations to pages 17/18/22/25 are complete, but the ending says "Any data hazard introduces bubbles", incorrectly treating a possible stall as inevitable. Data forwarding can eliminate some stalls, so the hazard/forwarding required point scores 1/2, and this turn scores 5/6.
2. L2-MT01 turn 3: the main formula and 31 cycles are correct, required points 4/4; however, the supplementary note incorrectly adds the extra miss penalty on top of the hit time again, obtaining 31.1. The correct probability expansion should be 0.9×1+0.1×(1+300)=31. The only citation in this turn, page 22, discusses only locality and does not support AMAT. This is treated as an additional substantive error and incomplete evidence, and the whole dialogue strictly fails.
3. L2-MT02 turn 4: cites pages 47/51, whereas the reference lists 48/51; page 47 actually explains that the coalescer groups by sector/transaction, so the valid alternative source is accepted and full marks are given.

## Per-turn scoring

### L1-MT01 (strict success: no)

[Full English answer and citations](L1-MT01.json)

#### Turn 1

Explain the five stages of a five-stage instruction pipeline and what each stage does.

**4/4 (100.00%)**. Lists the five stages and their functions, explains that overlapping improves throughput; cites pages 16 and 17, and additionally mentions superscalar on page 26.

- List IF/ID/EX/MEM/WB: 2/2.
- Overlapping stages improves throughput: 2/2.

#### Turn 2

Does that mean it makes every instruction take only one cycle?

**4/4 (100.00%)**. Correctly distinguishes the 5-cycle single-instruction latency of an ideal five-stage pipeline from the completion rate once the pipeline is filled, citing page 17.

- Resolve it as the five-stage pipeline: 2/2.
- Distinguish completion rate from a single instruction passing through multiple stages; reject the false premise: 2/2.

#### Turn 3

Using the same ideal five-stage pipeline, how many cycles are needed to execute 10 instructions?

**4/4 (100.00%)**. Retains M=5, N=10, obtains 14 cycles, citing page 17.

- Retain M=5 and use N=10: 2/2.
- Under ideal bubble-free conditions, 5+10-1=14 cycles: 2/2.

#### Turn 4

If a data hazard occurs, does the previous calculation necessarily still hold? Cite the supporting lecture pages.

**5/6 (83.33%)**. Retains the 14 cycles and cites pages 17, 18, 22, and 25, with complete sources. However, the final paragraph explicitly says "Any data hazard introduces bubbles", treating a possible stall as inevitable; although it mentions that forwarding reduces stalls, it does not acknowledge that some dependencies can eliminate stalls entirely, so the second required point scores only 1.

- Identify the previous calculation as the ideal 14-cycle result: 2/2.
- Hazards may cause stalls; forwarding can reduce stalls but does not guarantee 14 cycles in every case: 1/2.
- Cite pages supporting both the ideal formula and the effects of hazards: 2/2.

### L1-MT02 (strict success: yes)

[Full English answer and citations](L1-MT02.json)

#### Turn 1

Explain the difference between data parallelism and task parallelism.

**2/2 (100.00%)**. Correctly distinguishes concurrency over different data from concurrent execution of different tasks; page 33 supports the definition, and pages 34 and 55 provide background.

- Explain concurrent operations on different data versus concurrent execution of different tasks: 2/2.

#### Turn 2

Is the former suitable for applying the same operation to every element of an array? Why?

**4/4 (100.00%)**. Resolves the former as data parallelism and explains applying the same operation to different elements; the final paragraph says task parallelism is not what is needed here, which is understood as choosing based on the scenario and is not equivalent to the Chinese version's assertion that task parallelism cannot correctly and efficiently implement it.

- Resolve the former as data parallelism: 2/2.
- Different elements can be processed in parallel: 2/2.

#### Turn 3

Is SMT the same concept, then?

**4/4 (100.00%)**. Correctly compares SMT with data parallelism, explaining shared physical cores and independent architectural state, citing pages 29 and 33; scored on the distinction between mechanisms and ways of dividing work, without generalizing the claim to say SMT cannot run data-parallel workloads.

- Compare SMT with the preceding discussion of data parallelism: 2/2.
- SMT means multiple hardware threads sharing one physical core; it is not a synonym for data parallelism: 2/2.

#### Turn 4

Identify the lecture pages that support the distinction you just explained.

**4/4 (100.00%)**. Follows on from the SMT distinction, gives pages 29 and 33 plus additional background on pages 34 and 55, with all required sources present.

- Resolve the distinction as SMT versus data parallelism: 2/2.
- Give pages 29 and 33, or alternative pages that genuinely support the distinction: 2/2.

### L1-MT03 (strict success: yes)

[Full English answer and citations](L1-MT03.json)

#### Turn 1

For a fixed-size program that is 90% parallelizable, what speedup can 10 processors achieve?

**4/4 (100.00%)**. f=.9, p=10, 5.26× satisfies the 0.01 tolerance, citing page 66.

- Use f=.9 and p=10: 2/2.
- S=100/19, approximately 5.263: 2/2.

#### Turn 2

What if we increase that to 100?

**4/4 (100.00%)**. Retains f=.9 and the original fixed-problem-size model, changes p to 100, obtains 9.17×.

- Retain f=.9 and the fixed problem size: 2/2.
- S=1/(.1+.009), approximately 9.174: 2/2.

#### Turn 3

So adding more processors can push the speedup beyond 10 times, right?

**4/4 (100.00%)**. Rejects exceeding 10×, uses the formula and p tending to infinity to explain the limit; for finite p, being less than 10 holds under the given formula.

- Retain the preceding conditions: 2/2.
- Correct the premise: speedup is below 10 for finite p and approaches 10 in the limit: 2/2.

#### Turn 4

Give the supporting page and state the serial fraction in this example.

**4/4 (100.00%)**. Explicitly gives page 66 and the serial fraction .10.

- Cite page 66: 2/2.
- The serial fraction is 1-f=.1: 2/2.

### L2-MT01 (strict success: no)

[Full English answer and citations](L2-MT01.json)

#### Turn 1

Explain temporal locality and spatial locality.

**4/4 (100.00%)**. Correctly explains reuse of the same data and access to nearby locations; the D and array examples correspond to page 24.

- Temporal locality means reusing the same data: 2/2.
- Spatial locality means accessing nearby locations: 2/2.

#### Turn 2

Does repeatedly reading the same variable illustrate the former or the latter?

**4/4 (100.00%)**. Correctly identifies the former as temporal locality and explains that repeatedly reading the same variable.

- Resolve the former as temporal locality: 2/2.
- Repeatedly reading the same variable illustrates temporal locality: 2/2.

#### Turn 3

Switching to a calculation: the hit time is 1 cycle, the miss rate is 10%, and the additional miss penalty is 300 cycles. What is the AMAT?

**4/4 (100.00%)**. Switches to AMAT and gives the correct main result of 31 cycles, with full required points. However, the additional Note incorrectly writes 1+.1×301=31.1 when the additional penalty=300, double-counting the hit time in the miss case, which constitutes a substantive error; the only citation, page 22, discusses only locality and cannot support the AMAT formula.

- Recognize the switch to AMAT: 2/2.
- 1+.1*300=31 cycles: 2/2.

#### Turn 4

Change only the previous miss rate to 5%, keeping everything else unchanged. What is the result? Cite the formula page.

**6/6 (100.00%)**. Correctly keeps hit=1, penalty=300, changes only the miss rate to .05, obtains 16 cycles; page 27 supports the formula and the original example.

- Retain hit time=1 and penalty=300: 2/2.
- 1+.05*300=16 cycles: 2/2.
- Cite page 26 or 27: 2/2.

### L2-MT02 (strict success: yes)

[Full English answer and citations](L2-MT02.json)

#### Turn 1

Is CUDA local memory private to a thread or shared by all threads? Where does it usually reside?

**4/4 (100.00%)**. Explains that it is thread-private, usually in device DRAM, passing through L1/L2, citing page 46.

- Thread-private: 2/2.
- Usually resides in device DRAM and passes through L1/L2: 2/2.

#### Turn 2

So because its name includes local, must it be as fast as registers?

**4/4 (100.00%)**. Follows on from local memory, rejects the idea that the name guarantees register speed, citing pages 43 and 46.

- Resolve it as local memory: 2/2.
- The name does not establish its physical location or guarantee register-level speed: 2/2.

#### Turn 3

A different question: in shared memory, how do accesses to different addresses in the same bank differ from reads of the same address?

**4/4 (100.00%)**. Correctly switches to shared memory and distinguishes broadcast reads of the same address from multiple service rounds for different addresses in the same bank, supported by page 51; page 47 provides additional background on global transactions.

- Correctly switch to shared memory: 2/2.
- Different addresses require multiple service rounds; reads of the same address can use broadcast: 2/2.

#### Turn 4

Is that the same thing as global-memory coalescing? Cite the source.

**6/6 (100.00%)**. Correctly compares the two mechanisms, citing page 51 on bank service and page 47 on the coalescer grouping by sector/transaction; page 47 is valid alternative evidence and is not penalized because the reference says page 48.

- Resolve that as shared-memory bank conflicts/broadcast: 2/2.
- Distinguish bank service from combining warp addresses into memory transactions: 2/2.
- Cite pages 48 and 51: 2/2.

### L2-MT03 (strict success: yes)

[Full English answer and citations](L2-MT03.json)

#### Turn 1

Does the LPDDR expansion in Grace make the GPU HBM itself larger?

**4/4 (100.00%)**. Rejects the idea that HBM itself becomes larger, explains that it expands addressable capacity, citing page 68, and adds tiered management on page 69.

- Does not enlarge HBM itself: 2/2.
- Expands addressable capacity: 2/2.

#### Turn 2

Which tier should hot data and cold data go into, respectively?

**4/4 (100.00%)**. Follows on from the two tiers: hot/latency-critical/frequently reused data stays in HBM, large cold objects go to LPDDR, citing page 69.

- Continue the HBM versus LPDDR context: 2/2.
- Hot, latency-critical or frequently reused data goes in HBM; large cold data can go in LPDDR: 2/2.

#### Turn 3

If a piece of cold data is accessed only once, is it worth moving it immediately to the former?

**4/4 (100.00%)**. The former correctly refers to HBM; analyzed according to the lecture's criterion of future reuse benefit, a single access cannot recover the transfer/management cost.

- Resolve the former as HBM: 2/2.
- It is not necessarily worthwhile; compare future reuse savings with transfer and bookkeeping costs: 2/2.

#### Turn 4

Give the specific page supporting the migration decision you just made.

**4/4 (100.00%)**. Explicitly answers that the migration decision is supported by page 69; although the answer is short, it correctly follows on from the previous turn, and the cited passage contains the required criterion.

- Refer to the migration cost-benefit decision: 2/2.
- Cite page 69, not only the LPDDR introduction on page 68: 2/2.

## Re-run and re-check

Run from the repository root, replacing the job number and backend address; the output directory must not exist. The two lecture sets need to be imported into the same backend in advance.

```bash
.venv/bin/python -m evaluation.runners.tutor_multi evaluation/results/tutor-multi-new-run --base-url http://127.0.0.1:18031 --job NEW_JOB_ID
```

The script reads evaluation/02_ai_tutor/multi_turn/lecture1.json and lecture2.json (currently already in English). The above command regenerates answers and does not automatically reproduce this semantic scoring; reviewers need to check the original answers against the per-point scores and reasons in [scores.json](scores.json). Both the original-file SHA256 and the reference-set SHA256 are saved, making it easy to check which version the scores correspond to.

## Switching to TACC / DeepSeek to run the evaluation

The following is how the current code runs; model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script calling TACC directly does not need a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project's `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

The AI tutor runner accesses the backend over HTTP and has no `--provider` parameter. After loading the configuration in the **backend terminal**, start a separate TACC backend (the port must be free):

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
export STUDYGRAPH_TUTOR_PROVIDER=tacc
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18031
```

Confirm that both lecture sets have been imported into that backend, then in another terminal choose single-turn or multi-turn execution; replace `CURRENT_JOB_ID` with the actual job number:

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en evaluation/results/tutor-single-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
.venv/bin/python -m evaluation.runners.tutor_multi evaluation/results/tutor-multi-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
```

When switching to DeepSeek, configure the key in the backend startup environment, set `STUDYGRAPH_TUTOR_PROVIDER=deepseek`, and restart; do not treat the TACC job number as DeepSeek model information. Changing variables only in the evaluation script terminal will not change an already-running backend. The above commands only generate answers; semantic scoring still requires separate review; the fixed exercises are already included in the single-turn run and are not counted twice. Historical compression may still call DeepSeek when the conditions are met and a DeepSeek key is present; if only TACC is to be used, that key should be removed from the backend process so that the optional compression does not execute.
