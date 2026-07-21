import { NavLink } from 'react-router-dom'
import { ENABLE_JOB_MAP } from '../../../config/env'

type RestaurantViewSwitcherProps = {
  language: 'he' | 'en'
}

function RestaurantViewSwitcher({ language }: RestaurantViewSwitcherProps) {
  if (!ENABLE_JOB_MAP) {
    return null
  }

  return (
    <nav
      className="restaurant-view-switcher"
      aria-label={language === 'he' ? 'תצוגת משרות' : 'Job view'}
    >
      <NavLink to="/restaurant/explore" end>
        {language === 'he' ? 'החלקה' : 'Swipe'}
      </NavLink>
      <NavLink to="/restaurant/map" end>
        {language === 'he' ? 'מפה' : 'Map'}
      </NavLink>
    </nav>
  )
}

export default RestaurantViewSwitcher
