const config = {
  app: {
    apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    providerAppUrl: process.env.NEXT_PUBLIC_PROVIDER_APP_URL ?? 'http://localhost:4200',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
}

export default config
