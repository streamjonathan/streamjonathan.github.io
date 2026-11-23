#!/usr/bin/env python3
"""Build a draft article from an approved artist interview.

This is the "auto-build" step for /share-your-story/ — it turns a
screened interview submission into a draft article markdown file, so
nobody retypes the answers.

TRIGGER (exact): Jonathan screens the interview in the [INTERVIEW]
digest email (and the DM, for Google sign-ins) and tells Bobby it is
approved. Bobby then runs, from any checkout of the site repo:

    python3 scripts/build-interview-draft.py interview-<ts>-<rand>

WHAT IT DOES:
1. Fetches the submission from the NOTES KV namespace (cf.py get).
2. Refuses unless the record exists and status is "pending" (already
   drafted interviews are never rebuilt).
3. For Google sign-ins the handle is NOT verified by the sign-in alone,
   so it refuses unless --confirm-dm is passed — meaning Jonathan (or
   Bobby on his word) has checked the DM from the linked account and
   the code/handle matches. Instagram sign-ins need no flag: the
   sign-in itself verified the handle.
4. Writes content/posts/<date>-<slug>.md with draft: true — a DRAFT
   only. Eleventy gives drafts no permalink, so nothing is published.
5. Marks the KV record status "drafted" (cf.py put) so it cannot be
   built twice.

WHAT IT DOES NOT DO: it does not commit, push, deploy, or publish.
Bobby reviews the file, commits it on a branch, and shows Jonathan a
preview. The draft only goes live when Jonathan says so (draft: false).
"""
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CF_DIR = os.path.expanduser("~/workspace/custom-connectors/custom.cloudflare")
CF_PY = os.path.join(CF_DIR, "bin", "cf.py")
ACCOUNT = "d782d5b28928c6c4187d8d276815cd6d"
NAMESPACE = "7ce6df1904044c79b5e797731f5bfe4b"

QUESTIONS = {
    "q1": "Tell us about yourself and the music or art you make. What do you love making, and why?",
    "q2": "What would you like the world to know about your faith in Jesus — and how does it shape what you create?",
    "q3": "Tell us a story from your life. It doesn't have to be deep — it can be funny, or just interesting. What's a moment that says something about who you are?",
}


def cf(*args):
    r = subprocess.run(
        ["python3", CF_PY, *args],
        cwd=CF_DIR, capture_output=True, text=True, timeout=120,
    )
    if r.returncode != 0:
        raise RuntimeError(f"cf.py {' '.join(args[:2])} failed: {r.stderr.strip()[:300]}")
    return r.stdout


def slugify(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return slug or "interview"


def main():
    args = sys.argv[1:]
    confirm_dm = "--confirm-dm" in args
    args = [a for a in args if a != "--confirm-dm"]
    run_date = date.today().isoformat()
    for a in list(args):
        if a.startswith("--date="):
            run_date = a.split("=", 1)[1]
            args.remove(a)
    if len(args) != 1 or not args[0].startswith("interview-"):
        print(__doc__)
        print("usage: python3 scripts/build-interview-draft.py interview-<ts>-<rand> [--confirm-dm] [--date=YYYY-MM-DD]")
        return 2
    key = args[0]
    raw = cf("get", f"/accounts/{ACCOUNT}/storage/kv/namespaces/{NAMESPACE}/values/{key}")
    try:
        rec = json.loads(raw)
    except json.JSONDecodeError:
        print(f"KV key {key} did not return a JSON interview record.")
        return 1
    if not isinstance(rec, dict) or not rec.get("name") or not rec.get("q1"):
        print(f"KV key {key} is not an interview submission.")
        return 1
    if rec.get("status") != "pending":
        print(f"Refusing: status is {rec.get('status')!r}, not 'pending' (already handled?).")
        return 1
    if not rec.get("handleVerified") and not confirm_dm:
        print("Refusing: this interview came in via Google sign-in, so the social handle")
        print("is only verified by the DM. Re-run with --confirm-dm once Jonathan has")
        print("checked the DM from the linked account and it matches.")
        return 1
    slug = slugify(rec["name"])
    path = os.path.join(REPO, "content", "posts", f"{run_date}-{slug}.md")
    if os.path.exists(path):
        print(f"Refusing: {path} already exists.")
        return 1
    name = rec["name"]
    social = rec.get("social", "")
    lines = [
        "---",
        f'title: "A conversation with {name}"',
        f"date: {run_date}",
        f"slug: {slug}",
        "draft: true",
    ]
    if social:
        lines.append(f"interview_social: {social}")
    lines.append("---")
    lines.append("")
    lines.append(f"[{name}]({social})" if social else name)
    lines.append(" shared their story through the Share your story page.")
    lines.append("")
    for q in ("q1", "q2", "q3"):
        lines.append(f"## {QUESTIONS[q]}")
        lines.append("")
        lines.append(rec[q].strip())
        lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    rec["status"] = "drafted"
    rec["draftFile"] = f"content/posts/{run_date}-{slug}.md"
    cf("put", f"/accounts/{ACCOUNT}/storage/kv/namespaces/{NAMESPACE}/values/{key}", json.dumps(rec))
    print(f"Draft written: {path}")
    print("KV record marked 'drafted'. Next: review the file, commit it on a branch,")
    print("show Jonathan a preview. It goes live only when he says so (draft: false).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
