# Student Answer Grading

Each set has 20 cases, and the 4 questions each include fully correct, omitted, partially incorrect, fully incorrect, and irrelevant answers. The grading_key remains on the evaluation side. The report covers classification macro-F1, score MAE, error-point and omission Precision/Recall, false-positive rate for correct answers, and hint quality.

Sole metric definition: [Shared Scoring Specification v1.0](../shared/scoring.md). A denominator of 0 is recorded as N/A, and checks that were not executed are recorded as not tested; failures must not be silently excluded.

## Switching between TACC / DeepSeek to run the evaluation

The following is how the current code runs; the model names and scores in historical reports remain as they are. After switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not require a DeepSeek API key. To switch to DeepSeek, configure `DEEPSEEK_API_KEY` in the current process. If the key is already saved in the project's `.env`, you can load it:

```bash
set -a
source .env
set +a
```

Use TACC as the experimental student answer grading model; metrics are still computed by the code against the reference annotations:

```bash
.venv/bin/python -m evaluation.runners.grading_feedback --provider tacc --workers 1 --output-dir evaluation/results/grading-tacc-new
```

Change to `--provider deepseek` to switch back to DeepSeek. This parameter does not change the web page's answer normalization matching rules; web page rule comparison and model grading are still reported separately.
