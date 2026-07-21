import { GOOGLE_MAPS_API_KEY } from '../config/env'

type GoogleMapsNamespace = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance
    LatLngBounds: new () => GoogleBoundsInstance
    places: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: Record<string, unknown>,
      ) => GoogleAutocompleteInstance
    }
    event: {
      removeListener: (listener: unknown) => void
    }
  }
}

export type GoogleMapInstance = {
  fitBounds: (bounds: GoogleBoundsInstance, padding?: number) => void
  setCenter: (center: { lat: number; lng: number }) => void
  setZoom: (zoom: number) => void
}

export type GoogleMarkerInstance = {
  addListener: (eventName: string, callback: () => void) => unknown
  setMap: (map: GoogleMapInstance | null) => void
}

export type GoogleBoundsInstance = {
  extend: (position: { lat: number; lng: number }) => void
}

export type GoogleAutocompletePlace = {
  place_id?: string
  formatted_address?: string
  name?: string
  types?: string[]
}

export type GoogleAutocompleteInstance = {
  addListener: (eventName: string, callback: () => void) => unknown
  getPlace: () => GoogleAutocompletePlace
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace
  }
}

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null

export function loadGoogleMaps() {
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google)
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Google Maps API key is not configured'))
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-peepss-google-maps]',
    )
    const script = existingScript ?? document.createElement('script')

    function handleLoad() {
      if (window.google?.maps?.places) {
        resolve(window.google)
      } else {
        googleMapsPromise = null
        reject(new Error('Google Maps did not load correctly'))
      }
    }

    function handleError() {
      googleMapsPromise = null
      reject(new Error('Google Maps failed to load'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&v=weekly`
      script.async = true
      script.defer = true
      script.dataset.peepssGoogleMaps = 'true'
      document.head.appendChild(script)
    }
  })

  return googleMapsPromise
}
