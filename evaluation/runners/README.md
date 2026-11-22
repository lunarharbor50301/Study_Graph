# Evaluation Scripts

english_qa.py and retrieval.py are legacy scripts that are only compatible with the data format in archive/legacy; they cannot directly read the new nested JSON, nor can they evaluate multi-turn conversations or semantic correctness.

knowledge.py supports backend concept map export and semantic scoring; see the full commands below. Other new sections still require manual execution and review; validate_dataset.py is used to check structure and references and does not call models.

Shared scoring rules are in evaluation/shared/scoring.md.

## Concept Maps and Study Notes: Reproducible Commands

Run location: repository root. Python uses the project `.venv`, with dependencies the same as the backend and no new third-party packages.

### Paths under test and boundaries

`generate` calls the newly added `POST /api/documents/{doc}/knowledge`, which internally directly reuses the `study-guide` generation function called after web upload, and does not send reference concepts or reference Facts to the generator. The output has the same top-level structure as `01_knowledge/lecture1.json` and `lecture2.json`: `document_id / concepts / relations / study_notes`; the additional `generation` and `run` fields record the configuration and source.

- This command tests the **backend concept map/study guide**, not the Tutor's pi Agent. The web page and command line share the same generation path; when the web page has no preferences filled in or the command omits `--instructions`, both use `DEFAULT_INSTRUCTIONS` in `backend/study_guide.py`. When custom preferences are used, both ends use the same text. The legacy title-grouped graph is restored directly from the course shelf and is not automatically regenerated.
- Export the summary, detail, keyPoints, and formula actually returned by the model as concept facts and note points; `required_points` in the prediction file are generated knowledge statements, not ground truth. Source quotes do not count as generated explanations.
- The backend uses V3 staged by default: full-page indexing, skeleton, topic-batched notes, and coverage checks; there is no 5×4 limit, and the number of nodes is determined by the lecture content and the call budget. The `single` rollback path is still 32 pages × 700 characters, 4400 output.
- `relations` remains an empty array because this product path does not generate semantic relations. When reference relations are non-empty, Recall=0 and Precision=N/A; page layout connections are not treated as knowledge relations.
- When the web page opens a node, it separately calls `/study-note/stream`; this process exports the notes that come with `study-guide`, and cannot claim to have evaluated that lazy-generation interface.

### 1. Start the backend

First install Python dependencies according to the project README. The following are Bash/zsh commands for macOS/Linux. Set your own DeepSeek key in the local `.env`. Do not commit the key. The backend does not automatically read `.env`; it must be loaded in the same terminal:

```bash
set -a
source .env
set +a
.venv/bin/python -m uvicorn backend.main:app --port 8000
```

If an old backend is already running, stop and restart it to load the new interface. Generation always uses DeepSeek; TACC is only for the AI tutor/Agent and is no longer used for concept map generation. The scorer's `--judge deepseek` separately uses the DeepSeek configuration.

### 2. Generate the Lecture 1 prediction

Open another terminal and run from the repository root. Replace `--pdf` with the actual PDF path; the manifest verifies SHA256 to prevent mistakenly using Lecture 2 or a different PDF version. The client calls the backend without a model key; generation uses the backend process environment.

```bash
.venv/bin/python -m evaluation.runners.knowledge generate \
  --pdf evaluation/ACS_Lecture_1_2026F.pdf \
  --dataset-id ACS-L1 \
  --document-manifest evaluation/sources/documents.json \
  --output evaluation/results/l1-run1/prediction.json
```

Expected output `Saved N concepts and N notes to ...`. The actual number of nodes is determined by the generation result; no score is preset. `--document-id BACKEND_DOCUMENT_ID` is supported in place of `--pdf`, but that mode cannot verify the original PDF hash; the backend ID and `ACS-L1` serve different purposes.

Lecture 2 uses the same command, replaced with:

```text
--pdf evaluation/ACS_lecture_2_2026F.pdf
--dataset-id ACS-L2
--output evaluation/results/l2-run1/prediction.json
```

Afterward, the scoring reference set is also changed to `evaluation/01_knowledge/lecture2.json`.

The output includes full page evidence, model and instructions, PDF hash, backend document ID, time, and the Git commit hash of the worktree where the command was run / whether there are uncommitted changes. When the backend is deployed remotely, its code version must be recorded separately. Use a new output directory for each experiment; the command refuses to overwrite existing files. Generation failure exits non-zero and saves `prediction.json.failure.json`, and cannot be silently excluded from the experiment. Make one formal call with no automatic retries; diagnostic retries use a separate experiment directory.

### 3. Semantic scoring (requires one paid DeepSeek request)

Run after loading `.env` in the scoring terminal. Reference answers are read only at this stage; the generator does not touch ground truth.

```bash
set -a
source .env
set +a
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --judge deepseek \
  --save-review evaluation/results/l1-run1/review.json \
  --output evaluation/results/l1-run1/metrics.json
```

Artifacts: `review.json.raw.json` is the raw response from the judging service, `review.json` saves per-concept/relation judgments, alias semantic matching, duplicates, per-note-point 0/1/2 scores and reasons, and `metrics.json` saves the aggregate metrics. Failures are not automatically retried. LLM scoring is only automated scoring pending manual review and is not equal to objective ground truth; the model may be affected by phrasing, prompts, and sampling. Keep the raw judgments; save manual corrections separately as `review.human.json`, change reviewer/date/review_type to the actual person, date, and `human`, and explain the rationale for the ruling.

The metrics follow `evaluation/shared/scoring.md`:

- concepts.precision: correct and in-scope generated concepts / deduplicated generated concepts. Valid newly added concepts count as correct and are not required to appear in the reference set.
- concepts.core_recall: matched core reference concepts / fixed number of core concepts (L1=18, L2=20).
- relations.precision / core_recall: relation endpoints, direction, and semantic matching; matched one-to-one.
- study_notes.mean_point_score: the equal-weight mean of the normalized point scores of each reference note; missing is 0. micro_point_score is cumulative score / cumulative maximum score.
- study_notes.fully_covered_points: number of necessary points that received full score / total number of necessary points. This is a strict point coverage rate, not the correctness rate of all generated facts.

Ratios are saved as 0–1; a denominator of 0 is recorded as null / not_applicable. Uncovered core IDs are listed separately. Input file hashes are bound to the review record to prevent using an old score to evaluate new output. Semantic deduplication must be explicitly marked by the reviewer/scoring model and cannot rely on string deduplication. Factual errors, out-of-scope content, and reference omissions require manual verification against the exported page evidence and the original PDF. The reference set is currently still marked human_review_pending; before review, only preliminary results under the candidate reference set may be reported.

### 4. Recompute scores without calling a model / pure manual scoring

Recompute a frozen judgment record; no API key is needed and the backend does not need to be started:

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --review evaluation/results/l1-run1/review.json \
  --output evaluation/results/l1-run1/metrics-recomputed.json
```

You can also avoid using an LLM and first create a manual template to be filled in:

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/lecture1.json \
  --prediction evaluation/results/l1-run1/prediction.json \
  --template evaluation/results/l1-run1/review.human.json
```

Fill in all correct, reason, matches, duplicate_of, as well as the score, prediction_ids, and reason for each reference note point; fill 0 for uncovered points and explain the omission. `prediction_ids` is the generated concept ID. Duplicate concepts point to a non-duplicate concept, matches is empty, and correct is consistent. Correct but non-reference-core newly added concepts have empty matches. Each core concept may be covered jointly by multiple different nodes, but their semantics must be reviewed for sufficiency. Then compute with `--review review.human.json`; unreviewed, invalid IDs, or hash mismatches will fail and will not default to passing.

Course submission must save the prediction, review, metrics, and final code version together, and note in the report the corresponding result table, generation configuration, and review method. The same frozen prediction/review can exactly recompute the metrics; re-requesting the model does not guarantee identical results. This feature does not include existing official model scores.

Local regression check (does not call real models):

```bash
.venv/bin/python -m unittest backend.test_knowledge backend.test_smoke
.venv/bin/python evaluation/runners/validate_dataset.py
```

### Test English question generation and ten-point scoring

[Unified entry point, question generation, and re-evaluation commands](../results/quiz-english-20261121/README.md#run-instructions)

### Choose DeepSeek or TACC to run the evaluation

Run from the repository root. The script reads configuration from the process environment; to use `.env`, first run:

```bash
set -a
source .env
set +a
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
```

DeepSeek requires `DEEPSEEK_API_KEY`, and the model is specified by `DEEPSEEK_MODEL` (default `deepseek-flash`). TACC requires an already-started model service and SSH tunnel; the current client uses `qwen3.8-27b`. TACC does not need a DeepSeek API key. Generation, judging, and grading are different roles; choosing parameters does not switch an already-running web backend.

**Generate questions and score**: `--provider` selects both question generation and the default judge; `--judge-provider` can separately override the judge. Default is DeepSeek. The output directory must be new.

```bash
.venv/bin/python -m evaluation.runners.quiz --provider tacc --output-dir evaluation/results/quiz-tacc-new
# Generate with TACC and judge with DeepSeek
.venv/bin/python -m evaluation.runners.quiz --provider tacc --judge-provider deepseek --output-dir evaluation/results/quiz-tacc-deepseek-new
# Regrade saved English questions with TACC without regenerating them
.venv/bin/python -m evaluation.runners.quiz --provider tacc --predictions evaluation/results/quiz-english-20261121 --output-dir evaluation/results/quiz-tacc-rescore-new
```

The standalone replay question-generation script `python -m evaluation.runners.quiz.generate` also supports `--provider tacc` or `--provider deepseek`; if unspecified, it uses the original backend environment configuration.

**Student answer grading evaluation**: `--provider` selects the grading model; metrics such as score error are still computed by code against reference annotations. Default is serial; `--workers` can adjust concurrency.

```bash
.venv/bin/python -m evaluation.runners.grading_feedback --provider tacc --workers 1 --output-dir evaluation/results/grading-tacc-new
```

**Concept map semantic scoring**: the existing `--judge deepseek` now also accepts `--judge tacc`, and the generation result remains frozen. The saved review records the actual judge provider/model.

```bash
.venv/bin/python -m evaluation.runners.knowledge score --reference evaluation/01_knowledge/v0.5-en/lecture1.json --prediction evaluation/results/v0.5-en-20261119/l1/prediction.json --judge tacc --output evaluation/results/l1-tacc-metrics-new.json
```

The concept map judge follows the 16000 output token budget; TACC's context window must accommodate the full input and output budget, and exceeding it will error rather than automatically truncating reference materials or switching models. Re-calling the model does not guarantee identical scores. Results from the same model for generation and judging still require manual review.

**Evaluation via HTTP backend**: `knowledge generate`, `tutor_single`, and `tutor_multi` are still determined by the backend configuration they connect to. Before starting the backend, use `STUDYGRAPH_GENERATION_PROVIDER=tacc` to select concept map generation and `STUDYGRAPH_TUTOR_PROVIDER=tacc` to select the AI tutor; change the value to `deepseek` to switch. Setting variables only in the evaluation script terminal will not change the configuration of another already-started backend. The AI tutor's history compression may still use DeepSeek when trigger conditions are met and a DeepSeek key exists; this is the backend's existing behavior.

Offline routing check:

```bash
.venv/bin/python -m unittest evaluation.runners.test_provider
```
