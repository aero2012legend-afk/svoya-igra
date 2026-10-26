#!/bin/bash
# Ставит окружение для инструментов пака: /opt/aienv (yt-dlp, faster-whisper, diffusers, mediapipe, demucs)
# и модели в /opt/models. Можно запускать повторно — готовое пропускается.
# bash _work/tools/setup_env.sh   (лог — /tmp/aienv_setup.log)
set -u
exec > >(tee -a /tmp/aienv_setup.log) 2>&1
PY=/opt/aienv/bin/python
step() { echo "=== $(date +%H:%M:%S) $*"; }

if [ ! -x "$PY" ]; then step venv; uv venv -q /opt/aienv --python python3 || exit 1; fi
pipi() { uv pip install -q --python "$PY" "$@"; }

step torch
"$PY" -c "import torch, torchaudio" 2>/dev/null || pipi torch torchaudio --index-url https://download.pytorch.org/whl/cpu || exit 1
step pip
pipi diffusers transformers accelerate safetensors faster-whisper mediapipe opencv-python-headless numpy pillow yt-dlp || exit 1
step demucs
"$PY" -c "import demucs" 2>/dev/null || pipi demucs || echo "demucs не встал — audio_words.py будет работать без --vocals"

step sd-turbo
"$PY" -c "
from diffusers import AutoPipelineForText2Image
AutoPipelineForText2Image.from_pretrained('stabilityai/sd-turbo', cache_dir='/opt/models')
print('sd-turbo ok')" || echo "sd-turbo не скачался"

step whisper-medium
"$PY" -c "
from faster_whisper import WhisperModel
WhisperModel('medium', device='cpu', compute_type='int8', download_root='/opt/models/whisper')
print('whisper ok')" || echo "whisper не скачался"

step "libegl1 libgles2 (нужны mediapipe для мешапа)"
dpkg -s libegl1 libgles2 >/dev/null 2>&1 || apt-get install -y -q libegl1 libgles2 >/dev/null 2>&1 \
  || { apt-get update -q >/dev/null 2>&1 && apt-get install -y -q libegl1 libgles2 >/dev/null 2>&1; } \
  || echo "libegl1/libgles2 не встали — мешап (mediapipe) может не работать"

step face-landmarker
mkdir -p /tmp/mashup/models
[ -s /tmp/mashup/models/face_landmarker.task ] || curl -sSL -o /tmp/mashup/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
ls -la /tmp/mashup/models/face_landmarker.task

step "готово"
df -h / | tail -1
