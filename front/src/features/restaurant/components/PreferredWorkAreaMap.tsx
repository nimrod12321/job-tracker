import { useEffect, useRef, useState } from 'react'
import {
  loadGoogleMaps,
  type GoogleCircleInstance,
  type GoogleAutocompleteInstance,
  type GoogleMapInstance,
  type GoogleMapsNamespace,
} from '../../../utils/googleMaps'
import type { PreferredWorkArea } from '../types/restaurant'

type PreferredWorkAreaMapProps = {
  language: 'he' | 'en'
  value: PreferredWorkArea | null
  onChange: (value: PreferredWorkArea | null) => void
}

const TEL_AVIV_CENTER = { lat: 32.0853, lng: 34.7818 }
const TEL_AVIV_BOUNDS = {
  north: 32.15,
  south: 32.0,
  east: 34.86,
  west: 34.72,
}
const DEFAULT_RADIUS_KM = 2

function isInsideTelAvivBounds(latitude: number, longitude: number) {
  return (
    latitude >= TEL_AVIV_BOUNDS.south &&
    latitude <= TEL_AVIV_BOUNDS.north &&
    longitude >= TEL_AVIV_BOUNDS.west &&
    longitude <= TEL_AVIV_BOUNDS.east
  )
}

function PreferredWorkAreaMap({
  language,
  value,
  onChange,
}: PreferredWorkAreaMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const mapsRef = useRef<GoogleMapsNamespace | null>(null)
  const circleRef = useRef<GoogleCircleInstance | null>(null)
  const autocompleteRef = useRef<GoogleAutocompleteInstance | null>(null)
  const onChangeRef = useRef(onChange)
  const languageRef = useRef(language)
  const initialValueRef = useRef(value)
  const isUserPanningRef = useRef(false)
  const isSearchPanningRef = useRef(false)
  const radiusRef = useRef(value?.radiusKm ?? DEFAULT_RADIUS_KM)
  const [draftRadiusKm, setDraftRadiusKm] = useState(
    value?.radiusKm ?? DEFAULT_RADIUS_KM,
  )
  const [isMapReady, setIsMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    if (value) {
      radiusRef.current = value.radiusKm
    }
  }, [value])

  useEffect(() => {
    if (!mapElementRef.current) {
      return
    }

    setIsMapReady(false)
    let isActive = true
    const listeners: unknown[] = []

    void loadGoogleMaps()
      .then((google) => {
        if (!isActive || !mapElementRef.current) {
          return
        }

        const initialValue = initialValueRef.current
        const initialCenter = initialValue
          ? {
              lat: initialValue.latitude,
              lng: initialValue.longitude,
            }
          : TEL_AVIV_CENTER
        const map = new google.maps.Map(mapElementRef.current, {
          center: initialCenter,
          zoom: initialValue ? 13 : 12,
          mapTypeId: 'roadmap',
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          restriction: {
            latLngBounds: TEL_AVIV_BOUNDS,
            strictBounds: true,
          },
        })
        const circle = new google.maps.Circle({
          center: initialCenter,
          radius: radiusRef.current * 1000,
          map,
          clickable: false,
          fillColor: '#f3a536',
          fillOpacity: initialValue ? 0.2 : 0.08,
          strokeColor: '#d68016',
          strokeOpacity: initialValue ? 0.9 : 0.45,
          strokeWeight: 2,
        })

        if (searchInputRef.current) {
          try {
            const autocomplete = new google.maps.places.Autocomplete(
              searchInputRef.current,
              {
                bounds: TEL_AVIV_BOUNDS,
                strictBounds: true,
                componentRestrictions: { country: 'il' },
                fields: [
                  'place_id',
                  'formatted_address',
                  'geometry',
                  'name',
                  'types',
                ],
                types: ['geocode'],
              },
            )

            autocompleteRef.current = autocomplete
            listeners.push(
              autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace()
                const location = place.geometry?.location

                if (!location) {
                  setSearchError(
                    languageRef.current === 'he'
                      ? 'בחרו רחוב או שכונה מתוך ההצעות של Google.'
                      : 'Choose a street or neighborhood from the Google suggestions.',
                  )
                  return
                }

                const latitude = location.lat()
                const longitude = location.lng()

                if (!isInsideTelAvivBounds(latitude, longitude)) {
                  setSearchError(
                    languageRef.current === 'he'
                      ? 'בחרו מיקום בתוך תל אביב-יפו.'
                      : 'Choose a location within Tel Aviv–Yafo.',
                  )
                  return
                }

                setSearchError(null)
                setError(null)
                isUserPanningRef.current = false
                isSearchPanningRef.current = true
                circle.setCenter({ lat: latitude, lng: longitude })
                map.panTo({ lat: latitude, lng: longitude })
              }),
            )
          } catch {
            setSearchError(
              languageRef.current === 'he'
                ? 'חיפוש המיקום אינו זמין כרגע. עדיין אפשר לגרור את המפה.'
                : 'Location search is unavailable. You can still drag the map.',
            )
          }
        }

        const synchronizeCircleWithMap = () => {
          const center = map.getCenter()

          if (center) {
            circle.setCenter({ lat: center.lat(), lng: center.lng() })
          }
        }

        listeners.push(
          map.addListener('center_changed', synchronizeCircleWithMap),
          map.addListener('dragstart', () => {
            isUserPanningRef.current = true
          }),
          map.addListener('idle', () => {
            if (
              !isUserPanningRef.current &&
              !isSearchPanningRef.current
            ) {
              return
            }

            isUserPanningRef.current = false
            isSearchPanningRef.current = false
            const center = map.getCenter()

            if (!center) {
              return
            }

            const latitude = center.lat()
            const longitude = center.lng()

            if (!isInsideTelAvivBounds(latitude, longitude)) {
              setError(
                languageRef.current === 'he'
                  ? 'יש למקם את מרכז המפה בתוך תל אביב-יפו.'
                  : 'Keep the map center within Tel Aviv–Yafo.',
              )
              return
            }

            setError(null)
            onChangeRef.current({
              latitude,
              longitude,
              radiusKm: radiusRef.current,
            })
          }),
        )

        mapsRef.current = google
        mapRef.current = map
        circleRef.current = circle
        setError(null)
        setIsMapReady(true)
      })
      .catch(() => {
        if (isActive) {
          setError(
            languageRef.current === 'he'
              ? 'המפה אינה זמינה כרגע. אפשר לשמור את הפרופיל בלי לבחור אזור.'
              : 'The map is unavailable right now. You can save without choosing an area.',
          )
        }
      })

    return () => {
      isActive = false
      if (mapsRef.current) {
        for (const listener of listeners) {
          mapsRef.current.maps.event.removeListener(listener)
        }
      }
      circleRef.current?.setMap(null)
      circleRef.current = null
      autocompleteRef.current = null
      mapRef.current = null
      mapsRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const circle = circleRef.current

    if (!map || !circle || !isMapReady) {
      return
    }

    circle.setOptions({
      fillOpacity: value ? 0.2 : 0.08,
      strokeOpacity: value ? 0.9 : 0.45,
    })

    if (!value) {
      return
    }

    const center = { lat: value.latitude, lng: value.longitude }
    circle.setRadius(value.radiusKm * 1000)
    circle.setCenter(center)
    map.setCenter(center)
  }, [isMapReady, value])

  function getCurrentMapCenter() {
    const center = mapRef.current?.getCenter()

    return center
      ? { latitude: center.lat(), longitude: center.lng() }
      : value
        ? { latitude: value.latitude, longitude: value.longitude }
        : { latitude: TEL_AVIV_CENTER.lat, longitude: TEL_AVIV_CENTER.lng }
  }

  function handleRadiusChange(radiusKm: number) {
    radiusRef.current = radiusKm
    setDraftRadiusKm(radiusKm)
    circleRef.current?.setRadius(radiusKm * 1000)

    onChange({ ...getCurrentMapCenter(), radiusKm })
  }

  function handleRemove() {
    radiusRef.current = DEFAULT_RADIUS_KM
    setDraftRadiusKm(DEFAULT_RADIUS_KM)
    circleRef.current?.setRadius(DEFAULT_RADIUS_KM * 1000)
    onChange(null)
  }

  return (
    <div className="preferred-work-area-control">
      <label className="preferred-work-area-search">
        <span>
          {language === 'he'
            ? 'חיפוש רחוב או שכונה'
            : 'Search for a street or neighborhood'}
        </span>
        <input
          ref={searchInputRef}
          type="search"
          autoComplete="off"
          placeholder={
            language === 'he'
              ? 'לדוגמה: פלורנטין או רחוב דיזנגוף'
              : 'For example: Florentin or Dizengoff Street'
          }
          onChange={() => {
            if (searchError) {
              setSearchError(null)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
            }
          }}
        />
      </label>
      {searchError && (
        <p className="form-helper-text preferred-work-area-search-error" role="status">
          {searchError}
        </p>
      )}
      <div
        ref={mapElementRef}
        className="preferred-work-area-map"
        aria-label={
          language === 'he'
            ? 'גררו את המפה לבחירת אזור עבודה מועדף'
            : 'Drag the map to choose a preferred work area'
        }
      />
      <p className="form-helper-text">
        {language === 'he'
          ? 'גררו את המפה מתחת לעיגול כדי לבחור אזור. האזור משפיע רק על המשרות בהחלקה, לא על מפת המשרות.'
          : 'Drag the map underneath the circle to choose an area. This affects only Swipe jobs, not the Jobs Map.'}
      </p>
      <label className="preferred-work-area-radius">
        <span>
          {language === 'he' ? 'רדיוס' : 'Radius'}:{' '}
          <strong>{(value?.radiusKm ?? draftRadiusKm).toFixed(1)} km</strong>
        </span>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={value?.radiusKm ?? draftRadiusKm}
          onChange={(event) =>
            handleRadiusChange(Number(event.target.value))
          }
        />
      </label>
      <div className="preferred-work-area-status" aria-live="polite">
        <span>
          {value
            ? language === 'he'
              ? 'אזור העבודה המועדף נבחר.'
              : 'Preferred work area selected.'
            : language === 'he'
              ? 'לא נבחר אזור — גררו את המפה או שנו את הרדיוס כדי לבחור.'
              : 'No area selected — drag the map or change the radius to choose one.'}
        </span>
        {value && (
          <button
            type="button"
            className="ui-button ui-button--tertiary"
            onClick={handleRemove}
          >
            {language === 'he' ? 'הסרת האזור' : 'Remove area'}
          </button>
        )}
      </div>
      {error && (
        <p className="message message-error preferred-work-area-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default PreferredWorkAreaMap
