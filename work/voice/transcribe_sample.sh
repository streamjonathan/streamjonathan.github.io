#!/usr/bin/env bash
# Transcribe a sample of Jonathan's MAIN channel videos with faster-whisper (base).
# Captions are 429-blocked; audio download via web client works.
set -u
OUT="$HOME/workspace/jonathanmccallum-site/work/voice/transcripts"
WORK="$HOME/workspace/jonathanmccallum-site/work/voice/tmp-audio"
mkdir -p "$OUT" "$WORK"
export PATH="$HOME/workspace/venv-whisper/bin:$PATH"

# id|title
VIDS=(
"2IbJ8CwQSQI|Free will and Jesus"
"LOAuNNf0eVs|The Magicians Nephew that new Narnia Movie"
"U9BSyBTn6AY|Narnia and What I'd Like Everyone To Know"
"exnoQUfSQN0|My Theology Influenced by C S Lewis So Far (2025)"
"Ps3ZLzixWww|Suffering, Surfing and Jesus"
"lktNSXNzZGs|Back to Surfing after Panic Attack in Ocean"
"7q-MvZF04Uc|Why I Believe What The First Japanese Christians Believed"
"-0vnp9w5caU|Paul, 90s, Modern Music, Poetry and Philosophy To Share Jesus"
"HZW7mzgzZtU|Fishing, SNES, Faith and Memories of the 1990s"
"AI6RxSECKAU|Growing Up, High School in Sydney 2000"
"_PUk447Xda0|Heaven is Possible Because of Jesus"
"l5p-x8vz4l8|How Jesus Saved Me During My Teenage Years"
)

for entry in "${VIDS[@]}"; do
  id="${entry%%|*}"; title="${entry#*|}"
  txt="$OUT/${id}.txt"
  if [ -s "$txt" ]; then echo "SKIP $id (have transcript)"; continue; fi
  m4a="$WORK/${id}.m4a"; wav="$WORK/${id}.wav"
  if ! yt-dlp --no-check-certificates -f 'ba[ext=m4a]/ba' --no-playlist -o "$m4a" \
      "https://www.youtube.com/watch?v=${id}" >/dev/null 2>&1; then
    echo "FAIL-DL $id"; sleep 5; continue
  fi
  ffmpeg -y -v error -i "$m4a" -ar 16000 -ac 1 "$wav" || { echo "FAIL-FF $id"; sleep 5; continue; }
  ~/workspace/venv-whisper/bin/python - "$wav" "$txt" "$id" "$title" <<'PYEOF' || echo "FAIL-TR $id"
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
  rm -f "$m4a" "$wav"
  echo "DONE $id"
  sleep 5
done
echo ALLDONE
