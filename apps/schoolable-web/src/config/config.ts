const config = {
  app: {
    apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/',
    whatsappSocketUrl: process.env.NEXT_PUBLIC_WHATSAPP_SOCKET_URL ?? 'http://localhost:3003',
    whatsappApiKey: process.env.NEXT_PUBLIC_WHATSAPP_API_KEY,
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
  firebase: {
    baseFolder: process.env.NEXT_PUBLIC_FIREBASE_FOLDER_NAME ?? 'schoolable-web',
    proposalsFolder: process.env.NEXT_PUBLIC_PROPOSALS_FOLDER_NAME ?? 'schoolable-web-proposals',
    invoicesFolder: process.env.NEXT_PUBLIC_INVOICES_FOLDER_NAME ?? 'schoolable-web-invoices',
  },
}

export default config
