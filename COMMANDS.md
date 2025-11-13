# Available Commands

This document lists all available commands for the applications in this monorepo. All commands should be run from the **monorepo root directory** (`world-schools/`) unless otherwise specified.

---

## 1. `apps/schoolable-web/` (Next.js Application)

### Application Running Commands

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

### Type Checking

```bash
# Run TypeScript type checking
nx typecheck schoolable-web
```

---

## 2. `apps/wc-nest-api/` (NestJS API Application)

### Application Running Commands

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

### Linting Commands

```bash
# Run ESLint to check for code quality issues
nx lint wc-nest-api

# Run ESLint and automatically fix issues
nx lint wc-nest-api --fix
```

### Testing Commands

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

### Prisma Commands

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

## Adding Prisma to a New Application

If you need to add Prisma to another NestJS application (e.g., `schoolable-nest-api`), follow these steps:

### 1. Add Prisma Targets to `project.json`

Add the following targets to the application's `project.json` file:

```json
{
  "targets": {
    "prisma:generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma generate",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:migrate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate dev",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:migrate:deploy": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate deploy",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:seed": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ts-node prisma/seed.ts",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:studio": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma studio",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:reset": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate reset",
        "cwd": "apps/your-app-name"
      }
    }
  }
}
```

### 2. Create Prisma Directory and Files

```bash
cd apps/your-app-name
mkdir prisma
touch prisma/schema.prisma
touch prisma/seed.ts
```

### 3. Set Up Environment Variables

Create a `.env` file in the app directory with a unique `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/your_database_name"
```

### 4. Initialize and Use

```bash
# Generate Prisma Client
nx prisma:generate your-app-name

# Create initial migration
nx prisma:migrate your-app-name

# Seed the database
nx prisma:seed your-app-name
```

---

## Quick Start Workflows

### First Time Setup - schoolable-web

```bash
# From monorepo root
nx dev schoolable-web
```

### First Time Setup - wc-nest-api

```bash
# From monorepo root
nx prisma:generate wc-nest-api
nx prisma:migrate wc-nest-api
nx prisma:seed wc-nest-api
nx serve wc-nest-api
```

### Development Workflow

```bash
# Start both applications in separate terminals
nx dev schoolable-web          # Terminal 1
nx serve wc-nest-api           # Terminal 2
```

