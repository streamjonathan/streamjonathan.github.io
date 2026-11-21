#!/usr/bin/env bash
# Retry pass for the 3 videos that hit YouTube bot-checks in the first pass.
set -u
OUT="$HOME/workspace/jonathanmccallum-site/work/voice/transcripts"
WORK="$HOME/workspace/jonathanmccallum-site/work/voice/tmp-audio"
mkdir -p "$OUT" "$WORK"
export PATH="$HOME/workspace/venv-whisper/bin:$PATH"

VIDS=(
"U9BSyBTn6AY|Narnia and What I'd Like Everyone To Know"
"exnoQUfSQN0|My Theology Influenced by C S Lewis So Far (2025)"
"lktNSXNzZGs|Back to Surfing after Panic Attack in Ocean"
)

for entry in "${VIDS[@]}"; do
  id="${entry%%|*}"; title="${entry#*|}"
  txt="$OUT/${id}.txt"
  if [ -s "$txt" ]; then echo "SKIP $id"; continue; fi
  ok=""
  for attempt in 1 2 3; do
    echo "TRY $id attempt $attempt"
    if yt-dlp --no-check-certificates -f 'ba[ext=m4a]/ba' --no-playlist -o "$WORK/${id}.m4a" \
        "https://www.youtube.com/watch?v=${id}" >/dev/null 2>&1; then
      ok=1; break
    fi
    echo "RETRY-WAIT $id"
    sleep 90
  done
  [ -z "$ok" ] && { echo "FAIL-DL $id"; continue; }
  ffmpeg -y -v error -i "$WORK/${id}.m4a" -ar 16000 -ac 1 "$WORK/${id}.wav" || { echo "FAIL-FF $id"; continue; }
  ~/workspace/venv-whisper/bin/python - "$WORK/${id}.wav" "$txt" "$id" "$title" <<'PYEOF' || echo "FAIL-TR $id"
import sys, wave, numpy as np
from faster_whisper import WhisperModel
wav, txt, vid, title = sys.argv[1:5]
w = wave.open(wav)
audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language="en", vad_filter=True)
text = " ".join(s.text.strip() for s in segments)
with open(txt, "w") as f:
    f.write(f"VIDEO: {title}\nID: {vid}\nSOURCE: faster-whisper base transcription of audio (YouTube auto-captions were rate-limited)\nWORDS: {len(text.split())}\n\n{text}\n")
print("OK-TR", vid, len(text.split()), "words")
PYEOF
  rm -f "$WORK/${id}.m4a" "$WORK/${id}.wav"
  echo "DONE $id"
  sleep 30
done
echo RETRYDONE
