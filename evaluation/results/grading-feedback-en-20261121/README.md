# Evaluation of Short-Answer Grading and Feedback for English Questions

15 questions × 5 answer types = 75 cases. L1 has 8 questions, L2 has 7 questions. Each question includes fully correct, only one key point answered, one key point correct and the other wrong, both key points wrong, and off-topic. Each key point is worth 0–2 points, for a total of 0–4. The experimental input is the question stem, two scoring points, the original lecture page, and one student answer; the variant name, target score, and candidate error points are not provided to the grading model. Labels are still pending manual review.

## Experimental DeepSeek grading

| Metric | L1 | L2 | All |
|---|---:|---:|---:|
| Valid returns | 40/40 | 35/35 | 75/75 |
| Total score exactly consistent | 40/40 | 34/35 | 74/75 |
| MAE (points) | 0 | 0.0286 | 0.0133 |
| Explicit error-point localization precision | 24/24 | 21/21 | 45/45 |
| Explicit error-point localization recall | 24/24 | 21/21 | 45/45 |
| Omission localization precision | 24/26 | 21/21 | 45/47 |
| Omission localization recall | 24/24 | 21/21 | 45/45 |
| Candidate marked fully correct, feedback text indicates omission (counted by original annotation) | 0/8 | 1/7 | 1/15 |

MAE is the sum of absolute score differences divided by 75. Error points are matched one-to-one using scoring point IDs and verbatim snippets from the student answer, allowing a shorter verbatim snippet from the annotated erroneous clause to be returned. Omissions are matched independently by scoring point. Off-topic answers are recorded as omissions and are not automatically marked as factual errors. In this round, all error-point labels come from direct, explicit erroneous propositions; the samples are template-constructed, and some wording overlaps heavily with the scoring points, so the results cannot be extrapolated to real students' free-form answers.

- [Shared sum and mutex](L1-SA05-wrong.json): both errors were localized correctly, but the two scoring points that had already been answered incorrectly were also listed as omissions, producing two false-positive omissions.
### Why the DRAM question was given 3/4 points

The question stem asks two things: how different DRAM banks can operate in parallel, and what resource still limits transfer. The student answered: "Different banks can prepare and serve work concurrently, but returning data still uses the common channel bus."

- **P1 received 2/2 points.** The student stated that different banks can prepare and serve concurrently, covering the mechanism by which banks can overlap work.
- **P2 received 1/2 points.** The original scoring point is "Ranks on the same channel share its data bus." The student identified the shared resource as the channel data bus, so partial credit was given; the answer did not explicitly state that it is multiple ranks on the same channel that share this bus. Given the completeness required by this scoring point, deducting 1 point is justified. The two items total **3/4 points**. [Original grading feedback](L2-SA11-correct.json)

The original candidate annotation accepted "shared channel bus" based on "what resource" in the question stem and gave 4/4 points. The table above uses the frozen candidate annotation, so this case contributes 1 point of absolute error and is counted in the 1/15 for "candidate fully correct, feedback text indicates omission." Review accepts the model's 3 points; this statistical record reflects the disagreement with the original annotation.

There is another independent issue in the feedback output: the text explicitly states that the rank-sharing relationship was omitted, but the structured field returns `missing: []`. According to the model's own reason for deduction, this field should contain `P2`, so that the feedback the student reads and the omissions counted by the program correspond.

## Web rule comparison

This branch's web page performs normalized exact-string matching on generated short answers and returns correct/incorrect. The same batch of answers was recomputed using the product normalize function, with one canonical answer configured per question and an empty list of synonym answers. Of the 15 fully correct answers, 7 passed as verbatim canonical answers, and 8 correct paraphrases were all rejected (8/15). All 60 non-full-score answers were judged incorrect. After artificially mapping the binary results to 4/0, the MAE against the candidate standard is 1.227 points; the web page itself does not provide sub-scores, error snippets, or omission IDs, so the web page's error-point localization precision/recall is not measurable. Real generated questions can be configured with additional synonym answers; the results here apply only to this controlled configuration.

## Rerun and evidence

After loading .env, run from the repository root using a new directory:

```sh
.venv/bin/python -m evaluation.runners.grading_feedback --output-dir evaluation/results/grading-feedback-rerun
```

[Evaluation questions and candidate annotations](../../04_answer_grading/english-75/) · [Experiment script](../../runners/grading_feedback.py) · [Aggregate counts](summary.json) · [Web rule per-case results](web-baseline.json). The script counts structured false positives; disagreements between the feedback text and the candidate annotations were checked by reading the original feedback case by case.

## Switching to TACC / DeepSeek to run the evaluation

The following is how the current code runs; model names and scores in historical reports remain as they were; after switching models, results should be saved to a new results directory and re-scored. [Full configuration, parameters, and run instructions](../../runners/README.md). All commands are executed from the repository root.

First start the TACC model and the SSH tunnel, then in the terminal running the evaluation script set the address and check the interface:

```bash
export QWEN_BASE_URL=http://127.0.0.1:18024/v1

curl --noproxy '*' -fsS --max-time 8 \
  http://127.0.0.1:18024/v1/models
```

The evaluation script that calls TACC directly does not require a DeepSeek API key. When switching to DeepSeek, `DEEPSEEK_API_KEY` needs to be configured in the current process. If the key is already saved in the project's `.env`, it can be loaded:

```bash
set -a
source .env
set +a
```

Using TACC as the experimental student-answer grading model, the metrics are still computed by the code against the reference annotations:

```bash
.venv/bin/python -m evaluation.runners.grading_feedback --provider tacc --workers 1 --output-dir evaluation/results/grading-tacc-new
```

Changing to `--provider deepseek` switches back to DeepSeek. This parameter does not change the web page's answer normalization matching rules; the web rule comparison and model grading are still reported separately.
