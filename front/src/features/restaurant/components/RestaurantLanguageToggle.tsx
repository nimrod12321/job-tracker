import {
  type AppLanguage,
  useRestaurantLanguage,
} from '../utils/restaurantLanguage'

function RestaurantLanguageToggle() {
  const { language, setLanguage } = useRestaurantLanguage()

  function handleLanguageChange(nextLanguage: AppLanguage) {
    if (nextLanguage !== language) {
      setLanguage(nextLanguage)
    }
  }

  return (
    <div className="restaurant-language-toggle" aria-label="Language">
      <button
        type="button"
        className={language === 'he' ? 'active' : ''}
        onClick={() => handleLanguageChange('he')}
      >
        עברית
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        className={language === 'en' ? 'active' : ''}
        onClick={() => handleLanguageChange('en')}
      >
        English
      </button>
    </div>
  )
}

export default RestaurantLanguageToggle
