# Historical Materials

reference_v1 is a complete snapshot before reorganization; legacy contains the existing development set. The original content is retained for traceability and is not used as a new evaluation entry point.

For shared scoring rules, see evaluation/shared/scoring.md.

## Switching TACC / DeepSeek to run evaluations

The following is how the current code runs; the model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../runners/README.md). All commands are executed from the repository root.

First start the TACC model and SSH tunnel, then set the address and check the interface in the terminal where the evaluation script is run:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

Evaluation scripts that call TACC directly do not require a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

This file is a historical archive and should not directly apply old question sets or old commands for new-version comparisons. The current question-generation entry point uses `--provider tacc` (a separate `--judge-provider deepseek` can be set), the grading entry point uses `--provider tacc`, and concept-map semantic scoring uses `--judge tacc`. To switch to `deepseek`, the corresponding DeepSeek interface can be used; for the current question set and complete commands, see the run instructions above.
