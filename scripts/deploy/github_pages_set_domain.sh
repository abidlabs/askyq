#!/usr/bin/env bash
set -euo pipefail
OWNER="${GITHUB_OWNER:-abidlabs}"
REPO="${GITHUB_REPO:-askyq}"
DOMAIN="${CUSTOM_DOMAIN:-askqadi.org}"
BRANCH="${GITHUB_PAGES_BRANCH:-main}"

if ! gh api "repos/${OWNER}/${REPO}/pages" &>/dev/null; then
  gh api --method POST "repos/${OWNER}/${REPO}/pages" \
    -f build_type=legacy \
    -f source[branch]="${BRANCH}" \
    -f source[path]=/
fi

gh api --method PATCH "repos/${OWNER}/${REPO}/pages" \
  -f "cname=${DOMAIN}" \
  -F "https_enforced=true"
