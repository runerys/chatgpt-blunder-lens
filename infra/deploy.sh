#!/usr/bin/env bash
# Local deploy script — use this if you cannot create a service principal.
#
# Requires:
#   - Azure CLI installed and logged in (az login)
#
# Usage:
#   ./infra/deploy.sh [tag]
#
# If no tag is given, uses sha-<short HEAD> matching the CI convention.
# The GHCR package is public — no token needed.

set -euo pipefail

RG="${RG:-blunder-lens-rg}"
APP="${APP:-blunder-lens}"
REPO="${REPO:-runerys/chatgpt-blunder-lens}"
# Use explicit tag if provided, otherwise sha-<short> matching CI convention.
# Fall back to 'latest' if git is unavailable.
TAG="${1:-sha-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
IMAGE="ghcr.io/${REPO}:${TAG}"

FQDN=$(az containerapp show \
  --name "$APP" --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)
PUBLIC_BASE_URL="https://${FQDN}"

echo "==> Deploying $IMAGE"
echo "    App:  $APP  ($RG)"
echo "    URL:  $PUBLIC_BASE_URL"
echo ""

# GHCR package is public — no registry credentials needed.
# Do NOT call 'az containerapp registry set'; empty credentials cause ImagePullBackOff.
az containerapp update \
  --name "$APP" \
  --resource-group "$RG" \
  --image "$IMAGE" \
  --min-replicas 0 \
  --max-replicas 1 \
  --set-env-vars "PUBLIC_BASE_URL=${PUBLIC_BASE_URL}" \
  --output none

echo "Done. Live at $PUBLIC_BASE_URL"
