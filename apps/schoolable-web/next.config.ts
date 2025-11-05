import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable experimental features
  experimental: {
    // Enable optimizePackageImports for better bundle size
    optimizePackageImports: ['@heroui/react', '@heroicons/react'],
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // TypeScript configuration
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors. Only enable this if you know what you're doing.
    ignoreBuildErrors: false,
  },

  // Redirects configuration
  async redirects() {
    return [
      {
        source: '/',
        destination: '/chat/new',
        permanent: true, // false: Use temporary redirect (302) instead of permanent (301)
      },
    ]
  },

  // Output configuration for static export (if needed)
  // output: 'export',
  // trailingSlash: true,
  // distDir: 'dist',
}

export default nextConfig
