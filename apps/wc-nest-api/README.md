# World Schools NestJS API

A NestJS backend API for the World Schools platform with multi-tenant RBAC, authentication, and provider management.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Nx CLI (installed in the monorepo)

### Setup

1. **Create environment file**

   ```bash
   cd apps/wc-nest-api
   cp .env.example .env
   ```

   Update the `.env` file with your database credentials and secrets.

2. **Set up the database**

   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Run migrations
   npx prisma migrate dev --name init

   # Seed the database with initial data
   npx prisma db seed
   ```

3. **Start the development server**

   ```bash
   # From the monorepo root
   nx serve wc-nest-api

   # Or from this directory
   npm run dev
   ```

4. **Access the API**

   - API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/docs
   - Health Check: http://localhost:3000/health

### Default Credentials

After seeding, you can log in with:

- **Email**: `admin@world-camps.org`
- **Password**: `Camps@231`

⚠️ **Important**: Change these credentials in production!

## 📁 Project Structure

```
apps/wc-nest-api/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding script
├── src/
│   ├── common/                # Shared utilities, filters, interceptors
│   ├── config/                # Configuration service
│   ├── prisma/                # Prisma service and module
│   ├── modules/
│   │   ├── core/
│   │   │   └── auth/         # Authentication module
│   │   └── health/           # Health check module
│   ├── app/
│   │   └── app.module.ts     # Root application module
│   └── main.ts               # Application entry point
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🔐 Authentication

The API uses JWT-based authentication with support for:

- Email/password login
- HTTP-only cookies for token storage
- Access tokens (15 minutes) and refresh tokens (7 days)
- Role-based access control (RBAC)
- Permission-based authorization

### Authentication Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (clears cookies)
- `GET /auth/profile` - Get current user profile
- `POST /auth/change-password` - Change password
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

### Using Authentication

**Login Example:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@world-camps.org",
    "password": "Camps@231"
  }'
```

**Authenticated Request:**

```bash
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🗄️ Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **User** - User accounts with email/password or OAuth
- **UserAccount** - OAuth accounts (Google, Apple)
- **Role** - Roles (system-wide or provider-specific)
- **Permission** - Granular permissions
- **UserRole** - Many-to-many user-role assignments
- **RolePermission** - Many-to-many role-permission assignments
- **Provider** - Schools/organizations
- **Parent** - Parent profiles linked to users
- **Children** - Student records

### Database Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

## 🛡️ Authorization

### Using Guards and Decorators

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesOrPermissionsGuard } from '../auth/guards/roles-or-permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('example')
export class ExampleController {
  // Public endpoint (no authentication required)
  @Public()
  @Get('public')
  getPublic() {
    return { message: 'This is public' };
  }

  // Authenticated endpoint
  @Get('protected')
  getProtected(@CurrentUser() user) {
    return { message: 'This is protected', user };
  }

  // Role-based access
  @UseGuards(RolesOrPermissionsGuard)
  @Roles('Super Admin', 'Provider Admin')
  @Get('admin-only')
  getAdminOnly() {
    return { message: 'Admin only' };
  }

  // Permission-based access
  @UseGuards(RolesOrPermissionsGuard)
  @Permissions('users.create', 'users.update')
  @Post('create-user')
  createUser() {
    return { message: 'User created' };
  }
}
```

## 🧪 Testing

```bash
# Unit tests
nx test wc-nest-api

# E2E tests
nx e2e wc-nest-api-e2e

# Test coverage
nx test wc-nest-api --coverage
```

## 📦 Building for Production

```bash
# Build the application
nx build wc-nest-api

# The build output will be in dist/apps/wc-nest-api
```

## 🔧 Development Scripts

```bash
# Start development server with hot reload
nx serve wc-nest-api

# Build the application
nx build wc-nest-api

# Run tests
nx test wc-nest-api

# Lint the code
nx lint wc-nest-api

# Format the code
nx format:write
```

## 📚 API Documentation

Once the server is running, visit http://localhost:3000/docs to access the interactive Swagger API documentation.

## 🌐 Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing access tokens
- `JWT_REFRESH_SECRET` - Secret for signing refresh tokens
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## 📄 License

MIT

