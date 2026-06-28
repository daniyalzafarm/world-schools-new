# Available Commands

This document lists all available commands for the applications in this monorepo. All commands should be run from the **monorepo root directory** (`world-schools/`) unless otherwise specified.

---

## Applications Overview

This monorepo contains **5 applications**:

| Application | Type | Path | Description |
|------------|------|------|-------------|
| **schoolable-web** | Next.js | `apps/schoolable-web/` | Modern school management platform |
| **wc-booking** | Next.js | `apps/wc-booking/` | World Schools booking application |
| **wc-provider** | Next.js | `apps/wc-provider/` | World Schools provider portal |
| **wc-superadmin** | Next.js | `apps/wc-superadmin/` | World Schools super admin dashboard |
| **wc-nest-api** | NestJS API | `apps/wc-nest-api/` | Backend API with authentication and RBAC |

---

## Table of Contents

1. [Next.js Applications](#nextjs-applications)
   - [schoolable-web](#1-schoolable-web)
   - [wc-booking](#2-wc-booking)
   - [wc-provider](#3-wc-provider)
   - [wc-superadmin](#4-wc-superadmin)
2. [NestJS API Applications](#nestjs-api-applications)
   - [wc-nest-api](#5-wc-nest-api)
3. [Global Commands](#global-commands-all-applications)

---

## Next.js Applications

### 1. `schoolable-web`

**Path**: `apps/schoolable-web/`
**Type**: Next.js Application
**Description**: Modern school management platform

#### Application Running Commands

```bash
# Start development server with hot reload
nx dev schoolable-web

# Build for production
nx build schoolable-web

# Start production server (after building)
nx start schoolable-web

# Serve static build
nx serve-static schoolable-web
```

### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint schoolable-web

# Run ESLint and automatically fix issues
nx lint schoolable-web --fix

# Check code formatting with Prettier
nx format:check schoolable-web

# Format code with Prettier
nx format schoolable-web

# Run lint with auto-fix and format together
nx lint:fix schoolable-web
```

### Testing Commands

```bash
# Run unit tests
nx test schoolable-web

# Run tests in watch mode
nx test schoolable-web --watch

# Run tests with coverage
nx test schoolable-web --coverage
```

#### Type Checking

```bash
# Run TypeScript type checking
nx typecheck schoolable-web
```

---

### 2. `wc-booking`

**Path**: `apps/wc-booking/`
**Type**: Next.js Application
**Description**: World Schools booking application

#### Application Running Commands

```bash
# Start development server with hot reload
nx dev wc-booking

# Build for production
nx build wc-booking

# Start production server (after building)
nx start wc-booking

# Serve static build
nx serve-static wc-booking
```

#### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint wc-booking

# Run ESLint and automatically fix issues
nx lint wc-booking --fix
```

#### Testing Commands

```bash
# Run unit tests
nx test wc-booking

# Run tests in watch mode
nx test wc-booking --watch

# Run tests with coverage
nx test wc-booking --coverage
```

#### Type Checking

```bash
# Run TypeScript type checking
nx typecheck wc-booking
```

---

### 3. `wc-provider`

**Path**: `apps/wc-provider/`
**Type**: Next.js Application
**Description**: World Schools provider portal

#### Application Running Commands

```bash
# Start development server with hot reload
nx dev wc-provider

# Build for production
nx build wc-provider

# Start production server (after building)
nx start wc-provider

# Serve static build
nx serve-static wc-provider
```

#### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint wc-provider

# Run ESLint and automatically fix issues
nx lint wc-provider --fix
```

#### Testing Commands

```bash
# Run unit tests
nx test wc-provider

# Run tests in watch mode
nx test wc-provider --watch

# Run tests with coverage
nx test wc-provider --coverage
```

#### Type Checking

```bash
# Run TypeScript type checking
nx typecheck wc-provider
```

---

### 4. `wc-superadmin`

**Path**: `apps/wc-superadmin/`
**Type**: Next.js Application
**Description**: World Schools super admin dashboard

#### Application Running Commands

```bash
# Start development server with hot reload
nx dev wc-superadmin

# Build for production
nx build wc-superadmin

# Start production server (after building)
nx start wc-superadmin

# Serve static build
nx serve-static wc-superadmin
```

#### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint wc-superadmin

# Run ESLint and automatically fix issues
nx lint wc-superadmin --fix
```

#### Testing Commands

```bash
# Run unit tests
nx test wc-superadmin

# Run tests in watch mode
nx test wc-superadmin --watch

# Run tests with coverage
nx test wc-superadmin --coverage
```

#### Type Checking

```bash
# Run TypeScript type checking
nx typecheck wc-superadmin
```

---

## NestJS API Applications

### 5. `wc-nest-api`

**Path**: `apps/wc-nest-api/`
**Type**: NestJS API Application
**Description**: World Schools backend API with authentication and RBAC

#### Application Running Commands

```bash
# Start development server with hot reload
nx serve wc-nest-api

# Start development server (alternative)
nx serve wc-nest-api --configuration=development

# Build for production
nx build wc-nest-api

# Build for development
nx build wc-nest-api --configuration=development

# Serve production build
nx serve wc-nest-api --configuration=production

# Preview the build
nx preview wc-nest-api
```

#### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint wc-nest-api

# Run ESLint and automatically fix issues
nx lint wc-nest-api --fix
```

#### Testing Commands

```bash
# Run unit tests
nx test wc-nest-api

# Run tests in watch mode
nx test wc-nest-api --watch

# Run tests with coverage
nx test wc-nest-api --coverage

# Run E2E tests
nx e2e wc-nest-api-e2e
```

#### Prisma Commands

**Important**: Each application has its own Prisma setup with separate database connections. Always use the Nx targets for the specific application.

```bash
# Generate Prisma Client (run after schema changes)
nx prisma:generate wc-nest-api

# Create and apply a new migration in development
nx prisma:migrate wc-nest-api

# Apply migrations in production/staging
nx prisma:migrate:deploy wc-nest-api

# Seed the database with initial data
nx prisma:seed wc-nest-api

# Open Prisma Studio (database GUI)
nx prisma:studio wc-nest-api

# Reset database (⚠️ WARNING: Deletes all data and re-runs migrations)
nx prisma:reset wc-nest-api
```

#### Alternative: Running Prisma CLI Directly

If you prefer to run Prisma CLI commands directly from the app directory:

```bash
cd apps/wc-nest-api

# Generate Prisma Client
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Seed the database (uses the prisma:seed target from project.json)
ts-node prisma/seed.ts

# Open Prisma Studio
npx prisma studio

# Reset database
npx prisma migrate reset
```

**Note**: The `npx prisma db seed` command is NOT configured in this monorepo. Use `nx prisma:seed wc-nest-api` from the root, or `ts-node prisma/seed.ts` from the app directory instead.

---

## Global Commands (All Applications)

### Format All Code

```bash
# Format all code in the monorepo
nx format:write

# Check formatting for all code
nx format:check
```

### Run Commands for Multiple Apps

```bash
# Run a command for all affected apps
nx affected --target=build
nx affected --target=test
nx affected --target=lint

# Run a command for all apps
nx run-many --target=build --all
nx run-many --target=test --all
nx run-many --target=lint --all
```

### Nx Graph

```bash
# View the dependency graph of the monorepo
nx graph
```

---

## Notes

1. **Nx Commands**: This is an Nx monorepo, so all commands use the `nx` CLI
2. **Working Directory**: Run all `nx` commands from the monorepo root (`world-schools/`)
3. **Environment Variables**: Make sure to set up `.env` files for each application before running
4. **Database Setup**: For `wc-nest-api`, run Prisma migrations and seed before first use
5. **Node Version**: Ensure you're using Node.js 18+ for compatibility
6. **Prisma Configuration**: Each NestJS application manages its own Prisma setup independently through its `project.json` targets. There is no global Prisma configuration in the root `package.json`
7. **Multiple Databases**: `wc-nest-api` and `schoolable-nest-api` (when configured) use separate databases with their own `DATABASE_URL` environment variables

---

## Quick Start Workflows

### First Time Setup - Next.js Applications

```bash
# From monorepo root - choose the app you want to run
nx dev schoolable-web
nx dev wc-booking
nx dev wc-provider
nx dev wc-superadmin
```

### First Time Setup - wc-nest-api

```bash
# From monorepo root
nx prisma:generate wc-nest-api
nx prisma:migrate wc-nest-api
nx prisma:seed wc-nest-api
nx serve wc-nest-api
```

### Development Workflow Examples

#### Running schoolable-web with API

```bash
# Terminal 1: Start the API
nx serve wc-nest-api

# Terminal 2: Start the web app
nx dev schoolable-web
```

#### Running all World Schools apps

```bash
# Terminal 1: Start the API
nx serve wc-nest-api

# Terminal 2: Start booking app
nx dev wc-booking

# Terminal 3: Start provider portal
nx dev wc-provider

# Terminal 4: Start super admin dashboard
nx dev wc-superadmin
```

#### Running multiple apps simultaneously

```bash
# Run multiple apps in parallel (requires separate terminals or use a process manager)
nx run-many --target=dev --projects=wc-booking,wc-provider,wc-superadmin --parallel=3
```

---

## Quick Reference

### Start Development Server

```bash
# Next.js apps
nx dev schoolable-web
nx dev wc-booking
nx dev wc-provider
nx dev wc-superadmin

# NestJS API
nx serve wc-nest-api
```

### Build for Production

```bash
# Next.js apps
nx build schoolable-web
nx build wc-booking
nx build wc-provider
nx build wc-superadmin

# NestJS API
nx build wc-nest-api
```

### Run Linting

```bash
# Lint a specific app
nx lint <app-name>

# Lint with auto-fix
nx lint <app-name> --fix

# Lint all apps
nx run-many --target=lint --all
```

### Run Tests

```bash
# Test a specific app
nx test <app-name>

# Test all apps
nx run-many --target=test --all

# Test with coverage
nx test <app-name> --coverage
```

### Prisma Operations (wc-nest-api only)

```bash
nx prisma:generate wc-nest-api    # Generate Prisma Client
nx prisma:migrate wc-nest-api     # Run migrations
nx prisma:seed wc-nest-api        # Seed database
nx prisma:studio wc-nest-api      # Open Prisma Studio
```
