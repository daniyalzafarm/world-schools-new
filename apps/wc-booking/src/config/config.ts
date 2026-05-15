const isProd = process.env.NODE_ENV === 'production'
const required = (value: string | undefined, key: string): string => {
  if (isProd && !value) {
    throw new Error(`Config error - missing ${key}`)
  }
  return value ?? ''
}

const config = {
  app: {
    apiUrl:
      required(process.env.NEXT_PUBLIC_API_BASE_URL, 'NEXT_PUBLIC_API_BASE_URL') ||
      'http://localhost:3000/',
    wsUrl:
      required(process.env.NEXT_PUBLIC_WS_URL, 'NEXT_PUBLIC_WS_URL') || 'http://localhost:3000',
    storageUrl: process.env.NEXT_PUBLIC_STORAGE_URL ?? 'http://localhost:3000/',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    metadataBase:
      required(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL') ||
      'https://booking.world-camps.org',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
  maps: {
    googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  },
}

export default config
