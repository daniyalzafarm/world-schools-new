#!/bin/bash

# Shared Configuration for World Camps Staging Environment
# This file contains common variables used across all deployment scripts
# Source this file in your deployment scripts: source "$(dirname "$0")/config-staging.sh"

# Exit on error
set -e

# Azure Resource Configuration
export AZURE_RESOURCE_GROUP="rg-wc-staging-ch-north"
export CONTAINER_APP_ENV="cae-wc-stg"
export ACR_NAME="acrwc"
export AZURE_LOCATION="switzerlandnorth"
export SHARED_RESOURCE_GROUP="rg-wc-infra-shared-ch-north"

# Container App Names
export CA_API_NAME="ca-api-wc-stg"
export CA_SUPERADMIN_NAME="ca-admin-wc-stg"
export CA_PROVIDER_NAME="ca-provider-wc-stg"
export CA_BOOKING_NAME="ca-booking-wc-stg"

# Container Configuration
export CONTAINER_PORT=3000
export MIN_REPLICAS=1
export MAX_REPLICAS=3
export CPU="0.25"
export MEMORY="0.5Gi"

# Get backend API URL (needed for NEXT_PUBLIC_API_BASE_URL)
get_api_url() {
  local api_url
  api_url=$(az containerapp show \
    --name ${CA_API_NAME} \
    --resource-group ${AZURE_RESOURCE_GROUP} \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "${CA_API_NAME}.azurecontainerapps.io")
  echo "$api_url"
}

# Get ACR credentials
get_acr_credentials() {
  export ACR_USERNAME=$(az acr credential show --name ${ACR_NAME} --resource-group ${SHARED_RESOURCE_GROUP} --query username -o tsv)
  export ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --resource-group ${SHARED_RESOURCE_GROUP} --query passwords[0].value -o tsv)
}

# Login to Azure Container Registry
acr_login() {
  echo "Logging in to Azure Container Registry..."
  az acr login --name ${ACR_NAME}
}

# Get the application URL after deployment
get_app_url() {
  local app_name=$1
  local app_url
  app_url=$(az containerapp show \
    --name ${app_name} \
    --resource-group ${AZURE_RESOURCE_GROUP} \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null)
  echo "$app_url"
}

# Update backend CORS configuration
update_backend_cors() {
  local admin_url=$1
  local provider_url=$2
  local booking_url=$3
  
  echo "Updating backend CORS configuration..."
  az containerapp update \
    --name ${CA_API_NAME} \
    --resource-group ${AZURE_RESOURCE_GROUP} \
    --set-env-vars \
      CORS_ORIGIN="https://${admin_url},https://${provider_url},https://${booking_url}" \
    > /dev/null 2>&1 || echo "Warning: Could not update CORS configuration"
}

# Print colored output
print_success() {
  echo -e "\033[0;32m✅ $1\033[0m"
}

print_error() {
  echo -e "\033[0;31m❌ $1\033[0m"
}

print_info() {
  echo -e "\033[0;34mℹ️  $1\033[0m"
}

print_warning() {
  echo -e "\033[0;33m⚠️  $1\033[0m"
}

# Validate Azure CLI is installed and logged in
validate_azure_cli() {
  if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
  fi
  
  if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure. Please run 'az login' first."
    exit 1
  fi
  
  print_success "Azure CLI validated"
}

# Validate Docker is installed
validate_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
  fi
  
  print_success "Docker validated"
}

# Run all validations
validate_prerequisites() {
  print_info "Validating prerequisites..."
  validate_azure_cli
  validate_docker
}

