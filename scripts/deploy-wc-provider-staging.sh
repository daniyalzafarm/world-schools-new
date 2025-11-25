#!/bin/bash

# Deploy wc-provider to Azure Container Apps (Staging)
# Usage: ./deploy-wc-provider-staging.sh [VERSION] [BUILD_ENV]
# Example: ./deploy-wc-provider-staging.sh 1.0.0 "NEXT_PUBLIC_CUSTOM_VAR=value"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source shared configuration
source "${SCRIPT_DIR}/config-staging.sh"

# Application-specific configuration
APP_NAME="wc-provider"
IMAGE_NAME="wc-provider"
CONTAINER_APP_NAME="${CA_PROVIDER_NAME}"
DOCKERFILE_PATH="apps/wc-provider/Dockerfile"

# Parse command-line arguments
VERSION="${1:-manual-$(date +%Y%m%d-%H%M%S)}"
CUSTOM_BUILD_ENV="${2:-}"

# Print deployment information
echo "=========================================="
echo "Deploying wc-provider to Staging"
echo "=========================================="
print_info "Version: ${VERSION}"
print_info "Container App: ${CONTAINER_APP_NAME}"
print_info "Resource Group: ${AZURE_RESOURCE_GROUP}"
echo ""

# Validate prerequisites
validate_prerequisites

# Get backend API URL
print_info "Getting backend API URL..."
API_URL=$(get_api_url)
print_success "API URL: https://${API_URL}"

# Build environment variables for Next.js
# These are NEXT_PUBLIC_* variables that will be baked into the build
BUILD_ENV="NEXT_PUBLIC_API_BASE_URL=https://${API_URL} NEXT_PUBLIC_AUTH_USING_REQUEST=false NEXT_PUBLIC_APP_VERSION=${VERSION}"

# Append custom build environment variables if provided
if [ -n "$CUSTOM_BUILD_ENV" ]; then
  BUILD_ENV="${BUILD_ENV} ${CUSTOM_BUILD_ENV}"
  print_info "Custom build environment variables added"
fi

print_info "Build environment: ${BUILD_ENV}"
echo ""

# Login to Azure Container Registry
acr_login

# Build Docker image
# print_info "Building Docker image for ${APP_NAME}..."
# cd "${SCRIPT_DIR}/.." || exit 1

# docker build --platform=linux/amd64 \
#   --build-arg BUILD_ENV="${BUILD_ENV}" \
#   -t ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${VERSION} \
#   -t ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest \
#   -f ${DOCKERFILE_PATH} \
#   .

# if [ $? -eq 0 ]; then
#   print_success "Docker image built successfully"
# else
#   print_error "Docker build failed"
#   exit 1
# fi

# # Push Docker image to ACR
# print_info "Pushing Docker image to Azure Container Registry..."
# docker push ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${VERSION}
# docker push ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest

# if [ $? -eq 0 ]; then
#   print_success "Docker image pushed successfully"
# else
#   print_error "Docker push failed"
#   exit 1
# fi

# Get ACR credentials
get_acr_credentials

# # Deploy or update Container App
# print_info "Deploying to Azure Container Apps..."

# # Try to update existing Container App first
# az containerapp update \
#   --name ${CONTAINER_APP_NAME} \
#   --resource-group ${AZURE_RESOURCE_GROUP} \
#   --image ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${VERSION} \
#   --set-env-vars \
#     NODE_ENV=production \
#     PORT=${CONTAINER_PORT} \
#     APP_VERSION=${VERSION} \
#   > /dev/null 2>&1

# if [ $? -eq 0 ]; then
#   print_success "Container App updated successfully"
# else
#   # If update fails, try to create new Container App
#   print_warning "Container App does not exist, creating new one..."
  
  az containerapp create \
    --name ${CONTAINER_APP_NAME} \
    --resource-group ${AZURE_RESOURCE_GROUP} \
    --environment ${CONTAINER_APP_ENV} \
    --image ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${VERSION} \
    --registry-server ${ACR_NAME}.azurecr.io \
    --registry-username ${ACR_USERNAME} \
    --registry-password ${ACR_PASSWORD} \
    --target-port ${CONTAINER_PORT} \
    --ingress external \
    --min-replicas ${MIN_REPLICAS} \
    --max-replicas ${MAX_REPLICAS} \
    --cpu ${CPU} \
    --memory ${MEMORY} \
    --env-vars \
      NODE_ENV=production \
      PORT=${CONTAINER_PORT} \
      APP_VERSION=${VERSION}
  
#   if [ $? -eq 0 ]; then
#     print_success "Container App created successfully"
#   else
#     print_error "Container App creation failed"
#     exit 1
#   fi
# fi

# Get application URL
print_info "Getting application URL..."
APP_URL=$(get_app_url ${CONTAINER_APP_NAME})

# Print deployment summary
echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
print_success "Application: ${APP_NAME}"
print_success "Version: ${VERSION}"
print_success "URL: https://${APP_URL}"
echo "=========================================="
echo ""

print_success "Deployment completed successfully!"

