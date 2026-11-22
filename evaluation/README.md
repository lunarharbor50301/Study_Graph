# StudyGraph evaluation reproduction guide

This guide covers the five evaluation modules and includes the main result tables alongside the reproduction instructions. To verify reported numbers, start with the saved outputs and reviews. To measure the current system, rerun the commands with a fresh output directory and review the new responses against the same reference data.

## Main evaluation results

### Concept maps and in-map notes

| Metric | Lecture 1 | Lecture 2 |
|---|---:|---:|
| Generated nodes | 24 | 29 |
| Core concepts covered | 17/17 | 19/19 |
| Generated node precision | 24/24 | 29/29 |
| Mean note score | 96.08% | 96.49% |
| Cumulative note points | 91/94 | 110/114 |
| Physical pages covered | 67/67 | 69/69 |
| Successful request time, including upload | 21.12 s | 30.78 s |
| Generation attempts | 2 | 1 |

### AI tutor and fixed exercises

| Evaluation | Metric | Result |
|---|---|---:|
| Single-turn | Completed responses | 30/30 |
| Single-turn | Mean content score across lectures | 98.96% |
| Single-turn | Median / P95 latency | 14.89 s / 24.25 s |
| Fixed exercises | Answerable cases with structured citations | 26/26 |
| Multi-turn | Completed turns | 24/24 |
| Multi-turn | Mean turn score | 99.31% |
| Multi-turn | Applicable context checks passed | 18/18 |
| Multi-turn | Strict dialogue successes | 4/6 |

### English question generation

| Lecture | Delivered | Mean /10 | Coverage /3 | Correctness /3 | Citation support /2 | Answerability /2 |
|---|---:|---:|---:|---:|---:|---:|
| L1 | 10/10 | 9.80 | 2.80 | 3.00 | 2.00 | 2.00 |
| L2 | 10/10 | 9.90 | 2.90 | 3.00 | 2.00 | 2.00 |
| Overall | 20/20 | 9.85 | 2.85 | 3.00 | 2.00 | 2.00 |

### Student answer grading and feedback

| Metric | L1 | L2 | Overall |
|---|---:|---:|---:|
| Valid grading responses | 40/40 | 35/35 | 75/75 |
| Exact total-score matches | 40/40 | 34/35 | 74/75 |
| Mean absolute error, points | 0 | 0.0286 | 0.0133 |
| Explicit error precision | 24/24 | 21/21 | 45/45 |
| Explicit error recall | 24/24 | 21/21 | 45/45 |
| Omission precision | 24/26 | 21/21 | 45/47 |
| Omission recall | 24/24 | 21/21 | 45/45 |
| Feedback text flagged an omission on an answer marked fully correct by the reference | 0/8 | 1/7 | 1/15 |

The web baseline rejected 8 of 15 reference-marked fully correct answers. Its 4/0 proxy mean absolute error was 1.227 points.

## Setup and shared data

Run these Bash or Zsh commands from the repository root. Install Python and Node.js using the versions supported by the [project setup guide](../README.md).

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-lock.txt
npm ci --prefix agent --ignore-scripts

export EVAL_PY=.venv/bin/python
export EVAL_RUN="evaluation/results/rerun-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVAL_RUN"

"$EVAL_PY" evaluation/runners/validate_dataset.py
shasum -a 256 evaluation/ACS_Lecture_1_2026F.pdf evaluation/ACS_lecture_2_2026F.pdf
```

Compare the hashes with the [document manifest](sources/documents.json). ACS-L1 has 67 physical PDF pages and ACS-L2 has 69. Page numbers are one-based and include the cover. The [source directory](sources/) contains the extracted page text used by the evaluation scripts. The [shared scoring specification](shared/scoring.md) defines denominators and how to handle failures or unmeasured metrics.

### Live model configuration

The reported configuration uses DeepSeek Flash for concept maps, question generation, question quality judging, and experimental answer grading. AI tutor uses TACC Qwen (`qwen3.8-27b`). For fresh runs, configure `DEEPSEEK_API_KEY` in your local project `.env`. Start your own TACC job with tool calling enabled and forward its model API to local port 18024. Use the node and port printed by your actual job. See the [TACC and SSH setup guide](../docs/pi-agent.md).

In the backend terminal, load the environment and start the service:

```bash
set -a
source .env
set +a
export DEEPSEEK_MODEL=deepseek-flash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_TUTOR_PROVIDER=tacc
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 "$QWEN_BASE_URL/models"
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18031
```

In the evaluation terminal, set `EVAL_PY` and `EVAL_RUN` as above, load `.env` and export `DEEPSEEK_MODEL=deepseek-flash` for direct model calls. Set `TACC_JOB_ID` to your running Slurm job number. Import both PDFs into the same backend document library that the local quiz runner uses:

```bash
export EVAL_BASE=http://127.0.0.1:18031
for pdf in evaluation/ACS_Lecture_1_2026F.pdf evaluation/ACS_lecture_2_2026F.pdf
do
  curl -fsS -F "file=@$pdf" "$EVAL_BASE/api/documents"
done
curl -fsS "$EVAL_BASE/api/documents"
```

Verify the returned document IDs against the manifest hashes. For a model comparison, use a separate run directory and record the Git commit, provider and model for each role, TACC job and runtime configuration, concurrency, cache state, and retry policy.

## 1. Concept maps and in-map notes

**Cases.** Generate a default whole-lecture map for each PDF using the [v0.5-en references](01_knowledge/v0.5-en/). L1 has 17 reference concepts and 47 note points. L2 has 19 concepts and 57 note points.

**Verify the reported scores.** Recompute the results from the frozen predictions and saved semantic reviews. This works without model access.

```bash
for i in 1 2
do
  saved="evaluation/results/v0.5-en-20261119/l$i"
  "$EVAL_PY" -m evaluation.runners.knowledge score \
    --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
    --prediction "$saved/prediction.json" --review "$saved/review.json" \
    --output "$EVAL_RUN/map-l$i-recomputed.json"
done
```

**Generate and score fresh predictions.** Use a backend with an empty concept-map cache when measuring generation time.

```bash
i=1
pdf=evaluation/ACS_Lecture_1_2026F.pdf
# For Lecture 2, set i=2 and pdf=evaluation/ACS_lecture_2_2026F.pdf.
"$EVAL_PY" -m evaluation.runners.knowledge generate \
  --base-url "$EVAL_BASE" --pdf "$pdf" --dataset-id "ACS-L$i" \
  --document-manifest evaluation/sources/documents.json \
  --output "$EVAL_RUN/map-l$i/prediction.json"

"$EVAL_PY" -m evaluation.runners.knowledge score \
  --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
  --prediction "$EVAL_RUN/map-l$i/prediction.json" --judge deepseek \
  --output "$EVAL_RUN/map-l$i/metrics.json"
```

**Run with TACC.** Start the backend with `STUDYGRAPH_GENERATION_PROVIDER=tacc` to generate the map through TACC. To score with TACC, set `QWEN_BASE_URL` in the evaluation terminal and replace `--judge deepseek` with `--judge tacc`. These choices are independent. The saved-review command uses `--review` and runs locally.

```bash
# Backend terminal, before starting Uvicorn
export STUDYGRAPH_GENERATION_PROVIDER=tacc

# Evaluation terminal, after generating the prediction
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
"$EVAL_PY" -m evaluation.runners.knowledge score \
  --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
  --prediction "$EVAL_RUN/map-l$i/prediction.json" --judge tacc \
  --output "$EVAL_RUN/map-l$i/metrics-tacc.json"
```

**Report mapping.** The current-results table reports 17/17 and 19/19 core concept coverage, 96.08% and 96.49% mean note scores, and 67/67 and 69/69 physical pages covered. The saved page checks and L1 failure record are in the corresponding lecture folders under `evaluation/results/v0.5-en-20261119/`. To verify the page checks, inspect each final node's evidence pages in the saved guide, check that each list forms a contiguous interval, and compare their union with pages 1 through the PDF page count. Record missing and multiply assigned pages separately. L1 succeeded on its second attempt, so the reported successful-request time excludes the first attempt. The semantic metrics cover notes returned with the map. The separate on-demand note endpoint and semantic relations are outside the current evaluation.

## 2. AI tutor

### English single-turn

**Cases.** The [English case lists](02_ai_tutor/single_turn/en/) select 30 questions from the [shared question bank](shared/question_bank.json). L1 has 14 cases and L2 has 16. Of the 30, 26 are answerable and 4 test insufficient evidence. The runner uses a fresh session per case and runs with concurrency 3. The published run used TACC job 29876.

```bash
# Recompute the published metrics using the saved responses and review.
"$EVAL_PY" -m evaluation.runners.tutor_single summarize en \
  evaluation/results/tutor-single-en-29876-citations

# Collect fresh responses.
"$EVAL_PY" -m evaluation.runners.tutor_single run en "$EVAL_RUN/tutor-single" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"

# After completing review.json in the new directory:
"$EVAL_PY" -m evaluation.runners.tutor_single summarize en "$EVAL_RUN/tutor-single"
```

**Run with TACC.** The single-turn command above uses TACC when the backend starts with `STUDYGRAPH_TUTOR_PROVIDER=tacc`. To use DeepSeek, restart the backend with `STUDYGRAPH_TUTOR_PROVIDER=deepseek` and omit `--job`. The `summarize` command reads saved responses and scores locally.

```bash
# Backend terminal, before starting Uvicorn
export STUDYGRAPH_TUTOR_PROVIDER=tacc

# Evaluation terminal
"$EVAL_PY" -m evaluation.runners.tutor_single run en "$EVAL_RUN/tutor-single-tacc" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

Fill each pending rating in the new `review.json` with 0, 1, or 2 using the reference rubric and final response. Record the reason for deductions. The summary computes the two-lecture macro score, completion, structured citation counts, and latency. The published table reports 30/30 completed, 98.96% content score, and 26/26 answerable cases with structured citations. Citation presence and reference-page hits are distinct from checking whether each cited passage supports each claim.

### English multi-turn

**Cases.** [Six dialogues](02_ai_tutor/multi_turn/) cover pipelines, parallelism and SMT, Amdahl's law, locality and AMAT, CUDA memory, and HBM/LPDDR. Each has four turns. The runner reuses one session within each dialogue and runs serially. It can retry pre-stream HTTP 503 twice. The published run used TACC job 30603 and recorded zero HTTP retries.

```bash
"$EVAL_PY" -m evaluation.runners.tutor_multi "$EVAL_RUN/tutor-multi" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

**Run with TACC.** The multi-turn command above uses TACC through the same backend setting, `STUDYGRAPH_TUTOR_PROVIDER=tacc`. For DeepSeek, restart the backend with `STUDYGRAPH_TUTOR_PROVIDER=deepseek` and pass `--job n/a` because this runner requires the provenance argument. Review the returned answers against the same rubric for either provider.

```bash
# Backend terminal, before starting Uvicorn
export STUDYGRAPH_TUTOR_PROVIDER=tacc

# Evaluation terminal
"$EVAL_PY" -m evaluation.runners.tutor_multi "$EVAL_RUN/tutor-multi-tacc" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

Review each turn against its required points on the 0–2 scale. Record context retention, substantive errors and required citation support separately. Average normalized turn scores and report strict dialogue success only when all four turns meet the criteria in the report. The runner collects responses. New semantic review and aggregation are separate steps. The frozen review documents 24/24 completed turns, 99.31% mean turn score, 18/18 applicable context checks and 4/6 strict dialogue successes. Context checks were annotated after execution. Browser citation navigation was unmeasured. [Frozen turn scores](results/tutor-multi/scores.json)

## 3. English question generation

**Cases.** [Twenty tasks](03_question_generation/english-20/) request one question each, 10 per lecture. The requested mix is 10 short-answer, 6 multiple-choice and 4 true/false questions. Each task defines its scope, difficulty and allowed pages. The runner uses the locally imported lecture library.

```bash
# Regenerate questions and score them with the published provider configuration.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek --judge-provider deepseek \
  --output-dir "$EVAL_RUN/quiz"

# Evaluate the originally published questions with a fresh judge call.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek \
  --predictions evaluation/results/quiz-english-20261121 \
  --output-dir "$EVAL_RUN/quiz-rescore"
```

**Run with TACC.** In the generation command above, use `--provider tacc --judge-provider tacc` for both stages. Use `--provider tacc --judge-provider deepseek` to keep a DeepSeek judge. For the frozen-prediction command, replace `--provider deepseek` with `--provider tacc` to change the judge for the same questions. Use a fresh output directory for each configuration.

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
"$EVAL_PY" -m evaluation.runners.quiz --provider tacc --judge-provider tacc \
  --output-dir "$EVAL_RUN/quiz-tacc"

"$EVAL_PY" -m evaluation.runners.quiz --provider tacc \
  --predictions evaluation/results/quiz-english-20261121 \
  --output-dir "$EVAL_RUN/quiz-rescore-tacc"
```

The judge scores coverage /3, correctness /3, citation support /2 and answerability /2. Undelivered questions receive zero. Use the frozen score file to verify the published 20/20 delivery and 9.85/10 mean without rejudging. The generator and judge used the same provider. The report records a citation overcredit on L2-EN04, so identical provider settings do not establish independent judgment. [Frozen scores](results/quiz-english-20261121/scores.json)

## 4. Student answer grading and feedback

**Cases.** The [English grading set](04_answer_grading/english-75/) pairs 15 short-answer questions with five response variants each, for 75 cases. Each response is graded against two criteria worth up to 2 points each. The runner compares predictions against candidate labels and executes the web normalization baseline with Node.js.

```bash
# The recorded run used a five-worker grading pool.
"$EVAL_PY" -m evaluation.runners.grading_feedback --provider deepseek --workers 5 \
  --output-dir "$EVAL_RUN/grading"
```

**Run with TACC.** Replace `--provider deepseek --workers 5` with `--provider tacc --workers 1` for a serial TACC run. Keep the worker count equal across providers when comparing elapsed time. The web normalization baseline and metric calculations run locally for either provider.

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
"$EVAL_PY" -m evaluation.runners.grading_feedback --provider tacc --workers 1 \
  --output-dir "$EVAL_RUN/grading-tacc"
```

Compare `summary.json`, `web-baseline.json` and individual response records with the published outputs. The report shows 74/75 exact total-score matches and 0.0133-point MAE, along with separate error and omission precision/recall. The omission reported in prose on L2-SA11 requires reading feedback text in addition to checking the structured fields. The web comparison uses one canonical answer and an empty alias list. The synthetic response variants and candidate labels limit generalization to real student responses. [Frozen summary](results/grading-feedback-en-20261121/summary.json)

## 5. Fixed exercises

The [26 fixed exercises](05_question_answering/) are the supported subset of the English AI tutor single-turn run. Use the commands in section 2 and identify `answerability: supported` in the shared question bank. Filter the saved per-question outputs and review to those IDs for a standalone exercise analysis. Exclude the four insufficient-evidence cases and avoid adding these 26 cases a second time when reporting combined sample counts. The published single-turn content score covers 30 cases, while its 26/26 citation figure uses the supported subset.

**Run with TACC.** Use the TACC single-turn configuration in section 2, then select the same 26 supported cases from its outputs. The subset selection runs locally.

```bash
# Run once against the TACC tutor backend and reuse the supported subset.
"$EVAL_PY" -m evaluation.runners.tutor_single run en "$EVAL_RUN/tutor-single-tacc" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

## Switching providers and interpreting reruns

Use `--provider tacc` for quiz generation and answer grading, `--judge-provider tacc` for quiz judging, and `--judge tacc` for concept-map judging. Set `QWEN_BASE_URL` in the runner terminal for direct TACC calls. For HTTP evaluations, set `STUDYGRAPH_GENERATION_PROVIDER` or `STUDYGRAPH_TUTOR_PROVIDER` in the backend environment and restart the backend. Both accept `tacc` or `deepseek`. Optional AI tutor history compression can use DeepSeek when its key is set and compression is triggered. Unset the key in an isolated backend process for a TACC-only tutor experiment. [Provider commands and configuration](runners/README.md)

Fresh runs can vary in wording, retrieved pages, citations, scores and latency even with fixed inputs. For timing comparisons, report cache state, warm-up and hardware separately from content scores. Keep failed requests in the records and label diagnostic retries separately. The two lecture PDFs and candidate rubrics cover a limited set of course topics. The reference labels are pending human review and the development/test split has not been frozen.
