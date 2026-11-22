# Question-setting capability

Each set has 5 tasks, with 7 questions required in total. Only the input is sent; generation results are frozen and then scored by item-by-item inspection; the model's own answers must not be used to verify itself. Report the proportion of qualified questions, topic coverage, repetition rate, and difficulty compliance rate.

Sole metric definition: [Shared scoring specification v1.0](../shared/scoring.md). A denominator of 0 is recorded as N/A; checks not performed are recorded as not tested; failures must not be silently removed.

The core qualification rate only requires all four thresholds to pass: G1 question stem, G2 answerable, G3 answer correct, and G4 scoring executable. Scope/question type, quantity, difficulty, citations, coverage, and repetition are reported independently; the strict usability rate is listed separately and names are not mixed.

## Switching TACC / DeepSeek to run the evaluation

The following is how the current code runs; model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not need a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project's `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

Question setting and the default judge both use TACC:

```bash
.venv/bin/python -m evaluation.runners.quiz --provider tacc --output-dir evaluation/results/quiz-tacc-new
```

When only re-evaluating existing questions, add `--predictions evaluation/results/quiz-english-20261121`. Add `--judge-provider deepseek` to achieve TACC question setting and DeepSeek scoring; `--provider deepseek` switches back to DeepSeek. Recalculating only saved scoring numbers does not require calling the model.
