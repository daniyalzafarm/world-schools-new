# wc-utils

Shared utility functions for World Camps (WC) applications in the World Schools monorepo.

## Overview

This package contains common utility functions used across World Camps applications including:
- API client utilities
- Helper functions
- Common utilities

## Usage

```typescript
import { parseDuration } from '@world-schools/wc-utils'

const milliseconds = parseDuration('15m') // 900000
```

## Available Utilities

### `parseDuration(duration: string): number`

Parses a duration string (e.g., '15m', '7d', '1h') into milliseconds.

Supported units:
- `s` - seconds
- `m` - minutes
- `h` - hours
- `d` - days

Example:
```typescript
parseDuration('15m')  // 900000 (15 minutes in milliseconds)
parseDuration('7d')   // 604800000 (7 days in milliseconds)
parseDuration('1h')   // 3600000 (1 hour in milliseconds)
```

## Development

This library was generated with [Nx](https://nx.dev).

### Running unit tests

Run `nx test wc-utils` to execute the unit tests via [Vitest](https://vitest.dev/).

