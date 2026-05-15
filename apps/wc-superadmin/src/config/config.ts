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
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    providerAppUrl: process.env.NEXT_PUBLIC_PROVIDER_APP_URL ?? 'http://localhost:4302',
    bookingAppUrl: process.env.NEXT_PUBLIC_BOOKING_APP_URL ?? 'http://localhost:4303',
    metadataBase:
      required(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL') ||
      'https://superadmin.world-camps.org',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
}

export default config
