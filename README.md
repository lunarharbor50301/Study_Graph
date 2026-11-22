**English** · [简体中文](README.zh-CN.md)

# StudyGraph

StudyGraph helps undergraduate and graduate students organize course materials, review key concepts, and practice for exams. It has two workspaces:

- **Learning** turns an uploaded PDF or PPTX into an interactive concept map. Students can explore topics and open study notes for individual concepts.
- **Test** generates practice questions from one or more uploaded lecture files. Students can choose question types and difficulty, request hints, submit answers, and review feedback.

In both workspaces, students can click page citations to open the corresponding page or slide in the original PDF or PPTX preview. They can also ask the **AI Tutor** questions as they study or practice.

## Getting Started Instructions

### Install and start

Run the commands from the repository root. Use Python 3.12 and Node.js 24. Dependency installation requires internet access. The local smoke check uses SQLite and the bundled Lecture 1 PDF and can run without model credentials. Model-backed generation needs a DeepSeek API key or a configured TACC Qwen endpoint. The reported Tutor runs use Qwen on TACC.

**macOS/Linux (Bash)**

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm ci --prefix agent --ignore-scripts
npm run build --prefix frontend
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**Windows (PowerShell)**

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
npm ci --prefix agent --ignore-scripts
npm run build --prefix frontend
.\.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open the app at `http://127.0.0.1:8000/` or the API reference at `http://127.0.0.1:8000/docs`. FastAPI serves the built React application, so this setup uses a single local server. The backend writes uploaded documents, search indexes and Agent history to SQLite. The browser keeps its course shelf, saved tests and practice progress in local storage.

### Run a small end-to-end check

Keep the server running. In a second terminal, upload the bundled lecture and open its page 67 preview. The examples below use `curl` in Bash. In Windows PowerShell use `curl.exe` and put each command on one line.

```bash
curl -fsS -F "file=@evaluation/ACS_Lecture_1_2026F.pdf" http://127.0.0.1:8000/api/documents
```

Expect HTTP 201 and JSON containing `"page_count":67` and document ID `34911c46e78edc833f283f8dd678b85d6f8c92d66859e6bf6886949181d95402`. At the same host, open `/api/documents/{document_id}/pages/67/preview` with the ID returned by the upload. Expect the Roofline Model slide. In the web app, User A can also open **AI Computing Foundations** in the course shelf, select question 5 and use **Page 67** to open the source. Enter `200 GFLOP/s memory-bound` and submit to see the built-in grading and feedback.

To check the same local stack from the command line, run `python -m unittest backend.test_smoke backend.test_documents` using the virtual environment's Python. Expect `OK`.

### Enable model-backed workflows

Create a local `.env` from the example (`.env.example`). Set your own `DEEPSEEK_API_KEY` for default generation. For Tutor, set `STUDYGRAPH_TUTOR_PROVIDER=tacc` and point `QWEN_BASE_URL` to the reachable OpenAI-compatible endpoint with the `/v1` suffix. The Agent needs a service with native tool calling. From `deploy/tacc-agent/`, run `tcloud submit` and read the job log. Once the service starts, forward local port 18024 to the node and port printed in the job's service URL using the persistent SSH command in `docs/pi-agent.md`. Check that `/v1/models` returns `qwen3.8-27b` before testing the Tutor. TACC access requires a course account with GPU permissions. The supplied job requests two GPUs and a one-hour allocation. Review any node exclusions in its job configuration for your allocation.

Load `.env` in the server terminal and restart Uvicorn. In Bash, run `set -a`, `source .env`, then `set +a`. In PowerShell, use the following before running the start command above.

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
}
```

On Windows, `.\scripts\studygraph.cmd -NoTaccWait` is an alternative launcher after setup and build. With default options it waits for an already submitted TACC service. To enable full-layout PPTX previews, install LibreOffice on the backend host and set `SOFFICE_PATH` if `soffice` is outside PATH. PDF previews and the simplified PPTX preview work with the base setup.

### Try a complete workflow in the browser

This example uses the bundled Lecture 1 PDF and DeepSeek for generation. Configure DeepSeek as described above, start the server, and open `http://127.0.0.1:8000/`.

1. Open **Learning**, choose `evaluation/ACS_Lecture_1_2026F.pdf`, and click **Generate concept map**.
2. Open a topic and select one of its concepts. Click a page citation in the study note to check it against the original slide in **Lecture Viewer**.

StudyGraph extracts the PDF text with its page numbers and uses DeepSeek to organize it into topics and page-linked notes.

**Expected result.** A new concept map appears under **My Course**. Selecting a concept opens its study note, and clicking a citation opens the corresponding PDF page.

You can also try **Test** with the same PDF. Set **Multiple choice** to 1 and the other question types to 0, click **Generate test**, then choose an option and click **Submit answer**. Expect one question with a page citation, feedback on your answer, and a saved test in **My Course**.

If TACC Qwen is running, ask the **AI Tutor** in your new Learning workspace, *What does the Roofline model explain?* For lecture-specific questions, the Tutor can use `search_lecture` to find relevant passages and `read_page` to check the full page before answering. Expect a streamed explanation with a source citation you can open in **Lecture Viewer**.

The implementation is documented in `docs/test-flow.md` and `docs/document-api.md`.

## Detailed Instructions

### Setup and shared data

Run the following Bash or Zsh commands from the repository root after installing the dependencies above.
Enable Python UTF-8 mode before running the evaluation scripts. In PowerShell, the equivalent setting is `$env:PYTHONUTF8 = '1'`.

```bash
export PYTHONUTF8=1
export EVAL_PY=.venv/bin/python
export EVAL_RUN="evaluation/results/rerun-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVAL_RUN"

"$EVAL_PY" evaluation/runners/validate_dataset.py
shasum -a 256 evaluation/ACS_Lecture_1_2026F.pdf \
  evaluation/ACS_lecture_2_2026F.pdf
```

Both original PDFs are bundled. If your system lacks `shasum`, use `sha256sum` with the same paths. Compare the hashes with `evaluation/sources/documents.json`. ACS-L1 has 67 physical PDF pages and ACS-L2 has 69. Page numbers are one-based and include the cover. The source directory (`evaluation/sources`) contains the extracted page text used by the evaluation scripts. The shared scoring specification (`evaluation/shared/scoring.md`) defines denominators and how to handle failures or unmeasured metrics.

#### Live model configuration

The reported configuration uses DeepSeek Flash for concept maps, question generation, question quality judging, and experimental answer grading. AI tutor uses TACC Qwen (`qwen3.8-27b`). For fresh runs, configure `DEEPSEEK_API_KEY` in your local project `.env`. Start your own TACC job with tool calling enabled and forward its model API to local port 18024. Use the node and port printed by your actual job. See the TACC and SSH setup guide (`docs/pi-agent.md`).

In the backend terminal, load the environment and start the service:

```bash
set -a
source .env
set +a
export DEEPSEEK_MODEL=deepseek-flash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_CONCEPT_MAP_MODE=staged
export STUDYGRAPH_CONCEPT_MAP_CACHE=0
export STUDYGRAPH_TUTOR_PROVIDER=tacc
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 "$QWEN_BASE_URL/models"
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In the evaluation terminal, set `EVAL_PY` and `EVAL_RUN` as above, load `.env` and export `DEEPSEEK_MODEL=deepseek-flash` for direct model calls. Set `TACC_JOB_ID` to your running Slurm job number. Import both PDFs into the same backend document library that the local quiz runner uses. If you override `STUDYGRAPH_DATABASE`, use the same path in both terminals.

```bash
export EVAL_BASE=http://127.0.0.1:8000
export TACC_JOB_ID=YOUR_JOB_ID
for pdf in evaluation/ACS_Lecture_1_2026F.pdf evaluation/ACS_lecture_2_2026F.pdf
do
  curl -fsS -F "file=@$pdf" "$EVAL_BASE/api/documents"
done
curl -fsS "$EVAL_BASE/api/documents"
```

Verify the returned document IDs against the manifest hashes. For a model comparison, use a separate run directory and record the Git commit, provider and model for each role, TACC job and runtime configuration, concurrency, cache state, and retry policy.

### Main evaluation results

The following tables use the same metric names as `evaluation/README.md`. Each reproduction step below identifies the corresponding output files.

#### Concept maps and in-map notes

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

#### AI tutor and fixed exercises

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

#### English question generation

| Lecture | Delivered | Mean /10 | Coverage /3 | Correctness /3 | Citation support /2 | Answerability /2 |
|---|---:|---:|---:|---:|---:|---:|
| L1 | 10/10 | 9.80 | 2.80 | 3.00 | 2.00 | 2.00 |
| L2 | 10/10 | 9.90 | 2.90 | 3.00 | 2.00 | 2.00 |
| Overall | 20/20 | 9.85 | 2.85 | 3.00 | 2.00 | 2.00 |

#### Student answer grading and feedback

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

### 1. Concept maps and in-map notes

**Cases.** Generate a default whole-lecture map for each PDF using the v0.5-en references (`evaluation/01_knowledge/v0.5-en`). L1 has 17 reference concepts and 47 note points. L2 has 19 concepts and 57 note points.

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

**Report mapping.** The **Concept maps and in-map notes** table reports 17/17 and 19/19 core concept coverage, 96.08% and 96.49% mean note scores, and 67/67 and 69/69 physical pages covered. The saved page checks and L1 failure record are in the corresponding lecture folders under `evaluation/results/v0.5-en-20261119/`. To verify the page checks, inspect each final node's evidence pages in the saved guide, check that each list forms a contiguous interval, and compare their union with pages 1 through the PDF page count. Record missing and multiply assigned pages separately. L1 succeeded on its second attempt, so the reported successful-request time excludes the first attempt. The semantic metrics cover notes returned with the map. The separate on-demand note endpoint and semantic relations are outside the current evaluation.

### 2. AI tutor

#### English single-turn

**Cases.** The English case lists (`evaluation/02_ai_tutor/single_turn/en`) select 30 questions from the shared question bank (`evaluation/shared/question_bank.json`). L1 has 14 cases and L2 has 16. Of the 30, 26 are answerable and 4 test insufficient evidence. The runner uses a fresh session per case and runs with concurrency 3. The published run used TACC job 29876.

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

Fill each pending rating in the new `review.json` with 0, 1, or 2 using the reference rubric and final response. Record the reason for deductions. The summary computes the two-lecture macro score, completion, structured citation counts, and latency. The **AI tutor and fixed exercises** table reports 30/30 completed, 98.96% content score, and 26/26 answerable cases with structured citations. Citation presence and reference-page hits are distinct from checking whether each cited passage supports each claim.

#### English multi-turn

**Cases.** Six dialogues (`evaluation/02_ai_tutor/multi_turn`) cover pipelines, parallelism and SMT, Amdahl's law, locality and AMAT, CUDA memory, and HBM/LPDDR. Each has four turns. The runner reuses one session within each dialogue and runs serially. It can retry pre-stream HTTP 503 twice. The published run used TACC job 30603 and recorded zero HTTP retries.

```bash
"$EVAL_PY" -m evaluation.runners.tutor_multi "$EVAL_RUN/tutor-multi" \
  --base-url "$EVAL_BASE" --job "$TACC_JOB_ID"
```

Review each turn against its required points on the 0–2 scale. Record context retention, substantive errors and required citation support separately. Average normalized turn scores and report strict dialogue success only when all four turns meet the criteria in the report. The runner collects responses. New semantic review and aggregation are separate steps. The multi-turn rows in that table summarize 24/24 completed turns, 99.31% mean turn score, 18/18 applicable context checks and 4/6 strict dialogue successes. Context checks were annotated after execution. Browser citation navigation was unmeasured. See the frozen turn scores in `evaluation/results/tutor-multi/scores.json`.

### 3. English question generation

**Cases.** Twenty tasks (`evaluation/03_question_generation/english-20`) request one question each, 10 per lecture. The requested mix is 10 short-answer, 6 multiple-choice and 4 true/false questions. Each task defines its scope, difficulty and allowed pages. The runner uses the locally imported lecture library.

```bash
# Regenerate questions and score them with the published provider configuration.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek --judge-provider deepseek \
  --output-dir "$EVAL_RUN/quiz"

# Evaluate the originally published questions with a fresh judge call.
"$EVAL_PY" -m evaluation.runners.quiz --provider deepseek \
  --predictions evaluation/results/quiz-english-20261121 \
  --output-dir "$EVAL_RUN/quiz-rescore"
```

The judge scores coverage /3, correctness /3, citation support /2 and answerability /2. Undelivered questions receive zero. Use the archived score file to verify the **English question generation** table's 20/20 delivery and 9.85/10 mean without rejudging. The generator and judge used the same provider. The report records a citation overcredit on L2-EN04, so identical provider settings do not establish independent judgment. The archived scores are in `evaluation/results/quiz-english-20261121/scores.json`.

### 4. Student answer grading and feedback

**Cases.** The English grading set (`evaluation/04_answer_grading/english-75`) pairs 15 short-answer questions with five response variants each, for 75 cases. Each response is graded against two criteria worth up to 2 points each. The runner compares predictions against candidate labels and executes the web normalization baseline with Node.js.

```bash
# The recorded run used a five-worker grading pool.
"$EVAL_PY" -m evaluation.runners.grading_feedback --provider deepseek --workers 5 \
  --output-dir "$EVAL_RUN/grading"
```

Compare `summary.json`, `web-baseline.json` and individual response records with the published outputs. The **Student answer grading and feedback** table shows 74/75 exact total-score matches and 0.0133-point MAE, along with separate error and omission precision/recall. The omission reported in prose on L2-SA11 requires reading feedback text in addition to checking the structured fields. The web comparison uses one canonical answer and an empty alias list. The synthetic response variants and candidate labels limit generalization to real student responses. The archived summary is in `evaluation/results/grading-feedback-en-20261121/summary.json`.

### 5. Fixed exercises

The 26 fixed exercises (`evaluation/05_question_answering`) are the supported subset of the English AI tutor single-turn run. Use the commands in section 2 and identify `answerability: supported` in the shared question bank. Filter the saved per-question outputs and review to those IDs for a standalone exercise analysis. Exclude the four insufficient-evidence cases and avoid adding these 26 cases a second time when reporting combined sample counts. The published single-turn content score covers 30 cases, while its 26/26 citation figure uses the supported subset.

### Switching providers and interpreting reruns

Use `--provider tacc` for quiz generation and answer grading, `--judge-provider tacc` for quiz judging, and `--judge tacc` for concept-map judging. Set `QWEN_BASE_URL` in the runner terminal for direct TACC calls. For HTTP evaluations, set `STUDYGRAPH_GENERATION_PROVIDER` or `STUDYGRAPH_TUTOR_PROVIDER` in the backend environment and restart the backend. Both accept `tacc` or `deepseek`. Optional AI tutor history compression can use DeepSeek when its key is set and compression is triggered. Unset the key in an isolated backend process for a TACC-only tutor experiment. Additional provider commands are in `evaluation/runners/README.md`.

Fresh runs can vary in wording, retrieved pages, citations, scores and latency even with fixed inputs. For timing comparisons, report cache state, warm-up and hardware separately from content scores. Keep failed requests in the records and label diagnostic retries separately. The two lecture PDFs and candidate rubrics cover a limited set of course topics. The reference labels are pending human review and the development/test split has not been frozen.
