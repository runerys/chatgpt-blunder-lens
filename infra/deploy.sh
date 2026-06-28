#!/usr/bin/env bash
# Local deploy script — use this if you cannot create a service principal.
#
# Requires:
#   - Azure CLI installed and logged in (az login)
#   - GitHub CLI installed and logged in (gh auth login), OR set GHCR_TOKEN env var
#
# Usage:
#   ./infra/deploy.sh [git-sha]
#
# If no SHA is given, uses the current HEAD commit.

set -euo pipefail

RG="${RG:-blunder-lens-rg}"
APP="${APP:-blunder-lens}"
REPO="${REPO:-runerys/chatgpt-blunder-lens}"
SHA="${1:-$(git rev-parse HEAD)}"
IMAGE="ghcr.io/${REPO}:${SHA}"

# Resolve GHCR_TOKEN — prefer env var, fall back to gh CLI
if [[ -z "${GHCR_TOKEN:-}" ]]; then
  if command -v gh &>/dev/null; then
    GHCR_TOKEN=$(gh auth token)
  else
    echo "ERROR: Set GHCR_TOKEN or install GitHub CLI (gh)." >&2
    exit 1
  fi
fi

GITHUB_USER=$(gh api user --jq .login 2>/dev/null || echo "${GITHUB_USER:-}")
if [[ -z "$GITHUB_USER" ]]; then
  echo "ERROR: Could not determine GitHub username. Set GITHUB_USER env var." >&2
  exit 1
fi

PUBLIC_BASE_URL=$(az containerapp show \
  --name "$APP" --resource-group "$RG" \
  --query "\"https://\"+ properties.configuration.ingress.fqdn" \
  -o tsv)

echo "==> Deploying $IMAGE"
echo "    App:  $APP  ($RG)"
echo "    URL:  $PUBLIC_BASE_URL"
echo ""

az containerapp update \
  --name "$APP" \
  --resource-group "$RG" \
  --image "$IMAGE" \
  --set-env-vars "PUBLIC_BASE_URL=${PUBLIC_BASE_URL}" \
  --registry-server ghcr.io \
  --registry-username "$GITHUB_USER" \
  --registry-password "$GHCR_TOKEN" \
  --output none

echo "Done. Live at $PUBLIC_BASE_URL"
