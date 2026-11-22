# StudyGraph

StudyGraph turns course slides into a study workspace. Students can navigate a concept map, read cited notes alongside the source slides, ask a retrieval-enabled AI tutor, and build and take a practice test.

[GitHub repository](https://github.com/lunarharbor50301/Study_Graph) · [Backend contributor statement](docs/backend-contributions.md) · [Course project proposal](docs/project/StudyGraph_Project_Proposal%281%29.pdf)

## Getting Started Instructions

### Install and start

Run the commands from the repository root. Use Python 3.12 and Node.js 24. Dependency installation requires internet access. The local smoke check uses SQLite and the bundled Lecture 1 PDF and can run without model credentials. Model-backed generation needs a DeepSeek API key or a configured TACC Qwen endpoint. The documented Tutor configuration uses Qwen on TACC.

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

Open [StudyGraph](http://127.0.0.1:8000/) and the [API reference](http://127.0.0.1:8000/docs). FastAPI serves the built React application, so this setup uses a single local server. The backend writes uploaded documents, search indexes and Agent history to SQLite. The browser keeps its course shelf, saved tests and practice progress in local storage.

### Run a small end-to-end check

Keep the server running. In a second terminal, upload the bundled lecture and open its page 67 preview. The examples below use `curl` in Bash. In Windows PowerShell use `curl.exe` and put each command on one line.

```bash
curl -fsS -F "file=@docs/ACS_Lecture_1_2026F.pdf" http://127.0.0.1:8000/api/documents
```

Expect HTTP 201 and JSON containing `"page_count":67` and document ID `34911c46e78edc833f283f8dd678b85d6f8c92d66859e6bf6886949181d95402`. Open the [page 67 preview](http://127.0.0.1:8000/api/documents/34911c46e78edc833f283f8dd678b85d6f8c92d66859e6bf6886949181d95402/pages/67/preview) and expect the Roofline Model slide. In the web app, User A can also open **AI Computing Foundations** in the course shelf, select question 5 and use **Page 67** to open the source. Enter `200 GFLOP/s memory-bound` and submit to see the built-in grading and feedback.

To check the same local stack from the command line, run `python -m unittest backend.test_smoke backend.test_documents` using the virtual environment's Python. Expect `OK`.

### Enable model-backed workflows

Create a local `.env` from [the example](.env.example). Set your own `DEEPSEEK_API_KEY` for default generation. For Tutor, set `STUDYGRAPH_TUTOR_PROVIDER=tacc` and point `QWEN_BASE_URL` to the reachable OpenAI-compatible endpoint with the `/v1` suffix. The Agent needs a service with native tool calling. Submit [the TACC Agent job](deploy/tacc-agent/) and open the persistent SSH tunnel as described in [the Agent setup](docs/pi-agent.md). Check that `/v1/models` returns `qwen3.8-27b` before testing the Tutor. TACC access requires a course account with GPU permissions. The supplied job requests two GPUs and a one-hour allocation. Review any node exclusions in its job configuration for your allocation.

Load `.env` in the server terminal and restart Uvicorn. In Bash, run `set -a`, `source .env`, then `set +a`. In PowerShell, use the following before running the start command above.

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
}
```

On Windows, `.\scripts\studygraph.cmd -NoTaccWait` is an alternative launcher after setup and build. With default options it waits for an already submitted TACC service. To enable full-layout PPTX previews, install LibreOffice on the backend host and set `SOFFICE_PATH` if `soffice` is outside PATH. PDF previews and the simplified PPTX preview work with the base setup.

With DeepSeek configured, open **Test**, upload the bundled PDF, select one question and generate the test. Expect a practice question with a source page, answer feedback and a saved entry in the course shelf. With TACC healthy, open the built-in lecture and ask **What does the Roofline model explain?** in AI Tutor. Look for a streamed explanation and an actionable slide citation. [Test flow](docs/test-flow.md) · [Document API](docs/document-api.md)

## Detailed Instructions

### Inputs and reference results

Use the PDFs identified by the [SHA-256 manifest](evaluation/sources/documents.json). Lecture 1 is [bundled in the repository](docs/ACS_Lecture_1_2026F.pdf). Obtain `ACS_lecture_2_2026F.pdf` from the course materials and verify its SHA-256 against `ACS-L2` in the manifest. Both original PDFs are required for a fresh two-lecture run. The stored predictions, responses and reviews suffice for offline recomputation. Page numbers refer to physical PDF pages starting at 1.

| Experiment | Tracked inputs and recorded results |
|---|---|
| Concept maps and embedded study notes | The [English v0.5 reference sets](evaluation/01_knowledge/v0.5-en/) cover 17 core concepts for Lecture 1 and 19 for Lecture 2. In the archived run, core recall was 17/17 and 19/19, and mean note-point scores were 96.08% and 96.49%. The guides assigned 67/67 and 69/69 physical pages. Lecture 1's first attempt failed its coverage check. See [the iteration report and result table](evaluation/results/concept-map-iterations.md#3-全页覆盖版本在新参考集上的表现) and [raw guides, reviews and metrics](evaluation/results/v0.5-en-20261119/). |
| English single-turn AI Tutor | The [English cases](evaluation/02_ai_tutor/single_turn/en/) contain 14 Lecture 1 and 16 Lecture 2 questions. In the archived run, 30/30 completed and 26/26 answerable cases returned structured citations. The preliminary rubric score was 98.96%, with 14.89 s median and 24.25 s P95 response time. See [the Tutor evaluation report](evaluation/results/AI-Tutor-单轮问答评测报告.md) and [recorded responses, reviews and summary](evaluation/results/tutor-single-en-29876-citations/). |

### Recompute archived metrics offline

From the repository root, run the following with the project virtual environment active. In Bash, activate it with `source .venv/bin/activate`. The examples below use Bash. On Windows PowerShell, run the Python commands once per lecture, replacing `$i` with `1` and `2` and `$d` with the corresponding archived directory. Use a fresh output path on each run.

```bash
for i in 1 2; do
  d="evaluation/results/v0.5-en-20261119/l$i"
  python -m evaluation.runners.knowledge score \
    --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
    --prediction "$d/prediction.json" --review "$d/review.json" \
    --output "evaluation/local-reproduction/offline/l$i/metrics.json"
done
python -m evaluation.runners.tutor_single summarize en evaluation/results/tutor-single-en-29876-citations
```

Compare each concept-map output with the corresponding archived `metrics.json` and the Tutor output with its archived `summary.json`. The concept-map scorer checks that the review belongs to the supplied reference and prediction. The archived `page_checks.json` records source-page coverage and continuity separately from semantic scores.

### Generate and score fresh outputs

For concept maps, start the backend with `STUDYGRAPH_GENERATION_PROVIDER=deepseek`, `DEEPSEEK_MODEL=deepseek-flash`, `STUDYGRAPH_CONCEPT_MAP_MODE=staged` and `STUDYGRAPH_CONCEPT_MAP_CACHE=0`. Keep the default generation budgets and omit custom instructions for this benchmark. The runtime uses the same study-guide generation path as **Learning**. In an evaluation terminal with the DeepSeek variables loaded, run:

```bash
# Point this to the confirmed course PDF on your machine.
l2_pdf="/path/to/ACS_lecture_2_2026F.pdf"
out="evaluation/local-reproduction/live-$(date +%Y%m%d-%H%M%S)"

for i in 1 2; do
  pdf="$l2_pdf"
  if [ "$i" = 1 ]; then pdf="docs/ACS_Lecture_1_2026F.pdf"; fi

  python -m evaluation.runners.knowledge generate \
    --base-url http://127.0.0.1:8000 --pdf "$pdf" --dataset-id "ACS-L$i" \
    --document-manifest evaluation/sources/documents.json \
    --output "$out/concept-map/l$i/prediction.json" || continue

  python -m evaluation.runners.knowledge score \
    --reference "evaluation/01_knowledge/v0.5-en/lecture$i.json" \
    --prediction "$out/concept-map/l$i/prediction.json" --judge deepseek \
    --save-review "$out/concept-map/l$i/review.json" \
    --output "$out/concept-map/l$i/metrics.json"
done
```

Expect a prediction, raw judge response, structured review and metrics per successful lecture. Keep failed attempts and use a fresh output directory for a diagnostic retry. For scoring definitions and a human-review template, see [the runner instructions](evaluation/runners/README.md).

For Tutor, start the Qwen service and tunnel, then upload both verified PDFs to the backend's default profile. The concept-map run above also uploads them to that profile. Set `tacc_job_id` to the current job's ID and run the following in Bash.

```bash
tacc_job_id="YOUR_JOB_ID"
tutor_out="evaluation/local-reproduction/tutor-$(date +%Y%m%d-%H%M%S)"
python -m evaluation.runners.tutor_single run en "$tutor_out" \
  --base-url http://127.0.0.1:8000 --job "$tacc_job_id"
```

Expect 30 per-question JSON files and a `review.json` template. The runner uses independent sessions with up to three concurrent requests. Fill in the successful answers' rubric scores using the English cases. Failed requests count as zero. Run `python -m evaluation.runners.tutor_single summarize en "$tutor_out"` and compare completion, rubric score, structured citation coverage and latency against the [archived Tutor summary](evaluation/results/tutor-single-en-29876-citations/summary.json).

### Interpret results and run regression checks

- Offline recomputation uses frozen outputs and reviews. Fresh model runs can change wording, node segmentation, scores and latency. Concept-map semantic scores are from an automated judge. The Tutor rubric review is provisional. The archived runs predate this submission branch's Test fixes.
- Concept-map scores cover the notes returned with the guide. The separately streamed note on opening a node has its own API. The graph's layout links do not represent evaluated semantic relationships. Coverage validation can reject an otherwise usable guide when physical pages are omitted. [Concept-map evaluation](evaluation/results/concept-map-iterations.md)
- Tutor latency includes retrieval, inference and streaming. GPU allocation, concurrency, endpoint health and model startup can affect timing. The Tutor benchmark is single-turn. [Tutor evaluation](evaluation/results/AI-Tutor-单轮问答评测报告.md)
- Practice tests support three question types and local scoring. The archived tables above cover concept maps, guide notes and Tutor. The [evaluation index](evaluation/README.md) lists separate practice and grading reference sets.

```bash
python -m unittest discover -s backend -p "test_*.py"
node agent/test-runner.mjs
npm run build --prefix frontend
```

The documentation follows the course's two-section artifact README format. [NSDI ’27 README instructions](https://www.usenix.org/conference/nsdi27/call-for-artifacts#readme-instructions)
