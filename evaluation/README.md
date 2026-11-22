# StudyGraph Evaluation Entry Point

The evaluation uses ACS Lecture 1 and Lecture 2. Each module stores test inputs and candidate reference standards; actual test reports and raw outputs are saved in [results/](results/). The reference standards still await manual review, and the split between development and test sets has not yet been frozen.

## Find Test Sets and Reports by Capability

1. **Concept maps and in-map notes**. The current English reference set is organized by consecutive teaching pages; L1 contains 17 core concepts and L2 contains 19. The report records changes in node granularity, full-page coverage, concept accuracy, and note scores. [v0.5-en reference set](01_knowledge/v0.5-en/) · [Evaluation iteration report](results/concept-map-iterations.md)
2. **AI tutor**. The single-turn test checks answers, citations, and handling when evidence is insufficient; L1 and L2 have 14 and 16 questions respectively. The English multi-turn question set additionally contains 3 dialogues per lecture, each with 4 turns, and 24 turns of actual testing and turn-by-turn scoring have been completed. [English single-turn question set](02_ai_tutor/single_turn/en/) · [English multi-turn question set](02_ai_tutor/multi_turn/) · [Multi-turn turn-by-turn scoring report](results/tutor-multi/README.md) · [Single-turn evaluation report](results/AI-Tutor-单轮问答评测报告.md)
3. **Question generation capability**. L1 and L2 each have 10 English tasks, and each task generates one question, for a total of 20 questions. Quality scoring examines task coverage, answer correctness, citation support, and answerability, out of 10 points. [English question generation tasks](03_question_generation/english-20/) · [Evaluation report and rerun method](results/quiz-english-20261121/README.md)
4. **Student answer grading and feedback**. 15 English short-answer questions (L1 has 8 questions, L2 has 7 questions), each paired with five kinds of answers: fully correct, omission, partially incorrect, fully incorrect, and irrelevant, for a total of 75 cases. The report separately presents the scoring error, error-point localization, and false positives of experimental AI grading, as well as the comparison results with the web-based grading rules. [English grading cases](04_answer_grading/english-75/) · [Grading feedback report](results/grading-feedback-en-20261121/README.md)
5. **Answering fixed exercises**. All 26 answerable questions in this module (12 in L1 and 14 in L2) have been included in the AI tutor English single-turn evaluation, and every question has a run record. The 30 questions in the single-turn evaluation consist of these 26 fixed exercises and 4 insufficient-evidence questions (2 per lecture). The results of the fifth module are included in the AI tutor single-turn report; if the fixed-exercise scores are summarized separately, filter by these 26 question IDs, and count them only once in cross-module statistics. [Fixed exercise description](05_question_answering/README.md) · [AI tutor single-turn report](results/AI-Tutor-单轮问答评测报告.md) · [Per-question run records](results/tutor-single-en-29876-citations/)

## Running and Review

- Before running, check the PDF version and physical page numbers against the [lecture list](sources/documents.json).
- The run scripts are located in [runners/](runners/README.md). During generation, only the inputs required by the task are passed in; candidate answers, target scores, and error-point annotations remain on the evaluation side.
- Report scores by module separately, and retain per-question outputs and failure records. For question-answering standards, see the [shared question bank](shared/question_bank.json); for metric definitions, see the [shared scoring rules](shared/scoring.md). For historical data, see the [archive notes](archive/README.md).

## Switching Between TACC / DeepSeek to Run Evaluations

The following is how the current code runs; the model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

Evaluation scripts that call TACC directly do not need a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project's `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

Choose the following commands according to the evaluation role. All commands use the project's `.venv/bin/python`, and the output path must not already exist.

**1. TACC generates questions and uses TACC for scoring**

```bash
.venv/bin/python -m evaluation.runners.quiz \
  --provider tacc \
  --output-dir evaluation/results/quiz-tacc-new
```

If you want TACC to generate questions and DeepSeek to serve as judge:

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

The following uses the existing predictions for Lecture 1 as an example, only re-scoring without regenerating the concept map:

```bash
.venv/bin/python -m evaluation.runners.knowledge score \
  --reference evaluation/01_knowledge/v0.5-en/lecture1.json \
  --prediction evaluation/results/v0.5-en-20261119/l1/prediction.json \
  --judge tacc \
  --output evaluation/results/l1-tacc-metrics-new.json
```

**4. Concept map generation and AI tutor: switching the backend model**

After loading the configuration in the backend terminal, set the model and start the backend. The example port `18031` must be free; if the backend is already running, stop the old process and restart it, or choose another free port.

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

Replace `CURRENT_JOB_ID` with the actual TACC job number, and ensure that both lectures have been imported into this backend. This command generates answers; semantic scoring still requires separate review.

When switching back to DeepSeek, change `tacc` to `deepseek` in the corresponding command parameters. For HTTP evaluation, modify the configuration in the backend terminal and restart the backend:

```bash
export STUDYGRAPH_GENERATION_PROVIDER=deepseek
export STUDYGRAPH_TUTOR_PROVIDER=deepseek
```

Question set validation, page coverage checks, and summaries based on saved scores do not call the model and do not require switching.
