# Source Materials

documents.json records the original file paths, SHA256, and page counts; the original PDFs are not copied. lecture*_pages.json is the extraction index of the original text and does not replace image verification.

For the shared scoring rules, see evaluation/shared/scoring.md.

## Switching TACC / DeepSeek to Run Evaluations

The following is how the current code runs; the model names and scores in historical reports remain as they are; after switching models, you should save to a new results directory and re-score. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then in the terminal running the evaluation script set the address and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not need a DeepSeek API key. When switching to DeepSeek, you need to configure `DEEPSEEK_API_KEY` in the current process. If the key is already saved in the project `.env`, you can load it:

```bash
set -a
source .env
set +a
```

Choose the following commands according to the evaluation role. All commands use the project's `.venv/bin/python`, and the output path must not yet exist.

**1. TACC generates questions and uses TACC for scoring**

```bash
.venv/bin/python -m evaluation.runners.quiz \
  --provider tacc \
  --output-dir evaluation/results/quiz-tacc-new
```

If you want TACC to generate questions and DeepSeek to serve as the judge:

```bash
.venv/bin/python -m evaluation.runners.quiz \
  --provider tacc \
  --judge-provider deepseek \
  --output-dir evaluation/results/quiz-tacc-deepseek-new
```

**2. TACC grades student answers**

```bash
.venv/bin/python -m evaluation.runners.grading_feedback \
  --provider tacc \
  --workers 1 \
  --output-dir evaluation/results/grading-tacc-new
```

**3. TACC performs semantic scoring on existing concept maps**

The following uses the existing predictions for Lecture 1 as an example, only re-scoring, not regenerating the concept map:

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/v0.5-en/lecture1.json \
  --prediction evaluation/results/v0.5-en-20261119/l1/prediction.json \
  --judge tacc \
  --output evaluation/results/l1-tacc-metrics-new.json
```

**4. Concept map generation and AI tutor: switching the backend model**

After loading the configuration in the backend terminal, set the model and start the backend. The example port `18031` must be free; if the backend is already running, you need to stop the old process and restart, or choose another free port.

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
export STUDYGRAPH_GENERATION_PROVIDER=tacc
export STUDYGRAPH_TUTOR_PROVIDER=tacc

.venv/bin/python -m uvicorn backend.main:app \
  --host 127.0.0.1 \
  --port 18031
```

When running the HTTP evaluation in another terminal, point `--base-url` to this backend, for example:

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en \
  evaluation/results/tutor-single-tacc-new \
  --base-url http://127.0.0.1:18031 \
  --job CURRENT_JOB_ID
```

Replace `CURRENT_JOB_ID` with the actual TACC job number, and make sure both lecture handouts have been imported into this backend. This command generates answers; semantic scoring still requires separate review.

When switching back to DeepSeek, change `tacc` to `deepseek` in the corresponding command parameters. For HTTP evaluation, modify the configuration in the backend terminal and restart the backend:

```bash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_TUTOR_PROVIDER=deepseek
```

Question set validation, page coverage checks, and aggregation based on saved scores do not call the model and do not require switching.
