#!/usr/bin/env python3
"""Upload the recovered jonathanmccallum.com post TEXT files to Google Drive.
Text only (~1 MB) — the 66 MB of images wait until there is Drive space.
Uploads into the mccallumhome 'private' folder (walkbarejg is Editor there).
Run from the main agent (no per-file approval cards that way).
Log: ~/workspace/jonathanmccallum-site/work/drive-backup-upload.log
"""
import subprocess, os, json, time, sys

BASE = "/home/hatch/workspace/jonathanmccallum-site"
CLI = "/opt/hatch/bin/hatch_gws_cli"
PARENT = "1bi8DfTTaVHCP1TrF010tjMpjSziy4bLN"  # mccallumhome "private" folder
LOG = os.path.join(BASE, "work", "drive-backup-upload.log")

def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    with open(LOG, "a") as f:
        f.write(line + "\n")
    print(line, flush=True)

def run(args):
    return subprocess.run(args, capture_output=True, text=True)

log("START text backup upload")
# 1. Create the backup folder inside 'private'
r = run([CLI, "drive", "files", "create", "--params", '{"ignoreDefaultVisibility":true}',
         "--json", json.dumps({"name": "jonathanmccallum.com posts backup - Wayback 2026-11-21",
                               "mimeType": "application/vnd.google-apps.folder",
                               "parents": [PARENT]})])
folder_id = None
try:
    folder_id = json.loads(r.stdout).get("id")
except Exception:
    pass
if not folder_id:
    log(f"FAILED to create folder. stdout={r.stdout[:500]} stderr={r.stderr[:500]}")
    sys.exit(1)
log(f"folder created: {folder_id}")

# 2. Files to upload: all post .md files + index + recovery report
files = []
posts_dir = os.path.join(BASE, "content", "posts")
for name in sorted(os.listdir(posts_dir)):
    if name.endswith(".md"):
        files.append(os.path.join(posts_dir, name))
files.append(os.path.join(BASE, "content", "index.json"))
files.append(os.path.join(BASE, "RECOVERY-REPORT.md"))
log(f"{len(files)} files to upload")

ok, fail = 0, []
for path in files:
    name = os.path.basename(path)
    r = run([CLI, "drive", "+upload", path, "--parent", folder_id, "--name", name])
    if r.returncode == 0:
        ok += 1
    else:
        fail.append(name)
        log(f"FAILED {name}: {r.stderr[:200]}")
    time.sleep(0.3)
    if ok % 50 == 0:
        log(f"progress: {ok} uploaded")

log(f"DONE: {ok} uploaded, {len(fail)} failed: {fail}")
print(f"FOLDER_ID={folder_id}")
