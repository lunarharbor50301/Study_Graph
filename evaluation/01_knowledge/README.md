# Concept Maps and Study Notes

Each JSON contains concepts, relations, note points, and evidence. After concept normalization, accuracy and core coverage are computed; relations are checked for endpoints, direction, and semantics; notes are scored by point.

Sole metric definition: [Shared Scoring Specification v1.0](../shared/scoring.md). A denominator of 0 is recorded as N/A, and checks not executed are recorded as not measured; failures must not be silently excluded.

## Switching TACC / DeepSeek to run evaluation

The following is how the current code runs; model names and scores in historical reports remain as-is; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and SSH tunnel, then in the terminal running the evaluation script set the address and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

Evaluation scripts that call TACC directly do not need a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

Use TACC to re-run semantic scoring on existing concept maps and notes:

```bash
.venv/bin/python -m evaluation.runners.knowledge score --reference evaluation/01_knowledge/v0.5-en/lecture1.json --prediction evaluation/results/v0.5-en-20261119/l1/prediction.json --judge tacc --output evaluation/results/l1-tacc-metrics-new.json
```

Replace with `--judge deepseek` to switch the judge; this command does not regenerate concept maps. When TACC generation is needed, set `STUDYGRAPH_GENERATION_PROVIDER=tacc` before starting the standalone backend, then point `knowledge generate --base-url` to that backend. Do not combine mismatched reference sets and historical predictions for a fair comparison. Large judge inputs plus a 16000 output token budget must fit within the TACC context window; exceeding the limit will not automatically truncate or fall back.
