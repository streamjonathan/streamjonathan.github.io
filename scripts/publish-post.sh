#!/usr/bin/env bash
# Publish one draft post: flip draft to false, build, commit, push.
# Cloudflare Pages rebuilds from the repo and the post is live in about
# a minute. Usage:
#   scripts/publish-post.sh content/posts/2026-11-19-my-reaction-to-sonreals-new-video.md
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:-}"
if [ -z "$FILE" ]; then echo "Usage: scripts/publish-post.sh <post file>"; exit 1; fi
if [ ! -f "$FILE" ]; then echo "No such file: $FILE"; exit 1; fi
case "$FILE" in
  content/posts/*.md) ;;
  *) echo "Post files live in content/posts/"; exit 1 ;;
esac
if ! grep -q "^draft: true$" "$FILE"; then echo "Already published (no draft: true in $FILE)."; exit 0; fi

sed -i 's/^draft: true$/draft: false/' "$FILE"
if ! npm run build > /tmp/publish-build.log 2>&1; then
  sed -i 's/^draft: false$/draft: true/' "$FILE"
  echo "Build failed — draft flag put back. See /tmp/publish-build.log"; exit 1
fi
git add "$FILE"
git commit -m "Publish: $(basename "$FILE" .md)" --quiet
git push origin main --quiet
echo "Published — live in about a minute."
