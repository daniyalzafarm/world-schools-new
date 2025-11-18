const config = {
  app: {
    apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
}

export default config
