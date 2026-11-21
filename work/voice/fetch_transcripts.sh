#!/usr/bin/env bash
# Fetch auto-captions for a sample of Jonathan's MAIN channel videos.
set -u
OUT="$HOME/workspace/jonathanmccallum-site/work/voice/transcripts"
mkdir -p "$OUT"
export PATH="$HOME/workspace/venv-whisper/bin:$PATH"
YT="yt-dlp --no-check-certificates --quiet --no-warnings"

IDS=(
SiU9y3X416M 2IbJ8CwQSQI Ps3ZLzixWww LOAuNNf0eVs U9BSyBTn6AY
exnoQUfSQN0 6lj8L5rfrT4 lktNSXNzZGs p5bZ61aLm88 Vzf4ybHWHdA
7q-MvZF04Uc jGC1Jj8nzf4 -0vnp9w5caU NnhTpLnmKqE HZW7mzgzZtU
AI6RxSECKAU l5p-x8vz4l8 _PUk447Xda0 VPgZnq_peLM XOA0zGSzvps
)

for id in "${IDS[@]}"; do
  url="https://www.youtube.com/watch?v=${id}"
  got=""
  for client in web android; do
    if [ "$client" = android ]; then
      extra="--extractor-args youtube:player_client=android"
    else
      extra=""
    fi
    # shellcheck disable=SC2086
    $YT $extra --write-auto-subs --sub-langs en --sub-format vtt --skip-download \
      -o "$OUT/%(id)s.%(ext)s" "$url" 2>/dev/null
    if ls "$OUT/${id}.en.vtt" >/dev/null 2>&1; then got=1; break; fi
    sleep 2
  done
  if [ -n "$got" ]; then echo "OK  $id"; else echo "FAIL $id"; fi
  sleep 3
done

# Convert VTT -> plain text (strip timestamps, tags, dup lines)
python3 - "$OUT" <<'EOF'
import sys, re, os, glob
outdir = sys.argv[1]
for vtt in glob.glob(os.path.join(outdir, "*.en.vtt")):
    vid = os.path.basename(vtt).replace(".en.vtt", "")
    txt_path = os.path.join(outdir, vid + ".txt")
    seen = []
    prev = None
    for line in open(vtt, encoding="utf-8", errors="ignore"):
        line = line.strip()
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        if "-->" in line or re.match(r"^\d+$", line):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\s+", " ", line).strip()
        if line and line != prev:
            seen.append(line)
            prev = line
    open(txt_path, "w", encoding="utf-8").write("\n".join(seen) + "\n")
    print("TXT", vid, len(seen), "lines")
EOF
echo DONE
