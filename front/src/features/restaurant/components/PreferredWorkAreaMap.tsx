import { useEffect, useRef, useState } from 'react'
import {
  loadGoogleMaps,
  type GoogleCircleInstance,
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
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const mapsRef = useRef<GoogleMapsNamespace | null>(null)
  const circleRef = useRef<GoogleCircleInstance | null>(null)
  const onChangeRef = useRef(onChange)
  const radiusRef = useRef(value?.radiusKm ?? DEFAULT_RADIUS_KM)
  const [draftRadiusKm, setDraftRadiusKm] = useState(
    value?.radiusKm ?? DEFAULT_RADIUS_KM,
  )
  const [isMapReady, setIsMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
    let clickListener: unknown

    void loadGoogleMaps()
      .then((google) => {
        if (!isActive || !mapElementRef.current) {
          return
        }

        const map = new google.maps.Map(mapElementRef.current, {
          center: value
            ? { lat: value.latitude, lng: value.longitude }
            : TEL_AVIV_CENTER,
          zoom: value ? 13 : 12,
          mapTypeId: 'roadmap',
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
          restriction: {
            latLngBounds: TEL_AVIV_BOUNDS,
            strictBounds: false,
          },
        })

        mapsRef.current = google
        mapRef.current = map
        clickListener = map.addListener('click', (event) => {
          const latitude = event.latLng?.lat()
          const longitude = event.latLng?.lng()

          if (
            typeof latitude !== 'number' ||
            typeof longitude !== 'number'
          ) {
            return
          }

          if (!isInsideTelAvivBounds(latitude, longitude)) {
            setError(
              language === 'he'
                ? 'יש לבחור מרכז בתוך תל אביב-יפו.'
                : 'Choose a center within Tel Aviv–Yafo.',
            )
            return
          }

          setError(null)
          onChangeRef.current({
            latitude,
            longitude,
            radiusKm: radiusRef.current,
          })
        })
        setError(null)
        setIsMapReady(true)
      })
      .catch(() => {
        if (isActive) {
          setError(
            language === 'he'
              ? 'המפה אינה זמינה כרגע. אפשר לשמור את הפרופיל בלי לבחור אזור.'
              : 'The map is unavailable right now. You can save without choosing an area.',
          )
        }
      })

    return () => {
      isActive = false
      if (clickListener && mapsRef.current) {
        mapsRef.current.maps.event.removeListener(clickListener)
      }
      circleRef.current?.setMap(null)
      circleRef.current = null
      mapRef.current = null
      mapsRef.current = null
    }
    // The map is initialized once. Value changes update only the circle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  useEffect(() => {
    const google = mapsRef.current
    const map = mapRef.current

    if (!google || !map || !isMapReady) {
      return
    }

    circleRef.current?.setMap(null)
    circleRef.current = null

    if (!value) {
      return
    }

    const center = { lat: value.latitude, lng: value.longitude }
    circleRef.current = new google.maps.Circle({
      center,
      radius: value.radiusKm * 1000,
      map,
      clickable: false,
      fillColor: '#f3a536',
      fillOpacity: 0.2,
      strokeColor: '#d68016',
      strokeOpacity: 0.9,
      strokeWeight: 2,
    })
    map.setCenter(center)
  }, [isMapReady, value])

  function handleRadiusChange(radiusKm: number) {
    radiusRef.current = radiusKm
    setDraftRadiusKm(radiusKm)

    if (value) {
      onChange({ ...value, radiusKm })
    }
  }

  return (
    <div className="preferred-work-area-control">
      <div
        ref={mapElementRef}
        className="preferred-work-area-map"
        aria-label={
          language === 'he'
            ? 'בחירת אזור עבודה מועדף במפה'
            : 'Choose a preferred work area on the map'
        }
      />
      <p className="form-helper-text">
        {language === 'he'
          ? 'לחצו על המפה כדי לבחור מרכז. האזור משפיע רק על המשרות בהחלקה, לא על מפת המשרות.'
          : 'Tap the map to choose a center. This affects only Swipe jobs, not the Jobs Map.'}
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
              ? 'לא נבחר אזור — יוצגו כל המשרות המתאימות.'
              : 'No area selected — all eligible jobs will be shown.'}
        </span>
        {value && (
          <button
            type="button"
            className="ui-button ui-button--tertiary"
            onClick={() => onChange(null)}
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
