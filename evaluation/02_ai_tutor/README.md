# AI tutor

`single_turn` lists question IDs; reference answers are stored in `shared/question_bank.json`. The multi-turn set contains 3 dialogues per lecture, with 4 turns per dialogue.

Multi-turn is sent in order, with a new session created for each segment, and real historical answers retained within a segment. It is not acceptable to pass only the same session_id while discarding history. Incorrect answers may affect subsequent turns; score according to the user's original intent, and record the propagation of prior errors. The current tutor_multi runner calls the real /api/agent/stream interface, reuses the session within a segment, and the backend saves and loads history; the English 6-segment, 24-round evaluation has been completed.

Evaluate key points round by round, reference/condition retention, topic switching, and citations. A segment counts as strictly successful only if all required points receive full marks and there are no factual contradictions; report round scores and whole-segment success rates separately. Citation jumps must be verified by actual clicking/requesting; unverified items are marked as untested, and success cannot be counted merely because the output contains a page number.

The sole metric definition: [Shared Scoring Specification v1.0](../shared/scoring.md). A denominator of 0 is recorded as N/A, and checks not executed are recorded as untested; failures must not be silently excluded.

## Switching TACC / DeepSeek to run the evaluation

The following is how the current code runs; model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then in the terminal running the evaluation script set the address and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not need a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project `.env`, it can be loaded:

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

Confirm that both lecture notes have been imported into that backend, then in another terminal choose single-turn or multi-turn execution; replace `CURRENT_JOB_ID` with the actual job number:

```bash
.venv/bin/python -m evaluation.runners.tutor_single run en evaluation/results/tutor-single-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
.venv/bin/python -m evaluation.runners.tutor_multi evaluation/results/tutor-multi-tacc-new --base-url http://127.0.0.1:18031 --job CURRENT_JOB_ID
```

When switching to DeepSeek, configure the key in the backend startup environment, set `STUDYGRAPH_TUTOR_PROVIDER=deepseek`, and restart; do not treat the TACC job number as DeepSeek model information. Changing variables only in the evaluation script terminal will not change an already-running backend. The above commands only generate answers; semantic scoring still requires separate review; the fixed exercises are already included in the single-turn set and are not counted again. History compression may still call DeepSeek when the conditions are met and a DeepSeek key exists; if only TACC is to be used, the key should be removed from the backend process so that this optional compression is not executed.
