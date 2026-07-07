import { useRef, useState, type PointerEvent } from 'react'
import {
  getRestaurantRoleLabel,
  type RestaurantExploreJob,
} from '../types/restaurant'
import type { AppLanguage } from '../utils/restaurantLanguage'

const SWIPE_THRESHOLD = 100
const SWIPE_EXIT_DISTANCE = 900
const avatarColors = [
  '#ef4b23',
  '#d97706',
  '#16a34a',
  '#0f766e',
  '#7c3aed',
  '#be123c',
]
const roleIcons: Record<RestaurantExploreJob['role'], string> = {
  bartender: '🍸',
  cook: '🍳',
  floorManager: '📋',
  host: '👋',
  waiter: '🍽️',
}
const DEMO_REAL_PLACE_MARKER = 'source=demo_real_place.'
const DEMO_REAL_PLACE_NOTE = 'Demo listing — not verified by restaurant.'

type RestaurantSwipeCardProps = {
  className?: string
  job: RestaurantExploreJob
  isAnimating?: boolean
  isApplying: boolean
  isPreview?: boolean
  language: AppLanguage
  onApply: () => Promise<boolean>
  onSkip: () => boolean
}

function getRestaurantAvatar(job: RestaurantExploreJob) {
  const name = job.restaurantName.trim()
  const initial = Array.from(name || getRestaurantRoleLabel(job.role))[0]
  const colorIndex = Array.from(name).reduce(
    (total, letter) => total + letter.charCodeAt(0),
    0,
  )

  return {
    backgroundColor: avatarColors[colorIndex % avatarColors.length],
    initial,
  }
}

function getPlaceIcon(job: RestaurantExploreJob) {
  const searchableText =
    `${job.restaurantName} ${job.description} ${job.requirements}`.toLowerCase()

  if (searchableText.includes('cafe') || searchableText.includes('coffee')) {
    return '☕'
  }

  if (searchableText.includes('bar') || searchableText.includes('drinks')) {
    return '🍹'
  }

  if (searchableText.includes('pasta') || searchableText.includes('bistro')) {
    return '🍝'
  }

  return roleIcons[job.role] ?? '🍝'
}

function getVibeBadges(job: RestaurantExploreJob, language: AppLanguage) {
  const searchableText =
    `${job.restaurantName} ${job.description} ${job.requirements} ${job.shiftInfo}`.toLowerCase()
  const badges: string[] = []

  if (
    searchableText.includes('morning') ||
    searchableText.includes('breakfast')
  ) {
    badges.push(language === 'he' ? 'בוקר' : 'Morning')
  }

  if (
    searchableText.includes('night') ||
    searchableText.includes('evening')
  ) {
    badges.push(language === 'he' ? 'ערב' : 'Evening')
  }

  if (
    searchableText.includes('busy') ||
    searchableText.includes('fast')
  ) {
    badges.push(language === 'he' ? 'קצב גבוה' : 'Fast pace')
  }

  if (
    searchableText.includes('team') ||
    searchableText.includes('friendly')
  ) {
    badges.push(language === 'he' ? 'צוותי' : 'Team vibe')
  }

  if (badges.length === 0) {
    badges.push(language === 'he' ? 'מסעדה' : 'Restaurant')
  }

  return badges.slice(0, 2)
}

function getCleanDemoText(value: string) {
  return value
    .replace(DEMO_REAL_PLACE_MARKER, '')
    .replace(DEMO_REAL_PLACE_NOTE, '')
    .trim()
}

function RestaurantSwipeCard({
  className = '',
  job,
  isAnimating = false,
  isApplying,
  isPreview = false,
  language,
  onApply,
  onSkip,
}: RestaurantSwipeCardProps) {
  const dragStartX = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const activePointerId = useRef<number | null>(null)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCommittingSwipe, setIsCommittingSwipe] = useState(false)

  const rotation = Math.max(-8, Math.min(8, dragOffsetX / 24))
  const hintOpacity = Math.min(
    1,
    Math.abs(dragOffsetX) / SWIPE_THRESHOLD,
  )
  const text = {
    applyHint: language === 'he' ? 'הגש' : 'APPLY',
    skipHint: language === 'he' ? 'דלג' : 'SKIP',
    shift: language === 'he' ? 'משמרות' : 'Shift',
    requirements: language === 'he' ? 'דרישות' : 'Need',
    skip: language === 'he' ? 'דלג' : 'Skip',
    apply: language === 'he' ? 'הגש בקשה' : 'Like · Apply',
    applying: language === 'he' ? 'שולח...' : 'Applying...',
  }
  const avatar = getRestaurantAvatar(job)
  const placeIcon = getPlaceIcon(job)
  const isDemoRealPlace = job.description.includes(DEMO_REAL_PLACE_MARKER)
  const vibeBadges = [
    ...(isDemoRealPlace
      ? [language === 'he' ? 'דמו' : 'Demo listing']
      : []),
    ...getVibeBadges(job, language),
  ].slice(0, 2)
  const description = getCleanDemoText(job.description)
  const requirements = getCleanDemoText(job.requirements)

  function resetDrag() {
    dragStartX.current = null
    dragOffsetRef.current = 0
    activePointerId.current = null
    setIsDragging(false)
    setIsCommittingSwipe(false)
    setDragOffsetX(0)
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement

    if (
      isApplying ||
      isAnimating ||
      isPreview ||
      isCommittingSwipe ||
      event.button !== 0 ||
      target.closest('button, a')
    ) {
      return
    }

    dragStartX.current = event.clientX
    dragOffsetRef.current = 0
    activePointerId.current = event.pointerId
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (
      dragStartX.current === null ||
      activePointerId.current !== event.pointerId
    ) {
      return
    }

    const nextOffset = event.clientX - dragStartX.current
    dragOffsetRef.current = nextOffset
    setDragOffsetX(nextOffset)
  }

  async function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (activePointerId.current !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalOffset = dragOffsetRef.current
    dragStartX.current = null
    activePointerId.current = null
    setIsDragging(false)

    if (Math.abs(finalOffset) < SWIPE_THRESHOLD) {
      dragOffsetRef.current = 0
      setDragOffsetX(0)
      return
    }

    const isApplySwipe = finalOffset > 0
    const direction = isApplySwipe ? 1 : -1

    setIsCommittingSwipe(true)
    setDragOffsetX(direction * SWIPE_EXIT_DISTANCE)

    const succeeded = isApplySwipe ? await onApply() : onSkip()

    if (!succeeded) {
      resetDrag()
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    if (activePointerId.current === event.pointerId) {
      resetDrag()
    }
  }

  return (
    <article
      className={`restaurant-job-card restaurant-swipe-card${
        isDragging ? ' is-dragging' : ''
      }${isCommittingSwipe ? ' is-committing' : ''}${
        isPreview ? ' is-preview' : ''
      }${className ? ` ${className}` : ''}`}
      style={
        isDragging || isCommittingSwipe
          ? {
              transform: `translateX(${dragOffsetX}px) rotate(${rotation}deg)`,
            }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => void handlePointerUp(event)}
      onPointerCancel={handlePointerCancel}
    >
      <span
        className="restaurant-swipe-hint restaurant-apply-hint"
        style={{
          opacity: dragOffsetX > 0 ? hintOpacity : 0,
        }}
        aria-hidden="true"
      >
        {text.applyHint}
      </span>
      <span
        className="restaurant-swipe-hint restaurant-skip-hint"
        style={{
          opacity: dragOffsetX < 0 ? hintOpacity : 0,
        }}
        aria-hidden="true"
      >
        {text.skipHint}
      </span>

      <div className="restaurant-job-card-top">
        <div
          className="restaurant-job-avatar"
          style={{ backgroundColor: avatar.backgroundColor }}
          aria-hidden="true"
        >
          <span>{avatar.initial}</span>
        </div>
        <div>
          <p className="restaurant-job-name">{job.restaurantName}</p>
          <div className="restaurant-job-role-line">
            <h2>{getRestaurantRoleLabel(job.role, language)}</h2>
            <span className="restaurant-job-role-icon" aria-hidden="true">
              {placeIcon}
            </span>
          </div>
        </div>
      </div>
      <p className="restaurant-job-location">
        {[job.city, job.street].filter(Boolean).join(' · ')}
      </p>
      <div className="restaurant-vibe-badges" aria-label="Restaurant vibe">
        {vibeBadges.map((badge) => (
          <span key={badge}>{badge}</span>
        ))}
      </div>

      {job.shiftInfo && (
        <div className="restaurant-job-highlight">
          <span>{text.shift}</span>
          <strong>{job.shiftInfo}</strong>
        </div>
      )}

      {description && (
        <p className="restaurant-job-description">{description}</p>
      )}

      {requirements && (
        <div className="restaurant-job-requirements">
          <strong>{text.requirements}</strong>
          <p>{requirements}</p>
        </div>
      )}

      <div className="restaurant-job-actions">
        <button
          className="restaurant-skip-button"
          type="button"
          disabled={isApplying || isAnimating || isPreview || isCommittingSwipe}
          onClick={onSkip}
        >
          {text.skip}
        </button>
        <button
          className="restaurant-apply-button"
          type="button"
          disabled={isApplying || isAnimating || isPreview || isCommittingSwipe}
          onClick={() => void onApply()}
        >
          {isApplying ? text.applying : text.apply}
        </button>
      </div>
    </article>
  )
}

export default RestaurantSwipeCard
