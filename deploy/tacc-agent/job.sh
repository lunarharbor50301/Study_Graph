#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${TACC_USERDIR:?Submit with tcloud submit}"
source /mnt/home/public/course-envs/CSIT6000V/project/activate.sh
trap 'rm -rf -- "$QWEN_RUN_DIR"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
export QWEN_CACHE_HOME="$TACC_USERDIR/CSIT6000V-project-cache"
mkdir -p -m 700 "$QWEN_CACHE_HOME"
printf 'CUDA_VISIBLE_DEVICES=%s\n' "${CUDA_VISIBLE_DEVICES:-unset}"
nvidia-smi
QWEN_PORT=${QWEN_PORT:-18231}
printf 'SERVICE_BASE_URL=http://%s:%s/v1\n' "$(hostname)" "$QWEN_PORT"
bash "$QWEN_PROJECT_ROOT/runtime.sh" "$QWEN_PROJECT_ROOT/vllm-env/bin/python" \
  -m vllm.entrypoints.openai.api_server \
  --model "$QWEN_MODEL_PATH" --served-model-name qwen3.8-27b \
  --safetensors-load-strategy prefetch --host 0.0.0.0 --port "$QWEN_PORT" \
  --tensor-parallel-size 2 --language-model-only --dtype bfloat16 \
  --gpu-memory-utilization 0.90 --max-model-len 32768 \
  --max-num-seqs 4 --max-num-batched-tokens 4096 \
  --reasoning-parser qwen3 --enable-prefix-caching \
  --enable-auto-tool-choice --tool-call-parser qwen3_xml
