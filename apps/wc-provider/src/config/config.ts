const config = {
  app: {
    apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001',
    bookingAppUrl: process.env.NEXT_PUBLIC_BOOKING_APP_BASE_URL ?? 'http://localhost:4300',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    superadminAppUrl: process.env.NEXT_PUBLIC_SUPERADMIN_APP_URL ?? 'http://localhost:4100',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
}

export default config
