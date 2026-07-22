import { useRestaurantLanguage } from '../utils/restaurantLanguage'

type RestaurantLanguageToggleProps = {
  onChange?: () => void
}

function RestaurantLanguageToggle({ onChange }: RestaurantLanguageToggleProps) {
  const { language, setLanguage } = useRestaurantLanguage()
  const targetLanguage = language === 'he' ? 'en' : 'he'

  function handleLanguageChange() {
    setLanguage(targetLanguage)
    onChange?.()
  }

  return (
    <div className="restaurant-language-toggle">
      <button
        type="button"
        aria-label={
          language === 'he' ? 'Switch to English' : 'מעבר לעברית'
        }
        onClick={handleLanguageChange}
      >
        {language === 'he' ? 'English' : 'עברית'}
      </button>
    </div>
  )
}

export default RestaurantLanguageToggle
