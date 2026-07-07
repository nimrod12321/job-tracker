import { useRef, useState, type PointerEvent } from 'react'
import {
  getRestaurantRoleLabel,
  type RestaurantExploreJob,
} from '../types/restaurant'
import type { AppLanguage } from '../utils/restaurantLanguage'

const SWIPE_THRESHOLD = 100
const SWIPE_EXIT_DISTANCE = 900

type RestaurantSwipeCardProps = {
  job: RestaurantExploreJob
  isApplying: boolean
  language: AppLanguage
  onApply: () => Promise<boolean>
  onSkip: () => boolean
}

function RestaurantSwipeCard({
  job,
  isApplying,
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
  const whatsappNumber = job.contactWhatsapp.replace(/\D/g, '')
  const text = {
    applyHint: language === 'he' ? 'הגש' : 'APPLY',
    skipHint: language === 'he' ? 'דלג' : 'SKIP',
    shift: language === 'he' ? 'משמרות' : 'Shift',
    requirements: language === 'he' ? 'דרישות' : 'Need',
    contact: language === 'he' ? 'יצירת קשר' : 'Contact',
    call: language === 'he' ? 'טלפון' : 'Call',
    whatsapp: language === 'he' ? 'וואטסאפ' : 'WhatsApp',
    skip: language === 'he' ? 'דלג' : 'Skip',
    apply: language === 'he' ? 'הגש בקשה' : 'Like · Apply',
    applying: language === 'he' ? 'שולח...' : 'Applying...',
  }

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
      }${isCommittingSwipe ? ' is-committing' : ''}`}
      style={{
        transform: `translateX(${dragOffsetX}px) rotate(${rotation}deg)`,
      }}
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

      <p className="restaurant-job-name">{job.restaurantName}</p>
      <h2>{getRestaurantRoleLabel(job.role, language)}</h2>
      <p className="restaurant-job-location">
        {[job.city, job.street].filter(Boolean).join(' · ')}
      </p>

      {job.shiftInfo && (
        <div className="restaurant-job-highlight">
          <span>{text.shift}</span>
          <strong>{job.shiftInfo}</strong>
        </div>
      )}

      {job.description && (
        <p className="restaurant-job-description">{job.description}</p>
      )}

      {job.requirements && (
        <div className="restaurant-job-requirements">
          <strong>{text.requirements}</strong>
          <p>{job.requirements}</p>
        </div>
      )}

      {(job.contactPhone || whatsappNumber) && (
        <div className="restaurant-job-contact">
          <strong>{text.contact}</strong>
          <div>
            {job.contactPhone && (
              <a href={`tel:${job.contactPhone}`}>{text.call}</a>
            )}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
              >
                {text.whatsapp}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="restaurant-job-actions">
        <button
          className="restaurant-skip-button"
          type="button"
          disabled={isApplying || isCommittingSwipe}
          onClick={onSkip}
        >
          {text.skip}
        </button>
        <button
          className="restaurant-apply-button"
          type="button"
          disabled={isApplying || isCommittingSwipe}
          onClick={() => void onApply()}
        >
          {isApplying ? text.applying : text.apply}
        </button>
      </div>
    </article>
  )
}

export default RestaurantSwipeCard
