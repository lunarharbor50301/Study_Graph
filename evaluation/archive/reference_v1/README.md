# Single-Courseware Reference Set Entry

When importing only one PDF at a time, use only the corresponding single JSON file; do not load two reference files at the same time.

## Lecture 1
- Data file: [lecture1_reference.json](lecture1_reference.json)
- Contains: 18 concepts, 7 relations, 18 sets of note points, 14 Q&A items, 6 grading samples.

## Lecture 2
- Data file: [lecture2_reference.json](lecture2_reference.json)
- Contains: 20 concepts, 9 relations, 20 sets of note points, 16 Q&A items, 12 grading samples.

## Shared Rules
See [SCORING.md](SCORING.md). Both files remain in a pending manual review state and have not yet been split into development and test sets.

3 cross-courseware relations have been moved to cross_lecture_relations_optional.json, for use only in future multi-courseware evaluation. The no-evidence questions in each file have been changed to fall within the current single-courseware scope.

The original concepts.json, relations.json, study_notes.json, qa.json, feedback.json, manifest.json, and combined_reference_archive.md are retained as v0.1 build sources and are no longer used as single-courseware evaluation entries. lecture1_pages.json and lecture2_pages.json are the respective source-text extraction indexes.


## Practice Module Special Evaluation (New)

Each is divided into three modules: question generation, grading, and answering. It is recommended to read the Markdown first; for program execution, use the JSON file of the same name.

- [Lecture 1 readable version](lecture1_test_generation_eval.md) · [JSON](lecture1_test_generation_eval.json)
- [Lecture 2 readable version](lecture2_test_generation_eval.md) · [JSON](lecture2_test_generation_eval.json)

The evaluation_policy in the special files is the scoring rule for this practice module. Currently only the data and standards have been established; the agent has not yet been run, and no manual review has been conducted.

## Switching TACC / DeepSeek to Run Evaluation

The following is how the current code runs. The model names and scores in historical reports remain as they are; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then set the address in the terminal running the evaluation script and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that directly calls TACC does not require a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key has already been saved in the project `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

This file is a historical archive and should not be directly used with old question sets or old commands for new-version comparisons. The current question-generation entry uses `--provider tacc` (a separate `--judge-provider deepseek` can be set), the grading entry uses `--provider tacc`, and concept-map semantic scoring uses `--judge tacc`. To switch to `deepseek`, the corresponding DeepSeek interface can be used; for the current question set and complete commands, see the run instructions above.
