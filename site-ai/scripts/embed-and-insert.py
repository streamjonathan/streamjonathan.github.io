#!/usr/bin/env python3
"""Embed site-ai/index/chunks.jsonl and insert the vectors into the
jonathanmccallum-posts Vectorize index, via the custom.cloudflare
credential (surrogate — the real token never appears here).

Usage: python3 embed-and-insert.py [--dry-run]
"""
import json
import os
import sys
from pathlib import Path

# cf.py lives in the maintainer's connector folder, next to this repo:
# <workspace>/custom-connectors/custom.cloudflare/bin. Resolve it
# relative to this script, never a hardcoded home path.
sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[3] / "custom-connectors" / "custom.cloudflare" / "bin"),
)
from cf import call  # noqa: E402

ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID")
if not ACCOUNT_ID:
    raise SystemExit("Set CF_ACCOUNT_ID (Cloudflare account id) before running.")
INDEX_NAME = "jonathanmccallum-posts"
EMBED_MODEL = "@cf/baai/bge-m3"
CHUNKS_FILE = Path(__file__).resolve().parent.parent / "index" / "chunks.jsonl"


def main():
    dry_run = "--dry-run" in sys.argv
    chunks = [json.loads(line) for line in CHUNKS_FILE.read_text().splitlines() if line.strip()]
    print(f"chunks to index: {len(chunks)}")
    if dry_run:
        print("Dry run — no API calls made.")
        return 0
    result = call("POST", f"/accounts/{ACCOUNT_ID}/ai/run/{EMBED_MODEL}",
                  body={"text": [c["text"] for c in chunks]})
    vectors = result["result"]["data"]
    assert len(vectors) == len(chunks), f"expected {len(chunks)} embeddings, got {len(vectors)}"
    payload = {"vectors": [
        {"id": c["id"], "values": v, "metadata": {**c.get("metadata", {}), "text": c["text"]}}
        for c, v in zip(chunks, vectors)
    ]}
    inserted = call("POST", f"/accounts/{ACCOUNT_ID}/vectorize/v2/indexes/{INDEX_NAME}/insert",
                    body=payload)
    print(json.dumps(inserted, indent=2)[:800])
    print(f"Done. {len(chunks)} chunks live in the \"{INDEX_NAME}\" index.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
