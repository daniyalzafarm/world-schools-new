# World Camps Deployment Quick Start

## Prerequisites Checklist

- [ ] Azure resources created (see `AZURE_SETUP_WC_STAGING.md`)
- [ ] GitHub secrets configured
- [ ] Database is accessible
- [ ] Container Registry is set up

## Deploying a New Version

### 1. Prepare Your Code

Ensure all changes are committed and pushed to the main branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### 2. Create and Push a Version Tag

```bash
# Create a tag with semantic versioning
git tag wc-v1.0.0

# Push the tag to trigger deployment
git push origin wc-v1.0.0
```

**Tag Format**: `wc-v<MAJOR>.<MINOR>.<PATCH>`
- Example: `wc-v1.0.0`, `wc-v1.2.3`, `wc-v2.0.0-beta`

### 3. Monitor Deployment

1. Go to GitHub Actions: `https://github.com/<your-org>/<your-repo>/actions`
2. Find the workflow run for your tag
3. Monitor the progress of each job:
   - Extract Version
   - Build and Deploy API
   - Build and Deploy Superadmin
   - Build and Deploy Provider
   - Build and Deploy Booking

### 4. Verify Deployment

After deployment completes:

#### Backend API
```bash
# Check if API is responding
curl https://ca-api-wc-stg.azurecontainerapps.io/

# Check API docs
open https://ca-api-wc-stg.azurecontainerapps.io/docs
```

#### Frontend Apps
- **Superadmin**: `https://swa-admin-wc-stg.azurestaticapps.net`
- **Provider**: `https://swa-provider-wc-stg.azurestaticapps.net`
- **Booking**: `https://swa-booking-wc-stg.azurestaticapps.net`

Check that:
- [ ] Apps load correctly
- [ ] Version number is displayed (check sidebar or user menu)
- [ ] Authentication works
- [ ] API calls are successful

## Common Deployment Scenarios

### Hotfix Deployment

```bash
# Create a patch version
git tag wc-v1.0.1
git push origin wc-v1.0.1
```

### Feature Release

```bash
# Create a minor version
git tag wc-v1.1.0
git push origin wc-v1.1.0
```

### Major Release

```bash
# Create a major version
git tag wc-v2.0.0
git push origin wc-v2.0.0
```

## Troubleshooting

### Deployment Failed

1. Check GitHub Actions logs for error details
2. Common issues:
   - Missing GitHub secrets
   - Azure credentials expired
   - Build errors in code
   - Docker build failures

### Backend Not Starting

```bash
# Check container logs
az containerapp logs show \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north \
  --follow

# Common issues:
# - Database connection failed
# - Prisma migrations failed
# - Missing environment variables
```

### Frontend Not Loading

1. Check Static Web App deployment status in Azure Portal
2. Check browser console for errors
3. Verify API URL is correct
4. Check CORS configuration

### Version Not Displaying

- Ensure `NEXT_PUBLIC_APP_VERSION` was set during build
- Check that config files are importing the version correctly
- Clear browser cache and reload

## Rolling Back

### Rollback Backend

```bash
# Deploy previous version (image from shared ACR)
az containerapp update \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north \
  --image acrwc.azurecr.io/wc-nest-api:v1.0.0
```

### Rollback Frontend

Re-run the GitHub Actions workflow for the previous tag:
1. Go to Actions tab
2. Select "WC Staging Deployment" workflow
3. Click "Run workflow"
4. Select the previous tag

## Environment Variables Reference

### Backend (Container App)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Access token secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `NODE_ENV` - Set to `production`
- `PORT` - Application port (3000)
- `CORS_ORIGIN` - Allowed origins (comma-separated)
- `APP_VERSION` - Automatically set by CI/CD

### Frontend (Build Time)
- `NEXT_PUBLIC_API_BASE_URL` - API base URL
- `NEXT_PUBLIC_AUTH_USING_REQUEST` - Auth mode (false for cookies)
- `NEXT_PUBLIC_APP_VERSION` - Version number

## Monitoring

### Application Insights (if configured)
- Monitor API performance
- Track errors and exceptions
- View request metrics

### Container App Metrics
```bash
# View metrics in Azure Portal
az containerapp show \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north
```

### Database Monitoring
```bash
# Check database connections
az postgres flexible-server show \
  --resource-group rg-wc-staging-ch-north \
  --name pg-db-wc-stg
```

## Best Practices

1. **Always test locally before deploying**
2. **Use semantic versioning** (MAJOR.MINOR.PATCH)
3. **Tag releases from main branch** only
4. **Monitor deployments** until completion
5. **Verify all apps** after deployment
6. **Keep deployment documentation** updated
7. **Communicate deployments** to the team

## Support

For issues or questions:
1. Check deployment logs in GitHub Actions
2. Review Azure resource logs
3. Consult `DEPLOYMENT_WC_STAGING.md` for detailed information
4. Contact DevOps team if needed

