# Answer fixed exercises

Reference shared/question_bank.json via question_ids to avoid maintaining answers twice. Include only questions that can be answered based on the courseware; questions with insufficient evidence are in the Tutor module. Score point by point; extra errors and citations are counted separately.

Single metric definition: [Shared scoring specification v1.0](../shared/scoring.md). A denominator of 0 is recorded as N/A, and checks not performed are recorded as not tested; failures must not be silently excluded.

## Switching between TACC / DeepSeek to run the evaluation

The following is how the current code runs; the model names and scores in historical reports remain as they are; after switching models, save to a new results directory and re-score. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

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

The AI tutor runner accesses the backend via HTTP and has no `--provider` parameter. After loading the configuration in the **backend terminal**, start an independent TACC backend (the port must be free):

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1
export STUDYGRAPH_TUTOR_PROVIDER=tacc
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18031
```

Confirm that both handouts have been imported into that backend, then in another terminal choose single-turn or multi-turn running; replace `CURRENT_JOB_ID` with the actual assignment number:

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en evaluation/results/tutor-single-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
.venv/bin/python -m evaluation.runners.tutor_multi evaluation/results/tutor-multi-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
```

When switching to DeepSeek, configure the key in the backend startup environment, set `STUDYGRAPH_TUTOR_PROVIDER=deepseek`, and then restart; do not treat the TACC assignment number as DeepSeek model information. Changing variables only in the evaluation script terminal will not change an already-running backend. The above commands only generate answers; semantic scoring still requires separate review; fixed exercises are already included in the single-turn run and are not counted again. Historical compression may still call DeepSeek when conditions are met and a DeepSeek key exists; when only TACC is required, remove that key in the backend process so that this optional compression is not executed.
