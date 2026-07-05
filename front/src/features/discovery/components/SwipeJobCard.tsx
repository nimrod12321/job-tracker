import {
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import type {
  DiscoveryDecisionValue,
  DiscoveryJob,
} from '../types/discovery'

const SWIPE_THRESHOLD = 100
const SWIPE_EXIT_DISTANCE = 900

type SwipeJobCardProps = {
  job: DiscoveryJob
  isRecording: boolean
  onDecision: (
    decision: DiscoveryDecisionValue,
  ) => Promise<boolean>
}

function getSalaryDisplay(job: DiscoveryJob) {
  const confirmedSalary = job.salaryText.trim()

  if (confirmedSalary && confirmedSalary !== 'Salary not listed') {
    return confirmedSalary
  }

  if (job.estimatedSalary.trim()) {
    return `${job.estimatedSalary} (estimated)`
  }

  return confirmedSalary || 'Salary not listed'
}

function SwipeJobCard({
  job,
  isRecording,
  onDecision,
}: SwipeJobCardProps) {
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
      isRecording ||
      isCommittingSwipe ||
      event.button !== 0 ||
      target.closest('button, a, details, summary')
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

    const decision = finalOffset > 0 ? 'liked' : 'disliked'
    const direction = finalOffset > 0 ? 1 : -1

    setIsCommittingSwipe(true)
    setDragOffsetX(direction * SWIPE_EXIT_DISTANCE)

    const succeeded = await onDecision(decision)

    if (!succeeded) {
      resetDrag()
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    if (activePointerId.current !== event.pointerId) {
      return
    }

    resetDrag()
  }

  return (
    <article
      className={`discover-card swipe-job-card${
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
        className="swipe-hint swipe-like-hint"
        style={{
          opacity: dragOffsetX > 0 ? hintOpacity : 0,
        }}
        aria-hidden="true"
      >
        LIKE
      </span>
      <span
        className="swipe-hint swipe-dislike-hint"
        style={{
          opacity: dragOffsetX < 0 ? hintOpacity : 0,
        }}
        aria-hidden="true"
      >
        NOPE
      </span>

      <div className="discover-card-topline">
        <div>
          <p className="discover-company">{job.company}</p>
          <h2>{job.position}</h2>
        </div>
        <span className={`discover-priority ${job.priority}`}>
          {job.priority}
        </span>
      </div>

      <div className="discover-meta">
        <span>{job.location || 'Location not listed'}</span>
        <span>{job.source}</span>
      </div>

      <div className="discover-fit">
        <strong>{job.fitScore}% fit</strong>
        <p>{job.fitReason}</p>
      </div>

      <p className="discover-summary">{job.summary}</p>

      <ul className="discover-key-details">
        {job.keyDetails.slice(0, 4).map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>

      <div className="discover-salary">
        <span>Salary</span>
        <strong>{getSalaryDisplay(job)}</strong>
      </div>

      {job.concerns.length > 0 && (
        <div className="discover-concerns">
          <strong>
            {job.concerns.length === 1 ? 'Concern' : 'Concerns'}
          </strong>
          <ul>
            {job.concerns.map((concern) => (
              <li key={concern}>{concern}</li>
            ))}
          </ul>
        </div>
      )}

      {job.jobDescription && (
        <details className="discover-details">
          <summary>More details</summary>
          <p>{job.jobDescription}</p>
        </details>
      )}

      <div className="discover-actions">
        <button
          className="discover-dislike-button"
          type="button"
          disabled={isRecording || isCommittingSwipe}
          onClick={() => void onDecision('disliked')}
        >
          {isRecording ? 'Saving...' : 'Dislike'}
        </button>

        {job.jobUrl && (
          <a
            className="discover-open-link"
            href={job.jobUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open job
          </a>
        )}

        <button
          className="discover-like-button"
          type="button"
          disabled={isRecording || isCommittingSwipe}
          onClick={() => void onDecision('liked')}
        >
          {isRecording ? 'Saving...' : 'Like'}
        </button>
      </div>
    </article>
  )
}

export default SwipeJobCard
