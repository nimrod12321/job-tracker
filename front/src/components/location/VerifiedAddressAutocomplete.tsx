import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../utils/googleMaps'

type VerifiedAddressAutocompleteProps = {
  mode: 'restaurantAddress' | 'workerStreet'
  value: string
  label: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  language: 'he' | 'en'
  onInputChange: (value: string) => void
  onPlaceSelected: (place: {
    placeId: string
    formattedAddress: string
  }) => void
}

const TEL_AVIV_BOUNDS = {
  north: 32.15,
  south: 31.95,
  east: 34.9,
  west: 34.7,
}

function VerifiedAddressAutocomplete({
  mode,
  value,
  label,
  placeholder,
  disabled = false,
  required = false,
  language,
  onInputChange,
  onPlaceSelected,
}: VerifiedAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected
  }, [onPlaceSelected])

  useEffect(() => {
    if (!inputRef.current || disabled) {
      return
    }

    let isActive = true
    let listener: unknown
    let mapsEvent:
      | { removeListener: (currentListener: unknown) => void }
      | undefined

    void loadGoogleMaps()
      .then((google) => {
        if (!isActive || !inputRef.current) {
          return
        }

        mapsEvent = google.maps.event
        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            bounds: TEL_AVIV_BOUNDS,
            strictBounds: true,
            componentRestrictions: { country: 'il' },
            fields: ['place_id', 'formatted_address', 'name', 'types'],
            types: mode === 'restaurantAddress' ? ['address'] : ['geocode'],
          },
        )

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()

          if (!place.place_id) {
            return
          }

          onPlaceSelectedRef.current({
            placeId: place.place_id,
            formattedAddress:
              place.formatted_address?.trim() || place.name?.trim() || '',
          })
        })
      })
      .catch(() => {
        if (isActive) {
          setLoadError(true)
        }
      })

    return () => {
      isActive = false
      if (listener && mapsEvent) {
        mapsEvent.removeListener(listener)
      }
    }
  }, [disabled, mode])

  return (
    <label className="verified-address-field">
      {label}
      <input
        ref={inputRef}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onInputChange(event.target.value)}
      />
      {loadError && (
        <span className="form-helper-text address-search-error" role="status">
          {language === 'he'
            ? 'חיפוש הכתובת אינו זמין כרגע. נסו שוב.'
            : 'Address search is temporarily unavailable. Please try again.'}
        </span>
      )}
    </label>
  )
}

export default VerifiedAddressAutocomplete
