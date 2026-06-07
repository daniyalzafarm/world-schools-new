import { getRuntimeConfig } from './runtime-config'

const config = {
  app: {
    get apiUrl(): string {
      return getRuntimeConfig().apiBaseUrl
    },
    get wsUrl(): string {
      return getRuntimeConfig().wsUrl ?? ''
    },
    get version(): string {
      return getRuntimeConfig().appVersion
    },
    get providerAppUrl(): string {
      return getRuntimeConfig().providerAppUrl ?? 'http://localhost:4302'
    },
    get bookingAppUrl(): string {
      return getRuntimeConfig().bookingAppUrl ?? 'http://localhost:4303'
    },
    get metadataBase(): string {
      return getRuntimeConfig().appUrl
    },
  },
  auth: {
    get usingRequest(): boolean {
      return getRuntimeConfig().authUsingRequest
    },
  },
}

export default config
