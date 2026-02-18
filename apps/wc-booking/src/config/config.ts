const config = {
  app: {
    apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001',
    storageUrl: process.env.NEXT_PUBLIC_STORAGE_URL ?? 'http://localhost:3000/',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
  maps: {
    googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  },
}

export default config
