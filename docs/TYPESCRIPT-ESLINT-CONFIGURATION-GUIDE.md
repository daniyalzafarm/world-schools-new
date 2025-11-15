# TypeScript & ESLint Configuration Guide

This guide explains the centralized TypeScript and ESLint configuration structure in the World Schools monorepo and how to use it when creating new applications.

## 📁 Configuration Structure

### Root-Level Shared Configurations

```
world-schools/
├── tsconfig.base.json              # Base TypeScript config (Nx-managed)
├── tsconfig.nextjs.json            # Shared Next.js TypeScript config
├── tsconfig.nestjs.json            # Shared NestJS TypeScript config
├── tsconfig.nestjs.spec.json       # Shared NestJS test config
├── eslint.config.mjs               # Root ESLint config
├── eslint.config.nextjs.mjs        # Shared Next.js ESLint config
├── eslint.config.nestjs.mjs        # Shared NestJS ESLint config
└── .prettierrc                     # Shared Prettier config
```

### App-Level Configurations

Each app has minimal configuration files that extend the shared configs:

**Next.js Apps:**
- `tsconfig.json` (extends `../../tsconfig.nextjs.json`)
- `eslint.config.mjs` (imports `createNextJsConfig()`)

**NestJS Apps:**
- `tsconfig.json` (extends `../../tsconfig.nestjs.json`)
- `tsconfig.app.json` (extends `./tsconfig.json`)
- `tsconfig.spec.json` (extends `../../tsconfig.nestjs.spec.json`)
- `eslint.config.mjs` (imports `createNestJsConfig()`)

---

## 🚀 Creating a New Next.js Application

### 1. Generate the App with Nx

```bash
nx generate @nx/next:application my-new-app
```

### 2. Create TypeScript Configuration

Create `apps/my-new-app/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.nextjs.json",
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "../../apps/my-new-app/.next/types/**/*.ts",
    "../../dist/apps/my-new-app/.next/types/**/*.ts",
    "next-env.d.ts"
  ],
  "exclude": ["node_modules", "jest.config.ts", "**/*.spec.ts", "**/*.test.ts"]
}
```

**Optional:** If you need custom path aliases:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@world-schools/ui-web": ["../../packages/ui-web/src/index.ts"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "../../apps/my-new-app/.next/types/**/*.ts",
    "../../dist/apps/my-new-app/.next/types/**/*.ts",
    "next-env.d.ts"
  ],
  "exclude": ["node_modules", "jest.config.ts", "**/*.spec.ts", "**/*.test.ts"]
}
```

### 3. Create ESLint Configuration

Create `apps/my-new-app/eslint.config.mjs`:

```javascript
/**
 * ESLint configuration for my-new-app Next.js application
 * 
 * This configuration uses the shared Next.js config from the root directory.
 * To add app-specific overrides, add them to the config array before exporting.
 */

import { createNextJsConfig } from '../../eslint.config.nextjs.mjs'

// Create the base Next.js configuration
const config = createNextJsConfig(import.meta.url)

// Add app-specific overrides here if needed
// Example:
// config.push({
//   files: ['**/*.ts', '**/*.tsx'],
//   rules: {
//     // Your app-specific rules here
//   }
// })

export default config
```

### 4. Verify the Configuration

```bash
# Run TypeScript compiler
nx run my-new-app:build

# Run ESLint
nx lint my-new-app

# Auto-fix formatting issues
nx lint my-new-app --fix
```

---

## 🔧 Creating a New NestJS Application

### 1. Generate the App with Nx

```bash
nx generate @nx/nest:application my-nest-api
```

### 2. Create TypeScript Configurations

**Create `apps/my-nest-api/tsconfig.json`:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.nestjs.json",
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

**Create `apps/my-nest-api/tsconfig.app.json`:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

**Note:** If your app uses Prisma, include the Prisma directory:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts", "prisma/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

**Create `apps/my-nest-api/tsconfig.spec.json`:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.nestjs.spec.json",
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ]
}
```

### 3. Create ESLint Configuration

Create `apps/my-nest-api/eslint.config.mjs`:

```javascript
/**
 * ESLint configuration for my-nest-api NestJS application
 *
 * This configuration uses the shared NestJS config from the root directory.
 * To add app-specific overrides, add them to the config array before exporting.
 */

import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'

// Create the base NestJS configuration
const config = createNestJsConfig(import.meta.url)

// Add app-specific overrides here if needed
// Example:
// config.push({
//   files: ['**/*.ts'],
//   rules: {
//     // Your app-specific rules here
//   }
// })

export default config
```

### 4. Verify the Configuration

```bash
# Run TypeScript compiler
nx run my-nest-api:build

# Run ESLint
nx lint my-nest-api

# Auto-fix formatting issues
nx lint my-nest-api --fix
```

---

## 🎯 Configuration Benefits

### Centralized Maintenance
- Update TypeScript settings in one place → applies to all apps
- Update ESLint rules in one place → applies to all apps
- Consistent behavior across the entire monorepo

### Reduced Duplication
- **Before refactoring:** 244 lines across 6 apps
- **After refactoring:** 211 lines total (13.5% reduction)
- Shared configs: 79 lines (reusable)
- App configs: 132 lines (minimal, app-specific)

### Improved Type Safety
- `strict: true` enabled for all apps
- `strictNullChecks: true` for NestJS apps
- Consistent compiler options across all apps

### Better Developer Experience
- JSON Schema validation in IDEs
- Clear separation of source and test files
- Proper TypeScript support for all file types
- ESLint integration works seamlessly

---

## 🔍 Shared Configuration Details

### `tsconfig.nextjs.json`

**Key Features:**
- Next.js-specific settings (`jsx: preserve`, Next.js plugin)
- Strict type checking enabled
- Modern module resolution (`bundler`)
- Optimized for Next.js 14+ with App Router

**Compiler Options:**
- `strict: true` - Enable all strict type checking
- `noEmit: true` - Next.js handles compilation
- `moduleResolution: "bundler"` - Modern resolution for Next.js
- `lib: ["dom", "dom.iterable", "esnext"]` - Browser + modern JS

### `tsconfig.nestjs.json`

**Key Features:**
- NestJS decorator support (`experimentalDecorators`, `emitDecoratorMetadata`)
- CommonJS modules for Node.js
- Strict null checks enabled
- ES2021 target for modern Node.js

**Compiler Options:**
- `strict: true` - Enable all strict type checking
- `strictNullChecks: true` - Required for nullish coalescing ESLint rule
- `module: "commonjs"` - Node.js module system
- `target: "es2021"` - Modern Node.js features

### `tsconfig.nestjs.spec.json`

**Key Features:**
- Extends NestJS config
- Includes Jest types
- Proper module resolution for tests

**Compiler Options:**
- `moduleResolution: "node10"` - Compatible with Jest
- `types: ["jest", "node"]` - Include Jest type definitions

---

## 🛠️ Customization Examples

### Adding App-Specific TypeScript Options

If your Next.js app needs custom compiler options:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["./src/components/*"],
      "@utils/*": ["./src/utils/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts"]
}
```

### Adding App-Specific ESLint Rules

If your NestJS app needs custom ESLint rules:

```javascript
import { createNestJsConfig } from '../../eslint.config.nestjs.mjs'

const config = createNestJsConfig(import.meta.url)

// Add custom rules for this app
config.push({
  files: ['**/*.ts'],
  rules: {
    // Disable console warnings for this app
    'no-console': 'off',

    // Custom rule for this app
    '@typescript-eslint/explicit-function-return-type': 'warn',
  }
})

export default config
```

---

## 📚 Troubleshooting

### TypeScript Parsing Errors in ESLint

**Problem:** ESLint shows "file was not found in any of the provided project(s)"

**Solution:** Make sure your `tsconfig.app.json` includes the file, or add it to `tsconfig.spec.json` if it's a test file.

### Prettier Formatting Conflicts

**Problem:** ESLint and Prettier show conflicting errors

**Solution:** The shared configs already include `eslint-plugin-prettier` as the last config. Make sure you're not adding additional formatting rules.

### Strict Null Checks Errors

**Problem:** Lots of TypeScript errors after enabling `strictNullChecks`

**Solution:** This is expected! The shared NestJS config enables `strictNullChecks` for better type safety. Fix the errors gradually or disable the rule temporarily:

```json
{
  "extends": "../../tsconfig.nestjs.json",
  "compilerOptions": {
    "strictNullChecks": false  // Temporary override
  }
}
```

---

## 📖 Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Nx TypeScript Configuration](https://nx.dev/recipes/tips-n-tricks/typescript)
- [Next.js TypeScript](https://nextjs.org/docs/app/building-your-application/configuring/typescript)
- [NestJS TypeScript](https://docs.nestjs.com/first-steps)

---

## 🎉 Summary

This centralized configuration approach provides:

✅ **Consistency** - All apps use the same standards
✅ **Maintainability** - Update once, apply everywhere
✅ **Type Safety** - Strict type checking enabled
✅ **Developer Experience** - Clear, minimal configuration
✅ **Scalability** - Easy to add new apps

When creating new applications, simply extend the shared configs and add only app-specific customizations!

