# Schoolable Web

Modern school management platform built with Next.js, HeroUI, and industry best practices.

## Features

- ⚡ **Next.js 15** - Latest Next.js with App Router and Turbopack
- 🎨 **HeroUI** - Beautiful, accessible React components
- 🌙 **Dark Mode** - Built-in dark mode support with next-themes
- 📱 **Responsive** - Mobile-first responsive design
- 🔥 **Firebase** - Authentication and storage integration
- 🎯 **TypeScript** - Full TypeScript support
- 🧹 **ESLint & Prettier** - Code quality and formatting
- 🚀 **Optimized** - Performance optimizations and best practices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI Library**: HeroUI (NextUI successor)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: Heroicons
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd schoolable-web
```

2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/
NEXT_PUBLIC_WHATSAPP_SOCKET_URL=http://localhost:3003
NEXT_PUBLIC_WHATSAPP_API_KEY=your_whatsapp_api_key_here

# Authentication Configuration
NEXT_PUBLIC_AUTH_USING_REQUEST=true

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Storage Folders
NEXT_PUBLIC_FIREBASE_FOLDER_NAME=schoolable-web
NEXT_PUBLIC_PROPOSALS_FOLDER_NAME=schoolable-web-proposals
NEXT_PUBLIC_INVOICES_FOLDER_NAME=schoolable-web-invoices

# Development Settings
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run lint:fix` - Run lint and format together
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── providers.tsx   # App providers
├── components/         # React components
│   ├── ui/            # Reusable UI components
│   ├── layout/        # Layout components
│   └── auth/          # Authentication components
├── config/            # Configuration files
│   ├── config.ts      # App configuration
│   └── firebase.ts    # Firebase configuration
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
│   ├── api-client.ts  # API client
│   ├── event-bus.ts   # Event bus
│   └── firebase-*.ts  # Firebase utilities
└── hero.ts            # HeroUI theme configuration
```

## Configuration

### HeroUI Theme

The app uses a custom HeroUI theme defined in `src/hero.ts` with purple primary colors and support for light/dark modes.

### API Client

The API client (`src/utils/api-client.ts`) is configured to work with both cookie-based and token-based authentication, with automatic token refresh and error handling.

### Firebase

Firebase is configured for authentication and storage. Set up your Firebase project and update the environment variables accordingly.

## Development

### Code Quality

The project includes comprehensive ESLint and Prettier configurations for consistent code quality:

- ESLint rules for TypeScript, React, and accessibility
- Prettier for code formatting
- Pre-configured import sorting and quote consistency

### Type Safety

Full TypeScript support with strict configuration and proper type definitions for all APIs and components.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
