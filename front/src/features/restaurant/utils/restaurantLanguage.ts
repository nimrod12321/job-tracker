import { useEffect, useState } from 'react'

export type AppLanguage = 'he' | 'en'

export const RESTAURANT_LANGUAGE_STORAGE_KEY = 'peepssLanguage'
export const RESTAURANT_LANGUAGE_CHANGED_EVENT =
  'peepss-language-changed'

export function getStoredRestaurantLanguage(): AppLanguage {
  return localStorage.getItem(RESTAURANT_LANGUAGE_STORAGE_KEY) === 'en'
    ? 'en'
    : 'he'
}

export function saveRestaurantLanguage(language: AppLanguage) {
  localStorage.setItem(RESTAURANT_LANGUAGE_STORAGE_KEY, language)
  window.dispatchEvent(new Event(RESTAURANT_LANGUAGE_CHANGED_EVENT))
}

export function useRestaurantLanguage() {
  const [language, setLanguage] = useState<AppLanguage>(
    getStoredRestaurantLanguage,
  )

  useEffect(() => {
    function handleLanguageChange() {
      setLanguage(getStoredRestaurantLanguage())
    }

    window.addEventListener(
      RESTAURANT_LANGUAGE_CHANGED_EVENT,
      handleLanguageChange,
    )
    window.addEventListener('storage', handleLanguageChange)

    return () => {
      window.removeEventListener(
        RESTAURANT_LANGUAGE_CHANGED_EVENT,
        handleLanguageChange,
      )
      window.removeEventListener('storage', handleLanguageChange)
    }
  }, [])

  function updateLanguage(nextLanguage: AppLanguage) {
    saveRestaurantLanguage(nextLanguage)
    setLanguage(nextLanguage)
  }

  return {
    direction: language === 'he' ? 'rtl' : 'ltr',
    language,
    setLanguage: updateLanguage,
  }
}
