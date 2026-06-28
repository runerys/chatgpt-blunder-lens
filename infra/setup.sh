#!/usr/bin/env bash
# One-time Azure setup for blunder-lens.
# Run this script once, then add the printed values as GitHub repository secrets.
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - jq installed (for pretty-printing)
#
# Usage:
#   chmod +x infra/setup.sh
#   ./infra/setup.sh

set -euo pipefail

# ── Config — edit these if you want different names ───────────────────────────
LOCATION="${LOCATION:-westeurope}"
RG="${RG:-blunder-lens-rg}"
ENV="${ENV:-blunder-lens-env}"
APP="${APP:-blunder-lens}"
SP_NAME="${SP_NAME:-blunder-lens-deploy}"
# ─────────────────────────────────────────────────────────────────────────────

echo "==> Using subscription: $(az account show --query name -o tsv)"
echo ""

echo "==> Creating resource group: $RG"
az group create --name "$RG" --location "$LOCATION" --output none

echo "==> Creating Container Apps environment: $ENV"
az containerapp env create \
  --name "$ENV" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --output none

echo "==> Creating container app: $APP (placeholder image)"
az containerapp create \
  --name "$APP" \
  --resource-group "$RG" \
  --environment "$ENV" \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 8787 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 1 \
  --output none

FQDN=$(az containerapp show \
  --name "$APP" \
  --resource-group "$RG" \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

PUBLIC_BASE_URL="https://${FQDN}"

echo "==> App URL: $PUBLIC_BASE_URL"
echo ""

SUB_ID=$(az account show --query id -o tsv)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Azure resources are ready."
echo "  Public URL: $PUBLIC_BASE_URL"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Add these GitHub repository secrets"
echo "   (Settings → Secrets and variables → Actions → New secret):"
echo ""
echo "   PUBLIC_BASE_URL → $PUBLIC_BASE_URL"
echo "   (GHCR package is public — no GHCR_TOKEN needed)"
echo ""
echo "2. Service principal for automated deploy (requires Entra admin):"
echo ""
echo "   If you have access, run:"
echo ""
echo "   az ad sp create-for-rbac \\"
echo "     --name $SP_NAME --role contributor \\"
echo "     --scopes /subscriptions/${SUB_ID}/resourceGroups/${RG} \\"
echo "     --sdk-auth"
echo ""
echo "   Then add the JSON output as AZURE_CREDENTIALS, plus:"
echo "     AZURE_RESOURCE_GROUP     = $RG"
echo "     AZURE_CONTAINER_APP_NAME = $APP"
echo ""
echo "   If you do NOT have Entra access, deploy manually instead:"
echo "     ./infra/deploy.sh"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "Done."
