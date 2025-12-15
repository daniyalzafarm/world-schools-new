# Docker Configuration for World Schools Monorepo

## Overview

This document explains the Docker setup for the World Schools monorepo, including build contexts, .dockerignore configuration, and best practices.

## Monorepo Structure

```
world-schools/
├── .dockerignore          # Single file for ALL Docker builds
├── apps/
│   ├── wc-nest-api/
│   │   └── Dockerfile     # Backend API (NestJS)
│   ├── wc-provider/
│   │   └── Dockerfile     # Provider portal (Next.js)
│   ├── wc-booking/
│   │   └── Dockerfile     # Booking portal (Next.js)
│   └── wc-superadmin/
│       └── Dockerfile     # Super admin portal (Next.js)
└── packages/
    └── wc-utils/          # Shared utilities
```

## Build Context

**All Docker builds use the monorepo root as the build context:**

```bash
# Example from GitHub Actions workflow
docker build -f apps/wc-nest-api/Dockerfile .
             ↑                              ↑
             Dockerfile location            Build context (monorepo root)
```

### Why Monorepo Root?

✅ **Access to shared packages** - All apps can access `packages/wc-utils`  
✅ **Consistent builds** - Same context for all apps  
✅ **Nx integration** - Nx commands work correctly  
✅ **Single .dockerignore** - One file controls all builds  

## .dockerignore Configuration

### Location

**Single file at monorepo root**: `world-schools/.dockerignore`

### Scope

This file applies to **ALL** Docker builds in the monorepo:
- `apps/wc-nest-api/Dockerfile`
- `apps/wc-provider/Dockerfile`
- `apps/wc-booking/Dockerfile`
- `apps/wc-superadmin/Dockerfile`

### How It Works

When you run:
```bash
docker build -f apps/wc-nest-api/Dockerfile .
```

Docker:
1. Looks for `.dockerignore` in the build context (`.` = monorepo root)
2. Finds `world-schools/.dockerignore`
3. Applies exclusions to the build context
4. Sends filtered context to Docker daemon

### What's Excluded

The `.dockerignore` file excludes:

- **Version control**: `.git`, `.github`, `.gitignore`
- **Dependencies**: `node_modules` (installed fresh via `npm ci`)
- **Build outputs**: `dist`, `.next`, `out` (generated during build)
- **Nx cache**: `.nx/cache`
- **Tests**: `*.test.ts`, `*.spec.ts`, `coverage/`
- **IDE files**: `.vscode`, `.idea`, `.DS_Store`
- **Environment files**: `.env*` (injected at runtime)
- **Documentation**: `*.md` (except README.md)
- **Logs**: `*.log`

### What's Included

The `.dockerignore` file **does NOT** exclude:

- ✅ Source code (`apps/`, `packages/`)
- ✅ Configuration files (`nx.json`, `tsconfig.*.json`, `webpack.config.js`)
- ✅ Package files (`package.json`, `package-lock.json`)
- ✅ Prisma files (`schema.prisma`, `migrations/`, `seed.prod.js`)
- ✅ Startup scripts (`start.sh`)

## Best Practices

### 1. Don't Create Per-App .dockerignore Files

❌ **Don't do this:**
```
apps/wc-nest-api/.dockerignore
apps/wc-provider/.dockerignore
apps/wc-booking/.dockerignore
```

✅ **Do this:**
```
world-schools/.dockerignore  # Single file at root
```

**Why?** All builds use the same context, so multiple `.dockerignore` files would be confusing and error-prone.

### 2. Exclude Build Artifacts

Always exclude directories that are generated during the Docker build:

```dockerignore
dist
**/dist
node_modules
**/node_modules
```

**Why?** These are regenerated inside the container, so including them wastes build context transfer time.

### 3. Include Source Files

Never exclude source code or configuration files needed by the build:

```dockerignore
# ❌ DON'T exclude these
# apps/
# packages/
# *.json
# *.ts
```

### 4. Test Build Context Size

Check the build context size before and after adding `.dockerignore`:

```bash
# Build with progress output
docker build -f apps/wc-nest-api/Dockerfile . --progress=plain 2>&1 | grep "transferring context"

# Example output:
# transferring context: 2.5MB (before .dockerignore)
# transferring context: 500KB (after .dockerignore)
```

## Troubleshooting

### Build Fails with "File Not Found"

**Problem**: Docker can't find a file during build

**Solution**: Check if the file is excluded in `.dockerignore`

```bash
# Test what files are included in build context
docker build -f apps/wc-nest-api/Dockerfile . --no-cache 2>&1 | grep "COPY"
```

### Build Context Too Large

**Problem**: Build takes too long to transfer context

**Solution**: Add more exclusions to `.dockerignore`

```dockerignore
# Add specific directories to exclude
tmp/
logs/
*.log
```

### Different Apps Need Different Files

**Problem**: One app needs a file that another app should exclude

**Solution**: Since all apps use the same context, include the file and let individual Dockerfiles decide what to copy:

```dockerfile
# In Dockerfile, be selective about what you copy
COPY apps/wc-nest-api ./apps/wc-nest-api
COPY packages/wc-utils ./packages/wc-utils
# Don't copy everything with COPY . .
```

## FAQ

### Q: Can I have multiple .dockerignore files?

**A**: Technically yes, but **not recommended** for this monorepo. Docker only uses the `.dockerignore` in the build context directory. Since all builds use the monorepo root as context, only the root `.dockerignore` is used.

### Q: Should .dockerignore be committed to version control?

**A**: **Yes!** The `.dockerignore` file should be committed to ensure consistent builds across all environments (local, CI/CD, production).

### Q: What if I need app-specific exclusions?

**A**: Use selective `COPY` commands in the Dockerfile instead of excluding files in `.dockerignore`:

```dockerfile
# Copy only what this app needs
COPY apps/wc-nest-api ./apps/wc-nest-api
COPY packages/wc-utils ./packages/wc-utils
COPY package*.json ./
COPY nx.json ./
```

### Q: How do I verify what's being excluded?

**A**: Build with `--progress=plain` and check the output:

```bash
docker build -f apps/wc-nest-api/Dockerfile . --progress=plain --no-cache
```

## Seed File Bundling

The wc-nest-api application uses **esbuild** to bundle the TypeScript seed file for production:

### How It Works

1. **Development**: `seed.ts` runs with `tsx` (TypeScript executor)
2. **Production**: During Docker build, esbuild bundles `seed.ts` to JavaScript
3. **Result**: Single source of truth, no manual sync needed

### Build Command

```dockerfile
RUN npx esbuild apps/wc-nest-api/prisma/seed.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=dist/apps/wc-nest-api/prisma/seed.js \
  --external:@prisma/client \
  --external:@prisma/adapter-pg \
  --external:bcryptjs \
  --external:pg \
  --external:pg-pool
```

### Why esbuild?

- ⚡ **Fast**: Bundles in ~2-5 seconds
- 📦 **Small**: Creates optimized bundles
- 🔧 **Simple**: One command, no configuration files
- 🎯 **Reliable**: Handles all imports and dependencies automatically

## Related Documentation

- [Prisma Configuration](./apps/wc-nest-api/prisma/README.md)
- [GitHub Actions Workflows](./.github/workflows/wc-staging-deploy.yml)

