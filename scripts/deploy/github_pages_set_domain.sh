#!/usr/bin/env bash
set -euo pipefail
OWNER="${GITHUB_OWNER:-abidlabs}"
REPO="${GITHUB_REPO:-askyq}"
DOMAIN="${CUSTOM_DOMAIN:-askqadi.org}"
gh api --method PATCH "repos/${OWNER}/${REPO}/pages" \
  -f "cname=${DOMAIN}" \
  -F "https_enforced=true"
