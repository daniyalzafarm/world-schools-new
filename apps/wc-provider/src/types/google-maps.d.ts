/// <reference types="google.maps" />

declare global {
  interface Window {
    initGoogleMaps?: () => void
  }
}

export {}
